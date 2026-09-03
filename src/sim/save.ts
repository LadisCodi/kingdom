// The save file, its migration chain, and the offline catch-up.
//
// The insight that keeps migration small: every module read below is already
// defensive — `if (dto)` plus `?? default`. So an ADDITIVE change (a new
// module key, a new optional field) needs no migrator at all: bump
// SAVE_VERSION and let the reader default. Migrators exist only for renames,
// reshapes and semantic changes, and this design is shaped around that
// reality instead of around a general framework.
//
// Offline catch-up: the unified advance replays the absence up to the 8h cap;
// time beyond the cap pauses workers/townhall (queue timers and cell recovery
// keep running in real time).

import { GAME_VERSION, OFFLINE_CAP_HOURS, SAVE_VERSION } from './data/definitions';
import { harvestSpecAt } from './harvest';
import { advance, type AdvanceResult } from './commands';
import type { MapData } from './grid';
import { normaliseSlots } from './artifacts';
import { reconcileSchedule } from './timeline';
import type { Modifier } from './modifiers';
import { newGame } from './newGame';
import {
  coordKey, parseCoordKey,
  type Coord, type District, type GameState, type QueueItem,
  type ArtifactId, type TechId, type UpgradeId, type Wallet, type Worker,
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
  VisualVariant: number;
  AssignedWorkers: number;
  Level: number;
  GridLocation: Coord;
  ConstructionState: string;
}

interface QueueItemDto {
  UniqueID: string;
  DistrictID: string;
  DurationSeconds: number;
  StartedAtUtc: string | null;
  TargetLevel?: number;
}

interface WorkerDto {
  ID: string;
  BuildingID: string;
  Activity: string;
  ClaimedCell: Coord | null;
  Carrying?: number;
  CarriedSource?: string | null;
  StateStartedAt: string;
  StateUntil: string | null;
}

/** Below this, a save is from a game shape that no longer exists and is
 *  discarded rather than migrated. v15 and earlier predate the reshaped tech
 *  tree; v1 predates the harvest loop entirely. */
export const MIN_MIGRATABLE_VERSION = 16;

interface Migration {
  /** The version this migrator produces. */
  to: number;
  migrate: (modules: Record<string, any>) => void;
}

/** Ordered, gap-free, append-only. A version bump with no reshape needs NO
 *  entry here — the defensive readers below already default the new field. */
