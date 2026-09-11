// The Reliquary (Docs/features/09-relics.md §7) — a grid of cards, and one
// card opened.
//
// It follows the roster (src/ui/heroesSheet.ts), because a relic and a hero
// are the same shape of thing: a collection the player is filling in, where
// the gaps are as much of the content as the pieces. A list of rows, each
// carrying every button that relic has, put five decisions on screen at once
// and gave the SOCKETS — the constraint the whole magic design turns on —
// less room than the least of them.
//
// So: sockets first and large, then three cards to a row, and the decision a
// card carries lives behind it. Two views, one overlay — the nav tab stays
// put and `game.openRelicId` decides which of them draws. That lives on the
// presenter for the reason `openHeroId` does: it survives the per-tick
// rebuild and it is node-testable.
//
// THE SCREEN DOES REBUILD ON THE TICK, unlike the roster: a settling socket
// counts down on it. Five relics is five images, not thirty-two.
//
// Heroes used to be a second tab here. They left on 2026-09-08 for a nav tab
// of their own: the two share one collection LADDER, which was the argument
// for one screen, but they do not share a job. The Mana arithmetic left the
// same day, for the Mana sheet (src/ui/manaSheet.ts) — this screen neither
// spends the pool nor fills it.

import {
  ARTIFACTS, ARTIFACT_ORDER, ATTUNEMENT, COLLECTION, RUINS,
} from '../sim/data/definitions';
import {
  artifactEntry, attunementSlotGemCost, attunementSlots, isAttuned, isSlotLocked,
  ownsArtifact, passiveValue, slotUnlocksIn,
} from '../sim/artifacts';
import { castBlock } from '../sim/casting';
import { levelCapForTier, levelCost, tierCost } from '../sim/collection';
import { resourceDiscoveryKey } from '../sim/discovery';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { ArtifactId } from '../sim/state';
import type { Game } from '../game';
import { el, formatDuration } from './format';
import { action, btn, iconEl, knob, pips, sheet, type ActionOpts } from './kit';

/** Relic art — sprite if it exists, glyph if not. Every relic's sheet is a
 *  128² square, so it is contained in whatever box it is given and the five
 *  line up across a row whatever that box is. */
function relicArt(id: ArtifactId, locked: boolean): HTMLElement {
  const def = ARTIFACTS[id];
  const url = spriteUrl(def.sprite);
  return url
    ? spriteImgAt(url, `rel-art${locked ? ' is-locked' : ''}`)
    : el('div', { class: `rel-art rel-art--glyph${locked ? ' is-locked' : ''}` }, def.glyph);
}

/** "reveal costs −15%" / "+1 per delivery" — the passive as a player reads it. */
function passiveLabel(game: Game, id: ArtifactId): string {
  const def = ARTIFACTS[id];
  const value = passiveValue(game.state, id);
  if (def.passive.op === 'mul') {
    const pct = Math.round(Math.abs(1 - value) * 100);
    return `${def.passiveText} (${value < 1 ? '−' : '+'}${pct}%)`;
  }
  const n = Math.round(value * 10) / 10;
  return `${def.passiveText} (+${n})`;
}

/** Can this relic take a level or a tier right now? The tile's green mark —
 *  the grid's job is to point at the one card worth opening, which is the
 *  same job the roster's does. */
function ready(game: Game, id: ArtifactId): boolean {
  if (!ownsArtifact(game.state, id)) return false;
  const entry = artifactEntry(game.state, id);
  const canStudy = entry.level < levelCapForTier(entry.tier)
    && entry.level < COLLECTION.maxLevel
    && game.walletValue('Stardust') >= levelCost(entry.level);
  const canRaise = entry.tier < COLLECTION.maxTier
    && entry.fragments >= tierCost(entry.tier);
  return canStudy || canRaise;
}

// -------------------------------------------------------------- the Stardust

