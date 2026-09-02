// "Welcome back" (§5.12) — the payoff for the idle half of the design.
//
// This screen did not exist. On load, deserialize() replays the whole
// absence: workers deliver, taxes accrue, the queue cascades, research
// finishes — and the player saw none of it. The game's strongest retention
// beat was invisible, and its AdvanceResult was dropped on the floor.

import { DISTRICTS, RUINS, TECHNOLOGIES, UNITS } from '../sim/data/definitions';
import type { UnitId } from '../sim/state';
import type { CatchUpReport } from '../sim/save';
import { spriteUrl } from '../render/sprites';
import type { CurrencyId } from '../sim/state';
import type { Game } from '../game';
import { el, formatDuration } from './format';
import { btn, currencyIcon, iconEl, sheet } from './kit';

/** Gaps shorter than this are not worth interrupting anyone for. */
export const WELCOME_MIN_MS = 120_000;

export function renderWelcomeSheet(game: Game, report: CatchUpReport): HTMLElement {
  // Deliveries arrive per cell; the player wants one line per resource.
  const earned = new Map<CurrencyId, number>();
  for (const d of report.result.deposits) {
    earned.set(d.currencyId, (earned.get(d.currencyId) ?? 0) + d.amount);
  }
  if (report.result.goldEarned > 0) {
    earned.set('Gold', (earned.get('Gold') ?? 0) + report.result.goldEarned);
  }

  const rows = [...earned.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => el('div', { class: 'wel-row' },
      currencyIcon(c),
      el('span', { class: 'wel-name' }, c),
      el('span', { class: 'wel-gain' }, `+${n}`)));

  if (report.result.manaEarned > 0) {
    earned.set('Mana', (earned.get('Mana') ?? 0) + report.result.manaEarned);
  }
  if (report.result.knowledgeEarned > 0) {
    earned.set('Knowledge', (earned.get('Knowledge') ?? 0) + report.result.knowledgeEarned);
  }
  if (report.result.trainedPopulation > 0) {
    rows.push(el('div', { class: 'wel-row' },
      iconEl('population'),
      el('span', { class: 'wel-name' }, 'Villagers'),
      el('span', { class: 'wel-gain' }, `+${report.result.trainedPopulation}`)));
  }
  for (const [unitId, n] of countBy(report.result.trainedUnits)) {
    rows.push(el('div', { class: 'wel-row' },
      iconEl(unitId),
      el('span', { class: 'wel-name' }, UNITS[unitId].name),
      el('span', { class: 'wel-gain' }, `+${n}`)));
  }

  // What finished while away, with its own art.
  const finished: HTMLElement[] = [];
  for (const item of report.result.completedItems) {
    const district = game.state.city.districts.find((d) => d.uniqueId === item.districtUniqueId);
    if (!district) continue;
    const def = DISTRICTS[district.definitionId];
    const url = spriteUrl(`${def.sprite}_l${district.level}`);
    finished.push(el('div', { class: 'wel-done' },
      url ? el('img', { src: url, alt: '' }) : iconEl(def.id, { size: 'lg' }),
      el('span', {}, def.name),
      iconEl('tick', { size: 'sm' })));
  }
  for (const id of report.result.completedResearch) {
    finished.push(el('div', { class: 'wel-done' },
      iconEl('research', { size: 'lg' }),
      el('span', {}, TECHNOLOGIES[id].name),
      iconEl('tick', { size: 'sm' })));
  }

  // The things that HAPPENED rather than accrued: a window opened, a party
  // reached a checkpoint, a buff ran out. These are the beats that make an
  // absence feel like time passing rather than a number going up.
  for (const event of report.result.scheduleEvents) {
    if (event.transition !== 'opened') continue;
    finished.push(el('div', { class: 'wel-done' },
      iconEl('sparkle', { size: 'lg' }),
      el('span', {}, `${event.title} — ${event.detail}`)));
  }
  for (const event of report.result.delveEvents) {
    const ruin = RUINS[event.ruinId];
    finished.push(el('div', { class: 'wel-done' },
      iconEl(event.kind === 'failed' ? 'unknown' : 'star', { size: 'lg' }),
      el('span', {}, event.kind === 'failed'
        ? `Your party was driven out of ${ruin.name} at depth ${event.depth}`
        : event.kind === 'bottom'
          ? `Your party reached the bottom of ${ruin.name}`
          : `Your party waits at depth ${event.depth} of ${ruin.name}`)));
  }
  for (const m of report.result.expiredModifiers) {
    if (m.source !== 'artifact') continue;
    finished.push(el('div', { class: 'wel-done' },
      iconEl('hourglass', { size: 'lg' }),
      el('span', {}, 'A spell you cast ran its course')));
  }

  const nothing = rows.length === 0 && finished.length === 0;

  const body = el('div', { class: 'wel' },
    el('div', { class: 'wel-lede' },
      `Your kingdom worked for ${formatDuration(report.elapsedMs / 1000)}.`),
    ...(report.cappedOut
      ? [el('div', { class: 'wel-capped' },
          iconEl('hourglass', { size: 'sm' }),
          'Your stores filled up before you got back.')]
      : []),
    ...(nothing
      ? [el('div', { class: 'wel-lede' }, 'Nothing to collect — it was a quiet spell.')]
      : []),
    ...(rows.length > 0 ? [el('div', { class: 'wel-rows' }, ...rows)] : []),
    ...(finished.length > 0
      ? [el('div', { class: 'wel-section' }, 'While you were away'),
         el('div', { class: 'wel-dones' }, ...finished)]
      : []),
    el('div', { class: 'wel-collect' },
      btn({ label: 'Collect', kind: 'primary', onClick: () => game.dismiss() })),
  );

  return sheet({ title: 'Welcome back', onClose: () => game.dismiss() }, body);
}


/** Counts, in first-seen order — one row per unit type rather than five rows
 *  saying "Warrior". */
function countBy(units: readonly UnitId[]): Array<[UnitId, number]> {
  const counts = new Map<UnitId, number>();
  for (const u of units) counts.set(u, (counts.get(u) ?? 0) + 1);
  return [...counts.entries()];
}
