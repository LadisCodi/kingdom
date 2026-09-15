# 20 · The season pass

> **Scope.** The 28-day pass on the collection's calendar: a ladder of levels
> with a free column and a paid one, and the **missions** that are the only
> thing that climbs it.
>
> **Status: built.**

## 1. Shape

- One ladder, **40 levels**, two reward columns — free and paid
  ([`13-events.md`](13-events.md) §2.4, OQ-20).
- It runs on the **collection's season**: 28 days, everyone's, the same clock
  the albums close on. There is no clock of its own.
- Opened by tapping the **Sowing Season** pill on the map. Never auto-opened.
- Levels come from **XP**, and the only source of XP is finishing a mission.
- The paid column is one purchase, `SeasonPass`, **€4.99**, once a season
  ([`14-monetization.md`](14-monetization.md) §2).

**The split against the daily chest.** Both are 28-day two-track ladders that
pay Gems, and the line between them is one sentence: the **chest pays for
showing up** (its ladder advances on days played), the **pass pays for
playing** (its ladder advances on XP).

## 2. The ladder

- Every level of both columns pays something. No rung is empty.
- **Every cell is its own claim**, taken out of order and at the player's pace.
  There is no claim-all and no button that pays both columns.
- Buying the pass **opens every level already reached** — a column of cells to
  tap, not a payout.
- Nothing on the ladder expires before the season does.
- **A pack from a cell opens itself** in the card reveal, where the player is
  standing ([`09-relics.md`](09-relics.md) §6). Claiming several deals them one
  at a time.
- The free column reaches the **grand prize** at level 40.

| Column | Pays |
|---|---|
| Free | Green / Yellow / Rose packs, Gems, Gold keys, Stardust — **24 packs a season** |
| Paid | Blue / Purple / Golden packs, more Gems, more keys, more Stardust — a pack every level |

- The pass **adds** Gold keys; the dungeon pays none.

## 3. The missions

### 3.1 The board

- **8 slots, one pool.** There is no daily list and no weekly list: a complex
  mission is meant to survive several days, which is the whole reason they
  share a board.
- **2 issued every 8 hours**, at 00:00 / 08:00 / 16:00 UTC.
- **A full board blocks.** Nothing new is issued, and therefore no new XP. The
  cap replaces the deadline.
- **Nothing expires**, and a window that passed while the board was full is
  never owed later.
- A mission **leaves the board when it is claimed**. The way to a new mission
  is to finish an old one.

### 3.2 What a mission is

- **Relative, always.** Progress counts from the moment the mission was
  issued; nothing that happened before it counts.
- The target is rolled in a per-kind `[min, max]` band. **"Collect X" is
  priced in minutes of the city's own production**, never in an absolute pile
  — the `tap.workSeconds` rule.
- Progress is read off a **lifetime odometer** that only ever goes up, so a
  mission can never un-progress: losing an army does not take back "train 5
  troops".

### 3.3 Active play only

**Missions progress only while the game is open.** An absence progresses
nothing and issues nothing; coming back, the player finds the board they left
and the next 8-hour window fills it.

### 3.4 What may be asked

Eligibility is checked at generation against the sim's own refusals, so a
mission can never ask for something the button would decline. **One kind is
always eligible**, so the board can always be filled.

| Mission | Refused when |
|---|---|
| Grow the town by X | nothing trains villagers |
| Upgrade buildings X times | every district is at its max level |
| Raise the Townhall a level | already at max, or the next level's technology is not in hand |
| **Collect X of a resource** | never — **the fallback** |
| Discover X cells | never |
| Build X buildings | every unlocked building is at its count cap |
| Train X soldiers | no trainer, or the army cap is full |
| Level heroes X times | no hero, or all at max level |
| Clear X dungeon rooms | no ruin open, or no hero to send |
| Complete X depths | as above |
| Open X card packs | never |

- A kind already on the board is avoided where possible.
- A kind may be issued at most **4 times a week** (Monday 00:00 UTC).

### 3.5 What a mission pays

