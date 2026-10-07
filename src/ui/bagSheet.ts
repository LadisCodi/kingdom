// The Bag (Docs/art/ui-inventory.md §3, mockup M69): items held until they
// are used.
//
// Tabs over a grid of square tiles, four a row. A tap on a tile opens its
// popover INSIDE the grid, under that tile's row, pushing the rows below
// down; a second tap closes it. The popover says what one is worth NOW — a
// chest is a duration of the city's own production, so the tile shows the
// duration and only the popover turns it into money.
//
// The slider is local to the DOM while it moves: a rebuild under a finger
// drops the drag, so it writes the chosen count to the presenter without a
// notify and only the Use button commits it.

import type { BagScreen, Game } from '../game';
import { BAG_TABS, CHEST_COINS, type BagTab } from '../sim/bag';
import { ITEMS } from '../sim/data/definitions';
import type { CurrencyId, Wallet } from '../sim/state';
import { el, formatDuration, formatExact } from './format';
import { btn, ctaBadge, currencyIcon, iconEl, knob, sheet } from './kit';
import { relicTab } from './relicSheet';
import { BOOST_ICON, tileArt } from './itemArt';
import { BOOST_WHAT, chestCoin, itemLine, itemName, sizeLabel } from './itemText';

const COLUMNS = 4;

/** What an empty tab says: where its items turn up. */
const EMPTY_LINE: Record<BagTab, string> = {
  Resources: 'Chests turn up in the fog and in quests',
  'Speed ups': 'Speed-ups turn up in lairs and quests',
  Boosts: 'Boosts turn up in quests, lairs and the Survey',
  Relics: 'Relic fragments turn up in lairs and in the fog',
  Other: 'Keys and flasks turn up as rewards',
};

function tabRow(game: Game, view: BagScreen): HTMLElement {
  return el('div', { class: 'bag-tabs', role: 'tablist' }, ...BAG_TABS.map((tab) => {
    const info = view.tabs.find((t) => t.tab === tab)!;
    const open = tab === view.tab;
    const b = el('button', {
      class: `bld-tab bag-tab${open ? ' is-open' : ''}${info.any ? '' : ' is-empty'}`,
      type: 'button',
      role: 'tab',
      'aria-selected': open ? 'true' : 'false',
    },
      el('span', { class: 'bld-tab-label' }, tab),
      ...(info.fresh ? [ctaBadge(1, `bag-tab:${tab}`)] : []),
    );
    b.addEventListener('click', () => game.openBagTab(tab));
    return b;
  }));
}

function tile(game: Game, item: BagScreen['items'][number], picked: boolean): HTMLElement {
  const b = el('button', {
    class: `bag-tile is-tier-${item.def.tier}${picked ? ' is-picked' : ''}`,
    type: 'button',
    'aria-label': `${itemName(item.def)}, ${formatExact(item.count)}`,
    'aria-expanded': picked ? 'true' : 'false',
    'data-coach': `bag-item:${item.id}`,
  },
    ...tileArt(item.id, sizeLabel(item.def)),
    el('span', { class: 'bag-tile-count' }, formatExact(item.count)),
    ...(item.fresh ? [el('span', { class: 'bag-tile-new' }, iconEl('sparkle', { size: 'sm' }))] : []),
  );
  b.addEventListener('click', () => game.pickBagItem(item.id));
  return b;
}

/** The quantity row and its total: − trough + · the number · max. */
function quantity(game: Game, item: BagScreen['items'][number], onChange: (n: number) => void): HTMLElement {
  const max = item.count;
  const slider = el('input', {
    class: 'bag-slider', type: 'range', min: '1', max: String(max), step: '1',
    value: String(Math.min(game.bagQty, max)), 'aria-label': 'How many',
  });
  const field = el('span', { class: 'bag-qty' }, formatExact(Number(slider.value)));
  const set = (n: number): void => {
    const v = Math.max(1, Math.min(max, n));
    slider.value = String(v);
    field.textContent = formatExact(v);
    onChange(v);
  };
  slider.addEventListener('input', () => set(Number(slider.value)));
  return el('div', { class: 'bag-qty-row' },
    knob('−', () => set(Number(slider.value) - 1), { label: 'One fewer' }),
    slider,
    knob('+', () => set(Number(slider.value) + 1), { label: 'One more' }),
    field,
    btn({ label: 'Max', onClick: () => set(max) }),
  );
}

