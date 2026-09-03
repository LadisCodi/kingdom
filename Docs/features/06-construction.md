# 6 · Construction — builders, and the offer a refusal raises

> **Scope.** How many things the city can build at once, what happens when it
> cannot build one more, and the first real purchase surface in the game.
>
> **Status: built.**

## 1. The rule

> **There is no waiting line. A build either starts, because a builder is free,
> or it does not start at all.**

Nothing is ever parked. The number of jobs in flight is *exactly* the builder
count.

This is the decision the rest of the feature falls out of, so it is worth saying
why. A waiting line is administratively convenient and dramatically inert: the
player queues five things, walks away, and **never meets the constraint**.
Without one, the constraint has a *moment* — the tap that gets refused — and a
moment is something a game can build on. It is also simply more honest about
what a builder is: a person who is either free or busy.

An **upgrade occupies a builder exactly as a build does**, so both hit the same
gate and get the same answer.

**Cancel is a full refund**, recomputed from the formula rather than from a
stored snapshot, so a cancelled build is never worth more or less than it cost.

## 2. The offer

When a build or an upgrade is refused for want of a builder, the game does not
toast. It opens a sheet.

> **The refusal is the offer.**

This is the whole design. The player has already chosen the building, already
placed the ghost, already pressed Build — they have done everything except the
thing they cannot do. That is the only point at which "a second builder" means
something concrete rather than abstract, and it is why the offer is raised *from
the refusal* rather than waiting in a store tab for someone to browse it.

It replaced a toast reading *"Build queue is full"*, which was wrong twice over:
there is no queue, and a slip in the corner of the screen is not an answer to
something the player just tried to do.

Two states, one sheet:

| State | Shows |
|---|---|
| Below the ceiling | what is happening, the crew as pips, and one priced button |
| **At** the ceiling | the same, and **no button** — there is nothing to sell |

A store that offers what it cannot deliver is worse than one that says so, so
the ceiling case is a real screen rather than a disabled button.

**Placement mode stays open behind it.** Dismissing the offer puts the player
back on the ghost they had positioned, so declining costs them nothing they had
already done.

## 3. The price

`round(base × growth^purchased)`, the same escalating-slot curve the research,
party and attunement slots use. A fourth spelling of the same idea would be a
fourth thing to learn.

| Builder | Gems |
|---|---|
| 2nd | **30** |
| 3rd | 75 |
| 4th | 188 |

**Why 30 for the second.** It is exactly a gacha pull, which makes the first
real choice in the Gem economy a legible one: *a hero, or a second builder?* The
up-front faucet is 75 Gems, so the second builder is affordable inside the first
arc and the third is a genuine saving.

`purchased` is **derived** — `builders − startBuilders` — rather than stored,
because two numbers that must agree eventually will not. The trade: a *granted*
builder (a quest, an event) makes the next *bought* one dearer. That is the right
way round for a gift.

**A second builder is the best-documented conversion surface in the whole
comparable set** — Whiteout sells it as the Construction Queue Pack with a
15-minute free trial, Last War hands it out at VIP 6 — and it is exactly the
purchase the third promise authorises: *comfort and breadth, never access.* It
unlocks nothing; it makes two things happen at once.

## 4. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Builders at the start | 1 | `kingdom.start_builders` |
| Ceiling | 4 | `kingdom.max_builders` |
| Price of the next builder | `round(30 × 2.5^purchased)` | `kingdom.builder_gem_cost_base`, `…_growth` |

## 5. Deliberately not in this design

- **A waiting line**, and therefore any promotion or reordering logic. §1.
- **A second dial for the same number.** A `build_queue_capacity` alongside a
  builder count can only ever disagree with it — which is exactly how the
  original bug survived review, with both gates reading the constant and neither
  reading the builders.
- **A free trial.** Well-evidenced in the comparables, but a trial is a timer, a
  state and an expiry path, and none of that should be built before the plain
  purchase has been watched.
- **Rushing offered inline.** The sheet says a job can be finished to free a
  builder; it does not sell the Gem rush in the same modal. Two purchases in one
  sheet is a decision about a decision.
- **A store card**, which belongs to [`14-monetization.md`](14-monetization.md)
  §2. This offer stays either way: a surface the player is *sent* to and one
  they *stumble into* answer different questions.

**Open questions:** OQ-30, OQ-31, OQ-32.
