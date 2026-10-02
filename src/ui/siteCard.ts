// The card for a map SITE — a landmark, an abandoned building, or a lair
// (`lairCardScreen`).
//
// These are what paid fog is FOR. A player who clears a distance-9 ring and
// finds one more iron vein has learned that exploring is a treadmill; a player
// who finds a shrine that pays Mana forever, or a lair worth clearing,
// has learned the opposite. So the card's job is to make the reward
// legible BEFORE the player spends anything — what it gives, what it costs,
// and, when it is out of reach, exactly what is missing.

import {
  DISTRICTS, FOG, LAIRS, LANDMARK_ART, MANA, type AbandonedDef, type LandmarkDef,
} from '../sim/data/definitions';
import { nextBuildCost } from '../sim/districts';
import type { LairView, RaidableId } from '../sim/lairs';
import type { Game } from '../game';
import { landmarkClaimCost } from '../sim/landmarks';
import { manaCap } from '../sim/mana';
import { releaseSprites, spriteImgAt, spriteUrl } from '../render/sprites';
import type { LairId } from '../sim/state';
import { el, formatDuration, formatExact } from './format';
import { btn, closeKnob, iconEl, sectionHead, windowHead, type IconName } from './kit';
import type { Screen } from './kit/host';

/**
 * THE LANDMARK'S CARD — the lair card's frame (`.dc`), and four things in
 * it, top to bottom:
 *
 *   the name, on the plain title plank;
 *   the site itself, on a darker-paper tile, with whether it is yours;
 *   what claiming it gives — a bigger Mana pool and the fog lifted round it;
 *   Claim and its price, or, once claimed, what it is holding now.
 *
 * Built once per landmark; rebuilt only when what it says moves (the claim,
 * the price, whether the purse covers it).
 */
export function landmarkCardScreen(game: Game, def: LandmarkDef): Screen {
  const look = LANDMARK_ART[def.kind];
  const root = el('div', { class: 'dc lc lm' });
  const frame = el('div', { class: 'k-frame', 'aria-hidden': 'true' });
  let signature: string | null = null;
  const side = FOG.claimDiscoverRadius * 2 + 1;

  const build = (claimed: boolean, cost: number): void => {
    const url = spriteUrl(look.sprite);
    const figure = el('div', { class: 'lm-art k-section' },
      url ? spriteImgAt(url, 'lm-art-img') : el('div', { class: 'lc-art-glyph' }, look.glyph),
      el('p', { class: 'lm-status' }, claimed ? 'Claimed' : 'Unclaimed'));

    // The promise, stated as the two things it actually buys: a bigger pool
    // (which is also a bigger reward every time an ad refills it), and a
    // lantern held up over the map around it. `showme` is the "look over
    // there" glyph the quest pill already uses, and looking is exactly what
    // a claim buys here — not owning.
    const gift = el('div', { class: 'lc-reward' },
      giftChip('Mana', `+${formatExact(MANA.landmarkCap)}`, 'Mana, for good'),
      giftChip('showme', `${side}×${side}`, 'of map uncovered'));

    const go = claimed
      // Spelled out against the running total, because the value of a claim
      // is what it made the ceiling, not the number on the tin.
      ? el('p', { class: 'lm-note is-claimed' },
        iconEl('tick', { size: 'sm' }),
        `Holding ${formatExact(MANA.landmarkCap)} more Mana. Your pool: ${formatExact(manaCap(game.state))}.`)
      : el('div', { class: 'lc-go' }, btn({
        label: 'Claim',
        kind: 'primary',
        onClick: () => game.doClaimLandmark(def.location),
        cost: { Gold: cost },
        have: (c) => game.walletValue(c),
      }));

    root.replaceChildren(frame,
      windowHead(look.name, [closeKnob(() => game.dismiss(), `Close ${look.name}`)]),
      figure,
      sectionHead(claimed ? 'Gives' : 'Claim it for'),
      gift,
      // What the claim actually buys, in the player's terms: a deeper pool
      // means a longer session AND a larger refill, because a refill fills
      // the whole thing.
      ...(claimed ? [] : [el('p', { class: 'lm-note' },
        `A longer run of taps, and more from every refill. The fog lifts for `
        + `${FOG.claimDiscoverRadius} cells around: you will see what is out there, `
        + 'though clearing it is still yours to pay for.')]),
      go);
  };

  return {
    root,
    refresh: () => {
      const claimed = game.state.landmarks.claimed[def.id] === true;
      const cost = landmarkClaimCost(game.state, def);
      const now = `${claimed}|${cost}|${game.walletValue('Gold') >= cost}|${manaCap(game.state)}`;
      if (now === signature) return;
      signature = now;
      releaseSprites(root);
      build(claimed, cost);
    },
  };
}

/** One tile of what a landmark gives: the icon and the amount, a caption
 *  under them saying what the amount is. */
function giftChip(icon: IconName, value: string, caption: string): HTMLElement {
  return el('div', { class: 'lc-chip lm-chip k-section' },
    el('div', { class: 'lm-chip-line' }, iconEl(icon, { size: 'lg' }), el('b', { class: 'lc-chip-value' }, value)),
    el('span', { class: 'lm-chip-caption' }, caption));
}

/**
 * AN ABANDONED BUILDING'S CARD (Docs/features/01-map-and-fog.md §6.3) — the
 * landmark card's frame and tiles: the name on the plank, its ruin on a
 * tile, what it does once it stands again, and Repair — a build at level 1,
 * where it stands, at the price of the next one of its kind.
 */
