# Proposal — what the five relics do

> **What this is.** A review of every relic's **passive** and its **active**,
> and a proposal for both. It is a **proposal**, not a feature doc: nothing
> here is built and every number is a first pass.
>
> **It decides one open thing on purpose.**
> [`../features/07-research.md`](../features/07-research.md) §6 plans for the
> relic actives to leave and become **spells in the Magic tome**, and
> [`../features/09-relics.md`](../features/09-relics.md) §1 already says *"a
> relic has no active"*. This proposal keeps the actives **on the relics** and
> builds them out instead. Pick one: a relic with two halves, or a relic with
> one half and a tome full of spells. They are not compatible.

## 1. What the five do today

| Relic | Passive | Stat | L1 | Per level | Active | Mana | Duration |
|---|---|---|---|---|---|---|---|
| **Dowsing Rod** 🔮 | forests, crops and stone recover faster | `cellRecovery` mul | ×0.85 | **−0.05** | **Divination** — pays a frontier cell's remaining reveal cost | 8 | instant |
| **Verdant Seal** 🌱 | berries, game and shoals come back sooner | `cellRespawn` mul | ×0.85 | **−0.05** | **Bloom** — clears exhaustion within radius 2 | 6 | instant |
| **Foreman's Sigil** ⚡ | every worker carries more | `workerYield` **add** | +1 | +0.5 | **Haste** — `workerYield` ×2 | 10 | **60 min** |
| **Gilded Ledger** 🪙 | your villagers pay more tax | `taxRate` mul | ×1.10 | +0.10 | **Beckon** — calls a depleted resource back | **0** | instant |
| **Wanderer's Compass** 🧭 | rooms pay more Stardust | `stardustYield` mul | ×1.25 | +0.25 | **Beckon** — *the same one* | 5 | instant |

Six things are wrong with that table.

- **Two passives die.** The Rod and the Seal fall 0.05 a level and read `0.00`
  at **level 18** — instant recovery, instant respawn, and every season after
  pays nothing, on a ladder [`09`](../features/09-relics.md) §2 says has no
  ceiling. **OQ-97.**
- **One passive is flat.** The Sigil adds `+1` and `+0.5` a level, so it is
  enormous on a worker carrying two and a rounding error on one carrying
  forty. Every other passive is a multiplier.
- **Two relics share one active.** The Ledger and the Compass both cast
  `Beckon`, so the fourth relic has no ability of its own.
- **One active is free.** The Ledger's `Beckon` costs **0 Mana** — the only
  thing in the game that draws on the pool for nothing.
- **Four of five actives are instant.** Only Haste is a window, and it is the
  only one the design writes a sentence about (*cast it on your way out*).
- **No active reads the relic's level.** A level-18 Dowsing Rod casts exactly
  the Divination a level-1 one casts. The permanent ladder and the ability are
  two systems that never meet.

And the five passives are **four economies and a collection**: nothing points
at research, combat or the fog.

## 2. The rule this proposes

- **A relic is one idea at two speeds.** The passive is that idea always on;
  the active is the same number, much larger, for minutes, paid in Mana.
  Reading a relic is then one sentence, not two.
- **The passive points UP and is a multiplier**, always — a speed, a yield or a
  capacity. A discount dies at 100% and a flat bonus goes stale; a multiplier
  does neither. **Level scales the passive's power**, for ever, with no cap.
- **The active is a WINDOW.** Minutes, never instant, and always worth more
  per minute than the passive is — otherwise it is a button that pays less
  than doing nothing.
- **Level scales an active's power OR its duration, never both.** Two growing
  axes on one ability is a number nobody can price, and at level 18 it is two
  numbers nobody can survive.
- **An active whose effect is a discount scales DURATION.** Power would walk it
  to zero and then past it; duration can grow for ever.
- **Mana is the session budget.** Every tap costs 1 Mana, so a 20-Mana cast is
  twenty taps not taken. That is the whole cost, and it is why an active does
  not need a cooldown.

## 3. The five

| Relic | Area | Passive — always on | Active — a window | Mana | Level scales |
|---|---|---|---|---|---|
| **Dowsing Rod** 🔮 | the ground | `recoverySpeed` **×1.20**, +0.20 a level | **Bloom** — every harvest cell in radius 2 refills to full at once, and recovery runs **×5** for **10 min** | 15 | **duration**, +1 min a level |
| **Verdant Seal** 🌱 | the wild | `respawnSpeed` **×1.20**, +0.20 a level | **Beckon** — every feature waiting to respawn returns at once, and respawn runs **×5** for **10 min** | 15 | **duration**, +1 min a level |
| **Foreman's Sigil** ⚡ | labour | `workerYield` **×1.15**, +0.15 a level | **Haste** — every worker carries **×3** for **60 min** | 20 | **power**, +0.25× a level |
| **Gilded Ledger** 🪙 | money | `taxRate` **×1.10**, +0.10 a level | **The Ledger's Due** — taxes run **×4** for **30 min** | 20 | **power**, +0.5× a level |
| **Wanderer's Compass** 🧭 | the frontier | `stardustYield` **×1.25**, +0.25 a level | **Divination** — revealing a cell **costs no Gold** for **5 min** | 25 | **duration**, +30 s a level |