/**
 * The purse for this screen.
 *
 * Stardust has no coin on the plank: it buys levels for relics and heroes and
 * nothing else, so it reads here, beside the Study buttons that spend it, the
 * way Fragments do. The roster screen carries the same line, for the same
 * reason — a price with no purse in sight is a bug on whichever screen the
 * price is on.
 *
 * It is hidden until the player has met it. Stardust only ever comes out of a
 * dungeon or a banner, so a zero row would advertise a system they have not
 * reached yet. (Knowledge used to be this currency; it is the research clock
 * now and reads in the Research screen — 07-research.md §4.)
 */
function stardustPanel(game: Game): HTMLElement | null {
  const held = game.walletValue('Stardust');
  if (held === 0 && game.state.discoveries[resourceDiscoveryKey('Stardust')] !== true) {
    return null;
  }
  return el('div', { class: 'rel-purse' },
    iconEl('Stardust', { size: 'lg' }),
    el('div', { class: 'rel-purse-body' },
      el('div', { class: 'rel-purse-title' }, 'Stardust'),
      el('div', { class: 'rel-purse-hint' }, 'Won from dungeons and the banner')),
    el('b', { class: 'rel-purse-value' }, String(held)));
}

// ----------------------------------------------------------------- the slots

/**
 * THE SOCKETS, as a row of boxes with a line under each.
 *
 * Three states, and the next one to buy is a FOURTH BOX rather than a button
 * under the row — the shape the research desks and the expedition's hero
 * slots already use. The thing being bought is a socket, so it is drawn as
 * one, and the Gems it costs read where the other sockets' names do.
 *
 *   empty    — drawn open, an invitation
 *   filled   — the relic's art, and tapping it opens that relic's card
 *   to buy   — the gem tone, the plus, and the price underneath
 *
 * Either of the first two can also be SETTLING from a swap, which is a wait
 * on the socket rather than a fourth state of it.
 *
 * A filled socket has no Remove on it any more. Wearing and taking off are
 * one decision about one relic, and that decision lives on the relic's card.
 */
function slots(game: Game): HTMLElement {
  const now = game.now();
  const count = attunementSlots(game.state);
  const row = el('div', { class: 'rel-slots' });

  for (let i = 0; i < count; i++) {
    const worn = game.state.artifacts.attuned[i] ?? null;
    const settling = isSlotLocked(game.state, i, now)
      ? formatDuration(slotUnlocksIn(game.state, i, now))
      : null;

    // AN EMPTY SOCKET CAN STILL BE SETTLING — that is what taking a relic off
    // leaves behind. Its line says how long rather than "Empty", so the wait
    // is read here instead of discovered by pressing Attune on a card.
    if (worn === null) {
      row.append(el('div', { class: `rel-slot is-free${settling ? ' is-settling' : ''}` },
        el('div', { class: 'rel-socket' }, el('span', { class: 'rel-socket-empty' }, '◇')),
        settling === null
          ? el('div', { class: 'rel-slot-note' }, 'Empty')
          : el('div', { class: 'rel-slot-note' },
            iconEl('hourglass', { size: 'sm' }), settling)));
      continue;
    }

    const box = el('button', {
      class: 'rel-socket is-filled',
      type: 'button',
      'aria-label': `Open ${ARTIFACTS[worn].name}`,
    }, relicArt(worn, false));
    // A filled socket's line is already spoken for by the relic's name, so its
    // wait rides on the box.
    if (settling !== null) {
      box.append(el('span', { class: 'rel-socket-settle' },
        iconEl('hourglass', { size: 'sm' }), settling));
    }
    box.addEventListener('click', () => {
      game.openRelicId = worn;
      game.notify();
    });
    row.append(el('div', { class: 'rel-slot is-filled' },
      box,
      el('div', { class: 'rel-slot-note' }, ARTIFACTS[worn].name)));
  }

  if (count < ATTUNEMENT.maxSlots) {
    const cost = attunementSlotGemCost(game.state);
    const short = game.walletValue('Gems') < cost;
    const box = el('button', {
      class: `rel-socket is-buy${short ? ' is-short' : ''}`,
      type: 'button',
      'aria-label': `Open another socket for ${cost} Gems`,
    }, iconEl('padlock', { size: 'md' }));
    box.addEventListener('click', () => game.doBuyAttunementSlot());
    row.append(el('div', { class: 'rel-slot is-buy' },
      box,
      el('div', { class: `rel-slot-note${short ? ' is-short' : ''}` },
        iconEl('Gems', { size: 'sm' }), String(cost))));
  }

  return el('div', { class: 'rel-section' },
    el('div', { class: 'rel-heading' },
      el('span', {}, 'Attuned'),
      el('span', { class: 'rel-heading-note' }, `${count} of ${ATTUNEMENT.maxSlots} sockets`)),
    row,
    el('div', { class: 'rel-note' },
      'A relic works while you wear it. Swapping takes hold at once, then the '
      + `socket settles for ${Math.round(ATTUNEMENT.swapLockSeconds / 60)} minutes.`),
  );
}

