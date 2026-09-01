// Save format v2 (harvest loop). v1 saves (the generator/vault era) are
// discarded — deserialize returns null and the caller starts a fresh game.
// Offline catch-up: the unified advance replays the absence up to the 8h cap;
// time beyond the cap pauses workers/townhall (queue timers and cell
// recovery keep running in real time).

import { GAME_VERSION, OFFLINE_CAP_HOURS, SAVE_VERSION } from './data/definitions';
import { advance } from './commands';
import type { MapData } from './grid';
import { newGame } from './newGame';
import {
  coordKey, parseCoordKey,
  type Coord, type District, type GameState, type QueueItem,
  type TechId, type UpgradeId, type Wallet, type Worker,
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
  Carrying: boolean;
  StateStartedAt: string;
  StateUntil: string | null;
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
            TrainingStartedAt: state.city.training === null
              ? null : iso(state.city.training.startedAt),
            TrainingQueued: state.city.training?.queued ?? 0,
            LastTaxAt: iso(state.city.lastTaxAt),
          },
        ],
      },
      'kingdom.kingdoms': {
        MaxBuilders: state.kingdom.maxBuilders,
        Currencies: state.kingdom.wallet,
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
          .filter(([, s]) => s.taps > 0 || s.exhaustedUntil !== null)
          .map(([k, s]) => ({
            Coord: parseCoordKey(k),
            Taps: s.taps,
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
      'player.currencies': state.player.wallet,
      'meta.nextId': state.nextId,
    },
  };
}

/**
 * Rebuild a GameState from a v2 save and replay the absence (capped at 8h).
 * Returns null for incompatible (v1) saves — caller starts a fresh game.
 */
export function deserialize(save: SaveFile, map: MapData, now: number): GameState | null {
  if ((save.SaveVersion ?? 1) !== SAVE_VERSION) return null;
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
    state.city.training = cityDto.TrainingStartedAt
      ? { queued: cityDto.TrainingQueued ?? 1, startedAt: ms(cityDto.TrainingStartedAt) } : null;
    state.city.lastTaxAt = cityDto.LastTaxAt ? ms(cityDto.LastTaxAt) : lastSaved;
  }

  const kingdomDto = modules['kingdom.kingdoms'];
  if (kingdomDto) {
    state.kingdom.maxBuilders = kingdomDto.MaxBuilders ?? state.kingdom.maxBuilders;
    state.kingdom.wallet = { ...(kingdomDto.Currencies as Wallet) };
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
      state.harvest[coordKey(c.Coord)] = {
        taps: c.Taps ?? 0,
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
        carrying: !!w.Carrying,
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

  const playerDto = modules['player.currencies'];
  if (playerDto) state.player.wallet = { ...(playerDto as Wallet) };

  state.nextId = Math.max(state.nextId, (modules['meta.nextId'] as number) ?? 1);
  state.lastAdvance = lastSaved;

  // ---- Offline catch-up: replay up to the cap, pause beyond it. -------------
  const capEnd = Math.min(now, lastSaved + OFFLINE_CAP_HOURS * 3_600_000);
  advance(state, map, capEnd);
  if (capEnd < now) {
    const gap = now - capEnd;
    for (const w of state.workers) {
      // A blocked-Idle worker resumes AT `now`: keeping its pre-cap offset
      // (stateStartedAt + gap < now) would let the final advance below fit a
      // whole harvest cycle inside the paused window and over-pay the cap.
      w.stateStartedAt = w.activity === 'Idle' ? now : w.stateStartedAt + gap;
      if (w.stateUntil !== null) w.stateUntil += gap;
    }
    if (state.city.training) state.city.training.startedAt += gap;
    state.city.lastTaxAt += gap; // taxes pause beyond the cap too
    // Cell recovery and build-queue timers run in real time (NOT paused).
    state.lastAdvance = capEnd;
    advance(state, map, now); // completes remaining queue work; workers resume at now
  }
  return state;
}
