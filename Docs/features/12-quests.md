# 12 · Quests, onboarding and the daily habit

> **Scope.** The single quest chain and the first-user experience it authors,
> plus the mechanic that gives a player a reason to open the game on a day
> nobody authored: the **daily chest**.
>
> **Status: built.** Generated orders used to live here as §3 and were **cut on
> 2026-09-03** — the reasoning is in §6, and the job they were carrying went to
> [`16-wonders.md`](16-wonders.md).

## 1. The quest chain

**One chain, one active quest at a time.** Row order in the data *is* chain
order. Completing a quest lights the pill's **Claim**, which pays the reward and
activates the next. The pill disappears when the chain ends.

**50 quests, paying 11,865 Gold, 750 Gems and 158 Stardust.** Gold is the bulk of
it and doubles as the fog budget in an economy that starts with almost none.

### 1.1 Absolute versus relative, decided by the goal TYPE

- **Absolute** goals are predicates over current state: *have 2 Housing*,
  *Townhall at level 2*, *10 Wood in stock*. **Work done before the quest
  activates counts fully** — a fast player is never dead-ended by having already
  done the thing; the quest simply completes on activation.
- **Relative** goals count events from activation only: *collect 30 Gold*,
  *reveal 6 cells*. They hook the sim's own income, tap, reveal and sale paths,
  so **offline replay feeds them too**.

| Absolute | Relative |
|---|---|
| BuildDistrict · UpgradeDistrict · HoldResource · ReachPopulation · CompleteTech · CompleteTechs · AssignWorkers · TrainArmy · ClaimLandmarks · ReachDepth · ClearRuins · OwnArtifacts · OwnHeroes · BuyUpgrade | CollectResource · CollectTaps · DiscoverCells · DiscoverFeature · SellGoods |

**Goal types are code; goals are data.** A new *type* is a code change; a new
*quest* is a row — which is why the whole chain is authored in the workbook and
why a fiftieth quest costs nothing.

**`DiscoverFeature` is the type the opening turns on**, and it is a
`DiscoverCells` that cares *what* it uncovered. *Clear five cells* can be
satisfied in any direction, so it teaches the verb and nothing else; ***clear two
with forest on them* is a heading**, which is what the opening needs. The hint
points at a dark cell that actually has the thing on it, falling back to the
nearest frontier cell when none is in sight — because then the answer is still
*go and explore*.

Two things follow from it being relative: forest cleared before the quest
activates does not pay for it, and **the feature is carried on the reveal event**
rather than looked up later, so draining a finite bush minutes afterwards cannot
retroactively un-complete the quest.

**Beats overlap on purpose.** The 25 Wood quest 3 asks the player to chop is the
Wood quests 4 and 10 ask them to spend, so *collect it* and *spend it* are one
action rather than two errands.

## 2. The onboarding — the first 34 quests, beat by beat

The authored first-user experience. **Quest number is beat number**, and the
whole arc is asserted beat by beat in a test, so this table and the chain cannot
drift apart.

| # | Quest | The beat |
|---|---|---|
| **1** | `FirstSteps` | **The game opens on the FOG, not a tap** — and it names the FOREST, so the ground the player clears is the ground quest 3 asks them to chop. Those four cells are every forest reachable from the opening block. |
| **2–3** | `Woodcraft` · `Timber` | Research **Forestry** (a 3-second research) and *then* chop. The trees are visible and refusing from the first second — that is what makes the first research something the player wants. |
| **4–6** | `ARoof` · `Rations` · `FirstVillager` | A House → Food from the berries → the first villager. |
| **7** | `TaxDay` | **Rent is what pays for more fog**, and quest 8 asks for more fog. |
| **8** | `Explorer` | Push the fog back — eight cells, in any direction. |
| **9–14** | `Fields` → `ToWork` | **Agriculture** (crop plots *and* the Farm) → two plots → tap them → chop enough Wood for a Farm → **assign a worker.** Now it harvests without you. |
| **15–17** | `Trade` · `ToMarket` · `Merchant` | **Research, build, use.** The first beat at which the city makes more than it eats, so the first at which somewhere-for-the-surplus means anything. |
| **18–19** | `GrowingTown` · `Neighbors` | A second House, a third villager. |
| **20** | `ProperCapital` | **Townhall 2** — because TH1 caps the city at 2 Houses and 1 Sawmill, and quest 19 reaches the cap. **A tutorial that walls the player in is not a tutorial.** |
| **21–23** | `SawTeeth` · `TheSawmill` · `Crewed` | **Saws → the Sawmill → two workers on it.** Wood is automated. Chopping by hand and automating it are two decisions, eighteen beats apart. |
| **24–25** | `FurtherAfield` · `OldStones` | Fifteen more cells, then **claim the near shrine** — the first thing exploration pays that is not a resource. |
| **26–27** | `Mapmakers` · `Surveyors` | **Cartography**, then **Surveying ×2**: each level makes one tap on the fog do the work of one more. It does **not** make a cell cheaper. What it buys back is the player's *time*, which is what exploring actually spends once the far rings cost 320 and 640 Gold at one Gold a tap. |
| **28–29** | `Highlands` · `PutToSea` | **Scaling Tools** and **Sailing** — mountains and water become explorable. Both hang off Cartography, so 26 → 29 is one branch. |
| **30–32** | `ArmedMen` · `Mustered` · `FirstSoldier` | A ruin is in sight and it is not empty. **Warrior → Barracks → the first soldier.** The Barracks needs 20 Stone, supplied by hand from the rock outcrop — the Quarry is not until quest 35. |
| **33** | `FirstSummon` | **Summon at the banner. The first call is free.** |
| **34** | `IntoTheDark` | **Survive one depth** of the Hollow Barrow. |