export function renderAbandonedCard(game: Game, site: AbandonedDef): HTMLElement {
  const def = DISTRICTS[site.districtId];
  const url = spriteUrl(`${def.sprite}_ruin`);
  return el('div', { class: 'dc lc lm' },
    el('div', { class: 'k-frame', 'aria-hidden': 'true' }),
    windowHead(site.name, [closeKnob(() => game.dismiss(), `Close ${site.name}`)]),
    el('div', { class: 'lm-art k-section' },
      url ? spriteImgAt(url, 'lm-art-img is-ruin') : el('div', { class: 'lc-art-glyph' }, def.glyph),
      el('p', { class: 'lm-status' }, 'Abandoned')),
    el('p', { class: 'lm-note' }, def.promise),
    el('p', { class: 'lm-note' },
      'Left to the fog when its people fled. Repair it and it is yours, '
      + 'exactly as if you had built it.'),
    // `repair` is what a scene points at (Docs/features/23-tutorials.md §3).
    el('div', { class: 'lc-go', 'data-coach': 'repair' }, btn({
      label: 'Repair',
      kind: 'primary',
      onClick: () => game.doRepairAbandoned(site.location),
      cost: nextBuildCost(game.state, site.districtId),
      have: (c) => game.walletValue(c),
    })));
}

/**
 * THE LAIR'S CARD (Docs/proposals/lairs.md §6) — the district card's frame,
 * and five things in it, top to bottom:
 *
 *   the name, on the plain title plank;
 *   the painting of the creature at its worst, with its flavour line;
 *   the countdown, said as the threat it is;
 *   the reward — the hoard it carries, then Hero XP and Knowledge;
 *   Attack, which opens the attack screen — or, once the garrison is
 *   beaten, Claim, which pays the reward and strikes the lair from the map.
 *
 * Nothing else. The enemy's squads and power are the attack screen's, and a
 * raid count is never shown anywhere. Built ONCE per lair; a tick rewrites
 * the countdown's text and nothing else.
 */
export function lairCardScreen(game: Game, lairId: LairId): Screen {
  const def = LAIRS[lairId];
  const root = el('div', { class: 'dc lc', 'data-coach': 'lair-card' });
  const frame = el('div', { class: 'k-frame', 'aria-hidden': 'true' });
  const clock = el('b', { class: 'lc-clock-value' });
  let signature: string | null = null;

  const build = (lair: LairView): void => {
    const art = spriteUrl(`lair_art_${lairId.toLowerCase()}`);
    const figure = el('div', { class: 'lc-art k-section' },
      art ? spriteImgAt(art, 'lc-art-img') : el('div', { class: 'lc-art-glyph' }, def.glyph),
      el('p', { class: 'lc-flavour' }, def.flavour));

    // Beaten, the clock has stopped for good: the box says so, and the
    // button under the reward is the claim (Docs/proposals/lairs.md §5).
    const timer = lair.defeated
      ? el('div', { class: 'lc-clock k-section is-beaten' },
        iconEl('tick', { size: 'lg' }),
        el('div', { class: 'lc-clock-body' },
          el('div', { class: 'lc-clock-label' },
            `${lair.creature} ${lair.creature.startsWith('A ') ? 'is' : 'are'} beaten`),
          el('b', { class: 'lc-clock-value' }, 'Claim what they left behind')))
      : el('div', { class: 'lc-clock k-section' },
        iconEl('hourglass', { size: 'lg' }),
        el('div', { class: 'lc-clock-body' },
          el('div', { class: 'lc-clock-label' }, 'They will attack your city in'),
          clock));

    // The hoard first: it is what the raids took, and clearing the lair is
    // how it comes back — so it is the reward rather than a report.
    const chips: HTMLElement[] = [];
    for (const [c, n] of Object.entries(lair.hoard) as Array<[RaidableId, number]>) {
      if (n <= 0) continue;
      chips.push(rewardChip(c, formatExact(n), lair.hoardFull[c] === true ? 'full' : undefined));
    }
    const reward = game.lairReward(lairId);
    if (reward.heroXp > 0) chips.push(rewardChip('HeroXp', formatExact(reward.heroXp)));
    if (reward.knowledge > 0) chips.push(rewardChip('Knowledge', formatExact(reward.knowledge)));

    root.replaceChildren(frame,
      windowHead(def.name, [closeKnob(() => game.dismiss(), `Close ${def.name}`)]),
      figure,
      timer,
      sectionHead('Reward'),
      el('div', { class: 'lc-reward' }, ...chips),
      el('div', { class: 'lc-go' }, lair.defeated
        ? btn({ label: 'Claim', kind: 'primary', onClick: () => game.doClaimLair(lairId) })
        : btn({ label: 'Attack', kind: 'primary', onClick: () => game.openLair(lairId) })));
  };

  return {
    root,
    refresh: () => {
      const lair = game.lairFor(lairId);
      if (lair === null || lair.cleared) {
        releaseSprites(root);
        root.replaceChildren();
        signature = null;
        return;
      }
      // Rebuilt only when what it SAYS moves — the hoard; a tick in between
      // touches the countdown's text alone.
      const now = JSON.stringify(lair.hoard) + JSON.stringify(lair.hoardFull) + String(lair.defeated);
      if (now !== signature) {
        signature = now;
        releaseSprites(root);
        build(lair);
      }
      const left = lair.nextRaidAt === null ? 0 : Math.max(0, (lair.nextRaidAt - game.now()) / 1000);
      clock.textContent = formatDuration(left);
    },
  };
}

/** One tile of the reward row: the icon, the amount, and a word under it
 *  when the lair carries all it can of that material. */
function rewardChip(icon: IconName, value: string, tag?: string): HTMLElement {
  return el('div', { class: 'lc-chip k-section' },
    iconEl(icon, { size: 'lg' }),
    el('b', { class: 'lc-chip-value' }, value),
    ...(tag ? [el('span', { class: 'lc-chip-tag' }, tag)] : []));
}
