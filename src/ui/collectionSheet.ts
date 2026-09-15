// THE RELICS (Docs/features/09-relics.md §11.2–§11.3) — the eight relics, and
// one relic with its album under it.
//
// TWO LEVELS, ONE OVERLAY, as the nav tab stays put: `game.openRelicId` is the
// whole of the navigation. It lives on the presenter for the reason
// `openHeroId` does — it survives the per-tick rebuild and is node-testable.
//
// IT USED TO BE THREE (M26, 2026-09-15). A relic's card and its album's page
// were separate screens, which put the thing nine cards are FOR one tap behind
// the nine cards, and the button that spends them on neither. They are one
// page now: what the relic does, what the next level does, the ability, and
// then the nine slots and the slab that closes them.
//
// SO THE GRID IS THE RELICS, not the albums. Which album a relic draws rotates
// a season (§3), so a grid ordered by album would move every relic under the
// player once a month; the roster's own order does not move. The album's own
// medallion is still drawn — inside the page, beside its name, and as the
// provisional face of all 72 cards.
//
// THE SCREEN REBUILDS ON THE TICK: the season's countdown is on it, and so is
// a relic's cooldown. Eight medallions and nine cards is seventeen images.

import { ARTIFACTS } from '../sim/data/definitions';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { AlbumId } from '../sim/data/seasons';
import type { ArtifactId } from '../sim/state';
import type { Game } from '../game';
import { el, formatDuration } from './format';
import { action, btn, iconEl, knob, progress, sheet } from './kit';
import { relicStatChanges } from './relicStats';

/** An album's round vignette — its sheet if it has landed, its relic's
 *  otherwise, so the grid is never a row of empty rings. */
function albumArt(album: AlbumId, relic: ArtifactId, cls: string): HTMLElement {
  const url = spriteUrl(`album_${album.toLowerCase()}`) ?? spriteUrl(ARTIFACTS[relic].sprite);
  return url
    ? spriteImgAt(url, cls)
    : el('div', { class: `${cls} is-glyph` }, ARTIFACTS[relic].glyph);
}

/** Relic art at any size — sprite if it exists, glyph if not. */
function relicArt(id: ArtifactId, cls: string): HTMLElement {
  const url = spriteUrl(ARTIFACTS[id].sprite);
  return url ? spriteImgAt(url, cls) : el('div', { class: `${cls} is-glyph` }, ARTIFACTS[id].glyph);
}

const stars = (n: number, cls = 'col-stars'): HTMLElement =>
  el('span', { class: cls }, ...Array.from({ length: n }, () => iconEl('star', { size: 'sm' })));

// ------------------------------------------------------------ §11.2 the grid

/**
 * The prize band: what the five albums are FOR.
 *
 * It is the screen's lede rather than a line at the bottom, because the
 * collection prize — a golden call guaranteed to be the season hero, and
 * 25,000 Gems — is the only thing on this screen worth 45 cards.
 */
function prizeBand(game: Game): HTMLElement {
  const info = game.seasonInfo();
  return el('div', { class: `col-band${info.prizeWon ? ' is-done' : ''}` },
    el('div', { class: 'col-band-kicker' },
      info.prizeWon ? 'The season is yours' : 'Complete all eight to win'),
    el('div', { class: 'col-band-prizes' },
      el('div', { class: 'col-prize' },
        iconEl('GoldKey', { size: 'lg' }),
        el('span', {}, 'Hero call')),
      el('div', { class: 'col-prize' },
        iconEl('Gems', { size: 'lg' }),
        el('span', {}, game.prizeGems().toLocaleString()))),
  );
}

/** One line: how long the season has left, and how much of it is in hand. */
function seasonLine(game: Game): HTMLElement {
  const info = game.seasonInfo();
  const bar = progress('gold');
  bar.set(info.held / info.total);
  return el('div', { class: 'col-line' },
    el('span', { class: 'col-left' },
      iconEl('hourglass', { size: 'sm' }),
      info.leftMs <= 0 ? 'closing' : `${formatDuration(info.leftMs / 1000)} left`),
    bar.root,
    // The lap only appears once there has been one: a first season never
    // mentions a number that would mean nothing to it.
    ...(info.lap > 0 ? [el('span', { class: 'col-lap' }, `Lap ${info.lap + 1}`)] : []),
    el('span', { class: 'col-count' }, `${info.held}/${info.total}`));
}

