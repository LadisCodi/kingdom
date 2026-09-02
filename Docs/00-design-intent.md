# Kingdom — Design Intent

> What the game *is* and how it *plays* — the fantasy, the loops, and the systems
> from the player's point of view. No code, no architecture.
>
> **Scope note.** This document describes the **web build** and the design pass of
> 2026-09-02. Files `01`–`11` in this folder are a frozen **Unity as-built
> snapshot** from 2026-08-17 and describe a different, earlier game (hex grid,
> Silver, generator vaults, spells). Where they disagree with this document or
> with `Docs/features/`, they are history, not spec.

## The pitch

Kingdom is a cozy **city-builder / idle-management** game on a fog-shrouded
fantasy map. You are a wizard-monarch growing a city outward from a single
Townhall: you buy back the map from the fog, build districts whose workers walk
out and harvest for you, grow a population that pays taxes, and recover the lost
magic buried in the ruins out there.

Costs scale with distance and ambition, so play rewards thoughtful spatial and
economic planning. The starter city is **Oakville**, in **Region_01**.

**It is played in visits, not sittings.** Roughly half an hour a day across two
or three check-ins. Every system below is shaped by that budget.

## The three promises

1. **Nothing you own is ever taken from you.** No raids, no decay, no
   starvation, no failure state. Pressure comes from *opportunity that expires* —
   a Mana pool that overflows, an event window that closes, a haul you chose to
   risk — never from loss of property.
2. **The best-managed economy wins.** Combat is a sink for the economy, not a
   test of reflexes. A well-prepared expedition never fails.
3. **Wallets buy comfort and breadth; play buys everything else.** Nothing is
   purchase-only that cannot also be earned.

## The core loop

1. **Reveal** — spend Gold, one tap at a time, to peel back the fog. Cost scales
   steeply with distance from the Townhall, so exploration is a deliberate,
   financed campaign. **The frontier stays connected**: you can only pay for a
   cell that touches ground you have already cleared. A building's discover
   radius reaches further than its reveal radius, so you can *see* further than
   you can buy — and without the rule, exploring became a shopping list of
   whichever distant tile looked interesting, which also let the player skip
   the distance cost curve entirely by jumping to the cheap side of the map.
2. **Harvest** — tap resource cells directly. Every tap spends **1 Mana**, so
   Mana is the energy behind hand-acceleration; cells still exhaust after a
   number of taps and recover on a timer.
3. **Build** — place districts on revealed land. Costs are charged up front;
   construction takes time and runs while you are away.
4. **Grow** — train villagers at the Townhall. Housed villagers pay taxes, which
   is the idle backbone of the economy.
5. **Staff** — assign workers to districts. Workers are units that walk to cells
   within their building's area of influence, harvest, and carry back.
6. **Reinvest** — upgrade districts, research technologies, buy upgrades.
7. **Delve** — send a hero and a party into the ruins you have uncovered.
8. **Empower** — attune the artifacts they bring back, and spend Mana on the
   magic that makes the next loop cheaper.

## The map, and why the fog is the point

Every cell has a terrain and optionally a feature, and can hold one district.
Cells are **Undiscovered**, **Discovered** (payable frontier) or **Revealed**.

Paid fog is the mechanic the game is built around, so it has to pay back three
different ways:

| Found in the fog | Gives |
|---|---|
| **Resources** — forest, berries, game, rocks, shoals, iron | The raw materials |
| **Landmarks** — shrines, standing stones, leysprings | **+10 max Mana**, permanently |
| **Ruins** | Dungeons to delve — artifacts, Fragments, Knowledge |

Landmarks are what make exploration *compound*: a bigger Mana pool is a bigger
session AND a bigger ad — the reward refills a whole pool — so every shrine
claimed makes every future refill permanently larger, and the next stretch of
fog cheaper to clear.
Ruins are what stop the fog from being a treadmill — a non-repeating reward at
the end of an exponential cost curve.

## The economy

> **The city runs on Gold, Food, Wood and Stone. Mana is what a tap costs.
> Knowledge comes out of dungeons, and buys nothing but heroes and relics.**

**City-local:** Gold (build, upgrade, reveal, **research**), Food (train
villagers, supply expeditions), Wood and Stone. **Mana** is city-local too,
and the only currency in the game with a cap.

A cell's identity and the currency it pays are two different things. Berry
bushes, game and shoals all pay **Food** — 1, 3 and 2 a tap — and an iron vein
is a rich **Stone** node at 3 a tap. The map keeps its texture; the purse
stops carrying four extra rows to express it.