**One thing, plus pass XP.** The reward is rolled when the mission is issued
and shown on its row, so a player picks what to do next by what it pays.

- **A hard errand always pays a Yellow pack.** Hard means it cannot be finished
  inside one session — it waits on a builder, a delve or a technology: *raise
  the Townhall*, *build X buildings*, *level heroes*, *clear rooms*, *complete
  depths*. It does not roll: an errand that waits three days has to say what it
  is worth before the player commits to it.
- **An ordinary errand rolls one of three** — Gems, Mana, or a **Green** pack,
  about a third each. Mana is a fraction of the pool and lands on top of the
  cap.
- The two pack tiers differ, or telling hard from ordinary would buy the player
  nothing.
- **A stuck mission can be finished with Gems**, priced off the progress still
  owed. It pays the mission's own reward — the Gems buy the TIME, never
  something better ([`14-monetization.md`](14-monetization.md) §1).

## 4. Where the packs come from

The card packs moved off the dungeon and onto the pass. The five authored
ruins used to pay a pack per room — 191 in the lifetime of an account, and
then nothing for ever. That is a welcome, not a supply. The dungeon now feeds
the collection through the missions it completes, which is the one source that
answers *playing more*.

This does not close **OQ-102**: 24 free-track packs plus the daily chest's 28
is ~52 against a target of 200. The pass changes the faucet's shape, not its
volume, and the repeatable dungeon still owes the bulk.

## 5. Dials, in the order to reach for them

| Dial | What it moves |
|---|---|
| `pass.mission_xp` | how fast the ladder climbs |
| `pass.level_xp_base`, `pass.level_xp_growth` | the level curve — linear, so the last rungs are not decoration |
| `pass.free_*`, `pass.paid_*` | the two columns. **Their length is the ladder's length** |
| `missions.board_size` | how many can sit unfinished. 8 is a big board for a ~30 min/day budget |
| `missions.per_window`, `missions.window_hours` | how fast they arrive |
| `missions.weekly_quota` | how often one kind may repeat |
| `missions.*_band` | how big each ask is |
| `missions.collect_minutes_*` | the collect ask, in minutes of production |
| `missions.hard_kinds` | which errands pay a pack. **Not a difficulty rating** — the list of kinds that cannot be finished in one session, and it changes as the game does |
| `missions.hard_pack`, `missions.normal_pack` | the two tiers |
| `missions.reward_gems`, `missions.reward_mana_fraction` | the other two rolls |
| `missions.gem_floor`, `missions.gem_per_remaining` | the price of finishing one |

## 6. The screen

- One sheet. The **board is on top** because it is the thing the player does;
  the ladder is underneath because it is what doing it is for.
- The ladder is the daily chest's: two columns on the same rows, and the
  paid column's **head is the buy button** while the pass is unbought.
- A cell is a button exactly when it can be taken. One padlock per cell.
- A mission row reads left to right: **what to do · how far · what for · the
  button**.
- A currency reward carries a leading **`+`**. A row can show two Gem figures
  meaning opposite things — what finishing pays and what skipping costs — and
  the sign is what tells them apart.
- A mission row's right-hand button is **one button with two faces** — green
  Claim when the work is done, a Gem price when it is not.
- The pill glows while a cell is waiting.

## 7. Deliberately not in this design

- **A weekly reward path** on top of the seasonal ladder. One ladder, one
  clock.
- **A mission that expires.** The board cap is the pressure; a deadline on a
  chore-shaped task is how a cozy game starts reading as work (OQ-16).
- **A mission that asks for Mana.** Mana is the session budget and nothing but
  a tap draws on it (OQ-17).
- **A reroll**, free, paid or ad-funded.
- **An absolute target** — "reach population 40". Every ask is relative to the
  moment it was issued.
- **Offline progress.** It is the one rule the whole feature is built around.
- A second pool, or separate daily and weekly lists.
- A relic on either column. The grand prize is a collectible
  ([`13-events.md`](13-events.md) §2.4).
- Pass XP from anything but a mission.

**Open questions:** OQ-16, OQ-17, OQ-53, OQ-102.
