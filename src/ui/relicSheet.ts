// A relic's sheet (Docs/art/ui-relics.md §2, M67's lower panel) and its card
// in the Bag's Relics tab (Docs/art/ui-inventory.md §3.6, M72).
//
// The relic in its six slots — five pieces and the keystone — set where a
// fragment is held, a chalk outline where one is missing; what it does now
// and at the next level; where its fragments come from; and the one thing to
// press for the state it is in: Restore it, or Level it up. A missing
// fragment is never made — it is won, bought or traded. Its spell, once restored, is cast from here.

import type { Game, RelicView } from '../game';
import { ARTIFACTS } from '../sim/data/definitions';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { ArtifactId } from '../sim/state';
import { el, formatCountdown, formatDuration, formatExact } from './format';
import { btn, iconEl, progress, restMarks, sectionHead, sheet } from './kit';
import { relicStatChanges, relicStory } from './relicStats';
import { tr, trn } from '../i18n/tr';

/** The relic's own art, or the Relics mark while the art has not landed —
 *  an atlas icon, never an emoji (tests/icons.test.ts). */
export const relicArt = (view: { sprite: string }, cls: string): HTMLElement => {
  const url = spriteUrl(view.sprite);
  return url ? spriteImgAt(url, cls) : el('span', { class: `${cls} is-glyph` }, iconEl('relics', { size: 'lg' }));
};

/**
 * ONE FRAGMENT'S OWN ART: its piece of the relic, broken off — slots 0–4 the
 * pieces, 5 the keystone, the relic's heart (`<sprite>_frag<slot>.png`,
 * Docs/art/ui/relics/fragments/). The generic shard while a relic has none.
 */
export function fragmentArt(sprite: string, slot: number, cls: string): HTMLElement {
  const url = spriteUrl(`${sprite}_frag${slot}`);
  return url ? spriteImgAt(url, cls) : iconEl('shard', { size: 'sm' });
}

/** The six slots in a row: each fragment's own piece where it is held (with
 *  the count past one), its silhouette in chalk where it is missing — so the
 *  player sees WHICH piece is missing; the keystone last and larger. */
function slotRow(view: RelicView, big: boolean): HTMLElement {
  return el('div', { class: `rl-slots${big ? ' is-big' : ''}` }, ...view.slots.map((n, i) =>
    el('span', {
      class: `rl-slot${i === 5 ? ' is-keystone' : ''}${n > 0 ? ' is-held' : ' is-missing'}`,
      'aria-label': `${i === 5 ? tr('Keystone') : tr('Piece {n}', { n: i + 1 })}: ${n > 0 ? formatExact(n) : tr('missing')}`,
    },
      fragmentArt(view.sprite, i, 'rl-frag'),
      ...(big && n > 1 ? [el('b', {}, formatExact(n))] : []))));
}

/** The level seal: blue wax with the level, or "—" before it is restored. */
const seal = (view: RelicView): HTMLElement =>
  el('span', { class: `rl-seal${view.restored ? '' : ' is-broken'}` },
    view.restored ? tr('Lv {level}', { level: formatExact(view.level) }) : '—');

/** What a card says under its name about where the relic stands (M80). In
 *  fragments, its slots; awake, a gold plank with its time; asleep, its own
 *  Activate (the Zs are on the art); otherwise one muted line. */
function cardStatus(game: Game, view: RelicView): HTMLElement[] {
  switch (view.status) {
    case 'broken':
      return [slotRow(view, false),
        view.canRestore
          ? el('span', { class: 'rl-card-ready' }, tr('Ready to restore'))
          : el('span', { class: 'rl-card-count' },
            `${formatExact(view.slots.filter((n) => n > 0).length)} / ${formatExact(view.slots.length)}`)];
    case 'awake': {
      const a = game.relicActivation(view.id);
      const left = formatDuration(Math.ceil((a?.leftMs ?? 0) / 1000));
      return [el('span', { class: 'rl-awake-plate' }, iconEl('hourglass', { size: 'sm' }), tr('Awake · {time}', { time: left }))];
    }
    case 'asleep': {
      const button = activateButton(game, view.id);
      // A press of its own, not a tap on the card under it.
      button.addEventListener('click', (e) => e.stopPropagation());
      return [button];
    }
    case 'chapel':
      return [el('span', { class: 'rl-card-where' }, tr('In a Chapel'))];
    case 'bag':
      return [el('span', { class: 'rl-card-where' }, tr('In the Bag'))];
  }
}

