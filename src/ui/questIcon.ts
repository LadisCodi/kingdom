// The mark on the quest scroll's slot: WHAT the quest is about, in the kit's
// own icon — the coin it collects, the building it raises, the book it reads
// — so the card reads at a glance before its words do (mockup M1).
//
// DOM-free, so tests/questIcon.test.ts can hold every quest in the chain to
// a cell the atlas really has.

import type { QuestDef } from '../sim/data/definitions';
import type { CurrencyId, DistrictId, FeatureId, LandmarkKind } from '../sim/state';
import type { IconName } from './kit/icon';

/** A group of buildings (`AnyDecoration`) by what the group is for. */
const GROUP_ICONS: Readonly<Record<string, IconName>> = {
  AnyDecoration: 'harmony',
  AnyProducer: 'build',
  AnyHall: 'army',
  AnyWorkshop: 'anvil',
};

/** A feature by what tapping it pays, except a tree, which is a tree. */
const FEATURE_ICONS: Readonly<Record<FeatureId, IconName>> = {
  Trees: 'tree',
  BerryBush: 'Berries',
  WildAnimals: 'Meat',
  FishShoal: 'Fish',
  Mountain: 'Stone',
  MountainIron: 'Iron',
  MountainGold: 'Gold',
  Crops: 'FarmLands',
};

const LANDMARK_ICONS: Readonly<Record<LandmarkKind, IconName>> = {
  StandingStones: 'landmark',
  Leyspring: 'Mana',
  Watchtower: 'Watchtower',
};

const district = (target: string | null): IconName =>
  target === null ? 'build' : GROUP_ICONS[target] ?? (target as DistrictId);

export const goalIcon = (quest: QuestDef): IconName => {
  const target = quest.goalTarget;
  switch (quest.goalType) {
    case 'CollectResource': case 'HoldResource':
      return (target as CurrencyId | null) ?? 'quest';
    case 'BuildDistrict': case 'RepairDistrict': case 'UpgradeDistrict': case 'WorkInReach':
      return district(target);
    case 'CompleteTech': case 'CompleteTechs': return 'research';
    case 'ReachPopulation': return 'population';
    case 'AssignWorkers': return 'workers';
    case 'TrainArmy': return 'army';
    case 'CollectTaps': return 'showme';
    case 'DiscoverCells': return 'tile';
    case 'DiscoverFeature': return target === null ? 'compass' : FEATURE_ICONS[target as FeatureId] ?? 'compass';
    case 'FindLairs': return 'dungeon';
    case 'ClearLairs': return 'power';
    case 'ClaimLandmarks':
      return target === null ? 'landmark' : LANDMARK_ICONS[target as LandmarkKind] ?? 'landmark';
    case 'OwnArtifacts': return 'relics';
    case 'OwnHeroes': return 'helmet';
  }
};
