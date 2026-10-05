// A relic's sheet (Docs/art/ui-relics.md §2, M67's lower panel) and its card
// in the Bag's Relics tab (Docs/art/ui-inventory.md §3.6, M72).
//
// The relic in its six slots — five pieces and the keystone — set where a
// fragment is held, a chalk outline where one is missing; what it does now
// and at the next level; where its fragments drop; its spares; and the one
// thing to press for the state it is in: Forge the missing fragment, Restore
// it, or Level it up. Its spell, once restored, is cast from here.

import type { Game, RelicView } from '../game';
import { ARTIFACTS, RELIC_RULES } from '../sim/data/definitions';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { ArtifactId } from '../sim/state';
import { el, formatDuration, formatExact } from './format';
import { btn, iconEl, sheet } from './kit';

/** The relic's own art, or its glyph while the art has not landed. */
const relicArt = (view: RelicView, cls: string): HTMLElement => {
  const url = spriteUrl(view.sprite);
  return url ? spriteImgAt(url, cls) : el('span', { class: `${cls} is-glyph` }, view.glyph);
};

/** The six slots in a row: a shard where a fragment is held (with the count
 *  past one), a chalk outline where one is missing; the keystone last and
 *  larger. */
function slotRow(view: RelicView, big: boolean): HTMLElement {
  return el('div', { class: `rl-slots${big ? ' is-big' : ''}` }, ...view.slots.map((n, i) =>
    el('span', {
      class: `rl-slot${i === 5 ? ' is-keystone' : ''}${n > 0 ? ' is-held' : ''}`,
      'aria-label': `${i === 5 ? 'Keystone' : `Piece ${i + 1}`}: ${n > 0 ? formatExact(n) : 'missing'}`,
    },
      ...(n > 0 ? [iconEl('shard', { size: 'sm' })] : []),
      ...(big && n > 1 ? [el('b', {}, formatExact(n))] : []))));
}

/** The level seal: blue wax with the level, or "—" before it is restored. */
const seal = (view: RelicView): HTMLElement =>
  el('span', { class: `rl-seal${view.restored ? '' : ' is-broken'}` },
    view.restored ? `Lv ${formatExact(view.level)}` : '—');

/** One relic's card in the Bag: two a row (M72). */
export function relicCardTile(game: Game, view: RelicView): HTMLElement {
  const b = el('button', { class: `rl-card is-${view.kind}`, type: 'button', 'aria-label': view.name },
    el('span', { class: 'rl-card-art' }, relicArt(view, 'rl-art')),
    seal(view),
    el('span', { class: 'rl-card-name' }, view.name),
    slotRow(view, false),
    ...(view.canRestore ? [el('span', { class: 'rl-card-ready' }, 'Ready to restore')] : []));
  b.addEventListener('click', () => game.openRelic(view.id));
  return b;
}

/** The Bag's Relics tab: city relics, then world relics, under thin headers. */
export function relicTab(game: Game): HTMLElement[] {
  const rows = game.relicRows();
  if (rows.length === 0) {
    return [el('p', { class: 'bag-empty' }, 'Relic fragments turn up in lairs and in the fog')];
  }
  const out: HTMLElement[] = [];
  for (const kind of ['city', 'world'] as const) {
    const of = rows.filter((r) => r.kind === kind);
    if (of.length === 0) continue;
    out.push(el('div', { class: 'k-section-head' }, kind === 'city' ? 'City' : 'World'));
    out.push(el('div', { class: 'rl-grid' }, ...of.map((r) => relicCardTile(game, r))));
  }
  return out;
}

/** The spell, once restored: cast it, or how long until it can be. */
function spell(game: Game, id: ArtifactId, view: RelicView): HTMLElement | null {
  const active = ARTIFACTS[id].active;
  if (active === null || !view.restored) return null;
  const { phase, leftMs, charges } = view.cast;
  const left = formatDuration(Math.ceil(leftMs / 1000));
  const running = charges > 0
    ? `${active.name} is lit — ${charges} ${charges === 1 ? 'room' : 'rooms'} left`
    : `${active.name} is running — ${left} left`;
  return el('div', { class: 'rl-spell' },
    el('div', { class: 'rl-line' }, iconEl('Mana', { size: 'sm' }), el('span', {}, `${active.name}: ${active.text}`)),
    phase === 'Ready'
      ? btn({ label: `Cast ${active.name}`, kind: 'primary', finish: 'gem', onClick: () => game.startCast(id) })
      : el('div', { class: 'rl-line is-muted' }, iconEl('hourglass', { size: 'sm' }),
        el('span', {}, phase === 'Active' ? running : `Ready again in ${left}`)));
}