**Kingdom-wide:** Knowledge — the levelling currency for artifacts and heroes,
and nothing else. Kingdom scope is deliberate: it survives a region reset, so
it still works when Regions become the content treadmill.

**Player:** Gems. They buy comfort — rushing a timer, refilling Mana — and
breadth: attunement slots, party slots, gacha pulls.

The everyday flow: **housing taxes → Gold → fog, buildings and research**;
**harvest → materials → buildings**; **Mana → magic**; **delves → artifacts
and Knowledge → a stronger collection**.

Seven wallet rows, four coins on the plank, three of them for the whole first
hour. Full design:
[`features/currency-simplification.md`](features/currency-simplification.md).

## Mana, and why it is capped

**Mana is the game's energy.** Every tap that hurries a generator along — a
house's rent, a forest, a rock — costs 1 Mana, so the pool is what bounds
hand-play. Paying fog is the exception: a reveal already costs Gold.

It refills to a ceiling whether you are playing or not, and a new kingdom
starts full (50). Since the pool became a **spend** budget rather than an
absence budget, it deliberately no longer refills inside one absence — that
gap is what a refill is worth buying for. A player who checks in two or three
times a day spends more of it than one who checks in once; nobody loses
anything they own, because unspent Mana is never taken, only capped.

**Nothing draws against it.** Attuned artifacts used to charge an hourly
upkeep; that was removed (2026-09-02) once Mana became the energy every tap is
paid from, because the two jobs fought — at Townhall 1 the full relic set drew
exactly what the Townhall made, so wearing everything stalled the pool dead.
Mana is a tap budget now, and the only thing that spends it is the player.

Full design: [`features/magic.md`](features/magic.md).

## Artifacts

Relics won from ruins. Each grants a **passive** while attuned to the kingdom and
usually one **active** ability cast on the map. You start with a single
attunement slot; a second comes from research and the rest cost Gems.

An artifact is either attuned to the kingdom, or carried by a hero into a delve
— never both. That exclusivity is the decision the whole design turns on.

## Expeditions

A ruin is a repeatable dungeon. Send **one hero** — mandatory — plus units, pay
supplies, and the party clears one **depth** at a time. At every checkpoint it
asks a single question: **go deeper, or come back with what you're carrying?**
Failing costs half the haul and ends the run; the haul was never yours until you
extracted it.

Combat is a scoring pass, not a simulation: units have ATK/DEF/HP, each dungeon
has a threat type, and a matchup chart rewards composition. There is no battle
screen. Party HP does not recover between depths, so danger rises visibly the
deeper you go.

Full design: [`features/expeditions.md`](features/expeditions.md).

## Progression, in one line

Three arcs run at different speeds. The **Townhall level** gates the city — how
many of each district you can own and how high each can level. **Military
buildings** gate the army, and therefore how deep you can delve. **Knowledge and
Fragments** gate artifacts and heroes, and that arc is measured in weeks.

## What is built

Nearly all of it, as of 2026-09-02, in the order `engine-seams.md` §8
prescribes: the
boundary loop, the save migration chain, seeded RNG, the modifier layer, Mana
and the Sanctum, landmarks, ruins, artifacts and attunement, military buildings
and unit stats, delves and checkpoints, the timeline and the Conjunction, the
gacha, and the region discriminator.

The load-bearing assertion is repeated at every step and holds at all of them:
**one-call offline replay equals stepped ticking** — across a research
completion, a modifier expiry, a Mana cap fill, a delve depth resolving, and a
Conjunction window opening and closing.

The quest chain now runs eleven quests past Townhall 3, through landmarks, the
Sanctum, an army and the ruins, so the three-hour content cliff the 2026-09-01
audit found is gone.

One design centrepiece did **not** make it — the contested landmark — and it is
the first entry in the backlog below rather than being buried in it.

**Attune-or-arm landed on 2026-09-02**, after the rest of the pass. An artifact
is now attuned to the kingdom *or* carried by a hero into a delve, never both,
and both directions refuse: a launch will not take a relic the kingdom is
wearing, and the Reliquary will not take back one that is underground. Relics
gained a `carried` stat block to have something to be on the "arm" side of the
rule. Measured in the Drowned Ironworks, the Foreman's Sigil takes a party from
safe-to-depth-2 to safe-to-depth-7 — the trade the design named, now real.

