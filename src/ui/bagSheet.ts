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
import { BAG_TABS, type BagTab } from '../sim/bag';
import type { ItemDef } from '../sim/data/definitions';
import type { CurrencyId, Wallet } from '../sim/state';
import { el, formatDuration, formatExact } from './format';
import { btn, currencyIcon, iconEl, knob, sheet } from './kit';

const COLUMNS = 4;

/** What an empty tab says: where its items turn up. */
const EMPTY_LINE: Record<BagTab, string> = {
  Resources: 'Chests turn up in the fog and in quests',
  'Speed ups': 'Speed-ups turn up in lairs and quests',
  Boosts: 'Boosts turn up on the season pass',
  Other: 'Keys and flasks turn up as rewards',
};

/** The size printed at the top of a tile: "10m", "1h", "8h". */
const sizeLabel = (def: ItemDef): string => formatDuration(def.seconds);

/** The one coin a chest pays, and how much of it. */
const chestCoin = (worth: Wallet): [CurrencyId, number] | null => {
  const entry = (Object.entries(worth) as Array<[CurrencyId, number]>)[0];
  return entry ?? null;
};

/** What the Bag calls an item in its popover: "1h Wood chest". */
const itemName = (def: ItemDef): string => `${sizeLabel(def)} ${def.name}`;

/** The popover's one line: what one is worth now. */
const itemLine = (def: ItemDef, worth: Wallet): string => {
  const coin = chestCoin(worth);
  if (def.kind === 'chest' && coin !== null) {
    return `${formatDuration(def.seconds)} of ${coin[0]} — ${formatExact(coin[1])} now`;
  }
  return '';
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
      ...(info.fresh ? [el('span', { class: 'bag-dot', 'aria-label': 'New' })] : []),
    );
    b.addEventListener('click', () => game.openBagTab(tab));
    return b;
  }));
}

function tile(game: Game, item: BagScreen['items'][number], picked: boolean): HTMLElement {
  const coin = chestCoin(item.worth);
  const b = el('button', {
    class: `bag-tile is-tier-${item.def.tier}${picked ? ' is-picked' : ''}`,
    type: 'button',
    'aria-label': `${itemName(item.def)}, ${formatExact(item.count)}`,
    'aria-expanded': picked ? 'true' : 'false',
  },
    el('span', { class: 'bag-tile-size' }, sizeLabel(item.def)),
    coin !== null ? currencyIcon(coin[0], { size: 'lg' }) : iconEl('chest', { size: 'lg' }),
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
  const coin = chestCoin(item.worth);
  const total = el('div', { class: 'bag-total' });
  const use = el('div', { class: 'bag-use' });
  const draw = (n: number): void => {
    game.bagQty = n;
    if (coin !== null) {
      total.replaceChildren(
        `×${formatExact(n)} → ${formatExact(coin[1] * n)} `, currencyIcon(coin[0], { size: 'sm' }));
    }
    use.replaceChildren(btn({
      label: n > 1 ? `Use ×${formatExact(n)}` : 'Use',
      kind: 'primary',
      onClick: () => game.doUseItem(item.id, n),
    }));
  };
  const n = Math.max(1, Math.min(game.bagQty, item.count));
  const node = el('div', { class: 'bag-pop', style: `--notch-col: ${column}` },
    el('div', { class: 'bag-pop-name' }, itemName(item.def)),
    el('div', { class: 'bag-pop-line' }, itemLine(item.def, item.worth)),
    ...(item.count > 1 ? [quantity(game, item, draw), total] : []),
    use,
  );
  draw(n);
  return node;
}

/** What the Bag reads, so the host rebuilds it only when that moves. The
 *  slider's count is not in it: the slider owns its own redraw. */
export function bagSignature(game: Game): string {
  return JSON.stringify(game.bagScreen());
}

export function renderBagSheet(game: Game): HTMLElement {
  const view = game.bagScreen();
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
  return sheet({ title: 'Bag', onClose: () => game.dismiss(), tall: true }, tabRow(game, view), grid);
}