- **The Rod and the Seal keep the two harvest clocks**, which is the pairing
  [`09`](../features/09-relics.md) §2 argues for — but as SPEEDS the call site
  divides by, so ×2 is half the wait, ×5 a fifth, and no level reaches zero.
  Their actives become the burst of the same clock: everything back now, and
  the clock itself hurried while the window runs.
- **The Sigil's passive becomes a multiplier.** `+1 per worker` was the biggest
  number in the game on day two and invisible by day twenty; `×1.15` is worth
  the same fraction for ever.
- **The Ledger gets an active of its own, and it costs something.** Taxes ×4
  for half an hour is the money relic doing the money thing, and it replaces
  the free `Beckon` nobody should have had.
- **Divination moves to the Compass** — the relic whose whole card is finding
  the way — and becomes a window instead of one cell. It converts the fog's
  price from **Gold into Mana**: revealing is free, but every tap still costs
  1 Mana, so the pool is the brake and the player chooses how hard to push.
  That is the same question [`09`](../features/09-relics.md) already says the
  Rod's Divination asked, made into a session move.
- **No relic moves a stat a legendary boon moves** (`buildSpeed`,
  `researchSpeed`, `manaRegen`, `worldRevealSpeed`, `heroXp`, `unitHp`), and no
  boon moves a relic stat. **Research and combat belong to the boons**
  ([`legendary-boons.md`](legendary-boons.md)); the relics are the city's own
  layer, and putting both permanent systems on one number would make the
  second one unreadable.

## 4. The three you cast on your way out

- An active is a **timed modifier**, and a timed modifier's expiry is already a
  boundary in `nextBoundary` — so a window that closes during an absence closes
  at the right instant, and one still open pays for the whole time it was.
- **Production stops at the offline cap (8 h) and a timer does not**
  (CLAUDE.md, invariant 2). So a window shorter than the cap is paid IN FULL
  during an absence:

| Cast on the way out | Why it pays while away |
|---|---|
| **Haste** — 60 min | worker yield is production, and an hour fits inside the cap |
| **The Ledger's Due** — 30 min | so are taxes |
| **Bloom** / **Beckon** | the refill lands now, and the hurried clock runs while the crew works through it |

- **Divination does not**, and should not: the fog is a thing the player
  presses, so its window is worth exactly nothing to somebody who has closed
  the game. That is the difference between a departure move and a session move,
  and the five should have both.

## 5. What it would take

| Step | Where |
|---|---|
| `recoverySpeed` and `respawnSpeed` — two `ModifierStat`s the call site DIVIDES by, replacing the two dying discounts | `modifiers.ts`, `harvest.ts#effectiveRecoveryMs`, `#effectiveRespawnMs` |
| The Sigil's passive from `add` to `mul` | the `Artifacts` sheet |
| `active_duration_seconds` filled on all five, and a `per_level` column for whichever axis each one scales | the `Artifacts` sheet |
| `castCost` and the window read the relic's LEVEL | `casting.ts` |
| Five actives rebuilt: two bursts, two surges, one fog window | `casting.ts` |
| The relic card prints the active's numbers at this level and at the next, as it already does for the passive | `ui/collectionSheet.ts` §11.4 |

- **No new screen and no new save field.** A timed modifier is already
  persisted, already expires on a boundary, and already survives a reload.

## 6. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| A passive's `base` and `per_level` | §3 | `Artifacts` sheet |
| A passive's direction | **up only, multiplicative** | a test |
| What an active costs | 15 · 15 · 20 · 20 · 25 Mana | `Artifacts` sheet, `active_mana_cost` |
| How long a window runs | 10 · 10 · 60 · 30 · 5 min | `active_duration_seconds` |
| Which axis a level moves | **one of power or duration, never both** | a new `active_per_level` column, and a test |
| Bloom's radius | 2, fixed | `active_radius` |

## 7. Deliberately not in this proposal

- **A passive that is a discount, a cost or a time.** It dies at 100%, and a
  relic's ladder has no top.
- **A passive that is flat.** It goes stale on its own as the city grows.
- **An active that is instant.** The window IS the ability; an instant one is
  a consumable with no decision in it.
- **A level that moves an active's power AND its duration.** Two growing axes
  multiply, and at level 18 that is not a buff, it is a different game.
- **A cooldown on an active.** Mana is the cost, and a second brake on the
  same button is a second thing to explain.
- **Two relics sharing an ability**, or one that costs nothing.
- **A relic that moves a number a legendary boon moves.** The two permanent
  layers stay legible by staying disjoint.
- **An active that pays a player who is not there to press it.** Divination is
  deliberately a session move, not a departure one.

**Open questions:** OQ-97, OQ-98 in
[`../open-questions.md`](../open-questions.md).
