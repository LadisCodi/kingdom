# Feature: tomes and research — Knowledge as a clock, the tree as a shelf

> Reworks research into a **territorial trickle**, turns the radial tech tree
> into **three tomes** whose tiers *are* eras, and renames the dungeon currency
> to **Stardust** so that one name stops doing two jobs.
> **Status: designed, unstarted.** Revised 2026-09-03 — see §10 for what
> changed and why.
>
> This document owns the **system**: the currency, the shelf, the rename, the
> migration. [`tech-tree.md`](tech-tree.md) owns the **content** — all ~167
> nodes, the era bands and what each unlocks.
>
> Companion docs: [`tech-tree.md`](tech-tree.md) (the nodes),
> [`research-and-upgrades.md`](research-and-upgrades.md) (the tree this
> replaces), [`knowledge.md`](knowledge.md) (becoming `stardust.md`, §2),
> [`relics-and-ingredients.md`](relics-and-ingredients.md) (what Stardust
> competes with), [`magic.md`](magic.md) (Mana),
> [`social-layer.md`](social-layer.md) (§7, the prize this unlocks),
> [`map-scopes.md`](map-scopes.md) (where the contested landmarks live).

## 0. Why, and the argument the repo already makes

`research-and-upgrades.md` says the tree today is *"more a checklist than a
tree"*: one root gate, five branches that never reconverge, maximum depth 4, no
exclusive choices, exhausted inside the 2–3 hour arc. And its Gold cost is
**6,600 across 24 techs** against a quest chain that pays **12,075**
([`balancing-v3.md`](balancing-v3.md) §2) — a ratio of 1.83×, which means the
tree is not a sink, it is a formality.

The fix is not more nodes. And [`knowledge.md`](knowledge.md) already contains
the argument for the shape it should take:

> *"No comparable game asks a research currency to do that — in Elvenar, Forge
> of Empires and Rise of Cultures the research currency is a **clock**, accrued
> per hour and never earned, existing only to pace the tree."*

That is the model. This document adopts it, with one deliberate departure: in
those games the clock runs on its own. **Here it runs on the ground you have
taken.**

## 1. Knowledge, the clock

- **Accrues per hour, and the rate is the territory you hold.** Claimed
  landmarks and cleared ruins, and nothing else. Not dropped by harvest, not
  bought with resources, not earned by playing well.
- **Uncapped.** It accumulates until spent.
- **A technology is paid for in one go** — Gold *and* Knowledge, up front, plus
  research time, exactly like a build. No commitment, no part-payment.
- **Gems finish the timer**, the way they finish a build.
- Techs also cost **Gold**, so the tree keeps competing with fog and buildings
  for one budget. Neither currency alone works at 167 nodes: Gold can *size* a
  tree that big but cannot *pace* it, and Knowledge alone would hand Gold's
  largest sink back to nothing.

**Why territorial rather than a plain hourly trickle.** Elvenar's clock is
disconnected from play on purpose — it is a pure pacer. Kingdom already has a
pure pacer in Mana, and it has something better available: paid fog.
`../00-design-intent.md` says the fog has to pay back three ways — resources,
landmarks (+10 max Mana), ruins (delves). **This is the fourth, and it is the
first one that compounds into the tech tree**, which previously had nothing
whatever to do with exploring.

### 1.1 Mana is not this currency, and that was the fork

Mana is already a capped, time-generated pool. Making it pay for research too
would have been elegant — one budget, three spends, and *"research is literally
magic in this game"* — but it reopens the tuning that
[`balancing-v3.md`](balancing-v3.md) §1 just closed, and the ad reward is priced
as *one pool ≈ one span of production*.

**Decided: a second trickle currency.** Mana stays what magic costs
([`relics-and-ingredients.md`](relics-and-ingredients.md) §3), the ad keeps its
meaning, and `tap.boostSeconds` = 45 stays untouched.

### 1.2 Knowledge is a plain wallet balance

An earlier draft had **trickle-and-commit** — N Knowledge poured into a tech
across several visits, read as `12 / 40`, with commitments living on the tech's
progress record rather than in `wallet.ts`.

**Cut 2026-09-03.** A technology is bought outright. The commit step bought one
good thing — a tech you are *working towards* across visits, which suits a game
played in two or three check-ins — at the price of a second balance shape, a
second progress record, and a purchase flow unlike every other purchase in the
game. The tree already has a "working towards it" mechanic: the research timer.

