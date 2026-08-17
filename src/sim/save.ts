// Save format (Docs/10): {LastSaved, GameVersion, Modules: {kingdom.* ...}}.
// Rates are never saved — only LastProduction timestamps + vault balances; the
// production recalc rebuilds rates after load, which is what makes offline
// income work. Deliberate deltas vs Unity (per plan): Gems live in a
// `player.currencies` module, and `kingdom.features` persists feature
// replacement + tap durability (reachable now that Trees have a yield).

import { GAME_VERSION } from './data/definitions';
import type { MapData } from './grid';
import { newGame } from './newGame';
import { recalculateCityProduction } from './recalc';
import { dropOfflineExpiredSpells } from './spells';
import {
  coordKey, parseCoordKey,
  type ActiveSpell, type Coord, type CurrencyId, type District, type FeatureCell,
  type GameState, type Generator, type QueueItem, type Rng, type SpellId, type Wallet,
} from './state';

const iso = (ms: number): string => new Date(ms).toISOString();
const ms = (isoDate: string): number => Date.parse(isoDate);

interface GeneratorDto {
  UniqueID: string;
  CurrencyID: string;
  LastProduction: string;
  VaultStored: number;
  VaultCapacity: number;
}
interface DistrictDto {
  UniqueID: string;
  DefinitionID: string;
  VisualVariant: number;
  AssignedWorkers: number;
  Level: number;
  GridLocation: Coord;
  ConstructionState: string;
  Generators: GeneratorDto[];
}
interface QueueItemDto {
  UniqueID: string;
  DistrictID: string;
  DurationSeconds: number;
  StartedAtUtc: string | null;
  TargetLevel?: number;
}

export interface SaveFile {
  LastSaved: string;
  GameVersion: string;
  Modules: Record<string, unknown>;
}

const genToDto = (g: Generator): GeneratorDto => ({
  UniqueID: g.id,
  CurrencyID: g.currencyId,
  LastProduction: iso(g.lastProduction),
  VaultStored: g.vaultStored,
  VaultCapacity: g.vaultCapacity,
});
const genFromDto = (d: GeneratorDto): Generator => ({
  id: d.UniqueID,
  currencyId: d.CurrencyID as CurrencyId,
  modifiers: [], // rates are rebuilt by the recalc after load
  lastProduction: ms(d.LastProduction),
  vaultStored: d.VaultStored,
  vaultCapacity: d.VaultCapacity,
});

export function serialize(state: GameState, now: number): SaveFile {
  return {
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
                Generators: d.generators.map(genToDto),
              }),
            ),
            BuildQueueItems: state.city.queue
              .filter((q) => q.kind === 'build')
              .map((q): QueueItemDto => ({
                UniqueID: q.uniqueId,
                DistrictID: q.districtUniqueId,
                DurationSeconds: q.durationSeconds,
                StartedAtUtc: q.startedAt === null ? null : iso(q.startedAt),
              })),
            UpgradeQueueItems: state.city.queue
              .filter((q) => q.kind === 'upgrade')
              .map((q): QueueItemDto => ({
                UniqueID: q.uniqueId,
                DistrictID: q.districtUniqueId,
                DurationSeconds: q.durationSeconds,
                StartedAtUtc: q.startedAt === null ? null : iso(q.startedAt),
                TargetLevel: q.targetLevel,
              })),
            QueueOrder: state.city.queue.map((q) => q.uniqueId),
          },
        ],
      },
      'kingdom.kingdoms': {
        MaxBuilders: state.kingdom.maxBuilders,
        Currencies: state.kingdom.wallet,
        Generators: state.kingdom.generators.map(genToDto),
      },
      'kingdom.spells': Object.fromEntries(
        Object.entries(state.spellbook).map(([id, s]) => [
          id, { IsUnlocked: s.unlocked, Level: s.level },
        ]),
      ),
      'kingdom.activeSpells': {
        Casts: state.activeSpells.map((s) => ({
          SpellID: s.spellId,
          TargetCell: s.cell,
          Level: s.level,
          Magnitude: s.magnitude,
          ExpiresAt: iso(s.expiresAt),
          SourceID: s.sourceId,
        })),
      },
      'kingdom.fogOfWar': {
        Revealed: Object.keys(state.fog.revealed).map(parseCoordKey),
        Progress: Object.entries(state.fog.progress).map(([k, silver]) => ({
          Coord: parseCoordKey(k),
          Silver: silver,
        })),
      },
      'kingdom.army': {
        Units: state.army.map((u) => ({ UniqueID: u.uniqueId, DefinitionID: u.definitionId })),
      },
      'kingdom.features': {
        Cells: Object.entries(state.features).map(([k, f]) => ({
          Coord: parseCoordKey(k),
          FeatureID: f.featureId,
          Taps: f.taps,
          Threshold: f.threshold,
        })),
      },
      'player.currencies': state.player.wallet,
      'meta.nextId': state.nextId,
    },
  };
}

/**
 * Rebuild a GameState from a save. Follows the load order from Docs/10:
 * restore entities → re-derive rates via recalc → drop offline-expired spells
 * WITHOUT their removal effects → re-apply still-active spell modifiers.
 * The caller must not tick before this returns (rates are stale until recalc).
 */