/** ACTIVATE: the one press that wakes a city relic, wherever it is offered
 *  — its card, its sheet, its Shrine's card. A spell is a magical action, so
 *  it is the emerald stone (§3.3), with its Mana inside it (§6.4). */
export function activateButton(game: Game, id: ArtifactId): HTMLButtonElement {
  const a = game.relicActivation(id);
  const button = btn({
    label: tr('Activate'),
    kind: 'primary',
    finish: 'gem',
    costExtra: [{ icon: 'Mana', amount: formatExact(a?.cost ?? 0), short: !(a?.affordable ?? false) }],
    onClick: () => game.doActivateRelic(id),
  });
  button.dataset.coach = 'relic-activate';
  return button;
}

/** One relic's card in the Bag: two a row (M72, M80). */
export function relicCardTile(game: Game, view: RelicView): HTMLElement {
  // A div acting as the button, because an asleep card carries a button of
  // its own and a button may not hold another.
  const b = el('div', {
    class: `rl-card is-${view.kind} is-${view.status}`, role: 'button', tabindex: '0', 'aria-label': view.name,
  },
    el('span', { class: 'rl-card-art' }, relicArt(view, 'rl-art'),
      ...(view.status === 'asleep' ? [restMarks()] : [])),
    ...(view.restored ? [seal(view)] : []),
    el('span', { class: 'rl-card-name' }, view.name),
    ...cardStatus(game, view));
  b.addEventListener('click', () => game.openRelic(view.id));
  b.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    game.openRelic(view.id);
  });
  return b;
}

/** The Shrines: how many stand. More are built from the Build menu, never
 *  from here. */
function shrineRow(game: Game): HTMLElement {
  const { standing, max } = game.shrineCount();
  return el('div', { class: 'rl-shrines' },
    iconEl('Shrine', { size: 'sm' }),
    el('span', {}, tr('Shrines {standing} / {max}', { standing: formatExact(standing), max: formatExact(max) })),
    ...(standing >= max ? [] : [el('span', { class: 'rl-shrines-note' }, tr('More from the Build menu'))]));
}

/** The Bag's Relics tab: the Shrines, then city relics, then world relics,
 *  under thin headers. */
export function relicTab(game: Game): HTMLElement[] {
  const rows = game.relicRows();
  if (rows.length === 0) {
    return [el('p', { class: 'bag-empty' }, tr('Relic fragments turn up in lairs and in the fog'))];
  }
  const out: HTMLElement[] = [shrineRow(game)];
  for (const kind of ['city', 'world'] as const) {
    const of = rows.filter((r) => r.kind === kind);
    if (of.length === 0) continue;
    out.push(sectionHead(kind === 'city' ? tr('City') : tr('World')));
    out.push(el('div', { class: 'rl-grid' }, ...of.map((r) => relicCardTile(game, r))));
  }
  return out;
}

/** Where a restored city relic is hosted, and the Shrines it could go to
 *  (sim/hosts.ts): it acts only inside a Shrine's aura. */
function hostLines(game: Game, view: RelicView): HTMLElement[] {
  const host = view.host;
  if (host === null) return [];
  const world = view.kind === 'world';
  return [el('div', { class: 'rl-block rl-host' },
    el('div', { class: `rl-line${host.at === null ? ' is-muted' : ''}` }, iconEl('Shrine', { size: 'sm' }),
      el('span', {}, host.at !== null ? tr('Hosted in {place}', { place: host.at })
        : world ? tr('Not hosted — it acts only from a Chapel on the world map')
          : tr('Not hosted — host it in a Shrine, then activate it'))),
    host.shrines.length === 0 && host.at === null
      ? el('div', { class: 'rl-line is-muted' }, el('span', {}, world
        ? tr('Build a Chapel into a district you hold to host it')
        : tr('Repair the Shrine in the ruins to host it')))
      : el('div', { class: 'rl-forge' },
        ...host.shrines.map((o) => btn({
          label: tr('Host'),
          note: o.holds === null ? o.label : tr('{shrine} · holds {relic}', { shrine: o.label, relic: o.holds }),
          onClick: () => game.doHostRelic(view.id, o.shrineId),
        })),
        ...(host.at === null ? [] : [btn({ label: tr('Remove'), onClick: () => game.doUnhostRelic(view.id) })])))];
}

/**
 * A CITY RELIC'S ACTIVATION, once it is hosted (sim/hosts.ts; M81–M83):
 * asleep, a grey seal, the Activate button and what a window buys; short of
 * Mana, how soon the pool holds the price and a flask from the Bag; awake, a
 * gold bar running down the window. The relic's level sets the power, the
 * reach and the window.
 */
