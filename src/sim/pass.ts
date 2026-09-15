// The season pass: a ladder of levels, two columns wide, fed by missions.
//
// `daily.ts` IS THE MODEL, and almost every hard question is answered there.
// The paid column is bought once a season by comparing a stamp rather than by
// setting a flag; a stale season reads as a fresh, empty pass, so nothing has
// to run at a boundary; every cell is its own claim, so buying on level 12
// leaves twelve cells to tap rather than raining twelve rewards at once.
//
// WHAT IS DIFFERENT FROM THE CHEST. The chest's ladder advances on DAYS
// PLAYED — it pays for showing up. This one advances on XP, and the only
// thing that pays XP is finishing a mission (sim/missions.ts) — it pays for
// PLAYING. That split is the whole reason both can exist.
//
// IT IS NOT A BOUNDARY SOURCE, verbatim from `adOffers.ts` and `daily.ts`:
// nothing in the sim reads the pass, claiming is always a live player command,
// and the season turns because it is DERIVED from the instant. `advance()`
// never touches any of this.
//
// THE SEASON IS THE COLLECTION'S, not the chest's. There are two clocks in
// this game called a season — the chest runs twenty days from its own index,
// the collection twenty-eight from `seasonAt` — and the pass joins the
// collection's, because the packs it pays are that season's cards.
//
// Docs/features/20-season-pass.md.

import { PASS, MISSIONS } from './data/definitions';
import { grantPack, seasonAt, seasonEndsAt } from './collection';
import { manaCap } from './mana';
import {
  chooseKind, issueMission, missionComplete, missionProgress, weekIndex, windowIndex,
} from './missions';
import { buySku, type BuySkuResult } from './store';
import { addToWallet, getWallet, type GameState, type Mission, type Wallet } from './state';
import type { PackTier } from './data/definitions';

/** How long the ladder is, from the authored columns rather than a constant —
 *  so lengthening the season is one longer column and nothing else. */
export const ladderLength = (): number => PASS.freePacks.length;

/** What level `xp` buys, 0-based at the bottom: level 0 is a pass nobody has
 *  earned anything on, and the ladder's last rung is `ladderLength()`. */
export function levelForXp(xp: number): number {
  let level = 0;
  let spent = 0;
  while (level < ladderLength() && spent + levelCost(level + 1) <= xp) {
    spent += levelCost(level + 1);
    level += 1;
  }
  return level;
}

/** The XP that takes the player from `level - 1` to `level`. Linear rather
 *  than exponential: a pass is twenty-eight days long, and an exponential tail
 *  makes the last rungs decoration. */
export const levelCost = (level: number): number =>
  PASS.levelXpBase + PASS.levelXpGrowth * Math.max(0, level - 1);

/** XP already banked toward the NEXT level, and what that level asks for. */
export function levelProgress(xp: number): { into: number; need: number } {
  const level = levelForXp(xp);
  let spent = 0;
  for (let l = 1; l <= level; l++) spent += levelCost(l);
  if (level >= ladderLength()) return { into: 0, need: 0 };
  return { into: xp - spent, need: levelCost(level + 1) };
}

// ------------------------------------------------------------- the pull rules

/** XP banked THIS season. A stale season reads as none, which is what turns
 *  the pass over with nothing scheduled and nothing to reset. */
export const passXp = (state: GameState, now: number): number =>
  state.kingdom.pass.season === seasonAt(now) ? state.kingdom.pass.xp : 0;

export const passLevel = (state: GameState, now: number): number =>
  levelForXp(passXp(state, now));

/** Is the paid column open for the season `now` falls in? A comparison, not a
 *  flag, so nothing has to clear it when the season turns. */
export const passOwned = (state: GameState, now: number): boolean =>
  state.kingdom.pass.paidSeason === seasonAt(now);

const claimed = (
  state: GameState, now: number, track: 'free' | 'paid',
): readonly number[] => {
  if (state.kingdom.pass.season !== seasonAt(now)) return [];
  return track === 'free' ? state.kingdom.pass.claimedFree : state.kingdom.pass.claimedPaid;
};

