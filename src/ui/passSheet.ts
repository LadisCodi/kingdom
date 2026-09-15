// The season pass: the board you work, and the ladder it climbs.
//
// ONE SHEET, TWO HALVES, and the order is the argument. The missions are ON
// TOP because they are the thing the player DOES; the ladder is underneath
// because it is what doing it is for. A pass that opened on its rewards would
// be a shop with a chore list buried below the fold.
//
// The ladder is `dailySheet.ts`'s, deliberately — same two columns on the same
// rows, same rule that the right-hand HEAD is the buy button while the pass is
// unbought, same rule that a cell is a `<button>` exactly when it can be taken
// and a plain `<div>` otherwise. A player who has climbed the chest's ladder
// already knows how to read this one, and the price is legible without a sales
// pitch anywhere on the sheet (Docs/features/13-events.md §2.4).
//
// THE MISSION ROW'S RIGHT-HAND BUTTON IS ONE BUTTON WEARING TWO FACES: green
// CLAIM when the mission is done, a Gem price when it is not. It is the same
// object because it is the same question — "finish this" — answered with work
// or with money, and two buttons side by side would read as two rewards.
//
// Reached from the Sowing Season pill, never auto-opened.
//
// Docs/features/20-season-pass.md §6, drawn from
// Docs/art/ui/mockups/m27-season-pass.png.

import type { Game } from '../game';
import type { CurrencyId, Wallet } from '../sim/state';
import type { PackTier } from '../sim/data/definitions';
import { el, formatCount } from './format';
import { currencyIcon, iconEl } from './kit';
import { sheet } from './kit/surface';
import { spriteUrl } from '../render/sprites';

/**
 * A reward as icon-and-number chips, in wallet order, with the pack last —
 * it is the thing the player is collecting toward rather than spending, the
 * order `roomPrizes` already keeps.
 *
 * THE PACK IS ITS OWN SPRITE AND CARRIES NO LABEL. The nine pouches were drawn
 * to be told apart by colour (`pack_green.png` … `pack_golden.png`, the same
 * art the reveal deals), so spelling "Blue" beside a generic pack glyph both
 * says it twice and costs a cell most of its width — on a ~180px cell a third
 * chip of text is what pushed the row to two lines and clipped it.
 */
/** A pouch, drawn as its own art with no label — the colour IS the label. */
function packChip(tier: PackTier): HTMLElement {
  const url = spriteUrl(`pack_${tier.toLowerCase()}`);
  return url === null
    ? iconEl('pack', { size: 'sm' })
    : el('img', { class: 'pss-pack', src: url, alt: `${tier} pack`, title: `${tier} pack` });
}

function prize(reward: Wallet, pack: PackTier | null): HTMLElement[] {
  const chips = (Object.entries(reward) as Array<[CurrencyId, number]>).map(([c, n]) =>
    el('span', { class: 'pss-prize' },
      currencyIcon(c, { size: 'sm' }),
      el('b', {}, formatCount(n))));
  // The atlas glyph is the fallback, so a tier whose art has not landed still
  // draws something rather than a gap (`tests/icons.test.ts`).
  if (pack !== null) {
    chips.push(el('span', { class: 'pss-prize is-pack' }, packChip(pack)));
  }
  return chips;
}

