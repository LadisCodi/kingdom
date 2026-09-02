// Sending a party into a ruin (Docs/features/expeditions.md §8).
//
// The screen has one job above all others: make the GUARANTEED DEPTH the
// biggest thing on it. "A well-prepared run never fails" is a property of the
// sim, not a slogan — but it only becomes a promise the player can act on if
// they can see it before they commit. Everything else here is in service of
// that number: the party you are sending, what it answers well, and what it
// costs to set off.
//
// The standing-order control is the opt-out, and it is deliberately not
// hidden. Push-your-luck is the engaged player's mode; anyone who does not
// want to be asked sets a depth and leaves.

import {
  ARTIFACTS, HEROES, PARTY, RUINS, UNITS,
} from '../sim/data/definitions';
import { availableRoster } from '../sim/army';
import { depthDurationMs } from '../sim/combat';
import { partySlotGemCost, partySlots, freeHeroes, unitSlots } from '../sim/expeditions';
import { spriteUrl } from '../render/sprites';
import type { UnitId } from '../sim/state';
import type { Game } from '../game';
import { el, formatDuration } from './format';
import { action, btn, chip, costChips, iconEl, knob, pips, sheet, stat } from './kit';

const portrait = (sprite: string, glyph: string, cls: string): HTMLElement => {
  const url = spriteUrl(sprite);
  return url
    ? el('img', { class: cls, src: url, alt: '' })
    : el('div', { class: `${cls} is-glyph` }, glyph);
};

/** Who leads. A hero is MANDATORY, so this is never an empty row. */
function heroPicker(game: Game): HTMLElement {
  const free = freeHeroes(game.state);
  const row = el('div', { class: 'exp-heroes' });
  for (const id of game.state.heroes.owned) {
    const hero = HEROES[id];
    const busy = !free.includes(id);
    const chosen = game.expeditionHero === id;
    const b = el('button', {
      class: `exp-hero${chosen ? ' is-chosen' : ''}${busy ? ' is-busy' : ''}`,
      type: 'button',
    },
      portrait(hero.sprite, hero.glyph, 'exp-portrait'),
      el('div', { class: 'exp-hero-name' }, hero.name),
      el('div', { class: 'exp-hero-trait' }, busy ? 'Already underground' : hero.traitText));
    if (busy) b.disabled = true;
    else b.addEventListener('click', () => game.setExpeditionHero(id));
    row.append(b);
  }
  return row;
}

/** The troops. A slot holds a unit TYPE and every unit of it you send, so
 *  this is a stepper per type, and the LIMIT is how many types — which is
 *  what makes the matchup chart a real decision. */
function troopPicker(game: Game): HTMLElement {
  const roster = availableRoster(game.state);
  const owned = (Object.keys(roster) as UnitId[]).filter((u) => roster[u] > 0);
  const chosenTypes = game.expeditionParty.filter((s) => s.count > 0).length;
  const limit = unitSlots(game.state);

  const rows = owned.map((unitId) => {
    const unit = UNITS[unitId];
    const count = game.expeditionParty.find((s) => s.unitId === unitId)?.count ?? 0;
    const wouldExceed = count === 0 && chosenTypes >= limit;
    const value = el('b', { class: 'exp-count' }, `${count}`);
    return el('div', { class: `exp-troop${wouldExceed ? ' is-blocked' : ''}` },
      portrait(`unit_${unitId.toLowerCase()}`, unit.glyph, 'exp-troop-art'),
      el('div', { class: 'exp-troop-body' },
        el('div', { class: 'exp-troop-name' }, unit.name),
        el('div', { class: 'exp-troop-stats' },
          stat('army', String(unit.atk), 'atk'),
          stat('padlock', String(unit.def), 'def'),
          stat('population', String(unit.hp), 'hp'))),
      el('div', { class: 'exp-stepper' },
        knob('−', () => game.setExpeditionCount(unitId, count - 1), {
          label: `One fewer ${unit.name}`, disabled: count === 0,
        }),
        value,
        knob('+', () => game.setExpeditionCount(unitId, count + 1), {
          label: `One more ${unit.name}`, disabled: count >= roster[unitId] || wouldExceed,
        }),
        el('span', { class: 'exp-of' }, `of ${roster[unitId]}`)),
    );
  });

  const body = el('div', { class: 'exp-troops' },
    el('div', { class: 'exp-slots' },
      iconEl('army', { size: 'sm' }),
      pips(chosenTypes, limit),
      el('span', {}, `${chosenTypes} of ${limit} kinds of unit`)),
    ...(rows.length > 0
      ? rows
      : [el('div', { class: 'exp-note' }, 'Nothing to send — train some units first.')]),
  );

  if (partySlots(game.state) < PARTY.maxSlots) {
    const cost = partySlotGemCost(game.state);
    body.append(action({
      label: 'Another slot',
      kind: 'gem',
      onClick: () => game.doBuyPartySlot(),
      info: chip('Gems', cost, game.effectiveWalletValue('Gems') < cost),
      disabledReason: game.effectiveWalletValue('Gems') < cost
        ? `Short ${cost - game.effectiveWalletValue('Gems')} Gems` : undefined,
    }));
  }
  return body;
}

