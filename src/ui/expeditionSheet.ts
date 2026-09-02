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
import { artifactEntry, isAttuned, ownedArtifacts } from '../sim/artifacts';
import { carriedStats, depthDurationMs } from '../sim/combat';
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

/** A signed stat delta, only shown when it is non-zero. */
const delta = (n: number): string => (n > 0 ? `+${Math.round(n)}` : String(Math.round(n)));

/**
 * What the hero carries. This is where attune-or-arm becomes a decision the
 * player can see: every relic they own is here, and the ones the kingdom is
 * currently wearing say so rather than being quietly missing. The kit refuses
 * a bare `disabled`, which is exactly right — a relic the player cannot send
 * must explain itself, because the explanation IS the mechanic.
 */
function artifactPicker(game: Game): HTMLElement {
  const owned = ownedArtifacts(game.state);
  const row = el('div', { class: 'exp-relics' });
  if (owned.length === 0) {
    return el('div', { class: 'exp-relics-empty' },
      'Relics you recover can be sent down instead of worn.');
  }
  for (const id of owned) {
    const def = ARTIFACTS[id];
    const worn = isAttuned(game.state, id);
    const chosen = game.expeditionArtifact === id;
    const stats = carriedStats({ id, level: artifactEntry(game.state, id).level });
    const line = [
      stats.atk ? `${delta(stats.atk)} atk` : null,
      stats.def ? `${delta(stats.def)} def` : null,
      stats.hp ? `${delta(stats.hp)} hp` : null,
    ].filter(Boolean).join(' · ');
    const b = el('button', {
      class: `exp-relic${chosen ? ' is-chosen' : ''}${worn ? ' is-worn' : ''}`,
      type: 'button',
    },
      portrait(def.sprite, def.glyph, 'exp-relic-art'),
      el('div', { class: 'exp-relic-name' }, def.name),
      el('div', { class: 'exp-relic-stats' },
        // Naming the passive being given up is the point: the trade is the
        // feature, so the relic the kingdom is wearing has to say what it
        // would cost to take it back.
        worn ? `Worn — ${def.passiveText.toLowerCase()}` : (line || 'No use underground')));
    if (worn) b.disabled = true;
    else b.addEventListener('click', () => game.setExpeditionArtifact(id));
    row.append(b);
  }
  return row;
}

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
      // The atlas already holds the four unit portraits (sheet UI-F), so this
      // is an icon rather than a world sprite — there is no separate map art
      // for a soldier, and inventing a key for one would only ever fall back.
      el('div', { class: 'exp-troop-art' }, iconEl(unitId, { size: 'lg' })),
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

  // What the relic bought, if one is socketed. The safe depth carries it when
  // it moved; the stat read-out carries it either way — a DEFENSIVE relic buys
  // survival past the floor rather than a deeper floor, so the headline number
  // can legitimately not move and the relic still be the right call.
  const bare = game.expeditionPreviewUnarmed();
  const movedDepth = bare !== null && preview.safeDepth !== bare.safeDepth;

  // THE number. A player who can read "safe to depth 4" before committing is
  // playing a management game; one who cannot is gambling.
  const safety = el('div', { class: `exp-safe${preview.safeDepth === 0 ? ' is-bad' : ''}` },
    el('div', { class: 'exp-safe-value' },
      preview.safeDepth === 0 ? '—' : String(preview.safeDepth)),
    el('div', { class: 'exp-safe-label' },
      preview.safeDepth === 0
        ? 'This party cannot clear the first depth'
        : `Safe to depth ${preview.safeDepth} of ${preview.maxDepth}`,
      movedDepth
        ? el('span', { class: 'exp-safe-delta' }, `${bare!.safeDepth} without the relic`)
        : ''),
    el('div', { class: 'exp-safe-note' },
      'Past that is a gamble you choose — you will be asked first.'),
  );

  const statDelta = (now: number, was: number): HTMLElement | string =>
    bare === null || now === was
      ? ''
      : el('span', { class: 'exp-delta' }, `${now > was ? '+' : ''}${now - was}`);

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
      el('div', { class: 'exp-readout-cell' },
        stat('army', String(preview.stats.atk), 'attack'),
        statDelta(preview.stats.atk, bare?.stats.atk ?? preview.stats.atk)),
      el('div', { class: 'exp-readout-cell' },
        stat('padlock', String(preview.stats.def), 'defence'),
        statDelta(preview.stats.def, bare?.stats.def ?? preview.stats.def)),
      el('div', { class: 'exp-readout-cell' },
        stat('population', String(preview.stats.hp), 'health'),
        statDelta(preview.stats.hp, bare?.stats.hp ?? preview.stats.hp))),
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

    el('div', { class: 'exp-section' },
      el('div', { class: 'exp-heading' }, 'What they carry'),
      el('div', { class: 'exp-subheading' },
        'A relic goes down or stays home — never both. Carrying costs no Mana.'),
      artifactPicker(game)),

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
