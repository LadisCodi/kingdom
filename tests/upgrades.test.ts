// Minor RANKS: the ladders that used to be levelled upgrades. Their gating,
// their cost curve, and the effective-value helpers actually changing sim
// behaviour. See Docs/features/tech-tree.md §1 rule 2.
import { describe, expect, it } from 'vitest';
import {
  FOG, HARVEST, TECHNOLOGIES, TECH_LINES, TECH_LINE_ORDER, TECH_ORDER, lineParent,
} from '../src/sim/data/definitions';
import { grantArtifact } from '../src/sim/artifacts';
import { castCost } from '../src/sim/casting';
import { revealCostForCell, revealPerTap } from '../src/sim/fog';
import { collectTap } from '../src/sim/harvest';
import { salePayout, sellGoods } from '../src/sim/market';
import { getWallet } from '../src/sim/state';
import { advance } from '../src/sim/commands';
import { canStartTech, startTech } from '../src/sim/research';
import {
  effectiveAutoTapCooldownMs, effectiveSalePriceMultiplier, effectiveTapYield,
  effectiveTaxRate, effectiveWorkerYield, lineMaxRank, lineRank,
} from '../src/sim/upgrades';
import {
  addBuilt, canGather, completeTech, FOREST, freshGame, fund, map, T0, tickAt, completeRanks } from './helpers';


/** Research one rank end to end, through the real command and the real clock
 *  — the whole point of the collapse is that a rank goes through `startTech`
 *  like anything else. */
const research = (state: ReturnType<typeof freshGame>, id: Parameters<typeof startTech>[1]) => {
  const r = startTech(state, id, T0);
  advance(state, map, T0 + TECHNOLOGIES[id].durationSeconds * 1000);
  return r;
};

describe('researching a rank', () => {
  it('costs Gold and TIME, on the curve the upgrade levels used to charge', () => {
    const state = freshGame();
    fund(state, { Gold: 1000 });
    completeTech(state, 'Forestry');
    // The old cost curve is preserved exactly: base 50, growth 2.2.
    expect(TECHNOLOGIES.TapPowerI.cost.Gold).toBe(50);
    expect(TECHNOLOGIES.TapPowerII.cost.Gold).toBe(110); // 50 × 2.2
    // …and unlike an upgrade, it is not instant.
    expect(TECHNOLOGIES.TapPowerI.durationSeconds).toBeGreaterThan(0);

    expect(startTech(state, 'TapPowerI', T0)).toBe('Started');
    expect(getWallet(state.city.wallet, 'Gold')).toBe(950);
    expect(lineRank(state, 'TapPower')).toBe(0); // not yet — it is on the clock
    advance(state, map, T0 + TECHNOLOGIES.TapPowerI.durationSeconds * 1000);
    expect(lineRank(state, 'TapPower')).toBe(1);
  });

  it('hangs off its parent technology in the tree', () => {
    const state = freshGame();
    fund(state, { Gold: 1000 });
    expect(startTech(state, 'TapPowerI', T0)).toBe('MissingRequirement'); // Forestry
    expect(startTech(state, 'MarketStallI', T0)).toBe('MissingRequirement'); // Market
    completeTech(state, 'Forestry');
    expect(research(state, 'TapPowerI')).toBe('Started');
    expect(startTech(state, 'MarketStallI', T0)).toBe('MissingRequirement'); // still
    completeTech(state, 'Market');
    expect(research(state, 'MarketStallI')).toBe('Started');
  });

  it('rejects when poor, and runs out of ranks at the top of the ladder', () => {
    const state = freshGame();
    state.city.wallet.Gold = 0; // the opening grant would cover the first rank
    completeTech(state, 'Forestry');
    expect(startTech(state, 'TapPowerI', T0)).toBe('NotEnoughResources');
    // Ranks II+ sit in later eras and wait on those keystones too.
    completeTech(state, 'CharterIII');
    fund(state, { Gold: 1_000_000, Knowledge: 1_000_000 });
    for (const id of TECH_LINES.TapPower) expect(research(state, id)).toBe('Started');
    expect(lineRank(state, 'TapPower')).toBe(lineMaxRank('TapPower'));
    // There is no "AtMax": the ladder simply has no further rung.
    for (const id of TECH_LINES.TapPower) expect(canStartTech(state, id)).toBe(false);
  });
});

