// The Reliquary (Docs/features/magic.md §5) — where relics live.
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
  ARTIFACTS, ARTIFACT_ORDER, ATTUNEMENT, COLLECTION, RUINS,
} from '../sim/data/definitions';
import {
  artifactEntry, attunementSlotGemCost, attunementSlots, isAttuned, isSlotLocked,
  ownsArtifact, passiveValue, slotUnlocksIn,
} from '../sim/artifacts';
import { castBlock } from '../sim/casting';
import { levelCapForTier, levelCost, tierCost } from '../sim/collection';
import { manaRefillGemCost } from '../sim/mana';
import { spriteUrl } from '../render/sprites';
import type { ArtifactId } from '../sim/state';
import type { Game } from '../game';
import { el, formatDuration } from './format';
import { action, btn, card, chip, iconEl, pips, progress, sheet, stat } from './kit';

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
  const rows = el('div', { class: 'rel-breakdown' },
    // The two dials, named as the different jobs they do.
    el('div', { class: 'rel-line' },
      el('span', {}, 'Drawn from the land'),
      el('b', {}, `+${m.production}/h`)),
    el('div', { class: `rel-line${m.upkeep > 0 ? ' is-cost' : ''}` },
      el('span', {}, 'Sustaining your relics'),
      el('b', {}, m.upkeep > 0 ? `−${m.upkeep}/h` : '0/h')),
    el('div', { class: 'rel-line is-total' },
      el('span', {}, m.net === 0 && m.upkeep > 0 ? 'Stalled — but never in debt' : 'Filling at'),
      el('b', {}, `+${m.net}/h`)),
  );

  return el('div', { class: 'rel-mana' },
    el('div', { class: 'rel-mana-head' },
      iconEl('Mana', { size: 'lg' }),
      el('div', { class: 'rel-mana-title' }, 'Mana'),
      el('div', { class: 'rel-mana-hint' }, m.value >= m.cap
        ? 'Full — anything more is spilling'
        : `Full in about ${formatDuration(((m.cap - m.value) / Math.max(1, m.net)) * 3600)}`)),
    bar.root,
    rows,
    refillCost > 0
      ? action({
        label: 'Refill',
        kind: 'gem',
        onClick: () => game.doRefillMana(),
        info: chip('Gems', refillCost, game.effectiveWalletValue('Gems') < refillCost),
        disabledReason: game.effectiveWalletValue('Gems') < refillCost
          ? `Short ${refillCost - game.effectiveWalletValue('Gems')} Gems` : undefined,
      })
      : el('div', { class: 'rel-note' }, 'The pool is full.'),
  );
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
      info: chip('Gems', gemCost, game.effectiveWalletValue('Gems') < gemCost),
      disabledReason: game.effectiveWalletValue('Gems') < gemCost
        ? `Short ${gemCost - game.effectiveWalletValue('Gems')} Gems` : undefined,
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
  const knowledge = game.effectiveWalletValue('Knowledge');

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
    el('div', { class: 'rel-upkeep' },
      stat('Mana', `−${def.upkeep}`, 'per hour while worn')),
  );

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
      disabledReason: freeSlot === -1
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
      icon: 'Mana',
      disabledReason: block === 'NotAttuned'
        ? 'Wear it first'
        : block === 'NotEnoughMana'
          ? `Needs ${def.active.manaCost} Mana`
          : undefined,
    }));
  }
  body.append(controls);

  // Levelling: Knowledge buys levels, Fragments raise the ceiling.
  const atLevelCap = entry.level >= levelCapForTier(entry.tier);
  const maxed = entry.level >= COLLECTION.maxLevel;
  if (!maxed) {
    body.append(action({
      label: 'Study',
      onClick: () => game.doLevelArtifact(id),
      info: chip('Knowledge', levelCost(entry.level), knowledge < levelCost(entry.level)),
      disabledReason: atLevelCap
        ? 'Its tier holds it back — raise it with Fragments'
        : knowledge < levelCost(entry.level)
          ? `Short ${levelCost(entry.level) - knowledge} Knowledge`
          : undefined,
    }));
  }
  if (entry.tier < COLLECTION.maxTier) {
    body.append(action({
      label: 'Raise its tier',
      onClick: () => game.doRaiseArtifactTier(id),
      info: el('span', { class: 'rel-frag' },
        iconEl('sparkle', { size: 'sm' }),
        `${entry.fragments} / ${tierCost(entry.tier)} fragments`),
      disabledReason: entry.fragments < tierCost(entry.tier)
        ? `Delve ${RUINS[def.source].name} again for fragments`
        : undefined,
    }));
  }
  return el('div', { class: 'rel-entry' }, body);
}

export function renderReliquarySheet(game: Game): HTMLElement {
  const owned = ARTIFACT_ORDER.filter((id) => ownsArtifact(game.state, id));
  const missing = ARTIFACT_ORDER.filter((id) => !ownsArtifact(game.state, id));

  const body = el('div', { class: 'rel' },
    manaPanel(game),
    slots(game),
    el('div', { class: 'rel-section' },
      el('div', { class: 'rel-heading' },
        el('span', {}, 'Relics'),
        el('span', { class: 'rel-heading-note' },
          `${owned.length} of ${ARTIFACT_ORDER.length} found`)),
      ...(owned.length === 0
        ? [el('div', { class: 'rel-note' },
          `Relics are won from ruins. There are ${Object.keys(RUINS).length} out there, `
          + 'and each holds exactly one — no luck involved.')]
        : owned.map((id) => relicCard(game, id))),
      ...missing.map((id) => relicCard(game, id))),
  );

  return sheet({ title: 'Reliquary', onClose: () => game.dismiss() }, body);
}
