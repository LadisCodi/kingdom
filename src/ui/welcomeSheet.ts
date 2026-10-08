// "Welcome back" (§5.12) — the payoff for the idle half of the design.
//
// This screen did not exist. On load, deserialize() replays the whole
// absence: workers deliver, taxes accrue, the queue cascades, research
// finishes — and the player saw none of it. The game's strongest retention
// beat was invisible, and its AdvanceResult was dropped on the floor.

import { tr } from '../i18n/tr';
import { DISTRICTS, TROOPS, unitOf } from '../sim/data/definitions';
import type { TroopId } from '../sim/state';
import type { CatchUpReport } from '../sim/save';
import { buildingArtUrl, spriteImgAt } from '../render/sprites';
import type { CurrencyId } from '../sim/state';
import type { Game } from '../game';
import { currencyName, el, formatDuration, formatExact } from './format';
import { btn, currencyIcon, iconEl, sheet } from './kit';

/** Gaps shorter than this are not worth interrupting anyone for. */
export const WELCOME_MIN_MS = 120_000;

export function renderWelcomeSheet(game: Game, report: CatchUpReport): HTMLElement {
  // Hauls and rent went into the buildings' stores, not the purse: these rows
  // say what is WAITING for a tap. Deliveries arrive per cell; the player
  // wants one line per resource.
  const earned = new Map<CurrencyId, number>();
  for (const d of report.result.deposits) {
    earned.set(d.currencyId, (earned.get(d.currencyId) ?? 0) + d.amount);
  }
  if (report.result.goldEarned > 0) {
    earned.set('Gold', (earned.get('Gold') ?? 0) + report.result.goldEarned);
  }

  // Mana and Knowledge join the ledger BEFORE it is drawn — they used to be
  // added after the rows were built, so a night's Knowledge never showed.
  if (report.result.manaEarned > 0) {
    earned.set('Mana', (earned.get('Mana') ?? 0) + report.result.manaEarned);
  }
  if (report.result.knowledgeEarned > 0) {
    earned.set('Knowledge', (earned.get('Knowledge') ?? 0) + report.result.knowledgeEarned);
  }
  // Gains read in full with their thousands ("+1,240"), as M13 prints them:
  // this is the one place the whole night's number is the point.
  const gain = (n: number): string => `+${formatExact(n)}`;
  const rows = [...earned.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => el('div', { class: 'wel-row' },
      currencyIcon(c),
      el('span', { class: 'wel-name' }, currencyName(c)),
      el('span', { class: 'wel-gain' }, gain(n))));

  if (report.result.trainedPopulation > 0) {
    rows.push(el('div', { class: 'wel-row' },
      iconEl('population'),
      el('span', { class: 'wel-name' }, tr('Villagers')),
      el('span', { class: 'wel-gain' }, gain(report.result.trainedPopulation))));
  }
  for (const [unitId, n] of countBy(report.result.trainedUnits)) {
    rows.push(el('div', { class: 'wel-row' },
      iconEl(unitOf(unitId)),
      el('span', { class: 'wel-name' }, TROOPS[unitId].name),
      el('span', { class: 'wel-gain' }, gain(n))));
  }

  // What finished while away, with its own art.
  const finished: HTMLElement[] = [];
  for (const item of report.result.completedItems) {
    const district = game.state.city.districts.find((d) => d.uniqueId === item.districtUniqueId);
    if (!district) continue;
    const def = DISTRICTS[district.definitionId];
    const url = buildingArtUrl(def.sprite, district.level);
    finished.push(el('div', { class: 'wel-done' },
      url ? spriteImgAt(url) : iconEl(def.id, { size: 'lg' }),
      el('span', {}, tr('{name} #{n} finished', { name: def.name, n: district.ordinal })),
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
  for (const m of report.result.expiredModifiers) {
    if (m.source !== 'artifact') continue;
    finished.push(el('div', { class: 'wel-done' },
      iconEl('hourglass', { size: 'lg' }),
      el('span', {}, tr('A spell you cast ran its course'))));
  }

  const nothing = rows.length === 0 && finished.length === 0;

  const body = el('div', { class: 'wel' },
    el('div', { class: 'wel-lede' },
      tr('Your kingdom worked for {time}.', { time: formatDuration(report.elapsedMs / 1000) })),
    ...(report.storesFull
      ? [el('div', { class: 'wel-capped' },
          iconEl('hourglass', { size: 'sm' }),
          tr('Some stores filled up before you got back — tap them to collect.'))]
      : []),
    ...(nothing
      ? [el('div', { class: 'wel-lede' }, tr('Nothing to collect — it was a quiet spell.'))]
      : []),
    ...(rows.length > 0 ? [el('div', { class: 'wel-rows' }, ...rows)] : []),
    ...(finished.length > 0
      ? [el('div', { class: 'wel-section' }, tr('While you were away')),
         el('div', { class: 'wel-dones' }, ...finished)]
      : []),
    el('div', { class: 'wel-collect' },
      btn({ label: tr('Continue'), kind: 'primary', onClick: () => game.dismiss() })),
  );

  return sheet({ title: tr('Welcome back'), onClose: () => game.dismiss() }, body);
}


/** Counts, in first-seen order — one row per unit type rather than five rows
 *  saying "Warrior". */
function countBy(units: readonly TroopId[]): Array<[TroopId, number]> {
  const counts = new Map<TroopId, number>();
  for (const u of units) counts.set(u, (counts.get(u) ?? 0) + 1);
  return [...counts.entries()];
}
