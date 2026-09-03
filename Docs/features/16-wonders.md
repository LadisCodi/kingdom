# 16 · Wonders — the ladder with no top

> **Scope.** The buildings whose upgrade ladder never ends, and the reason the
> economy needs one: **every other sink in this game has a ceiling, and all of
> them are now measured.** Named after the Ancient Wonders of Elvenar, which is
> the genre's answer to the same problem.
>
> **Status: designed, reviewed and closed 2026-09-03. Unstarted, and
> deliberately not next** — it is late-game content by construction (§5.2), so
> it waits behind work a player meets sooner. It replaces generated orders, cut
> the same day ([`12-quests.md`](12-quests.md) §6): the job was the same, and a
> building with an endless ladder does it without a daily errand.
>
> **The three numbers are deliberately not in here** (§6, **OQ-58**). This
> document is the concept, the fit and the mechanism; the workbook owns the
> balance, and setting it before the late game exists would be inventing a
> pacing target rather than measuring one.

## 1. Why the game needs one

Gold has plenty of sinks. **Every one of them is one-time, and all of them
together are now measured** ([`03-economy.md`](03-economy.md) §7):

| Sink | Total | Why it ends |
|---|---|---|
| Landmark claims | **527,000 Gold** | ten landmarks; 2,000 · 25,000 ×5 · 100,000 ×4 |
| The whole map's fog | **194,142 Gold** | there is a last cell |
| The fifteen upgrades, fully bought | **51,926 Gold** | every one has a `maxLevel`; `TapPower` alone is **34,006** of it — 65%, on a `cost_growth` of 1.9 over ten levels |
| The technology tree, 24 techs | **6,600 Gold** | there is a last node |
| Buildings and their levels | on a curve | `maxCountPerTownhallLevel`, and `maxLevel` on every district |
| | **≈ 780,000 Gold** | **and then nothing** |

Two things are deliberately not in that table. **Expedition supplies** (50 →
2,000 a launch) are the one Gold cost that repeats — but they are gated by the
army cap and by how often a player wants to delve, so they are a *drip*, not
something you can pour a surplus into. And **the Market is not a sink at all**:
it converts a surplus into Gold, which is the thing with nowhere to go.

So the honest version of the problem is **not** that the game runs out of Gold
sinks in three hours — it does not, and the claim the orders design rested on
(*"when the tree is done — three hours — surplus has nowhere to go"*) was
measured against the smallest sink on the list, the 6,600 Gold tree, while
527,000 of landmarks sat above it.

The real fault is the shape, not the size: **the end of the province is the end
of the economy.** Every number in that table is a one-time purchase, so a player
who has claimed the last landmark and revealed the last cell has finished
spending, permanently — while the city keeps producing, which is the one thing
this game never stops doing. What the economy is missing is not a bigger sink.
It is a sink **with no last level.**

The code already says so. The comment on `tapWorkSeconds` calls `TapPower`
*"the permanent sink the economy loses when the tech tree runs out"* — the idea
that the upgrade ladder is the sink is already written down, and the only thing
that falsifies it is `maxLevel`.

> **A Wonder is that same ladder with the top taken off, standing on the map
> where you can see it.**

## 2. What a Wonder is

**A district you place, whose level ladder is a CURVE rather than a TABLE.**

That sentence is the whole design, and it is worth unpacking because the two
halves of the codebase it borrows from have exactly opposite shapes:

| | How it expresses a level | Can it be infinite? |
|---|---|---|
| `DistrictDef` | **tables** — `maxLevel`, plus `populationCapacityPerLevel`, `maxWorkersPerLevel`, `influenceRadiusPerLevel`, `requiredTownhallLevelPerLevel`, `requiredTechPerLevel`, `armyCapPerLevel`, all indexed by level | **no** — a table has a last row |
| `UpgradeDef` | **formulas** — `costBase`, `costGrowth`, `effectPerLevel` | **yes** — only `maxLevel` stops it |

So a Wonder takes placement, footprint, art and *being a thing on the map* from
the district, and takes its **ladder** from the upgrade: level `L` costs
`round(costBase × costGrowth^L)` in Gold and is worth `effectPerLevel × L`.
**No per-level table anywhere in a Wonder's definition** — the moment one
appears, the ladder has a top again.

`District.level` is already a plain number, so **the state needs no change and
no migrator.** Adding Wonders is additive: new definition rows, and a bump.

### 2.1 It passes the shell test

