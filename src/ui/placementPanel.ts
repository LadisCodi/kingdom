// Placing a building (§5.6, M49) — a small window across the bottom, in the
// format of every other menu, because the MAP is the screen here.
//
// Its plank carries the building's name and the close, which is the cancel:
// a build goes back to the Build menu it was picked from, a move back to the
// card it was started from. The body is one row: the picture, what the
// building does and how long it takes, and the priced Build.
//
// It serves MOVING an existing building too — the same decision, "is this a
// good spot" — so a move is a switch on `kind`: no price, no wait, and the
// button says Move.
//
// There is no verdict here any more. The map already labels every cell the
// building would work with what it holds, and that is the whole reading of
// a spot; a sentence repeating it was the bar saying it twice.

import { DISTRICTS } from '../sim/data/definitions';
import { buildGoodsCost, districtCount, districtLabel, isNumbered } from '../sim/districts';
import { districtById } from '../sim/state';
import { getGood } from '../sim/goods';
import type { GoodId } from '../sim/state';
import { spriteImgAt, spriteUrl } from '../render/sprites';
import type { Game } from '../game';
import { coach, el, formatDuration, formatExact } from './format';
import { btn, closeKnob, iconEl, windowHead } from './kit';
import { PROMISE } from './buildPromise';

export function renderPlacementPanel(game: Game): HTMLElement {
  const info = game.placementInfo()!;
  const def = DISTRICTS[info.definitionId];
  const art = spriteUrl(`${def.sprite}_l1`);
  const moving = info.kind === 'move';

  // The plank's title: the building by the name its card will use. A build
  // is the NEXT one of its kind, so it carries the ordinal it would get.
  let title = def.name;
  let sub: string | undefined;
  if (moving && game.mode.kind === 'moving') {
    const d = districtById(game.state, game.mode.districtUniqueId);
    if (d) title = districtLabel(game.state, d);
  } else if (!moving) {
    if (isNumbered(game.state, def)) sub = `#${formatExact(districtCount(game.state, def.id) + 1)}`;
  }

  const blockedBy = info.cell === null
    ? (moving ? 'Nowhere legal to put it' : 'Nowhere legal to build it')
    : undefined;
  // Refined goods ride beside the currencies, as everywhere a price is
  // quoted: a move pays nothing, so only a build carries them.
  const goodsTerms = moving || game.mode.kind === 'placing' && game.mode.premium ? [] : (Object.entries(buildGoodsCost(game.state, info.definitionId)) as
    Array<[GoodId, number]>).map(([id, n]) => ({
    icon: id,
    amount: formatExact(n),
    short: getGood(game.state.city.goods, id) < n,
  }));
  const confirm = coach(btn({
    // One verb on a labelled button: the destination is the ghost's cell.
    label: moving ? 'Move' : 'Build',
    kind: 'primary',
    onClick: () => (moving ? game.confirmMove() : game.confirmBuild()),
    ...(moving ? {} : {
      cost: info.cost,
      costExtra: goodsTerms,
      have: (c) => game.walletValue(c),
    }),
    disabledReason: blockedBy,
  }), 'place-confirm');

  const header = windowHead(title, [
    closeKnob(() => game.closePlacement(), `Close ${title}`),
  ], sub);

  return el('div', { class: 'dc plc-win' },
    el('div', { class: 'k-frame', 'aria-hidden': 'true' }),
    header,
    el('div', { class: 'plc-row' },
      el('div', { class: 'plc-art' }, art ? spriteImgAt(art) : iconEl(info.definitionId, { size: 'lg' })),
      el('div', { class: 'plc-body' },
        el('div', { class: 'plc-promise' },
          moving && info.unmoved ? 'Drag it, or tap where it should go' : PROMISE[info.definitionId]),
        // A move is instant and free: neither a wait nor a price — the empty
        // space is the message.
        ...(moving
          ? []
          : [el('div', { class: 'plc-time' },
              iconEl('hourglass', { size: 'sm' }), formatDuration(info.duration))]),
        // Nothing is greyed out without saying why (§6.3). Affordability is
        // not one of these: the price in the button says that itself.
        ...(blockedBy
          ? [el('div', { class: 'plc-reason' }, iconEl('padlock', { size: 'sm' }), blockedBy)]
          : [])),
      el('div', { class: 'plc-actions' }, confirm)),
  );
}