/** The one primary action for the relic's state, and the forge's two. */
function actions(game: Game, view: RelicView): HTMLElement[] {
  if (view.restored) {
    return [btn({
      label: 'Level up',
      kind: 'primary',
      note: `${formatExact(view.levelCost)} spares`,
      disabledReason: view.spares < view.levelCost ? `${formatExact(view.levelCost)} spares — you have ${formatExact(view.spares)}` : undefined,
      onClick: () => game.doLevelRelic(view.id),
    })];
  }
  if (view.canRestore) return [btn({ label: 'Restore', kind: 'primary', onClick: () => game.doRestoreRelic(view.id) })];
  const f = view.forge;
  if (f === null) return [];
  const what = f.slot === 5 ? 'the keystone' : 'a missing piece';
  return [
    el('div', { class: 'rl-line is-muted' }, el('span', {}, `Forge ${what} as a replica:`)),
    el('div', { class: 'rl-forge' },
      btn({
        label: 'Forge',
        note: `${formatExact(f.freeSpares)} spares`,
        disabledReason: f.canFree ? undefined : `${formatExact(f.freeSpares)} spares — you have ${formatExact(view.spares)}`,
        onClick: () => game.doForgeReplica(view.id, false),
      }),
      btn({
        label: 'Forge',
        kind: 'gem',
        note: `${formatExact(f.spares)} spares`,
        disabledReason: f.canGems ? undefined : `${formatExact(f.spares)} spares — you have ${formatExact(view.spares)}`,
        cost: { Gems: f.gems },
        have: (c) => game.walletValue(c),
        onClick: () => game.doForgeReplica(view.id, true),
      })),
  ];
}

export function renderRelicSheet(game: Game): HTMLElement {
  const id = game.openRelicId;
  const close = () => game.closeRelic();
  if (id === null) return sheet({ title: 'Relic', onClose: close, tall: true });
  const view = game.relicCard(id);
  const effect = view.restored
    ? `${view.now} → ${view.next}`
    : `Restored: ${view.now}`;
  const body = el('div', { class: 'rl-page' },
    el('div', { class: 'rl-hero' }, relicArt(view, 'rl-hero-art'), seal(view)),
    slotRow(view, true),
    el('div', { class: 'rl-lines' },
      el('div', { class: 'rl-line' }, iconEl('arrowUp', { size: 'sm' }), el('span', {}, effect)),
      ...(view.pending !== null ? [el('div', { class: 'rl-line is-muted' }, iconEl('hourglass', { size: 'sm' }), el('span', {}, view.pending))] : []),
      el('div', { class: 'rl-line is-muted' }, iconEl('compass', { size: 'sm' }), el('span', {}, `Found in: ${view.foundIn}`)),
      el('div', { class: 'rl-line' }, iconEl('shard', { size: 'sm' }),
        el('span', {}, `Spares: ${formatExact(view.spares)}${view.restored ? '' : ' (copies past the first)'}`))),
    ...actions(game, view),
    ...[spell(game, id, view)].filter((x): x is HTMLElement => x !== null),
    ...(view.chest === null ? [] : [el('div', { class: 'rl-chest' },
      el('div', { class: 'rl-line is-muted' }, el('span', {},
        `Restorer's chest: ${formatExact(view.chest.size)} fragments of this relic — the keystone one time in ${formatExact(RELIC_RULES.keystoneOneIn)}`)),
      btn({
        label: "Restorer's chest",
        kind: 'gem',
        cost: { Gems: view.chest.gems },
        have: (c) => game.walletValue(c),
        onClick: () => game.doRestorerChest(view.id),
      }))]),
  );
  return sheet({ title: view.name, onClose: close, tall: true }, body);
}
