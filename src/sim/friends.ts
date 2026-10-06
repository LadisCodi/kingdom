// THE FRIENDS' REWARD PATH (Docs/features/15-social.md §2.1): a reward at
// each count of friends who count — those whose Townhall has reached
// `FRIENDS.countsFromTownhall`. Who the friends are is the social server's;
// the client hands the count in, and the save keeps only what was taken, so
// a friend removed and added again pays nothing twice.

import { FRIENDS, ITEMS } from './data/definitions';
import { track } from './analytics';
import { grant, type Grant, type ItemStock } from './rewards';
import type { GameState, ItemId, Wallet } from './state';

/** One reward on the path. */
export interface FriendMilestone {
  /** Its place on the path, from 0. */
  index: number;
  /** Friends who count, that it asks for. */
  friends: number;
  reward: Grant;
}

/** Every reward on the path, in order. */
export function friendMilestones(): FriendMilestone[] {
  return FRIENDS.milestones.map((friends, index) => {
    const wallet: Wallet = {};
    const items: ItemStock = {};
    const gems = FRIENDS.gems[index] ?? 0;
    if (gems > 0) wallet.Gems = gems;
    const item = (FRIENDS.items[index] ?? '') as ItemId;
    if (ITEMS[item] !== undefined) items[item] = 1;
    return { index, friends, reward: { wallet, items, fragments: 0 } };
  });
}

/** Does this friend count toward the path? */
export const friendCounts = (townhall: number): boolean => townhall >= FRIENDS.countsFromTownhall;

export const friendRewardClaimed = (state: GameState, index: number): boolean =>
  state.kingdom.friends.claimed.includes(index);

/** Rewards reached and not yet taken, with this many friends who count. */
export const claimableFriendRewards = (state: GameState, counting: number): number[] =>
  friendMilestones().filter((m) => counting >= m.friends && !friendRewardClaimed(state, m.index)).map((m) => m.index);

/** Has every reward on the path been taken? Then the path is put away. */
export const friendPathDone = (state: GameState): boolean =>
  friendMilestones().every((m) => friendRewardClaimed(state, m.index));

export type ClaimFriendRewardResult = 'Claimed' | 'NotReached' | 'AlreadyClaimed' | 'NoSuchReward';

/** Take one reward, with `counting` friends who count as the server last
 *  said. */
export function claimFriendReward(state: GameState, index: number, counting: number): ClaimFriendRewardResult {
  const m = friendMilestones()[index];
  if (m === undefined) return 'NoSuchReward';
  if (friendRewardClaimed(state, index)) return 'AlreadyClaimed';
  if (counting < m.friends) return 'NotReached';
  grant(state, m.reward, ['friends', index]);
  state.kingdom.friends.claimed.push(index);
  state.kingdom.friends.claimed.sort((a, b) => a - b);
  track(state, 'friend_reward_claimed', { index, friends: m.friends });
  return 'Claimed';
}
