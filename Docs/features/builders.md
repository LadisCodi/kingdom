# Feature: builders, and the offer that a refused build raises

> **Built 2026-09-02.** The dial was authored in the workbook, mapped by the
> importer, and unreachable in play; this makes it live, gives it a price, and
> turns the refusal it produces into the game's first real Gem offer.
>
> Companion docs: [`balancing-v3.md`](balancing-v3.md) §5 (where the dead dial
> was found), [`monetization-sim.md`](monetization-sim.md) (the store this
> offer will later also live inside),
> [`../06-construction-queue.md`](../06-construction-queue.md) (the frozen
> Unity queue engine, which had a waiting line — we do not).

## 1. The rule

> **There is no waiting line. A build either starts, because a builder is
> free, or it does not start at all.**

Nothing is ever parked. The number of jobs the city can have in flight is
*exactly* the builder count, and `buildQueueCapacity(state)` returns
`builderCount(state)` with nothing else in it.

This is the decision the rest of the feature falls out of, so it is worth
saying why. A waiting line is administratively convenient and dramatically
inert: the player queues five things, walks away, and never meets the
constraint. Without one, the constraint has a *moment* — the tap that gets
refused — and a moment is something a game can build on. It is also simply
more honest about what a builder is: a person who is either free or busy.

**What it cost.** `advanceQueue`'s promotion branch — the one that stamps a
waiting item with the instant its slot freed, so a long absence resolves a
chain of builds in true chronological order — can now never fire in play. It
is kept rather than deleted: it is correct behaviour for a queue longer than
its slots, this rule is a design choice rather than a law of the engine, and
`tests/builders.test.ts` holds it to its own contract directly instead of
through a game state that cannot produce it.

**And the dial it killed.** `city.build_queue_capacity` is gone from the
workbook. A second dial for the same number can only ever disagree with the
first — which is exactly how the original bug survived review: both gates in
`commands.ts` read the constant (1) and neither read the builders, so a
kingdom with four builders still refused its second job.

## 2. The offer

When a build or an upgrade is refused for want of a builder, the game does not
toast; it opens a sheet.

> **The refusal is the offer.**

This is the whole design. The player has already chosen the building, already
placed the ghost, already pressed Build — they have done everything except the
thing they cannot do. That is the only point at which "a second builder" means
something concrete rather than abstract, and it is why the offer is raised
from the refusal rather than waiting in a store tab for someone to browse it.

It replaced a toast reading **"Build queue is full"**, which was wrong twice
over: there is no queue, and a slip in the corner of the screen is not an
answer to something the player just tried to do.

Two states, one sheet:

| State | Shows |
|---|---|
| Below the ceiling | What is happening, the crew as pips, and one priced button |
| **At** the ceiling | The same, and **no button** — there is nothing to sell |

A store that offers what it cannot deliver is worse than one that says so, so
the ceiling case is a real screen rather than a disabled button.

**Placement mode stays open behind it.** Dismissing the offer puts the player
back on the ghost they had positioned, so declining costs them nothing they
had already done. An upgrade hits the same gate and gets the same offer,
because an upgrade occupies a builder exactly as a build does.

## 3. The price

`round(base × growth^purchased)`, the same escalating-slot curve the research,
party and attunement slots already use — a fourth spelling of the same idea
would be a fourth thing to learn.

| Builder | Gems |
|---|---|
| 2nd | **30** |
| 3rd | **75** |
| 4th | **188** |

`purchased` is **derived** — `builders − startBuilders` — rather than stored in
its own save field, because two numbers that must agree eventually will not.
The trade: a *granted* builder (a quest, an event, `?dev`) makes the next
*bought* one dearer. That is the right way round for a gift, and it costs no
migrator.

**Why 30 for the second.** It is a gacha pull (`gacha.pullGemCost` 30), which
makes the first real choice in the Gem economy a legible one: *a hero, or a
second builder?* The up-front faucet is 75 Gems (`balancing-v3.md` §3), so the
second builder is affordable inside the first arc and the third is a genuine
saving. **This number has not been playtested** — see Open questions.

## 4. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Builders at the start | 1 | `kingdom.start_builders` |
| Ceiling | 4 | `kingdom.max_builders` |
| Price of the next builder | `round(30 × 2.5^purchased)` | `kingdom.builder_gem_cost_base`, `…_growth` |

## 5. What is deliberately not here

- **A store section.** [`monetization-sim.md`](monetization-sim.md) Phase 3
  adds a Builders card to the shop, next to the Gem packs and the pass. This
  offer stays either way — a surface the player is *sent* to and a surface
  they *stumble into* answer different questions, and the whole point of the
  simulated store is measuring which surfaces have demand.
- **A free trial.** Whiteout sells the second builder with a 15-minute free
  trial and it is a well-evidenced pattern, but a trial is a timer, a state
  and an expiry path, and none of that should be built before the plain
  purchase has been watched.
- **Rushing as the alternative.** The sheet says a job can be finished to free
  a builder; it does not offer the Gem rush inline. Two purchases in one modal
  is a decision about a decision.

## Open questions

- **Is 30 Gems right for the second builder?** It is priced at a gacha pull on
  purpose, but nobody has watched a player meet it. The faucet pays 75 up
  front and the offer arrives early — possibly *very* early, since one builder
  and a build queue of one is the opening state.
- **Should the offer have a cooldown?** A player mid-expansion can meet the
  refusal several times a minute. It is currently raised every time. If that
  reads as nagging, the fix is a "don't offer again for N minutes" flag rather
  than a quieter refusal — the offer is the point.
- **Does a builder ever come from a quest?** `grantBuilder` exists and nothing
  calls it outside `?dev`. A granted second builder late in the onboarding
  chain would teach the mechanic before it is ever sold, which is the pattern
  every other slot in the game follows (research slot 2 is earned, not bought).
