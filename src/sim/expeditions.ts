// Delves (Docs/features/11-expeditions.md §2, §5, §7).
//
// A ruin is a repeatable DUNGEON, not a chest. Commit one hero plus units, pay
// supplies once, and the party clears one DEPTH at a time. After each depth it
// stops at a checkpoint and asks a single question:
//
//     Go deeper, or come back with what you're carrying?
//
// That is what gives a visit texture. One long expedition produces one decision
// per visit, so some visits contain nothing; staged depths produce three or
// four, and the run is self-terminating — you push until you choose to stop.
//
// TWO RULES KEEP IT COZY, and both are load-bearing rather than decorative.
//
//  1. THE HAUL IS NOT YOURS UNTIL YOU EXTRACT IT. That framing is what makes a
//     50% loss legitimate under "nothing you own is ever taken from you":
//     nothing you OWN is taken, you declined a sure thing. Identical logic to
//     Mana overflow — unrealized gain, never property. The UI has to sell this
//     from the first depth or players will feel robbed whatever the technicality.
//  2. A CHECKPOINT NEVER EXPIRES. The party waits at depth 3 indefinitely: no
//     decision timer, no interrupt, no auto-fail while away. That is what stops
//     the system becoming an interruption engine, and it turns a parked delve
//     into a return hook. The cost of not deciding is real but gentle — that
//     hero stays committed until you do.
//
// And the rule that decides every timing question here:
//
//     The offline cap limits what the CITY PRODUCES while you are away.
//     It never limits what a TIMER does.
//
// Delve timers are timers. They keep running past the cap, like the build
// queue and research.

import {
  ARTIFACTS, DELVE, HEROES, PARTY, RUINS,
} from './data/definitions';
import {
  addArtifactFragments, artifactEntry, artifactIsCarried, grantArtifact, isAttuned,
  ownsArtifact,
} from './artifacts';
import { addHeroXp, heroSlots } from './heroes';
import { recordResourceDiscovery } from './discovery';
import {
  depthDurationMs, effectiveAttack, enemyFormation, formationPower, guaranteedDepth,
  matchupAgainst, partyStats, resolveDepth, threatStrength, worstThreatFor,
  type CarriedArtifact, type EnemySquad, type Party, type PartySlot, type Drill,
} from './combat';
import { availableRoster } from './army';
import {
  gateFormation, gateIsCleared, gatePower, gateSupplies, markGateCleared,
} from './gates';
import { fogState } from './fog';
import type { MapData } from './grid';
import { resolve } from './modifiers';
import { isTechComplete } from './research';
import { techFlat, techFlatAimed, techValue } from './techEffects';
import { pick } from './rng';
import {
  addToWallet, newId,
  type ArtifactId, type Delve, type GameState, type HeroId, type RuinId,
  type UnitId, type Wallet,
} from './state';
import { canAfford, pay } from './wallet';

// ------------------------------------------------------------------- slots

/** How long a depth actually takes right now. Kept in ONE place so a
 *  timed boon that speeds delves up cannot apply to the launch and not to the
 *  push, or to the timer and not to the estimate on the sheet. */
export const depthMs = (state: GameState, ruinId: RuinId, depth: number): number =>
  Math.max(1000, Math.round(resolve(state, 'delveSpeed',
    depthDurationMs(ruinId, depth) * Math.max(0.25, techValue(state, 'delveSpeed', 1)))));

/**
 * THE TROOP SLOTS, and there is nothing to buy.
 *
 * Every one of the board's slots is open from the first fight
 * (Docs/features/combat.md §3). They used to be a Gem ladder starting at one,
 * which priced the thing the type chart needs to be legible: a player with
 * one slot has no composition to make, so the whole matchup lesson sat behind
 * a purchase. What limits a party now is the ARMY AT HOME and the army cap —
 * both of which are earned in the city — and the only slot in the game that
 * is bought is a HERO slot (Docs/features/10-heroes.md §3).
 */
export const troopSlots = (): number => PARTY.troopSlots;

// ---------------------------------------------------------------- supplies

