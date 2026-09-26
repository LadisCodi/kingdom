// What a building's card promises. DOM-free on purpose, like
// `kit/atlas.generated.ts`: `tests/buildPromise.test.ts` imports it under
// node to hold every line to the budget, and `buildMenu.ts` cannot be
// imported there — it reaches for the document.

import type { DistrictId } from '../sim/state';

/**
 * WHAT THE CARD PROMISES — one line, present tense, what it does for you.
 *
 * Not `def.description`, which this used to fall back to: that is the long
 * form the district card and the upgrade sheet show, where 91 characters read
 * fine. The build card holds about 42, so the fallback was a paragraph cut
 * off mid-word on thirteen of the twenty-three buildings.
 *
 * So there is no fallback any more — EVERY district has a line here, and
 * `tests/buildMenu.test.ts` keeps it that way and keeps them inside the
 * budget. A building that gains a level, a crew or a recipe keeps its
 * promise; only what it DOES for the player changes it.
 *
 * The decorations say what they are and stop. What they do — the Harmony they
 * supply — is the chip beside the price, so a line repeating the number would
 * be the card saying it twice.
 */
export const PROMISE: Record<DistrictId, string> = {
  Townhall: 'Trains new villagers',
  Housing: 'Villagers live here and pay taxes',
  Farm: 'Workers harvest crops nearby',
  FarmLands: 'A crop plot you can tap for food',
  Sawmill: 'Workers fell the forest around it',
  Quarry: 'Workers cut stone from nearby rock',
  Docks: 'Boats bring in fish',
  Sanctum: 'Holds more Mana while you are away',

  Carpenter: 'Villagers work Wood into Planks',
  MasonsYard: 'Villagers dress Stone into blocks',
  Smelter: 'Villagers smelt ore into Iron',
  RuneCarver: 'Villagers pour Mana into cut stone',

  Barracks: 'Trains soldiers and raises the army cap',
  SpearHall: 'Trains Lancers, who stop a charge',
  ShootingGrounds: 'Trains Archers, all attack and no armour',
  Stables: 'Trains Cavalry, fast and expensive',
  Infirmary: 'Mends wounded soldiers cheaply',

  Garden: 'Beds of flowers',
  Well: 'Cobbled stone and a bucket',
  Orchard: 'Two rows of fruit trees',
  Statue: 'A crowned figure in pale stone',
  Plaza: 'A paved square for market day',
  Shrine: 'A round temple cut through with runes',
};

/** What the build card can show without cutting a word in half. Measured:
 *  three lines of about fourteen characters in the 87px the text column has
 *  at 426, which is the phone the mockups were drawn for. */
export const PROMISE_MAX = 42;