/** When the pass closes — the collection's season end, never a third clock. */
export const passEndsAt = (now: number): number => seasonEndsAt(seasonAt(now));

// -------------------------------------------------------------- the board

/**
 * THE MISSIONS ON THE BOARD RIGHT NOW. A stale season reads as an empty
 * board, the same pull rule everything else here follows.
 */
export const boardMissions = (state: GameState, now: number): readonly Mission[] =>
  state.kingdom.pass.season === seasonAt(now) ? state.kingdom.pass.live : [];

/** The board is full, so nothing new can be issued. THE pressure the whole
 *  design rests on, and the thing the Gem shortcut unclogs. */
export const boardIsFull = (state: GameState, now: number): boolean =>
  boardMissions(state, now).length >= MISSIONS.boardSize;

/**
 * ISSUE WHATEVER THIS INSTANT OWES, and nothing else.
 *
 * Called from the LIVE tick only (`Game.notify`), never from `advance()` —
 * `adOffers.ts` makes the argument in full: an eight-hour timer registered as
 * a boundary would propose ~90 boundaries across a thirty-day absence against
 * a seatbelt of 10,000, for no simulation benefit, and the tail advance in
 * save.ts is uncapped. Nothing in the sim reads the board.
 *
 * `lastWindow` is stamped with the window REACHED, never incremented, so a
 * three-day absence issues ONE window's worth on return rather than nine — and
 * a window that passed while the board was full is never owed later. That is
 * the cap doing the work a deadline would otherwise do.
 */
export function rollMissionsIfDue(state: GameState, now: number): void {
  const window = windowIndex(now);
  if (state.kingdom.pass.lastWindow === window) return;
  // A write, so the season lands first — which also wipes a board left over
  // from a season that has closed.
  const pass = normalise(state, now);

  const week = weekIndex(now);
  if (pass.week !== week) {
    pass.week = week;
    pass.issuedThisWeek = {};
  }
  for (let slot = 0; slot < MISSIONS.perWindow; slot++) {
    if (pass.live.length >= MISSIONS.boardSize) break;
    const avoid = new Set(pass.live.map((m) => m.kind));
    const kind = chooseKind(state, window, slot, avoid, pass.issuedThisWeek);
    pass.live.push(issueMission(state, kind, window, slot));
    pass.issuedThisWeek[kind] = (pass.issuedThisWeek[kind] ?? 0) + 1;
  }
  pass.lastWindow = window;
}

// ---------------------------------------------------------------- the rewards

const packAt = (column: readonly string[], level: number): PackTier | null => {
  const tier = column[level - 1] ?? '';
  return tier === '' ? null : (tier as PackTier);
};

/** What one cell of one column holds. Packs are named separately from the
 *  wallet because a pack is not a currency — it is a thing that goes into the
 *  collection's queue and is opened by hand. */
export interface PassCell {
  level: number;
  wallet: Wallet;
  pack: PackTier | null;
}

export function freeCell(level: number): PassCell {
  const i = level - 1;
  const wallet: Wallet = {};
  if ((PASS.freeGems[i] ?? 0) > 0) wallet.Gems = PASS.freeGems[i];
  if ((PASS.freeGoldKeys[i] ?? 0) > 0) wallet.GoldKey = PASS.freeGoldKeys[i];
  if ((PASS.freeStardust[i] ?? 0) > 0) wallet.Stardust = PASS.freeStardust[i];
  return { level, wallet, pack: packAt(PASS.freePacks, level) };
}

export function paidCell(level: number): PassCell {
  const i = level - 1;
  const wallet: Wallet = {};
  if ((PASS.paidGems[i] ?? 0) > 0) wallet.Gems = PASS.paidGems[i];
  if ((PASS.paidGoldKeys[i] ?? 0) > 0) wallet.GoldKey = PASS.paidGoldKeys[i];
  if ((PASS.paidStardust[i] ?? 0) > 0) wallet.Stardust = PASS.paidStardust[i];
  return { level, wallet, pack: packAt(PASS.paidPacks, level) };
}

