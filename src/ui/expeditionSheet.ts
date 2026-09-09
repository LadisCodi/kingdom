// One ROOM of a ruin, on the battle screen
// (Docs/features/11-expeditions.md §5, Docs/features/11a-ruins-ui.md §2.5).
//
// The board, the slots and the card panels are `battleSheet.ts` — every fight
// in the game uses them. What a room adds is two things:
//
//  1. THE WIDGET AT THE TOP, which is where the player is: `Depth 2 · Room 5`,
//     the rooms behind them and the rooms left, whether this one is the
//     depth's boss, and what it pays. There is no "how far will you go" on
//     this screen, because there is no journey: one room, one fight, decided
//     now (§5).
//  2. ONE BAND UNDER THE BOARD: the relic the hero carries in. It does not
//     stand in a slot, so it is not part of the party box — and it is the one
//     decision here that is not "which troops".
//
// What is NOT here any more, and each was a whole control: the safe depth
// (there is no run to be safe through), the standing order (there is nothing
// to stand), and the checkpoint (nothing waits). Enter, see, decide again.

import { ARTIFACTS, RUINS, depthCount } from '../sim/data/definitions';
import { artifactEntry, isAttuned, ownedArtifacts } from '../sim/artifacts';
import { carriedStats } from '../sim/combat';
import { spriteUrl } from '../render/sprites';
import type { CurrencyId } from '../sim/state';
import type { Game } from '../game';
import { renderBattleSheet, type BattleView } from './battleSheet';
import { el } from './format';
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

export function renderExpeditionSheet(game: Game): HTMLElement {
  const ruinId = game.expeditionRuin!;
  const ruin = RUINS[ruinId];
  const preview = game.expeditionPreview()!;
  const relic = ARTIFACTS[ruin.artifact];
  const alreadyHave = game.state.ruinsCleared[ruinId] === true;

  // What the relic bought, if one is socketed: the attack it adds, against
  // the room's own number. A relic that did not move this would not be a
  // choice worth a band of the screen.
  const bare = game.expeditionPreviewUnarmed();
  const relicAttack = bare === null ? 0 : preview.attack - bare.attack;

  const matchup = preview.matchup > 1.05
    ? `well matched against what lives here (×${preview.matchup.toFixed(2)})`
    : preview.matchup < 0.95
      ? `the wrong tools for this place (×${preview.matchup.toFixed(2)})`
      : 'an even match against what lives here';

  // THE WIDGET: where the player is standing. A room is one fight and the
  // address is the whole of the context — how far in, how far left, and
  // whether the thing behind this door is the depth's boss.
  const info: Array<Node | string> = [
    el('div', { class: 'exp-safe' },
      el('b', {}, `${preview.depth}·${preview.room}`),
      el('span', {}, preview.isBoss
        ? `Depth ${preview.depth}, and this one is the boss`
        : `Depth ${preview.depth} · Room ${preview.room}`)),
    el('div', { class: 'bt-info-line' },
      iconEl('dungeon', { size: 'sm' }),
      `${preview.cleared} of ${preview.rooms} rooms cleared, across ${depthCount(ruinId)} depths`),
    el('div', { class: 'bt-info-line is-soft' },
      'Rooms are fought one at a time, in order, and never again. Clearing the '
      + 'last one of a depth opens the next.'),
    el('div', { class: 'bt-info-line is-soft' }, alreadyHave
      ? `${relic.name} is already home; the rooms still pay.`
      : `${relic.name} is behind the last room of the last depth.`),
  ];
  if (relicAttack > 0) {
    info.push(el('div', { class: 'bt-info-line is-soft' },
      `The relic in the pack is worth ${relicAttack} of that attack.`));
  }

  const reward = preview.reward;
  const view: BattleView = {
    title: ruin.name,
    subtitle: `Tier ${ruin.tier} ruin · Depth ${preview.depth} · Room ${preview.room}`,
    sprite: ruin.sprite,
    glyph: ruin.glyph,
    info,
    enemy: {
      squads: preview.enemy,
      power: preview.power,
      threat: preview.threat,
      // The ruin's bias is public; what this room drew is not, until the
      // Guild's scouting exists to buy it (§3).
      note: `${preview.threat === 'Any' ? 'A mixed warband' : `Mostly ${preview.threat}s`}`
        + ` — this ruin's own. You are ${matchup}.`,
    },
    attack: preview.attack,
    enough: preview.enough,
    supplies: preview.supplies,
    rewards: [
      ...Object.entries(reward.wallet)
        .filter(([, n]) => n > 0)
        .map(([c, n]) => ({ icon: c as CurrencyId, label: String(n) })),
      { icon: 'HeroXp' as CurrencyId, label: `+${reward.heroXp}` },
      ...(reward.fragments > 0
        ? [{ icon: 'fragment' as const, label: `+${reward.fragments}` }] : []),
    ],
    rewardNote: preview.isBoss
      ? 'A boss pays four times a room, and the depth behind it opens on the way out.'
      : 'Paid the moment the room falls — there is nothing to carry home.',
    extras: [artifactBand(game)],
    actionLabel: preview.isBoss ? 'Fight the boss' : 'Enter the room',
    // Supplies are the whole price of an attempt: a room that goes badly
    // grants nothing and deducts nothing else (§5).
    actionNote: 'Supplies are spent on the way in, win or lose. Nothing else is '
      + 'at risk — a room that beats you is still there to try again.',
    onFight: () => game.doLaunchExpedition(),
    blocked: game.expeditionLaunchBlock(),
  };

  return renderBattleSheet(game, view);
}
