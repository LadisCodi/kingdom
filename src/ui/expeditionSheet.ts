// Sending a party into a ruin, on the battle screen
// (Docs/features/11-expeditions.md §5, Docs/features/11a-ruins-ui.md §2.5).
//
// The board, the slots and the card panels are `battleSheet.ts` — every fight
// in the game uses them, and a delve is a fight with two extra decisions and
// a longer horizon. So this file is three things and nothing else:
//
//  1. THE WIDGET AT THE TOP, which is where a delve differs from a gate. It
//     carries the dungeon: how deep it goes, how far THIS party is safe, what
//     one depth costs in time, and what waits at the bottom. The safe depth is
//     the loudest line on it, because "a well-prepared run never fails" is a
//     property of the sim and it only becomes a promise the player can act on
//     if they can read it before committing.
//  2. THE ENEMY, sized from the first depth's strength — the number the party
//     is actually scored against — and typed by the ruin's BIAS. What waits at
//     a depth is rolled when the party commits to it, so the box says
//     "mostly", never "is": the gamble is information, not dice.
//  3. TWO BANDS UNDER THE BOARD: the relic the hero carries down, and the
//     standing order. Neither stands in a slot, so neither belongs in the
//     party box.
//
// The party itself is composed the way every other fight's is: tap a slot,
// pick a card. The four steppers this screen used to carry went with it.

import { ARTIFACTS, DELVE, RUINS } from '../sim/data/definitions';
import { artifactEntry, isAttuned, ownedArtifacts } from '../sim/artifacts';
import { carriedStats, depthDurationMs } from '../sim/combat';
import { spriteUrl } from '../render/sprites';
import type { CurrencyId } from '../sim/state';
import type { Game } from '../game';
import { renderBattleSheet, type BattleView } from './battleSheet';
import { el, formatDuration } from './format';
import { iconEl } from './kit';

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
function artifactBand(game: Game): HTMLElement {
  const owned = ownedArtifacts(game.state);
  const band = el('div', { class: 'exp-band' },
    el('div', { class: 'exp-band-head' }, 'What they carry'),
    el('div', { class: 'exp-band-note' },
      'A relic goes down or stays home — never both. Carrying costs no Mana.'));
  if (owned.length === 0) {
    band.append(el('div', { class: 'exp-relics-empty' },
      'Relics you recover can be sent down instead of worn.'));
    return band;
  }
  const row = el('div', { class: 'exp-relics' });
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
    // Tapping the one already chosen puts it back on the shelf: the socket is
    // a toggle, because "carry nothing" is a legal and common answer.
    else b.addEventListener('click', () => game.setExpeditionArtifact(chosen ? null : id));
    row.append(b);
  }
  band.append(row);
  return band;
}

/** "Delve to depth N, then come back" — set it and walk away. The opt-out is
 *  deliberately not hidden: push-your-luck is the engaged player's mode, and
 *  anyone who does not want to be asked sets a depth and leaves. */
function orderBand(game: Game, maxDepth: number, safeDepth: number): HTMLElement {
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
    choose(maxDepth, 'To the bottom', 'All the way, whatever it costs'),
  );
  return el('div', { class: 'exp-band' },
    el('div', { class: 'exp-band-head' }, 'While you are away'),
    row);
}