// ------------------------------------------------------------------ the grid

function tile(game: Game, id: ArtifactId): HTMLElement {
  const def = ARTIFACTS[id];
  const owned = ownsArtifact(game.state, id);
  const entry = artifactEntry(game.state, id);
  const worn = isAttuned(game.state, id);

  const t = el('button', {
    class: `rel-tile${owned ? '' : ' is-locked'}${worn ? ' is-worn' : ''}`,
    type: 'button',
    'aria-label': def.name,
  }, relicArt(id, !owned));

  if (owned) {
    t.append(el('span', { class: 'rel-tile-foot' },
      el('span', { class: 'rel-tile-name' }, def.name),
      el('span', { class: 'rel-tile-line' },
        el('span', { class: 'rel-tile-level' }, `Lv ${entry.level}`),
        pips(entry.tier, COLLECTION.maxTier))));
    // Worn beats ready: a relic in a socket is where the player put it, and a
    // green plus on it would read as a second thing to do about the same card.
    if (worn) {
      t.append(el('span', { class: 'rel-tile-worn' }, iconEl('tick', { size: 'sm' })));
    } else if (ready(game, id)) {
      t.append(el('span', { class: 'rel-tile-ready' }, iconEl('plus', { size: 'sm' })));
    }
  } else {
    // An unfound relic is a SIGNPOST, not a locked box: it names the ruin, so
    // the fog has somewhere specific to go. Same treatment the roster's gaps
    // get, and the reason the card behind it opens too.
    t.append(el('span', { class: 'rel-tile-foot is-where' },
      el('span', { class: 'rel-tile-name' }, def.name),
      el('span', { class: 'rel-tile-line' },
        iconEl('padlock', { size: 'sm' }), RUINS[def.source].name)));
  }

  t.addEventListener('click', () => {
    game.openRelicId = id;
    game.notify();
  });
  return t;
}

function collection(game: Game): HTMLElement {
  const owned = ARTIFACT_ORDER.filter((id) => ownsArtifact(game.state, id));
  const missing = ARTIFACT_ORDER.filter((id) => !ownsArtifact(game.state, id));
  // Owned first, then the gaps, both in roster order — the sort the reference
  // screens reach a dropdown for, and it needs no control at all.
  const ordered = [...owned, ...missing];

  const relics = el('div', { class: 'rel-section' },
    el('div', { class: 'rel-heading' },
      el('span', {}, 'Relics'),
      el('span', { class: 'rel-heading-note' },
        `${owned.length} of ${ARTIFACT_ORDER.length} found`)),
    ...(owned.length === 0
      ? [el('div', { class: 'rel-note' },
        `Relics are won from ruins. There are ${Object.keys(RUINS).length} out there, `
        + 'and each holds exactly one — no luck involved.')]
      : []),
    el('div', { class: 'rel-grid' }, ...ordered.map((id) => tile(game, id))),
  );

  const purse = stardustPanel(game);
  return el('div', { class: 'rel' },
    ...(purse === null ? [] : [purse]),
    slots(game),
    relics,
  );
}

