// Delves (Docs/features/expeditions.md §2, §5, §7).
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
  ARTIFACTS, DELVE, HEROES, PARTY, RUINS, UNITS,
} from './data/definitions';
import {
  addArtifactFragments, artifactEntry, artifactIsCarried, grantArtifact, isAttuned,
  ownsArtifact,
} from './artifacts';
import { addHeroXp } from './heroes';
import { recordResourceDiscovery } from './discovery';
import {
  depthDurationMs, guaranteedDepth, matchupAgainst, partyStats, resolveDepth,
  worstThreatFor, type CarriedArtifact, type Party, type PartySlot,
} from './combat';
import { availableRoster, maxArmyPower } from './army';
import { fogState } from './fog';
import type { MapData } from './grid';
import { resolve } from './modifiers';
import { pick } from './rng';
import { isTechComplete } from './research';
import {
  addToWallet, getWallet, newId,
  type ArtifactId, type Delve, type GameState, type HeroId, type RuinId,
  type UnitId, type Wallet,
} from './state';
import { canAfford, pay } from './wallet';

// ------------------------------------------------------------------- slots

/** How long a depth actually takes right now. Kept in ONE place so a
 *  Conjunction that speeds delves up cannot apply to the launch and not to the
 *  push, or to the timer and not to the estimate on the sheet. */
export const depthMs = (state: GameState, ruinId: RuinId, depth: number): number =>
  Math.max(1000, Math.round(resolve(state, 'delveSpeed', depthDurationMs(ruinId, depth))));

/** Two at the start (hero + one unit type), one from research, the rest with
 *  Gems — the same earned-breadth-first shape as attunement sockets. */
export function partySlots(state: GameState): number {
  const fromResearch = isTechComplete(state, 'Warband') ? 1 : 0;
  return Math.min(
    PARTY.baseSlots + fromResearch + state.heroes.partySlotsPurchased,
    PARTY.maxSlots,
  );
}

/** Slots hold the HERO plus unit types, so this is what is left for troops. */
export const unitSlots = (state: GameState): number => Math.max(0, partySlots(state) - 1);

export const partySlotGemCost = (state: GameState): number =>
  Math.round(PARTY.slotGemCostBase * PARTY.slotGemCostGrowth ** state.heroes.partySlotsPurchased);

export type BuyPartySlotResult = 'Purchased' | 'AtMax' | 'NotEnoughGems';

export function buyPartySlot(state: GameState): BuyPartySlotResult {
  if (partySlots(state) >= PARTY.maxSlots) return 'AtMax';
  const cost = partySlotGemCost(state);
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  state.heroes.partySlotsPurchased += 1;
  return 'Purchased';
}

// ---------------------------------------------------------------- supplies

/** Supplies are a FLAT cost at launch, not per depth, so the depth decision is
 *  purely risk against reward with nothing else muddying it. The
 *  Quartermaster's whole trait is a discount on this. */
export function supplyCost(ruinId: RuinId, heroId: HeroId | null): Wallet {
  const base = RUINS[ruinId].supplies;
  const discount = heroId !== null && HEROES[heroId].trait === 'SupplyDiscount'
    ? HEROES[heroId].traitValue : 0;
  const out: Wallet = {};
  for (const [c, n] of Object.entries(base)) {
    out[c as keyof Wallet] = Math.max(1, Math.round(n * (1 - discount)));
  }
  return out;
}

// ------------------------------------------------------------------- heroes

export const heroLevel = (state: GameState, id: HeroId): number => state.heroes.levels[id] ?? 1;

export const ownsHero = (state: GameState, id: HeroId): boolean => state.heroes.owned.includes(id);

/** A hero already underground cannot lead a second party. One hero means one
 *  delve at a time, which is what makes the second hero a genuine prize. */
export const heroIsBusy = (state: GameState, id: HeroId): boolean =>
  state.delves.some((d) => d.heroId === id && d.phase !== 'done');

/** What a delve's relic contributes, at the level it went down at. */
export const carriedOf = (delve: Delve): CarriedArtifact | null =>
  delve.artifactId === null ? null : { id: delve.artifactId, level: delve.artifactLevel };

export const freeHeroes = (state: GameState): HeroId[] =>
  state.heroes.owned.filter((id) => !heroIsBusy(state, id));

// ------------------------------------------------------------------ launch

export type LaunchBlock =
  | 'RuinNotFound' | 'NoHero' | 'HeroBusy' | 'EmptyParty' | 'TooManySlots'
  | 'NotEnoughUnits' | 'OverArmyCap' | 'NotEnoughSupplies'
  | 'ArtifactNotOwned' | 'ArtifactAttuned' | 'ArtifactCarried';

