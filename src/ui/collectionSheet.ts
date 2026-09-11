// The Collection (Docs/features/09-relics.md §11.2–§11.4) — the season's five
// albums, one album's nine cards, and one relic's card.
//
// THREE LEVELS, ONE OVERLAY, as the nav tab stays put: `game.openAlbumId` and
// `game.openRelicId` decide which of them draws. Both live on the presenter
// for the reason `openHeroId` does — they survive the per-tick rebuild and
// they are node-testable.
//
// M21 draws the top level as ROUND MEDALLIONS, three and two, and that is the
// whole reason the relics strip of an earlier draft is gone: one album per
// relic means the five medallions already ARE the five relics, and a strip
// above them would be the same list twice. So the relic rides its own
// medallion as a badge with its level on it.
//
// THE SCREEN REBUILDS ON THE TICK: the season's countdown is on it. Five
// medallions and nine cards is fourteen images, not thirty-two.

import { ARTIFACTS } from '../sim/data/definitions';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { AlbumId } from '../sim/data/seasons';
import type { ArtifactId } from '../sim/state';
import type { Game } from '../game';
import { el, formatDuration } from './format';
import { action, btn, iconEl, knob, progress, sheet } from './kit';

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
  return el('div', { class: `col-band${info.complete ? ' is-done' : ''}` },
    el('div', { class: 'col-band-kicker' },
      info.complete ? 'The season is yours' : 'Complete all five to win'),
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

function albumGrid(game: Game): HTMLElement {
  const tiles = game.albumRows().map((row) => {
    const tile = el('button', {
      class: `col-medal${row.complete ? ' is-done' : ''}`,
      type: 'button',
      'aria-label': `${row.name} — ${row.held} of ${row.total}`,
    },
      el('span', { class: 'col-ring' },
        albumArt(row.id, row.relic, 'col-medal-art'),
        // The relic rides its own album. Silhouetted while it is unfound, so
        // the grid says which five relics exist without a second list.
        el('span', { class: `col-badge${row.relicLevel === 0 ? ' is-locked' : ''}` },
          row.relicLevel === 0
            ? iconEl('padlock', { size: 'sm' })
            : el('span', { class: 'col-badge-lv' }, `Lv ${row.relicLevel}`)),
        row.complete ? el('span', { class: 'col-tick' }, iconEl('tick', { size: 'sm' })) : ''),
      el('span', { class: 'col-medal-name' }, row.name),
      el('span', { class: 'col-medal-count' }, `${row.held}/${row.total}`));
    tile.addEventListener('click', () => game.openAlbum(row.id));
    return tile;
  });
  return el('div', { class: 'col-grid' }, ...tiles);
}

// ----------------------------------------------------------- §11.3 an album

/** The reward band across the top of an album: the relic, then the three
 *  things the ninth card pays, struck through once it has. */
function rewardBand(game: Game, page: ReturnType<Game['albumPage']>): HTMLElement {
  const relicChip = el('button', {
    class: 'col-relic-frame', type: 'button', 'aria-label': page.relicName,
  },
    relicArt(page.relic, 'col-relic-art'),
    el('span', { class: 'col-relic-lv' },
      page.relicLevel === 0 ? 'Locked' : `Lv ${page.relicLevel}`));
  relicChip.addEventListener('click', () => game.openRelic(page.relic));
  return el('div', { class: `col-reward${page.complete ? ' is-done' : ''}` },
    relicChip,
    el('div', { class: 'col-reward-body' },
      el('div', { class: 'col-band-kicker' },
        page.complete ? 'The album is complete' : 'Complete the album to win'),
      el('div', { class: 'col-chips' },
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
          iconEl('Gems', { size: 'sm' }),
          el('span', {}, page.rewards.gems.toLocaleString())))),
  );
}

/** One of the nine slots. Held: its art, its name on a ribbon, its duplicate
 *  count. Missing: a silhouette that still shows the rarity, because what a
 *  page is MISSING is as much of the content as what it holds. */
function cardTile(
  game: Game, page: ReturnType<Game['albumPage']>,
  card: ReturnType<Game['albumPage']>['cards'][number],
): HTMLElement {
  const held = card.count >= 1;
  const tile = el('button', {
    class: `col-card r${card.rarity}${card.gold ? ' is-gold' : ''}${held ? '' : ' is-missing'}`,
    type: 'button',
    'aria-label': held ? `${card.name} ×${card.count}` : `${card.name} — not found`,
  },
    stars(card.rarity, 'col-card-stars'),
    held
      ? albumArt(page.id, page.relic, 'col-card-art')
      : el('span', { class: 'col-card-art is-silhouette' }, iconEl('unknown', { size: 'lg' })),
    card.count > 1 ? el('span', { class: 'col-dupe' }, `+${card.count - 1}`) : '',
    el('span', { class: 'col-card-name' }, card.name));
  tile.addEventListener('click', () => game.tapCard(page.id, card.slot));
  return tile;
}