// ---------------------------------------------------------------- the detail

/** Step to the relic before or after this one, wrapping. Comparing two
 *  passives is most of what the card is for, and a trip back through the grid
 *  to do it is three taps where this is one. */
function step(id: ArtifactId, by: 1 | -1): ArtifactId {
  const i = ARTIFACT_ORDER.indexOf(id);
  return ARTIFACT_ORDER[(i + by + ARTIFACT_ORDER.length) % ARTIFACT_ORDER.length]!;
}

function detail(game: Game, id: ArtifactId): HTMLElement {
  const def = ARTIFACTS[id];
  const owned = ownsArtifact(game.state, id);
  const entry = artifactEntry(game.state, id);
  const worn = isAttuned(game.state, id);
  const now = game.now();

  // A CLOSE, top-right, where every sheet in the game puts one. The card is a
  // modal over the grid, and the two arrows own the other corners.
  const close = knob('✕', () => { game.openRelicId = null; game.notify(); }, {
    label: 'Close',
  });
  close.classList.add('rel-close');

  const arrow = (by: 1 | -1) => knob(by === 1 ? '›' : '‹', () => {
    game.openRelicId = step(id, by);
    game.notify();
  }, { label: by === 1 ? 'Next relic' : 'Previous relic' });

  const stage = el('div', { class: `rel-stage${worn ? ' is-worn' : ''}` },
    close,
    ...(worn ? [el('span', { class: 'rel-stage-worn' },
      iconEl('tick', { size: 'sm' }), 'Attuned')] : []),
    arrow(-1),
    relicArt(id, !owned),
    arrow(1),
    el('div', { class: 'rel-stage-foot' }, pips(entry.tier, COLLECTION.maxTier)),
  );

  const body = el('div', { class: 'rel' },
    stage,
    el('div', { class: 'rel-title' },
      el('div', { class: 'rel-detail-name' }, def.name),
      el('div', { class: 'rel-detail-sub' },
        owned
          ? `Level ${entry.level} of ${levelCapForTier(entry.tier)}`
          : `Waiting in ${RUINS[def.source].name}`)),
    el('div', { class: 'rel-passive' },
      iconEl('sparkle', { size: 'sm' }), passiveLabel(game, id)),
  );

  if (def.active) {
    body.append(el('div', { class: 'rel-active' },
      el('div', { class: 'rel-active-name' }, def.active.name),
      el('div', { class: 'rel-active-text' }, def.active.text)));
  } else {
    // Stated, not hidden: the socket rather than the ability is the
    // constraint, and this relic is the clearest proof of it.
    body.append(el('div', { class: 'rel-note' }, 'No spell — it simply works, always.'));
  }

  // AN UNFOUND RELIC GETS THE SAME CARD, for the reason an unfound hero does:
  // what the player is deciding is whether to go and get this one, and that
  // is a question about the passive above — not about a button it has not
  // earned yet.
  if (!owned) {
    body.append(el('div', { class: 'rel-note' },
      `Clear ${RUINS[def.source].name} to the bottom and it is yours. `
      + 'Each ruin holds exactly one — no luck involved.'));
    return body;
  }

  // ATTUNE OR LEAVE IT ON THE SHELF, and nothing is ever away: a relic goes
  // into a room and comes back out of it in the same instant, so the only
  // socket that can hold one is the kingdom's
  // (Docs/features/11-expeditions.md §5).
  const controls = el('div', { class: 'rel-controls' });
  const slotIndex = game.state.artifacts.attuned.indexOf(id);
  const freeSlot = game.state.artifacts.attuned.indexOf(null);

  // The two live side by side, so neither can carry `action()`'s reason slot.
  // They share ONE line under the row instead, and a reason both of them give
  // is printed once — the shape the Mana sheet's two routes already use.
  const options: ActionOpts[] = [];
  if (worn) {
    options.push({
      label: 'Remove',
      onClick: () => game.doAttune(slotIndex, null),
      disabledReason: isSlotLocked(game.state, slotIndex, now)
        ? 'That socket is still settling' : undefined,
    });
  } else {
    options.push({
      label: 'Attune',
      kind: 'primary',
      onClick: () => game.doAttune(freeSlot, id),
      disabledReason: freeSlot === -1
        ? 'Every socket is full'
        : isSlotLocked(game.state, freeSlot, now)
          ? 'That socket is still settling'
          : undefined,
    });
  }

  if (def.active) {
    const block = castBlock(game.state, id);
    options.push({
      label: `Cast ${def.active.name}`,
      onClick: () => game.startCast(id),
      // The Mana price used to live ONLY in the blocked reason, so it was
      // visible exactly when it could not be paid and invisible the rest of
      // the time. Inside the button it is always readable — and because the
      // red number is itself a reason, being unable to afford it says nothing
      // on the line below.
      cost: { Mana: def.active.manaCost },
      have: (c) => game.walletValue(c),
      disabledReason: block === 'NotAttuned' ? 'Wear it first' : undefined,
    });
  }
  controls.append(...options.map((o) => btn(o)));
  body.append(controls);

  const reasons = [...new Set(
    options.map((o) => o.disabledReason).filter((r): r is string => r !== undefined),
  )];
  if (reasons.length > 0) {
    body.append(el('div', { class: 'rel-blocked' },
      iconEl('padlock', { size: 'sm' }), reasons.join(' · ')));
  }

  // Levelling: Stardust buys levels, Fragments raise the ceiling.
  const atLevelCap = entry.level >= levelCapForTier(entry.tier);
  const maxed = entry.level >= COLLECTION.maxLevel;
  if (!maxed) {
    body.append(action({
      label: 'Study',
      onClick: () => game.doLevelArtifact(id),
      cost: { Stardust: levelCost(entry.level) },
      have: (c) => game.walletValue(c),
      disabledReason: atLevelCap
        ? 'Its tier holds it back — raise it with Fragments'
        : undefined,
    }));
  }
  if (entry.tier < COLLECTION.maxTier) {
    body.append(action({
      label: 'Raise its tier',
      onClick: () => game.doRaiseArtifactTier(id),
      // Fragments are a per-relic counter rather than a wallet entry, but a
      // price is a price: it goes in the button like every other one, reading
      // "have / needed" so the gap is the thing you see.
      costExtra: [{
        icon: 'sparkle',
        amount: `${entry.fragments} / ${tierCost(entry.tier)}`,
        short: entry.fragments < tierCost(entry.tier),
      }],
      info: entry.fragments < tierCost(entry.tier)
        ? `Delve ${RUINS[def.source].name} again for fragments`
        : undefined,
    }));
  }
  return body;
}

export function renderReliquarySheet(game: Game): HTMLElement {
  // A relic the save no longer knows cannot be open — the roster is fixed,
  // but a reset save is not, and a stale id would draw a card for nothing.
  if (game.openRelicId !== null && !(game.openRelicId in ARTIFACTS)) game.openRelicId = null;
  const open = game.openRelicId;
  if (open === null) {
    return sheet({ title: 'Reliquary', onClose: () => game.dismiss(), tall: true }, collection(game));
  }
  // The card is BARE: its art and its name are the title, and a plank above
  // them would print the name twice. The close knob on the stage is the way
  // back, and tapping beside the sheet still closes the screen.
  return sheet(
    {
      title: ARTIFACTS[open].name,
      onClose: () => game.dismiss(),
      bare: true,
      // Centred, not anchored to the bottom edge. A drawer is something you
      // pull up over a screen you are still working with; the card is the
      // whole of what the player is doing, so it sits in the middle.
      centred: true,
    },
    detail(game, open),
  );
}
