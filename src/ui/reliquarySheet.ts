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
  ARTIFACTS, ARTIFACT_ORDER, ATTUNEMENT, COLLECTION, HEROES, RUINS,
} from '../sim/data/definitions';
import { heroIsBusy } from '../sim/expeditions';
import {
  heroChanceAt, heroStats, pityCount, pullCost, pullsToGuarantee, rosterView, STANDARD_BANNER,
} from '../sim/heroes';
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
import { action, btn, card, iconEl, pips, progress, sheet, stat } from './kit';

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
        cost: { Gems: refillCost },
        have: (c) => game.effectiveWalletValue(c),
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
      cost: { Gems: gemCost },
      have: (c) => game.effectiveWalletValue(c),
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
    el('div', { class: 'rel-upkeep' },
      stat('Mana', `−${def.upkeep}`, 'per hour while worn')),
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
      have: (c) => game.effectiveWalletValue(c),
      disabledReason: block === 'NotAttuned' ? 'Wear it first' : undefined,
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
      cost: { Knowledge: levelCost(entry.level) },
      have: (c) => game.effectiveWalletValue(c),
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

// -------------------------------------------------------------- the heroes
//
// Heroes and relics are TWO TABS OF ONE SCREEN because they share one set of
// rules — Fragments raise a tier cap, Knowledge buys levels within it. Two
// screens would teach the player the same lesson twice and neither would feel
// special.

function heroCard(game: Game, view: ReturnType<typeof rosterView>[number]): HTMLElement {
  const hero = HEROES[view.id];
  const stats = heroStats(game.state, view.id);
  const busy = heroIsBusy(game.state, view.id);

  const art = spriteUrl(hero.sprite);

  if (!view.owned) {
    // The SILHOUETTE, desaturated — not a stand-in glyph. A locked hero the
    // player can already see is something to want; a padlock over a box is
    // not. Same treatment the locked relics get.
    return card({
      art: art
        ? el('img', { class: 'rel-art is-locked', src: art, alt: '' })
        : el('div', { class: 'rel-art rel-art--glyph is-locked' }, hero.glyph),
      name: hero.name,
      desc: view.entry.fragments > 0
        ? 'Not yet found — their fragments are adding up'
        : 'Not yet found — the banner might bring them',
      locked: true,
    }, el('span', { class: 'rel-frag' },
      iconEl('sparkle', { size: 'sm' }),
      `${view.entry.fragments}`));
  }
  const body = el('div', { class: 'rel-card' },
    el('div', { class: 'rel-card-head' },
      art ? el('img', { class: 'rel-art', src: art, alt: '' })
        : el('div', { class: 'rel-art rel-art--glyph' }, hero.glyph),
      el('div', {},
        el('div', { class: 'rel-name' }, hero.name),
        el('div', { class: 'rel-tier' },
          pips(view.entry.tier, COLLECTION.maxTier),
          el('span', {}, `Level ${view.entry.level} / ${view.levelCap}`)))),
    el('div', { class: 'rel-passive' }, iconEl('sparkle', { size: 'sm' }), hero.traitText),
    el('div', { class: 'rel-hero-stats' },
      stat('army', String(stats.atk), 'atk'),
      stat('padlock', String(stats.def), 'def'),
      stat('population', String(stats.hp), 'hp'),
      stat(hero.unitType, hero.unitType, 'fights as')),
    ...(busy ? [el('div', { class: 'rel-note' }, 'Currently underground.')] : []),
  );

  if (view.entry.level < COLLECTION.maxLevel) {
    const cost = levelCost(view.entry.level);
    body.append(action({
      label: 'Train',
      onClick: () => game.doLevelHero(view.id),
      cost: { Knowledge: cost },
      have: (c) => game.effectiveWalletValue(c),
      disabledReason: view.entry.level >= view.levelCap
        ? 'Their tier holds them back — raise it with Fragments'
        : undefined,
    }));
  }
  if (view.entry.tier < COLLECTION.maxTier) {
    body.append(action({
      label: 'Raise their tier',
      onClick: () => game.doRaiseHeroTier(view.id),
      costExtra: [{
        icon: 'sparkle',
        amount: `${view.entry.fragments} / ${tierCost(view.entry.tier)}`,
        short: view.entry.fragments < tierCost(view.entry.tier),
      }],
      info: view.entry.fragments < tierCost(view.entry.tier)
        ? 'Pull for them, or delve again' : undefined,
    }));
  }
  return el('div', { class: 'rel-entry' }, body);
}