So Knowledge lives in the wallet like any other currency, and
`buyTechnology` looks like `build`.

### 1.3 Lumps need no special rule

The Conjunction pays a lump of 60. Against a **capped** pool that would have
needed the `adOffers.ts` overcharge rule — *"a reward clamped to a ceiling the
player is already near would pay nothing and read as broken"*. Knowledge is
uncapped, so a lump is just an addition. One fewer rule.

## 2. The rename: Knowledge ↔ Stardust

One name cannot hold two jobs — that is how the docs ended up contradicting
themselves, which Phase 0 just spent a pass cleaning up.

| Name | Job | Source | Scope |
|---|---|---|---|
| **Knowledge** | the research clock | claimed landmarks and cleared ruins, over time | **kingdom** |
| **Stardust** | levels of relics and heroes | dungeons and pulls | **kingdom** |

Both names import a convention instead of teaching one: Knowledge is the word
Elvenar and Rise of Cultures use for this exact mechanic, and Stardust reads
across the market as the currency you pour into levelling a collectible. In the
docs and in code the key is **`Stardust`**; *Polvo estelar* is the localised
string. A currency with two names in two files is how balance bugs are born.

### 2.1 This is a migrator, not a find-and-replace

**The jobs swap; the purse does not.** Knowledge lives in
`state.kingdom.wallet` today, deliberately kingdom-scoped *so it survives a
region reset*. That reasoning now describes **Stardust** — and it describes the
new Knowledge just as well, so **both stay in the kingdom purse**.

Two arguments settle it. **A technology is something the kingdom knows**, so
the tree has to survive a province reset the same way the collection does; a
city-scoped tree would be re-researched every time the map scope changed
([`map-scopes.md`](map-scopes.md) §3). And **§7's contested landmarks pay
Knowledge lumps from the world map**, which no single city's purse could
coherently receive. A city-scoped clock was considered and rejected on those
two grounds.

Keys that currently say Knowledge and now mean Stardust:

| Key | Value |
|---|---|
| `delve.knowledgePerDepthPerTier` | 6 |
| `delve.firstClearKnowledge` | 150 → **splits**: the first clear pays a Knowledge lump *and* Stardust (§3) |
| `knowledge.dripPerClearedRuinPerHour` | 2 → stays **Knowledge**, and becomes one of its three faucet terms |
| `gacha.pullKnowledge` | 50 |
| `rewardKnowledge` (Quests sheet) | 158 total |
| `collection.levelCostBase` / `levelCostGrowth` | 20 / 1.6 |
| `CONJUNCTION_BOONS[*].knowledge` | 60 — **decide: Stardust or the new Knowledge?** |
| `technologies[*].cost.Gold` | 6,600 → reprices as Gold **+ Knowledge** + time across ~167 nodes ([`tech-tree.md`](tech-tree.md) §6) |

`SAVE_VERSION` **22 → 23 with a migrator** (landed 2026-09-03), and two more
reshapes follow it on their own entries — the Fragment→ingredient conversion
([`relics-and-ingredients.md`](relics-and-ingredients.md) §8) and
`state.upgrades` → completed tech ids ([`tech-tree.md`](tech-tree.md) §8).
`MIGRATIONS` is append-only, so each is its own entry rather than one shared
migrator.

The v23 entry moves the balance from `kingdom.wallet.Knowledge` to
`kingdom.wallet.Stardust` and leaves the city's Knowledge unseeded: a
returning player starts the research clock at zero and earns it from the
ground they hold.

**The trap, which is the same one the currency-simplification migrator had to
avoid:** a player mid-flight holds a Knowledge balance **earned as collection
currency**. It must become Stardust. A bare key rename hands the whole tech tree
to anyone with a balance. That doc's rule applies — *balances convert at the
rates they were earned*.

### 2.2 Do the docs and the code in one commit

Renaming in the docs first would leave them describing a currency the build does
not have, which is precisely the doc/code drift Phase 0 exists to remove. **The
rename lands as one change: balance keys, code, migrator and docs together.**

