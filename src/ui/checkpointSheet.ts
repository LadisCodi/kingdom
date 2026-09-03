// The checkpoint (Docs/features/11-expeditions.md §8).
//
// One question, two answers of EQUAL VISUAL WEIGHT: go deeper, or take the
// haul. It has to read as an offer, never as a threat — a screen that styles
// "take the haul" as the safe grey escape and "go deeper" as the exciting gold
// one is not asking a question, it is nudging.
//
// And it must make plain, in words, that the haul is not banked yet. The 50%
// loss on a failed push is legitimate under "nothing you own is ever taken
// from you" precisely because the haul was never yours — but that is a
// technicality unless the UI sells it from the first depth. Players who learn
// it from losing will feel robbed, and they will be right to.

import { ARTIFACTS, HEROES, RUINS, UNITS } from '../sim/data/definitions';
import { threatStrength } from '../sim/combat';
import { depthMs, nextDepthIntel } from '../sim/expeditions';
import { spriteUrl } from '../render/sprites';
import type { CurrencyId, Delve } from '../sim/state';
import type { Game } from '../game';
import { el, formatDuration } from './format';
import { btn, chip, iconEl, progress, sheet, stat } from './kit';

const art = (sprite: string, glyph: string, cls: string): HTMLElement => {
  const url = spriteUrl(sprite);
  return url ? el('img', { class: cls, src: url, alt: '' }) : el('div', { class: `${cls} is-glyph` }, glyph);
};

function haulRows(game: Game, delve: Delve): HTMLElement {
  const entries = Object.entries(delve.haul) as Array<[CurrencyId, number]>;
  const rows = entries
    .filter(([, n]) => n > 0)
    .map(([c, n]) => el('div', { class: 'chk-haul-row' }, chip(c, n)));
  if (delve.haulFragments > 0) {
    rows.push(el('div', { class: 'chk-haul-row' },
      iconEl('sparkle', { size: 'sm' }),
      el('b', {}, `${delve.haulFragments}`),
      el('span', {}, `${ARTIFACTS[RUINS[delve.ruinId].artifact].name} fragments`)));
  }
  void game;
  return el('div', { class: 'chk-haul' },
    ...(rows.length > 0 ? rows : [el('span', { class: 'chk-note' }, 'Nothing yet.')]));
}

export function renderCheckpointSheet(game: Game): HTMLElement {
  const delve = game.checkpointDelve();
  if (!delve) {
    return sheet({ title: 'Expedition', onClose: () => game.dismiss() },
      el('div', { class: 'chk-note' }, 'That party has already come home.'));
  }
  const ruin = RUINS[delve.ruinId];
  const hero = HEROES[delve.heroId];
  const atBottom = delve.depth >= ruin.maxDepth;
  const failed = delve.outcome === 'failed';

  const hp = progress(delve.partyHp / Math.max(1, delve.maxPartyHp) > 0.35 ? 'leaf' : 'gold');
  hp.set(delve.partyHp / Math.max(1, delve.maxPartyHp), `${delve.partyHp} / ${delve.maxPartyHp}`);

  const intel = nextDepthIntel(game.state, delve);
  const nextStrength = atBottom ? 0 : threatStrength(delve.ruinId, intel.depth);

  const body = el('div', { class: 'chk' },
    el('div', { class: 'chk-head' },
      art(hero.sprite, hero.glyph, 'chk-hero'),
      el('div', {},
        el('div', { class: 'chk-name' }, `${hero.name} in ${ruin.name}`),
        el('div', { class: 'chk-depth' }, failed
          ? `Driven back at depth ${delve.depth + 1}`
          : atBottom
            ? `At the bottom — depth ${delve.depth}`
            : `Standing at depth ${delve.depth} of ${ruin.maxDepth}`))),

    el('div', { class: 'chk-section' },
      el('div', { class: 'chk-heading' }, 'The party'),
      hp.root,
      el('div', { class: 'chk-party' },
        ...delve.party.map((s) => el('span', { class: 'chk-unit' },
          iconEl(s.unitId, { size: 'sm' }), `×${s.count}`)),
        el('span', { class: 'chk-unit' }, iconEl(hero.unitType, { size: 'sm' }), hero.name))),

    el('div', { class: 'chk-section' },
      el('div', { class: 'chk-heading' }, 'Carrying'),
      haulRows(game, delve),
      // The line the whole design rests on, said plainly and early.
      el('div', { class: 'chk-warning' },
        iconEl('unknown', { size: 'sm' }),
        failed
          ? 'They lost half of it getting out. What is left is still theirs to bring home.'
          : 'None of this is yours until they walk back out. A push that fails costs half of it.')),
  );

  if (failed) {
    body.append(el('div', { class: 'chk-choices is-single' },
      btn({ label: 'Bring them home', kind: 'primary', onClick: () => game.doExtract() })));
    return sheet({ title: 'The way back', onClose: () => game.dismiss() }, body);
  }

  if (!atBottom) {
    body.append(el('div', { class: 'chk-section' },
      el('div', { class: 'chk-heading' }, `What is below`),
      el('div', { class: 'chk-next' },
        stat('unknown', String(nextStrength), 'strength'),
        stat('hourglass', formatDuration(depthMs(game.state, delve.ruinId, intel.depth) / 1000), 'to clear'),
        intel.threat !== null
          ? stat(intel.threat === 'Any' ? 'army' : intel.threat,
            intel.threat === 'Any' ? 'anything' : `${UNITS[intel.threat].name}s`, 'wait below')
          : el('span', { class: 'chk-unknown' },
            iconEl('unknown', { size: 'sm' }),
            'You do not know what kind — the Scout would.')),
    ));
  }

  // TWO CHOICES OF EQUAL WEIGHT. Both primary; the copy carries the
  // difference, not the styling.
  body.append(el('div', { class: 'chk-choices' },
    btn({
      label: 'Take the haul',
      kind: 'primary',
      onClick: () => game.doExtract(),
    }),
    btn({
      label: atBottom ? 'Nothing deeper' : 'Go deeper',
      kind: 'primary',
      onClick: () => game.doPushDeeper(),
      disabledReason: atBottom ? 'This is the bottom of the ruin' : undefined,
    }),
  ));
  body.append(el('div', { class: 'chk-note' },
    'They will wait here as long as you like. Nothing expires.'));

  return sheet({ title: 'A choice', onClose: () => game.dismiss() }, body);
}
