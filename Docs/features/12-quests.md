# 12 · Quests, onboarding and the daily habit

> **Scope.** The single quest chain and the first-user experience it authors,
> plus the two mechanics that give a player a reason to open the game on a day
> nobody authored: the **daily chest** and **generated orders**.
>
> **Status: the chain and the daily chest are built. Generated orders are
> designed and unstarted** (§3) — unblocked, and the next thing to build.

## 1. The quest chain

**One chain, one active quest at a time.** Row order in the data *is* chain
order. Completing a quest lights the pill's **Claim**, which pays the reward and
activates the next. The pill disappears when the chain ends.

**50 quests, paying 11,865 Gold, 15 Gems and 158 Stardust.** Gold is the bulk of
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
*quest* is a row. That distinction is what makes orders nearly free (§3.2).

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

**Quests 35–50 are the long game**, re-ordered but not re-tuned: the Quarry, the
Mine, Urban Planning and Townhall 3, then Attunement, the Sanctum, a warband,
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
3. **The free first summon.** A pull costs 30 Gems and a new game grants 10. The
   first call on the standard banner is free, tracked on the pity counter that
   already persists.
4. **The Market moved into the opening.** It had been cut for length, and that
   was right while its only job was converting surplus into Gold that also had
   nowhere to go. **Orders give it a second job — the game's only infinite
   resource sink — and a sink the player does not meet until hour three is a sink
   that answers nothing.** So `Trade`, `ToMarket`, `Merchant` sit at quests
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

**Gem rewards sit in four late quests** (3 + 3 + 5 + 4 = 15), on top of the 10 a
new game grants and the 50 from five ruin first-clears — **75 up front**, which
is exactly the budget, and enough to reach research slot 3 by play.

But **they are concentrated late** — quests 20, 34, 42 and 50. A player who
stops after the authored arc has thirteen Gems, which buys nothing, so **every
Gem price in the game is effectively invisible for the whole first session.**
That is fine for slots and fatal for a store you want to instrument, which is
why the daily chest's week marker (§4) is the fix.

**Stardust appears on exactly four goal types** — `ClearRuins`, `ReachDepth`,
`OwnArtifacts`, `OwnHeroes` — so the currency first appears at the same moment
the Reliquary does. Everywhere else the chain pays Gold, which it needs.

## 3. Generated orders — the only infinite sink

### 3.1 What an order is

> *"Bring me 40 Wood, 25 Stone and 10 Food — take 600 Gold and two ingredients."*

**Three slots, refreshed daily**, drawn from the seeded RNG. It is the trains of
Township, the Merchant of Family Island and the Order Board of the casual genre,
and it is **the only infinite resource sink the genre has found.**

**Why it is needed:** every sink in the game is finite and already measured.
6,600 Gold of technology tree against a chain that pays 11,865. Buildings have
count caps. Units and supplies are bounded by the army cap. **When the tree is
done — three hours — surplus has nowhere to go, and the Market only converts it
into Gold, which also has nowhere to go.**

**Orders live in the Market, as a second tab.** It gives the Market the second
job the design already wants for it, needs no new placement or count cap, and
keeps the *tap the building* convention.

### 3.2 Why it is nearly free

> **An order needs a generator, not new goal types.**

The predicates already exist (`HoldResource`, `CollectResource`, `SellGoods`,
`CollectTaps`), reward delivery already exists, replay-safe generation already
exists, and the Market already exists. Orders draw over the *existing* types, so
this adds **no new type to the union** — which is what keeps it a shell around
quests rather than a fourteenth system.

```
orderId(day, slot)   = order#<day>#<slot>
resources(day, slot) = 1–3 of the currencies the player has unlocked,
                       weighted toward the ones they produce
amount(res)          = round( cityGatherPerSecond(res) × ORDER.secondsOfProduction )
                       floored at an authored minimum, so slot 1 works on day 1
```