/** Supplies are a FLAT cost at launch, not per depth, so the depth decision is
 *  purely risk against reward with nothing else muddying it. The
 *  Quartermaster's whole trait is a discount on this. */
export function supplyCost(
  state: GameState, ruinId: RuinId, heroIds: readonly HeroId[],
): Wallet {
  const base = RUINS[ruinId].supplies;
  // The best quartermaster in the party, not the sum of them: two of them
  // would otherwise stack to a free trip.
  const discount = heroIds.reduce((best, id) => (HEROES[id].trait === 'SupplyDiscount'
    ? Math.max(best, HEROES[id].traitValue) : best), 0);
  // Rations stacks with the Quartermaster's trait the way a rank and a relic
  // stack everywhere else: the trait is a discount, the line is a discount,
  // and the modifier stack rides on the product.
  const mult = Math.max(0, resolve(state, 'supplyCost',
    (1 - discount) * techValue(state, 'supplyCost', 1)));
  const out: Wallet = {};
  for (const [c, n] of Object.entries(base)) {
    out[c as keyof Wallet] = Math.max(1, Math.round(n * mult));
  }
  return out;
}

/**
 * The kingdom's drill: what the Warfare technologies add to every soldier
 * sent, in the shape combat.ts takes it. Resolved HERE, once per launch or
 * preview, so combat stays pure and a fight replays from its inputs. The `all`
 * terms go through the modifier stack; the per-tag ones are the tree's and
 * nothing else.
 *
 * The per-tag terms use `techFlatAimed`, which excludes the unaimed effects,
 * because `combat.ts` sums `all` plus every tag a unit carries — and Cavalry
 * carries two, so an aimed query that included the global term would pay
 * Warhorns twice on an Archer and three times on a Cavalry.
 *
 * `Tactics` stays a hardcoded ternary, unlike `Cartography` and `Communities`
 * which became data. As an effect it would fold into `techFlat` and turn
 * `(base + manoeuvre) + 0.10` into `base + (manoeuvre + 0.10)`, and float
 * addition is not associative: at `base = 0.33` those are different doubles at
 * one and two Manoeuvre ranks. `base` is 0 today, so it would be exact today —
 * which is the kind of exactness that stops being true the first time a
 * modifier reaches `typeDisadvantage`, and `modifiers.ts` declares it so one
 * can.
 */
export function drillOf(state: GameState): Drill {
  return {
    atk: {
      all: Math.round(resolve(state, 'unitAtk', techFlat(state, 'unitAtk'))),
      Distance: techFlatAimed(state, 'unitAtk', { unitTag: 'Distance' }),
    },
    def: {
      all: Math.round(resolve(state, 'unitDef', 0)),
      Melee: techFlatAimed(state, 'unitDef', { unitTag: 'Melee' }),
      Mounted: techFlatAimed(state, 'unitDef', { unitTag: 'Mounted' }),
    },
    disadvantageOffset: Math.max(0, resolve(state, 'typeDisadvantage', 0)
      + techFlat(state, 'typeDisadvantage')
      + (isTechComplete(state, 'Tactics') ? 0.10 : 0)), // reading the ground
  };
}

/**
 * A Party as combat sees it, with the kingdom's drill attached and every hero
 * resolved to the level it fights at. The one place a Party is assembled, so
 * no launch or preview can forget either.
 */
export const partyOf = (
  state: GameState, slots: readonly PartySlot[], heroIds: readonly HeroId[] = [],
  artifact: CarriedArtifact | null = null,
): Party => ({
  heroes: heroIds.map((id) => ({ id, level: heroLevel(state, id) })),
  slots,
  artifact,
  drill: drillOf(state),
});

/** The fraction of the haul a failed depth costs (Bearers: −3%/rank, floor
 *  20%). Half by default — enough that a bad push is a real loss, never so
 *  much that a run can be wiped, which promise 1 would not allow. */
export const effectiveHaulLoss = (state: GameState): number =>
  Math.min(1, Math.max(0.2, resolve(state, 'haulLoss',
    DELVE.failHaulLoss
      - (isTechComplete(state, 'Salvage') ? 0.15 : 0) // half becomes 35%
      + techFlat(state, 'haulLoss'))));

