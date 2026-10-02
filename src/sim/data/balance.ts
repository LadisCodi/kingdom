// Every balance number in the game, as the sim has always read it.
//
// The numbers live one file per collection in `game/`, authored in the data
// editor (`?dev=data`, Docs/plans/data-editor.md), and each collection's
// schema — what its fields are and what is legal — in `schema/`. This module
// only puts them back together in the one shape `definitions.ts` and the rule
// modules read, so nothing downstream knows where they came from.
//
// A new collection is a new game element: its file, its line here, its entry
// in `COLLECTIONS` (dataRules.ts) and the code that reads it ship together.

import terrain from './game/terrain.json';
import harvest from './game/harvest.json';
import garrisons from './game/garrisons.json';
import exploration from './game/exploration.json';
import buildings from './game/buildings.json';
import goods from './game/goods.json';
import adjacency from './game/adjacency.json';
import economy from './game/economy.json';
import units from './game/units.json';
import heroes from './game/heroes.json';
import villains from './game/villains.json';
import combat from './game/combat.json';
import artifacts from './game/artifacts.json';
import currencies from './game/currencies.json';
import relics from './game/relics.json';
import quests from './game/quests.json';
import pass from './game/pass.json';
import survey from './game/survey.json';
import missions from './game/missions.json';
import collection from './game/collection.json';
import store from './game/store.json';
import packs from './game/packs.json';
import banners from './game/banners.json';
import monetization from './game/monetization.json';
import scenes from './game/scenes.json';
import speakers from './game/speakers.json';
import tutorial from './game/tutorial.json';
import unlocks from './game/unlocks.json';

const balance = {
  "terrain": terrain,
  "harvest": harvest,
  "garrisons": garrisons,
  ...exploration,
  "districts": buildings,
  "goods": goods,
  "adjacency": adjacency,
  ...economy,
  "units": units,
  "heroes": heroes,
  "villains": villains,
  ...combat,
  "artifacts": artifacts,
  "currencies": currencies,
  ...relics,
  "quests": quests,
  ...pass,
  ...survey,
  ...missions,
  ...collection,
  "store": store,
  "packs": packs,
  "banners": banners,
  ...monetization,
  "scenes": scenes,
  "speakers": speakers,
  ...tutorial,
  "unlocks": unlocks,
};

export default balance;
