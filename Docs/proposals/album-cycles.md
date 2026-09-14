# Proposal — the album cycle

> **What this is.** How a relic's level actually advances — **within** a season
> by closing all five albums and running them again (§1–§4), and **across**
> seasons by rotating which relic each album levels (§6). It is a **proposal**,
> not a feature doc: nothing here is built.
>
> **The two halves answer one question each.** The cycle is for a player who
> has finished everything and has a fortnight left. The rotation is for the
> player who never reaches the last three albums at all — which is most of
> them, and which is why the ladder is the one worth fixing first.
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

## 6. Rotating which relic each album levels

### 6.1 The problem: the difficulty is fixed and the reward is not

The five albums sit on a fixed ladder of rarity, and **every one of them pays
exactly one relic level**. Same ticket, wildly different price. The chest and
the keys already scale with the rung — `2 · 2 · 4 · 8 · 8` hours, silver,
silver, silver, gold, gold — and the **relic level, the only permanent thing,
does not**.

That does not merely slow the hard relics down. A relic has no ceiling and
rises a level a season, so a player closing two of five (**OQ-88**'s target)
diverges for ever:

```
after six seasons:  Dowsing Rod 6 · Verdant Seal 6
                    Foreman's Sigil 0 · Gilded Ledger 0 · Wanderer's Compass 0
```

- Three of the five relics are not *slower*. They **do not exist**, and with
  the actives of [`relic-effects.md`](relic-effects.md) that is three
  abilities the player will never cast.
- The hard albums are also the **strong** ones — the tax rate and the Stardust
  yield are behind the gold cards — so difficulty and power point the same way.
- It contradicts [`09`](../features/09-relics.md) §5's own line, *"nothing
  rushes one relic ahead of the others… a player's relic levels read their
  history"*, which is true only for somebody who closes all five.

### 6.2 The fix: the album is fixed, the PAIRING rotates

- **An album is its nine cards.** Its name, its art, its card names and their
  rarities never change. *First Furrow* is always Ploughshare, Seed Sack,
  Scarecrow — and the Ploughshare is always 1★.
- **Which relic an album levels is per-season.** One season *First Furrow*
  levels the Dowsing Rod; the next it levels the Verdant Seal.
- **Rotate by one a season**, derived from the season's occurrence rather than
  authored: `relic = ARTIFACT_ORDER[(albumIndex + occurrence) mod 5]`. Derived
  because the seasons list cycles — with two seasons authored, a hand-written
  pairing would only ever show two of the five arrangements.
- **A full rotation is five seasons — 70 days.** In ten weeks every relic has
  sat on the easy album once, so a player who never buys a pack still levels
  all five, just one at a time.
- **A payer skips the wait**: buying Gold and Star packs closes the hard albums
  in the same season, so they level all five every fortnight instead of one.
  That is the difference the money buys, and it is a *rate*, not a wall.

### 6.3 Why the pairing rotates and not the rarities

The other way round — albums keep their relic and the **rarities** move — also
converges, and it is worse:

- **A card's rarity is part of its identity.** It is drawn on the card, it
  prices the card's stars, it prices its melt, and it decides which wildcard
  covers it. A Ploughshare that is 1★ this season and 5★ gold the next is not
  a collectible, it is a slot.
- It would make the art unauthorable: the same card needs a gold frame some
  seasons and not others.

**What it costs instead** is a line in [`09`](../features/09-relics.md) §3 —
*"which relic each album levels is not per-season content — it is one album per
relic, in the same order, for ever"* — and §13's *"two albums for one relic"*.
The player now re-learns one badge a season instead of never. That badge is
already drawn: §11.2 puts the relic on the medallion's ring and §11.3 puts it
in the album's reward band, so the UI says it without a new pixel.

### 6.4 Keep the ladder exactly as it is

The five compositions already shipped are already the right ladder, and two of
them are already free:

| Rung | 1★ | 2★ | 3★ | 4★ | 4★g | 5★ | 5★g | Closable from the ruins? |
|---|---|---|---|---|---|---|---|---|
| **I** *First Furrow* | 4 | 5 | | | | | | **yes** — Bronze |
| **II** *The Wild Wood* | 2 | 3 | 4 | | | | | **yes** — Silver |
| **III** *Hands at Work* | | 3 | 3 | 3 | | | | no — needs Gold |
| **IV** *The King's Coin* | | | 3 | 2 | 1 | 2 | 1 | no — needs Star |
| **V** *The Star Road* | | | 3 | 2 | 1 | 2 | 1 | no — needs Star |

- **A rung-I album must stay inside 1★–2★.** Bronze rolls 1★ and 2★ only and
  Silver adds 3★; **neither can roll a 4★**. A composition like `4×1★, 3×2★,
  1×3★, 1×4★` would put the easiest album behind a Gold pack and take the free
  player from two albums a season to **none** — the opposite of what the
  rotation is for.
- **Rungs IV and V are identical**, so the ladder has five rungs and four
  difficulties. Splitting them would make each of the five seasons in a
  rotation feel distinct; leaving them is harmless.

### 6.5 The one wrinkle

The relic EFFECTS are tiered to match today's difficulty: the cheap albums
carry the two harvest clocks, which a new city needs, and the dear ones carry
the tax rate and the Stardust yield. Rotation dissolves that alignment — a
first-season player can draw the **Wanderer's Compass** on rung I, and
*"+Stardust from rooms"* is worth nothing to somebody who has never delved.

- **Let it rotate anyway.** A relic whose effect is not useful yet is still a
  level banked for ever, and the alternative — pinning the Compass to the hard
  rungs — is the divergence again for one relic.

## 7. What it would take

| Step | Where |
|---|---|
| `AlbumDef.relic` becomes `relicOfAlbum(album, occurrence)`, and `albumOfRelic` takes the season | `data/seasons.ts` |
| The 16 call sites that read `.relic` take the season | `game.ts`, `collection.ts`, `ui/collectionSheet.ts` |
| A test that five seasons give every relic every rung exactly once | `tests/artifacts.test.ts` |
| Closing an album spends its nine cards; duplicates survive | `collection.ts#completeIfDue` |
| `completed` resets when all five are in it — and a `cycle` counter alongside, so a payout knows which lap it is | `collection.ts`, `state.ts` |
| The prize and the album Gems read the lap (§4.1, §4.2) | `collection.ts#payCollectionPrize`, `#albumRewards` |
| The album screen says which lap it is on, and the medallion shows the relic's level rising | `ui/collectionSheet.ts` |
| `SAVE_VERSION` bump; a migrator is needed this time, because `cards` now means *unspent* cards | `sim/save.ts` |

- **The rotation (§6) needs no save change and no balance change**, because the
  pairing is derived from the occurrence, which is already derived from the
  clock. **The cycle's save change is the one that needs care**: every other
  change here is additive, and spending cards changes what an existing save's
  `cards` map MEANS.

## 8. Deliberately not in this proposal

- **An album completed twice before its four siblings are completed once.**
  Breadth before depth, or a player pumps the cheap album and the five relic
  levels stop reading the same.
- **Cards surviving the close of a season.** The wipe is what makes a spare
  card free to give (§3 of `09`), and it is the whole reason trading is safe.
- **A repeat that pays the collection prize**, or the full Gem purse.
- **Keeping the cards on reset.** It does not terminate (§2).
- **Rotating a card's RARITY instead of the pairing** (§6.3). A card's rarity is
  its identity, its stars, its melt and which wildcard covers it.
- **A rung-I album that reaches past 3★.** Bronze and Silver cannot roll a 4★,
  so it would take the free player from two albums a season to none (§6.4).
- **Pinning one relic out of the rotation** because its effect suits a late
  city. A level banked early is still banked (§6.5).