export function activation(game: Game, id: ArtifactId): HTMLElement | null {
  const a = game.relicActivation(id);
  if (a === null || !a.hosted) return null;
  const window = formatDuration(Math.ceil(a.windowMs / 1000));
  const reach = tr('{n} cells round its Shrine', { n: formatExact((2 * a.radius + 1) ** 2) });
  if (a.awake) {
    // A TIMER is the blue bar (kit/stats.ts `ProgressTone`).
    const bar = progress('blue');
    // To the second while it runs down: the window is the thing being read.
    const left = formatDuration(Math.ceil(a.leftMs / 1000));
    bar.set(a.windowMs > 0 ? a.leftMs / a.windowMs : 0, tr('{time} left', { time: left }));
    return el('div', { class: 'rl-block rl-activation is-awake' },
      el('div', { class: 'rl-awake-row' }, iconEl('hourglass'), bar.root),
      el('p', { class: 'rl-note' }, tr('Awake over {reach}. Taking it out ends the window.', { reach })));
  }
  const short = !a.affordable;
  const regen = formatExact(Math.round(a.regenPerHour));
  return el('div', { class: 'rl-block rl-activation' },
    el('div', { class: 'rl-sleep-row' },
      el('span', { class: 'rl-wax', role: 'img', 'aria-label': tr('Asleep') }, tr('Asleep')),
      activateButton(game, id)),
    el('p', { class: 'rl-note' }, tr('Awake for {time} over {reach}', { time: window, reach })),
    ...(!short ? [] : [
      el('p', { class: 'rl-note' },
        a.readyInMs !== null && Number.isFinite(a.readyInMs)
          ? tr('Mana refills {n} an hour: {cost} in {time}', {
            n: regen, cost: formatExact(a.cost), time: formatCountdown(Math.ceil(a.readyInMs / 1000)),
          })
          : tr('Mana refills {n} an hour', { n: regen })),
      ...(a.flask === null ? [] : [btn({
        label: tr('Use'),
        kind: 'blue',
        icon: 'flask',
        note: tr('Mana flask ×{n}', { n: formatExact(a.flask.count) }),
        onClick: () => game.doUseFlaskFor(id),
      })]),
    ]));
}

/**
 * THE ACTIVATION OVER THE SHRINE'S PAINTING (its card): only what can be
 * pressed or read at a glance, on the painting's calm bottom band — asleep,
 * Activate with its Mana (and, short of it, the smallest flask); awake, the
 * window running down. The sheet's longer form is `activation`.
 */
export function activationOverlay(game: Game, id: ArtifactId): HTMLElement | null {
  const a = game.relicActivation(id);
  if (a === null || !a.hosted) return null;
  if (a.awake) {
    const bar = progress('blue');
    bar.set(a.windowMs > 0 ? a.leftMs / a.windowMs : 0, tr('{time} left', { time: formatDuration(Math.ceil(a.leftMs / 1000)) }));
    return el('div', { class: 'dc-chapel-foot is-awake' }, iconEl('hourglass'), bar.root);
  }
  return el('div', { class: 'dc-chapel-foot' },
    activateButton(game, id),
    ...(a.affordable || a.flask === null ? [] : [btn({
      label: tr('Use'),
      kind: 'blue',
      icon: 'flask',
      note: tr('Flask ×{n}', { n: formatExact(a.flask.count) }),
      onClick: () => game.doUseFlaskFor(id),
    })]));
}

/** A world relic's spell, once restored: cast it, or how long until it can
 *  be. A city relic has none — it is activated (`activation`). */
export function spellSection(game: Game, id: ArtifactId, view: RelicView): HTMLElement | null {
  if (view.kind === 'city') return activation(game, id);
  const active = ARTIFACTS[id].active;
  if (active === null || !view.restored) return null;
  if (view.host !== null && view.host.at === null) return null;
  const { phase, leftMs, charges } = view.cast;
  const left = formatDuration(Math.ceil(leftMs / 1000));
  const running = charges > 0
    ? trn(charges, '{spell} is lit — {n} room left', '{spell} is lit — {n} rooms left', { spell: active.name, n: charges })
    : tr('{spell} is running — {time} left', { spell: active.name, time: left });
  return el('div', { class: 'rl-block rl-spell' },
    el('div', { class: 'rl-line' }, iconEl('Mana', { size: 'sm' }), el('span', {}, `${active.name}: ${active.text}`)),
    phase === 'Ready'
      ? btn({ label: tr('Cast'), kind: 'primary', finish: 'gem', onClick: () => game.startCast(id) })
      : el('div', { class: 'rl-line is-muted' }, iconEl('hourglass', { size: 'sm' }),
        el('span', {}, phase === 'Active' ? running : tr('Ready again in {time}', { time: left }))));
}