// ------------------------------------------------------------------- heroes

export const heroLevel = (state: GameState, id: HeroId): number => state.heroes.levels[id] ?? 1;

export const ownsHero = (state: GameState, id: HeroId): boolean => state.heroes.owned.includes(id);

/** A hero already underground cannot lead a second party. One hero means one
 *  delve at a time, which is what makes the second hero a genuine prize. */
export const heroIsBusy = (state: GameState, id: HeroId): boolean =>
  state.delves.some((d) => d.heroIds.includes(id) && d.phase !== 'done');

/** What a delve's relic contributes, at the level it went down at. */
export const carriedOf = (delve: Delve): CarriedArtifact | null =>
  delve.artifactId === null ? null : { id: delve.artifactId, level: delve.artifactLevel };

export const freeHeroes = (state: GameState): HeroId[] =>
  state.heroes.owned.filter((id) => !heroIsBusy(state, id));

// ------------------------------------------------------------------ launch

export type LaunchBlock =
  | 'RuinNotFound' | 'GateStanding' | 'NoHero' | 'HeroBusy' | 'TooManyHeroes'
  | 'EmptyParty' | 'TooManySlots'
  | 'NotEnoughUnits' | 'NotEnoughSupplies'
  | 'ArtifactNotOwned' | 'ArtifactAttuned' | 'ArtifactCarried';

export function launchBlock(
  state: GameState,
  map: MapData,
  ruinId: RuinId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
  artifactId: ArtifactId | null = null,
): LaunchBlock | null {
  if (fogState(state, map, RUINS[ruinId].location) !== 'Revealed') return 'RuinNotFound';
  // Nothing in the ruin can be entered until the gate is cleared: the garrison
  // is standing in the doorway (Docs/features/18-garrisons-and-raids.md §1).
  if (!gateIsCleared(state, ruinId)) return 'GateStanding';
  if (heroIds.length === 0 || heroIds.some((id) => !ownsHero(state, id))) return 'NoHero';
  if (heroIds.length > heroSlots(state)) return 'TooManyHeroes';
  // A DELVE parks its party underground, so its hero really is committed
  // until the run ends. A gate does not (`gateBlock`): it resolves on entry,
  // and a hero is never busy for a fight like that
  // (Docs/features/10-heroes.md §2.5).
  if (heroIds.some((id) => heroIsBusy(state, id))) return 'HeroBusy';
  const committed = slots.filter((s) => s.count > 0);
  if (committed.length === 0) return 'EmptyParty';
  if (committed.length > troopSlots()) return 'TooManySlots';
  const available = availableRoster(state);
  for (const s of committed) {
    if (s.count > available[s.unitId]) return 'NotEnoughUnits';
  }
  // No cap check: the army cap bounds what the city OWNS
  // (Docs/features/combat.md §14), and a party is drawn from what it owns —
  // so `NotEnoughUnits` above is the only ceiling a composition can hit.
  if (!canAfford(state.city.wallet, supplyCost(state, ruinId, heroIds))) return 'NotEnoughSupplies';
  if (artifactId !== null) {
    if (!ownsArtifact(state, artifactId)) return 'ArtifactNotOwned';
    // Attune OR arm. Refusing here rather than silently un-attuning is the
    // point: the player gives up a passive they are living off to arm a hero,
    // so the sim must never make that choice on their behalf.
    if (isAttuned(state, artifactId)) return 'ArtifactAttuned';
    if (artifactIsCarried(state, artifactId)) return 'ArtifactCarried';
  }
  return null;
}

export type LaunchResult = 'Launched' | LaunchBlock;

