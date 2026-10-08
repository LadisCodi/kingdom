// The Spanish catalog: English → Spanish, one file per area of the game so
// two people translating two menus never touch one file. A key in two files
// is refused by tests/i18n.test.ts.

import common from './es/common.json';
import city from './es/city.json';
import world from './es/world.json';
import heroes from './es/heroes.json';
import store from './es/store.json';
import social from './es/social.json';
import notices from './es/notices.json';
import research from './es/research.json';
import game from './es/game.json';
import sim from './es/sim.json';
import render from './es/render.json';
// Keys more than one area says, moved here when the areas were merged.
import shared from './es/shared.json';

export const ES_FILES: Record<string, Record<string, string>> = { common, city, world, heroes, store, social, notices, research, game, sim, render, shared };

export const ES: Record<string, string> = { ...common, ...city, ...world, ...heroes, ...store, ...social, ...notices, ...research, ...game, ...sim, ...render, ...shared };