describe('effects reach the sim', () => {
  it('TapPower increases what a collect tap yields', () => {
    const state = freshGame();
    fund(state, { Gold: 1000 });
    canGather(state);
    completeRanks(state, 'TapPower', 1); // +1
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(getWallet(state.city.wallet, 'Wood')).toBe(2); // 1 base + 1
  });

  // QuickHands shortens the gap between AUTO-taps only. A deliberate tap has
  // no cooldown to shave, so the line is a convenience — it narrows the gap
  // toward manual tapping without ever closing it.
  it('QuickHands shortens the auto-tap cooldown, and nothing else', () => {
    const state = freshGame();
    fund(state, { Gold: 100000 });
    completeTech(state, 'Forestry');
    expect(effectiveAutoTapCooldownMs(state)).toBe(500);

    completeRanks(state, 'QuickHands', 1); // -0.05s
    expect(effectiveAutoTapCooldownMs(state)).toBe(450);

    completeRanks(state, 'QuickHands', lineMaxRank('QuickHands'));
    expect(lineRank(state, 'QuickHands')).toBe(lineMaxRank('QuickHands'));
    // 0.5 - 5x0.05 = 0.25s: still slower than a determined tapper.
    expect(effectiveAutoTapCooldownMs(state)).toBe(250);
  });

  it('QuickHands never lets a hold out-pace a manual tap', () => {
    const state = freshGame();
    fund(state, { Gold: 100000 });
    canGather(state);
    completeRanks(state, 'QuickHands', lineMaxRank('QuickHands'));

    // Manual taps ignore the cooldown entirely, finished ladder or not.
    expect(collectTap(state, map, FOREST, T0)).toBe('Harvested');
    expect(collectTap(state, map, FOREST, T0 + 1)).toBe('Harvested');
    // A held repeat still waits, just less than it used to.
    expect(collectTap(state, map, FOREST, T0 + 2, true)).toBe('OnCooldown');
    expect(collectTap(state, map, FOREST, T0 + 1 + 250, true)).toBe('Harvested');
  });

  it('MarketStall raises the Market sale prices', () => {
    const state = freshGame();
    addBuilt(state, 'Market', { x: 2, y: 0 });
    fund(state, { Gold: 1000, Wood: 100 });
    completeTech(state, 'Market');
    expect(salePayout(state, 'Wood', 100)).toBe(300);
    completeRanks(state, 'MarketStall', 1); // +5%
    expect(effectiveSalePriceMultiplier(state)).toBeCloseTo(1.05);
    expect(sellGoods(state, 'Wood', 100).gold).toBe(315);
  });

  it('TradeRoutes boosts the passive tax rate', () => {
    const state = freshGame();
    addBuilt(state, 'Housing', { x: 2, y: 0 });
    state.city.population = 1;
    fund(state, { Gold: 1000 });
    completeTech(state, 'Market');
    expect(effectiveTaxRate(state)).toBe(30);
    completeRanks(state, 'TradeRoutes', 1); // +10% → 33/min
    expect(effectiveTaxRate(state)).toBeCloseTo(33);
    tickAt(state, T0 + 301_000); // ~5 min × 33/min → 165 gold (150 unboosted)
    // The helper grants the rank without charging for it — the point under
    // test is the tax rate, not the price of the research.
    expect(getWallet(state.city.wallet, 'Gold')).toBe(1000 + 165);
  });
});