export function launchDelve(
  state: GameState,
  map: MapData,
  ruinId: RuinId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
  now: number,
  standingOrder: number | null = null,
  artifactId: ArtifactId | null = null,
): LaunchResult {
  const block = launchBlock(state, map, ruinId, heroIds, slots, artifactId);
  if (block !== null) return block;
  pay(state.city.wallet, supplyCost(state, ruinId, heroIds));
  const committed = slots.filter((s) => s.count > 0).map((s) => ({ ...s }));
  const artifactLevel = artifactId === null ? 1 : artifactEntry(state, artifactId).level;
  const artifact = artifactId === null ? null : { id: artifactId, level: artifactLevel };
  const party = partyOf(state, committed, heroIds, artifact);
  const hp = partyStats(party).hp;
  state.delves.push({
    id: newId(state, 'delve'),
    ruinId,
    heroIds: [...heroIds],
    artifactId,
    artifactLevel,
    party: committed,
    depth: 0,
    partyHp: hp,
    maxPartyHp: hp,
    haul: {},
    haulFragments: 0,
    phase: 'descending',
    depthEndsAt: now + depthMs(state, ruinId, 1),
    standingOrder,
    threat: rollThreat(state, ruinId, 1),
    outcome: null,
  });
  return 'Launched';
}

// -------------------------------------------------------------- the gate

/**
 * The gate is the ruin's FRONTIER ROOM while it stands: it sits above Depth 1
 * and is entered the same way, with `Clear the gate` in place of *Descend*
 * (Docs/features/18-garrisons-and-raids.md §5).
 *
 * It lives here rather than in `gates.ts` because clearing one is a PARTY
 * command — a hero, a matchup and supplies — and this module already owns all
 * three. `gates.ts` owns the clock and the hoard, and knows nothing about how
 * a garrison is beaten.
 *
 * Two things make it the right first fight. The threat is in VIEW — no
 * scouting, no hidden type — and the party may be a hero ALONE, so the very
 * first battle needs no army at all. A shortfall warns rather than blocks, and
 * a retry is identical to a first attempt: nothing is lost but the supplies.
 */
export type GateBlock =
  | 'RuinNotFound' | 'AlreadyCleared' | 'NoHero' | 'TooManyHeroes' | 'TooManySlots'
  | 'NotEnoughUnits' | 'NotEnoughSupplies';

export function gateBlock(
  state: GameState,
  map: MapData,
  ruinId: RuinId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
): GateBlock | null {
  if (fogState(state, map, RUINS[ruinId].location) !== 'Revealed') return 'RuinNotFound';
  if (gateIsCleared(state, ruinId)) return 'AlreadyCleared';
  if (heroIds.length === 0 || heroIds.some((id) => !ownsHero(state, id))) return 'NoHero';
  if (heroIds.length > heroSlots(state)) return 'TooManyHeroes';
  // NO 'HeroBusy'. A gate resolves on ENTRY, so a hero is never busy for it —
  // the same hero leads every room the player enters
  // (Docs/features/10-heroes.md §2.5). Only a DELVE parks a party
  // underground, and only `launchBlock` asks.
  // A hero alone is a legal board, so there is no EmptyParty here either.
  const committed = slots.filter((s) => s.count > 0);
  if (committed.length > troopSlots()) return 'TooManySlots';
  const available = availableRoster(state);
  for (const s of committed) {
    if (s.count > available[s.unitId]) return 'NotEnoughUnits';
  }
  // No cap check: the army cap bounds what the city OWNS
  // (Docs/features/combat.md §14), and a party is drawn from what it owns —
  // so `NotEnoughUnits` above is the only ceiling a composition can hit.
  if (!canAfford(state.city.wallet, gateSupplies(ruinId))) return 'NotEnoughSupplies';
  return null;
}

export interface GateReport {
  result: 'Cleared' | 'Repelled' | GateBlock;
  /** The party's attack after the matchup, and what it had to beat. */
  attack: number;
  power: number;
  /** Everything the garrison had taken, banked on the way out. */
  hoard: Wallet;
  supplies: Wallet;
}

/**
 * One attempt on a gate, resolved on entry with the player attacking.
 *
 * Win: the gate is cleared, its counter stops, its hoard is paid in full and
 * Depth 1 becomes the frontier. Lose: the supplies are gone and the gate
 * stands — no casualties, no cooldown, no second timer.
 */