/** Is this cell waiting to be tapped? Reached, untaken, and — on the paid
 *  column — bought. */
export function cellPending(
  state: GameState, level: number, track: 'free' | 'paid', now: number,
): boolean {
  if (level < 1 || level > passLevel(state, now)) return false;
  if (track === 'paid' && !passOwned(state, now)) return false;
  return !claimed(state, now, track).includes(level);
}

/** Any cell at all waiting — what glows the pill and keeps the sheet worth
 *  opening. */
export const anyCellPending = (state: GameState, now: number): boolean => {
  const reached = passLevel(state, now);
  for (let l = 1; l <= reached; l++) {
    if (cellPending(state, l, 'free', now)) return true;
    if (cellPending(state, l, 'paid', now)) return true;
  }
  return false;
};

// ----------------------------------------------------------------- the claims

export type ClaimCellResult = 'Claimed' | 'NotReached' | 'NotOwned' | 'AlreadyClaimed';

/**
 * TAKE ONE CELL.
 *
 * Out of order and at the player's pace, the chest's rule verbatim: the cells
 * behind a late purchase are all open at once, and nothing expires before the
 * season does.
 */
export function claimCell(
  state: GameState, level: number, track: 'free' | 'paid', now: number,
): ClaimCellResult {
  if (track === 'paid' && !passOwned(state, now)) return 'NotOwned';
  if (level < 1 || level > passLevel(state, now)) return 'NotReached';
  if (claimed(state, now, track).includes(level)) return 'AlreadyClaimed';

  const cell = track === 'free' ? freeCell(level) : paidCell(level);
  pay(state, cell);
  const pass = normalise(state, now);
  const list = track === 'free' ? pass.claimedFree : pass.claimedPaid;
  list.push(level);
  list.sort((a, b) => a - b);
  return 'Claimed';
}

export type BuyPassResult = BuySkuResult | 'AlreadyOwned';

/**
 * Buy the season's paid column.
 *
 * BUYING OPENS EVERY LEVEL ALREADY REACHED, the Royal chest's argument
 * verbatim: without it, buying late costs the player rewards they earned by
 * playing, and a deadline that also punishes deliberating is the demand-shaped
 * design this game refuses. It grants nothing on the spot — what it hands over
 * is a column of cells to tap.
 */
export function buyPass(state: GameState, now: number): BuyPassResult {
  if (passOwned(state, now)) return 'AlreadyOwned';
  const result = buySku(state, 'SeasonPass', now);
  if (result !== 'Purchased') return result;
  normalise(state, now).paidSeason = seasonAt(now);
  return 'Purchased';
}

// -------------------------------------------------------------- the missions

export type ClaimMissionResult = 'Claimed' | 'NotFound' | 'NotComplete';

/**
 * TAKE A FINISHED MISSION'S REWARD, which pays twice: a currency into the
 * purse, and XP onto the ladder.
 *
 * The currency half is priced in HOURS OF THE CITY'S OWN PRODUCTION
 * (`productionChest`) rather than in an authored pile, for `tap.workSeconds`'s
 * reason: a number a spreadsheet chose in era one is a rounding error by era
 * three, and nothing re-derives it.
 *
 * The mission LEAVES THE BOARD when it is claimed. That is what makes the cap
 * pressure rather than a wall: the way to a new mission is to finish an old
 * one.
 */
export function claimMission(
  state: GameState, missionId: string, now: number,
): ClaimMissionResult {
  const pass = normalise(state, now);
  const mission = pass.live.find((m) => m.uniqueId === missionId);
  if (mission === undefined) return 'NotFound';
  if (!missionComplete(state, mission)) return 'NotComplete';
  payMission(state, mission);
  pass.live = pass.live.filter((m) => m.uniqueId !== missionId);
  return 'Claimed';
}

/**
 * WHAT GEMS IT COSTS to finish a mission that is stuck.
 *
 * Priced off the progress still OWED, so a mission nearly done is cheap and
 * one barely started is not — the sunk cost is the player's own, and the price
 * follows it down. Its job is to UNCLOG THE BOARD, which is the only thing the
 * cap makes valuable.
 */
