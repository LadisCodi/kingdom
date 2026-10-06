// The save file, its migration chain, and the offline catch-up.
//
// The insight that keeps migration small: every module read below is already
// defensive — `if (dto)` plus `?? default`. So an ADDITIVE change (a new
// module key, a new optional field) needs no migrator at all: bump
// SAVE_VERSION and let the reader default. Migrators exist only for renames,
// reshapes and semantic changes, and this design is shaped around that
// reality instead of around a general framework.
//
// Offline catch-up: the unified advance replays the whole absence. There is
// no offline cap; the buildings' stores, the pools and the queues bound it.

import {
  ABANDONED, ARTIFACT_ORDER, DISTRICTS, GAME_VERSION, HEROES, ITEMS, MISSIONS, SAVE_VERSION, TECHNOLOGIES, UNITS,
  ARTIFACTS, relicKind,
} from './data/definitions';
import { harvestSpecAt } from './harvest';
import { PAYER_PROFILES } from './store';
import { advance, settleFootprints, type AdvanceResult } from './commands';
import { withoutTallies } from './events';
import { buildMapData, footprintAt, footprintCells, type MapData } from './grid';
import { syncArtifactModifiers } from './artifacts';
import { syncHeroBoons } from './heroes';
import { reconcileSchedule } from './timeline';
import type { Modifier } from './modifiers';
import { newGame } from './newGame';
import { parseCrest } from './crest';
import { isStoreFull } from './storage';
import { freshWorld } from './world/explorers';
import { readBits } from './world/fogBits';
import { WORLD_DISTRICTS, WORLD_UPGRADES } from './world/types';
import { hexDistance, hexAt, isBoardIndex } from './world/hex';
import {
  cellsOfRect, coordKey, districtOccupies, parseCoordKey,
  type ArtifactId, type Coord, type District, type GameState, type ItemId, type QueueItem,
  type GoodId, type GoodsStock, type TechId, type Wallet, type Worker,
  type PayerProfile, type StoreSkuId,
  type LairId, type UnitId, type MissionKind, type MissionReward, type CurrencyId,
} from './state';

const iso = (ms: number): string => new Date(ms).toISOString();
const ms = (isoDate: string): number => Date.parse(isoDate);
const isoOrNull = (v: number | null): string | null => (v === null ? null : iso(v));
const msOrNull = (v: string | null | undefined): number | null =>
  v === null || v === undefined ? null : ms(v);

export interface SaveFile {
  SaveVersion?: number;
  LastSaved: string;
  GameVersion: string;
  Modules: Record<string, unknown>;
}

interface DistrictDto {
  UniqueID: string;
  DefinitionID: string;
  /** Which one of its kind it is, stamped when it was placed. */
  Ordinal?: number;
  VisualVariant: number;
  AssignedWorkers: number;
  Level: number;
  GridLocation: Coord;
  ConstructionState: string;
  /** What waits uncollected in its store. Additive since save 62. */
  Stored?: Wallet;
  /** A house's rent anchor. Additive since save 62: before it the city had
   *  one anchor, `LastTaxAt`, which every house starts from. */
  RentAnchorUtc?: string;
  /** The relic a Shrine holds. Additive since save 94. */
  Hosts?: string;
}

interface QueueItemDto {
  UniqueID: string;
  DistrictID: string;
  DurationSeconds: number;
  StartedAtUtc: string | null;
  TargetLevel?: number;
  CutMs?: number;
}

interface WorkerDto {
  ID: string;
  BuildingID: string;
  Activity: string;
  ClaimedCell: Coord | null;
  Carrying?: number;
  StrikeCarry?: number;
  CarriedSource?: string | null;
  StateStartedAt: string;
  StateUntil: string | null;
}

/** Below this, a save is from a game shape that no longer exists and is
 *  discarded rather than migrated. v15 and earlier predate the reshaped tech
 *  tree; v1 predates the harvest loop entirely. */
interface WorkshopDto {
  DistrictUniqueID: string;
  Anchor: string;
  Items?: Array<{ Good: string; WorkMs?: number; NeedMs?: number }>;
}

export const MIN_MIGRATABLE_VERSION = 16;

interface Migration {
  /** The version this migrator produces. */
  to: number;
  migrate: (modules: Record<string, any>) => void;
}

/**
 * The levelled UPGRADE lines a save at version 23 could contain, and how many
 * ranks each had when v24 turned them into technologies.
 *
 * **Frozen on purpose.** It describes a save written in the past, not the tree
 * of today: it used to read the live `TECH_LINES`, so cutting a ladder in
 * `?dev=tree` silently changed what an old save restored, and deleting the
 * `line` field would have deleted the migrator's only map. A migrator is
 * history — the shape of the world it reads stopped moving the day it shipped.
 *
 * No `SAVE_VERSION` bump: the saved shape (`Completed: string[]`) is unchanged.
 */
const LEGACY_UPGRADE_LINES: Record<string, number> = {
  Barding: 3, Bearers: 3, BigNets: 3, Butchery: 3, Carpentry: 3, Cartage: 3,
  Colours: 5, DeepWells: 5, Drillmaster: 3, Farsight: 3, Fletching: 3,
  IronPicks: 3, Irrigation: 3, LeyTaps: 3, Manoeuvre: 3, MarketStall: 4,
  MusterDrill: 3, Pathfinders: 3, Pilgrimage: 3, Pitons: 2, Prospecting: 3,
  QuickHands: 5, Rations: 3, Resonance: 2, Sawpits: 3, Scriptorium: 3,
  Scriveners: 3, Scythes: 3, ShieldWall: 3, Stonecutting: 3, Surveying: 2,
  TapPower: 5, TradeRoutes: 5, Vigils: 3, Warhorns: 3, Wayposts: 3,
  WorkerLoad: 3,
};

/** Rank ids are the stem plus a roman numeral, and five is the longest ladder
 *  any of the lines above ever had. */
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** Ordered, gap-free, append-only. A version bump with no reshape needs NO
 *  entry here — the defensive readers below already default the new field. */