export function attemptGate(
  state: GameState,
  map: MapData,
  ruinId: RuinId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
): GateReport {
  const guard = RUINS[ruinId].guard;
  // What is scored is the squads the player was SHOWN, not the budget they
  // were generated from.
  const power = gatePower(ruinId);
  const supplies = gateSupplies(ruinId);
  const block = gateBlock(state, map, ruinId, heroIds, slots);
  if (block !== null) {
    return { result: block, attack: 0, power, hoard: {}, supplies };
  }
  pay(state.city.wallet, supplies);
  const committed = slots.filter((s) => s.count > 0).map((s) => ({ ...s }));
  const party = partyOf(state, committed, heroIds);
  const attack = effectiveAttack(party, guard.threat);
  if (attack < power) {
    return { result: 'Repelled', attack, power, hoard: {}, supplies };
  }
  const hoard = markGateCleared(state, ruinId);
  // The fight taught the party something whether or not the garrison was
  // holding anything, and a tier-5 gate teaches more than the Barrow's.
  addHeroXp(state, RUINS[ruinId].tier);
  return { result: 'Cleared', attack, power, hoard, supplies };
}

/** What the room sheet shows before the player commits: the threat is always
 *  visible on a gate, so this hides nothing. */
export interface GatePreview {
  ruinId: RuinId;
  threat: UnitId | 'Any';
  /** The squads in the doorway, and what they are worth. */
  enemy: EnemySquad[];
  power: number;
  attack: number;
  stats: { atk: number; def: number; hp: number };
  supplies: Wallet;
  /** True when the party already beats the gate on paper. A shortfall warns,
   *  it never blocks. */
  enough: boolean;
}

export function previewGate(
  state: GameState,
  ruinId: RuinId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
): GatePreview {
  const guard = RUINS[ruinId].guard;
  const committed = slots.filter((s) => s.count > 0);
  const party = partyOf(state, committed, heroIds);
  const attack = effectiveAttack(party, guard.threat);
  const enemy = gateFormation(ruinId);
  const power = formationPower(enemy);
  return {
    ruinId,
    threat: guard.threat,
    enemy,
    power,
    attack,
    stats: partyStats(party),
    supplies: gateSupplies(ruinId),
    enough: attack >= power,
  };
}

/** What waits at a depth. Keyed by (ruin, depth, seed) so it is the same
 *  question however the window was replayed — the gamble is that you do not
 *  KNOW it yet, never that it is re-rolled behind you. */
export function rollThreat(state: GameState, ruinId: RuinId, depth: number): UnitId | 'Any' {
  const affinity = RUINS[ruinId].affinity;
  if (affinity !== 'Any') {
    // A ruin's affinity DOMINATES its depths without owning all of them, so a
    // dungeon rewards a composition rather than a single unit.
    const pool: Array<UnitId> = [affinity, affinity, affinity, 'Warrior', 'Lancer', 'Archer', 'Cavalry'];
    return pick(state.seed, pool, 'threat', ruinId, depth);
  }
  return pick(state.seed, ['Warrior', 'Lancer', 'Archer', 'Cavalry'] as UnitId[],
    'threat', ruinId, depth);
}

// -------------------------------------------------------------- the descent

export interface DelveEvent {
  delveId: string;
  ruinId: RuinId;
  kind: 'checkpoint' | 'failed' | 'bottom';
  depth: number;
  /** Set on 'bottom' when the ruin's relic was granted for the first time. */
  artifact: ArtifactId | null;
}

/** The haul one depth pays, before the hero's traits. Scales with depth AND
 *  tier, so pushing deeper is worth more than delving a shallow ruin twice. */