/** The vault knob — the safe in the corner of the screen it belongs to. */
function vaultKnob(game: Game): HTMLElement {
  const vault = game.vaultInfo();
  const button = el('button', {
    class: `col-vault${vault.affordable ? ' is-ready' : ''}`,
    type: 'button',
    'aria-label': `The vault — ${vault.stars} stars`,
  },
    iconEl('vault', { size: 'lg' }),
    el('span', { class: 'col-vault-stars' },
      iconEl('star', { size: 'sm' }), String(vault.stars)));
  button.addEventListener('click', () => game.openVault());
  return button;
}

/**
 * THE VAULT'S SHELF. Three chests, what each costs in stars, and what it
 * guarantees — plus a ten at once, because a player finishing a season cashes
 * the vault scores of times for a card or two each and the problem is the
 * screens rather than the chests.
 */
function vaultShelf(game: Game): HTMLElement {
  const stars = game.vaultInfo().stars;
  const rows = game.vaultShelf().map((row) => el('div', {
    class: `col-chest${row.affordable ? ' is-ready' : ''}`,
  },
    el('div', { class: 'col-chest-head' },
      el('span', { class: 'col-chest-name' }, row.tier.replace('Chest', ' chest')),
      el('span', { class: 'col-chest-cost' },
        iconEl('star', { size: 'sm' }), String(row.cost))),
    el('div', { class: 'col-chest-promise' }, row.promise),
    el('div', { class: 'col-chest-buttons' },
      btn({
        label: 'Open one',
        kind: row.affordable ? 'primary' : 'secondary',
        onClick: () => game.doBuyFromVault(row.tier),
      }),
      btn({
        label: `Open ten — ${row.cost * 10}`,
        kind: 'secondary',
        onClick: () => game.doBuyFromVaultMany(row.tier),
      })),
  ));
  return el('div', { class: 'col-vault-shelf' },
    el('div', { class: 'col-vault-line' },
      iconEl('star', { size: 'lg' }),
      el('b', {}, String(stars)),
      el('span', {}, 'from the duplicates you have opened')),
    ...rows);
}

/** The eight relics. Each ring holds the RELIC, with its level on a tab and
 *  its album's progress under the name — one line that says both what you
 *  have and how close the next level is. */
function relicGrid(game: Game): HTMLElement {
  const tiles = game.relicRows().map((row) => {
    const tile = el('button', {
      class: `col-medal${row.complete ? ' is-done' : ''}${row.claimable ? ' is-ready' : ''}`,
      type: 'button',
      'aria-label': `${row.name} — ${row.albumName}, ${row.held} of ${row.total}`,
    },
      el('span', { class: 'col-ring' },
        relicArt(row.id, 'col-medal-art'),
        el('span', { class: `col-badge${row.level === 0 ? ' is-locked' : ''}` },
          row.level === 0
            ? iconEl('padlock', { size: 'sm' })
            : el('span', { class: 'col-badge-lv' }, `Lv ${row.level}`)),
        // A PAGE READY TO CLOSE is the only thing on this screen worth a mark:
        // nothing closes itself any more, so an unclaimed album would
        // otherwise sit there saying nothing.
        row.claimable ? el('span', { class: 'col-tick' }, iconEl('tick', { size: 'sm' })) : ''),
      el('span', { class: 'col-medal-name' }, row.name),
      el('span', { class: 'col-medal-count' }, `${row.held}/${row.total}`));
    tile.addEventListener('click', () => game.openRelic(row.id));
    return tile;
  });
  return el('div', { class: 'col-grid' }, ...tiles);
}

// ----------------------------------------------------------- §11.3 an album

/**
 * THE SLAB THAT CLOSES THE ALBUM, at the foot of the page — what the nine
 * cards are for, under the nine cards.
 *
 * The chips say what this close pays THIS LAP, so a repeat shows no Gems
 * rather than a struck-through one (§5.1): a reward that is not coming should
 * not be on the button at all.
 */