/**
 * The banner. Reachable from the reliquary rather than from the nav bar,
 * deliberately: a gacha with its own permanent tab is a different game from
 * the one this is.
 *
 * The pity counter is ALWAYS visible. A hidden pity counter is the same as no
 * pity counter — it is the single thing that makes a gacha read as fair rather
 * than predatory, and it only works if the player can see it working.
 */
function bannerPanel(game: Game): HTMLElement {
  const cost = pullCost();
  const pity = pityCount(game.state, STANDARD_BANNER);
  const toGuarantee = pullsToGuarantee(game.state, STANDARD_BANNER);
  const chance = heroChanceAt(pity);

  return el('div', { class: 'rel-banner' },
    el('div', { class: 'rel-banner-head' },
      iconEl('Gems', { size: 'lg' }),
      el('div', {},
        el('div', { class: 'rel-mana-title' }, 'Call for aid'),
        el('div', { class: 'rel-mana-hint' },
          'Every miss still pays fragments. There are no wasted calls.'))),
    el('div', { class: 'rel-breakdown' },
      el('div', { class: 'rel-line' },
        el('span', {}, 'Chance of a hero right now'),
        el('b', {}, `${Math.round(chance * 100)}%`)),
      el('div', { class: 'rel-line is-total' },
        el('span', {}, 'Guaranteed within'),
        el('b', {}, `${toGuarantee} call${toGuarantee === 1 ? '' : 's'}`))),
    action({
      label: 'Call',
      kind: 'gem',
      onClick: () => game.doPull(),
      cost: { Gems: cost },
      have: (c) => game.effectiveWalletValue(c),
    }),
    el('div', { class: 'rel-note' },
      'Heroes can also be found by delving: fragments come back from every ruin, '
      + 'and enough of them raise anyone you already have.'),
  );
}

/** Which tab is open. Module-level so it survives the per-tick rebuild — the
 *  same reason the market's amount selector lives outside its render. */
let openTab: 'relics' | 'heroes' = 'relics';

export function renderReliquarySheet(game: Game): HTMLElement {
  const owned = ARTIFACT_ORDER.filter((id) => ownsArtifact(game.state, id));
  const missing = ARTIFACT_ORDER.filter((id) => !ownsArtifact(game.state, id));

  const tabs = el('div', { class: 'rel-tabs' },
    ...(['relics', 'heroes'] as const).map((tab) => {
      const b = el('button', {
        class: `rel-tab${openTab === tab ? ' is-active' : ''}`, type: 'button',
      }, tab === 'relics' ? 'Relics' : 'Heroes');
      b.addEventListener('click', () => {
        openTab = tab;
        game.notify();
      });
      return b;
    }));

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

  const roster = rosterView(game.state);
  const heroes = el('div', { class: 'rel-section' },
    el('div', { class: 'rel-heading' },
      el('span', {}, 'Heroes'),
      el('span', { class: 'rel-heading-note' },
        `${roster.filter((h) => h.owned).length} of ${roster.length} found`)),
    ...roster.map((view) => heroCard(game, view)),
    bannerPanel(game));

  const body = el('div', { class: 'rel' },
    manaPanel(game),
    slots(game),
    tabs,
    openTab === 'relics' ? relics : heroes,
  );

  return sheet({ title: 'Reliquary', onClose: () => game.dismiss() }, body);
}
