# 13 · Events — the archetype we author ten times a year

> **Scope.** The one event skeleton every future content drop is a skin on: an
> event counter, a fog-island minigame, a milestone track that doubles as the
> pass, a shop, and a window that closes. Plus the weekly event that already
> ships.
>
> **Status: the machinery is built and verified; the archetype is designed and
> unstarted.** The game has **one authored event and zero banners.**

## 0. This is a pipeline question, not an engine question

The competitive picture is unambiguous: **Forge of Empires ships 6–7 major events
a year, Elvenar 10**, each with the same skeleton — event currency, a minigame, a
grand-prize bar, a shop with rotating stock, a two-track pass. This is the pillar
the positioning work called the moat.

And the engine underneath it already works. **A recurring window with a hard
deadline ships today**: 48 hours every 7 days, stable occurrence ids, phases
persisted so an event that paid out cannot pay twice on reload, and
reconciliation running *before* the offline replay so **a window that opened
*and* closed during an absence still fires.**

So this feature is not *build an event system*. It is **three narrow widenings
and then a content pipeline.**

## 1. The three widenings, done once, before any content

Doing them in one pass is what stops the next three events from each being a
sprint.

| Widening | Today | After |
|---|---|---|
| **Modifier stats** | 12 values, already including Stardust yield, active cost, delve speed and attunement slots | plus **build speed**, **research speed**, **training speed**, **ingredient yield** |
| **Schedule payloads** | a weekly event and a banner | plus **grantModifier**, **eventTrack**, **eventShop** |
| **Where schedules live** | in code, beside the definitions | a hand-written events file, because they are live-ops content with wall-clock dates |

- **`grantModifier` takes a template id, not a magnitude.** Magnitudes belong in
  a workbook sheet, which is what lets a designer tune a season's numbers without
  touching the schedule.
- **`eventTrack` is the milestone ladder**: an ordered list of point thresholds,
  each with a **free** reward and a **paid** reward. That single structure is the
  grand-prize bar *and* the two-track pass. **They are not two features.**
- **`eventShop`** is stock rows plus a refresh cadence.

**Build speed is also what the social layer needs** for daily help
([`15-social.md`](15-social.md) §3.1), which is why this widening comes first.

The split, explicitly:

| Goes in the events file | Goes in the workbook |
|---|---|
| windows, periods, occurrence horizons | modifier template magnitudes |
| which track and shop an event uses | track thresholds and reward amounts |
| banner pools and rate-up | shop prices and stock quantities |

## 2. The archetype — six parts

Every event we author is a different skin on these.

### 2.1 Event points are a counter, not a currency

The wallet was deliberately cut from eleven rows to eight, and **five things on
the plank is documented as the ceiling of the genre rather than the floor.**
Adding a row back per event would undo that within one content drop.

> **Event points live in the event's own state, are displayed on the event
> screen and nowhere else, and never reach the plank or the purse.**

There is already a precedent to follow exactly: a per-collectible counter shown
in the Reliquary rather than a wallet row. The wallet's invariants and its
migrator are not involved at all. **OQ-18.**

### 2.2 Points come from the base game, never beside it

**The failure mode of an event minigame is that it becomes a second game the
player plays *instead of* the one you built.** So points come from the loop that
already exists:

| Source | Why |
|---|---|
| Completing an **order** | ties the two habit pillars together |
| Extracting from a **delve** | scales with depth, so it rewards the deep arc |
| Claiming a **landmark**, clearing a **ruin** depth | the differentiator pays |
| **Taps**, at a low rate | so a player who only harvests still progresses |
| The **daily chest** | one guaranteed lump a day |
| A **rewarded video**, capped | the third ad placement |

**No regenerating roll resource.** The genre standard is a second energy that
refills — wooden spoons, dice, keys — and **Kingdom already has an energy
(Mana).** A second one competes with it for the same session and doubles the
number of budgets a player has to reason about, in a game already carrying ten
progression systems. **Points earned by playing is the same pressure with one
fewer system.**

### 2.3 The minigame is a fog island

Every comparable bolts on a genre-foreign minigame: match-3 (Township), a maze
(Sunrise Village), a board with dice (Family Island, Whiteout). **Kingdom has
something better available, and it is the thing nobody else has.**

> **The event minigame is a small map, shrouded, where event points buy reveals
> and the rewards are under the fog.**

It reuses the mechanic the whole game is built around, it is filmable, it needs no
new interaction vocabulary, and **it inherits the fog's compounding cost curve
for free.** A *Winter Isles* event and a *Sunken Coast* event are two maps and two
reward tables.

This is what [`02-map-scopes.md`](02-map-scopes.md) §3.3 calls a **temporary
province**, and naming it that clarifies what it is: **the province's verbs never
retire — they become the event format.** So every content drop reuses the most
expensive systems already built.

**Build it as a lightweight state module, not a region.** Fog, features and
rewards; **no buildings, no workers, no economy.** Nothing is produced there;
things are *found* there. That avoids the multi-region state reshape and is a dry
run for it — it will tell us what a second map actually needs before we pay for
the general case.

### 2.4 The track: grand prize and pass in one structure

An ordered ladder of point thresholds, with two reward columns.

```
threshold   free reward         paid reward
   100      Gold                Gold ×2
   250      ingredients         ingredients + a shop refresh
   500      Gems                Gems ×2
   ...
  final     the grand prize     the grand prize + a relic level
```

**The grand prize is a collectible** — a relic or a hero. Not a building, not a
currency lump. Two reasons: the substrate already handles it (a seasonal hero is
one hero row and one banner row), and **it feeds the weeks-long collection arc,
which is the only progression axis in the game measured in weeks rather than
hours.**