function claimSlab(game: Game, page: ReturnType<Game['albumPage']>): HTMLElement {
  const chips = el('div', { class: 'col-chips' },
    el('div', { class: 'col-chip is-relic' },
      relicArt(page.relic, 'col-chip-art'),
      el('span', {}, page.relicLevel === 0 ? page.relicName : '+1 level')),
    el('div', { class: 'col-chip' },
      iconEl('hourglass', { size: 'sm' }),
      el('span', {}, `${page.rewards.hours}h`),
      el('small', {}, 'of everything')),
    el('div', { class: 'col-chip' },
      page.rewards.goldKeys > 0
        ? iconEl('GoldKey', { size: 'sm' })
        : iconEl('SilverKey', { size: 'sm' }),
      el('span', {}, String(page.rewards.goldKeys + page.rewards.silverKeys))),
    ...(page.rewards.gems > 0
      ? [el('div', { class: 'col-chip' },
        iconEl('Gems', { size: 'sm' }),
        el('span', {}, page.rewards.gems.toLocaleString()))]
      : []));

  // A CLOSED PAGE SAYS SO AND OFFERS NOTHING. It reopens when the lap rolls,
  // which is the eight albums' business and not this button's.
  if (page.complete) {
    return el('div', { class: 'col-claim is-done' },
      el('div', { class: 'col-band-kicker' }, 'Closed — it opens again next lap'),
      chips);
  }
  return el('div', { class: `col-claim${page.claimable ? ' is-ready' : ''}` },
    chips,
    // A SHORT PAGE SAYS HOW SHORT, on the padlocked line `action` already
    // draws above a dead button — the count IS the reason, so it needs no
    // second sentence.
    action({
      label: 'Complete the album',
      kind: 'primary',
      onClick: () => game.doClaimAlbum(page.id),
      ...(page.claimable
        ? { info: 'It spends the nine — duplicates stay' }
        : { disabledReason: `${page.total - page.held} more to close it` }),
    }));
}

/**
 * The strip that says a wildcard is ARMED (§9).
 *
 * Select-then-place, the idiom placement and cast modes already use: the MODE
 * is visible while the thumb is moving, which is what a one-tap consumable
 * needs — a confirmation dialog after the fact would be the worse answer.
 */
function wildcardStrip(game: Game, page: ReturnType<Game['albumPage']>): HTMLElement | '' {
  const armed = game.armedWildcard;
  if (armed !== null) {
    const cancel = knob('✕', () => game.armWildcard(null), { label: 'Put it away' });
    return el('div', { class: 'col-arm is-armed' },
      iconEl('cards', { size: 'lg' }),
      el('span', { class: 'col-arm-line' }, `Tap a card to use your ${armed}★ wildcard`),
      cancel);
  }
  const held = game.wildcardsHeld();
  if (held.length === 0 || page.complete) return '';
  return el('div', { class: 'col-arm' },
    iconEl('cards', { size: 'lg' }),
    el('span', { class: 'col-arm-line' }, held.length === 1
      ? `You hold a ${held[0]!.rarity}★ wildcard`
      : 'You hold wildcards'),
    ...held.map((w) => {
      const b = btn({
        label: `${w.rarity}★${w.count > 1 ? ` ×${w.count}` : ''}`,
        kind: 'secondary',
        onClick: () => game.armWildcard(w.rarity),
      });
      b.classList.add('col-arm-pick');
      return b;
    }));
}

/** One of the nine slots. Held: its art, its name on a ribbon, its duplicate
 *  count. Missing: a silhouette that still shows the rarity, because what a
 *  page is MISSING is as much of the content as what it holds. */
function cardTile(
  game: Game, page: ReturnType<Game['albumPage']>,
  card: ReturnType<Game['albumPage']>['cards'][number],
): HTMLElement {
  const held = card.count >= 1;
  // While a wildcard is armed the grid says where it can land, so the player
  // never spends one to find out.
  const fits = game.wildcardFits(page.id, card.slot);
  const tile = el('button', {
    class: `col-card r${card.rarity}${card.gold ? ' is-gold' : ''}`
      + `${held ? '' : ' is-missing'}${fits ? ' is-fillable' : ''}`,
    type: 'button',
    'aria-label': held
      ? `${card.name} ×${card.count}`
      : `${card.name} — ${fits ? 'a wildcard fills it' : 'not found'}`,
  },
    stars(card.rarity, 'col-card-stars'),
    held
      ? albumArt(page.id, page.relic, 'col-card-art')
      : el('span', { class: 'col-card-art is-silhouette' },
        iconEl(fits ? 'plus' : 'unknown', { size: 'lg' })),
    card.count > 1 ? el('span', { class: 'col-dupe' }, `+${card.count - 1}`) : '',
    el('span', { class: 'col-card-name' }, card.name));
  tile.addEventListener('click', () => game.tapCard(page.id, card.slot));
  return tile;
}