const MIGRATIONS: readonly Migration[] = [
  {
    // v44 — THE COLLECTION REWORK (Docs/features/09-relics.md). Attunement,
    // the Stardust level ladder and the Fragments tier gate are gone; a relic
    // is one level, raised by finishing its album.
    //
    // EVERY RELIC A PLAYER HOLDS KEEPS ITS LEVEL — nothing they earned
    // converts to less — and the sockets, the tiers and the per-relic
    // Fragments are dropped, because there is no longer anything that reads
    // them. A relic that was owned at level 1 with nothing spent on it still
    // reads as level 1, so the common case is identical.
    //
    // The Gems spent on sockets are NOT refunded and deliberately so: the
    // slots bought a benefit the player had for as long as the feature
    // existed, and the rework hands them the same passives permanently.
    to: 44,
    migrate: (modules) => {
      const dto = modules['kingdom.artifacts'] as {
        Owned?: string[]; Levels?: Record<string, number>;
        Tiers?: unknown; Fragments?: unknown;
        Attuned?: unknown; SlotsPurchased?: unknown; LockedUntil?: unknown;
      } | undefined;
      if (dto === undefined) return;
      const levels: Record<string, number> = {};
      for (const id of dto.Owned ?? []) levels[id] = Math.max(1, dto.Levels?.[id] ?? 1);
      // A level without an ownership row was never reachable, but a save that
      // has one is telling the truth about a relic the player holds.
      for (const [id, level] of Object.entries(dto.Levels ?? {})) {
        if (levels[id] === undefined && level >= 1) levels[id] = level;
      }
      modules['kingdom.artifacts'] = { Levels: levels };
    },
  },
  {
    // v43 — a building carries the ORDINAL it was placed with, and that
    // ordinal prices every level of it for ever
    // (Docs/features/05-city-and-districts.md §3.1). An additive field would
    // normally need no migrator, but the default is not innocent: leaving it
    // blank would make every building in an old city the cheap #1.
    //
    // The saved list is placement order — nothing is ever removed from it —
    // so numbering each kind in the order it appears reconstructs exactly
    // what the player built.
    to: 43,
    migrate: (modules) => {
      const city = (modules['kingdom.cities'] as
        { Cities?: { Districts?: { DefinitionID?: string; Ordinal?: number }[] }[] }
        | undefined)?.Cities?.[0];
      const districts = city?.Districts;
      if (districts === undefined) return;
      const seen = new Map<string, number>();
      for (const d of districts) {
        const kind = String(d.DefinitionID ?? '');
        const n = (seen.get(kind) ?? 0) + 1;
        seen.set(kind, n);
        d.Ordinal = n;
      }
    },
  },
  {
    // v33 — Hero XP stopped being a tally beside each hero and became a
    // KINGDOM WALLET ROW that buys any hero's levels
    // (Docs/features/10-heroes.md §4). It was written and never read until
    // now, so nothing was ever spent from it and every point a save holds is
    // still owed: the whole per-hero map folds into the one counter.
    //
    // Listed FIRST so the array stays ordered by nothing in particular but
    // remains append-only in effect — `migrate` runs every entry whose `to`
    // is above the save's version, in array order, and this one touches keys
    // no other migrator does.
    to: 33,
    migrate: (modules) => {
      const heroes = modules['kingdom.heroes'] as
        { Xp?: Record<string, number> } | undefined;
      const xp = heroes?.Xp;
      if (xp === undefined) return;
      const total = Object.values(xp).reduce((n, v) => n + (typeof v === 'number' ? v : 0), 0);
      delete heroes!.Xp;
      if (total <= 0) return;
      const kingdom = modules['kingdom.kingdoms'] as
        { Currencies?: Record<string, number> } | undefined;
      if (kingdom === undefined) return;
      kingdom.Currencies = { ...(kingdom.Currencies ?? {}) };
      kingdom.Currencies.HeroXp = (kingdom.Currencies.HeroXp ?? 0) + total;
    },
  },
  {
    // v21 — Berries, Meat, Fish and Iron stopped being wallet rows. Bushes,
    // game and shoals pay Food now and veins pay Stone, so a save's balances
    // convert at the rates they were EARNED at: the old `countsAs` values
    // (1, 3, 1) and Iron's Gold-value ratio against Stone (6/2 = 3).
    //
    // Not the new tap yields — a player who banked 10 Fish banked 10 Food's
    // worth of buying power, whatever a shoal pays per tap today.
    to: 21,
    migrate: (modules) => {
      const city = (modules['kingdom.cities'] as { Cities?: Array<Record<string, any>> })
        ?.Cities?.[0];
      const w = city?.Currencies as Record<string, number> | undefined;
      if (w === undefined) return;
      const fold = (dead: string, base: string, rate: number): void => {
        const held = w[dead];
        if (typeof held === 'number' && held !== 0) w[base] = (w[base] ?? 0) + held * rate;
        delete w[dead];
      };
      fold('Berries', 'Food', 1);
      fold('Meat', 'Food', 3);
      fold('Fish', 'Food', 1);
      fold('Iron', 'Stone', 3);
    },
  },
  {
    // v23 — Knowledge and Stardust swapped jobs
    // (Docs/features/07-research.md §4). Knowledge became the
    // research clock; the collection currency it used to be is now Stardust.
    // Both stay kingdom-scoped: each outlives the city that earned it.
    //
    // Every Knowledge a live save holds was earned as COLLECTION currency —
    // out of a delve haul, a first clear, a pull or a quest — so it must keep
    // buying what it was earned for. The same rule the currency-simplification
    // migrator followed: balances convert at the rates they were earned.
    //
    // A bare key rename would have been the bug: it hands the whole research
    // tree to anyone holding a collection balance. Knowledge is deliberately
    // NOT re-seeded after the move — a returning player starts the research
    // clock at zero and earns it back from the ground they hold.
    to: 23,
    migrate: (modules) => {
      const w = (modules['kingdom.kingdoms'] as { Currencies?: Record<string, number> })
        ?.Currencies;
      if (w === undefined) return;
      const held = w['Knowledge'];
      if (typeof held === 'number' && held !== 0) {
        w['Stardust'] = (w['Stardust'] ?? 0) + held;
      }
      delete w['Knowledge'];
    },
  },
  {
    // v24 — upgrades stopped being a separate kind of thing. Every level of
    // a levelled upgrade is now its own TECHNOLOGY in a rank ladder
    // (Docs/features/tech-tree.md §1 rule 2, §8).
    //
    // `Upgrades: { TapPower: 3 }` becomes three completed techs,
    // `TapPowerI/II/III`. Ranks complete in order, so level N maps to the
    // first N ids of the ladder and the tree reads back exactly what the
    // player had bought. A player mid-flight keeps every level they paid
    // for, and pays no research time for them a second time.
    to: 24,
    migrate: (modules) => {
      const research = modules['kingdom.research'] as
        { Completed?: string[]; UpgradeLevels?: Record<string, number> } | undefined;
      if (research === undefined) return;
      const levels = research.UpgradeLevels;
      if (levels !== undefined) {
        const completed = research.Completed ?? (research.Completed = []);
        for (const [line, level] of Object.entries(levels)) {
          const ranks = LEGACY_UPGRADE_LINES[line];
          if (ranks === undefined) continue; // a line that save's build had and this one does not
          for (let i = 0; i < Math.min(level, ranks); i++) {
            const id = `${line}${ROMAN[i]}`;
            // Filtered against TODAY's tree, because a technology may have
            // been renamed or cut in `?dev=tree` since. An id nothing has is
            // dropped rather than carried: `load` filters it anyway, and a
            // migrator that writes junk makes every later one harder to read.
            if (TECHNOLOGIES[id as TechId] !== undefined && !completed.includes(id)) {
              completed.push(id);
            }
          }
        }
        delete research.UpgradeLevels;
      }
    },
  },
  {
    // v25 — tomes had COVER PAGES, granted by events in the world rather than
    // researched, and a save written before they existed had none.
    //
    // A NO-OP now, and kept because `MIGRATIONS` is append-only and gapless.
    // Tome openness stopped being a technology: every book is simply open, so
    // there is nothing to grant and nothing that can be shut. The ids this
    // used to write no longer exist, and `load` filters ids the build does not
    // have — so leaving the body in would put dead names in a save for one
    // read and then drop them.
    to: 25,
    migrate: () => {},
  },
  {
    // v26 — the Mine is gone as a building. The Quarry works every mountain
    // now, bare rock and metal alike, so a Mine that a player already paid
    // for BECOMES a Quarry rather than vanishing: the two had the same
    // footprint, the same crew and the same radius, and the first promise is
    // that nothing you own is taken from you.
    //
    // It can push a city one Quarry over its Townhall count cap. That is
    // deliberate — the cap gates BUILDING one, and taking a standing building
    // away to enforce it retroactively would be the very thing the promise
    // forbids.
    //
    // Numbered AFTER the tome migrators (v23–v25) because those shipped on
    // develop first; a save written by the harvest branch at its own v23/v24
    // therefore skips the Knowledge→Stardust and UpgradeLevels conversions.
    // Those saves only ever existed on a developer machine.
    to: 26,
    migrate: (modules) => {
      const city = (modules['kingdom.cities'] as { Cities?: Array<Record<string, any>> })
        ?.Cities?.[0];
      const districts = city?.Districts as Array<Record<string, any>> | undefined;
      if (districts === undefined) return;
      for (const d of districts) {
        if (d.DefinitionID === 'Mine') d.DefinitionID = 'Quarry';
      }
    },
  },
  {
    // v27 — a resource cell stopped counting TAPS and started holding UNITS
    // (`Docs/features/04-harvest.md` §2). The old counter cannot be converted
    // honestly: one old tap was one unit on a forest and three on a herd, and
    // what a tap PAID scaled with the whole city's payroll, so the wear a save
    // recorded does not mean the same thing twice.
    //
    // So the wear is forgiven: dropping the module makes the reader default
    // every cell to a full depot with no exhaustion. It is worth a few seconds
    // of production, it can only ever hand the player MORE than they had, and
    // it is the only reading that cannot be wrong in the direction the first
    // promise forbids.
    //
    // A house's `LastTapAt` goes the same way — written, persisted and never
    // read — and its replacement `PulledUntil` defaults to a full advance
    // budget, which is also the generous direction.
    to: 27,
    migrate: (modules) => {
      delete modules['kingdom.cellHarvest'];
    },
  },
  {
    // v35 — the daily chest became a SEASON (Docs/features/12-quests.md §3).
    // `LadderStep` counted days played on a seven-rung cycle that never ended;
    // `Rung` counts them inside a twenty-day window, so the two numbers do not
    // mean the same thing and the old one cannot be converted honestly — a
    // step-11 save is on rung 4 of a cycle that no longer exists.
    //
    // So the block is dropped and the reader defaults it: the player lands in
    // whatever season is running, at rung 0, owing nothing. That costs at most
    // one season's progress on a ladder that was never a possession, and it is
    // the only reading that cannot pay out a rung twice.
    to: 35,
    migrate: (modules) => {
      const kingdom = modules['kingdom.kingdoms'] as { Daily?: unknown } | undefined;
      if (kingdom !== undefined) delete kingdom.Daily;
    },
  },
  {
    // v36 — a half-cleared cell stopped counting the GOLD paid into it and
    // started counting TAPS, because a cell is five taps at every ring now
    // (Docs/features/01-map-and-fog.md §5). The two numbers cannot be
    // converted: 300 meant "300 Gold down" on a cell whose price the save does
    // not carry, and read as taps it would be a cell already cleared five
    // times over — the fifth tap would open it for nothing.
    //
    // So the part-paid cells are dropped and the reader defaults them to
    // untouched. It costs at most four taps of Gold on each cell the player
    // happened to leave half-open, and it is the only reading that cannot hand
    // out ground nobody paid for.
    to: 36,
    migrate: (modules) => {
      const fog = modules['kingdom.fogOfWar'] as { Progress?: unknown } | undefined;
      if (fog !== undefined) delete fog.Progress;
    },
  },
  {
    // v40 — `kingdom.delves` became `kingdom.ruins`. A delve was a party in
    // flight down a ruin on a timer; a ruin is now a ladder of rooms, each one
    // a fight resolved the instant it is entered
    // (Docs/features/11-expeditions.md §5). A party mid-descent has nothing to
    // become, so the flight is dropped — and the two facts that OUTLIVED the
    // run come across: which ruins were taken to the bottom, and how deep the
    // player has ever been.
    //
    // The room ladder itself is new content, so a ruin whose bottom was
    // reached under the old model re-opens at Depth 1 Room 1. `Cleared` is
    // what guards the once-only payout — the relic and the first-clear lump
    // are already banked and cannot be won twice.
    to: 40,
    migrate: (modules) => {
      const delves = modules['kingdom.delves'] as
        { Cleared?: string[]; DeepestDepth?: number } | undefined;
      if (delves === undefined) return;
      modules['kingdom.ruins'] = {
        Progress: [],
        Cleared: delves.Cleared ?? [],
        DeepestDepth: delves.DeepestDepth ?? 0,
      };
      delete modules['kingdom.delves'];
    },
  },
  {
    // v42 — the Market left the game: the building, its technology and the
    // three quests that named it. A save can be holding a built Market, a
    // Market in the build queue, and a research or quest pointed at a card
    // that no longer exists — and every one of those would be read as a
    // district id the tables have no row for.
    //
    // So they are dropped rather than converted: there is nothing to convert
    // them INTO. The plot the Market stood on is simply free again, which is
    // the honest outcome of a building being retired, and the quest chain is
    // shorter by three beats — `activeQuest` reads the index against the
    // CURRENT chain, so a player past the Market beats lands on the same beat
    // by name, and one standing on them lands on the beat that replaced them.
    to: 42,
    migrate: (modules) => {
      const city = (modules['kingdom.cities'] as { Cities?: any[] } | undefined)?.Cities?.[0];
      if (city !== undefined) {
        const markets = new Set<string>();
        city.Districts = (city.Districts ?? []).filter((d: any) => {
          if (d.DefinitionID !== 'Market') return true;
          markets.add(d.UniqueID);
          return false;
        });
        // A queue item points at a DISTRICT, and `QueueKinds` is a PARALLEL
        // array — so a build or an upgrade of a Market goes with it, and both
        // sides are filtered together or every later item changes kind.
        const kinds: string[] = city.QueueKinds ?? [];
        const keep: boolean[] = (city.QueueItems ?? [])
          .map((q: any) => !markets.has(q.DistrictID));
        city.QueueItems = (city.QueueItems ?? []).filter((_: unknown, i: number) => keep[i]);
        if (kinds.length > 0) city.QueueKinds = kinds.filter((_, i) => keep[i]);
        // A worker cannot be assigned to a Market, so nothing else in the
        // city points at one.
      }
      const research = modules['kingdom.research'] as
        { Completed?: string[]; Active?: any[] } | undefined;
      if (research !== undefined) {
        const dead = new Set(['Market', 'Guildhalls', 'MarketStallI', 'MarketStallII',
          'MarketStallIII', 'MarketStallIV']);
        research.Completed = (research.Completed ?? []).filter((id) => !dead.has(id));
        research.Active = (research.Active ?? []).filter((a: any) => !dead.has(a?.ID));
      }
    },
  },
  {
    // v50 — A CARD IS SPENT WHEN THE ALBUM CLOSES. `Cards` used to be every
    // copy ever pulled and `Completed` the pages a season had already paid;
    // now the eight reset each lap and a closed album keeps only its
    // DUPLICATES. An old save carries both a full page and its entry in
    // `Completed`, so the first card added after the load would roll the lap
    // and re-complete all eight for nothing.
    //
    // The nine are spent here, once per completed album, exactly as the close
    // would have spent them.
    to: 50,
    migrate: (modules) => {
      const dto = modules['kingdom.collection'] as
        { Cards?: Record<string, number[]>; Completed?: string[] } | undefined;
      const cards = dto?.Cards;
      if (cards === undefined) return;
      for (const album of dto!.Completed ?? []) {
        const row = cards[album];
        if (row !== undefined) cards[album] = row.map((n) => Math.max(0, n - 1));
      }
    },
  },
  {
    // v60 — A FEATURE THAT SPANS CELLS IS REVEALED AS ONE THING
    // (Docs/features/01-map-and-fog.md §3.1). A mountain's cells are grouped
    // into blocks now, and a block is all revealed or none of it.
    //
    // An old save knows nothing of blocks, so it can hold a mountain with two
    // cells cleared and two still under the fog — a state the new rules have
    // no way to draw and no way to finish paying for. Every block with any
    // cell revealed is completed here, which is the generous reading and
    // costs the player nothing they had already bought.
    //
    // Taps in progress move to the block's anchor, where they are counted
    // now. A block part-paid on two different cells keeps the further along
    // of the two rather than their sum: the taps were never additive.
    to: 60,
    migrate: (modules) => {
      const dto = modules['kingdom.fogOfWar'] as {
        Revealed?: Array<{ x: number; y: number }>;
        Discovered?: Array<{ x: number; y: number }>;
        Progress?: Array<{ Coord: { x: number; y: number }; Taps: number }>;
      } | undefined;
      if (dto === undefined) return;
      const map = buildMapData();
      if (map.footprintOf.size === 0) return;

      const revealed = new Set((dto.Revealed ?? []).map(coordKey));
      let grew = false;
      for (const [cellKey, anchorKey] of map.footprintOf) {
        if (!revealed.has(cellKey)) continue;
        for (const c of footprintCells(map, parseCoordKey(anchorKey))) {
          if (!revealed.has(coordKey(c))) { revealed.add(coordKey(c)); grew = true; }
        }
      }
      if (grew) dto.Revealed = [...revealed].map(parseCoordKey);
      dto.Discovered = (dto.Discovered ?? []).filter((c) => !revealed.has(coordKey(c)));

      const taps = new Map<string, number>();
      for (const row of dto.Progress ?? []) {
        const key = coordKey(footprintAt(map, row.Coord).anchor);
        if (revealed.has(key)) continue; // already cleared by the sweep above
        taps.set(key, Math.max(taps.get(key) ?? 0, row.Taps));
      }
      dto.Progress = [...taps].map(([k, Taps]) => ({ Coord: parseCoordKey(k), Taps }));
    },
  },
  {
    // v61: research takes no time and has no slots
    // (Docs/features/07-research.md §1). A research running when the save was
    // written had already been paid for, Gold and Knowledge, so it is
    // COMPLETED here — the player owned it the moment the clock would have
    // run out. The slots bought with Gems go back as Gems: 2,500, then ×2 a
    // slot, the ladder they were sold on.
    to: 61,
    migrate: (modules) => {
      const dto = modules['kingdom.research'] as {
        Completed?: string[];
        Active?: Array<{ ID: string }>;
        SlotsPurchased?: number;
        Poured?: Record<string, number>;
      } | undefined;
      if (dto === undefined) return;
      const completed = new Set(dto.Completed ?? []);
      for (const a of dto.Active ?? []) completed.add(a.ID);
      dto.Completed = [...completed];
      const slots = dto.SlotsPurchased ?? 0;
      if (slots > 0) {
        let refund = 0;
        for (let i = 0; i < slots; i++) refund += 2500 * 2 ** i;
        const player = modules['player.currencies'] as Record<string, number> | undefined;
        if (player !== undefined) player.Gems = (player.Gems ?? 0) + refund;
      }
      delete dto.Active;
      delete dto.SlotsPurchased;
      dto.Poured = dto.Poured ?? {};
    },
  },
  {
    // v63: the depths behind the gate are retired — a ruin is its gate
    // (Docs/proposals/lairs.md §7). The rooms cleared, the ruins bottomed and
    // the deepest depth have nothing left to mean, so the module goes.
    //
    // NO RETRO-PAY. The first-clear Knowledge lump moved from a ruin's bottom
    // room to its gate. A save that bottomed a ruin was paid it then; a save
    // whose gate fell but whose ruin was never bottomed never got it, and does
    // not get it here — a one-off lump on load, for a fight already won, is
    // not worth the second code path.
    //
    // The season pass's live missions of the two retired kinds (`ClearRooms`,
    // `CompleteDepths`) go too: their odometers can never move again, so they
    // would sit on the board unfinishable until their window rolled over.
    to: 63,
    migrate: (modules) => {
      delete modules['kingdom.ruins'];
      const kingdom = modules['kingdom.kingdoms'] as {
        Pass?: { Live?: Array<{ Kind?: string }> };
      } | undefined;
      const pass = kingdom?.Pass;
      if (pass?.Live !== undefined) {
        pass.Live = pass.Live.filter((m) => m.Kind !== 'ClearRooms' && m.Kind !== 'CompleteDepths');
      }
    },
  },
  {
    // v64: ruins and gates are LAIRS (Docs/proposals/lairs.md). A rename, not
    // a reshape: `kingdom.gates` becomes `kingdom.lairs`, its `Gates` list
    // becomes `Lairs`, every `RuinID` becomes `LairID`, and every persisted
    // place id becomes its creature's — the lairs' own state, the raid
    // reports, and the `site:<id>` keys of the discoveries already announced,
    // so a lair the player has seen is not announced twice.
    to: 64,
    migrate: (modules) => {
      const renamed = (id: unknown): unknown =>
        typeof id === 'string' ? (LAIR_RENAMES[id] ?? id) : id;
      const gates = modules['kingdom.gates'] as {
        Gates?: Array<Record<string, unknown>>;
        Reports?: Array<Record<string, unknown>>;
      } | undefined;
      if (gates !== undefined) {
        const rekey = (row: Record<string, unknown>): Record<string, unknown> => {
          const { RuinID, ...rest } = row;
          return { ...rest, LairID: renamed(RuinID) };
        };
        const { Gates, Reports, ...rest } = gates;
        modules['kingdom.lairs'] = {
          ...rest,
          Lairs: (Gates ?? []).map(rekey),
          Reports: (Reports ?? []).map(rekey),
        };
        delete modules['kingdom.gates'];
      }
      const discoveries = modules['kingdom.discoveries'] as { Keys?: string[] } | undefined;
      if (discoveries?.Keys !== undefined) {
        discoveries.Keys = discoveries.Keys.map((k) =>
          k.startsWith('site:') ? `site:${renamed(k.slice(5)) as string}` : k);
      }
    },
  },
  {
    // v69: THE TREE IN FIVE BOOKS (Docs/features/22-progression.md §9). A few
    // cards were renamed or split, and a researched one keeps what it
    // bought: `Engineering` becomes the four cards it split into, a renamed
    // rank becomes its successor. Cards with no successor (the discounts,
    // the inert delve ladders) fall to the loader's filter as before.
    // Poured Knowledge follows its card where it has one.
    to: 69,
    migrate: (modules) => {
      const research = modules['kingdom.research'] as
        { Completed?: string[]; Poured?: Record<string, number> } | undefined;
      if (research === undefined) return;
      const next = (id: string): string[] => TECH_RENAMES_V69[id] ?? [id];
      research.Completed = [...new Set((research.Completed ?? []).flatMap(next))];
      const poured: Record<string, number> = {};
      for (const [id, n] of Object.entries(research.Poured ?? {})) {
        const to = next(id)[0];
        poured[to] = (poured[to] ?? 0) + n;
      }
      research.Poured = poured;
    },
  },
  {
    // v70: STONE IS TAUGHT (Docs/features/22-progression.md §4). Tapping a
    // mountain waits on `Pickaxes`, and two quests — research it, gather 20
    // Stone — sit in front of `Mustered`, the first thing that costs Stone.
    // A kingdom already past that point, or one that never had the
    // tutorial, keeps tapping stone: it is handed the card. A chain position
    // at or past the new quests moves on by the two of them.
    to: 70,
    migrate: (modules) => {
      const quests = modules['kingdom.quests'] as { Index?: number } | undefined;
      const tutorial = modules['kingdom.tutorial'] as { Veteran?: boolean } | undefined;
      const index = quests?.Index ?? 0;
      const past = index >= PICKS_AT_V70;
      if (quests !== undefined && past) quests.Index = index + 2;
      if (past || tutorial === undefined || tutorial.Veteran === true) {
        const research = (modules['kingdom.research'] ??= { Completed: [] }) as { Completed?: string[] };
        research.Completed = [...new Set([...(research.Completed ?? []), 'Pickaxes'])];
      }
    },
  },
  {
    // v72: STONE IS TAUGHT WHERE IT IS FIRST WANTED. `Picks` and `Rubble`
    // move from in front of the Barracks (now built of Wood) to in front of
    // `SecondStory`, the first upgrade that costs Stone. The quests between
    // close up by the two; a kingdom on one of the two moved quests goes on
    // to the one that followed them, and meets them again later.
    to: 72,
    migrate: (modules) => {
      const quests = modules['kingdom.quests'] as { Index?: number } | undefined;
      if (quests === undefined) return;
      const index = quests.Index ?? 0;
      const to = index >= PICKS_FROM_V71 + 2 && index < SECOND_STORY_AT_V71 ? index - 2
        : index >= PICKS_FROM_V71 && index < PICKS_FROM_V71 + 2 ? PICKS_FROM_V71 : index;
      // A counter belongs to the quest it was counting for.
      if (to !== index) Object.assign(quests, { Index: to, Progress: 0 });
    },
  },
  {
    // v73: A LAIR IS FOUND BEFORE THE ARMY IS ASKED FOR. `WarDrums` (find a
    // lair) enters the chain in front of `ArmedMen`, because the Book of
    // Warfare opens on nothing else. A kingdom past it moves on by one; one
    // ON `ArmedMen` stays at its index, which is now `WarDrums` — done on
    // arrival if it has found a lair, and the missing step if it has not.
    to: 73,
    migrate: (modules) => {
      const quests = modules['kingdom.quests'] as { Index?: number } | undefined;
      if (quests === undefined) return;
      const index = quests.Index ?? 0;
      if (index > WAR_DRUMS_AT_V73) Object.assign(quests, { Index: index + 1 });
      else if (index === WAR_DRUMS_AT_V73) Object.assign(quests, { Progress: 0 });
    },
  },
  {
    // v74: THE BOOK OF WARFARE IS HANDED OVER. It opens on Isolde giving it
    // (`gift:Warfare`), no longer on a lair found. A kingdom that has found
    // one was already reading it, so it is recorded as given.
    to: 74,
    migrate: (modules) => {
      const lairs = modules['kingdom.lairs'] as { Lairs?: unknown[] } | undefined;
      const tutorial = modules['kingdom.tutorial'] as { Seen?: string[] } | undefined;
      if (tutorial === undefined || (lairs?.Lairs ?? []).length === 0) return;
      tutorial.Seen = [...new Set([...(tutorial.Seen ?? []), 'gift:Warfare'])];
    },
  },
  {
    // v79: THE DAILY CHEST IS CUT (Docs/implementation-plan.md Step 13). Its
    // `Daily` block goes; rungs a player had not claimed are not paid out.
    // The purchase log keeps any `RoyalChest` it holds — it is a record.
    to: 79,
    migrate: (modules) => {
      const kingdom = modules['kingdom.kingdoms'] as { Daily?: unknown } | undefined;
      if (kingdom !== undefined) delete kingdom.Daily;
    },
  },
  {
    // v85: THE WORLD BOARD IS RADIUS 6 (Docs/plans/world-districts.md §1), so
    // a hex's index means another hex. What the save keeps by index goes —
    // the fog, explorers out, builders out, the Sanctuaries counted — and the
    // troops lent to an army come home to the city, because the board they
    // marched on is gone. The board's id and seed stay: it is the same
    // board, made again at its new size.
    to: 85,
    migrate: (modules) => {
      const world = modules['kingdom.world'] as Record<string, unknown> | undefined;
      if (world === undefined) return;
      const armies = Array.isArray(world.Armies) ? world.Armies as Array<{ Troops?: Array<{ unitId?: string; count?: number }> }> : [];
      const army = (modules['kingdom.army'] ??= { Units: [] }) as { Units: Array<{ UniqueID: string; DefinitionID: string }> };
      army.Units ??= [];
      let next = typeof modules['meta.nextId'] === 'number' ? modules['meta.nextId'] as number : 1;
      for (const a of armies) {
        for (const t of a.Troops ?? []) {
          if (typeof t.unitId !== 'string' || !Number.isInteger(t.count)) continue;
          for (let i = 0; i < (t.count as number); i++) army.Units.push({ UniqueID: `unit_${next++}`, DefinitionID: t.unitId });
        }
      }
      modules['meta.nextId'] = next;
      world.Revealed = [];
      world.Explorers = [];
      world.Builds = [];
      world.Sanctuaries = 0;
      world.Armies = [];
    },
  },
  {
    // v91: THE KEYS ARE BAG ITEMS (Docs/plans/relics-and-bag.md, step 4).
    // What the player's purse held of each moves to the Bag, as the same
    // count; neither is new, so neither sparkles.
    to: 91,
    migrate: (modules) => {
      const purse = modules['player.currencies'] as Record<string, number> | undefined;
      if (purse === undefined) return;
      const bag = (modules['kingdom.bag'] ??= { Held: {}, Fresh: [], Badge: 0 }) as { Held?: Record<string, number> };
      bag.Held ??= {};
      for (const key of ['SilverKey', 'GoldKey']) {
        const n = purse[key];
        delete purse[key];
        if (Number.isInteger(n) && n > 0) bag.Held[key] = (bag.Held[key] ?? 0) + n;
      }
    },
  },
  {
    // v92: RELICS ARE FOUND, NOT COLLECTED (Docs/plans/relics-and-bag.md,
    // step 5). The card season goes. Each album's cards become fragments of
    // the relic that album was levelling this season — its first five cards
    // the five pieces, its last the keystone, the three between more pieces
    // — and every unopened pack and wildcard becomes pieces, dealt in turn
    // to the relics the save has met. Relic levels stay where they were:
    // restored, at the same level. Stars go, as at a season's close.
    // A pass mission that opened packs now uses items, and one that paid a
    // pack pays its fragments.
    to: 92,
    migrate: (modules) => {
      const per: Record<string, number> = { Green: 1, Yellow: 1, Rose: 2, Blue: 2, Purple: 3, Golden: 4 };
      const albums = ['FirstFurrow', 'TheWildWood', 'HandsAtWork', 'MarketDay',
        'TheKingsCoin', 'UnderTheHill', 'TheLongMarch', 'TheStarRoad'];
      const relics = ARTIFACT_ORDER as readonly string[];
      const held: Record<string, { Found: number[]; Bound: number[] }> = {};
      const slots = (id: string) => (held[id] ??= { Found: [0, 0, 0, 0, 0, 0], Bound: [0, 0, 0, 0, 0, 0] });
      const col = modules['kingdom.collection'] as {
        Season?: number; Cards?: Record<string, number[]>; Packs?: Array<{ Tier?: string }>;
        Wildcards?: Record<string, number>;
      } | undefined;
      const season = col?.Season ?? 0;
      for (const [album, cards] of Object.entries(col?.Cards ?? {})) {
        const at = albums.indexOf(album);
        if (at < 0 || !Array.isArray(cards)) continue;
        const relic = relics[(((at + season) % albums.length) + albums.length) % albums.length] ?? relics[0];
        cards.forEach((n, i) => {
          if (!Number.isInteger(n) || n <= 0) return;
          const slot = i < 5 ? i : i === cards.length - 1 ? 5 : (i - 5) % 5;
          slots(relic).Found[slot] += n;
        });
      }
      const levels = ((modules['kingdom.artifacts'] as { Levels?: Record<string, number> } | undefined)?.Levels) ?? {};
      const met = relics.filter((id) => (levels[id] ?? 0) > 0 || (held[id]?.Found.some((n) => n > 0) ?? false));
      let spare = 0;
      for (const p of col?.Packs ?? []) spare += per[p.Tier ?? ''] ?? 1;
      for (const n of Object.values(col?.Wildcards ?? {})) spare += Number.isInteger(n) && n > 0 ? n : 0;
      for (let i = 0; i < spare && met.length > 0; i++) slots(met[i % met.length]).Found[Math.floor(i / met.length) % 5] += 1;
      delete modules['kingdom.collection'];
      if (Object.keys(held).length > 0) modules['kingdom.relics'] = { Held: held, Chests: 0 };
      const pass = (modules['kingdom.kingdoms'] as { Pass?: { Live?: Array<Record<string, unknown>> } } | undefined)?.Pass;
      for (const m of pass?.Live ?? []) {
        if (m.Kind === 'OpenPacks') {
          m.Kind = 'UseItems';
          m.Meter = 'items';
          m.Base = 0;
        }
        const reward = m.Reward as { kind?: string; tier?: string } | undefined;
        if (reward?.kind === 'Pack') m.Reward = { kind: 'Fragments', n: per[reward.tier ?? ''] ?? 1 };
      }
    },
  },
  {
    // v93: THE SHRINES ARE FOUND IN RUINS (Docs/plans/relics-and-bag.md,
    // step 6). The four Shrine landmarks leave the map: one is the Thorned
    // Shrine's ruin now, the others are gone, and a claim on any of them goes
    // with them. A Shrine standing adds the +10 max Mana a claim did.
    to: 93,
    migrate: (modules) => {
      const lm = modules['kingdom.landmarks'] as { Claimed?: string[] } | undefined;
      if (lm?.Claimed === undefined) return;
      const gone = ['ThornedShrine', 'OldOakShrine', 'CliffShrine', 'WindwardShrine'];
      lm.Claimed = lm.Claimed.filter((id) => !gone.includes(id));
    },
  },
];

