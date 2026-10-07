import { describe, expect, it } from 'vitest';
import { STORE, SURVEY } from '../src/sim/data/definitions';
import { isDoorOpen } from '../src/sim/doors';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet, parseCoordKey, townhall, type GameState } from '../src/sim/state';
import {
  anySurveyPending, buySurvey, claimSurveyCell, freeSurveyCell, paidSurveyCell,
  surveyCellPending, surveyLength, surveyLevel,
} from '../src/sim/survey';
import { firstGame, map, T0 } from './helpers';

/** Reveal cells until the province holds `n` revealed. */
function revealTo(state: GameState, n: number): void {
  for (const key of map.terrain.keys()) {
    if (Object.keys(state.fog.revealed).length >= n) return;
    state.fog.revealed[key] = true;
  }
}

describe('the Survey', () => {
  it('is one ladder of parallel lists, rising, ending on the province bought out', () => {
    const n = surveyLength();
    expect(n).toBe(36);
    for (const list of Object.values(SURVEY)) if (Array.isArray(list)) expect(list).toHaveLength(n);
    for (let i = 1; i < n; i++) expect(SURVEY.cells[i]).toBeGreaterThan(SURVEY.cells[i - 1]);
    expect(SURVEY.cells[n - 1]).toBeLessThanOrEqual(map.terrain.size);
  });

  it('pays something on every cell of both columns', () => {
    const state = firstGame();
    for (let l = 1; l <= surveyLength(); l++) {
      const free = freeSurveyCell(state, l);
      const paid = paidSurveyCell(l);
      expect(Object.keys(free.wallet).length + (free.fragments > 0 ? 1 : 0) + Object.keys(free.items).length, `free ${l}`).toBeGreaterThan(0);
      expect(Object.keys(paid.wallet).length + (paid.fragments > 0 ? 1 : 0) + Object.keys(paid.items).length, `paid ${l}`).toBeGreaterThan(0);
    }
  });

  it('never pays relic fragments on the paid column; its Hero XP lands as Hero XP', () => {
    for (let l = 1; l <= surveyLength(); l++) expect(paidSurveyCell(l).fragments, `paid ${l}`).toBe(0);
    const level = SURVEY.paidHeroXp.findIndex((n) => n > 0) + 1;
    const state = firstGame();
    revealTo(state, SURVEY.cells[level - 1]);
    expect(buySurvey(state, T0)).toBe('Purchased');
    const before = getWallet(state.kingdom.wallet, 'HeroXp');
    expect(claimSurveyCell(state, level, 'paid')).toBe('Claimed');
    expect(getWallet(state.kingdom.wallet, 'HeroXp')).toBeGreaterThanOrEqual(before + SURVEY.paidHeroXp[level - 1]);
  });

  it('reads its level off the cells revealed, and only that', () => {
    const state = firstGame();
    expect(surveyLevel(state)).toBe(0);
    revealTo(state, SURVEY.cells[0]);
    expect(surveyLevel(state)).toBe(1);
    revealTo(state, SURVEY.cells[4]);
    expect(surveyLevel(state)).toBe(5);
  });

  it('takes each free cell once, out of order, and the paid ones only once bought', () => {
    const state = firstGame();
    revealTo(state, SURVEY.cells[2]);
    expect(anySurveyPending(state)).toBe(true);
    expect(claimSurveyCell(state, 3, 'free')).toBe('Claimed');
    expect(claimSurveyCell(state, 3, 'free')).toBe('AlreadyClaimed');
    expect(claimSurveyCell(state, 1, 'free')).toBe('Claimed');
    expect(claimSurveyCell(state, 4, 'free')).toBe('NotReached');
    expect(claimSurveyCell(state, 1, 'paid')).toBe('NotOwned');
    expect(surveyCellPending(state, 1, 'paid')).toBe(false);
  });

  it('is bought once, through the budget, and opens every level already reached', () => {
    const state = firstGame();
    revealTo(state, SURVEY.cells[3]);
    const gems = getWallet(state.player.wallet, 'Gems');
    expect(buySurvey(state, T0)).toBe('Purchased');
    expect(buySurvey(state, T0)).toBe('AlreadyOwned');
    expect(state.player.payer!.purchases.map((p) => p.sku)).toContain('Survey');
    expect(STORE.Survey.gems).toBe(0);
    for (const l of [1, 2, 3, 4]) expect(surveyCellPending(state, l, 'paid')).toBe(true);
    expect(claimSurveyCell(state, 2, 'paid')).toBe('Claimed');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems + (paidSurveyCell(2).wallet.Gems ?? 0));
  });

  it('opens with the Store, at the second Townhall', () => {
    const state = firstGame();
    expect(isDoorOpen(state, 'survey')).toBe(false);
    townhall(state).level = 2;
    expect(isDoorOpen(state, 'survey')).toBe(true);
  });

  it('survives a save, and a kingdom from before opens it at the level its map earns', () => {
    const state = firstGame();
    revealTo(state, SURVEY.cells[1]);
    claimSurveyCell(state, 1, 'free');
    const file = serialize(state, T0);
    const back = deserialize(file, map, T0)!;
    expect(back.kingdom.survey).toEqual(state.kingdom.survey);

    delete (file.Modules['kingdom.kingdoms'] as { Survey?: unknown }).Survey;
    const old = deserialize(file, map, T0)!;
    expect(old.kingdom.survey).toEqual({ claimedFree: [], claimedPaid: [], owned: false });
    expect(surveyLevel(old)).toBe(2);
    expect(Object.keys(old.fog.revealed).map(parseCoordKey).length).toBeGreaterThanOrEqual(SURVEY.cells[1]);
  });
});
