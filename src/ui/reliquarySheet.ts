// The Reliquary (Docs/features/08-magic.md §4) — where relics live.
//
// Heroes used to be a second tab here. They left on 2026-09-08 for a nav tab
// and a roster grid of their own (src/ui/heroesSheet.ts): the two share one
// collection LADDER, which was the argument for one screen, but they do not
// share a job. This screen's job is the SOCKET — which passive you are
// willing to go without — and a roster of thirty-two portraits under it made
// that decision the smaller half of the page.
//
// The screen has one job the HUD deliberately refuses to do: explain the Mana
// arithmetic. The header shows a pool and ONE net rate, because
// "+6/h base −4/h upkeep = +2/h" in a status bar is exactly the spreadsheet
// chrome the redesign exists to kill. Here, where the player has asked, the
// breakdown is the point.
//
// The other job is to make the SLOT feel like the constraint. Sockets come
// first, before the collection, and an empty one reads as an opportunity
// rather than an absence — because the decision the whole magic design turns
// on is which passive you are willing to go without.

import {
  ARTIFACTS, ARTIFACT_ORDER, ATTUNEMENT, COLLECTION, HEROES, RUINS,
} from '../sim/data/definitions';
import {
  artifactEntry, attunementSlotGemCost, attunementSlots, isAttuned, isSlotLocked,
  ownsArtifact, passiveValue, slotUnlocksIn,
} from '../sim/artifacts';
import { castBlock } from '../sim/casting';
import { levelCapForTier, levelCost, tierCost } from '../sim/collection';
import { manaRefillGemCost } from '../sim/mana';
import { resourceDiscoveryKey } from '../sim/discovery';
import { spriteUrl } from '../render/sprites';
import type { ArtifactId } from '../sim/state';
import type { Game } from '../game';
import { el, formatDuration } from './format';
import { action, btn, card, iconEl, pips, progress, sheet } from './kit';