Docs that describe the wrong currency until then: `knowledge.md` (becomes
`stardust.md` — its §1 is already the definition of Stardust),
`00-design-intent.md`'s economy section, `currency-simplification.md`'s wallet
table, and `research-and-upgrades.md`. The frozen Unity snapshot (`01`–`11`) is
**not** touched: it is history.

No code collision: `research.ts`, `src/ui/research/` and `research.techSlots`
stay valid. Research is the activity; Knowledge is the currency.

## 3. Where Knowledge comes from

Three terms, all territorial, plus one-off lumps for taking the ground.

| Source | Rate | One-off |
|---|---|---|
| each **claimed landmark** | **+2/h** | **+50** on claiming |
| each **cleared ruin** | **+3/h** | **+150** on first clear |
| a ruin taken to its **deepest** depth (`Conquest`) | **+3/h** further | — |

A fully explored province — ten landmarks, five ruins — reaches **~35/h**, about
**840 a day**.

**There is no base rate, and that is the point.** A player who claims nothing
generates nothing. Knowledge is not a wage for existing; it is what the land
teaches you once you have taken some of it. The safety valve is not a floor —
it is that **era 1 costs no Knowledge at all** ([`tech-tree.md`](tech-tree.md)
§6), so the opening hours run on Gold and time exactly as they do today, and
the clock starts with the first landmark.

**And the chain seeds it.** The quest chain asks for era-2 technologies
(Surveying II, Scaling Tools, Sailing) before a chain-follower has claimed more
than one landmark, so the chain pays Knowledge itself — 340 across seven
quests, all on the Magic-tome beats where the fog is teaching the player what
the land holds. The rule the tests hold: **walking the chain with zero drip,
every technology it asks for is affordable when asked.** Zero drip is the
player who does the whole opening in one sitting, and they must never be told
to go and wait.

**The lumps are why claiming reads as an event.** A rate change alone is a
number moving on a screen the player is not looking at. Fifty Knowledge in the
hand is the fog paying out, which is what the fog is selling.

**Which side of invariant 2 it is on:** Knowledge is **production**, so accrual
stops at the 8-hour offline cap. The lumps ride the events that grant them, so
a delve resolving in the uncapped tail pays in full. Both halves must say so
out loud, because they land on opposite sides of the same rule.

**Engine.** No new boundary source — an uncapped drip needs none. And, contrary
to what this section said when it was written, **no settling step at a rate
change either**. The worry was that a landmark claimed or a ruin cleared
mid-window would re-measure the drip's leftover remainder against the new rate
and land the anchor somewhere a one-call replay never puts it. It cannot:
`advance` runs the continuous sims *up to* a boundary before applying the
discrete work at it, so the anchor is `T0 + k × msPer` in both paths at the
instant the rate moves, and `floor` makes every observation in between
irrelevant. A `settleKnowledge` was written, found unnecessary, and removed —
it also discarded up to one unit each time it fired.

`tests/expeditions.test.ts` holds a one-call-equals-stepped assertion across a
real clear happening mid-window.

## 4. Upgrades are gone

`research-and-upgrades.md` describes two kinds of node: technologies (Gold +
time, one-time) and upgrades (Gold, **instant**, levelled).

**Cut 2026-09-03. Every node is a technology.** What was a levelled upgrade
becomes a **rank line** — `Sawpits I → II → III`, each a node requiring the one
before, each with its own cost and duration.

An earlier draft of this document argued the opposite, and the argument was
good enough to record: *"a slot's value comes from parallelising the slow
things… two rhythms, deliberately: the tome is the long deposit, the upgrade is
the impulse buy."* What overturned it is that **cost and time already express
"small"**. A 40-Gold, 20-second node is an impulse buy; it does not also need to
be a different kind of object with a different shape, a different purchase flow
and a separate `UPGRADES` table. And with every node on a timer, the pinch on
research slots is constant instead of occasional — which is what makes the slot
worth buying.

What it costs, stated: the instant Gold purchase was the only impulse buy in
the game, and it is gone. Era 1's 20–60 second nodes are what stands in for it,
plus the Gem "finish now" surface, which gains a great deal of traffic here.

## 5. Three tomes: the value is navigation, and eras come free

The current tree is 24 techs at hand-authored `node:{x,y}` positions, depth 4,
with the canvas sized to what is visible. At ~167 techs a radial hand-positioned
canvas is ungovernable — and the bottleneck is not rendering, it is that **the
layout is authored content**.