function depthHaul(
  state: GameState, ruinId: RuinId, depth: number, heroIds: readonly HeroId[],
): { wallet: Wallet; fragments: number } {
  const ruin = RUINS[ruinId];
  // The best of each trait in the party, never the sum: a bonus that stacked
  // per hero would make a hero slot a yield purchase rather than a board one.
  const best = (trait: string): number => heroIds.reduce(
    (n, id) => (HEROES[id].trait === trait ? Math.max(n, HEROES[id].traitValue) : n), 0);
  const stardustBonus = 1 + best('KnowledgeBonus');
  const fragmentBonus = 1 + best('FragmentBonus');
  const wallet: Wallet = {
    Gold: Math.round(DELVE.goldPerDepthPerTier * ruin.tier * depth),
    Stardust: Math.round(resolve(state, 'stardustYield', techValue(state, 'stardustYield',
      DELVE.stardustPerDepthPerTier * ruin.tier * depth * stardustBonus))),
  };
  // The deeper tiers pay materials the city cannot easily reach otherwise —
  // three times the haul, the rate a vein pays over a plain rock.
  const material = Math.round(DELVE.materialPerDepthPerTier * ruin.tier * depth);
  wallet.Stone = ruin.tier >= 3 ? material * 3 : material;
  return {
    wallet,
    fragments: Math.round(DELVE.fragmentsPerDepth * ruin.tier * fragmentBonus),
  };
}

const addHaul = (delve: Delve, wallet: Wallet, fragments: number): void => {
  for (const [c, n] of Object.entries(wallet)) {
    delve.haul[c as keyof Wallet] = (delve.haul[c as keyof Wallet] ?? 0) + n;
  }
  delve.haulFragments += fragments;
};

/**
 * Resolve every delve depth that finished by `toTime`. Runs in `applyDueAt`,
 * because a depth completing changes what the next boundary is.
 *
 * A delve at a CHECKPOINT is not a timer — it waits forever, and this loop
 * simply never touches it again until the player answers or a standing order
 * does it for them.
 */
export function advanceDelves(state: GameState, toTime: number): DelveEvent[] {
  const events: DelveEvent[] = [];
  for (const delve of state.delves) {
    // Bounded by maxDepth: each pass either advances the depth or stops.
    while (delve.phase === 'descending' && delve.depthEndsAt <= toTime) {
      const ruin = RUINS[delve.ruinId];
      const depth = delve.depth + 1;
      const party = partyOf(state, delve.party, delve.heroIds, carriedOf(delve));
      const outcome = resolveDepth(party, delve.ruinId, depth, delve.threat);
      const survived = outcome.cleared && delve.partyHp - outcome.damage > 0;

      if (!survived) {
        // A failed push costs HALF the haul and ends the run. Nothing you OWN
        // is taken — you declined a sure thing.
        const loss = effectiveHaulLoss(state);
        for (const [c, n] of Object.entries(delve.haul)) {
          delve.haul[c as keyof Wallet] = Math.floor(n * (1 - loss));
        }
        delve.haulFragments = Math.floor(delve.haulFragments * (1 - loss));
        delve.partyHp = Math.max(1, delve.partyHp - outcome.damage);
        delve.phase = 'done';
        delve.outcome = 'failed';
        events.push({
          delveId: delve.id, ruinId: delve.ruinId, kind: 'failed', depth, artifact: null,
        });
        break;
      }

      delve.partyHp -= outcome.damage;
      delve.depth = depth;
      state.deepestDepth = Math.max(state.deepestDepth, depth);
      const paid = depthHaul(state, delve.ruinId, depth, delve.heroIds);
      addHaul(delve, paid.wallet, paid.fragments);

      if (depth >= ruin.maxDepth) {
        // The bottom: the relic is guaranteed on the first clear. No
        // randomness on the thing that gates a system.
        let artifact: ArtifactId | null = null;
        if (state.ruinsCleared[delve.ruinId] !== true) {
          state.ruinsCleared[delve.ruinId] = true;
          artifact = ruin.artifact;
          // The recurring Gem faucet the design needs: one per ruin, once.
          addToWallet(state.player.wallet, 'Gems', DELVE.firstClearGems);
          // Conquest pays Knowledge, plunder pays Stardust. Taking the ruin
          // to its bottom is the conquest: it opens the levelling arc with a
          // Stardust lump AND starts this ruin's permanent Knowledge drip into
          // the city's research clock (sim/mana.ts).
          addToWallet(state.kingdom.wallet, 'Stardust', DELVE.firstClearStardust);
          recordResourceDiscovery(state, 'Stardust');
          addToWallet(state.kingdom.wallet, 'Knowledge', DELVE.firstClearKnowledge);
          recordResourceDiscovery(state, 'Knowledge');
        }
        delve.phase = 'checkpoint';
        events.push({
          delveId: delve.id, ruinId: delve.ruinId, kind: 'bottom', depth, artifact,
        });
        break;
      }

      // A standing order is the opt-out: "delve to depth N, then return" and
      // the whole run resolves offline with no prompts.
      if (delve.standingOrder !== null && depth < delve.standingOrder) {
        delve.threat = rollThreat(state, delve.ruinId, depth + 1);
        delve.depthEndsAt += depthMs(state, delve.ruinId, depth + 1);
        continue;
      }
      delve.phase = 'checkpoint';
      events.push({
        delveId: delve.id, ruinId: delve.ruinId, kind: 'checkpoint', depth, artifact: null,
      });
    }
  }
  return events;
}