export function launchBlock(
  state: GameState,
  map: MapData,
  ruinId: RuinId,
  heroId: HeroId | null,
  slots: readonly PartySlot[],
  artifactId: ArtifactId | null = null,
): LaunchBlock | null {
  if (fogState(state, map, RUINS[ruinId].location) !== 'Revealed') return 'RuinNotFound';
  if (heroId === null || !ownsHero(state, heroId)) return 'NoHero';
  if (heroIsBusy(state, heroId)) return 'HeroBusy';
  const committed = slots.filter((s) => s.count > 0);
  if (committed.length === 0) return 'EmptyParty';
  if (committed.length > unitSlots(state)) return 'TooManySlots';
  const available = availableRoster(state);
  for (const s of committed) {
    if (s.count > available[s.unitId]) return 'NotEnoughUnits';
  }
  const power = committed.reduce((sum, s) => sum + UNITS[s.unitId].power * s.count, 0);
  if (power > maxArmyPower(state)) return 'OverArmyCap';
  if (!canAfford(state.city.wallet, supplyCost(ruinId, heroId))) return 'NotEnoughSupplies';
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
  heroId: HeroId,
  slots: readonly PartySlot[],
  now: number,
  standingOrder: number | null = null,
  artifactId: ArtifactId | null = null,
): LaunchResult {
  const block = launchBlock(state, map, ruinId, heroId, slots, artifactId);
  if (block !== null) return block;
  pay(state.city.wallet, supplyCost(ruinId, heroId));
  const committed = slots.filter((s) => s.count > 0).map((s) => ({ ...s }));
  const artifactLevel = artifactId === null ? 1 : artifactEntry(state, artifactId).level;
  const artifact = artifactId === null ? null : { id: artifactId, level: artifactLevel };
  const party: Party = { heroId, slots: committed, artifact };
  const hp = partyStats(party, heroLevel(state, heroId)).hp;
  state.delves.push({
    id: newId(state, 'delve'),
    ruinId,
    heroId,
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
function depthHaul(ruinId: RuinId, depth: number, heroId: HeroId): {
  wallet: Wallet; fragments: number;
} {
  const ruin = RUINS[ruinId];
  const hero = HEROES[heroId];
  const knowledgeBonus = hero.trait === 'KnowledgeBonus' ? 1 + hero.traitValue : 1;
  const fragmentBonus = hero.trait === 'FragmentBonus' ? 1 + hero.traitValue : 1;
  const wallet: Wallet = {
    Gold: Math.round(DELVE.goldPerDepthPerTier * ruin.tier * depth),
    Knowledge: Math.round(DELVE.knowledgePerDepthPerTier * ruin.tier * depth * knowledgeBonus),
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
      const party: Party = {
        heroId: delve.heroId, slots: delve.party, artifact: carriedOf(delve),
      };
      const level = heroLevel(state, delve.heroId);
      const outcome = resolveDepth(party, delve.ruinId, depth, delve.threat, level);
      const survived = outcome.cleared && delve.partyHp - outcome.damage > 0;

      if (!survived) {
        // A failed push costs HALF the haul and ends the run. Nothing you OWN
        // is taken — you declined a sure thing.
        for (const [c, n] of Object.entries(delve.haul)) {
          delve.haul[c as keyof Wallet] = Math.floor(n * (1 - DELVE.failHaulLoss));
        }
        delve.haulFragments = Math.floor(delve.haulFragments * (1 - DELVE.failHaulLoss));
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
      const paid = depthHaul(delve.ruinId, depth, delve.heroId);
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
          // And the lump that opens the levelling arc. A first clear is the
          // moment Knowledge starts existing for this player: it pays here,
          // and from here on the ruin drips (sim/mana.ts).
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
    if (c === 'Knowledge') {
      addToWallet(state.kingdom.wallet, 'Knowledge', n);
      recordResourceDiscovery(state, 'Knowledge');
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
  addHeroXp(state, delve.heroId, delve.depth * RUINS[delve.ruinId].tier);
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
}

export function previewExpedition(
  state: GameState,
  ruinId: RuinId,
  heroId: HeroId | null,
  slots: readonly PartySlot[],
  artifactId: ArtifactId | null = null,
): ExpeditionPreview {
  const committed = slots.filter((s) => s.count > 0);
  const artifact: CarriedArtifact | null = artifactId === null
    ? null
    : { id: artifactId, level: artifactEntry(state, artifactId).level };
  const party: Party = { heroId, slots: committed, artifact };
  const level = heroId === null ? 1 : heroLevel(state, heroId);
  const stats = partyStats(party, level);
  return {
    ruinId,
    supplies: supplyCost(ruinId, heroId),
    stats,
    safeDepth: guaranteedDepth(party, ruinId, level),
    maxDepth: RUINS[ruinId].maxDepth,
    matchup: matchupAgainst(party, RUINS[ruinId].affinity),
    worstThreat: worstThreatFor(party, RUINS[ruinId].affinity),
  };
}

/** What the party can see of the next depth. Only the Scout gets the type —
 *  it converts uncertainty from something you endure into something you can
 *  buy your way out of. */
export function nextDepthIntel(state: GameState, delve: Delve): {
  depth: number; threat: UnitId | 'Any' | null; strengthKnown: boolean;
} {
  const next = delve.depth + 1;
  const hero = HEROES[delve.heroId];
  const knows = hero.trait === 'RevealNextDepth';
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
