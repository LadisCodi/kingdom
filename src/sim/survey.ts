// The Survey (Docs/features/25-the-survey.md): one ladder over the whole
// province, climbed by the cells revealed, with a free column and a paid one
// bought once.
//
// THE LEVEL IS READ, NEVER STORED. It is the count of revealed cells against
// the authored thresholds, and revealed cells only ever grow — so nothing here
// is scheduled, nothing ticks, and a kingdom from before the Survey opens it at
// whatever level its map already earns. What the save keeps is what has been
// taken, and whether the paid column is bought.
//
// EVERY CELL IS ITS OWN CLAIM, the season pass's rule: out of order, at the
// player's pace, and buying the paid column opens every level already
// reached — a column of cells to tap, not a payout.

import { track as trackEvent } from './analytics';
import { SURVEY } from './data/definitions';
import { cityGoldPerSecond, grantPack } from './collection';
import { recordEvent } from './events';
import { payKnowledge } from './knowledge';
import { revealedCellCount } from './research';
import { addToWallet, type GameState, type Wallet } from './state';
import { buySku, type BuySkuResult } from './store';
import type { PackTier } from './data/definitions';

/** How long the ladder is — the authored data's, not a constant. */
export const surveyLength = (): number => SURVEY.cells.length;

/** The level the province has reached: every threshold its revealed cells
 *  meet. 0 before the first. */
export function surveyLevel(state: GameState): number {
  const revealed = revealedCellCount(state);
  let level = 0;
  while (level < SURVEY.cells.length && revealed >= SURVEY.cells[level]) level++;
  return level;
}

/** The cells the next level asks for, or null at the top. */
export const nextLevelCells = (state: GameState): number | null =>
  SURVEY.cells[surveyLevel(state)] ?? null;

export const surveyOwned = (state: GameState): boolean => state.kingdom.survey.owned;

/** What one cell of one column holds — a wallet and a pack, as the pass's. */
export interface SurveyCell {
  level: number;
  wallet: Wallet;
  pack: PackTier | null;
}

const packAt = (column: readonly string[], level: number): PackTier | null => {
  const tier = column[level - 1] ?? '';
  return tier === '' ? null : (tier as PackTier);
};

/** A free cell. Its purse is priced NOW, in minutes of the kingdom's own
 *  Gold production, floored — the house rule for every reward. */
export function freeSurveyCell(state: GameState, level: number): SurveyCell {
  const i = level - 1;
  const minutes = SURVEY.freeGoldMinutes[i] ?? 0;
  const wallet: Wallet = {};
  if (minutes > 0) {
    wallet.Gold = Math.max(SURVEY.goldFloorPerMinute * minutes, Math.round(cityGoldPerSecond(state) * minutes * 60));
  }
  if ((SURVEY.freeKnowledge[i] ?? 0) > 0) wallet.Knowledge = SURVEY.freeKnowledge[i];
  if ((SURVEY.freeSilverKeys[i] ?? 0) > 0) wallet.SilverKey = SURVEY.freeSilverKeys[i];
  if ((SURVEY.freeGoldKeys[i] ?? 0) > 0) wallet.GoldKey = SURVEY.freeGoldKeys[i];
  if ((SURVEY.freeGems[i] ?? 0) > 0) wallet.Gems = SURVEY.freeGems[i];
  return { level, wallet, pack: packAt(SURVEY.freePacks, level) };
}

export function paidSurveyCell(level: number): SurveyCell {
  const i = level - 1;
  const wallet: Wallet = {};
  if ((SURVEY.paidGems[i] ?? 0) > 0) wallet.Gems = SURVEY.paidGems[i];
  if ((SURVEY.paidGoldKeys[i] ?? 0) > 0) wallet.GoldKey = SURVEY.paidGoldKeys[i];
  if ((SURVEY.paidStardust[i] ?? 0) > 0) wallet.Stardust = SURVEY.paidStardust[i];
  return { level, wallet, pack: packAt(SURVEY.paidPacks, level) };
}

/** Is this cell waiting to be tapped? Reached, untaken and — on the paid
 *  column — bought. */
export function surveyCellPending(state: GameState, level: number, track: 'free' | 'paid'): boolean {
  if (level < 1 || level > surveyLevel(state)) return false;
  if (track === 'paid' && !surveyOwned(state)) return false;
  const list = track === 'free' ? state.kingdom.survey.claimedFree : state.kingdom.survey.claimedPaid;
  return !list.includes(level);
}

/** Any cell at all waiting — what glows the pill. */
export function anySurveyPending(state: GameState): boolean {
  const reached = surveyLevel(state);
  for (let l = 1; l <= reached; l++) {
    if (surveyCellPending(state, l, 'free') || surveyCellPending(state, l, 'paid')) return true;
  }
  return false;
}

export type ClaimSurveyResult = 'Claimed' | 'NotReached' | 'NotOwned' | 'AlreadyClaimed';

/** Take one cell. */
export function claimSurveyCell(state: GameState, level: number, track: 'free' | 'paid'): ClaimSurveyResult {
  if (track === 'paid' && !surveyOwned(state)) return 'NotOwned';
  if (level < 1 || level > surveyLevel(state)) return 'NotReached';
  const list = track === 'free' ? state.kingdom.survey.claimedFree : state.kingdom.survey.claimedPaid;
  if (list.includes(level)) return 'AlreadyClaimed';
  pay(state, track === 'free' ? freeSurveyCell(state, level) : paidSurveyCell(level));
  recordEvent(state, { kind: 'signal', key: 'surveyClaimed' });
  trackEvent(state, 'survey_claimed', { level, paid: track === 'paid' });
  list.push(level);
  list.sort((a, b) => a - b);
  return 'Claimed';
}

export type BuySurveyResult = BuySkuResult | 'AlreadyOwned';

/** Buy the paid column, once for the whole province. It grants nothing on
 *  the spot: it opens every level already reached. */
export function buySurvey(state: GameState, now: number): BuySurveyResult {
  if (surveyOwned(state)) return 'AlreadyOwned';
  const result = buySku(state, 'Survey', now);
  if (result !== 'Purchased') return result;
  state.kingdom.survey.owned = true;
  return 'Purchased';
}

/** Where each coin of a cell lands — the scopes the wallets already have. */
function pay(state: GameState, cell: SurveyCell): void {
  for (const [coin, amount] of Object.entries(cell.wallet) as Array<[keyof Wallet, number]>) {
    if (!amount) continue;
    if (coin === 'Gems' || coin === 'GoldKey' || coin === 'SilverKey') addToWallet(state.player.wallet, coin, amount);
    else if (coin === 'Stardust') addToWallet(state.kingdom.wallet, 'Stardust', amount);
    else if (coin === 'Knowledge') payKnowledge(state, amount);
    else addToWallet(state.city.wallet, coin, amount);
  }
  // Into the collection's own queue, unopened.
  if (cell.pack !== null) grantPack(state, cell.pack, 'survey');
}