/** Where `WarDrums` entered the chain in v73, frozen as history. */
const WAR_DRUMS_AT_V73 = 26;

/** Where `Picks` entered the chain in v70, frozen as history. */
const PICKS_AT_V70 = 27;

/** Where v72 took `Picks` and `Rubble` from, and the first quest it put them
 *  in front of (`SecondStory`), as v71 numbered the chain. */
const PICKS_FROM_V71 = 27;
const SECOND_STORY_AT_V71 = 40;

/** The technologies the v69 tree renamed or split, frozen as history. */
const TECH_RENAMES_V69: Record<string, string[]> = {
  Taxes01: ['TradeRoutesI'],
  Reforesting01: ['ReforestingI'],
  Sickles01: ['CropRotationI'],
  Engineering: ['Joinery', 'StoneDressing', 'TimberFraming', 'QuarryHoists'],
  VigilsI: ['BountiesI'], VigilsII: ['BountiesII'], VigilsIII: ['BountiesIII'],
  DrillmasterI: ['TalesI'], DrillmasterII: ['TalesII'], DrillmasterIII: ['TalesIII'],
  FieldMedicineI: ['BedsI'], FieldMedicineII: ['BedsII'], FieldMedicineIII: ['BedsIII'],
};

/** The v63 place ids of the five lairs, and the creature each one became. */
const LAIR_RENAMES: Record<string, LairId> = {
  HollowBarrow: 'Orcs',
  SunkenChapel: 'Harpies',
  DrownedIronworks: 'Goblins',
  CountingHouse: 'WolfRiders',
  StarObservatory: 'Drake',
};

