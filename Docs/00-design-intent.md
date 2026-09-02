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
   financed campaign.
2. **Harvest** — tap resource cells directly. They exhaust after a number of taps
   and recover on a timer.
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
| **Landmarks** — shrines, standing stones, leysprings | **+1 Mana/h**, permanently |
| **Ruins** | Dungeons to delve — artifacts, Fragments, Knowledge |

Landmarks are what make exploration *compound*: more Mana per hour lets you
sustain more artifacts, which makes the next stretch of fog cheaper to clear.
Ruins are what stop the fog from being a treadmill — a non-repeating reward at
the end of an exponential cost curve.

## The economy

**City-local:** Gold (build, upgrade, reveal), Food (train villagers, supply
expeditions), Wood, Stone, Iron, and the food-valued goods Berries, Meat and
Fish. **Mana** is city-local too, and the only currency in the game with a cap.

**Kingdom-wide:** Knowledge — the levelling currency for artifacts and heroes.
Kingdom scope is deliberate: it survives a region reset, so it still works when
Regions become the content treadmill.

**Player:** Gems. They buy comfort — rushing a timer, refilling Mana — and
breadth: attunement slots, party slots, gacha pulls.

The everyday flow: **housing taxes → Gold → fog and buildings**; **harvest →
materials → buildings**; **Mana → magic**; **delves → artifacts and Knowledge →
a stronger economy**.

## Mana, and why it is capped

Mana refills to a ceiling whether you are playing or not, in about six hours —
just under the eight-hour offline cap. A player who checks in two or three times
a day never wastes any; a player who checks in once a day wastes some. That is
the entire retention mechanic, and it costs the player nothing they own.

Attuned artifacts draw an hourly **upkeep** against production, so what you can
wear is gated by the Mana economy you have built rather than by a paywall. Net
production floors at zero: you can stall, never go bankrupt.

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

All of it, as of 2026-09-02, in the order `engine-seams.md` §8 prescribes: the
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

## What is still open

Region control and domination, guild and social play, a second region, and the
art for the newest content — the buildings, sites, relics and heroes added in
this pass render as their fallback glyphs until their sheets land
(`tests/icons.test.ts` names exactly which, and refuses to let the list rot).