**OQ-6** asks how many systems this game can carry, and answers with a test: a
new system is acceptable only if it is a *shell* around an existing one, and
should be cut rather than shipped the moment it needs its own economy, its own
currency and its own screen.

A Wonder has **no currency of its own** (Gold, which the game already has too
much of), **no screen of its own** (it is a building; you tap it, and the
district card opens), and **no economy of its own** (one number per level,
resolved by the helper that already owns that number). It is a district and an
upgrade, wearing each other's clothes.

**If a Wonder ever needs a second currency to feed it, or its own menu, it has
stopped being a shell.** Cut it then.

## 3. The two rules that keep it a sink

Both are **structural rather than numerical**, and that is deliberate: a rule
that holds because of an arithmetic race is a rule somebody re-derives every
balance pass and gets wrong once.

### 3.1 A Wonder's effect is never denominated in Gold

This forbids the most obvious Wonder in the game — the one that raises
`taxRate` — and that is the point. **A Gold-fed ladder that pays Gold is a
faucet with extra steps.**

Forbidding it outright costs one obvious building and buys a rule nobody can
tune their way out of. It is the same move as the rule the orders design died
holding — *a sink must never pay back what it asked for* — and it survives the
feature it was written for.

**The loop that is not fully closed, said out loud:** a Wonder that raises
production pays materials, and the Market converts materials into Gold, so the
loop does close *through the Market*. Why that is safe is §6.1 — it is closed by
the ladder's shape, not by the Market's spread.

### 3.2 One of each, and the level is the only ladder

**A Wonder has a hard count cap of one.** Not "one per Townhall level", not a
generous cap — **one, ever.**

This is not flavour, it is the rule the whole feature stands on. Every per-level
cost in this codebase restarts at zero for a new copy of a building, so if a
second Everspring could be built, **the cheapest way to buy `cellRecovery` would
be a row of level-1 Wonders instead of one deep one.** An exponential ladder
loses to N linear copies at *every* level, and by a widening margin — so the
sink would be defeated by the most obvious play available, and defeated hardest
by exactly the player it was built for.

Stated as the invariant it is:

> **A Wonder's level is the only way to buy more of its effect.** No second
> copy, no alternative source of the same stat that scales, and no bundle.

The visible consequence, which is a feature: **there is exactly one Everspring
in the world**, so it is a landmark of the player's own city rather than another
building. That is worth art (**OQ-57**) and it is the reason the level is the
number on the card (§9).

## 4. A level is instant on payment — no builder, no queue, no boundary

**A Wonder level does not go through the build queue.** It is bought, like an
upgrade, and it lands the moment it is paid for.

Three reasons, in order of weight:

1. **`upgradeDuration` also grows with level.** An unbounded ladder through
   `upgradeDurationLevelGrowth` means a Wonder level eventually takes days —
   and the queue holds one item per builder, so a single Wonder would occupy
   the player's only builder for days. That collides with the second-builder
   offer being the game's first conversion surface (**OQ-30**) and with the
   whole *no waiting line* decision behind [`06`](06-construction.md).
2. **It adds no boundary to `advance()`.** Nothing is scheduled and nothing
   expires, so invariant 1 has nothing new to hold: no `consider()` in
   `nextBoundary`, no branch in `applyDueAt`, no replay risk. **This is what
   makes the feature cheap** — it is the rarest kind of addition in this
   codebase, one the advance loop never has to hear about.
3. It is honest about what it is. A Wonder level is a **purchase**, not a
   construction — the fiction that it is being built is what would demand a
   timer, and the fiction is not worth a builder.

The cost of being instant: **a Wonder has no anticipation beat.** Nothing to
come back for, no progress bar. Accepted, because the anticipation lives in the
Gold curve instead — the player can see the next level's price long before they
can pay it, which is the same pull the technology tree's fog already uses.

## 5. The prototype set — three, and what a level buys

Small on purpose. **Each effect must be a stat that already exists**, or the
Wonder is buying a code change rather than a level.

| Wonder | Stat | A level buys | Why this one |
|---|---|---|---|
| **The Everspring** | `cellRecovery` | the ground regrows faster | The only effect that makes the **map** worth more without painting a cell — which is the exit **OQ-54** recommends for density, arriving as a reward instead of as authoring |
| **The Astral Spire** | `manaRegen` | more Mana per hour | Mana is the **spend** budget, so this Wonder buys taps — the signature verb, and the one ladder a player who only ever plays with their thumb can climb |
| **The Bell of Toil** | `workerYield` | the crew strikes harder | The straight production Wonder, and the counterweight to the Spire: one rewards the hand, one rewards the payroll |