/** The album half: its medallion and name, the nine slots, and the slab. */
function albumHalf(game: Game, id: AlbumId): HTMLElement {
  const page = game.albumPage(id);
  const bar = progress('gold');
  bar.set(page.held / page.total, `${page.held}/${page.total}`);
  return el('div', { class: 'col-album' },
    el('div', { class: 'col-album-head' },
      el('span', { class: 'col-album-medal' }, albumArt(page.id, page.relic, 'col-album-medal-art')),
      el('span', { class: 'col-album-name' }, page.name),
      bar.root),
    wildcardStrip(game, page),
    el('div', { class: 'col-cards' }, ...page.cards.map((c) => cardTile(game, page, c))),
    claimSlab(game, page));
}

// ------------------------------------------------- §11.3 one relic's page

/**
 * THE PASSIVE, as a band of small tiles rather than two sentences.
 *
 * It is the building card's band (`districtCard.ts`, `.dc-stats`) with a
 * DELTA in each tile, because a relic's page is also its upgrade screen —
 * there is no separate popup to hold the *before → after*, so the two live in
 * one box.
 *
 * NO HEADING OVER IT. The prose beside the art already says what the passive
 * IS; a word saying "passive" above the numbers would be the same fact twice,
 * and the section that DOES need naming is the one under it.
 */
function passiveBand(game: Game, id: ArtifactId, level: number): HTMLElement {
  const stats = relicStatChanges(id, Math.max(1, level));
  return el('div', { class: 'col-stats' },
    ...stats.map((f) => el('div', { class: `col-stat${f.changed ? '' : ' is-same'}` },
      iconEl(f.icon, { size: 'lg' }),
      el('div', { class: 'col-stat-body' },
        el('div', { class: 'col-stat-label' }, f.label),
        el('div', { class: 'col-stat-nums' },
          el('b', { class: 'col-stat-value' }, f.value),
          iconEl('arrowUp', { size: 'sm' }),
          el('b', { class: 'col-stat-to' }, f.to))))));
  void game;
}

/**
 * THE SPELL (§2.1) — the relic's other half, and the only section on the page
 * that is NAMED, because a button needs to say what it belongs to.
 *
 * Three states walk through here. READY draws the cast button; ACTIVE and
 * COOLDOWN draw a countdown INSTEAD of it, wearing no padlock: a relic that
 * is running is doing its job, not blocked. And a relic whose spell is not
 * written yet says so in muted ink rather than showing an empty section — the
 * same rule a pending passive follows, and for the same reason.
 */
function spellSection(game: Game, id: ArtifactId, card: ReturnType<Game['relicCard']>): HTMLElement {
  const active = ARTIFACTS[id].active;
  const head = el('div', { class: 'col-section' }, el('span', {}, 'Spell'));
  if (active === null) {
    return el('div', { class: 'col-spell is-pending' }, head,
      el('div', { class: 'col-effect-wait' },
        iconEl('hourglass', { size: 'sm' }), 'Its spell is still being written'));
  }
  const body = el('div', { class: 'col-spell' }, head,
    el('div', { class: 'col-spell-head' },
      el('div', { class: 'col-spell-name' }, active.name),
      el('div', { class: 'col-spell-what' }, active.text)),
    el('div', { class: 'col-spell-chips' },
      el('span', { class: 'col-chip' }, iconEl('Mana', { size: 'sm' }), el('b', {}, String(active.manaCost))),
      ...(active.durationSeconds > 0
        ? [el('span', { class: 'col-chip' },
          iconEl('hourglass', { size: 'sm' }),
          el('b', {}, formatDuration(active.durationSeconds)))]
        : []),
      ...(active.radius > 0
        ? [el('span', { class: 'col-chip' },
          iconEl('compass', { size: 'sm' }), el('b', {}, `radius ${active.radius}`))]
        : [])));

  if (!card.owned) return body;
  const { phase, leftMs } = card.cast;
  const left = formatDuration(Math.ceil(leftMs / 1000));
  body.append(phase === 'Ready'
    ? btn({
      label: `Cast ${active.name}`,
      kind: 'primary',
      onClick: () => game.startCast(id),
    })
    : el('div', { class: `col-cast-phase is-${phase.toLowerCase()}` },
      iconEl('hourglass', { size: 'sm' }),
      el('span', {}, phase === 'Active'
        ? `${active.name} is running — ${left} left`
        : `Ready again in ${left}`)));
  return body;
}

