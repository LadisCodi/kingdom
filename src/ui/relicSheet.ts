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
import { el, formatCountdown, formatDuration, formatExact } from './format';
import { btn, iconEl, progress, restMarks, sectionHead, sheet } from './kit';
import { relicStatChanges } from './relicStats';

/** The relic's own art, or the Relics mark while the art has not landed —
 *  an atlas icon, never an emoji (tests/icons.test.ts). */
export const relicArt = (view: { sprite: string }, cls: string): HTMLElement => {
  const url = spriteUrl(view.sprite);
  return url ? spriteImgAt(url, cls) : el('span', { class: `${cls} is-glyph` }, iconEl('relics', { size: 'lg' }));
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

/** What a card says under its name about where the relic stands (M80). In
 *  fragments, its slots; awake, a gold plank with its time; asleep, its own
 *  Activate (the Zs are on the art); otherwise one muted line. */
function cardStatus(game: Game, view: RelicView): HTMLElement[] {
  switch (view.status) {
    case 'broken':
      return [slotRow(view, false),
        view.canRestore
          ? el('span', { class: 'rl-card-ready' }, 'Ready to restore')
          : el('span', { class: 'rl-card-count' },
            `${formatExact(view.slots.filter((n) => n > 0).length)} / ${formatExact(view.slots.length)}`)];
    case 'awake': {
      const a = game.relicActivation(view.id);
      const left = formatCountdown(Math.ceil((a?.leftMs ?? 0) / 1000));
      return [el('span', { class: 'rl-awake-plate' }, iconEl('hourglass', { size: 'sm' }), `Awake · ${left}`)];
    }
    case 'asleep': {
      const button = activateButton(game, view.id);
      // A press of its own, not a tap on the card under it.
      button.addEventListener('click', (e) => e.stopPropagation());
      return [button];
    }
    case 'chapel':
      return [el('span', { class: 'rl-card-where' }, 'In a Chapel')];
    case 'bag':
      return [el('span', { class: 'rl-card-where' }, 'In the Bag')];
  }
}

/** ACTIVATE: the one press that wakes a city relic, wherever it is offered
 *  — its card, its sheet, its Shrine's card. A spell is a magical action, so
 *  it is the emerald stone (§3.3), with its Mana inside it (§6.4). */
export function activateButton(game: Game, id: ArtifactId): HTMLButtonElement {
  const a = game.relicActivation(id);
  const button = btn({
    label: 'Activate',
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

/** The Shrines: how many stand, and the next one for Gems while any are
 *  left (relic-restoration.md §5.1). */
function shrineRow(game: Game): HTMLElement {
  const offer = game.shrineOffer();
  return el('div', { class: 'rl-shrines' },
    iconEl('Shrine', { size: 'sm' }),
    el('span', {}, `Shrines ${formatExact(offer.standing)} / ${formatExact(offer.max)}`),
    ...(offer.gems === null ? [] : [btn({
      label: 'Build',
      kind: 'gem',
      cost: { Gems: offer.gems },
      have: (c) => game.walletValue(c),
      onClick: () => game.startPremiumShrine(),
    })]));
}

/** The Bag's Relics tab: the Shrines, then city relics, then world relics,
 *  under thin headers. */
export function relicTab(game: Game): HTMLElement[] {
  const rows = game.relicRows();
  if (rows.length === 0) {
    return [el('p', { class: 'bag-empty' }, 'Relic fragments turn up in lairs and in the fog')];
  }
  const out: HTMLElement[] = [shrineRow(game)];
  for (const kind of ['city', 'world'] as const) {
    const of = rows.filter((r) => r.kind === kind);
    if (of.length === 0) continue;
    out.push(sectionHead(kind === 'city' ? 'City' : 'World'));
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
      el('span', {}, host.at !== null ? `Hosted in ${host.at}`
        : world ? 'Not hosted — it acts only from a Chapel on the world map'
          : 'Not hosted — host it in a Shrine, then activate it')),
    host.shrines.length === 0 && host.at === null
      ? el('div', { class: 'rl-line is-muted' }, el('span', {}, world
        ? 'Build a Chapel into a district you hold to host it'
        : 'Repair the Shrine in the ruins to host it'))
      : el('div', { class: 'rl-forge' },
        ...host.shrines.map((o) => btn({
          label: 'Host',
          note: o.holds === null ? o.label : `${o.label} · holds ${o.holds}`,
          onClick: () => game.doHostRelic(view.id, o.shrineId),
        })),
        ...(host.at === null ? [] : [btn({ label: 'Remove', onClick: () => game.doUnhostRelic(view.id) })])))];
}

/**
 * A CITY RELIC'S ACTIVATION, once it is hosted (sim/hosts.ts; M81–M83):
 * asleep, a grey seal, the Activate button and what a window buys; short of
 * Mana, how soon the pool holds the price and a flask from the Bag; awake, a
 * gold bar running down the window. The relic's level sets the power and
 * reach; its Shrine's level, the window.
 */
export function activation(game: Game, id: ArtifactId): HTMLElement | null {
  const a = game.relicActivation(id);
  if (a === null || !a.hosted) return null;
  const window = formatDuration(Math.ceil(a.windowMs / 1000));
  const reach = `${formatExact((2 * a.radius + 1) ** 2)} cells round its Shrine`;
  if (a.awake) {
    // A TIMER is the blue bar (kit/stats.ts `ProgressTone`).
    const bar = progress('blue');
    const left = formatCountdown(Math.ceil(a.leftMs / 1000));
    bar.set(a.windowMs > 0 ? a.leftMs / a.windowMs : 0, `${left} left`);
    return el('div', { class: 'rl-block rl-activation is-awake' },
      el('div', { class: 'rl-awake-row' }, iconEl('hourglass'), bar.root),
      el('p', { class: 'rl-note' }, `Awake over ${reach}. Taking it out ends the window.`));
  }
  const short = !a.affordable;
  return el('div', { class: 'rl-block rl-activation' },
    el('div', { class: 'rl-sleep-row' },
      el('span', { class: 'rl-wax', role: 'img', 'aria-label': 'Asleep' }, 'Asleep'),
      activateButton(game, id)),
    el('p', { class: 'rl-note' }, `Awake for ${window} over ${reach}`),
    ...(!short ? [] : [
      el('p', { class: 'rl-note' },
        `Mana refills ${formatExact(Math.round(a.regenPerHour))} an hour`
        + (a.readyInMs !== null && Number.isFinite(a.readyInMs)
          ? `: ${formatExact(a.cost)} in ${formatCountdown(Math.ceil(a.readyInMs / 1000))}` : '')),
      ...(a.flask === null ? [] : [btn({
        label: 'Use',
        kind: 'blue',
        icon: 'manaFlask',
        note: `Mana flask ×${formatExact(a.flask.count)}`,
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
    bar.set(a.windowMs > 0 ? a.leftMs / a.windowMs : 0, `${formatCountdown(Math.ceil(a.leftMs / 1000))} left`);
    return el('div', { class: 'dc-chapel-foot is-awake' }, iconEl('hourglass'), bar.root);
  }
  return el('div', { class: 'dc-chapel-foot' },
    activateButton(game, id),
    ...(a.affordable || a.flask === null ? [] : [btn({
      label: 'Use',
      kind: 'blue',
      icon: 'manaFlask',
      note: `Flask ×${formatExact(a.flask.count)}`,
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
    ? `${active.name} is lit — ${charges} ${charges === 1 ? 'room' : 'rooms'} left`
    : `${active.name} is running — ${left} left`;
  return el('div', { class: 'rl-block rl-spell' },
    el('div', { class: 'rl-line' }, iconEl('Mana', { size: 'sm' }), el('span', {}, `${active.name}: ${active.text}`)),
    phase === 'Ready'
      ? btn({ label: 'Cast', kind: 'primary', finish: 'gem', onClick: () => game.startCast(id) })
      : el('div', { class: 'rl-line is-muted' }, iconEl('hourglass', { size: 'sm' }),
        el('span', {}, phase === 'Active' ? running : `Ready again in ${left}`)));
}

/** The spares a press takes, as a price inside its button (§6.4): Fragments
 *  are not a wallet currency, so the term reads `have / needed`. */
const sparesTerm = (have: number, need: number) =>
  ({ icon: 'shard' as const, amount: `${formatExact(have)} / ${formatExact(need)}`, short: have < need });

/**
 * THE LEVEL SECTION (one `.k-section`): the relic's level, its six slots and
 * the press that moves it — Restore while it is in fragments, then Level up,
 * which takes one fragment of each slot and the level's Stardust, every
 * level. A missing piece is forged here too. ONE GREEN ACTION A SCREEN
 * (§2.2): while an asleep relic's Activate is on the page, Level up steps
 * down to wood.
 */
function levelSection(game: Game, view: RelicView): HTMLElement {
  const held = view.slots.filter((n) => n > 0).length;
  const head = el('div', { class: 'rl-level-head' },
    el('b', {}, view.restored ? `Level ${formatExact(view.level)}` : 'Not restored'),
    ...(view.restored ? [] : [el('span', {}, `${formatExact(view.spares)} spares`)]));
  const press: HTMLElement[] = [];
  if (view.restored) {
    press.push(btn({
      label: 'Level up',
      kind: view.status === 'asleep' ? 'secondary' : 'primary',
      cost: { Stardust: view.levelStardust },
      have: (c) => game.walletValue(c),
      costExtra: [{ icon: 'shard', amount: `${formatExact(held)} / ${formatExact(view.slots.length)}`, short: !view.hasSet }],
      onClick: () => game.doLevelRelic(view.id),
    }));
  } else if (view.canRestore) {
    press.push(btn({ label: 'Restore', kind: 'primary', onClick: () => game.doRestoreRelic(view.id) }));
  } else if (view.forge !== null) {
    const f = view.forge;
    const what = f.slot === 5 ? 'the keystone' : 'a missing piece';
    press.push(
      el('p', { class: 'rl-note' }, `Forge ${what} as a replica`),
      el('div', { class: 'rl-forge' },
        btn({
          label: 'Forge',
          costExtra: [sparesTerm(view.spares, f.freeSpares)],
          onClick: () => game.doForgeReplica(view.id, false),
        }),
        btn({
          label: 'Forge',
          kind: 'gem',
          cost: { Gems: f.gems },
          have: (c) => game.walletValue(c),
          costExtra: [sparesTerm(view.spares, f.spares)],
          onClick: () => game.doForgeReplica(view.id, true),
        })));
  }
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
  if (id === null) return sheet({ title: 'Relic', onClose: close, tall: true });
  const view = game.relicCard(id);
  const spell = spellSection(game, id, view);
  const body = el('div', { class: 'rl-page' },
    el('div', { class: `rl-hero is-${view.status}` },
      relicArt(view, 'rl-hero-art'),
      ...(view.status === 'awake' ? [el('span', { class: 'rl-awake-plate is-ribbon' }, 'Awake')] : []),
      ...(view.status === 'asleep' ? [restMarks()] : [])),
    statBand(view),
    ...(view.pending !== null ? [el('p', { class: 'rl-note' }, view.pending)] : []),
    levelSection(game, view),
    ...(view.host === null ? [] : [sectionHead(view.kind === 'city' ? 'Shrine' : 'Chapel'), ...hostLines(game, view)]),
    ...(spell === null ? [] : [...(view.host === null ? [sectionHead('Spell')] : []), spell]),
    ...(view.chest === null ? [] : [sectionHead("Restorer's chest"), el('div', { class: 'rl-block rl-chest' },
      el('p', { class: 'rl-note' },
        `${formatExact(view.chest.size)} fragments of this relic — the keystone one time in ${formatExact(RELIC_RULES.keystoneOneIn)}`),
      btn({
        label: 'Buy',
        kind: 'gem',
        cost: { Gems: view.chest.gems },
        have: (c) => game.walletValue(c),
        onClick: () => game.doRestorerChest(view.id),
      }))]),
  );
  // The whole height between the header and the nav, whatever it holds.
  const surface = sheet({ title: view.name, onClose: close, tall: true }, body);
  surface.classList.add('is-relic');
  return surface;
}