> **A tome is a screen, not a region of a canvas.** One unbounded canvas becomes
> three bounded pages.

Positions stay hand-authored, but each layout is one era of one tome instead of
a hundred nodes at once. Navigation stops growing with content.

**And tomes have tiers, which are the eras.** Exhaust a tome's era and the next
opens, gated by a **keystone** that requires every technology above it. It is an
era gate, but **per tome instead of global** — better for a game where players
specialise, and a content drop adds *era 4* as data rows rather than
restructuring a global ladder.

**The shelf is three tomes**, revised 2026-09-03 from five:

| Tome | Owns | Opens |
|---|---|---|
| **Civics** | the city and its purse | at game start |
| **Magic** | the fog, Mana, relics and the ruins | your **first paid reveal** |
| **Warfare** | the army, and what it goes into the ground for | your **first discovered ruin** |

Five (*Earth, Stone, Tide, War, Arcana*) split the economy across three books
that each read as a fragment of the same subject. Three is the smallest number
that gives each book a sentence: *the city*, *the land's magic*, *the army*. It
also concentrates the fog, Mana, landmarks and ruins into one place, which is
the direct answer to `00-design-intent.md`'s recorded complaint that the game
*"reads like a generic village simulator (charming)"* — magic stops being a
branch you can skip.

The full node list, era by era, is [`tech-tree.md`](tech-tree.md).

## 6. Ruins pay the tree in Knowledge, not in tomes

An earlier draft had **tomes found in ruins**: a first clear pays an artifact,
Gems, Stardust *and a grimoire*, so the province is the source of the tree's
structure and the tree gains a narrative origin it completely lacks.

**Retired 2026-09-03**, because with three tomes there is nothing left to find —
all three open in the first session and gating any of them behind a ruin would
put a third of the tree behind an army, which is the exact risk
`knowledge.md` §6 flags.

The argument survives in a better form. **A ruin's first clear pays 150
Knowledge and raises the drip by 3/h** (§3). That is the same beat — the ruin
pays into the tree — delivered as the currency the tree already runs on, and it
scales with every ruin instead of running out after five.

## 7. Contested landmarks pay lumps, not rate

Contested world-map landmarks ([`map-scopes.md`](map-scopes.md)) that boost
Knowledge are exactly the kind of thing players will fight over, which is the
point. But a **rate** bonus is a compounding advantage, and compounding
advantages held by whoever is already winning are how a competitive layer
becomes a runaway: the guild holding them researches faster, grows stronger, and
holds them harder.

The repo already made this exact decision. `ad-economy.md` §3b and `magic.md`
§4: sanctuaries raise Mana **capacity, not production**, because *"+1 Mana/h was
worth most on the day you found it and less every day after"*.

That doc's answer was to raise the Knowledge **cap**. There is no cap now, so:

> **A contested landmark pays a Knowledge lump when you take it, and nothing
> while you hold it.**

Highly visible, highly valuable, worth fighting over repeatedly — and holding
one does not compound. It also makes contested ground behave like a *raid* on
the research clock rather than a tax on everyone else's, which is the friendlier
half of the same mechanic.

**Province landmarks are the exception and stay on rate** (§3), because nobody
contests them — they are yours once claimed, and the compounding is the reward
for exploring.

## 8. Where every currency lands

| Currency | Source | Buys | Scope |
|---|---|---|---|
| **Knowledge** | claimed landmarks and cleared ruins, over time; lumps from contested ground | technologies · **investment in guild structures** (§9) | kingdom |
| **Mana** | time, cap by the Sanctum + sanctuaries | taps · relic actives, on both maps | city |
| **Stardust** | dungeons and pulls | relic and hero levels | kingdom |
| **Ingredients** | 1★ province · 2★ events · 3★ world map | each relic's tier gate | kingdom |
| **Gems** | quests, first clears, simulated store | comfort and breadth — **every slot in the game**, and finishing a timer | player |

One job each, which is the rule `currency-simplification.md` fought to
establish. **Fragments are deleted**
([`relics-and-ingredients.md`](relics-and-ingredients.md) §8), so the row count
does not grow: ingredients take the tier gate and Stardust keeps the level.

