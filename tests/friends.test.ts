// The friends' reward path (Docs/features/15-social.md §2.1): one reward per
// milestone of friends who count, each taken once, kept by the save.
import { describe, expect, it } from 'vitest';
import { FRIENDS, ITEMS } from '../src/sim/data/definitions';
import {
  claimFriendReward, claimableFriendRewards, friendCounts, friendMilestones, friendPathDone,
} from '../src/sim/friends';
import { deserialize, serialize } from '../src/sim/save';
import { getWallet } from '../src/sim/state';
import { firstGame, map, T0 } from './helpers';

describe('the friends\' reward path', () => {
  it('is parallel lists, rising, each milestone paying something the build knows', () => {
    const n = FRIENDS.milestones.length;
    expect(FRIENDS.gems).toHaveLength(n);
    expect(FRIENDS.items).toHaveLength(n);
    for (let i = 1; i < n; i++) expect(FRIENDS.milestones[i]).toBeGreaterThan(FRIENDS.milestones[i - 1]);
    expect(FRIENDS.milestones[n - 1]).toBeLessThanOrEqual(FRIENDS.max);
    for (const id of FRIENDS.items) if (id !== '') expect(ITEMS[id as keyof typeof ITEMS]).toBeDefined();
    for (const m of friendMilestones()) {
      expect(Object.keys(m.reward.wallet).length + Object.keys(m.reward.items).length).toBeGreaterThan(0);
    }
  });

  it('counts a friend only from the Townhall the data names', () => {
    expect(friendCounts(FRIENDS.countsFromTownhall - 1)).toBe(false);
    expect(friendCounts(FRIENDS.countsFromTownhall)).toBe(true);
  });

  it('pays each milestone once it is reached, and never twice', () => {
    const state = firstGame();
    const gems = getWallet(state.player.wallet, 'Gems');
    const first = friendMilestones()[0];
    expect(claimableFriendRewards(state, first.friends - 1)).toEqual([]);
    expect(claimFriendReward(state, 0, first.friends - 1)).toBe('NotReached');
    expect(claimableFriendRewards(state, first.friends)).toEqual([0]);
    expect(claimFriendReward(state, 0, first.friends)).toBe('Claimed');
    expect(getWallet(state.player.wallet, 'Gems')).toBe(gems + (first.reward.wallet.Gems ?? 0));
    for (const [id, n] of Object.entries(first.reward.items)) expect(state.bag.held[id as keyof typeof ITEMS]).toBe(n);
    expect(claimFriendReward(state, 0, first.friends)).toBe('AlreadyClaimed');
    expect(claimFriendReward(state, 99, 99)).toBe('NoSuchReward');
    expect(state.pendingAnalytics.some((e) => e.name === 'friend_reward_claimed')).toBe(true);
  });

  it('is put away once every reward is taken', () => {
    const state = firstGame();
    const all = FRIENDS.milestones[FRIENDS.milestones.length - 1];
    for (const i of claimableFriendRewards(state, all)) claimFriendReward(state, i, all);
    expect(friendPathDone(state)).toBe(true);
  });

  it('keeps what was taken across a save', () => {
    const state = firstGame();
    claimFriendReward(state, 0, FRIENDS.milestones[0]);
    const back = deserialize(serialize(state, T0), map, T0)!;
    expect(back.kingdom.friends.claimed).toEqual([0]);
  });
});