/**
 * ONE RELIC, and its album under it (M26, 2026-09-15).
 *
 * THE ART SITS LEFT so the space beside it can carry something: the name, and
 * the sentence that says what the passive DOES. Stacked, the right half was
 * empty and the page told the player nothing until they scrolled.
 *
 * THE LEVEL RIDES THE ART'S OWN CORNER, as a bare label with no plaque under
 * it. A slab in the middle of the frame covered the thing the player opened
 * the page to look at.
 *
 * "+1 level when its album closes" is NOT here. It was a promise about the
 * nine cards, and the nine cards are on this same page now, under a button
 * that says exactly that — so up here it was the same sentence twice.
 */
function relicPage(game: Game, id: ArtifactId): HTMLElement {
  const card = game.relicCard(id);
  const prev = knob('‹', () => game.stepRelic(-1), { label: 'The relic before' });
  const next = knob('›', () => game.stepRelic(1), { label: 'The relic after' });
  return el('div', { class: 'col-relic' },
    el('div', { class: 'col-relic-head' },
      el('div', { class: 'col-stage' },
        relicArt(id, 'col-stage-art'),
        el('span', { class: 'col-level' }, card.owned ? `Level ${card.level}` : 'Not found')),
      el('div', { class: 'col-relic-id' },
        el('div', { class: 'col-relic-name' }, card.name),
        // WHY THE NUMBERS BELOW DO NOTHING YET, when that is the case. A relic
        // is a whole album, so a page promising what the build cannot pay
        // would be lying to somebody who spent one.
        card.pending === null
          ? ''
          : el('div', { class: 'col-effect-wait' },
            iconEl('hourglass', { size: 'sm' }), card.pending),
        el('div', { class: 'col-relic-what' }, card.owned ? card.now : card.next))),
    passiveBand(game, id, card.level),
    spellSection(game, id, card),
    albumHalf(game, card.album),
    el('div', { class: 'col-walk' },
      prev,
      el('span', { class: 'col-walk-label' }, card.albumName),
      next),
  );
}

// ------------------------------------------------------------------ the sheet

export function renderCollectionSheet(game: Game): HTMLElement {
  // A relic the save no longer knows cannot be open — the eight are fixed, but
  // a reset save is not, and a stale id would draw nothing.
  if (game.openRelicId !== null && !(game.openRelicId in ARTIFACTS)) game.openRelicId = null;
  const relic = game.openRelicId;
  if (relic !== null) {
    // TALL, not bare: it carries the nine cards now, so it is a page to walk
    // down rather than a card to read.
    return sheet(
      { title: ARTIFACTS[relic].name, onClose: () => game.closeRelic(), tall: true },
      relicPage(game, relic),
    );
  }

  if (game.vaultOpen) {
    return sheet(
      { title: 'The vault', onClose: () => game.closeVault() },
      vaultShelf(game),
    );
  }

  const info = game.seasonInfo();
  const body = el('div', { class: `col-season is-${info.frame}` },
    prizeBand(game),
    seasonLine(game),
    relicGrid(game),
  );
  // The pack the player has not opened is the one thing on this screen that
  // asks for a tap, so it sits under the grid as the only slab.
  const pack = game.peekPack();
  if (pack !== null) {
    body.append(btn({
      label: `Open the ${pack.tier} pack`,
      onClick: () => game.doOpenPack(),
      kind: 'primary',
      note: `${pack.cards} cards${info.packs > 1 ? ` · ${info.packs} waiting` : ''}`,
    }));
  }
  body.append(vaultKnob(game));
  return sheet({ title: info.name, onClose: () => game.dismiss(), tall: true }, body);
}
