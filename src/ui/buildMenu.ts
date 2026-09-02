// The Build sheet (§5.5).
//
// It was a build-order table: one row per district, the interesting fact
// about each — what it will actually do for you — demoted to 12px grey, and
// the cost quoted "indicatively at distance 0" before changing on the next
// screen, which quietly teaches the player not to trust numbers.
//
// Now a grid of cards, each showing the building's own level-1 art, what it
// promises in plain words, and its cost as chips that turn clay when you are
// short. Tapping a card goes straight to placement — the whole card is the
// target, not a small Select button beside it.

import { CITY_DEF, DISTRICTS } from '../sim/data/definitions';
import { buildCost, buildDuration, districtCount, maxCountForTownhallLevel } from '../sim/districts';
import { isTechComplete } from '../sim/research';
import { spriteUrl } from '../render/sprites';
import { townhall } from '../sim/state';
import type { Game } from '../game';
import { el, formatDuration } from './format';
import { costChips, iconEl, pips, sheet } from './kit';

/** What this building is FOR, in one line — the card's promise. Falls back
 *  to the full description, which is fine but wordier than a card wants. */
const PROMISE: Partial<Record<string, string>> = {
  Housing: 'Villagers live here and pay taxes',
  Farm: 'Workers harvest crops nearby',
  FarmLands: 'A crop plot you can tap for food',
  Sawmill: 'Workers fell the forest around it',
  Market: 'Turn surplus goods into gold',
  Quarry: 'Workers cut stone from nearby rock',
  Docks: 'Boats bring in fish',
  Mine: 'Workers dig iron from nearby veins',
};

export function renderBuildMenu(game: Game): HTMLElement {
  const thLevel = townhall(game.state).level;
  const cards: HTMLElement[] = [];

  for (const id of CITY_DEF.buildMenuOrder) {
    const def = DISTRICTS[id];
    // Tech-locked buildings stay HIDDEN — the tech tree is where they are
    // discovered, and the "More to discover" card below says so.
    if (def.requiredTech !== null && !isTechComplete(game.state, def.requiredTech)) continue;

    const count = districtCount(game.state, id);
    const maxCount = maxCountForTownhallLevel(def, thLevel);
    const capped = count >= maxCount;
    const cost = buildCost(id, count);

    // When capped, say what lifts the cap — in words, not "Townhall lvl 3".
    let blocked: string | null = null;
    if (capped) {
      const nextLevel = def.maxCountPerTownhallLevel.findIndex((n) => n > count) + 1;
      blocked = nextLevel > 0
        ? `Needs Townhall level ${nextLevel}`
        : 'You have as many as the realm allows';
    }

    const art = spriteUrl(`${def.sprite}_l1`);
    const hinted = game.uiHint() === `build:${id}`;
    const card = el('button', {
      class: `bld-card${capped ? ' is-locked' : ''}${hinted ? ' hinted' : ''}`,
      type: 'button',
    },
      el('div', { class: 'bld-art' }, art
        ? el('img', { src: art, alt: '' })
        : iconEl(id, { size: 'lg' })),
      el('div', { class: 'bld-name' }, def.name),
      el('div', { class: 'bld-promise' }, PROMISE[id] ?? def.description),
      el('div', { class: 'bld-cost' }, costChips(cost, (c) => game.walletValue(c))),
      el('div', { class: 'bld-meta' },
        iconEl('hourglass', { size: 'sm' }),
        el('span', {}, formatDuration(buildDuration(id, count, 0))),
        // Owned as filled pips: "2 of 4" without making the player parse a
        // fraction. An unbounded count falls back to the number.
        Number.isFinite(maxCount)
          ? pips(count, maxCount)
          : el('span', {}, `${count} built`)),
    );
    if (capped) {
      card.disabled = true;
      card.append(el('div', { class: 'bld-ribbon' },
        iconEl('padlock', { size: 'sm' }), el('span', {}, blocked!)));
    } else {
      card.addEventListener('click', () => game.startPlacement(id));
    }
    cards.push(card);
  }

  // The menu silently grows as techs land and the player never learns why.
  const discover = el('button', { class: 'bld-card bld-more', type: 'button' },
    el('div', { class: 'bld-art' }, iconEl('unknown', { size: 'lg' })),
    el('div', { class: 'bld-name' }, 'More to discover'),
    el('div', { class: 'bld-promise' }, 'New buildings come from research'));
  discover.addEventListener('click', () => game.setOverlay('research'));
  cards.push(discover);

  return sheet(
    { title: 'Build', onClose: () => game.dismiss() },
    el('div', { class: 'bld-grid' }, ...cards),
  );
}
