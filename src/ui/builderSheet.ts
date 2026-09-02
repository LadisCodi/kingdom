// "Every builder is busy" — the offer raised by a refused build.
//
// THE REFUSAL IS THE OFFER, and that is the whole design (see
// Docs/features/builders.md). There is no waiting line in this game: a build
// either starts because a builder is free or it does not start at all. That
// makes the refusal a real moment rather than an administrative one — the
// player has already chosen the building and placed the ghost, so "you cannot
// do this yet" is the only point at which a second builder means anything
// concrete to them.
//
// It replaced a toast reading "Build queue is full", which was wrong twice
// over: there is no queue, and a slip in the corner of the screen is not an
// answer to a thing the player just tried to do.
//
// Two states, one sheet:
//   * below the ceiling — what is happening, and one priced button;
//   * AT the ceiling — what is happening, and no button, because there is
//     nothing to sell. A store that offers what it cannot deliver is worse
//     than one that says so.

import type { Game } from '../game';
import { el } from './format';
import { btn, iconEl } from './kit';
import { sheet } from './kit/surface';

export function renderBuilderSheet(game: Game): HTMLElement {
  const { builders, ceiling, cost, affordable } = game.builderOffer();
  const atCeiling = builders >= ceiling;
  const close = () => game.setOverlay(null);

  const body = el('div', { class: 'bld-offer' },
    el('div', { class: 'bld-offer-line' },
      el('span', { class: 'bld-offer-mark' }, iconEl('builders', { size: 'lg' })),
      el('div', { class: 'bld-offer-copy' },
        el('div', { class: 'bld-offer-head' }, builders === 1
          ? 'Your builder is busy'
          : `All ${builders} builders are busy`),
        // Say what is actually true rather than "the queue is full": nothing
        // is queued, and nothing will start on its own when this finishes.
        el('div', { class: 'bld-offer-note' },
          'Nothing waits in line — finish or rush a job to free one up.'))),

    // The crew, drawn. Filled pips are the builders owned, hollow ones the
    // room left, so the ceiling is a fact the player can see rather than a
    // sentence they have to be told twice.
    el('div', { class: 'bld-offer-crew' },
      ...Array.from({ length: ceiling }, (_, i) => el('span', {
        class: `bld-offer-pip${i < builders ? ' is-on' : ''}`,
      }, iconEl('builders', { size: 'sm' })))),
  );

  if (atCeiling) {
    body.append(el('div', { class: 'bld-offer-note' },
      `${ceiling} is as large as a crew gets.`));
  } else {
    body.append(el('div', { class: 'bld-offer-actions' },
      btn({ label: 'Not now', kind: 'secondary', onClick: close }),
      // `cost` + `have` is the kit's affordability contract: the term the
      // player is short of turns clay and the button dies on its own, so this
      // needs no disabledReason (controls.ts ActionOpts).
      btn({
        label: 'Hire a builder',
        kind: 'gem',
        onClick: () => game.doBuyBuilder(),
        cost: { Gems: cost },
        have: (c) => game.walletValue(c),
      })));
    // The clay price says the player cannot afford it; it does not say where
    // Gems come from, and at this point in the game most players do not know.
    if (!affordable) {
      body.append(el('div', { class: 'bld-offer-note' },
        'Gems come from first clears of a ruin, and from the quest chain.'));
    }
  }

  return sheet({ title: 'Builders', onClose: close, centred: true }, body);
}
