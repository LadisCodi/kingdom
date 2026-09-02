# Feature: the event archetype — the thing we author ten times a year

> Phase 2 of [`../road-to-mvp.md`](../road-to-mvp.md), and the pillar the
> 2026-09-01 brief audit called the moat.
> **Status: designed, unstarted. The engine underneath it is built and
> verified.**
>
> Companion docs: [`engine-seams.md`](engine-seams.md) §5, §7 (the timeline),
> [`magic.md`](magic.md) (the Conjunction, which is the archetype's ancestor),
> [`heroes-and-gacha.md`](heroes-and-gacha.md) §5 (why a seasonal collectible is
> two rows), [`monetization-sim.md`](monetization-sim.md) (how the pass is
> "bought" in a prototype with no purchases).

## Why this exists, and what is already true

The audit's conclusion was that the moat is the event/season/social engine
rather than the fog. The competitive review then measured the cadence: **Forge
of Empires ships 6–7 major events a year, Elvenar 10**, each with the same
skeleton — event currency, a minigame, a grand-prize bar, a shop with rotating
stock, a two-track pass.

Kingdom has **one authored event and zero banners.** But it does not have an
engine problem. Read from the source on 2026-09-02:

```ts
// src/sim/data/definitions.ts
export const EVENTS: readonly EventTemplate[] = [
  { id: 'conjunction', startsAt: EPOCH_MONDAY,
    durationMs: 48 * 3_600_000, periodMs: 7 * 86_400_000 },
];
```

**A recurring window with a hard deadline already ships**: 48 hours, every
seven days, with stable occurrence ids (`<template>#<n>`) materialised ±30 days
by `reconcileSchedule`, phases persisted so an event that paid out cannot pay
twice on reload, and reconciliation running *before* the offline advance so a
window that opened **and closed** during an absence still fires. The
load-bearing assertion — one-call replay equals stepped ticking — holds across
it.

So this feature is not "build an event system". It is **three narrow widenings
and then a content pipeline.**

---

## 1. What the docs claim and what the code has

`engine-seams.md` §5 describes four payload kinds. The union is two:

```ts
// src/sim/state.ts
export type SchedulePayload =
  | { kind: 'conjunction'; occurrence: number }
  | { kind: 'banner';      occurrence: number };
```

`grantModifier`, `grantReward` and `marker` were designed and never
implemented — the Conjunction's modifier and its Knowledge/Gem lump are applied
by a hard-coded handler rather than by a generic payload. That is the correct
call for a first consumer (§5 says so: *"do not build this speculatively"*), and
now there is a second consumer, so it is time.

`ModifierStat`, by contrast, is **wider than the review assumed** — twelve
values, already including `knowledgeYield`, `activeCost`, `delveSpeed` and
`attunementSlots`, because the Conjunction's five boons needed them. Only four
are missing for seasons.

## 2. The three widenings, done once, before any content

### 2.1 `ModifierStat` — add four

| Add | For |
|---|---|
| `buildSpeed` | "this weekend everything builds 50 % faster" |
| `researchSpeed` | the same for the tech tree |
| `trainSpeed` | villagers and units — `train_duration_seconds` is live now |
| `fragmentYield` | the collection's other axis; `knowledgeYield` already exists |

Each is *"a line in `modifiers.ts` plus a `resolve()` call in the helper that
owns that number"*, exactly as that file's own comment says. Four lines and four
call sites, and then a season is a data row. Doing it in one pass is what stops
the next three seasons from each being a sprint.

**Do not** re-express upgrade levels as modifiers. `engine-seams.md` §10 cut
that deliberately and it is still the right call.

### 2.2 `SchedulePayload` — add three

```ts
| { kind: 'grantModifier'; occurrence: number; template: ModifierTemplateId }
| { kind: 'eventTrack';    occurrence: number; track: EventTrackId }
| { kind: 'eventShop';     occurrence: number; shop: EventShopId }
```

- **`grantModifier`** takes a *template id*, not a magnitude. Magnitudes live in
  a `ModifierTemplates` workbook sheet, which is precisely the arrangement
  `engine-seams.md` §5 prescribes for tuning a season's numbers without
  touching the schedule.
- **`eventTrack`** is the milestone ladder: an ordered list of point thresholds,
  each with a **free** reward and a **paid** reward. That single structure is
  the grand-prize bar *and* the two-track pass. They are not two features.
- **`eventShop`** is stock rows plus a refresh cadence.

Handlers stay **pure functions of `(state, entry, t)`**. No closures over UI —
the moment an effect can only be replayed by re-running the UI, the determinism
argument the whole sim rests on collapses.

### 2.3 Where the content lives

`engine-seams.md` §5 says schedules belong in a hand-written
`src/sim/data/events.json`, **not** the workbook, because they are live-ops
content with wall-clock dates. Today they are in `definitions.ts` instead,
which is the same thing with worse ergonomics for a non-programmer. **Move
them to `events.json` as part of this pass**, before there are ten of them and
the move is a merge conflict.

Split, explicitly:

| Goes in `events.json` | Goes in the workbook |
|---|---|
| windows, periods, occurrence horizons | modifier template magnitudes |
| which track and shop an event uses | track thresholds and reward amounts |
| banner pools and rate-up | shop prices and stock quantities |

## 3. The archetype

Six parts. Every event we author is a different skin on these.

### 3.1 Event points, and why they are not a wallet row

`currency-simplification.md` cut **eleven wallet rows to seven** on purpose,
and four coins on the plank is documented as the *ceiling* of the genre rather
than the floor. Adding a row back per event would undo that within one content
drop.

> **Event points are a counter, not a currency.** They live in the event's own
> state, they are displayed on the event screen and nowhere else, and they never
> reach the plank or the purse sheet.

There is already a precedent to follow exactly: **Fragments** are a per-
collectible counter shown in the Reliquary, not a wallet row. Event points work
the same way. `addToWallet` is not involved, so none of the wallet's invariants
or the migrator are either.

### 3.2 How points are earned — through the base game, never beside it

The failure mode of an event minigame is that it becomes a second game the
player plays *instead of* the one you built. So points come from the loop that
already exists:

| Source | Why |
|---|---|
| Completing an **order** ([`habit-loop.md`](habit-loop.md)) | ties the two new pillars together |
| Extracting from a **delve** | scales with depth, so it rewards the deep arc |
| Claiming a **landmark**, clearing a **ruin** depth | the differentiator pays |
| **Taps**, at a low rate | so a player who only harvests still progresses |
| The **daily chest** | one guaranteed lump a day |
| A **rewarded video**, capped | the third ad placement |

**No regenerating roll resource.** The genre standard is a second energy that
refills — *Wooden Spoons*, dice, keys — and Kingdom already has an energy
(Mana). A second one competes with it for the same session and doubles the
number of budgets a player has to reason about, in a game already carrying ten
progression systems. Points earned by playing is the same pressure with one
fewer system.

### 3.3 The minigame is a fog island

Every comparable bolts on a genre-foreign minigame: match-3 (Township), a
maze (Sunrise Village), a board with dice (Family Island, Whiteout). Kingdom
has something better available, and it is the thing nobody else has.

> **The event minigame is a small map, shrouded, where event points buy
> reveals and the rewards are under the fog.**

It reuses the mechanic the whole game is built around, it is filmable, it needs
no new interaction vocabulary, and it inherits the fog's compounding cost curve
for free. A "Winter Isles" event and a "Sunken Coast" event are two maps and two
reward tables.

**How to build it without the region restructure.** A full second region needs
`GameState` reshaped into `regions: Record<RegionId, RegionState>`, which
`engine-seams.md` §6 explicitly cut and `../road-to-mvp.md` §9 keeps post-MVP.
So the event island is **not** a region: it is a lightweight state module with
fog, features and rewards, and **no buildings, workers, or economy**. Nothing
is produced there; things are found there.

That is cheaper, and it is also a **dry run for the region restructure** — it
will tell us what a second map actually needs before we pay for the general
case.

### 3.4 The track: grand prize and pass in one structure

An ordered ladder of point thresholds. Two reward columns.

```
threshold  free reward            paid reward
   100     Gold                   Gold ×2
   250     Fragments              Fragments + a shop refresh
   500     Gems                   Gems ×2
   ...
  final    the grand prize        the grand prize + a cosmetic/relic level
```

**The grand prize is a collectible** — a relic or a hero. Not a building, and
not a currency lump. Two reasons: the substrate already handles it
(`heroes-and-gacha.md` §5: *a seasonal hero is one hero row and one banner
row*), and it feeds the weeks-long collection arc, which is the only progression
axis in the game currently measured in weeks rather than hours.

**The free track must reach the grand prize.** Slower, but reachable. That is
pillar 3 — *nothing is purchase-only that cannot also be earned* — and it is
the line `heroes-and-gacha.md` §4 already holds for the gacha: *"it sells
breadth and speed, never a power ceiling you cannot earn."*

### 3.5 The shop

Stock rows with quantities, priced in event points, with **one free refresh a
day** (ad placement four) and paid refreshes after that. This is what makes
points worth farming past the track, and it is where boosters land.

### 3.6 The window

**Events close.** See §5 below.

---

## 4. The session budget, which is a hard constraint

The audit measured the mid-core PvE builders as having the **lowest** minutes
per day in the whole competitive set — 26.6 / 29.1 / 29.4 — and Kingdom's design
is already written against ~30 min/day across two or three visits, which is
unusually disciplined.

A 30-stage pass plus a weekly guild deadline plus three daily orders asks for
fifty minutes without anyone deciding to. So:

> **Every event is dimensioned for ~30 minutes a day across 2–3 visits, and the
> track is completable at that budget without the shop.**

If an event needs more, the event is wrong. This is the number that churns the
exact segment the project is trying to retain, and it is checked by timing a
real session, not by arithmetic — the same acceptance test `ad-economy.md` §6
sets for ads per day.

## 5. Do events close? Yes — and the game already decided

This is decision 5 in `../road-to-mvp.md` §8, framed there as the A/B fork
between "cozy" and "soft pressure". The recommendation is **yes**, on three
grounds:

1. **The pillar authorises it in as many words.** Promise 1 is *"pressure comes
   from opportunity that expires — a Mana pool that overflows, an event window
   that closes, a haul you chose to risk — never from loss of property."* A
   deadline is not a loss. This is exactly Family Island's pressure model minus
   the part Kingdom rejects.
2. **It already shipped.** The Conjunction is a 48-hour window on a 7-day
   period. The game has had a hard deadline since 2026-09-02.
3. **Without a close, the track is a checklist and the shop is a store.** The
   deadline is the only thing that makes a collective bar or a milestone ladder
   mean anything, and it is what the review found separating the titles that
   last from the ones that do not.

**What stays refused:** raids, theft, decay, hunger, and timers that destroy
progress. Points earned are banked; a track milestone reached is paid; a
collectible won is kept. What ends is the *chance to earn more*.

## 6. The 8-hour cap and event rewards — decide it now

Backlog gap 5: schedule events fire in the post-cap tail advance, so a 20-hour
absence spanning a 24-hour Conjunction **pays in full**. `engine-seams.md` §5
asked for a marker at the call site rather than a policy, and step 12 decided it
instead of flagging it.

With one weekly event this is a curiosity. With a calendar it is a support
ticket, so: **the current behaviour is correct and should be written down as the
rule.** The cap limits what the *city produces* while you are away and never
what a *timer* does — build queue, research, delve depths and event windows are
timers. An event window is a timer that happened to be open. Ratify it in
`engine-seams.md` §5, remove the "decided rather than flagged" line from the
backlog, and add the test.

## 7. Build order

1. `ModifierStat` += 4, with the four `resolve()` call sites. Test: a modifier
   on each new stat changes the number it names, and an empty stack is
   bit-identical to today.
2. `SchedulePayload` += 3. Re-express the Conjunction's hard-coded handler as
   `grantModifier` + `grantReward` so the generic path has a working consumer
   from the first commit — the same discipline `engine-seams.md` used for the
   timeline itself.
3. Move `EVENTS` and the boon table to `src/sim/data/events.json`.
4. `EventTrack` state, thresholds from the workbook, claim command, free and
   paid columns. **Paid claims are gated on a flag, and how that flag is set is
   [`monetization-sim.md`](monetization-sim.md)'s problem, not this doc's.**
5. Event points: earn hooks (§3.2), event-scoped state, no wallet row.
6. `EventShop`: stock, prices, the daily free refresh.
7. The fog island: a lightweight map module, one authored map, reveals priced
   in points.
8. **Author event #1 end to end.** Then author event #2 and time it.

## 8. Exit gate

The gate is not "an event works". It is a **measurement**:

> **Author the second event and record the hours it took.**

That number is the marginal cost of a content drop. Forge of Empires sustains
6–7 a year and Elvenar 10; the audit's sharpest finding was that the real gap is
organisational — 112 small idle apps at $600K/month is not a studio that has
run a live-ops calendar, and nobody has been named to run one. If our second
event costs a sprint, the answer to that finding is already no, and it is much
better to know it in week six than in month nine.

Secondary gates: a track claimed during an offline replay pays exactly once; a
window that opens and closes inside an absence still fires; the free track
reaches the grand prize inside the window at ~30 min/day.

## Open questions

- **Does an event island need its own art?** A reskinned terrain set is the
  cheapest version and it will look like a reskin. The honest answer is that
  event art is most of the cost of an event in this genre, and the second-event
  timing in §8 has to include it or the number is a lie.
- **One track or two per event** (a "free" ladder and a separate "premium"
  ladder, as some passes do)? Recommendation: one ladder, two columns. Simpler
  to author, simpler to explain, and it keeps the free player on the same bar as
  the payer, which is what makes the paid column legible.
- **Do event points carry over between events?** Recommendation: no — they are
  scoped to the occurrence. Carry-over turns an event into a currency and
  re-opens §3.1.
- **Does the fog island interact with `revealCost` modifiers?** It probably
  should not: a relic that discounts the real map should not trivialise the
  event map. Needs a scope on the modifier, which the `ModifierScope` union can
  express.