**Quests 35–50 are the long game**, re-ordered but not re-tuned: the Quarry,
Urban Planning, Townhall 3 and Mining, then Attunement, the Sanctum, a warband,
the first full ruin clear, attuning a relic, four landmarks, depth five, and
three relics held at once.

### 2.1 The four decisions that made it work

1. **The opening purse.** Step 1 is *discover cells*, revealing costs Gold, and a
   new game started with **none** — so the opening had no entry point at all. A
   new kingdom now starts with **50 Gold**, and that one purse pays for both jobs:
   the four forest cells quest 1 asks for (~16 Gold) *and* Forestry (25), against
   50 plus quest 1's 10 Gold reward. **That sum is asserted at the dearest
   frontier the player could pick**, so it fails if anyone retunes the fog curve,
   the grant, quest 1's reward or Forestry's price in isolation.
2. **A gated forest is the reason the first research is wanted.** The trees are
   visible and refusing from the first second, and the refusal says *research
   Forestry before you can work this* rather than *come back later*.
3. **The free first summon.** A pull costs 1,000 Gems and a new game grants 500. The
   first call on the standard banner is free, tracked on the pity counter that
   already persists.
4. **The Market moved into the opening.** It had been cut for length, and that
   was right while its only job was converting surplus into Gold that also had
   nowhere to go. **What earns it the slot is the far end of the chain it
   starts:** materials become Gold, and Gold now has somewhere to go that has no
   last level ([`16-wonders.md`](16-wonders.md)). So `Trade`, `ToMarket`,
   `Merchant` sit at quests
   15–17, the first beat where the city produces more than it eats: research,
   build, use — the same three-beat shape as `Saws → Sawmill → Crewed`, because
   **a building the chain never taught the player to research is a building they
   find by accident.**

### 2.2 What the onboarding forced elsewhere

Every dead end in an onboarding is an **arithmetic failure between two numbers
authored in different sheets**, and neither side's own unit test can see it.
Playing the real opening through the real sim with **no funding at all** — only
what the game grants and what it earns — is what found these:

- **A crop plot costs 10 Wood** (was 20). At 20 it cost twice a House, which
  stranded the player with nothing left after the roof.
- **The first chop asks for 25 Wood** (was 10) — enough for the roof *and* the
  plot.
- **A level-1 House holds 2**, so the second villager needs no second roof.
- **Townhall L1→L2 costs 60 Wood** (was 40 W + 20 S). The chain reaches TH2 at
  quest 20 and the Quarry at quest 35, so the upgrade could not ask for Stone.
- **The Market beats were repriced** 250/290 → 110/120 when they moved forward,
  with `Trade` at 100 in front. 540 Gold at that position would have nearly
  doubled the early economy.

### 2.3 Where Gems and Stardust appear

**Gem rewards sit in four late quests** (150 + 150 + 250 + 200 = 750), on top of
the 500 a new game grants and the 2,500 from five ruin first-clears — **3,750 up
front**, which is exactly the budget. Rescaled ×50 on 2026-09-04 when every Gem
sink moved to the 500-Gems-a-dollar ladder
([`14-monetization.md`](14-monetization.md) §2.2): it reaches the second
builder (2,500) and a pull by play; the later rungs arrive at one a month from
the daily chest, or from a wallet.

But **they are concentrated late** — quests 20, 34, 42 and 50. A player who
stops after the authored arc has 800 Gems, which buys a Mana refill and nothing
else, so **every other Gem price in the game is effectively invisible for the
whole first session.**
That is fine for slots and fatal for a store you want to instrument, which is
why the daily chest's week marker (§3) is the fix.

**Stardust appears on exactly four goal types** — `ClearRuins`, `ReachDepth`,
`OwnArtifacts`, `OwnHeroes` — so the currency first appears at the same moment
the Reliquary does. Everywhere else the chain pays Gold, which it needs.

## 3. The daily chest, and a streak that cannot be lost

### 3.1 The pillar problem, and the design that solves it

A conventional login streak resets to zero when you miss a day. **That is a loss
of accumulated progress, and it breaks promise 1.** It is also exactly the
mechanic that makes a cozy game feel like an obligation.

> **The rule: the ladder advances on days PLAYED, never on calendar days.**

Step 1 the first day you open the game, step 2 the second day you open it,
whether that is tomorrow or in three weeks. **Missing a day costs you that day's
chest** — an opportunity that expired, which is the sanctioned pressure — and
nothing else. **The ladder is a possession; the day is not.**