const MIGRATIONS: readonly Migration[] = [
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
    // v23 — the Mine is gone as a building. The Quarry works every mountain
    // now, bare rock and metal alike, so a Mine that a player already paid
    // for BECOMES a Quarry rather than vanishing: the two had the same
    // footprint, the same crew and the same radius, and the first promise is
    // that nothing you own is taken from you.
    //
    // It can push a city one Quarry over its Townhall count cap. That is
    // deliberate — the cap gates BUILDING one, and taking a standing building
    // away to enforce it retroactively would be the very thing the promise
    // forbids.
    to: 23,
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
    // v24 — a resource cell stopped counting TAPS and started holding UNITS
    // (`Docs/features/04-harvest.md` §3). The old counter cannot be converted
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
    to: 24,
    migrate: (modules) => {
      delete modules['kingdom.cellHarvest'];
    },
  },
];

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
            Districts: state.city.districts.map(
              (d): DistrictDto => ({
                UniqueID: d.uniqueId,
                DefinitionID: d.definitionId,
                VisualVariant: d.visualVariant,
                AssignedWorkers: d.assignedWorkers,
                Level: d.level,
                GridLocation: d.location,
                ConstructionState: d.state,
              }),
            ),
            QueueItems: state.city.queue.map((q): QueueItemDto => ({
              UniqueID: q.uniqueId,
              DistrictID: q.districtUniqueId,
              DurationSeconds: q.durationSeconds,
              StartedAtUtc: isoOrNull(q.startedAt),
              ...(q.kind === 'upgrade' ? { TargetLevel: q.targetLevel } : {}),
            })),
            QueueKinds: state.city.queue.map((q) => q.kind),
            LastTaxAt: iso(state.city.lastTaxAt),
            TrainingQueue: state.city.trainingQueue.map((i) => ({
              UniqueID: i.uniqueId,
              Trainee: i.trainee,
              BuildingID: i.buildingId,
              StartedAtUtc: isoOrNull(i.startedAt),
            })),
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
        Daily: {
          LadderStep: state.kingdom.daily.ladderStep,
          LastClaimedDay: state.kingdom.daily.lastClaimedDay,
        },
      },
      'kingdom.fogOfWar': {
        Revealed: Object.keys(state.fog.revealed).map(parseCoordKey),
        Discovered: Object.keys(state.fog.discovered).map(parseCoordKey),
        Progress: Object.entries(state.fog.progress).map(([k, gold]) => ({
          Coord: parseCoordKey(k),
          Gold: gold,
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
          })),
      },
      'kingdom.workers': {
        Workers: state.workers.map((w): WorkerDto => ({
          ID: w.id,
          BuildingID: w.buildingId,
          Activity: w.activity,
          ClaimedCell: w.claimedCell,
          Carrying: w.carrying,
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
      },
      'kingdom.discoveries': {
        Keys: Object.keys(state.discoveries),
      },
      'kingdom.research': {
        Completed: state.research.completed,
        Active: state.research.active.map((a) => ({
          ID: a.id,
          StartedAtUtc: iso(a.startedAt),
        })),
        SlotsPurchased: state.research.slotsPurchased,
        UpgradeLevels: state.upgrades,
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
      'kingdom.delves': {
        Delves: state.delves.map((d) => ({
          ID: d.id,
          RuinID: d.ruinId,
          HeroID: d.heroId,
          ArtifactID: d.artifactId,
          ArtifactLevel: d.artifactLevel,
          Party: d.party.map((p) => ({ UnitID: p.unitId, Count: p.count })),
          Depth: d.depth,
          PartyHp: d.partyHp,
          MaxPartyHp: d.maxPartyHp,
          Haul: d.haul,
          HaulFragments: d.haulFragments,
          Phase: d.phase,
          DepthEndsAtUtc: iso(d.depthEndsAt),
          StandingOrder: d.standingOrder,
          Threat: d.threat,
          Outcome: d.outcome,
        })),
        Cleared: Object.keys(state.ruinsCleared),
        DeepestDepth: state.deepestDepth,
      },
      'kingdom.heroes': {
        Owned: state.heroes.owned,
        Levels: state.heroes.levels,
        Tiers: state.heroes.tiers,
        Fragments: state.heroes.fragments,
        Xp: state.heroes.xp,
        PartySlotsPurchased: state.heroes.partySlotsPurchased,
      },
      'kingdom.gacha': {
        PullCounts: state.gacha.pullCounts,
        PityCounters: state.gacha.pityCounters,
      },
      // The ad offer. `ReadyAt` is a TIMER, so it is not shifted by the
      // offline cap below — the cap limits what the city produces, never what
      // a clock does. `Pending` persists because an offer the player walked
      // away from is still owed to them.
      'kingdom.adOffers': {
        ReadyAtUtc: iso(state.ads.readyAt),
        Claims: state.ads.claims,
        Pending: state.ads.pending,
      },
      'kingdom.landmarks': {
        Claimed: Object.keys(state.landmarks.claimed),
        Cleared: Object.keys(state.landmarks.cleared),
      },
      'kingdom.artifacts': {
        Owned: state.artifacts.owned,
        Levels: state.artifacts.levels,
        Tiers: state.artifacts.tiers,
        Fragments: state.artifacts.fragments,
        Attuned: state.artifacts.attuned,
        SlotsPurchased: state.artifacts.slotsPurchased,
        LockedUntil: state.artifacts.lockedUntil.map(isoOrNull),
      },
      'kingdom.modifiers': {
        Modifiers: state.modifiers.map((m) => ({
          ID: m.id, Source: m.source, Stat: m.stat, Scope: m.scope,
          Op: m.op, Value: m.value, ExpiresAtUtc: isoOrNull(m.expiresAt),
        })),
      },
      'player.currencies': state.player.wallet,
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
  /** Milliseconds actually replayed (capped). */
  elapsedMs: number;
  /** True when the absence was longer than the cap and progress paused. */
  cappedOut: boolean;
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
    state.city.districts = (cityDto.Districts as DistrictDto[]).map(
      (d): District => ({
        uniqueId: d.UniqueID,
        definitionId: d.DefinitionID as District['definitionId'],
        level: d.Level ?? 1,
        assignedWorkers: d.AssignedWorkers ?? 0,
        location: d.GridLocation,
        state: d.ConstructionState as District['state'],
        visualVariant: d.VisualVariant ?? 1,
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
      }),
    );
    state.city.lastTaxAt = cityDto.LastTaxAt ? ms(cityDto.LastTaxAt) : lastSaved;
    state.city.lastManaAt = cityDto.LastManaAt ? ms(cityDto.LastManaAt) : lastSaved;
    state.city.trainingQueue = ((cityDto.TrainingQueue ?? []) as any[]).map((i) => ({
      uniqueId: i.UniqueID,
      trainee: i.Trainee,
      buildingId: i.BuildingID,
      startedAt: msOrNull(i.StartedAtUtc),
    }));
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
    // Additive: a save written before the chest existed has no Daily block and
    // the defaults below start the ladder at zero, which is exactly right for
    // a player meeting it for the first time. No migrator (Docs/implementation-plan.md §1).
    const daily = kingdomDto.Daily as { LadderStep?: number; LastClaimedDay?: number | null };
    if (daily) {
      state.kingdom.daily.ladderStep = daily.LadderStep ?? 0;
      state.kingdom.daily.lastClaimedDay = daily.LastClaimedDay ?? null;
    }
  }

  const fogDto = modules['kingdom.fogOfWar'];
  if (fogDto) {
    state.fog = { revealed: {}, discovered: {}, progress: {} };
    for (const c of (fogDto.Revealed ?? []) as Coord[]) state.fog.revealed[coordKey(c)] = true;
    for (const c of (fogDto.Discovered ?? []) as Coord[]) state.fog.discovered[coordKey(c)] = true;
    for (const p of (fogDto.Progress ?? []) as { Coord: Coord; Gold: number }[]) {
      state.fog.progress[coordKey(p.Coord)] = p.Gold;
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
      completed: [...((researchDto.Completed ?? []) as TechId[])],
      active: ((researchDto.Active ?? []) as Array<{ ID: TechId; StartedAtUtc: string }>).map(
        (a) => ({ id: a.ID, startedAt: ms(a.StartedAtUtc) })),
      slotsPurchased: researchDto.SlotsPurchased ?? 0,
    };
    state.upgrades = { ...((researchDto.UpgradeLevels ?? {}) as Partial<Record<UpgradeId, number>>) };
  }

  const discoveriesDto = modules['kingdom.discoveries'];
  if (discoveriesDto?.Keys) {
    state.discoveries = {};
    for (const key of discoveriesDto.Keys as string[]) state.discoveries[key] = true;
  }

  const questsDto = modules['kingdom.quests'];
  if (questsDto) {
    state.quests = {
      index: questsDto.Index ?? 0,
      progress: questsDto.Progress ?? 0,
    };
  }

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

  const delvesDto = modules['kingdom.delves'];
  if (delvesDto) {
    state.delves = ((delvesDto.Delves ?? []) as any[]).map((d) => ({
      id: d.ID,
      ruinId: d.RuinID,
      heroId: d.HeroID,
      // A save written before attune-or-arm shipped has no relic aboard, and
      // reads back as a party that carried nothing — which is exactly what it
      // was. Additive, so no migrator; see Docs/implementation-plan.md §1
      artifactId: d.ArtifactID ?? null,
      artifactLevel: d.ArtifactLevel ?? 1,
      party: ((d.Party ?? []) as any[]).map((p) => ({ unitId: p.UnitID, count: p.Count })),
      depth: d.Depth ?? 0,
      partyHp: d.PartyHp ?? 0,
      maxPartyHp: d.MaxPartyHp ?? 0,
      haul: { ...(d.Haul ?? {}) },
      haulFragments: d.HaulFragments ?? 0,
      phase: d.Phase ?? 'checkpoint',
      depthEndsAt: ms(d.DepthEndsAtUtc),
      standingOrder: d.StandingOrder ?? null,
      threat: d.Threat ?? 'Any',
      outcome: d.Outcome ?? null,
    }));
    state.deepestDepth = delvesDto.DeepestDepth ?? 0;
    state.ruinsCleared = {};
    for (const id of (delvesDto.Cleared ?? []) as string[]) {
      state.ruinsCleared[id as keyof typeof state.ruinsCleared] = true;
    }
  }

  const heroesDto = modules['kingdom.heroes'];
  if (heroesDto) {
    state.heroes = {
      owned: [...((heroesDto.Owned ?? state.heroes.owned) as typeof state.heroes.owned)],
      levels: { ...(heroesDto.Levels ?? {}) },
      tiers: { ...(heroesDto.Tiers ?? {}) },
      fragments: { ...(heroesDto.Fragments ?? {}) },
      xp: { ...(heroesDto.Xp ?? {}) },
      partySlotsPurchased: heroesDto.PartySlotsPurchased ?? 0,
    };
  }

  const adsDto = modules['kingdom.adOffers'];
  if (adsDto) {
    state.ads = {
      readyAt: adsDto.ReadyAtUtc ? ms(adsDto.ReadyAtUtc) : lastSaved,
      claims: adsDto.Claims ?? 0,
      pending: adsDto.Pending === true,
    };
  }

  const gachaDto = modules['kingdom.gacha'];
  if (gachaDto) {
    state.gacha = {
      pullCounts: { ...(gachaDto.PullCounts ?? {}) },
      pityCounters: { ...(gachaDto.PityCounters ?? {}) },
    };
  }

  const landmarksDto = modules['kingdom.landmarks'];
  if (landmarksDto) {
    state.landmarks = { claimed: {}, cleared: {} };
    for (const id of (landmarksDto.Claimed ?? []) as string[]) state.landmarks.claimed[id] = true;
    for (const id of (landmarksDto.Cleared ?? []) as string[]) state.landmarks.cleared[id] = true;
  }

  const artifactsDto = modules['kingdom.artifacts'];
  if (artifactsDto) {
    state.artifacts = {
      owned: [...((artifactsDto.Owned ?? []) as ArtifactId[])],
      levels: { ...(artifactsDto.Levels ?? {}) },
      tiers: { ...(artifactsDto.Tiers ?? {}) },
      fragments: { ...(artifactsDto.Fragments ?? {}) },
      attuned: [...((artifactsDto.Attuned ?? [null]) as Array<ArtifactId | null>)],
      slotsPurchased: artifactsDto.SlotsPurchased ?? 0,
      lockedUntil: ((artifactsDto.LockedUntil ?? []) as Array<string | null>)
        .map((v) => msOrNull(v) ?? 0),
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
    }));
  }

  // AFTER the modifier stack is restored: the slot arrays are resized to the
  // CURRENT slot count and the artifact passives are re-derived from what is
  // attuned. So a save written before the Attunement tech completed, or before
  // the passive curve was rebalanced, loads correct rather than stale — while
  // everything that is genuinely stateful (a Haste still running, a season)
  // comes back from the file untouched.
  normaliseSlots(state);

  const playerDto = modules['player.currencies'];
  if (playerDto) state.player.wallet = { ...(playerDto as Wallet) };

  // A save written before the seed existed keeps the fresh one newGame just
  // rolled: its world was generated by the old hash and cannot be reproduced
  // anyway, and nothing observable depends on which number it lands on.
  if (typeof modules['meta.region'] === 'string') {
    state.regionId = modules['meta.region'] as GameState['regionId'];
  }
  if (typeof modules['meta.seed'] === 'number') state.seed = modules['meta.seed'] as number;
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

  // ---- Offline catch-up: replay up to the cap, pause beyond it. -------------
  const capEnd = Math.min(now, lastSaved + OFFLINE_CAP_HOURS * 3_600_000);
  const report = advance(state, map, capEnd);
  if (capEnd < now) {
    const gap = now - capEnd;
    for (const w of state.workers) {
      // A blocked-Idle worker resumes AT `now`: keeping its pre-cap offset
      // (stateStartedAt + gap < now) would let the final advance below fit a
      // whole harvest cycle inside the paused window and over-pay the cap.
      w.stateStartedAt = w.activity === 'Idle' ? now : w.stateStartedAt + gap;
      if (w.stateUntil !== null) w.stateUntil += gap;
    }
    for (const item of state.city.trainingQueue) {
      if (item.startedAt !== null) item.startedAt += gap;
    }
    state.city.lastTaxAt += gap; // taxes pause beyond the cap too
    state.city.lastManaAt += gap; // and so does Mana: it is city production, not a timer
    state.kingdom.lastKnowledgeAt += gap; // the ruin drip is production too
    // Cell recovery and build-queue timers run in real time (NOT paused).
    state.lastAdvance = capEnd;
    // Completes remaining queue work; workers resume at now. Its results are
    // merged in so a build that finished past the cap is still announced.
    const tail = advance(state, map, now);
    report.deposits.push(...tail.deposits);
    report.completedItems.push(...tail.completedItems);
    report.completedResearch.push(...tail.completedResearch);
    report.goldEarned += tail.goldEarned;
    report.trainedPopulation += tail.trainedPopulation;
    report.manaEarned += tail.manaEarned;
    report.knowledgeEarned += tail.knowledgeEarned;
    report.expiredModifiers.push(...tail.expiredModifiers);
    report.trainedUnits.push(...tail.trainedUnits);
    // Delve and schedule events come from the TAIL by design: their timers
    // never paused, so most of what happened past the cap happened here.
    report.delveEvents.push(...tail.delveEvents);
    report.scheduleEvents.push(...tail.scheduleEvents);
  }
  onCatchUp?.({ elapsedMs: capEnd - lastSaved, cappedOut: capEnd < now, result: report });
  return state;
}