/** Bring `save` up to SAVE_VERSION in place, or return false if it cannot be.
 *  Exported for the test that walks the chain end to end. */
export function migrate(save: SaveFile): boolean {
  const from = save.SaveVersion ?? 1;
  if (from > SAVE_VERSION) return false; // a NEWER client wrote this — do not guess
  if (from < MIN_MIGRATABLE_VERSION) return false;
  for (const m of MIGRATIONS) {
    if (m.to > from) m.migrate(save.Modules as Record<string, any>);
  }
  save.SaveVersion = SAVE_VERSION;
  return true;
}

export function serialize(state: GameState, now: number): SaveFile {
  return {
    SaveVersion: SAVE_VERSION,
    LastSaved: iso(now),
    GameVersion: GAME_VERSION,
    Modules: {
      'kingdom.cities': {
        Cities: [
          {
            Name: state.city.name,
            Population: state.city.population,
            Currencies: state.city.wallet,
            Goods: state.city.goods,
            Workshops: Object.entries(state.city.workshops).map(([id, line]) => ({
              DistrictUniqueID: id,
              Anchor: iso(line.anchor),
              Items: line.items.map((i) => ({
                Good: i.good, WorkMs: i.workMs, NeedMs: i.needMs,
              })),
            })),
            Districts: state.city.districts.map(
              (d): DistrictDto => ({
                UniqueID: d.uniqueId,
                DefinitionID: d.definitionId,
                Ordinal: d.ordinal,
                VisualVariant: d.visualVariant,
                AssignedWorkers: d.assignedWorkers,
                Level: d.level,
                GridLocation: d.location,
                ConstructionState: d.state,
                ...(d.stored && Object.keys(d.stored).length > 0 ? { Stored: { ...d.stored } } : {}),
                ...(d.rentAnchor !== undefined ? { RentAnchorUtc: iso(d.rentAnchor) } : {}),
                ...(d.hosts !== undefined ? { Hosts: d.hosts } : {}),
              }),
            ),
            QueueItems: state.city.queue.map((q): QueueItemDto => ({
              UniqueID: q.uniqueId,
              DistrictID: q.districtUniqueId,
              DurationSeconds: q.durationSeconds,
              StartedAtUtc: isoOrNull(q.startedAt),
              ...(q.kind === 'upgrade' ? { TargetLevel: q.targetLevel } : {}),
              ...(q.cutMs ? { CutMs: q.cutMs } : {}),
            })),
            QueueKinds: state.city.queue.map((q) => q.kind),
            TrainingQueue: state.city.trainingQueue.map((i) => ({
              UniqueID: i.uniqueId,
              Trainee: i.trainee,
              BuildingID: i.buildingId,
              StartedAtUtc: isoOrNull(i.startedAt),
              // Stamped with the clock, so a save reads back the wait the
              // player was promised rather than today's neighbours.
              Seconds: i.seconds,
              // A ward of wounded is one item that hands over many. Written
              // only when it is one, so a recruit's row is what it always was.
              ...(i.kind === 'heal' ? { Kind: 'heal', Count: i.count ?? 1 } : {}),
              ...(i.cutMs ? { CutMs: i.cutMs } : {}),
            })),
            // The infirmary: who is waiting to be put back together.
            Wounded: Object.entries(state.city.wounded)
              .filter(([, n]) => (n ?? 0) > 0)
              .map(([unitId, n]) => ({ UnitID: unitId, Count: n })),
            LastManaAt: iso(state.city.lastManaAt),
          },
        ],
      },
      'kingdom.kingdoms': {
        // The DTO key stays `MaxBuilders` even though the field was renamed
        // to `builders`: changing it would need a migrator to buy nothing.
        MaxBuilders: state.kingdom.builders,
        Currencies: state.kingdom.wallet,
        LastKnowledgeAt: iso(state.kingdom.lastKnowledgeAt),
        KnowledgeBoughtWithGold: state.kingdom.knowledgeBoughtWithGold,
        UtcOffsetMinutes: state.kingdom.utcOffsetMinutes,
        // The season pass (sim/pass.ts). The BOARD travels whole: a mission
        // is its odometer key plus what that odometer read when it was
        // issued, so dropping one loses the only record of where it started.
        Survey: {
          ClaimedFree: state.kingdom.survey.claimedFree,
          ClaimedPaid: state.kingdom.survey.claimedPaid,
          Owned: state.kingdom.survey.owned,
        },
        Profile: { Nickname: state.kingdom.profile.nickname, Crest: state.kingdom.profile.crest },
        Pass: {
          Season: state.kingdom.pass.season,
          Xp: state.kingdom.pass.xp,
          ClaimedFree: state.kingdom.pass.claimedFree,
          ClaimedPaid: state.kingdom.pass.claimedPaid,
          PaidSeason: state.kingdom.pass.paidSeason,
          LastWindow: state.kingdom.pass.lastWindow,
          Week: state.kingdom.pass.week,
          IssuedThisWeek: state.kingdom.pass.issuedThisWeek,
          Live: state.kingdom.pass.live.map((m) => ({
            UniqueID: m.uniqueId, Kind: m.kind, Meter: m.meter, Base: m.base,
            Target: m.target, Subject: m.subject, Window: m.window, Slot: m.slot,
            Reward: m.reward,
          })),
        },
      },
      'kingdom.fogOfWar': {
        Revealed: Object.keys(state.fog.revealed).map(parseCoordKey),
        Discovered: Object.keys(state.fog.discovered).map(parseCoordKey),
        Progress: Object.entries(state.fog.progress).map(([k, taps]) => ({
          Coord: parseCoordKey(k),
          Taps: taps,
        })),
        PaidReveals: state.fog.paidReveals,
        TreasuresPlaced: state.fog.treasuresPlaced,
        Treasures: Object.entries(state.fog.treasures).map(([k, t]) => ({
          Coord: parseCoordKey(k),
          N: t.n,
          Coin: t.coin,
          AtUtc: iso(t.at),
        })),
      },
      'kingdom.features': {
        Cells: Object.entries(state.features).map(([k, id]) => ({
          Coord: parseCoordKey(k),
          FeatureID: id,
          ...(state.featureMeta[k] !== undefined ? {
            Origin: parseCoordKey(state.featureMeta[k].origin),
            Generation: state.featureMeta[k].generation,
          } : {}),
        })),
        Respawns: state.featureRespawns.map((r) => ({
          Origin: parseCoordKey(r.origin),
          FeatureID: r.feature,
          ReadyAtUtc: iso(r.readyAt),
          Generation: r.generation,
        })),
      },
      'kingdom.cellHarvest': {
        Cells: Object.entries(state.harvest)
          .map(([k, s]) => ({
            Coord: parseCoordKey(k),
            Units: s.units,
            ExhaustedUntil: isoOrNull(s.exhaustedUntil),
            RecoveryMs: s.recoveryMs,
          })),
      },
      'kingdom.workers': {
        Workers: state.workers.map((w): WorkerDto => ({
          ID: w.id,
          BuildingID: w.buildingId,
          Activity: w.activity,
          ClaimedCell: w.claimedCell,
          Carrying: w.carrying,
          StrikeCarry: w.strikeCarry,
          CarriedSource: w.carriedSource,
          StateStartedAt: iso(w.stateStartedAt),
          StateUntil: isoOrNull(w.stateUntil),
        })),
      },
      'kingdom.army': {
        Units: state.army.map((u) => ({ UniqueID: u.uniqueId, DefinitionID: u.definitionId })),
      },
      'kingdom.quests': {
        Index: state.quests.index,
        Progress: state.quests.progress,
        Rush: state.quests.rush === undefined ? undefined
          : { Index: state.quests.rush.index, AtUtc: isoOrNull(state.quests.rush.at) },
      },
      // The lifetime odometers the missions read (sim/events.ts). A plain
      // key→count map, written whole: every live mission stores a BASE
      // reading of one of these, so losing them would silently complete or
      // un-complete the whole board.
      'kingdom.tallies': { Counts: state.tallies },
      'kingdom.discoveries': {
        Keys: Object.keys(state.discoveries),
      },
      'kingdom.tutorial': {
        Veteran: state.tutorial.veteran,
        Seen: Object.keys(state.tutorial.seen),
        StartedAtUtc: iso(state.tutorial.startedAt),
      },
      'kingdom.abandoned': {
        Repaired: Object.keys(state.abandoned.repaired),
      },
      'kingdom.bag': {
        Held: state.bag.held,
        Fresh: Object.keys(state.bag.fresh),
        Badge: state.bag.badge,
      },
      'kingdom.relics': {
        Held: Object.fromEntries(Object.entries(state.relics.held)
          .map(([id, f]) => [id, { Found: f!.found, Bound: f!.bound }])),
        Chests: state.relics.chests,
        PremiumShrines: state.relics.premiumShrines,
      },
      // The playtest's signs (Docs/playtest.md §5): the times; the counts are
      // the tallies'.
      'kingdom.signals': {
        SightedAt: Object.fromEntries(Object.entries(state.signals.sightedAt).map(([id, t]) => [id, iso(t)])),
        DiscoveredAt: Object.fromEntries(Object.entries(state.signals.discoveredAt).map(([id, t]) => [id, iso(t)])),
        TreasureWaitMs: state.signals.treasureWaitMs,
        ReturnTaps: state.signals.returnTaps.map((r) => ({ AtUtc: iso(r.at), Kind: r.kind })),
        PlayMs: state.signals.playMs,
      },
      'kingdom.research': {
        Completed: state.research.completed,
        Poured: state.research.poured,
        Rewarded: state.research.rewarded,
      },
      'kingdom.schedule': {
        Entries: state.schedule.map((e) => ({
          ID: e.id,
          TemplateID: e.templateId,
          StartsAtUtc: iso(e.startsAt),
          EndsAtUtc: isoOrNull(e.endsAt),
          Payload: e.payload,
          Phase: e.phase,
        })),
      },
      'kingdom.heroes': {
        Owned: state.heroes.owned,
        Levels: state.heroes.levels,
        Tiers: state.heroes.tiers,
        Fragments: state.heroes.fragments,
        HeroSlotsPurchased: state.heroes.heroSlotsPurchased,
        Hurt: Object.fromEntries(Object.entries(state.heroes.hurt)
          .map(([id, h]) => [id, { Missing: h!.missing, AtUtc: iso(h!.at), Exhausted: h!.exhausted === true }])),
      },
      'kingdom.gacha': {
        PullCounts: state.gacha.pullCounts,
        PityCounters: state.gacha.pityCounters,
        LegendaryPity: state.gacha.legendaryPity,
        FreePulls: state.gacha.freePulls,
      },
      // The ad offer. `ReadyAt` is a TIMER. `Pending` persists because an offer the player walked
      // away from is still owed to them.
      'kingdom.adOffers': {
        ReadyAtUtc: iso(state.ads.readyAt),
        Claims: state.ads.claims,
        Pending: state.ads.pending,
        // The day's two refill counters. `Day` is a day INDEX, so a save
        // reloaded tomorrow rolls itself the first time anything reads it.
        Refills: {
          Day: state.ads.refills.day,
          Watched: state.ads.refills.watched,
          Bought: state.ads.refills.bought,
        },
      },
      'kingdom.landmarks': {
        Claimed: Object.keys(state.landmarks.claimed),
      },
      // The lairs and what they carry. `NextRaidAtUtc` is a TIMER: the clock
      // a find started runs while the player is away, and the raids it owes
      // resolve on the next advance (Docs/proposals/lairs.md §4).
      'kingdom.lairs': {
        Lairs: Object.entries(state.lairs).map(([lairId, g]) => ({
          LairID: lairId,
          ArmedAtUtc: iso(g!.armedAt),
          NextRaidAtUtc: isoOrNull(g!.nextRaidAt),
          Hoard: g!.hoard,
          Defeated: g!.defeated,
          Cleared: g!.cleared,
        })),
      },
      // A relic is a level and a cast clock. The passives are re-derived on
      // load, so nothing about what they DO is written here.
      'kingdom.artifacts': {
        Levels: state.artifacts.levels,
        // A WINDOW SURVIVES A CLOSED TAB, because the zone it placed does: a
        // zone is a modifier and those are written whole, so a relic that came
        // back READY while its own zone was still standing would let the
        // player lay a second one on top of the first.
        Charges: state.artifacts.charges,
        Casts: Object.fromEntries(Object.entries(state.artifacts.casts).map(
          ([id, c]) => [id, { EndsAtUtc: iso(c!.endsAt), ReadyAtUtc: iso(c!.readyAt) }],
        )),
      },
      // The live season's cards. Wiped whole at the close, so this module is
      // the one thing in the file that is deliberately short-lived.
      'kingdom.modifiers': {
        Modifiers: state.modifiers.map((m) => ({
          ID: m.id, Source: m.source, Stat: m.stat, Scope: m.scope,
          Op: m.op, Value: m.value, ExpiresAtUtc: isoOrNull(m.expiresAt),
          // A ZONE. Absent on every modifier that is not one, which keeps a
          // save from before relic actives byte-identical through this key.
          Area: m.area === undefined ? null : {
            X: m.area.centre.x, Y: m.area.centre.y, Radius: m.area.radius,
            Relic: m.area.relic, SinceUtc: iso(m.area.since),
            ...(m.area.size !== undefined ? { W: m.area.size.x, H: m.area.size.y } : {}),
          },
        })),
      },
      // The world board as this save knows it (Docs/features/02-map-scopes.md
      // §6): which board and seat, the fog, and the explorers out. A trip is a
      // TIMER priced when it left, so it is written whole and resolves on the
      // next advance. World control is server state and is never here.
      'kingdom.world': {
        BoardID: state.world.board.id,
        BoardSeed: state.world.board.seed,
        Seat: state.world.board.seat,
        Revealed: state.world.revealed,
        Explorers: state.world.explorers.map((e) => ({
          ID: e.id, Target: e.target, Path: e.path,
          DepartedAtUtc: iso(e.departedAt), StepMs: e.stepMs, WorkMs: e.workMs, Radius: e.radius,
        })),
        // The builders out on the board: a TIMER each, priced when the server
        // accepted the build, so a builder away during an absence is home on
        // return.
        Builds: state.world.builds.map((b) => ({
          Index: b.index, What: b.what, Level: b.level, FinishesAtUtc: iso(b.finishesAt),
        })),
        Sanctuaries: state.world.sanctuaries,
        Chapels: [...state.world.chapels],
        // What the city lent each army out: the army itself is server state.
        Armies: state.world.armies.map((a) => ({
          ID: a.id, Heroes: a.heroes, Troops: a.troops, Target: a.target, Purpose: a.purpose,
        })),
        // The last world-server effect applied: saved with what it changed.
        EffectSeq: state.world.effectSeq,
      },
      'player.currencies': state.player.wallet,
      // The simulated payer. Additive: a save from before it has none, so the
      // reader leaves it null and the profile sheet asks on the next launch.
      'player.payer': state.player.payer === null ? null : {
        Profile: state.player.payer.profile,
        ChosenAtUtc: iso(state.player.payer.chosenAt),
        MonthIndex: state.player.payer.monthIndex,
        SpentCentsThisMonth: state.player.payer.spentCentsThisMonth,
        Refusals: state.player.payer.refusals,
        Purchases: state.player.payer.purchases.map((p) => ({
          SKU: p.sku, PriceCents: p.priceCents, AtUtc: iso(p.at),
        })),
      },
      'meta.region': state.regionId,
      'meta.seed': state.seed,
      'meta.nextId': state.nextId,
    },
  };
}