The art landed with it: ten sheets covering the Sanctum, the four military
halls, ten landmarks, five ruins, five relics and five heroes. Nothing in the
game falls back to an emoji unintentionally, and `tests/icons.test.ts` refuses
to let that quietly stop being true.

## What is still open

**This section is the canonical backlog.** The per-feature docs mark their own
steps done and point here rather than each keeping a partial list.

**What happens next lives in [`road-to-mvp.md`](road-to-mvp.md)** — the ordered
plan for the four pillars the 2026-09-02 competitive review found missing
(the habit layer, the event archetype, simulated monetisation and the social
layer), its phase gates, and the register of design decisions still to close.
Phase 0 of that plan ([`features/balancing-v3.md`](features/balancing-v3.md))
re-diagnoses gaps 3 and 9 below against the workbook: **gap 3 does not
reproduce** — the authored Gem faucet is 75, exactly its budget — and gap 9's
`kingdom.max_builders` is promoted out of "smaller" into a pillar of its own.

### Gaps in what shipped

Ordered by how soon a player meets them.

| # | Gap | Where |
|---|---|---|
| 1 | **Four of ten landmarks cannot be claimed.** `defended: true` is authored and claiming is gated on `landmarks.cleared`, but nothing in the codebase ever writes that field — the "send a party to clear it" encounter does not exist. A visible dead end, and the only thing giving combat a job outside dungeons. | `expeditions.md` §1 |
| 2 | **Hero XP is written and never read.** Every extraction calls `addHeroXp`; nothing consumes it. Exactly the `train_duration_seconds` fault this pass removed, reintroduced. | `heroes-and-gacha.md` §1 |
| 3 | **The Gem faucet is ~50% over budget** — 110 up front against the 75 the design sets, because the eleven new quests were given Gem rewards without re-deriving the total. | `balancing-v2.md` §1.3 |
| 4 | **No gacha banner is authored.** The timeline carries a `banner` payload and `activeBanners()` exists, but `EVENTS` holds only the Conjunction, so rate-up is untested code. | `heroes-and-gacha.md` §4 |
| 5 | **Timed-event rewards vs the 8h cap was decided rather than flagged.** Schedule events fire in the post-cap tail advance, so a 20h absence spanning a 24h Conjunction pays in full. `engine-seams.md` §5 explicitly asked for a marker at the call site instead of a policy. | `engine-seams.md` §5 |
| 6 | **Adjacency is still one rule** (Housing↔Housing −1) — and five more districts now compete for the same ground, so spatial play got thinner in relative terms. | `balancing-v2.md` future work |
| 7 | **The ghost is not draggable.** `wireInput` has no drag hooks; placement is still tap-only. | `art/ui-menus-redesign.md` §5.6 |
| 8 | **No new sounds.** Casting, claiming, delving and the checkpoint all reuse existing SFX. | `audio-wishlist.md` |
| 9 | Smaller: the `?dev=kit` gallery does not show the new primitives; `balancing-v1`'s income tables are annotated as corrected but not recomputed; `kingdom.max_builders` is authored 4 and still unreachable past 1. | — |

### Decisions still to make

- **How a defended landmark is cleared.** The sim can resolve it through the
  same scoring pass a delve depth uses, so the cost is a UI decision: the full
  expedition sheet with a hero and a party, or a lighter one-off that spends
  army power and nothing else.
- **Whether the 8h cap should limit timed-event rewards** (gap 5 above). The
  rule the rest of the sim follows — *the cap limits what the city produces,
  never what a timer does* — argues for the current behaviour, but an event
  window is not obviously a timer.
- **The 50% haul loss.** `expeditions.md` names this the number that most needs
  playtest rather than argument.
- **Ten progression systems.** `heroes-and-gacha.md` flags this as the standing
  accepted risk. It is now real rather than hypothetical, and the single
  collection substrate is the only thing keeping the list learnable. The
  *currency* half of it was cut on 2026-09-02 — eleven wallet rows to seven —
  but the systems count was not
  ([`features/currency-simplification.md`](features/currency-simplification.md)).
- **Collection progress now sits behind the army.** Knowledge comes only out
  of dungeons, so the chain is army → hero → ruin → first clear → Knowledge →
  relic levels. That gives the military buildings a job outside dungeons,
  which this backlog wants — but a player who never delves makes no progress
  on the weeks-long arc at all. First thing to watch in playtest.

### Not started at all

Region control and domination, guild and social play, and a second region.
