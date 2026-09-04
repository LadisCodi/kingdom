# Kingdom — the game in five minutes

> **What this is.** The concept, the loops and the promises, at the altitude
> needed to understand what the game *is* before reading how any of it works.
> Every claim here is expanded in a feature doc; nothing here is the source of
> truth for a number.

## The pitch

- Kingdom is a cozy **city-builder / idle-management** game on a fog-shrouded
  fantasy map, built for the web.
- The player is a **wizard-monarch** growing a city outward from a single
  Townhall.
- The player **buys back the map from the fog**, one tap at a time; builds
  districts whose workers harvest; grows a population that pays taxes; and
  recovers the magic buried in ruins.
- Costs scale with distance and ambition.
- The starter city is **Oakville**, in the province of **Region_01**.
- **Played in visits, not sittings**: roughly half an hour a day across two or
  three check-ins. Every system is sized to that budget.

## The three promises

1. **Nothing you own is ever taken from you.** No raids, no decay, no
   starvation, no failure state. Pressure comes from **opportunity that
   expires** — a Mana pool that overflows, an event window that closes, a haul
   the player chose to risk — never from loss of property.
2. **The best-managed economy wins.** Combat is a sink for the economy, not a
   test of reflexes. There is no battle screen. A well-prepared expedition
   never fails.
3. **Wallets buy comfort and breadth; play buys everything else.** Nothing is
   purchase-only that cannot also be earned. Every paid ladder is earned first
   — research grants a slot before Gems can buy one.

## The core loop

1. **Reveal** — spend Gold to peel back the fog. Cost scales steeply with
   distance from the Townhall. **The frontier stays connected**, and a building
   sees further than it can buy.
2. **Harvest** — tap resource cells directly. Every tap spends **1 Mana**. Cells
   exhaust after a number of taps and recover on a timer.
3. **Build** — place districts on revealed land. Costs are charged up front;
   construction takes time and runs while the player is away.
4. **Grow** — train villagers at the Townhall. Housed villagers pay taxes, the
   idle backbone of the economy.
5. **Staff** — assign workers. They are units that walk to cells inside their
   building's area of influence, harvest, and carry back.
6. **Reinvest** — upgrade districts, research technologies, buy upgrades.
7. **Delve** — send a hero and a party into an uncovered ruin, and decide at
   every checkpoint whether to go deeper or bank the haul.
8. **Empower** — attune the relics they bring back, and spend Mana on magic.

## The fog

Paid fog is the mechanic the game is built around. It pays back three ways:

| Found in the fog | Gives |
|---|---|
| **Resources** — forest, berries, game, rocks, shoals, iron | the raw materials |
| **Landmarks** — shrines, standing stones, leysprings | **+10 max Mana**, permanently |
| **Ruins** | dungeons to delve — relics, ingredients, Stardust |

- Landmarks compound: a bigger Mana pool is a bigger session and a bigger ad
  reward, because the ad reward is a whole pool.

> explore → a bigger pool → a bigger ad → more taps → explore further

- Ruins are a non-repeating reward at the end of the fog's cost curve, and a
  place the player returns to.

**Full design:** [`features/01-map-and-fog.md`](features/01-map-and-fog.md).

## The economy

> **The city runs on Gold, Food, Wood and Stone. Mana is what magic costs.
> Stardust comes out of dungeons. Knowledge is a clock that paces research.**

- Eight wallet rows; **five on the plank, three of them for the whole first
  hour**.
- A cell's identity and the coin it pays are different things: berry bushes,
  wild game and fish shoals all pay **Food** (1, 3 and 2 a tap); an iron vein
  is a **Stone** node at 3.
- Flows:
  - housing taxes → Gold → fog, buildings and research
  - harvest → materials → buildings
  - Mana → magic
  - delves → relics and Stardust → a stronger collection

**Full design:** [`features/03-economy.md`](features/03-economy.md).

## Mana

- **Mana is what magic costs, wherever you are.** In the city it hurries
  production — a tap is a small spell. On the world map it bends an expedition
  or shortens a siege.
- The only capped currency. It refills whether or not the player is playing.
- A new kingdom starts full.
- The pool fills in 10 hours at every stage — past the 8-hour offline cap, so
  the pool can run out.