Note what the set does **not** contain: a Gold Wonder (§3.1), a fog-discount
Wonder (relics already do that, and **OQ-23** already worries about it reaching
an event island), and a combat Wonder (the army cap is a *city-building*
decision by design — [`11`](11-expeditions.md)).

**The natural fourth is build speed**, and it is deliberately not here yet:
`buildSpeed` is one of the four modifier stats the event archetype adds in one
pass ([`implementation-plan.md`](../implementation-plan.md) Step 2). It costs
one row when that lands and a code change before it, so it waits.

Naming is a first pass and deliberately evocative-but-plain, the same standing
offer as the tome titles (**OQ-15**): **the Wonder names are one of the
cheapest places to put character into this game.**

### 5.1 What a Wonder is as a building

It is a district, so it inherits the district's whole physical vocabulary — but
almost every dial in that vocabulary is **off**, and the list of what is off is
what makes it read as a monument rather than as a workplace:

| | |
|---|---|
| **Houses** | nobody |
| **Employs** | nobody — no workers to assign, so no crew, no claims, no travel |
| **Area of influence** | none — it reaches nothing, because it works nothing |
| **Footprint** | **large**, and larger than it needs to be. This is the one dial turned up: a Wonder should cost real ground, because the ground is the price the player pays for it forever (§8) |
| **Movable** | **yes** — it is a district, and promise 1 says nothing the player owns is taken away, which includes taking away the choice of where it stands |
| **Count** | **one** (§3.2) |
| **Destroyed or downgraded** | **never**, under any circumstance — promise 1 |

**A Wonder produces nothing and stores nothing.** Everything it does, it does
by being a number in somebody else's formula (§7). That is what keeps it a
shell: it adds no throughput to the simulation, only a term.

### 5.2 It unlocks in the last era, for legibility rather than balance

**The gate is the Townhall's final level**, which is how every other district in
this game is gated — count caps by Townhall level, not tech trees.

Note that it does **not need** a gate for balance. The province holds a great
deal of one-time sink that is worth more per Gold than a Wonder level (§1), so
while any of it is unbought a Wonder is simply the wrong purchase, and the
economy gates itself. **The gate is there so the build menu does not offer a
monument to a player who should be buying a Sawmill** — a first level cheap
enough to tempt someone in hour two is a first level that teaches the wrong
lesson.

The corollary the design accepts: **a Wonder is late-game content, and a
playtester who does not reach the last era never meets this feature.** That is
correct for what it is — the answer to *the city outlived its shopping list* is
not something a new city needs.

### 5.3 The ladder's beats are cosmetic

An endless ladder has no milestones of its own, and a number that only goes up
is thin. The cheap fix is **a visual tier: the building's art changes every N
levels**, computed from the level rather than authored per level (§2 forbids a
table, and `L % N` is not one).

Cosmetic is the *only* family that can carry these beats without breaking
§3.1 — it has zero economic effect by definition, so a milestone can be
generous without being a faucet. **It is also the cosmetic probe OQ-26 asks
for, arriving inside a feature instead of as a store card**, which is a better
test: it measures whether players care about a visual tier they earned.

The bill is art, and it is real — a tier per Wonder per band. **OQ-57.**

## 6. The shape of the ladder

```
cost(L)   = wonder.cost_base × wonder.cost_growth ^ L      Gold
effect(L) = wonder.effect_per_level × L
```

**Two lines, three numbers, and none of the three is decided here** — they are
balance, they live in the workbook, and setting them needs a playtest rather
than an argument (**OQ-58**). What *is* decided here is the shape, because the
shape is design and it carries two consequences worth stating.

### 6.1 An exponential cost against a linear effect, on purpose

`cost_growth` is **the strongest dial in the feature** — the direct analogue of
`tap.work_seconds` — because it alone decides whether a Wonder is a sink or a
formality. But whatever value it takes, the *shape* is fixed: **cost compounds
and effect does not.**

That means **the ladder gets worse forever**, which reads like a flaw and is the
mechanic. A Wonder is a place to **park** a surplus, not a way to multiply one.
The pull is not that the next level pays — it is that the next level *exists*,
and that there is no session in which the player has nothing to spend Gold on.