/**
 * Rebuild a GameState from a save and replay the absence (capped at 8h).
 * Returns null when the save cannot be brought to the current version —
 * older than MIN_MIGRATABLE_VERSION, or written by a NEWER client, which a
 * second device can sync in and which must never be read as if current.
 * The caller then starts a fresh game.
 */
/** What the kingdom did while nobody was watching. */
export interface CatchUpReport {
  /** Milliseconds replayed: the whole absence. */
  elapsedMs: number;
  /** True when some building's store filled while the player was away. */
  storesFull: boolean;
  result: AdvanceResult;
}

/**
 * @param onCatchUp Called once with everything the offline replay produced.
 *   Optional and last, so no existing call site changes: the replay happens
 *   in here, BEFORE a Game exists, and its AdvanceResult was being dropped
 *   on the floor — which is why the player never saw what they earned.
 */
export function deserialize(
  save: SaveFile,
  map: MapData,
  now: number,
  onCatchUp?: (report: CatchUpReport) => void,
): GameState | null {
  if (!migrate(save)) return null;
  const lastSaved = ms(save.LastSaved);
  const state = newGame(map, lastSaved);
  const modules = save.Modules as Record<string, any>;

  const cityDto = modules['kingdom.cities']?.Cities?.[0];
  if (cityDto) {
    state.city.population = cityDto.Population ?? state.city.population;
    state.city.wallet = { ...(cityDto.Currencies as Wallet) };
    // Additive since save 29: a save written before goods existed simply has
    // an empty stockpile, which is what a city that never built a workshop
    // holds anyway.
    state.city.goods = { ...((cityDto.Goods ?? {}) as GoodsStock) };
    state.city.workshops = {};
    for (const w of (cityDto.Workshops ?? []) as WorkshopDto[]) {
      state.city.workshops[w.DistrictUniqueID] = {
        anchor: ms(w.Anchor),
        items: (w.Items ?? []).map((i) => ({
          good: i.Good as GoodId,
          workMs: i.WorkMs ?? 0,
          // Pre-30: no stamp, so the authored work is what it owes.
          needMs: i.NeedMs,
        })),
      };
    }
    const legacyTaxAt = typeof cityDto.LastTaxAt === 'string' ? ms(cityDto.LastTaxAt) : null;
    state.city.districts = (cityDto.Districts as DistrictDto[]).map(
      (d): District => ({
        uniqueId: d.UniqueID,
        definitionId: d.DefinitionID as District['definitionId'],
        ordinal: d.Ordinal ?? 1,
        level: d.Level ?? 1,
        assignedWorkers: d.AssignedWorkers ?? 0,
        location: d.GridLocation,
        state: d.ConstructionState as District['state'],
        visualVariant: d.VisualVariant ?? 1,
        ...(d.Stored ? { stored: { ...d.Stored } } : {}),
        // A save from before stores had ONE rent anchor for the city; every
        // house picks up from it, so an absence spanning the update is paid
        // into the houses from where the old anchor stood.
        ...(d.RentAnchorUtc ? { rentAnchor: ms(d.RentAnchorUtc) }
          : legacyTaxAt !== null ? { rentAnchor: legacyTaxAt } : {}),
        ...(d.Hosts !== undefined && (ARTIFACT_ORDER as string[]).includes(d.Hosts) ? { hosts: d.Hosts as ArtifactId } : {}),
      }),
    );
    const kinds = (cityDto.QueueKinds ?? []) as Array<'build' | 'upgrade'>;
    state.city.queue = ((cityDto.QueueItems ?? []) as QueueItemDto[]).map(
      (q, i): QueueItem => ({
        uniqueId: q.UniqueID,
        kind: kinds[i] ?? (q.TargetLevel !== undefined ? 'upgrade' : 'build'),
        districtUniqueId: q.DistrictID,
        targetLevel: q.TargetLevel,
        durationSeconds: q.DurationSeconds,
        startedAt: msOrNull(q.StartedAtUtc),
        // Additive (v90): what speed-ups took off it.
        ...(q.CutMs !== undefined && q.CutMs > 0 ? { cutMs: q.CutMs } : {}),
      }),
    );
    state.city.lastManaAt = cityDto.LastManaAt ? ms(cityDto.LastManaAt) : lastSaved;
    state.city.trainingQueue = ((cityDto.TrainingQueue ?? []) as any[]).map((i) => ({
      uniqueId: i.UniqueID,
      trainee: i.Trainee,
      buildingId: i.BuildingID,
      startedAt: msOrNull(i.StartedAtUtc),
      // A pre-30 save has no stamp: the authored duration is what it was
      // running on anyway (`itemTrainSeconds`).
      seconds: i.Seconds ?? null,
      // A pre-41 save has no infirmary in it, so every item is a recruit.
      ...(i.Kind === 'heal' ? { kind: 'heal' as const, count: i.Count ?? 1 } : {}),
      // Additive (v90): what speed-ups took off it.
      ...(i.CutMs > 0 ? { cutMs: i.CutMs } : {}),
    }));
    state.city.wounded = {};
    for (const w of (cityDto.Wounded ?? []) as any[]) {
      state.city.wounded[w.UnitID as UnitId] = w.Count ?? 0;
    }
    // ---- migrating a save written before the two queues became one ----
    // Soldiers were `ArmyQueue` with a `UnitID`; villagers were a bare count
    // and one timestamp on the city. Both become items in the single line.
    // A rename plus a reshape, which is exactly what a migrator is for — the
    // alternative is a player losing units they already paid for.
    for (const i of (cityDto.ArmyQueue ?? []) as any[]) {
      state.city.trainingQueue.push({
        uniqueId: i.UniqueID,
        trainee: i.UnitID,
        buildingId: i.BuildingID,
        startedAt: msOrNull(i.StartedAtUtc),
        seconds: null,
      });
    }
    if (cityDto.TrainingStartedAt) {
      const hall = state.city.districts.find((d) => d.definitionId === 'Townhall');
      const startedAt = ms(cityDto.TrainingStartedAt);
      // The old shape only remembered when the CURRENT one started; the rest
      // of the line had no clock of its own, so they queue up behind it.
      for (let n = 0; n < (cityDto.TrainingQueued ?? 1); n++) {
        state.city.trainingQueue.push({
          uniqueId: `migrated_villager_${n}`,
          trainee: 'Villager',
          buildingId: hall?.uniqueId ?? '',
          startedAt: n === 0 ? startedAt : null,
          seconds: null,
        });
      }
    }
  }

  const kingdomDto = modules['kingdom.kingdoms'];
  if (kingdomDto) {
    state.kingdom.builders = kingdomDto.MaxBuilders ?? state.kingdom.builders;
    state.kingdom.wallet = { ...(kingdomDto.Currencies as Wallet) };
    state.kingdom.lastKnowledgeAt = kingdomDto.LastKnowledgeAt
      ? ms(kingdomDto.LastKnowledgeAt) : lastSaved;
    state.kingdom.knowledgeBoughtWithGold = kingdomDto.KnowledgeBoughtWithGold ?? 0;
    state.kingdom.utcOffsetMinutes = Number.isFinite(kingdomDto.UtcOffsetMinutes) ? kingdomDto.UtcOffsetMinutes : 0;
    // Additive: a save from before the pass has no Pass block, and
    // `Season: -1` matches no real season — so it reads as an empty pass
    // rather than as season 0's, and the first live tick fills the board from
    // the window it lands in.
    // Additive (v82): a kingdom from before the Survey opens it with nothing
    // taken — its level is read off the cells it has already revealed.
    const survey = kingdomDto.Survey as
      { ClaimedFree?: number[]; ClaimedPaid?: number[]; Owned?: boolean } | undefined;
    state.kingdom.survey = {
      claimedFree: [...(survey?.ClaimedFree ?? [])],
      claimedPaid: [...(survey?.ClaimedPaid ?? [])],
      owned: survey?.Owned === true,
    };
    // Additive (v97): a kingdom from before it had a profile learns its
    // nickname from the world board the next time it connects.
    const profile = kingdomDto.Profile as { Nickname?: string | null; Crest?: string | null } | undefined;
    state.kingdom.profile = {
      nickname: typeof profile?.Nickname === 'string' ? profile.Nickname : null,
      crest: parseCrest(profile?.Crest) === null ? null : profile!.Crest!,
    };
    const pass = kingdomDto.Pass as {
      Season?: number; Xp?: number; ClaimedFree?: number[]; ClaimedPaid?: number[];
      PaidSeason?: number | null; LastWindow?: number; Week?: number;
      IssuedThisWeek?: Record<string, number>;
      Live?: Array<Record<string, any>>;
    };
    if (pass) {
      state.kingdom.pass.season = pass.Season ?? -1;
      state.kingdom.pass.xp = pass.Xp ?? 0;
      state.kingdom.pass.claimedFree = [...(pass.ClaimedFree ?? [])];
      state.kingdom.pass.claimedPaid = [...(pass.ClaimedPaid ?? [])];
      state.kingdom.pass.paidSeason = pass.PaidSeason ?? null;
      state.kingdom.pass.lastWindow = pass.LastWindow ?? -1;
      state.kingdom.pass.week = pass.Week ?? -1;
      state.kingdom.pass.issuedThisWeek = { ...(pass.IssuedThisWeek ?? {}) };
      state.kingdom.pass.live = (pass.Live ?? []).map((m) => ({
        uniqueId: String(m.UniqueID),
        kind: m.Kind as MissionKind,
        meter: String(m.Meter),
        base: m.Base ?? 0,
        target: m.Target ?? 1,
        subject: (m.Subject ?? null) as CurrencyId | null,
        // A mission from before the rewards varied read as the Gem one — the
        // amount is the authored one, so an old board pays exactly what a new
        // board's Gem missions pay rather than nothing.
        reward: (m.Reward ?? { kind: 'Gems', amount: MISSIONS.rewardGems }) as MissionReward,
        window: m.Window ?? -1,
        slot: m.Slot ?? 0,
        claimed: false,
      }));
    }
  }

  const fogDto = modules['kingdom.fogOfWar'];
  if (fogDto) {
    state.fog = {
      revealed: {}, discovered: {}, progress: {},
      // Additive: a save from before the treasures starts their clock at zero,
      // so a veteran is not showered with what its old reveals would have paid.
      paidReveals: fogDto.PaidReveals ?? 0,
      treasuresPlaced: fogDto.TreasuresPlaced ?? 0,
      treasures: {},
    };
    for (const t of (fogDto.Treasures ?? []) as { Coord: Coord; N: number; Coin: CurrencyId; AtUtc?: string }[]) {
      state.fog.treasures[coordKey(t.Coord)] = {
        n: t.N ?? 0, coin: t.Coin, at: t.AtUtc === undefined ? lastSaved : ms(t.AtUtc),
      };
    }
    for (const c of (fogDto.Revealed ?? []) as Coord[]) state.fog.revealed[coordKey(c)] = true;
    for (const c of (fogDto.Discovered ?? []) as Coord[]) state.fog.discovered[coordKey(c)] = true;
    for (const p of (fogDto.Progress ?? []) as { Coord: Coord; Taps: number }[]) {
      state.fog.progress[coordKey(p.Coord)] = p.Taps ?? 0;
    }
  }

  const featuresDto = modules['kingdom.features'];
  if (featuresDto?.Cells) {
    state.features = {};
    state.featureMeta = {};
    for (const f of featuresDto.Cells as any[]) {
      const key = coordKey(f.Coord);
      state.features[key] = f.FeatureID;
      if (f.Origin !== undefined) {
        state.featureMeta[key] = { origin: coordKey(f.Origin), generation: f.Generation ?? 0 };
      }
    }
    state.featureRespawns = ((featuresDto.Respawns ?? []) as any[]).map((r) => ({
      origin: coordKey(r.Origin),
      feature: r.FeatureID,
      readyAt: ms(r.ReadyAtUtc),
      generation: r.Generation ?? 0,
    }));
  }

  const harvestDto = modules['kingdom.cellHarvest']?.Cells;
  if (harvestDto) {
    for (const c of harvestDto as any[]) {
      const spec = harvestSpecAt(state, c.Coord);
      state.harvest[coordKey(c.Coord)] = {
        // A cell whose depot was never written is full; `Units` 0 is a real
        // value (an emptied cell) and must survive the ?? that a missing key
        // needs, so it is checked rather than defaulted.
        units: typeof c.Units === 'number' ? c.Units : (spec?.stock ?? 0),
        exhaustedUntil: msOrNull(c.ExhaustedUntil),
        // A save from before the bar knew what it was counting has no length
        // on it. Null is honest — the renderer falls back to the authored
        // wait for that one cell, exactly as it did before, and the next
        // exhaustion stamps a real one.
        recoveryMs: c.RecoveryMs ?? null,
      };
    }
  }

  const workersDto = modules['kingdom.workers']?.Workers;
  if (workersDto) {
    state.workers = (workersDto as WorkerDto[]).map(
      (w): Worker => ({
        id: w.ID,
        buildingId: w.BuildingID,
        activity: w.Activity as Worker['activity'],
        claimedCell: w.ClaimedCell,
        carrying: w.Carrying ?? 0,
        strikeCarry: w.StrikeCarry ?? 0,
        carriedSource: (w.CarriedSource ?? null) as Worker['carriedSource'],
        stateStartedAt: ms(w.StateStartedAt),
        stateUntil: msOrNull(w.StateUntil),
      }),
    );
  }

  const armyDto = modules['kingdom.army']?.Units;
  if (armyDto) {
    state.army = (armyDto as any[]).map((u) => ({
      uniqueId: u.UniqueID,
      definitionId: u.DefinitionID,
    }));
  }

  const researchDto = modules['kingdom.research'];
  if (researchDto) {
    state.research = {
      // Filtered against the build: a technology the tree no longer has (one
      // deleted in `?dev=tree`) would otherwise sit in `completed` for ever,
      // summed into every total and indexed by anything that trusts the list.
      completed: ((researchDto.Completed ?? []) as TechId[])
        .filter((id) => TECHNOLOGIES[id] !== undefined),
      // Same filter, and a technology already researched holds nothing.
      poured: Object.fromEntries(Object.entries((researchDto.Poured ?? {}) as Record<string, number>)
        .filter(([id, n]) => TECHNOLOGIES[id as TechId] !== undefined && n > 0
          && !(researchDto.Completed ?? []).includes(id))) as Partial<Record<TechId, number>>,
      rewarded: Array.isArray(researchDto.Rewarded) ? (researchDto.Rewarded as string[]) : [],
    };
  }

  const discoveriesDto = modules['kingdom.discoveries'];
  if (discoveriesDto?.Keys) {
    state.discoveries = {};
    for (const key of discoveriesDto.Keys as string[]) state.discoveries[key] = true;
  }

  // A save with no tutorial module was made before the doors existed, so its
  // kingdom walked in through none of them: every door opens and every scene
  // counts as played. Additive — no migrator (v69).
  const tutorialDto = modules['kingdom.tutorial'] as
    { Veteran?: boolean; Seen?: string[]; StartedAtUtc?: string } | undefined;
  // A kingdom with no founding date is read as founded long ago: its first
  // day is over. Additive (v71).
  state.tutorial = tutorialDto === undefined
    ? { veteran: true, seen: {}, startedAt: 0 }
    : {
      veteran: tutorialDto.Veteran === true,
      seen: Object.fromEntries((tutorialDto.Seen ?? []).map((k) => [k, true as const])),
      startedAt: tutorialDto.StartedAtUtc === undefined ? 0 : ms(tutorialDto.StartedAtUtc),
    };

  // Additive (v83): a kingdom from before the signals starts them empty.
  const signalsDto = modules['kingdom.signals'] as {
    SightedAt?: Record<string, string>; DiscoveredAt?: Record<string, string>;
    TreasureWaitMs?: number; ReturnTaps?: Array<{ AtUtc: string; Kind: string }>; PlayMs?: number;
  } | undefined;
  state.signals = {
    sightedAt: Object.fromEntries(Object.entries(signalsDto?.SightedAt ?? {}).map(([id, t]) => [id, ms(t)])),
    discoveredAt: Object.fromEntries(Object.entries(signalsDto?.DiscoveredAt ?? {}).map(([id, t]) => [id, ms(t)])),
    treasureWaitMs: signalsDto?.TreasureWaitMs ?? 0,
    returnTaps: (signalsDto?.ReturnTaps ?? []).map((r) => ({ at: ms(r.AtUtc), kind: r.Kind })),
    // Additive (v88).
    playMs: Number.isFinite(signalsDto?.PlayMs) && signalsDto!.PlayMs! >= 0 ? signalsDto!.PlayMs! : 0,
  };

  // Additive (v89). An item the build no longer knows is dropped, and a
  // count that is not a positive whole number is no item.
  const bagDto = modules['kingdom.bag'] as
    { Held?: Record<string, number>; Fresh?: string[]; Badge?: number } | undefined;
  const known = (id: string): id is ItemId => ITEMS[id as ItemId] !== undefined;
  state.bag = {
    held: Object.fromEntries(Object.entries(bagDto?.Held ?? {})
      .filter(([id, n]) => known(id) && Number.isInteger(n) && n > 0)) as GameState['bag']['held'],
    fresh: Object.fromEntries((bagDto?.Fresh ?? []).filter(known).map((id) => [id, true as const])),
    badge: Number.isInteger(bagDto?.Badge) && bagDto!.Badge! > 0 ? bagDto!.Badge! : 0,
  };

  // v92. Six slots a relic, found and bound; a relic the build no longer
  // knows, or a malformed slot list, is dropped.
  const relicsDto = modules['kingdom.relics'] as
    { Held?: Record<string, { Found?: number[]; Bound?: number[] }>; Chests?: number; PremiumShrines?: number } | undefined;
  const six = (v: unknown): number[] => (Array.isArray(v) && v.length === 6 && v.every((n) => Number.isInteger(n) && n >= 0)
    ? [...v] : [0, 0, 0, 0, 0, 0]);
  state.relics = {
    held: Object.fromEntries(Object.entries(relicsDto?.Held ?? {})
      .filter(([id]) => (ARTIFACT_ORDER as string[]).includes(id))
      .map(([id, f]) => [id, { found: six(f.Found), bound: six(f.Bound) }])),
    chests: Number.isInteger(relicsDto?.Chests) ? relicsDto!.Chests! : 0,
    premiumShrines: Number.isInteger(relicsDto?.PremiumShrines) ? relicsDto!.PremiumShrines! : 0,
  };

  // Additive (v81). A kingdom from before the abandoned buildings may have
  // built where one now stands: that one never appears — it reads as already
  // repaired, and the building there is the kingdom's own.
  const abandonedDto = modules['kingdom.abandoned'] as { Repaired?: string[] } | undefined;
  state.abandoned = {
    repaired: Object.fromEntries((abandonedDto?.Repaired ?? []).map((id) => [id, true as const])),
  };
  for (const a of ABANDONED) {
    const cells = cellsOfRect(a.location, DISTRICTS[a.districtId].size);
    if (cells.some((c) => state.city.districts.some((d) => districtOccupies(d, c)))) {
      state.abandoned.repaired[a.id] = true;
    }
  }

  const questsDto = modules['kingdom.quests'];
  if (questsDto) {
    state.quests = {
      index: questsDto.Index ?? 0,
      progress: questsDto.Progress ?? 0,
    };
    if (questsDto.Rush !== undefined && questsDto.Rush !== null) {
      state.quests.rush = { index: questsDto.Rush.Index ?? 0, at: msOrNull(questsDto.Rush.AtUtc) };
    }
  }

  const talliesDto = modules['kingdom.tallies'];
  if (talliesDto) state.tallies = { ...(talliesDto.Counts ?? {}) };

  const scheduleDto = modules['kingdom.schedule'];
  if (scheduleDto) {
    state.schedule = ((scheduleDto.Entries ?? []) as any[]).map((e) => ({
      id: e.ID,
      templateId: e.TemplateID ?? String(e.ID).split('#')[0],
      startsAt: ms(e.StartsAtUtc),
      endsAt: msOrNull(e.EndsAtUtc),
      payload: e.Payload,
      phase: e.Phase ?? 'pending',
    }));
  }

  const heroesDto = modules['kingdom.heroes'];
  if (heroesDto) {
    state.heroes = {
      owned: [...((heroesDto.Owned ?? state.heroes.owned) as typeof state.heroes.owned)],
      levels: { ...(heroesDto.Levels ?? {}) },
      tiers: { ...(heroesDto.Tiers ?? {}) },
      fragments: { ...(heroesDto.Fragments ?? {}) },
      // `PartySlotsPurchased` is gone: every troop slot is open from the
      // start, so an older save's count is simply not read.
      heroSlotsPurchased: heroesDto.HeroSlotsPurchased ?? 0,
      hurt: Object.fromEntries(Object.entries(
        (heroesDto.Hurt ?? {}) as Record<string, { Missing: number; AtUtc: string; Exhausted?: boolean }>,
      ).map(([id, h]) => [id, {
        missing: h.Missing, at: ms(h.AtUtc), ...(h.Exhausted === true ? { exhausted: true } : {}),
      }])),
    };
  }

  const adsDto = modules['kingdom.adOffers'];
  if (adsDto) {
    const refills = (adsDto.Refills ?? {}) as {
      Day?: number; Watched?: number; Bought?: number;
    };
    state.ads = {
      readyAt: adsDto.ReadyAtUtc ? ms(adsDto.ReadyAtUtc) : lastSaved,
      claims: adsDto.Claims ?? 0,
      pending: adsDto.Pending === true,
      // A save written before the allowances existed reads as a fresh day,
      // which is the generous default and the only safe one.
      refills: {
        day: refills.Day ?? state.ads.refills.day,
        watched: refills.Watched ?? 0,
        bought: refills.Bought ?? 0,
      },
    };
  }

  const gachaDto = modules['kingdom.gacha'];
  if (gachaDto) {
    state.gacha = {
      pullCounts: { ...(gachaDto.PullCounts ?? {}) },
      pityCounters: { ...(gachaDto.PityCounters ?? {}) },
      legendaryPity: { ...(gachaDto.LegendaryPity ?? {}) },
      freePulls: { ...(gachaDto.FreePulls ?? {}) },
    };
  }

  const landmarksDto = modules['kingdom.landmarks'];
  if (landmarksDto) {
    // `Cleared` was the defended landmark's flag and is gone: a sanctuary is
    // claimed for Gold and nothing holds one. An older save still carries the
    // key; it is simply not read.
    state.landmarks = { claimed: {} };
    for (const id of (landmarksDto.Claimed ?? []) as string[]) state.landmarks.claimed[id] = true;
  }

  const lairsDto = modules['kingdom.lairs'];
  if (lairsDto) {
    state.lairs = {};
    for (const g of (lairsDto.Lairs ?? []) as any[]) {
      // `Trips` and `Reports` belonged to the three-raid garrison and are not
      // read. A lair that had spent its trips has no clock; the next advance
      // puts it on the daily schedule (`armLairs`). `ArmedAtUtc` is new, and a
      // lair without one only loses the first-warning exemption of
      // `setUtcOffset`, which it no longer needs.
      state.lairs[g.LairID as LairId] = {
        armedAt: g.ArmedAtUtc ? ms(g.ArmedAtUtc) : 0,
        nextRaidAt: msOrNull(g.NextRaidAtUtc),
        hoard: { ...(g.Hoard ?? {}) },
        // Absent before the claim existed: a lair was cleared the instant it
        // was beaten, so a cleared one was also defeated.
        defeated: g.Defeated === true || g.Cleared === true,
        cleared: g.Cleared === true,
      };
    }
  }

  const artifactsDto = modules['kingdom.artifacts'];
  if (artifactsDto) {
    state.artifacts = {
      levels: { ...(artifactsDto.Levels ?? {}) },
      charges: { ...(artifactsDto.Charges ?? {}) },
      casts: Object.fromEntries(Object.entries(artifactsDto.Casts ?? {}).map(
        ([id, c]) => [id, { endsAt: ms((c as any).EndsAtUtc), readyAt: ms((c as any).ReadyAtUtc) }],
      )),
    };
  }

  const modifiersDto = modules['kingdom.modifiers']?.Modifiers;
  if (modifiersDto) {
    state.modifiers = (modifiersDto as any[]).map((m): Modifier => ({
      id: m.ID,
      source: m.Source,
      stat: m.Stat,
      scope: m.Scope ?? null,
      op: m.Op,
      value: m.Value,
      expiresAt: msOrNull(m.ExpiresAtUtc),
      // `undefined`, not null: `resolve()` tells a zone from a global modifier
      // by the key being absent, so a null here would make every old modifier
      // a zone of radius NaN.
      ...(m.Area == null ? {} : {
        area: {
          centre: { x: m.Area.X, y: m.Area.Y },
          radius: m.Area.Radius,
          relic: m.Area.Relic,
          ...(m.Area.W !== undefined ? { size: { x: m.Area.W, y: m.Area.H } } : {}),
          // A save from before the map could draw a zone has no instant on it.
          // `expiresAt` still ends the zone correctly; only the wheel's sweep
          // needs a start, and it reads as full rather than as NaN.
          since: m.Area.SinceUtc == null ? 0 : ms(m.Area.SinceUtc),
        },
      }),
    }));
  }

  // AFTER the modifier stack is restored: the relic passives are re-derived
  // from the levels and the legendary boons from the roster, so a save written
  // before either curve was rebalanced loads correct rather than stale — while
  // everything genuinely stateful (a Haste still running, a season's cards)
  // comes back from the file untouched. Neither needs a migrator for the same
  // reason: both are DERIVED, and a save that predates them re-derives to the
  // right answer on the first load.
  syncArtifactModifiers(state);
  syncHeroBoons(state);

  const playerDto = modules['player.currencies'];
  if (playerDto) state.player.wallet = { ...(playerDto as Wallet) };
  const payerDto = modules['player.payer'] as {
    Profile?: string; ChosenAtUtc?: string; MonthIndex?: number; SpentCentsThisMonth?: number;
    Refusals?: number; Purchases?: Array<{ SKU: string; PriceCents: number; AtUtc: string }>;
  } | null | undefined;
  // A profile this build does not know (the roster was renamed once already)
  // reads as no profile, so the sheet asks again rather than the store
  // drawing "undefined" over a NaN budget.
  if (payerDto && (PAYER_PROFILES as readonly string[]).includes(payerDto.Profile ?? '')) {
    state.player.payer = {
      profile: payerDto.Profile as PayerProfile,
      chosenAt: payerDto.ChosenAtUtc ? ms(payerDto.ChosenAtUtc) : lastSaved,
      monthIndex: payerDto.MonthIndex ?? 0,
      spentCentsThisMonth: payerDto.SpentCentsThisMonth ?? 0,
      refusals: payerDto.Refusals ?? 0,
      purchases: (payerDto.Purchases ?? []).map((p) => ({
        sku: p.SKU as StoreSkuId, priceCents: p.PriceCents, at: ms(p.AtUtc),
      })),
    };
  }

  // A save written before the seed existed keeps the fresh one newGame just
  // rolled: its world was generated by the old hash and cannot be reproduced
  // anyway, and nothing observable depends on which number it lands on.
  if (typeof modules['meta.region'] === 'string') {
    state.regionId = modules['meta.region'] as GameState['regionId'];
  }
  if (typeof modules['meta.seed'] === 'number') state.seed = modules['meta.seed'] as number;
  // AFTER the seed: a save from before the world board derives its board and
  // seat from the kingdom's own seed, not from the one newGame just rolled.
  state.world = readWorld(modules['kingdom.world'], state.seed);
  state.nextId = Math.max(state.nextId, (modules['meta.nextId'] as number) ?? 1);
  state.lastAdvance = lastSaved;

  // Authored windows are merged in from the BUILD's catalogue, and BEFORE the
  // replay below — otherwise a save written before a content drop would never
  // learn the new event exists, and a window that opened and closed during the
  // absence would never fire.
  // Reconciled against LAST SAVED, not `now`: a window that opened and closed
  // during this absence must still be pending here so the replay below fires
  // it, while one that closed before the save was ever written must not.
  reconcileSchedule(state, lastSaved);

  // ---- Offline catch-up: replay the whole absence. ---------------------------
  //
  // There is no offline cap. What bounds an absence is each building's store
  // (sim/storage.ts), the Mana pool, the Knowledge bar and the queues — each
  // stops its own production when it is full, in the same `advance()` the
  // live tick runs, so a day away and a day of stepping agree exactly.
  //
  // THE WHOLE CATCH-UP RUNS WITH THE MISSION ODOMETER HELD STILL
  // (sim/events.ts). The season pass's missions are active-play only, which is
  // the one thing in this codebase that is meant to read differently in replay
  // than live; everything else in `advance()` is untouched by the flag, so
  // invariant 1 still holds.
  const report = withoutTallies(state, () => advance(state, map, now));
  // A footprint may have grown in the data since this city was built: put
  // every building back on ground it may stand on (commands.ts).
  settleFootprints(state, map, now);
  onCatchUp?.({
    elapsedMs: Math.max(0, now - lastSaved),
    storesFull: state.city.districts.some((d) => isStoreFull(state, d)),
    result: report,
  });
  return state;
}

