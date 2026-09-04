# 6 · Construction — builders, and the offer a refusal raises

> **Scope.** How many things the city can build at once, what happens when it
> cannot build one more, and the builder purchase surface.
>
> **Status: built.**

## 1. The rule

- There is no waiting line. A build starts if a builder is free; otherwise it is
  refused.
- Jobs in flight = builder count.
- An upgrade occupies a builder exactly as a build does.
- Cancel refunds the full cost, recomputed from the cost formula.

## 2. The offer

- A build or upgrade refused for want of a builder opens a sheet. No toast.
- Two states, one sheet:

| State | Shows |
|---|---|
| Below the ceiling | what is happening, the crew as pips, and one priced button |
| **At** the ceiling | the same, and **no button** |

- Placement mode stays open behind the sheet. Dismissing it returns the player
  to the positioned ghost.
- The sheet says a job can be finished to free a builder; it does not sell the
  Gem rush.

## 3. The price

- `round(base × growth^purchased)`: the same escalating-slot curve as the
  research, party and attunement slots.
- `purchased` is **derived**, `builders − startBuilders`, not stored. A
  *granted* builder (a quest, an event) makes the next *bought* one dearer.
- Every Gem sink is priced on the 500-Gems-a-dollar ladder
  ([`14-monetization.md`](14-monetization.md) §2.2). Each builder is the next
  pack up (`×2`).
- The up-front Gem faucet is 3,750 Gems.

| Builder | Gems | Pack |
|---|---|---|
| 2nd | **2,500** | $4.99 |
| 3rd | 5,000 | $9.99 |
| 4th | 10,000 | $19.99 |

- A builder unlocks nothing; it lets two things happen at once.

## 4. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Builders at the start | 1 | `kingdom.start_builders` |
| Ceiling | 4 | `kingdom.max_builders` |
| Price of the next builder | `round(2500 × 2^purchased)` | `kingdom.builder_gem_cost_base`, `…_growth` |

## 5. Deliberately not in this design

- A waiting line, and any promotion or reordering logic (§1).
- A `build_queue_capacity` dial alongside the builder count.
- A free trial of a builder.
- Rushing offered inline in the offer sheet.
- A store card for builders ([`14-monetization.md`](14-monetization.md) §2).

**Open questions:** OQ-31, OQ-32.