/** A boundary source: the next depth to finish. Checkpoints are excluded
 *  deliberately — a party waiting for an answer proposes no boundary at all. */
export function nextDelveBoundary(state: GameState, after: number): number | null {
  let best: number | null = null;
  for (const d of state.delves) {
    if (d.phase !== 'descending') continue;
    if (d.depthEndsAt <= after) continue;
    if (best === null || d.depthEndsAt < best) best = d.depthEndsAt;
  }
  return best;
}

// ----------------------------------------------------------- the checkpoint

export const delveById = (state: GameState, id: string): Delve | undefined =>
  state.delves.find((d) => d.id === id);

export type PushResult = 'Descending' | 'NotAtCheckpoint' | 'AtBottom';

/** "Go deeper." The threat of the next depth is rolled the moment the party
 *  commits to it, and only then — which is exactly the gamble: information,
 *  not dice. */
export function pushDeeper(state: GameState, delveId: string, now: number): PushResult {
  const delve = delveById(state, delveId);
  if (!delve || delve.phase !== 'checkpoint') return 'NotAtCheckpoint';
  if (delve.depth >= RUINS[delve.ruinId].maxDepth) return 'AtBottom';
  delve.phase = 'descending';
  delve.threat = rollThreat(state, delve.ruinId, delve.depth + 1);
  delve.depthEndsAt = now + depthMs(state, delve.ruinId, delve.depth + 1);
  return 'Descending';
}

export interface ExtractReport {
  result: 'Extracted' | 'NotFound';
  wallet: Wallet;
  fragments: number;
  artifact: ArtifactId | null;
  depth: number;
  ruinId: RuinId | null;
}

/** "Come back with what you're carrying." Banks the haul and frees the hero
 *  and the units. Units return wounded and recover fully on reaching the city
 *  — no healing management, no second timer. */
export function extract(state: GameState, delveId: string): ExtractReport {
  const delve = delveById(state, delveId);
  if (!delve) {
    return { result: 'NotFound', wallet: {}, fragments: 0, artifact: null, depth: 0, ruinId: null };
  }
  const artifactId = RUINS[delve.ruinId].artifact;
  for (const [c, n] of Object.entries(delve.haul)) {
    if (n <= 0) continue;
    if (c === 'Stardust') {
      addToWallet(state.kingdom.wallet, 'Stardust', n);
      recordResourceDiscovery(state, 'Stardust');
    }
    else addToWallet(state.city.wallet, c as keyof Wallet, n);
  }
  let granted: ArtifactId | null = null;
  if (state.ruinsCleared[delve.ruinId] === true && delve.depth >= RUINS[delve.ruinId].maxDepth) {
    // Duplicates convert to Fragments rather than being a dead reward.
    granted = grantArtifact(state, artifactId, DELVE.fragmentsPerDepth * RUINS[delve.ruinId].tier)
      === 'Granted' ? artifactId : null;
  }
  if (delve.haulFragments > 0) addArtifactFragments(state, artifactId, delve.haulFragments);
  // XP lands whether or not the run banked anything, so a bad push still
  // taught the party something.
  addHeroXp(state, delve.depth * RUINS[delve.ruinId].tier);
  const report: ExtractReport = {
    result: 'Extracted',
    wallet: { ...delve.haul },
    fragments: delve.haulFragments,
    artifact: granted,
    depth: delve.depth,
    ruinId: delve.ruinId,
  };
  state.delves = state.delves.filter((d) => d.id !== delveId);
  return report;
}