/** The world module, read defensively: a save without it (or with a broken
 *  one) gets the world its seed would have given it. A trip whose path does
 *  not walk the board step by step is dropped rather than trusted. */
function readWorld(dto: unknown, seed: number): GameState['world'] {
  const fresh = freshWorld(seed);
  if (dto === null || typeof dto !== 'object') return fresh;
  const d = dto as {
    BoardID?: unknown; BoardSeed?: unknown; Seat?: unknown; Revealed?: unknown;
    Explorers?: Array<Record<string, unknown>>;
    Builds?: Array<Record<string, unknown>>;
    Sanctuaries?: unknown;
    Chapels?: unknown;
    Armies?: Array<Record<string, unknown>>;
    EffectSeq?: unknown;
  };
  const seat = Number.isInteger(d.Seat) && (d.Seat as number) >= 0 && (d.Seat as number) < 6 ? d.Seat as number : fresh.board.seat;
  // A trip's time to leave each hex of its path. (A trip from before v78
  // kept one pace for them all; v85 dropped every trip older than it.)
  const stepsOf = (e: Record<string, unknown>): number[] | null => {
    const n = Array.isArray(e.Path) ? e.Path.length : 0;
    return Array.isArray(e.StepMs) && e.StepMs.length === n && e.StepMs.every((x) => Number.isFinite(x) && (x as number) >= 1)
      ? [...(e.StepMs as number[])]
      : null;
  };
  const walks = (path: unknown): path is number[] => Array.isArray(path) && path.length >= 2
    && path.every(isBoardIndex)
    && path.every((i, k) => k === 0 || hexDistance(hexAt(path[k - 1] as number), hexAt(i as number)) === 1);
  return {
    board: {
      id: typeof d.BoardID === 'string' ? d.BoardID : fresh.board.id,
      seed: Number.isInteger(d.BoardSeed) ? (d.BoardSeed as number) >>> 0 : fresh.board.seed,
      seat,
    },
    revealed: readBits(d.Revealed),
    explorers: (Array.isArray(d.Explorers) ? d.Explorers : [])
      .filter((e) => typeof e.ID === 'string' && walks(e.Path) && typeof e.DepartedAtUtc === 'string'
        && stepsOf(e) !== null)
      .map((e) => ({
        id: e.ID as string,
        target: (e.Path as number[])[(e.Path as number[]).length - 1],
        path: [...(e.Path as number[])],
        departedAt: ms(e.DepartedAtUtc as string),
        stepMs: stepsOf(e)!,
        workMs: Number.isFinite(e.WorkMs) && (e.WorkMs as number) >= 0 ? e.WorkMs as number : 0,
        radius: Number.isInteger(e.Radius) ? Math.max(1, e.Radius as number) : 1,
      })),
    builds: (Array.isArray(d.Builds) ? d.Builds : [])
      .filter((b) => isBoardIndex(b.Index) && typeof b.FinishesAtUtc === 'string'
        && (WORLD_DISTRICTS.includes(b.What as never) || WORLD_UPGRADES.includes(b.What as never) || b.What === 'Repair'))
      .map((b) => ({
        index: b.Index as number,
        what: b.What as GameState['world']['builds'][number]['what'],
        level: Number.isInteger(b.Level) ? b.Level as number : 1,
        finishesAt: ms(b.FinishesAtUtc as string),
      })),
    sanctuaries: Number.isInteger(d.Sanctuaries) && (d.Sanctuaries as number) >= 0 ? d.Sanctuaries as number : 0,
    chapels: Array.isArray(d.Chapels)
      ? (d.Chapels as unknown[]).filter((id): id is ArtifactId => typeof id === 'string' && id in ARTIFACTS && relicKind(id as ArtifactId) === 'world')
      : [],
    armies: (Array.isArray(d.Armies) ? d.Armies : [])
      .filter((a) => typeof a.ID === 'string' && Array.isArray(a.Heroes) && Array.isArray(a.Troops)
        && isBoardIndex(a.Target) && ['attack', 'claim', 'garrison', 'delve', 'portal', 'clear'].includes(a.Purpose as string))
      .map((a) => ({
        id: a.ID as string,
        heroes: (a.Heroes as string[]).filter((h) => h in HEROES) as GameState['world']['armies'][number]['heroes'],
        troops: (a.Troops as Array<{ unitId: string; count: number }>)
          .filter((t) => t.unitId in UNITS && Number.isInteger(t.count) && t.count > 0) as GameState['world']['armies'][number]['troops'],
        target: a.Target as number,
        purpose: a.Purpose as GameState['world']['armies'][number]['purpose'],
      })),
    effectSeq: Number.isInteger(d.EffectSeq) && (d.EffectSeq as number) >= 0 ? d.EffectSeq as number : 0,
  };
}