export function renderPassSheet(game: Game): HTMLElement {
  const pass = game.passScreen();
  const close = () => game.setOverlay(null);
  const price = `€${pass.priceUsd.toFixed(2)}`;

  // ---- the level bar. The medallion on the left is where the player IS; the
  // dim one on the right is the next rung, so the bar between them reads as a
  // distance rather than as a percentage.
  const atTop = pass.level >= pass.length;
  const bar = el('div', { class: 'pss-level' },
    el('div', { class: 'pss-pip is-now' }, String(pass.level)),
    el('div', { class: 'pss-xp' },
      el('span', {
        class: 'pss-xp-fill',
        style: `width:${atTop ? 100 : Math.round((pass.xpInto / Math.max(1, pass.xpNeed)) * 100)}%`,
      }),
      el('span', { class: 'pss-xp-text' },
        atTop ? 'The whole ladder' : `${formatCount(pass.xpInto)} / ${formatCount(pass.xpNeed)}`)),
    el('div', { class: 'pss-pip is-next' }, atTop ? '★' : String(pass.level + 1)));

  // ---- the board. A row is a goal, a bar and one button.
  const rows = pass.missions.map((m) => {
    const done = Math.min(m.done, m.target);
    // A BUTTON EXACTLY WHEN THERE IS SOMETHING TO PRESS, the daily ladder's
    // rule: an unfinished mission has no action, so it has no control. The
    // only way to a new mission is to finish an old one — there is nothing to
    // buy here.
    const action = m.complete
      ? el('button', { class: 'pss-claim', type: 'button' }, 'Claim')
      : null;
    action?.addEventListener('click', () => game.doClaimMission(m.id));
    // WHAT IT PAYS, on the row and before the work. Rewards vary — a pack for
    // the errands that wait on a builder or a delve, one of Gems, Mana or a
    // green pack for the rest — and variety nobody can see is not variety: the
    // whole reason to roll it is so the player picks what to do next by what
    // it is worth.
    const reward = 'pack' in m.reward
      ? el('span', { class: `pss-task-pay is-pack${m.hard ? ' is-hard' : ''}` },
          packChip(m.reward.pack))
      : el('span', { class: 'pss-task-pay' },
          currencyIcon(m.reward.currency, { size: 'sm' }),
          // A LEADING `+`, because the row can carry two Gem figures that mean
          // opposite things: what finishing pays, and what skipping costs.
          // The sign is what tells them apart at a glance — the button beside
          // it never carries one.
          el('b', {}, `+${formatCount(m.reward.amount)}`));
    return el('div', { class: `pss-task${m.complete ? ' is-done' : ''}` },
      el('span', { class: 'pss-task-icon' }, iconEl(m.icon, { size: 'md' })),
      el('span', { class: 'pss-task-body' },
        el('span', { class: 'pss-task-goal' }, m.goal),
        el('span', { class: 'pss-task-bar' },
          el('span', {
            class: 'pss-task-fill',
            style: `width:${Math.round((done / Math.max(1, m.target)) * 100)}%`,
          }),
          el('span', { class: 'pss-task-count' }, `${formatCount(done)} / ${formatCount(m.target)}`))),
      reward,
      ...(m.complete ? [iconEl('tick', { size: 'sm' }), action!] : []));
  });

  const board = el('div', { class: 'pss-board' },
    el('div', { class: 'pss-board-head' }, 'Tasks'),
    rows.length === 0
      // Never an empty panel with nothing in it: say WHY, because the answer
      // is a clock and the player can act on knowing that.
      ? el('div', { class: 'pss-empty' }, `The next tasks arrive in ${pass.nextTasksIn}.`)
      : el('div', { class: 'pss-tasks' }, ...rows),
    el('div', { class: 'pss-note' }, pass.boardFull
      // The cap replaces the deadline, so the player is owed the sentence
      // that says so — otherwise a board that stopped filling reads as broken.
      ? 'The board is full — finish one to make room for the next.'
      : `2 new tasks in ${pass.nextTasksIn}`));

  // ---- the two column heads. The right one IS the buy button while the pass
  // is unbought: the price belongs on the thing it buys.
  const heads = el('div', { class: 'pss-heads' },
    el('div', { class: 'pss-head is-free' }, 'Free'),
    el('div', { class: 'pss-head-pip' }, ''),
    pass.owned
      ? el('div', { class: 'pss-head is-paid is-owned' },
          iconEl('tick', { size: 'sm' }), 'Season pass')
      : el('button', {
          class: 'pss-head is-paid is-buy', type: 'button',
          'aria-label': `Unlock the season pass for ${price}`,
        },
          iconEl('padlock', { size: 'sm' }),
          el('span', {}, 'Season pass'),
          el('b', { class: 'pss-price' }, price)));
  if (!pass.owned) {
    heads.querySelector('.pss-head.is-buy')!
      .addEventListener('click', () => game.doBuyPass());
  }

  // ---- the ladder. A cell is a <button> exactly when it can be taken: a dead
  // button is a worse affordance than no button.
  const cell = (
    track: 'free' | 'paid',
    level: number,
    c: { reward: Wallet; pack: PackTier | null; claimed: boolean; claimable: boolean; locked?: boolean },
    grand: boolean,
  ): HTMLElement => {
    const classes = `pss-cell is-${track}`
      + (c.claimed ? ' is-taken' : '')
      + (c.claimable ? ' is-claimable' : '')
      + (c.locked ? ' is-locked' : '')
      + (grand ? ' is-grand' : '');
    const bits = [
      ...prize(c.reward, c.pack),
      // One mark per cell, never one per prize — the lock is a property of
      // the track, not of each thing behind it.
      ...(c.claimed ? [iconEl('tick', { size: 'sm' })] : []),
      ...(c.locked && !c.claimed ? [iconEl('padlock', { size: 'sm' })] : []),
    ];
    if (!c.claimable) return el('div', { class: classes }, ...bits);
    const b = el('button', { class: classes, type: 'button' }, ...bits);
    b.addEventListener('click', () => game.doClaimPassCell(level, track));
    return b;
  };

  const ladder = pass.ladder.map((r) => {
    const grand = r.level === pass.length;
    return el('div', { class: `pss-row${r.reached ? ' is-reached' : ''}` },
      cell('free', r.level, r.free, grand),
      // The level sits BETWEEN the columns, so it reads as belonging to the
      // row rather than to either track.
      el('div', { class: `pss-pip is-rung${r.level === pass.level ? ' is-here' : ''}` },
        String(r.level)),
      cell('paid', r.level, r.paid, grand));
  });

  // TWO PANES, EACH SCROLLING INSIDE ITSELF, and the sheet itself does not
  // scroll at all. The board and the ladder are read AGAINST each other — the
  // whole point of the screen is that the work on top is what moves the bar
  // underneath — so a single scroller that hides one to show the other breaks
  // the only relationship the screen exists to draw. The ladder is ~40 rows
  // and the board up to eight; neither can be allowed to push the other off.
  const body = el('div', { class: 'pss' },
    el('div', { class: 'pss-clock' },
      iconEl('hourglass', { size: 'sm' }),
      el('span', {}, `${pass.endsIn} left`),
      el('span', { class: 'pss-of' }, `Level ${pass.level} of ${pass.length}`)),
    bar,
    board,
    // The heads are OUTSIDE the ladder's scroller, so a prize is never read
    // against the wrong column — the daily sheet pins them for the same
    // reason, with `position: sticky` because there it has no pane to sit in.
    el('div', { class: 'pss-rungs' },
      heads,
      el('div', { class: 'pss-ladder', 'data-keep-scroll': 'pass-ladder' }, ...ladder)));

  // TALL, and then PANED.
  //
  // `tall` alone is not enough: a tall sheet is still `height: auto` capped at
  // the frame, so it is sized by its content — and a pane asking for a SHARE
  // of its parent would resolve that share against nothing and collapse to
  // zero. `is-panes` gives the sheet a definite height, which is the thing the
  // two panes below divide.
  const surface = sheet({ title: 'Sowing Season', onClose: close, tall: true }, body);
  surface.classList.add('is-panes');
  return surface;
}