/** "Delve to depth N, then come back" — set it and walk away. */
function standingOrder(game: Game, maxDepth: number, safeDepth: number): HTMLElement {
  const row = el('div', { class: 'exp-orders' });
  const choose = (value: number | null, label: string, hint: string) => {
    const b = el('button', {
      class: `exp-order${game.expeditionOrder === value ? ' is-chosen' : ''}`,
      type: 'button',
    }, el('b', {}, label), el('span', {}, hint));
    b.addEventListener('click', () => game.setStandingOrder(value));
    return b;
  };
  row.append(
    choose(null, 'Ask me', 'Stop at every depth and decide'),
    choose(Math.max(1, safeDepth), `To depth ${Math.max(1, safeDepth)}`, 'The safe floor, then home'),
    choose(maxDepth, `To the bottom`, 'All the way, whatever it costs'),
  );
  return el('div', { class: 'exp-section' },
    el('div', { class: 'exp-heading' }, 'While you are away'),
    row);
}

export function renderExpeditionSheet(game: Game): HTMLElement {
  const ruinId = game.expeditionRuin!;
  const ruin = RUINS[ruinId];
  const preview = game.expeditionPreview()!;
  const blocked = game.expeditionLaunchBlock();
  const relic = ARTIFACTS[ruin.artifact];
  const alreadyHave = game.state.ruinsCleared[ruinId] === true;

  // THE number. A player who can read "safe to depth 4" before committing is
  // playing a management game; one who cannot is gambling.
  const safety = el('div', { class: `exp-safe${preview.safeDepth === 0 ? ' is-bad' : ''}` },
    el('div', { class: 'exp-safe-value' },
      preview.safeDepth === 0 ? '—' : String(preview.safeDepth)),
    el('div', { class: 'exp-safe-label' },
      preview.safeDepth === 0
        ? 'This party cannot clear the first depth'
        : `Safe to depth ${preview.safeDepth} of ${preview.maxDepth}`),
    el('div', { class: 'exp-safe-note' },
      'Past that is a gamble you choose — you will be asked first.'),
  );

  const matchupText = preview.matchup > 1.05
    ? `Well matched against what lives here (×${preview.matchup.toFixed(2)})`
    : preview.matchup < 0.95
      ? `The wrong tools for this place (×${preview.matchup.toFixed(2)})`
      : 'An even match against what lives here';

  const body = el('div', { class: 'exp' },
    el('div', { class: 'exp-head' },
      portrait(ruin.sprite, ruin.glyph, 'exp-ruin-art'),
      el('div', {},
        el('div', { class: 'exp-name' }, ruin.name),
        el('div', { class: 'exp-kind' }, `Tier ${ruin.tier} · ${ruin.maxDepth} depths`))),

    safety,

    el('div', { class: 'exp-readout' },
      stat('army', String(preview.stats.atk), 'attack'),
      stat('padlock', String(preview.stats.def), 'defence'),
      stat('population', String(preview.stats.hp), 'health')),
    el('div', { class: 'exp-matchup' }, iconEl('sparkle', { size: 'sm' }), matchupText),

    // The haul is the whole reason to go, and it must be clear that it is not
    // yours until you bring it back.
    el('div', { class: 'exp-prize' },
      portrait(relic.sprite, relic.glyph, 'exp-prize-art'),
      el('div', {},
        el('div', { class: 'exp-prize-name' },
          alreadyHave ? `${relic.name} — already recovered` : relic.name),
        el('div', { class: 'exp-prize-note' }, alreadyHave
          ? 'Going back down pays fragments to strengthen it.'
          : `Waiting at depth ${ruin.maxDepth}. The first party to reach it brings it home.`))),

    el('div', { class: 'exp-section' },
      el('div', { class: 'exp-heading' }, 'Who leads'),
      heroPicker(game)),

    el('div', { class: 'exp-section' },
      el('div', { class: 'exp-heading' }, 'Who goes'),
      troopPicker(game)),

    standingOrder(game, ruin.maxDepth, preview.safeDepth),

    el('div', { class: 'exp-cost' },
      el('span', {}, 'Supplies'),
      costChips(preview.supplies, (c) => game.effectiveWalletValue(c)),
      el('span', { class: 'exp-time' },
        iconEl('hourglass', { size: 'sm' }),
        `first depth ${formatDuration(depthDurationMs(ruinId, 1) / 1000)}`)),

    action({
      label: 'Set off',
      kind: 'primary',
      onClick: () => game.doLaunchExpedition(),
      disabledReason: blocked ?? undefined,
    }),
  );

  const close = btn({ label: 'Not yet', onClick: () => game.dismiss() });
  close.setAttribute('data-own-close', '');
  body.append(el('div', { class: 'exp-back' }, close));

  return sheet({ title: 'Expedition', onClose: () => game.dismiss() }, body);
}