export function missionGemCost(state: GameState, mission: Mission): number {
  const left = Math.max(0, mission.target - missionProgress(state, mission));
  const share = mission.target === 0 ? 0 : left / mission.target;
  return Math.max(
    MISSIONS.gemFloor,
    Math.round(MISSIONS.gemFloor + MISSIONS.gemPerRemaining * share * 10),
  );
}

export type FinishMissionResult = 'Finished' | 'NotFound' | 'AlreadyComplete' | 'NotEnoughGems';

/**
 * BUY A STUCK MISSION OUT.
 *
 * This is deliberate and it is the one place the pass contradicts
 * `14-monetization.md` §1 — the doc is amended rather than left to disagree
 * (§6 there). It pays the same reward the mission would have: Gems buy the
 * TIME, never a reward play cannot reach.
 */
export function finishMissionWithGems(
  state: GameState, missionId: string, now: number,
): FinishMissionResult {
  const pass = normalise(state, now);
  const mission = pass.live.find((m) => m.uniqueId === missionId);
  if (mission === undefined) return 'NotFound';
  if (missionComplete(state, mission)) return 'AlreadyComplete';
  const cost = missionGemCost(state, mission);
  if (getWallet(state.player.wallet, 'Gems') < cost) return 'NotEnoughGems';
  addToWallet(state.player.wallet, 'Gems', -cost);
  payMission(state, mission);
  pass.live = pass.live.filter((m) => m.uniqueId !== missionId);
  return 'Finished';
}

/**
 * PAY ONE MISSION: the thing it said it would pay, and the XP every mission
 * pays.
 *
 * The reward was rolled when the mission was ISSUED and has been readable on
 * the board ever since, so nothing is decided here — this only hands it over.
 */
function payMission(state: GameState, mission: Mission): void {
  const reward = mission.reward;
  if (reward.kind === 'Gems') {
    addToWallet(state.player.wallet, 'Gems', reward.amount);
  } else if (reward.kind === 'Mana') {
    // ON TOP OF THE CAP, like the daily chest's rung and the ad reward: a
    // grant clamped to a ceiling the player is already near would pay nothing
    // and read as broken.
    state.city.wallet.Mana = Math.max(
      0, getWallet(state.city.wallet, 'Mana') + Math.round(manaCap(state) * reward.fraction));
  } else {
    grantPack(state, reward.tier, 'pass');
  }
  state.kingdom.pass.xp += PASS.missionXp;
}

// ------------------------------------------------------------------ the guts

/**
 * Bring the stored block onto the current season before writing to it.
 *
 * READS never do this — they report a stale season as an empty pass, so
 * nothing has to run at a boundary. A WRITE has to land in the right season,
 * and this is the one place that decides which.
 *
 * THE BOARD IS WIPED with the season, unlike the chest's rungs, and
 * deliberately: a mission's target was rolled against the city as it stood,
 * and one issued in August has no business paying into September's ladder.
 */
function normalise(state: GameState, now: number): GameState['kingdom']['pass'] {
  const pass = state.kingdom.pass;
  const season = seasonAt(now);
  if (pass.season !== season) {
    pass.season = season;
    pass.xp = 0;
    pass.claimedFree = [];
    pass.claimedPaid = [];
    pass.live = [];
  }
  return pass;
}

/** Where each coin of a cell lands — the scopes the wallets already have. */
function pay(state: GameState, cell: PassCell): void {
  if (cell.wallet.Gems) addToWallet(state.player.wallet, 'Gems', cell.wallet.Gems);
  if (cell.wallet.GoldKey) addToWallet(state.player.wallet, 'GoldKey', cell.wallet.GoldKey);
  if (cell.wallet.Stardust) {
    addToWallet(state.kingdom.wallet, 'Stardust', cell.wallet.Stardust);
  }
  // Into the collection's own queue, unopened — a pack is a thing the player
  // opens by hand, never a number that lands in a purse.
  if (cell.pack !== null) grantPack(state, cell.pack, 'pass');
}