/** Where a missing fragment comes from: the only doors there are. */
const FRAGMENT_SOURCES = (): string =>
  tr('More fragments are won in battle — in lairs, on the world map and in the depths — bought in the store, or traded with friends');

/**
 * THE LEVEL SECTION (one `.k-section`): the relic's level, its six slots and
 * the press that moves it — Restore while it is in fragments, then Level up,
 * which takes one fragment of each slot and the level's Stardust, every
 * level. While a slot is empty it says where fragments come from. ONE GREEN
 * ACTION A SCREEN (§2.2): while an asleep relic's Activate is on the page, Level up steps
 * down to wood.
 */
function levelSection(game: Game, view: RelicView): HTMLElement {
  const head = el('div', { class: 'rl-level-head' },
    el('b', {}, view.restored ? tr('Level {level}', { level: formatExact(view.level) }) : tr('Not restored')));
  const press: HTMLElement[] = [];
  if (view.restored) {
    // The set a level takes is the slot row above, not a term in the price:
    // a fragment beside the Stardust read as a second resource (Runestone).
    if (!view.hasSet) press.push(el('p', { class: 'rl-note' }, tr('A piece in every slot to level up')));
    press.push(btn({
      label: tr('Level up'),
      kind: view.status === 'asleep' ? 'secondary' : 'primary',
      cost: { Stardust: view.levelStardust },
      have: (c) => game.walletValue(c),
      ...(view.hasSet ? {} : { disabledReason: tr('A piece in every slot to level up') }),
      onClick: () => game.doLevelRelic(view.id),
    }));
  } else if (view.canRestore) {
    press.push(btn({ label: tr('Restore'), kind: 'primary', onClick: () => game.doRestoreRelic(view.id) }));
  }
  if (!view.hasSet && !view.canRestore) press.push(el('p', { class: 'rl-note' }, FRAGMENT_SOURCES()));
  return el('div', { class: 'rl-level k-section' }, head, slotRow(view, true), ...press);
}

/** What the relic is worth now and at the next level, as the building
 *  card's band of tiles (09-relics.md §11.3): one tile a number, its next
 *  value after an arrow when the level moves it. */
function statBand(view: RelicView): HTMLElement {
  const level = Math.max(1, view.level);
  return el('div', { class: 'dc-stats rl-stats' }, ...relicStatChanges(view.id, level).map((s) =>
    el('div', { class: 'dc-stat k-section', title: s.label, 'aria-label': `${s.label} ${s.value}` },
      iconEl(s.icon),
      el('div', { class: 'dc-stat-body', 'aria-hidden': 'true' },
        el('div', { class: 'dc-stat-label' }, s.label),
        el('b', { class: 'dc-stat-value' }, view.restored && s.changed ? `${s.value} → ${s.to}` : s.value)))));
}

export function renderRelicSheet(game: Game): HTMLElement {
  const id = game.openRelicId;
  const close = () => game.closeRelic();
  if (id === null) return sheet({ title: tr('Relic'), onClose: close, tall: true });
  const view = game.relicCard(id);
  const spell = spellSection(game, id, view);
  const body = el('div', { class: 'rl-page' },
    el('div', { class: `rl-hero is-${view.status}` },
      relicArt(view, 'rl-hero-art'),
      ...(view.status === 'awake' ? [el('span', { class: 'rl-awake-plate is-ribbon' }, tr('Awake'))] : []),
      ...(view.status === 'asleep' ? [restMarks()] : [])),
    el('p', { class: 'rl-story' }, relicStory(id, Math.max(1, view.level))),
    statBand(view),
    ...(view.pending !== null ? [el('p', { class: 'rl-note' }, view.pending)] : []),
    levelSection(game, view),
    ...(view.host === null ? [] : [sectionHead(view.kind === 'city' ? tr('Shrine') : tr('Chapel')), ...hostLines(game, view)]),
    ...(spell === null ? [] : [...(view.host === null ? [sectionHead(tr('Spell'))] : []), spell]),
    // MORE FRAGMENTS are the store's: one shortcut to its pack.
    el('div', { class: 'rl-more' },
      btn({ label: tr('Store'), icon: 'shop', onClick: () => game.openStoreForFragments() })),
  );
  // The whole height between the header and the nav, whatever it holds.
  const surface = sheet({ title: view.name, onClose: close, tall: true }, body);
  surface.classList.add('is-relic');
  return surface;
}