function albumPage(game: Game, id: AlbumId): HTMLElement {
  const page = game.albumPage(id);
  const prev = knob('‹', () => game.stepAlbum(-1), { label: 'The album before' });
  const next = knob('›', () => game.stepAlbum(1), { label: 'The album after' });
  return el('div', { class: 'col-page' },
    rewardBand(game, page),
    el('div', { class: 'col-cards' }, ...page.cards.map((c) => cardTile(game, page, c))),
    el('div', { class: 'col-walk' },
      prev,
      el('span', { class: 'col-walk-label' }, `Album ${page.index} of ${page.of}`),
      next),
  );
}

// ------------------------------------------------------- §11.4 a relic's card

/**
 * The relic's card. THE ONLY CARD IN THE GAME WITH NO BUTTON BUT THE WAY OUT
 * — nothing is attuned, cast, studied or removed, because a relic is what the
 * kingdom has and reading it is all there is to do.
 *
 * The one exception is the four actives, which are spells in waiting
 * (Docs/features/07-research.md §6): while they still live on the relic, the
 * relic is the only place they can be cast from.
 */
function relicCard(game: Game, id: ArtifactId): HTMLElement {
  const card = game.relicCard(id);
  const active = ARTIFACTS[id].active;
  const body = el('div', { class: 'col-relic' },
    el('div', { class: 'col-stage' },
      knob('✕', () => game.closeRelic(), { label: 'Close' }),
      relicArt(id, 'col-stage-art'),
      el('div', { class: 'col-plaque' }, card.owned ? `Level ${card.level}` : 'Not found')),
    el('div', { class: 'col-relic-name' }, card.name),
    el('div', { class: 'col-relic-note' },
      iconEl('hourglass', { size: 'sm' }),
      card.owned ? '+1 level when its album closes' : 'Finish its album and it is yours'),
    el('div', { class: 'col-effects' },
      el('div', { class: 'col-effect' },
        iconEl('sparkle', { size: 'sm' }),
        el('span', {}, card.owned ? el('b', {}, 'Now — ') : el('b', {}, 'At level 1 — '),
          card.owned ? card.now : card.next)),
      card.owned
        ? el('div', { class: 'col-effect is-next' },
          iconEl('sparkle', { size: 'sm' }),
          el('span', {}, `At level ${card.level + 1} — ${card.next}`))
        : ''),
  );

  // The album, and the way back to it.
  const bar = progress('gold');
  bar.set(card.held / card.total, `${card.held}/${card.total}`);
  const albumRow = el('button', { class: 'col-relic-album', type: 'button' },
    el('span', { class: 'col-relic-medal' }, albumArt(card.album, id, 'col-relic-medal-art')),
    el('span', { class: 'col-relic-album-name' }, card.albumName),
    bar.root);
  albumRow.addEventListener('click', () => game.openAlbum(card.album));
  body.append(albumRow);

  if (active !== null && card.owned) {
    body.append(action({
      label: `Cast ${active.name}`,
      onClick: () => game.startCast(id),
      cost: { Mana: active.manaCost },
      have: (c) => game.walletValue(c),
      info: active.text,
    }));
  }
  return body;
}

// ------------------------------------------------------------------ the sheet

export function renderCollectionSheet(game: Game): HTMLElement {
  // A relic or an album the save no longer knows cannot be open — the five
  // are fixed, but a reset save is not, and a stale id would draw nothing.
  if (game.openRelicId !== null && !(game.openRelicId in ARTIFACTS)) game.openRelicId = null;
  const relic = game.openRelicId;
  if (relic !== null) {
    // BARE and CENTRED: the card's art and name are its title, and it is the
    // whole of what the player is doing rather than a drawer over the game.
    return sheet(
      { title: ARTIFACTS[relic].name, onClose: () => game.dismiss(), bare: true, centred: true },
      relicCard(game, relic),
    );
  }

  const album = game.openAlbumId;
  if (album !== null) {
    return sheet(
      {
        title: game.albumPage(album).name,
        onClose: () => game.closeAlbum(),
        tall: true,
      },
      albumPage(game, album),
    );
  }

  const info = game.seasonInfo();
  const body = el('div', { class: `col-season is-${info.frame}` },
    prizeBand(game),
    seasonLine(game),
    albumGrid(game),
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