> **The free track must reach the grand prize.** Slower, but reachable.

That is the third promise, and it is the same line the gacha already holds: *it
sells breadth and speed, never a power ceiling you cannot earn.* **OQ-20.**

### 2.5 The shop

Stock rows with quantities, priced in event points, with **one free refresh a
day** and paid refreshes after that. This is what makes points worth farming past
the track, and it is where boosters land.

### 2.6 The window closes

See §4.

## 3. The session budget is a hard constraint

Mid-core PvE builders have the **lowest** minutes per day in the whole
competitive set — 26.6 / 29.1 / 29.4 — and this design is already written against
~30 min/day across two or three visits, which is unusually disciplined.

**A 30-stage pass plus a weekly guild deadline plus three daily orders asks for
fifty minutes without anyone deciding to.** So:

> **Every event is dimensioned for ~30 minutes a day across 2–3 visits, and the
> track is completable at that budget without the shop.**

**If an event needs more, the event is wrong.** This is the number that churns the
exact segment the project is trying to retain, and it is checked by **timing a
real session**, not by arithmetic.

## 4. Do events close? Yes — and the game already decided

Framed elsewhere as the A/B fork between *cozy* and *soft pressure*. The answer is
**yes**, on three grounds:

1. **The pillar authorises it in as many words.** *Pressure comes from
   opportunity that expires — a Mana pool that overflows, an event window that
   closes, a haul you chose to risk — never from loss of property.* **A deadline
   is not a loss.**
2. **It already shipped.** The weekly event is a 48-hour window on a 7-day
   period. The game has had a hard deadline since the timeline landed.
3. **Without a close, the track is a checklist and the shop is a store.** The
   deadline is the only thing that makes a collective bar or a milestone ladder
   mean anything, and it is what separates the titles that last from the ones
   that do not.

**What stays refused:** raids, theft, decay, hunger, and timers that destroy
progress. **Points earned are banked; a milestone reached is paid; a collectible
won is kept. What ends is the chance to earn more.** **OQ-19.**

## 5. The offline cap and event rewards

An event window fires in the post-cap tail advance, so **a 20-hour absence
spanning a 24-hour window pays in full.** With one weekly event that is a
curiosity. With a calendar it is a support ticket, so it needs to be a written
rule rather than an accident:

> **The offline cap limits what the city PRODUCES while you are away. It never
> limits what a TIMER does.**

Build queue, research, delve depths and event windows are timers. An event window
is a timer that happened to be open. **The current behaviour is correct and
should be ratified, with a test.** **OQ-24.**

## 6. The weekly event that already ships

A **48-hour window every 7 days**. Seeded RNG picks the week's boon from five —
Mana regen ×2 · active costs −50% · Stardust ×3 · delve speed ×2 · **a free
attunement slot for the window** — and it pays a lump plus 5 Gems on opening,
then closes.

Every primitive at once: the timeline schedules it, the RNG picks it, a modifier
applies it, the deadline is the pressure. **The free-slot boon earns its keep by
making this week's loadout decision different from last week's.**

This is the archetype's ancestor and its proof. What it is missing is everything
in §2: a counter, a minigame, a track, a shop.

## 7. Build order

1. The four new modifier stats, with their call sites. Test: a modifier on each
   changes the number it names, and **an empty stack is bit-identical to today.**
2. The three new payload kinds. **Re-express the weekly event's hard-coded
   handler through the generic path** so it has a working consumer from the first
   commit.
3. Move the schedules and the boon table into the events file.
4. The track: thresholds from the workbook, a claim command, free and paid
   columns. **Paid claims are gated on a flag, and how that flag is set belongs
   to [`14-monetization.md`](14-monetization.md), not here.**
5. Event points: the earn hooks, event-scoped state, no wallet row.
6. The shop: stock, prices, the daily free refresh.
7. The fog island: a lightweight map module, one authored map, reveals priced in
   points.
8. **Author event #1 end to end. Then author event #2 and time it.**

## 8. The gate is a measurement

> **Author the second event and record the hours it took.**

The first event is a build; **the second is a measurement**, and that number is
**the marginal cost of a content drop.** Forge of Empires sustains 6–7 a year and
Elvenar 10.

The sharpest finding in the whole competitive review was that the real gap is
**organisational** — nobody has been named to run a live-ops calendar. **If our
second event costs a sprint, the answer to that finding is already no, and it is
much better to know it in week six than in month nine.**

Secondary gates: a track claimed during an offline replay pays exactly once; a
window that opens and closes inside an absence still fires; the free track
reaches the grand prize inside the window at ~30 min/day.

## 9. Dials, in the order to reach for them

| Dial | Where |
|---|---|
| Track thresholds and both reward columns | workbook |
| Points per source (§2.2) | workbook |
| Reveal prices on the event island | workbook |
| Shop stock, prices, refresh cadence | workbook |
| Window duration and period | the events file |
| Modifier template magnitudes | workbook |

## 10. Deliberately not in this design

An event wallet row (§2.1) · a regenerating roll resource (§2.2) · a
genre-foreign minigame (§2.3) · two separate ladders instead of two columns
(OQ-20) · points that carry between events (OQ-21) · an event that costs more
than ~30 min/day (§3) · a full second region for the island (§2.3) · re-expressing
upgrade levels as modifiers.

**Open questions:** OQ-18, OQ-19, OQ-20, OQ-21, OQ-22, OQ-23, OQ-24, and OQ-4 (authored or generated
islands).