**It is also what closes the Market leak** (§3.1). A production Wonder pays
materials, the Market turns materials into Gold, so the loop does close — but
its payback period is `cost(L)` over a linear return, and that grows without
bound. **The loop cannot run away, by shape rather than by tuning**: a Wonder is
never a Gold investment, only ever a place to put Gold that has nowhere else to
be. Whether the *early* levels sit on the wrong side of that line is a number
(**OQ-58**), not a risk to the design.

### 6.2 An unbounded effect is safe, and working rule 2 is why

A ladder with no top means a buff with no top, which in most games is where the
balancing breaks. Here it does not, and the reason is a rule that predates the
feature: **every reward in this game is priced in a duration of the player's own
production.** A tap pays seconds of work on what you tapped; the daily chest
pays a fraction of the pool. **Double the player's output and both sides of
every one of those double**, so nothing gets trivialised.

**The exception, said out loud:** the fog, the technology tree and the landmark
claims are priced in **absolute** Gold, and those *are* trivialised by a large
enough Wonder. That is acceptable only because all three are one-time and all
three are bought long before a Wonder is deep — **it is an argument for eras
re-pricing the tree** ([`07-research.md`](07-research.md) §5.1), not an argument
against Wonders. If anything absolute-priced is ever added *after* Wonders
exist, this is the paragraph it has to answer.

## 7. What it actually costs in code

The honest list, because "it is just a district plus an upgrade" is only true
after four specific things move:

1. **`maxLevel` has to stop being a wall.** `commands.ts:179`
   (`if (district.level >= def.maxLevel) return 'AtMaxLevel'`) and
   `upgrades.ts:38`/`:50`. A Wonder is a district whose `maxLevel` is absent,
   not one whose `maxLevel` is a big number — a big number is a wall you meet
   in a screenshot.
2. **The per-level tables must be empty for a Wonder** — no population, no
   workers, no army cap, no tech gate per level. `requiredTechPerLevel` in
   particular: a Wonder is gated **once**, at unlock, and never again.
3. **The level cannot be drawn as stars.** `districtCard.ts:392` renders
   `levelStars(district.level, def.maxLevel)`, which has no meaning without a
   denominator. A Wonder shows **a number and the next level's price** — which
   is a better card than the stars anyway, and the first place the player reads
   the curve.
4. **The purchase path is `buyUpgrade`-shaped, not `upgradeDistrict`-shaped**
   (§4) — pay, increment, done, with no queue item.

Everything else is already there: placement, footprint, moving the building,
the art pipeline, `effect()`, and the effective helpers that own each stat.

### 7.1 One Wonder costs one call site, and that is what bounds the set

A Wonder's level has to be **read** by the code that owns the number it
changes, and each of the three in §5 has exactly one such place:

| Wonder | Stat | The one line that has to read it |
|---|---|---|
| The Everspring | `cellRecovery` | `src/sim/harvest.ts:88` |
| The Astral Spire | `manaRegen` | `src/sim/mana.ts:61` |
| The Bell of Toil | `workerYield` | `src/sim/upgrades.ts:157` |

**Three Wonders, three lines.** This is the same cost shape as adding a modifier
stat — *one line plus one call site* — which is why the design insists that a
Wonder's effect be a stat that already exists: **the stat existing is what
guarantees the helper exists.**

It is also the honest bound on the set. A fourth Wonder is a row and a line; a
tenth is ten lines scattered across the sim, each one a place where somebody
later forgets that a Wonder can move this number. **Ten Wonders is not ten rows
of data, and it should not be sold internally as if it were** (OQ-6's shell
test, and OQ-57).

**Note the resolution order it has to respect.** Effects resolve base → upgrade
levels → modifier stack, and **a Wonder level is an upgrade level, not a
modifier** — the invariant that says upgrade levels are not re-expressed as
modifiers applies to it unchanged. A Wonder term therefore goes in *beside* the
`effect(state, …)` term in each helper, inside the value `resolve()` is then
handed, never as a synthetic entry pushed onto the modifier stack.

## 8. It makes bounding the plot urgent

**An endless ladder on a placed building is only a decision while ground is
scarce.** On a canvas that grows by buying tiles, a Wonder's footprint costs
nothing and choosing where it goes is paperwork.

So this feature does not merely sit downstream of **OQ-1** — it raises the
price of leaving it open, exactly as **OQ-48** (adjacency v2) already does.
Three Wonders with real footprints are three more things competing for the same
ground, which is the pressure that makes placement a game.

## 9. What the player sees