And the plank does not grow either. `currency-simplification.md` cut eleven
wallet rows to seven on purpose, and `CLAUDE.md` records that **adding a row
needs an argument** — with the Fragments precedent, a counter where it is
spent rather than a row on the plank, as the usual better answer. Neither of
these currencies has that argument:

> **A currency spent in exactly one screen lives in that screen's header, not
> on the plank.**

Gold, Food, Wood, Stone and Mana stay on the plank because they are spent
across the map. Gems stay in the top bar. **Knowledge** moves to the Research
header — with its **rate** beside the balance, and a time-to-afford line on any
node the player cannot yet buy, because a trickle currency without one is a
currency you cannot plan against. **Stardust** and ingredients live in the
Reliquary and hero screens. The plank gets *shorter* than it is today.

**Slots are bought with Gems, everywhere, and by nothing else** — research,
attunement and party alike. No technology grants a slot. This reverses
`research-and-upgrades.md`'s *"research is the earned half of both gates"* and
does not break promise 3, because Gems are earnable: the chain pays 75, a first
clear pays 10, and the daily chest pays at its week markers. The earning moved;
it did not disappear.

## 9. The prize nobody has claimed yet

In Elvenar and Forge of Empires the trickle currency does not only pay for
research. **Knowledge Points and Forge Points are invested into other players'
Ancient Wonders and Great Buildings, and the top five contributors are paid when
it completes.** That is the economy of favours behind FoE's FP market and The
Arc — and it is the mechanic the 2026-09-02 competitive review named as the
number-one missing pillar.

The same "invest N Knowledge" action points at a guild structure, and a
top-contributor payout does the rest.

**One thing weakened when commitment was cut (§1.2):** the verb is no longer
shared. In Elvenar you invest points into your own research *and* into a
neighbour's wonder with the same gesture, and the second reads as natural
because the first taught it. Here a technology is bought outright and only the
guild structure is invested in, so the investment gesture has to teach itself.
That is a UI problem, not a design one, and it is the price of §1.2 — worth
naming so nobody rediscovers it during Phase 4.

This still makes the feature a dependency of
[`social-layer.md`](social-layer.md) rather than a neighbour of it.

## 10. What changed on 2026-09-03

This document was merged on 2026-09-02 and revised the next day. The five
reversals, so that nobody reading the diff has to guess which is current:

| Was | Is | Why |
|---|---|---|
| Knowledge accrues on a plain hourly trickle, **capped** | accrues from **claimed landmarks and cleared ruins**, **uncapped** | it gives paid fog a fourth payback, and the 8-hour offline cap already does what a ceiling would (§3) |
| **Trickle-and-commit** — `12 / 40` poured in over visits | **paid in one go**, Gold + Knowledge + time | one balance shape, one purchase flow; the timer already provides "working towards it" (§1.2) |
| **Five tomes** — Earth, Stone, Tide, War, Arcana | **three** — Civics, Warfare, Magic | three is the smallest shelf where each book has a sentence, and it concentrates magic instead of scattering it (§5) |
| **Upgrades stay instant and Gold-only** | upgrades are **deleted**; every node is a technology | cost and time already express "small", and universal timers are what make a slot worth buying (§4) |
| **Tomes found in ruins** | ruins pay **Knowledge** into the tree instead | with three tomes there is nothing left to find, and it would put a third of the tree behind an army (§6) |
| Contested landmarks raise the **cap** | they pay a **lump** on capture | there is no cap; the anti-snowball reasoning survives intact (§7) |

## 11. Build order

1. ~~The rename, whole (§2): keys, code, migrator, docs, one commit.~~
   **DONE 2026-09-03.** The Fragment→ingredient reshape follows on its own
   migrator entry rather than sharing this one.
2. **Knowledge as a territorial clock — the rate and the lumps are DONE
   2026-09-03**; the claimed-landmark term, the 50-Gold-ground lump and the
   150 first-clear lump are live, and there is no base rate. Still to do:
   techs reprice from Gold to Gold + Knowledge + time.
3. ~~Upgrades collapse into technologies.~~ **DONE 2026-09-04.** The 15
   levelled upgrades became 49 ranked technologies; `UPGRADES`, `buyUpgrade`
   and `state.upgrades` are gone, `effect()` counts completed ranks, and the
   `BuyUpgrade` quest goal type is retired. **The tree went from 6,600 Gold to
   26,625**, so the quest chain now covers a little under half of it instead
   of 1.8x — the inversion §0 asks for, held by `tests/quests.test.ts`.
