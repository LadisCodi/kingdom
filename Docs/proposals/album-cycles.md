# Proposal — the album cycle

> **What this is.** Levelling a relic **more than once a season**, by closing
> all five albums, claiming, and starting the five again on the same season's
> cards. It is a **proposal**, not a feature doc: nothing here is built.
>
> **It replaces a written rule.**
> [`../features/09-relics.md`](../features/09-relics.md) §1 says *"a relic
> rises at most one level a season"*, §5 says *"three seasons closed in full
> is level 3 on all five"*, and §13 writes out *"levelling one relic twice in
> a season"*. This proposes the opposite, and §4 is what that costs.

## 1. The loop

1. **Complete all five albums.** Each one pays what it pays today — the relic
   a level, a chest of production, keys and Gems.
2. **Claim the collection prize** ([`09`](../features/09-relics.md) §5).
3. **The five albums reset**, and the cycle may run again.
4. **At the close of the season**, the cards go for good (§3 of `09`).

- **An album cannot be completed twice until all five have been completed
  once.** Breadth before depth: nothing rushes one relic ahead of the others,
  which is the rule that makes a player's five relic levels read the same.
- **Only the REPEAT is gated.** A player who closes two of five in a season
  still takes those two relic levels, exactly as today. The cycle is what the
  fifth album unlocks, not a toll on the first.

## 2. The cards have to be SPENT

**This is the load-bearing change, and without it the loop does not
terminate.**

Completing an album today consumes nothing. `albumHeld(album) >= 9` is the
test and `completed` is the only guard, so resetting `completed` while the
player still holds the cards re-completes all five **on the same tick**, for
ever.

- **Closing an album spends its nine cards.** The album empties, the relic
  takes its level, and the nine slots are open again.
- **Duplicates are not spent.** A tenth copy of a card stays in hand and fills
  its slot the moment the album resets — which is what makes a hoard of
  duplicates worth holding rather than dumping in the vault.
- That is also what makes the whole thing legible on screen: after a cycle the
  album is visibly empty, and `x/9` counts up again.

## 3. What it is good for

- **Trading gets better, not worse.** Every cycle needs specific cards again,
  so *"take this duplicate I cannot use, give me the one I am missing"* is the
  conversation on every lap rather than once a fortnight
  ([`09`](../features/09-relics.md) §8).
- **The relic ladder stops being hostage to the calendar.** A player who is
  playing hard has something to do with the packs they are opening on day 9 of
  a 14-day season, which today are duplicates and nothing else.
- **It makes the relic actives worth chasing.** Radius steps at levels 5, 10
  and 20 ([`relic-effects.md`](relic-effects.md) §2.3), and a player two cards
  from a step can now reach it this season instead of in five months.

## 4. What it costs, and the three things to fix first

### 4.1 The collection prize cannot repeat

The prize is **25,000 Gems and a golden call guaranteed to be the season
hero**. The season's whole Gem budget is about 35,000, and the golden call is
a guaranteed **Legendary**.

- **Recommendation: the prize is once a season.** The second cycle and every
  cycle after pays the five albums' own rewards and the five relic levels, and
  no prize.
- A repeat prize would hand a guaranteed Legendary per lap, which retires the
  golden banner — the thing the whole gacha is built to sell.

### 4.2 The album Gems should taper

Five albums pay **2,000 Gems each, 10,000 a cycle**. At two cycles that is
20,000 Gems a season from the collection alone, before the prize.

- **Recommendation: the Gems are the first cycle's.** A repeat pays the
  production chest, the keys and the relic level — the things that scale with
  the city and do not inflate a hard currency.
- The chest is safe to repeat by construction: it is priced in **hours of what
  the city makes right now**, so it is the same fraction of a day at every
  stage and cannot run away.

### 4.3 A relic level stops reading a player's history

[`09`](../features/09-relics.md) §5 ends on a good line: *"a player's relic
levels read their history"* — level 3 meant three seasons closed in full.
Under cycles, level 3 means three cycles, which is mostly a statement about
how many packs were opened.

- That is a real identity change and it should be made on purpose, not
  discovered later. **It is also the point**: the ladder moves from *how long
  you have played* to *how much you have collected*.

## 5. How big is a cycle, really

A full cycle is **45 distinct cards**, and the card pool is not uniform.
Simulated against the shipped pack odds:

| Opening | Packs to fill all 45 |
|---|---|
| An even mix of Bronze, Silver, Gold and Star | **~72** |
| Bronze only | **never** |
| Bronze and Silver only — what the ruins drip | **never** |
| Star only | **never** |

**No single tier can finish a season**, because the weights are disjoint at
both ends:

| Album | Rarities it holds | Can be finished by |
|---|---|---|
| **First Furrow** | 1★ 2★ | Bronze, Silver |
| **The Wild Wood** | 1★ 2★ 3★ | Silver |
| **Hands at Work** | 2★ 3★ 4★ | **Gold** |
| **The King's Coin** | 3★ 4★ 4★gold 5★ 5★gold | **Star** |
| **The Star Road** | 3★ 4★ 4★gold 5★ 5★gold | **Star** |

- A player with only the ruins' faucet (Bronze and Silver) can close the first
  two albums and **cannot** close the last three. That is already **OQ-88**'s
  target of *two of five free* — so the cycle changes nothing for them.
- **Closing all five needs Gold and Star packs, every lap.** Today those come
  from the store, the vault, and five one-off ruin bottoms. So a cycle is a
  spender's lap until the designed free faucets exist — the daily chest's free
  track, the event track and the pass, none of which are built.
- **The cycle is therefore mostly a monetisation feature.** That is a
  legitimate thing for it to be, and it should be argued as one rather than as
  a pacing fix for everybody. **OQ-100.**

## 6. What it would take

| Step | Where |
|---|---|
| Closing an album spends its nine cards; duplicates survive | `collection.ts#completeIfDue` |
| `completed` resets when all five are in it — and a `cycle` counter alongside, so a payout knows which lap it is | `collection.ts`, `state.ts` |
| The prize and the album Gems read the lap (§4.1, §4.2) | `collection.ts#payCollectionPrize`, `#albumRewards` |
| The album screen says which lap it is on, and the medallion shows the relic's level rising | `ui/collectionSheet.ts` |
| `SAVE_VERSION` bump; a migrator is needed this time, because `cards` now means *unspent* cards | `sim/save.ts` |

- **The one that needs care is the save.** Every other change here is additive;
  spending cards changes what an existing save's `cards` map MEANS.

## 7. Deliberately not in this proposal

- **An album completed twice before its four siblings are completed once.**
  Breadth before depth, or a player pumps the cheap album and the five relic
  levels stop reading the same.
- **Cards surviving the close of a season.** The wipe is what makes a spare
  card free to give (§3 of `09`), and it is the whole reason trading is safe.
- **A repeat that pays the collection prize**, or the full Gem purse.
- **Keeping the cards on reset.** It does not terminate (§2).

**Open questions:** OQ-88, OQ-100 in
[`../open-questions.md`](../open-questions.md).