// -------------------------------------------------------------- the read-out

/** Everything the launch screen has to say BEFORE the player commits. */
export interface ExpeditionPreview {
  ruinId: RuinId;
  supplies: Wallet;
  stats: { atk: number; def: number; hp: number };
  /** How deep this party is SAFE, assuming the worst matchup every step. */
  safeDepth: number;
  maxDepth: number;
  /** 1.5 = a strong answer to the ruin, 0.75 = the wrong tool. */
  matchup: number;
  worstThreat: UnitId | 'Any';
  /** What the FIRST depth is standing there as, and what it is worth. The
   *  party is scored against exactly this number when it lands (§5). */
  enemy: EnemySquad[];
  enemyPower: number;
  /** The type the first depth is BIASED to — the ruin's own affinity, which
   *  is public. What actually waits is rolled per depth and stays unknown
   *  until the party commits: the gamble is information, not dice. */
  enemyThreat: UnitId | 'Any';
  /** The party's attack against that bias — the number to read the enemy's
   *  against. */
  attack: number;
}

/**
 * The squads waiting at a depth, sized from the strength the party will
 * actually be scored against and typed by the ruin's own bias.
 *
 * The COUNT is honest — it is `threatStrength` spent on troops — and the TYPE
 * is a bias rather than a promise, which is exactly the shape of what the
 * player knows before they commit.
 */
export const depthFormation = (ruinId: RuinId, depth: number): EnemySquad[] =>
  enemyFormation(threatStrength(ruinId, depth), RUINS[ruinId].affinity);

export function previewExpedition(
  state: GameState,
  ruinId: RuinId,
  heroIds: readonly HeroId[],
  slots: readonly PartySlot[],
  artifactId: ArtifactId | null = null,
): ExpeditionPreview {
  const committed = slots.filter((s) => s.count > 0);
  const artifact: CarriedArtifact | null = artifactId === null
    ? null
    : { id: artifactId, level: artifactEntry(state, artifactId).level };
  const party = partyOf(state, committed, heroIds, artifact);
  const stats = partyStats(party);
  const affinity = RUINS[ruinId].affinity;
  const enemy = depthFormation(ruinId, 1);
  return {
    ruinId,
    supplies: supplyCost(state, ruinId, heroIds),
    stats,
    safeDepth: guaranteedDepth(party, ruinId),
    maxDepth: RUINS[ruinId].maxDepth,
    matchup: matchupAgainst(party, affinity),
    worstThreat: worstThreatFor(party, affinity),
    enemy,
    enemyPower: formationPower(enemy),
    enemyThreat: affinity,
    attack: effectiveAttack(party, affinity),
  };
}

/** What the party can see of the next depth. Only the Scout gets the type —
 *  it converts uncertainty from something you endure into something you can
 *  buy your way out of. */
export function nextDepthIntel(state: GameState, delve: Delve): {
  depth: number; threat: UnitId | 'Any' | null; strengthKnown: boolean;
} {
  const next = delve.depth + 1;
  // Any Ranger in the party reads the next room, not only the one leading it.
  const knows = delve.heroIds.some((id) => HEROES[id].trait === 'RevealNextDepth');
  return {
    depth: next,
    threat: knows ? rollThreat(state, delve.ruinId, next) : null,
    strengthKnown: true, // strength is authored and public; only the TYPE is hidden
  };
}

/** Ruins the player has actually found. */
export const discoveredRuins = (state: GameState, map: MapData): RuinId[] =>
  (Object.keys(RUINS) as RuinId[]).filter(
    (id) => fogState(state, map, RUINS[id].location) === 'Revealed',
  );

/** Relic art for a ruin's prize, for the launch screen. */
export const ruinPrize = (ruinId: RuinId): ArtifactId => ARTIFACTS[RUINS[ruinId].artifact].id;
