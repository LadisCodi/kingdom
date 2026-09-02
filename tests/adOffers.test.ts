// Ad offers (Docs/features/ad-economy.md): the rewarded-video refill, and the
// thing the Mana pool was made scarce for.
//
// Two claims are load-bearing. First, that `advance()` NEVER touches an
// offer — the cooldown is not a boundary source, because a recurring 30-90 s
// timer would propose tens of thousands of boundaries across a long absence
// against a 10,000-step seatbelt, and would make the offer's timing depend on
// how often the sim happened to sample Mana. Second, that an offer already
// shown is never revoked: it latches until the player claims it.
import { describe, expect, it } from 'vitest';
import {
  adCooldownMs, adOfferReward, claimAdOffer, refreshAdOffer,
} from '../src/sim/adOffers';
import { advance } from '../src/sim/commands';
import { AD } from '../src/sim/data/definitions';
import { mana, manaCap } from '../src/sim/mana';
import { deserialize, serialize } from '../src/sim/save';
import { freshGame, freshPresenter, map, T0 } from './helpers';

/** Ready to be offered: the cooldown elapsed and the pool below half. */
const eligible = (state = freshGame()) => {
  state.ads.readyAt = T0;
  state.city.wallet.Mana = Math.floor(manaCap(state) * AD.eligibleBelowFraction) - 1;
  return state;
};

describe('when an offer appears', () => {
  it('needs BOTH the cooldown and a pool below half', () => {
    const rich = freshGame(); // starts full
    rich.ads.readyAt = T0;
    refreshAdOffer(rich, T0);
    expect(rich.ads.pending).toBe(false); // pool is full

    const early = eligible();
    early.ads.readyAt = T0 + 60_000;
    refreshAdOffer(early, T0);
    expect(early.ads.pending).toBe(false); // cooldown has not elapsed

    const ready = eligible();
    refreshAdOffer(ready, T0);
    expect(ready.ads.pending).toBe(true);
  });

  it('latches: regen climbing back over half does not revoke it', () => {
    const state = eligible();
    refreshAdOffer(state, T0);
    expect(state.ads.pending).toBe(true);
    // The pool refills past the gate; the offer is already granted.
    state.city.wallet.Mana = manaCap(state);
    refreshAdOffer(state, T0 + 60_000);
    expect(state.ads.pending).toBe(true);
  });
});

describe('claiming', () => {
  it('pays a whole pool ON TOP, pushing it past the ceiling', () => {
    const state = eligible();
    refreshAdOffer(state, T0);
    const before = mana(state);
    const cap = manaCap(state);
    expect(adOfferReward(state)).toBe(cap);
    expect(claimAdOffer(state, T0)).toBe('Claimed');
    expect(mana(state)).toBe(before + cap);
    expect(mana(state)).toBeGreaterThan(cap); // overcharged, on purpose
  });

  it('consumes the offer and starts a fresh cooldown inside the authored range', () => {
    const state = eligible();
    refreshAdOffer(state, T0);
    expect(claimAdOffer(state, T0)).toBe('Claimed');
    expect(state.ads.pending).toBe(false);
    expect(state.ads.claims).toBe(1);
    expect(state.ads.readyAt - T0).toBeGreaterThanOrEqual(AD.cooldownMinSeconds * 1000);
    expect(state.ads.readyAt - T0).toBeLessThanOrEqual(AD.cooldownMaxSeconds * 1000);
  });

  it('refuses when nothing is offered, and changes nothing', () => {
    const state = eligible();
    const before = mana(state);
    expect(claimAdOffer(state, T0)).toBe('NoOffer');
    expect(mana(state)).toBe(before);
    expect(state.ads.claims).toBe(0);
  });

  it('rolls the same interval for the same save — the counter IS the key', () => {
    const a = freshGame();
    const b = freshGame();
    expect(adCooldownMs(a)).toBe(adCooldownMs(b)); // same seed, same claims
    a.ads.claims = 1;
    expect(adCooldownMs(a)).not.toBe(adCooldownMs(b)); // and it moves on
  });
});

describe('the offer is not part of the sim clock', () => {
  // The architectural guarantee. If anyone ever registers the cooldown as a
  // boundary source, this is the test that says why they should not.
  it('advance() leaves it untouched across a month', () => {
    const state = eligible();
    const before = { ...state.ads };
    advance(state, map, T0 + 30 * 24 * 3_600_000);
    expect(state.ads).toEqual(before);
  });

  it('survives a save round-trip with an offer standing', () => {
    const state = eligible();
    refreshAdOffer(state, T0);
    state.ads.claims = 3;
    const restored = deserialize(serialize(state, T0), map, T0)!;
    expect(restored.ads.pending).toBe(true);
    expect(restored.ads.claims).toBe(3);
    expect(restored.ads.readyAt).toBe(state.ads.readyAt);
  });

  it('reaches a save written before ad offers existed', () => {
    const state = freshGame();
    const save = serialize(state, T0);
    delete (save.Modules as Record<string, unknown>)['kingdom.adOffers'];
    const restored = deserialize(save, map, T0)!;
    expect(restored.ads.claims).toBe(0);
    expect(restored.ads.pending).toBe(false);
  });
});

// The presenter route: what the player actually taps. Node env, no jsdom —
// these assert presenter state, which is where the decisions live.
describe('the route through the offer', () => {
  const offered = () => {
    const state = eligible();
    const game = freshPresenter(state);
    game.notify(); // the latch runs here, not on the tick
    return game;
  };

  it('latches on notify, so a tap that empties the pool offers immediately', () => {
    const game = offered();
    expect(game.adOffer()).not.toBeNull();
    expect(game.adOffer()!.reward).toBe(manaCap(game.state));
  });

  it('declining closes the popup and leaves the offer standing', () => {
    const game = offered();
    game.openAdOffer();
    expect(game.openOverlay).toBe('adOffer');
    game.declineAdOffer();
    expect(game.openOverlay).toBe(null);
    expect(game.adOffer()).not.toBeNull(); // still there to take later
  });

  it('will not open a popup when nothing is offered', () => {
    const game = freshPresenter(freshGame()); // full pool, no offer
    game.openAdOffer();
    expect(game.openOverlay).toBe(null);
  });

  it('counts the ad down and refuses the reward until it finishes', () => {
    const game = offered();
    game.startAdWatch();
    expect(game.openOverlay).toBe(null); // the ad is its own surface
    const watch = game.adWatch()!;
    expect(watch.ready).toBe(false);
    expect(watch.secondsLeft).toBe(AD.watchSeconds);

    const before = mana(game.state);
    game.doClaimAdReward(); // too early
    expect(mana(game.state)).toBe(before);
    expect(game.adOffer()).not.toBeNull();
  });

  it('pays out once the countdown is done, and clears the tab', () => {
    const game = offered();
    game.startAdWatch();
    const before = mana(game.state);
    const cap = manaCap(game.state);
    // Rewind the start so the watch has finished.
    game.adWatchStartedAt = game.now() - AD.watchSeconds * 1000;
    expect(game.adWatch()!.ready).toBe(true);
    game.doClaimAdReward();
    expect(mana(game.state)).toBe(before + cap);
    expect(game.adWatch()).toBeNull();
    expect(game.adOffer()).toBeNull(); // the tab goes away
  });
});