This also removes the whole class of bug where a timezone, a clock change or a
device swap eats someone's streak, and it means the mechanic needs no *streak
repair* purchase, which is the ugliest SKU in the genre.

### 3.2 What it pays

**Mana is the primary reward, and it is the obvious one:** already the thing a
returning player wants, already the only capped currency, and already priced in
seconds of the player's own production — so a Mana reward never goes stale as the
city grows.

| Step | Reward |
|---|---|
| 1 · 2 | Mana, ~⅓ of the pool |
| 3 | Mana, ~½ pool |
| 4 | Mana ~⅓ + a Gold sum |
| 5 | Mana, ~½ pool |
| 6 | Mana, ~⅓ pool |
| **7 · week marker** | **a full pool + 250 Gems** |
| 8+ | the same seven-step cycle, repeating |

The Mana amounts are **fractions of the cap, not absolute numbers**, for the same
reason the ad reward is a whole pool: ten claimed sanctuaries double the cap, so
the chest grows with exploration without a second table. **The Gold step is
priced in seconds of the city's own tax income** with an authored floor, so it
neither goes stale by era three nor pays zero to a city that has not housed
anyone yet.

**The Gems at the week marker do a second job:** ~1,000 Gems a month is the
recurring faucet §2.3 says the game needs and never had — a pull, or two
refills, every month by play.

### 3.3 It only glows

**The chest is a pill, not a modal**, and **it never opens itself.** The whole
design is about a game that does not make demands, and a build that opens with
one contradicts it in the first second of the session. A daily reward that
interrupts the first tap is the single most disliked screen in the genre; a pill
that glows and waits is not.

The cost is real and accepted: **a player can finish a session without noticing
the chest, and lose it** — which is the same sanctioned pressure a missed day
already carries. It stays a one-line change if playtest disagrees.

### 3.4 Two rules the mechanic depends on

- **The rollover is UTC.** A local-midnight rollover would make the ladder depend
  on where the device thinks it is — a player crossing a timezone could claim
  twice or lose a day. The cost is that *a new day* lands at a different
  wall-clock hour for different players, which for a mechanic that never punishes
  a miss is a cost of nothing.
- **A missed day is never paid retroactively.** One claim per day, never a
  backlog of seven.

**The ladder is drawn with the rungs behind you lit rather than greyed, and there
is no countdown anywhere on the sheet.** Most progress UI exists to create
urgency; this one exists to remove it.

## 4. Dials, in the order to reach for them

1. **`daily.mana_fractions`** — the seven-step ladder as fractions of the cap.
2. **`daily.gems`** — 250 at the week marker. Also the recurring Gem faucet, so
   it cannot be tuned without re-checking the faucet total.
3. **`daily.gold_seconds` / `daily.gold_floor`** — the one Gold step.
4. The chain itself — the `Quests` sheet, where **row order is chain order.**

## 5. Acceptance

- A player who has completed every authored quest opens the game on day 15 and
  **has a chest waiting.**
- The ladder survives a two-week absence at the step it reached.
- The opening is played through the real sim with **nothing granted** — only
  what the game gives and what it earns — and reaches the end of the authored
  chain without a dead end.
- No new goal type was added to the union.

## 6. Deliberately not in this design

A streak that can be lost · a chest that opens itself · a second quest chain ·
branching quests · **generated orders**.

### Generated orders, cut 2026-09-03

Three daily fetch-quests in a second Market tab, drawn from the seeded RNG and
sized as a duration of the player's own output. They were designed in full,
were unblocked, and were the next thing on the plan. **They do not fit the game
this turned out to be.**

The argument for them was that they are *the only infinite resource sink the
genre has found*, and that argument does not survive being measured. It rested
on *"when the tree is done — three hours — surplus has nowhere to go"*, which
priced the problem against the **smallest** Gold sink in the game: the 6,600
Gold tree, with 527,000 of landmark claims and 194,142 of fog sitting above it.
**The problem was never the size of the sink — it was that every sink has a last
level**, and the answer to that is a ladder with no top rather than a daily
errand ([`16-wonders.md`](16-wonders.md) §1).

**What is kept:** the rule the design died holding — *a sink must never pay
back what it asked for* — which is now [`16-wonders.md`](16-wonders.md) §3.1,
made structural rather than numerical. And the framing of working rule 2: an
ask, like a reward, is priced in a duration of the player's own production.

**What went with them:** OQ-16 (do orders expire) and OQ-17 (does an order ask
for Mana), both moot; the order reroll as an ad placement and as a pass reward
([`14-monetization.md`](14-monetization.md)); *an order completed* as an event
task and as a guild contribution trigger. And `cityGatherPerSecond`
(`src/sim/upgrades.ts:80`) now has **no caller in `src/` at all** — order sizing
was the last one.

**Open questions:** OQ-47 (the near-shrine price the chain points at) and OQ-53
(`CollectResource` cannot tell the hand from the crew, so one authored quest is
completable by the workers).
