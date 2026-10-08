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
import { cardArt } from './buildMenu';
import type { Game } from '../game';
import { coach, el, formatDuration, formatExact } from './format';
import { btn, closeKnob, iconEl, windowHead } from './kit';
import { PROMISE } from './buildPromise';
import { tr, trn } from '../i18n/tr';

export function renderPlacementPanel(game: Game): HTMLElement {
  const info = game.placementInfo()!;
  const def = DISTRICTS[info.definitionId];
  const art = cardArt(info.definitionId);
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

  // A ghost on an illegal cell is red on the map; the button says why.
  const blockedBy = info.cell === null
    ? (moving ? tr('Nowhere legal to put it') : tr('Nowhere legal to build it'))
    : info.blocked ?? undefined;
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
    label: moving ? tr('Move') : tr('Build'),
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
    closeKnob(() => game.closePlacement(), tr('Close {name}', { name: title })),
  ], sub);

  return el('div', { class: 'dc plc-win' },
    el('div', { class: 'k-frame', 'aria-hidden': 'true' }),
    header,
    el('div', { class: 'plc-row' },
      el('div', { class: 'plc-art' }, art ? spriteImgAt(art) : iconEl(info.definitionId, { size: 'lg' })),
      el('div', { class: 'plc-body' },
        // A SHRINE ON THE MOVE says what its relic would reach here, against
        // what it reaches where it stands — the number a spot is chosen by,
        // in the place of the promise the player read when they built it.
        ...(info.aura !== undefined && !info.unmoved ? auraLines(info.aura) : [el('div', { class: 'plc-promise' },
          moving && info.unmoved ? tr('Drag it, or tap where it should go') : PROMISE[info.definitionId])]),
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

/** *Reaches 14 resources* (green up, red down), over *9 where it
 *  stands*. */
function auraLines(aura: { ground: boolean; here: number; now: number }): HTMLElement[] {
  const n = formatExact(aura.here);
  const tone = aura.here > aura.now ? ' is-up' : aura.here < aura.now ? ' is-down' : '';
  return [
    el('div', { class: `plc-aura${tone}` }, iconEl('Shrine', { size: 'sm' }),
      el('span', {}, aura.ground
        ? trn(aura.here, 'Reaches {n} resource', 'Reaches {n} resources', { n })
        : trn(aura.here, 'Reaches {n} building', 'Reaches {n} buildings', { n }))),
    el('div', { class: 'plc-promise' }, tr('{n} where it stands', { n: formatExact(aura.now) })),
  ];
}

/**
 * Moving a tree or a crop plot (Docs/features/27-plantables.md §4): the same
 * window as a building's move, and one line more — the price of a move here
 * is the wait, so the wait is said before the button is pressed.
 */
export function renderTransplantPanel(game: Game): HTMLElement {
  const info = game.transplantInfo()!;
  const art = spriteUrl(info.sprite);
  const blockedBy = info.blocked ?? undefined;
  const confirm = coach(btn({
    label: tr('Move'),
    kind: 'primary',
    onClick: () => game.confirmTransplant(),
    disabledReason: blockedBy,
  }), 'place-confirm');
  const header = windowHead(info.name, [
    closeKnob(() => game.closePlacement(), tr('Close {name}', { name: info.name })),
  ]);
  return el('div', { class: 'dc plc-win' },
    el('div', { class: 'k-frame', 'aria-hidden': 'true' }),
    header,
    el('div', { class: 'plc-row' },
      el('div', { class: 'plc-art' }, art ? spriteImgAt(art) : iconEl('Wood', { size: 'lg' })),
      el('div', { class: 'plc-body' },
        el('div', { class: 'plc-promise' },
          info.unmoved ? tr('Drag it, or tap where it should go') : tr('It grows again where it lands')),
        el('div', { class: 'plc-time' },
          iconEl('hourglass', { size: 'sm' }), formatDuration(info.growSeconds)),
        ...(blockedBy
          ? [el('div', { class: 'plc-reason' }, iconEl('padlock', { size: 'sm' }), blockedBy)]
          : [])),
      el('div', { class: 'plc-actions' }, confirm)),
  );
}