**Tapping a Wonder opens the district card**, like any other building — that is
the whole UI, and it is the point (§2.1: no screen of its own). What the card
has to show is different from every other district's, in three ways:

1. **A level, as a number.** Not stars. `Lv 27` with no denominator, because
   there is no denominator — and the absence of one *is* the feature being
   communicated. The first time a player sees a level with no `/5` after it is
   the moment the mechanic explains itself.
2. **The next level's price, always, even when it is unaffordable.** This is a
   deliberate departure from the builder's priced refusal
   ([`06-construction.md`](06-construction.md)): that refusal is an **offer**
   and arrives when you tried to do something, whereas a Wonder's price is
   **information** and is simply on the card. Nobody is being refused — there is
   nothing here the player was trying to finish. **A price the player cannot yet
   pay is the pull**, the same way the technology tree's fog shows a shape you
   have not bought.
3. **What the next level adds**, in the same words as the current level's
   effect, so the ladder's flattening is legible rather than hidden. **The
   design does not hide that the marginal level gets worse** (§6.1); a player who
   works it out and stops buying has understood the mechanic, not beaten it.

No progress bar, no timer, no *ready to collect* — a level is instant (§4), so
there is nothing to wait for and nothing to come back to. **A Wonder never
generates a notification, never glows, and never asks for anything.** It is the
only building in the game with no state that can demand attention, which is
appropriate for the thing you buy when you have run out of demands.

## 10. Dials, in the order to reach for them

1. **`wonder.cost_growth`** — sink or formality. Everything else is decoration
   next to it, and **none of these three has a value yet**: the shape is design
   (§6), the numbers are balance, and they need a playtest (**OQ-58**).
2. **`wonder.cost_base`** — where the first level lands relative to a building.
3. **`wonder.effect_per_level`**, per Wonder — how fast the ladder flattens.
4. **The unlock gate** — which Townhall level puts each Wonder in the build
   menu, and therefore how late the sink opens (§5.2).
5. **The footprint** — the ground price, which is the half of the cost that is
   not Gold (§5.1, §8).
6. **The set itself** — one row per Wonder *plus one call site* (§7.1), and a
   fourth arrives nearly free with the event archetype's `buildSpeed`.

## 11. Acceptance

- A player who has bought **every** technology, **every** upgrade level and
  **every** landmark still has a priced thing to spend Gold on, and can see what
  it costs.
- **A Wonder level adds no boundary**: the replay assertion holds across a
  Wonder purchase during an offline advance, and `nextBoundary` is untouched by
  this feature.
- **No Wonder's effect is denominated in Gold** (§3.1), asserted by a test over
  the definitions rather than by review.
- **A second copy cannot be built, at any Townhall level** (§3.2) — the test
  that matters most, because it is the one an exploit walks through.
- A deep Wonder renders in the district card **without a denominator**, and the
  card shows the next level's price and what it adds (§9).
- **No new wallet row, no new screen, no new currency, no new goal type** — the
  shell test, asserted where it can be.

## 12. Deliberately not in this design

A Wonder that pays Gold (§3.1) · **a second copy of one** (§3.2) · a level that
goes through the build queue (§4) · a `maxLevel` set to a large number instead
of absent (§7) · a per-level table of any kind · a second currency to feed a
Wonder (OQ-6's shell test) · level stars · workers, residents or an area of
influence (§5.1) · **a Wonder that is destroyed, downgraded or lost** —
promise 1 · a Wonder-specific screen · a notification, a glow or anything that
asks for attention (§9) · **donating to another player's Wonder**, which is
Elvenar's Knowledge-Point social loop and belongs to
[`15-social.md`](15-social.md) if it happens at all (**OQ-59**).

Two that are worth naming because they are the obvious next asks:

- **A Wonder that unlocks a mechanic rather than scaling a number.** It would be
  better content and it is a different feature: it needs a table of what each
  level unlocks, which §2 forbids, and it turns the ladder back into something
  with a last interesting level. **If this is wanted, it is not a Wonder.**
- **Prestige, or spending a Wonder for a permanent bonus.** The genre's other
  answer to an endless economy, and it is a direct violation of promise 1 in
  both directions — it takes what the player owns, and it makes the ladder's
  whole point retractable.

**Open questions:** **OQ-57** (how many, the art bill, and the cosmetic tiers),
**OQ-58** (the three numbers — `cost_growth`, `cost_base`, `effect_per_level`),
**OQ-59** (the social donate hook), and **OQ-1**, whose price this feature
raises (§8).