export function renderExpeditionSheet(game: Game): HTMLElement {
  const ruinId = game.expeditionRuin!;
  const ruin = RUINS[ruinId];
  const preview = game.expeditionPreview()!;
  const relic = ARTIFACTS[ruin.artifact];
  const alreadyHave = game.state.ruinsCleared[ruinId] === true;

  // What the relic bought, if one is socketed. The safe depth carries it when
  // it moved; a DEFENSIVE relic buys survival past the floor rather than a
  // deeper floor, so the headline can legitimately not move and the relic
  // still be the right call — which is why the party's stats are on the board.
  const bare = game.expeditionPreviewUnarmed();
  const movedDepth = bare !== null && preview.safeDepth !== bare.safeDepth;

  const matchup = preview.matchup > 1.05
    ? `well matched against what lives here (×${preview.matchup.toFixed(2)})`
    : preview.matchup < 0.95
      ? `the wrong tools for this place (×${preview.matchup.toFixed(2)})`
      : 'an even match against what lives here';

  // THE WIDGET. A player who can read "safe to depth 4" before committing is
  // playing a management game; one who cannot is gambling.
  const info: Array<Node | string> = [
    el('div', { class: 'exp-safe' },
      el('b', {}, preview.safeDepth === 0 ? '—' : String(preview.safeDepth)),
      el('span', {}, preview.safeDepth === 0
        ? 'This party cannot clear the first depth'
        : `Safe to depth ${preview.safeDepth} of ${preview.maxDepth}`),
      movedDepth
        ? el('span', { class: 'exp-safe-delta' }, `${bare!.safeDepth} without the relic`)
        : ''),
    el('div', { class: 'bt-info-line is-soft' },
      'Past that is a gamble you choose — you are asked at every depth.'),
    el('div', { class: 'bt-info-line' },
      iconEl('dungeon', { size: 'sm' }), `${ruin.maxDepth} depths`,
      iconEl('hourglass', { size: 'sm' }),
      `${formatDuration(depthDurationMs(ruinId, 1) / 1000)} for the first`),
    el('div', { class: 'bt-info-line is-soft' }, alreadyHave
      ? `${relic.name} is already home; going back down pays fragments to strengthen it.`
      : `${relic.name} waits at depth ${ruin.maxDepth}, for the first party to reach it.`),
  ];

  const view: BattleView = {
    title: ruin.name,
    subtitle: `Tier ${ruin.tier} ruin · ${ruin.maxDepth} depths`,
    sprite: ruin.sprite,
    glyph: ruin.glyph,
    info,
    enemy: {
      squads: preview.enemy,
      power: preview.enemyPower,
      threat: preview.enemyThreat,
      // A depth's type is ROLLED when the party commits to it, so the box
      // says what the ruin is biased to and admits the rest is unknown.
      note: `${preview.enemyThreat === 'Any' ? 'A mixed warband' : `Mostly ${preview.enemyThreat}s`}`
        + ` at the first depth — each one rolls its own. You are ${matchup}.`,
    },
    attack: preview.attack,
    // The safe depth is the verdict here, not one depth's arithmetic: a party
    // that clears depth 1 and dies at depth 2 is not ready to go.
    enough: preview.safeDepth > 0,
    supplies: preview.supplies,
    rewards: [
      { icon: 'Gold' as CurrencyId, label: `${DELVE.goldPerDepthPerTier * ruin.tier} a depth` },
      {
        icon: 'Stardust' as CurrencyId,
        label: `${DELVE.stardustPerDepthPerTier * ruin.tier} a depth`,
      },
      { icon: 'fragment' as const, label: `${DELVE.fragmentsPerDepth * ruin.tier} a depth` },
    ],
    rewardNote: alreadyHave
      ? 'None of it is yours until the party comes back up.'
      : `And ${relic.name} itself, at the bottom. None of it is yours until they come back up.`,
    extras: [artifactBand(game), orderBand(game, ruin.maxDepth, preview.safeDepth)],
    actionLabel: 'Set off',
    // A delve's small print is not a gate's. What is at risk is the HAUL,
    // and the haul is not the player's until they bring it up — so the line
    // states the promise rather than a fraction: nothing you already own is
    // ever taken, and every depth is a separate decision.
    actionNote: 'Supplies are spent on the way in. Everything the party finds '
      + 'is theirs to lose until they bring it up — nothing you already own is '
      + 'ever at risk.',
    onFight: () => game.doLaunchExpedition(),
    blocked: game.expeditionLaunchBlock(),
  };

  return renderBattleSheet(game, view);
}