function popover(game: Game, item: BagScreen['items'][number], column: number): HTMLElement {
  // A key is spent on its banner's call, in the store (§3.10).
  if (item.def.kind === 'key') {
    return el('div', { class: 'bag-pop', style: `--notch-col: ${column}` },
      el('div', { class: 'bag-pop-name' }, itemName(item.def)),
      el('div', { class: 'bag-pop-line' }, itemLine(item.def, item.worth)),
      el('div', { class: 'bag-use' }, btn({ label: 'Use', kind: 'primary', onClick: () => game.openStore('supplies') })));
  }
  // A speed-up is spent from a timer, so its popover goes to one (§3.5).
  if (item.def.kind === 'speedup') {
    const job = game.firstJobFor(item.id);
    return el('div', { class: 'bag-pop', style: `--notch-col: ${column}` },
      el('div', { class: 'bag-pop-name' }, itemName(item.def)),
      el('div', { class: 'bag-pop-line' }, itemLine(item.def, item.worth)),
      job === null
        ? el('div', { class: 'bag-pop-line' }, 'Nothing of this kind is running')
        : el('div', { class: 'bag-use' }, btn({ label: 'Speed up a timer', onClick: () => game.openSpeedup(job) })));
  }
  const isChoice = item.def.kind === 'choice';
  const worth = isChoice ? game.choiceWorth(item.id) : item.worth;
  const coin = isChoice ? [game.bagChoice, worth[game.bagChoice] ?? 0] as [CurrencyId, number] : chestCoin(worth);
  const total = el('div', { class: 'bag-total' });
  const use = el('div', { class: 'bag-use', 'data-coach': 'bag-use' });
  const draw = (n: number): void => {
    game.bagQty = n;
    if (coin !== null) {
      total.replaceChildren(
        `×${formatExact(n)} → ${formatExact(coin[1] * n)} `, currencyIcon(coin[0], { size: 'sm' }));
    }
    use.replaceChildren(btn({
      label: `${isChoice ? 'Open' : 'Use'}${n > 1 ? ` ×${formatExact(n)}` : ''}`,
      kind: 'primary',
      onClick: () => game.doUseItem(item.id, n),
    }));
  };
  const n = Math.max(1, Math.min(game.bagQty, item.count));
  const running = item.def.kind === 'boost' && item.def.boost !== null
    && game.bagBoosts().some((b) => b.kind === item.def.boost);
  const node = el('div', { class: 'bag-pop', style: `--notch-col: ${column}` },
    el('div', { class: 'bag-pop-name' }, itemName(item.def)),
    el('div', { class: 'bag-pop-line' }, itemLine(item.def, item.worth)),
    ...(running ? [el('div', { class: 'bag-pop-line' }, 'Extends the running one')] : []),
    ...(isChoice ? [choicePlates(game, worth)] : []),
    ...(item.count > 1 ? [quantity(game, item, draw), total] : []),
    use,
  );
  draw(n);
  return node;
}

/** The choice chest's four coins, each with what it would give now; the
 *  picked one wears the gold rim (§3.8). */
function choicePlates(game: Game, worth: Wallet): HTMLElement {
  return el('div', { class: 'bag-choice', role: 'radiogroup' }, ...CHEST_COINS.map((c) => {
    const b = el('button', {
      class: `bag-choice-plate${c === game.bagChoice ? ' is-picked' : ''}`, type: 'button', role: 'radio',
      'aria-checked': c === game.bagChoice ? 'true' : 'false',
    }, currencyIcon(c, { size: 'lg' }), el('span', { class: 'bag-choice-amount' }, formatExact(worth[c] ?? 0)));
    b.addEventListener('click', () => game.pickBagChoice(c));
    return b;
  }));
}

/** The boosts running, as ribbons over the Boosts grid (§3.10). */
function boostRibbons(game: Game): HTMLElement[] {
  const now = game.now();
  return game.bagBoosts().map((b) => el('div', { class: 'bag-ribbon' },
    iconEl(BOOST_ICON[b.kind], { size: 'sm' }),
    el('span', {}, `${BOOST_WHAT[b.kind]} +${formatExact(b.value)}%`),
    el('span', { class: 'bag-ribbon-left' }, formatDuration(Math.ceil((b.endsAt - now) / 1000)))));
}

/** What the Bag reads, so the host rebuilds it only when that moves. The
 *  slider's count is not in it: the slider owns its own redraw. */
export function bagSignature(game: Game): string {
  const view = game.bagScreen();
  // A picked speed-up's popover says whether anything of its kind runs.
  const job = view.picked !== null && ITEMS[view.picked].kind === 'speedup' ? game.firstJobFor(view.picked) : null;
  // A boost's ribbon counts down: by the minute, or the second in its last.
  const now = game.now();
  const boosts = view.tab === 'Boosts' ? game.bagBoosts().map((b) => {
    const s = Math.ceil((b.endsAt - now) / 1000);
    return [b.kind, b.value, s < 60 ? s : Math.ceil(s / 60)];
  }) : [];
  const relics = view.tab === 'Relics' ? game.relicRows() : [];
  return JSON.stringify([view, job, boosts, game.bagChoice, relics.map((r) => [r.id, r.level, r.slots, r.canRestore])]);
}

export function renderBagSheet(game: Game): HTMLElement {
  const view = game.bagScreen();
  // The Relics tab holds no items: the relics met, and their fragments.
  if (view.tab === 'Relics') {
    return panes(sheet({ title: 'Bag', onClose: () => game.dismiss(), tall: true },
      tabRow(game, view), pane(...relicTab(game))));
  }
  const grid = el('div', { class: 'bag-grid' });
  if (view.items.length === 0) {
    grid.classList.add('is-empty');
    grid.append(el('p', { class: 'bag-empty' }, EMPTY_LINE[view.tab]));
  } else {
    const at = view.items.findIndex((i) => i.id === view.picked);
    // The popover goes after the LAST tile of the picked one's row.
    const rowEnd = at < 0 ? -1 : Math.min(view.items.length - 1, (Math.floor(at / COLUMNS) + 1) * COLUMNS - 1);
    view.items.forEach((item, i) => {
      grid.append(tile(game, item, item.id === view.picked));
      if (i === rowEnd) grid.append(popover(game, view.items[at], (at % COLUMNS) + 1));
    });
  }
  return panes(sheet({ title: 'Bag', onClose: () => game.dismiss(), tall: true },
    tabRow(game, view), pane(...(view.tab === 'Boosts' ? boostRibbons(game) : []), grid)));
}

/** The Bag takes the whole screen however little it holds (`is-panes`):
 *  the tabs stay put and only what is under them scrolls. */
function panes(surface: HTMLElement): HTMLElement {
  surface.classList.add('is-panes');
  return surface;
}

const pane = (...children: Node[]): HTMLElement =>
  el('div', { class: 'bag-pane', 'data-keep-scroll': 'bag-pane' }, ...children);