- **Nothing draws against it but the player.** Relics carry no upkeep.
- Unspent potential is lost, never property.

**Full design:** [`features/08-magic.md`](features/08-magic.md).

## Relics

- Relics are won from ruins.
- Each grants a **passive** while attuned to the kingdom, and nothing else.
- One attunement slot to start; a second from research; the rest cost Gems.
- **Spells are a separate thing, in the Magic tome**: discovered as a research
  node, improved by the upgrades under it, castable for Mana from then on.
  **A relic is what you wear; a spell is what you know**
  ([`features/07-research.md`](features/07-research.md) §6).

> **A relic is attuned to the kingdom, or carried by a hero into a delve. Never
> both.**

- Example: wear the Foreman's Sigil for +1 worker yield, or send it down to
  reach depth 6.
- Unlocking and levelling a relic needs a **nine-piece ingredient set** with
  1★/2★/3★ rarities from three different sources.

**Full design:** [`features/09-relics.md`](features/09-relics.md).

## Expeditions

- A ruin is a **repeatable dungeon**.
- The party is **one hero** (mandatory) plus units; supplies are paid up front.
- The party clears one **depth** at a time. At every checkpoint:

> **Go deeper, or come back with what you're carrying?**

- Failing costs half the haul and ends the run. The haul is not owned until
  extracted (promise 1).
- Combat is a **scoring pass, not a simulation**: units have ATK/DEF/HP, each
  dungeon has a threat type, and a matchup chart rewards composition. **There is
  no battle screen.**
- Party HP does not recover between depths.
- The player's economy decides how deep the party goes safely; everything past
  that is a risk opted into on information the player chose not to wait for.

**Full design:** [`features/11-expeditions.md`](features/11-expeditions.md).

## Progression

Three arcs run at different speeds.

| Arc | Gated by | Measured in |
|---|---|---|
| **The city** | the Townhall level — how many of each district, and how high | hours |
| **The army, and therefore delve depth** | four military buildings the player chooses to build | hours to days |
| **The collection** — relics and heroes | ingredients and Stardust | **weeks** |

## The three scopes of the map

| Layer | What it is | Verb |
|---|---|---|
| **Your province** | authored, identical for every player, **bounded** | **tapped** |
| **Temporary provinces** | event maps inside a window — the event format | tapped |
| **The world map** | a shared hex lattice, outposts not cities | **sent to** |

> **Your village can never be attacked. Everything outside it can be contested.**

**Full design:** [`features/02-map-scopes.md`](features/02-map-scopes.md).

## The rules that govern every new number

> **A tap hands you 10 seconds of work on the thing you tapped**,
> floored at one unit.

- A full Mana pool buys about the same slice of progress at every stage — about
  five and a half minutes of production, early and late.
- **Every authored reward follows it.** Rewards are durations of the player's
  own production, never absolute amounts.
- A tap is priced against **the ground and the thumb, never against the
  payroll** ([`features/04-harvest.md`](features/04-harvest.md)).

> **The offline cap limits what the city PRODUCES while you are away. It never
> limits what a TIMER does.**

- Production — workers, taxes, Mana regen — stops at 8 hours.
- Timers — the build queue, research, delve depths, event windows — resolve in
  full.
- Anything new that is time-based is classified as one or the other in its doc.

## What the prototype is for

**Kingdom is a disposable web prototype.** It exists to answer questions, not to
be shipped.

- **No real purchases, ever.** Monetisation is *simulated and instrumented*:
  nothing charges, everything is recorded. Reading rule: **an intent is not a
  conversion.**
- **The city stays client-authoritative.** The sim can run on a server; server
  authority is for the social layer and the telemetry.
- **Out of scope:** CPI, IPM, real cohorted D30, measured ARPDAU.

The three questions it answers:

1. **Does the loop hold for thirty days?** On day 14, is there still something
   to want that nobody had to author by hand?
2. **Where would people pay?** Which surfaces have demand, not how much.
3. **Is there a demo that carries the thesis?** The paid fog is filmable.

## Where to read next

- **[`README.md`](README.md)** — the index, and the full feature list.
- **[`open-questions.md`](open-questions.md)** — every decision still to make,
  and every soft spot in the design.
- **[`implementation-plan.md`](implementation-plan.md)** — what is built, what is
  not, and what design has to answer before the next thing can start.