/** Relic art at card size — sprite if it exists, glyph if not. */
function relicArt(id: ArtifactId, locked: boolean): HTMLElement {
  const def = ARTIFACTS[id];
  const url = spriteUrl(def.sprite);
  return url
    ? el('img', { class: `rel-art${locked ? ' is-locked' : ''}`, src: url, alt: '' })
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

// ------------------------------------------------------------------ the pool

function manaPanel(game: Game): HTMLElement {
  const m = game.manaInfo();
  const bar = progress('sky');
  bar.set(m.cap === 0 ? 0 : m.value / m.cap, `${m.value} / ${m.cap}`);

  const refillCost = manaRefillGemCost(game.state);
  // One line, not three. The breakdown existed to reconcile production against
  // relic upkeep; nothing draws against the pool any more, so a subtraction
  // that always reads "−0/h" is exactly the spreadsheet chrome this screen was
  // built to remove.
  const rows = el('div', { class: 'rel-breakdown' },
    el('div', { class: 'rel-line is-total' },
      el('span', {}, 'Drawn from the land'),
      el('b', {}, `+${m.production}/h`)),
  );

  return el('div', { class: 'rel-mana' },
    el('div', { class: 'rel-mana-head' },
      iconEl('Mana', { size: 'lg' }),
      el('div', { class: 'rel-mana-title' }, 'Mana'),
      el('div', { class: 'rel-mana-hint' }, m.over
        ? `Overcharged — ${m.value - m.cap} past the ceiling`
        : m.value >= m.cap
          ? 'Full — anything more is spilling'
          : `Full in about ${formatDuration(((m.cap - m.value) / Math.max(1, m.net)) * 3600)}`)),
    bar.root,
    rows,
    refillCost > 0
      ? action({
        label: 'Refill',
        kind: 'gem',
        onClick: () => game.doRefillMana(),
        cost: { Gems: refillCost },
        have: (c) => game.walletValue(c),
      })
      : el('div', { class: 'rel-note' }, 'The pool is full.'),
  );
}

// -------------------------------------------------------------- the Stardust

/**
 * The purse for this screen.
 *
 * Stardust has no coin on the plank: it buys levels for relics and heroes and
 * nothing else, so it reads here, beside the Study buttons that spend it, the
 * way Fragments do. The roster screen carries the same line, for the same
 * reason — a price with no purse in sight is a bug on whichever screen the
 * price is on. A price with no purse in sight is the same bug as a purse
 * with nothing to spend it on — this is the half that has to be here.
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

function slots(game: Game): HTMLElement {
  const now = game.now();
  const count = attunementSlots(game.state);
  const row = el('div', { class: 'rel-slots' });

  for (let i = 0; i < count; i++) {
    const worn = game.state.artifacts.attuned[i] ?? null;
    const locked = isSlotLocked(game.state, i, now);
    const socket = el('button', {
      class: `rel-socket${worn ? ' is-filled' : ''}${locked ? ' is-locked' : ''}`,
      type: 'button',
      'aria-label': worn ? `Remove ${ARTIFACTS[worn].name}` : 'Empty socket',
    });
    if (worn) {
      socket.append(relicArt(worn, false), el('span', { class: 'rel-socket-name' }, ARTIFACTS[worn].name));
      socket.addEventListener('click', () => game.doAttune(i, null));
    } else {
      socket.append(
        el('span', { class: 'rel-socket-empty' }, '◇'),
        el('span', { class: 'rel-socket-name' }, 'Empty'));
      socket.disabled = true;
    }
    if (locked) {
      socket.append(el('span', { class: 'rel-socket-lock' },
        iconEl('hourglass', { size: 'sm' }), `${Math.ceil(slotUnlocksIn(game.state, i, now))}s`));
    }
    row.append(socket);
  }

  const gemCost = attunementSlotGemCost(game.state);
  const body = el('div', { class: 'rel-section' },
    el('div', { class: 'rel-heading' },
      el('span', {}, 'Attuned'),
      el('span', { class: 'rel-heading-note' }, `${count} of ${ATTUNEMENT.maxSlots} sockets`)),
    row,
    el('div', { class: 'rel-note' },
      'A relic works while you wear it. Swapping takes hold at once, then the '
      + `socket settles for ${Math.round(ATTUNEMENT.swapLockSeconds / 60)} minutes.`),
  );

  if (count < ATTUNEMENT.maxSlots) {
    body.append(action({
      label: 'Open a socket',
      kind: 'gem',
      onClick: () => game.doBuyAttunementSlot(),
      cost: { Gems: gemCost },
      have: (c) => game.walletValue(c),
    }));
  }
  return body;
}

// ------------------------------------------------------------ the collection

function relicCard(game: Game, id: ArtifactId): HTMLElement {
  const def = ARTIFACTS[id];
  const owned = ownsArtifact(game.state, id);
  const entry = artifactEntry(game.state, id);
  const worn = isAttuned(game.state, id);

  if (!owned) {
    // An unfound relic is a SIGNPOST, not a locked box: it names the ruin, so
    // the fog has somewhere specific to go.
    return card({
      art: relicArt(id, true),
      name: def.name,
      desc: `Waiting in ${RUINS[def.source].name}`,
      locked: true,
    }, el('span', { class: 'rel-locked-tag' }, iconEl('padlock', { size: 'sm' })));
  }

  const body = el('div', { class: 'rel-card' },
    el('div', { class: 'rel-card-head' },
      relicArt(id, false),
      el('div', {},
        el('div', { class: 'rel-name' }, def.name),
        el('div', { class: 'rel-tier' },
          pips(entry.tier, COLLECTION.maxTier),
          el('span', {}, `Level ${entry.level} / ${levelCapForTier(entry.tier)}`)))),
    el('div', { class: 'rel-passive' },
      iconEl('sparkle', { size: 'sm' }), passiveLabel(game, id)),
  );

  // Attune OR arm. A relic underground has to SAY so on the card: `btn()` is
  // the button without its reason line, so a disabled Attune alone would grey
  // out with no answer to "where did my relic go?". The upkeep line above is
  // also a half-truth while it is away — carrying costs no Mana — so the
  // status line corrects it.
  const bearer = game.state.delves.find((d) => d.artifactId === id);
  if (bearer) {
    body.append(el('div', { class: 'rel-carried' },
      iconEl('army', { size: 'sm' }),
      `${HEROES[bearer.heroId].name} carries it, at depth ${bearer.depth}`
      + ' — it draws no Mana while it is away.'));
  }

  if (def.active) {
    body.append(el('div', { class: 'rel-active' },
      el('div', { class: 'rel-active-name' }, def.active.name),
      el('div', { class: 'rel-active-text' }, def.active.text)));
  } else {
    // Stated, not hidden: the slot rather than the ability is the constraint,
    // and this relic is the clearest proof of it.
    body.append(el('div', { class: 'rel-note' }, 'No ability — it simply works, always.'));
  }

  const controls = el('div', { class: 'rel-controls' });

  // Wear / remove.
  const slotIndex = game.state.artifacts.attuned.indexOf(id);
  const freeSlot = game.state.artifacts.attuned.indexOf(null);
  const now = game.now();
  if (worn) {
    controls.append(btn({
      label: 'Remove',
      onClick: () => game.doAttune(slotIndex, null),
      disabledReason: isSlotLocked(game.state, slotIndex, now)
        ? 'That socket is still settling' : undefined,
    }));
  } else {
    controls.append(btn({
      label: 'Attune',
      kind: 'primary',
      onClick: () => game.doAttune(freeSlot, id),
      disabledReason: bearer
        ? `${HEROES[bearer.heroId].name} carries it, at depth ${bearer.depth}`
        : freeSlot === -1
          ? 'Every socket is full'
          : isSlotLocked(game.state, freeSlot, now)
            ? 'That socket is still settling'
            : undefined,
    }));
  }

  if (def.active) {
    const block = castBlock(game.state, id);
    controls.append(btn({
      label: `Cast ${def.active.name}`,
      onClick: () => game.startCast(id),
      // The Mana price used to live ONLY in the blocked reason, so it was
      // visible exactly when it could not be paid and invisible the rest of
      // the time. Inside the button it is always readable.
      cost: { Mana: def.active.manaCost },
      have: (c) => game.walletValue(c),
      disabledReason: block === 'NotAttuned' ? 'Wear it first' : undefined,
    }));
  }
  body.append(controls);

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
  return el('div', { class: 'rel-entry' }, body);
}

export function renderReliquarySheet(game: Game): HTMLElement {
  const owned = ARTIFACT_ORDER.filter((id) => ownsArtifact(game.state, id));
  const missing = ARTIFACT_ORDER.filter((id) => !ownsArtifact(game.state, id));

  const relics = el('div', { class: 'rel-section' },
    el('div', { class: 'rel-heading' },
      el('span', {}, 'Relics'),
      el('span', { class: 'rel-heading-note' },
        `${owned.length} of ${ARTIFACT_ORDER.length} found`)),
    ...(owned.length === 0
      ? [el('div', { class: 'rel-note' },
        `Relics are won from ruins. There are ${Object.keys(RUINS).length} out there, `
        + 'and each holds exactly one — no luck involved.')]
      : owned.map((id) => relicCard(game, id))),
    ...missing.map((id) => relicCard(game, id)));

  const purse = stardustPanel(game);
  const body = el('div', { class: 'rel' },
    manaPanel(game),
    ...(purse === null ? [] : [purse]),
    slots(game),
    relics,
  );

  return sheet({ title: 'Reliquary', onClose: () => game.dismiss() }, body);
}