// The minor lines added 2026-09-02, one per big technology that had none.
//
// The only thing worth asserting about a line is that it REACHES the sim: a
// definition with no consumer is a price tag on nothing, and that is the
// failure mode this whole file exists to catch (see `withWardenBonus`, which
// shipped inert for weeks). So each of these researches a rank and measures
// the number the player actually experiences, never the effect table.
describe('every line reaches the number it claims to', () => {
  // The tech tree groups ranks with `TECH_LINES` keyed by parent, so a
  // upgrade missing from that list is invisible IN THE GAME while still being
  // purchasable by id — which is exactly what happened to Surveying, with a
  // quest pointing the player at a node that was never drawn.
  it('shows every authored rank somewhere in the tree', () => {
    // TECH_LINES is derived from TECH_ORDER, so a rank missing from the order
    // is invisible in the game — which is exactly what happened to Surveying,
    // with a quest pointing the player at a node that was never drawn.
    for (const line of TECH_LINE_ORDER) {
      const ranks = TECH_LINES[line];
      expect(ranks.length, `${line} has no ranks`).toBeGreaterThan(0);
      for (const id of ranks) {
        expect(TECH_ORDER, `${line} rank ${id} is not in TECH_ORDER`).toContain(id);
      }
      const parent = lineParent(line);
      expect(parent, `${line} hangs off no technology, so nothing draws it`).not.toBeNull();
      expect(TECH_ORDER, `${line} hangs off an unknown technology`).toContain(parent);
    }
  });

  it('Butchery adds to what a tap on wild game yields, and to nothing else', () => {
    const state = freshGame();
    const meat = effectiveTapYield(state, HARVEST.Meat);
    const wood = effectiveTapYield(state, HARVEST.Forest);
    completeRanks(state, 'Butchery', 2);
    expect(effectiveTapYield(state, HARVEST.Meat)).toBe(meat + 2);
    expect(effectiveTapYield(state, HARVEST.Forest)).toBe(wood); // scoped
  });

  it('Scythes adds to a tap on crops', () => {
    const state = freshGame();
    const before = effectiveTapYield(state, HARVEST.Crops);
    completeRanks(state, 'Scythes', 3);
    expect(effectiveTapYield(state, HARVEST.Crops)).toBe(before + 3);
  });

  it('Sawpits and Irrigation add to worker deliveries, each to its own resource', () => {
    const state = freshGame();
    const wood = effectiveWorkerYield(state, HARVEST.Forest);
    const crops = effectiveWorkerYield(state, HARVEST.Crops);
    completeRanks(state, 'Sawpits', 2);
    expect(effectiveWorkerYield(state, HARVEST.Forest)).toBe(wood + 2);
    expect(effectiveWorkerYield(state, HARVEST.Crops)).toBe(crops);
    completeRanks(state, 'Irrigation', 1);
    expect(effectiveWorkerYield(state, HARVEST.Crops)).toBe(crops + 1);
  });

  // Pitons and Surveying buy down two DIFFERENT costs — the Gold a cell wants
  // and the taps it takes to pay it — so they have to stack without either
  // making the other pointless.
  it('Pitons discounts the Gold a cell costs, and stacks with Surveying', () => {
    const state = freshGame();
    const cell = { x: 3, y: 1 };
    const full = revealCostForCell(state, map, cell);

    completeRanks(state, 'Pitons', 2); // −20%
    const discounted = revealCostForCell(state, map, cell);
    expect(discounted).toBe(Math.max(FOG.goldPerTap, Math.round(full * 0.8)));

    // Surveying does not touch the price, only the number of presses.
    const tapsBefore = revealPerTap(state);
    completeRanks(state, 'Surveying', 1);
    expect(revealCostForCell(state, map, cell)).toBe(discounted);
    expect(revealPerTap(state)).toBe(tapsBefore + 1);
  });

  it('Pitons can never make a cell free', () => {
    const state = freshGame();
    completeRanks(state, 'Pitons', 99); // far past max, as a modifier stack might
    expect(revealCostForCell(state, map, { x: 3, y: 1 }))
      .toBeGreaterThanOrEqual(FOG.goldPerTap);
  });

  it('Resonance buys down what a relic costs to cast', () => {
    const state = freshGame();
    grantArtifact(state, 'VerdantSeal');
    const full = castCost(state, 'VerdantSeal');
    expect(full).toBeGreaterThan(0);
    completeRanks(state, 'Resonance', 2); // −40%
    expect(castCost(state, 'VerdantSeal')).toBe(Math.round(full * 0.6));
  });

  // The renderer fans a line under `lineParent(line)`, and only MAJORS have a
  // grid position to fan from. A line whose parent is itself a rank would
  // therefore be drawn nowhere at all — invisible in the game while still
  // being researchable by id. That is precisely the Surveying bug the repo
  // already shipped once, in a new costume.
  it('hangs every line under a major, so the fan has somewhere to draw it', () => {
    for (const line of TECH_LINE_ORDER) {
      const parent = lineParent(line);
      expect(parent, `${line} hangs off nothing`).not.toBeNull();
      expect(TECHNOLOGIES[parent!].node, `${line} hangs off ${parent}, which is itself a rank`)
        .not.toBeNull();
    }
  });

  // And every rank is reachable from exactly one fan: ranks after the first
  // chain off the rank before, so the whole ladder hangs from one major.
  it('chains each rank off the one before, so a ladder has a single root', () => {
    for (const line of TECH_LINE_ORDER) {
      const ranks = TECH_LINES[line];
      ranks.forEach((id, i) => {
        const requires = TECHNOLOGIES[id].requires;
        // The FIRST requirement is the ladder: the parent major for rank I,
        // the rank before for every rank after. A rank in era 2+ carries its
        // era's keystone as a second requirement, which is the era gate.
        if (i > 0) expect(requires[0], `${id} should follow ${ranks[i - 1]}`).toBe(ranks[i - 1]);
        const extra = requires.slice(1);
        expect(extra.length, `${id} has more than an era gate`).toBeLessThanOrEqual(1);
        for (const k of extra) expect(k, `${id}'s second requirement is not a keystone`).toMatch(/^(Charter|Warband|Attunement)(II|III|IV)$/);
      });
    }
  });

  // Every line hangs off a major technology, and rank I is unreachable before
  // it. A line rooted at nothing would float free of the tree entirely.
  it('is locked behind the technology its line hangs off', () => {
    const state = freshGame();
    fund(state, { Gold: 1_000_000 });
    for (const line of TECH_LINE_ORDER) {
      expect(lineParent(line), `${line} hangs off nothing`).not.toBeNull();
      const first = TECH_LINES[line][0];
      expect(canStartTech(state, first), `${line} I starts with no research`).toBe(false);
    }
  });
});