**`ORDER.secondsOfProduction` is the strongest dial in the feature** and the
direct analogue of `tap.boostSeconds`. **An order asks for a duration of the
player's own output, so it is neither trivial at hour 40 nor impossible at hour
1, with nothing re-derived per era.**

### 3.3 Rewards

Priced the same way: **Gold worth N minutes of the city's tax income**, plus one
of a small pool of extras — 1★ ingredients, Stardust, Gems on an occasional slot,
and later event points.

> **An order must never pay the resources it asked for.** It is a sink, and the
> moment the loop closes on itself it becomes a laundering mechanic instead of a
> reason to keep producing.

### 3.4 No deadlines, but a reroll

**An unclaimed order is replaced at the daily refresh, not failed.** No timer on
the card, no *expires in* text.

The reasoning is the same as §4.1: a daily deadline on a chore-shaped task is how
a cozy game starts reading as work, and a ~30 min/day budget has no room for
three mandatory errands. **What replaces the pressure is choice** — three slots,
and you will not clear all three most days, so which one you take is the
decision.

A slot can be **rerolled** for a rewarded video or a small Gem cost — the comfort
purchase the third promise authorises, and a clean second ad placement.

## 4. The daily chest, and a streak that cannot be lost

### 4.1 The pillar problem, and the design that solves it

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

### 4.2 What it pays

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
| **7 · week marker** | **a full pool + 5 Gems** |
| 8+ | the same seven-step cycle, repeating |

The Mana amounts are **fractions of the cap, not absolute numbers**, for the same
reason the ad reward is a whole pool: ten claimed sanctuaries double the cap, so
the chest grows with exploration without a second table. **The Gold step is
priced in seconds of the city's own tax income** with an authored floor, so it
neither goes stale by era three nor pays zero to a city that has not housed
anyone yet.

**The Gems at the week marker do a second job:** ~20 Gems a month is the
recurring faucet §2.3 says the game needs and never had.

### 4.3 It only glows

**The chest is a pill, not a modal**, and **it never opens itself.** The whole
design is about a game that does not make demands, and a build that opens with
one contradicts it in the first second of the session. A daily reward that
interrupts the first tap is the single most disliked screen in the genre; a pill
that glows and waits is not.

The cost is real and accepted: **a player can finish a session without noticing
the chest, and lose it** — which is the same sanctioned pressure a missed day
already carries. It stays a one-line change if playtest disagrees.

### 4.4 Two rules the mechanic depends on

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

## 5. Dials, in the order to reach for them

1. **`order.seconds_of_production`** — what an order asks for, and therefore
   whether the feature is a sink or a nuisance.
2. **`daily.mana_fractions`** — the seven-step ladder as fractions of the cap.
3. **`order.slots`** — 3. More slots is more choice and more chore at the same
   time; this is the number playtest will move first.
4. **`daily.gems`** — 5 at the week marker. Also the recurring Gem faucet, so it
   cannot be tuned without re-checking the faucet total.
5. `order.reroll_gem_cost` and the reroll-by-ad cooldown.
6. **`daily.gold_seconds` / `daily.gold_floor`** — the one Gold step.
7. The chain itself — the `Quests` sheet, where **row order is chain order.**

## 6. Acceptance

- A player who has completed every authored quest opens the game on day 15 and
  has **three orders and a chest waiting.**
- The ladder survives a two-week absence at the step it reached.
- The same `(seed, day, slot)` produces the same order on two devices, and an
  order generated during an offline replay matches one generated live.
- **An order's ask is a similar fraction of the player's hourly output at
  Townhall 1 and at Townhall 3.**
- No new goal type was added to the union.

## 7. Deliberately not in this design

A streak that can be lost · a chest that opens itself · a deadline on an order ·
an order that asks for **Mana** (OQ-17) · an order that pays back what it asked
for · a second quest chain · branching quests.

**Open questions:** OQ-16, OQ-17, and OQ-47 (the near-shrine price the chain
points at).
