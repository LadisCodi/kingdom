// Spells — minimal scope this iteration (full rework deferred, see
// Docs/features/harvest-loop.md §4). Rain: ×2 recovery speed on the rained
// resource cell while active. Tap: dormant, no valid targets.

import { SPELLS, levelIndexed } from './data/definitions';
import { applyRainToExhausted, harvestSourceAt } from './harvest';
import {
  addToWallet, coordKey, getWallet, newId, sameCell,
  type Coord, type GameState, type SpellId,
} from './state';

export type CastResult = 'Cast' | 'NotUnlocked' | 'AlreadyActive' | 'NotEnoughMana' | 'InvalidTarget';

export function canTarget(state: GameState, spellId: SpellId, cell: Coord): boolean {
  switch (spellId) {
    case 'Rain':
      // Any revealed resource cell (fresh or exhausted).
      return (
        state.fog.revealed[coordKey(cell)] === true && harvestSourceAt(state, cell) !== null
      );
    case 'Tap':
      return false; // superseded by free player taps; pending the spell rework
  }
}

export function castSpell(
  state: GameState,
  spellId: SpellId,
  cell: Coord,
  now: number,
): CastResult {
  const def = SPELLS[spellId];
  const spell = state.spellbook[spellId];
  if (!spell?.unlocked) return 'NotUnlocked';
  if (!def.stackable) {
    const already = state.activeSpells.some(
      (s) => s.spellId === spellId && sameCell(s.cell, cell) && s.expiresAt > now,
    );
    if (already) return 'AlreadyActive';
  }
  if (!canTarget(state, spellId, cell)) return 'InvalidTarget';
  const levelDef = levelIndexed(def.levels, spell.level);
  if (getWallet(state.kingdom.wallet, 'Mana') < levelDef.manaCost) return 'NotEnoughMana';
  addToWallet(state.kingdom.wallet, 'Mana', -levelDef.manaCost);

  const durationMs = levelDef.durationSeconds * 1000;
  state.activeSpells.push({
    spellId,
    cell,
    level: spell.level,
    magnitude: levelDef.effectMagnitude,
    expiresAt: now + durationMs,
    sourceId: newId(state, `spell_${spellId}`),
  });
  if (spellId === 'Rain') {
    // Already exhausted → halve the remaining wait covered by the rain window.
    // If the cell exhausts DURING the rain, registerTap applies the boost then.
    applyRainToExhausted(state, cell, durationMs, now);
  }
  return 'Cast';
}