4. ~~Tomes as screens.~~ **DONE 2026-09-04.** Three bounded pages with a
   shelf of tabs, per-page positions, and the cover pages granted by events in
   the world — Civics at the seed, Magic on the first paid reveal, Warfare on
   the first ruin in sight.
5a. ~~Techs reprice from Gold to Gold + Knowledge + time.~~ **DONE 2026-09-04.**
   Every technology from the era-1 keystone on carries a Knowledge price beside
   its Gold one; era 1 charges none. **The chain seeds the clock**: a player
   early in the chain holds no territory, so seven quests — the Magic-tome
   beats from `OldStones` to `PutToSea`, plus `SecondStory` ahead of the
   Charter — pay 340 Knowledge between them, and `tests/quests.test.ts` walks
   the whole chain with ZERO drip and holds that every technology it asks for
   is affordable when asked, with at least 30 to spare. Two chain fixes fell
   out of the era structure: `Attuned` moved from quest 42 to right after the
   first claim (its keystone gates the exploration beats at 26–28), and
   `Architect` now asks for `Charter II`, which is the thing that actually
   raises the Townhall.
5b. **Era-2/3 content, first batch — DONE 2026-09-04.** The Civics and Magic
   `ModifierStat` hooks and their ten minor lines ([`tech-tree.md`](tech-tree.md)
   §9), then the Warfare batch — six more lines on `armyCap`, `recruitCost`,
   `supplyCost`, `haulLoss`, `heroXp` and the existing `delveSpeed`; then the
   five combat lines, carried into pure `combat.ts` as a `Drill` on the Party.
   The tree is 151 technologies.
5. **Eras 2 and 3 STRUCTURED, not yet filled.** All 84 technologies are
   assigned a tome and an era, the nine keystones exist and each unlocks a
   real dial (Townhall level, hall levels, Sanctum levels), and the Townhall
   Mana strip landed with them. What is NOT authored is the era-2 and era-3
   *content* from [`tech-tree.md`](tech-tree.md) §3–5 — Field Medicine,
   Veterancy, Siegecraft, Ley Lines, Ritual Casting and the rest — because
   every one of them needs a mechanic that does not exist yet (§9), and a node
   that unlocks nothing is the lie this design exists to avoid. That is the
   next block of work and it is engineering, not authoring.
6. Contested landmarks pay lumps — after the world map exists.
7. Investing Knowledge in a guild structure — with `social-layer.md`.

## Open decisions

0. **The Mana curve now sits on the law's boundary at every level.** Taking
   Mana off the Townhall meant re-deriving both dials from scratch, and the
   spend-budget law (`fill > 8 h`, so a pool can run out and a refill has
   something to sell) pins them hard: 50 cap at 6/h is 8.3 h, and every
   Sanctum level lands between 8.1 and 8.3. There is no slack left. The
   onboarding drained the pool dry at the documented 4/h and only survives at
   6 — which is the first real evidence that the tutorial's Mana budget and
   the design's stated one disagree.
1. **Does the Conjunction's 60 lump pay Knowledge or Stardust?** It reads as
   arcane insight, which argues Knowledge; it has always fed the collection,
   which argues Stardust. Cheapest answer: split it.
2. **What is a tech's Knowledge cost, and what is the accrual rate?** §3 and
   [`tech-tree.md`](tech-tree.md) §6 give a first pass — roughly six weeks of
   tree at a full province's rate — but the whole pacing of the game past hour
   three lives in these two numbers and neither survives contact without the
   30-day playtest.
3. **No base rate at all (§3) is the riskiest number here.** A player who
   explores badly stalls the tree completely. Era 1 costing no Knowledge is the
   mitigation; whether it is enough is a playtest question.
4. **What Stardust is for once ingredients are the tier gate**
   ([`relics-and-ingredients.md`](relics-and-ingredients.md) §8, and
   `../road-to-mvp.md` §8 decision 15). Unchanged by this revision and still
   the most load-bearing open question in the collection.
5. **Do plot expansions come from the tree or from the world map?**
   [`map-scopes.md`](map-scopes.md) §3.2 wants growth in authored increments and
   §6 lists expansions as a world-map payout. Civics is the obvious other home
   and they must not come from both.