export function deserialize(save: SaveFile, map: MapData, now: number, rng: Rng): GameState {
  // Start from a fresh state so definitions/initial features are in place,
  // then overwrite everything the save owns.
  const state = newGame(map, now, rng);
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
        generators: (d.Generators ?? []).map(genFromDto),
      }),
    );
    const builds = ((cityDto.BuildQueueItems ?? []) as QueueItemDto[]).map(
      (q): QueueItem => ({
        uniqueId: q.UniqueID,
        kind: 'build',
        districtUniqueId: q.DistrictID,
        durationSeconds: q.DurationSeconds,
        startedAt: q.StartedAtUtc === null ? null : ms(q.StartedAtUtc),
      }),
    );
    const upgrades = ((cityDto.UpgradeQueueItems ?? []) as QueueItemDto[]).map(
      (q): QueueItem => ({
        uniqueId: q.UniqueID,
        kind: 'upgrade',
        districtUniqueId: q.DistrictID,
        targetLevel: q.TargetLevel,
        durationSeconds: q.DurationSeconds,
        startedAt: q.StartedAtUtc === null ? null : ms(q.StartedAtUtc),
      }),
    );
    const all = [...builds, ...upgrades];
    const order = (cityDto.QueueOrder ?? []) as string[];
    state.city.queue = all.sort(
      (a, b) => order.indexOf(a.uniqueId) - order.indexOf(b.uniqueId),
    );
  }

  const kingdomDto = modules['kingdom.kingdoms'];
  if (kingdomDto) {
    state.kingdom.maxBuilders = kingdomDto.MaxBuilders ?? state.kingdom.maxBuilders;
    state.kingdom.wallet = { ...(kingdomDto.Currencies as Wallet) };
    if (kingdomDto.Generators) {
      state.kingdom.generators = (kingdomDto.Generators as GeneratorDto[]).map(genFromDto);
      // Kingdom rates come from the definition, not the save.
      for (const gen of state.kingdom.generators) {
        gen.modifiers = [
          { category: 'Building', source: 'kingdom', kind: 'Flat', value: 300 / 60 },
        ];
      }
    }
  }

  const spellsDto = modules['kingdom.spells'];
  if (spellsDto) {
    for (const [id, s] of Object.entries(spellsDto as Record<string, any>)) {
      state.spellbook[id] = { unlocked: !!s.IsUnlocked, level: s.Level ?? 1 };
    }
  }

  const activeDto = modules['kingdom.activeSpells']?.Casts;
  if (activeDto) {
    state.activeSpells = (activeDto as any[]).map(
      (s): ActiveSpell => ({
        spellId: s.SpellID as SpellId,
        cell: s.TargetCell,
        level: s.Level,
        magnitude: s.Magnitude,
        expiresAt: ms(s.ExpiresAt),
        sourceId: s.SourceID ?? `spell_restored_${s.SpellID}`,
      }),
    );
  }

  const fogDto = modules['kingdom.fogOfWar'];
  if (fogDto) {
    state.fog = { revealed: {}, progress: {} };
    for (const c of (fogDto.Revealed ?? []) as Coord[]) state.fog.revealed[coordKey(c)] = true;
    for (const p of (fogDto.Progress ?? []) as { Coord: Coord; Silver: number }[]) {
      state.fog.progress[coordKey(p.Coord)] = p.Silver;
    }
  }

  const armyDto = modules['kingdom.army']?.Units;
  if (armyDto) {
    state.army = (armyDto as any[]).map((u) => ({
      uniqueId: u.UniqueID,
      definitionId: u.DefinitionID,
    }));
  }

  const featuresDto = modules['kingdom.features']?.Cells;
  if (featuresDto) {
    state.features = {};
    for (const f of featuresDto as any[]) {
      state.features[coordKey(f.Coord)] = {
        featureId: f.FeatureID,
        taps: f.Taps ?? 0,
        threshold: f.Threshold ?? 0,
      } satisfies FeatureCell;
    }
  }

  const playerDto = modules['player.currencies'];
  if (playerDto) state.player.wallet = { ...(playerDto as Wallet) };

  state.nextId = Math.max(state.nextId, (modules['meta.nextId'] as number) ?? 1);

  // Casts that expired while away are dropped WITHOUT running removal effects
  // (an offline-expired Rain does not regrow its forest).
  dropOfflineExpiredSpells(state, now);

  // Rebuild rates (recalc preserves only Spell modifiers — of which restored
  // generators have none), then re-apply still-active Rain boosts.
  recalculateCityProduction(state, map, now, rng);
  for (const spell of state.activeSpells) {
    if (spell.spellId !== 'Rain') continue;
    const district = state.city.districts.find(
      (d) => d.location.x === spell.cell.x && d.location.y === spell.cell.y,
    );
    const gen = district?.generators.find((g) => g.currencyId === 'Food');
    gen?.modifiers.push({
      category: 'Spell', source: spell.sourceId, kind: 'Percentage', value: spell.magnitude - 1,
    });
  }
  return state;
}
