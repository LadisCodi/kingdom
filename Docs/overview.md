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

1. **No other player can ever touch your city.** The only thing that ever
   takes from you is a garrison you have seen and left standing — three raids
   per camp at most, a tenth of the purse each, and handed back in full when
   you clear it. No decay, no starvation, no failure state. Every other
   pressure is **opportunity that expires** — a Mana pool that overflows, an
   event window that closes, a garrison's clock running down.
2. **The best-managed economy wins.** Combat is a sink for the economy, not a
   test of reflexes. The battle screen is where a fight is **composed**, never
   played: the party is chosen, the numbers are shown, and the outcome is
   decided the moment the player commits. A well-prepared party never fails.
3. **Wallets buy power, comfort and breadth — but never exclusivity.**
   Nothing is purchase-only that cannot also be earned. Every paid ladder is
   earned first — research grants a slot before Gems can buy one.

## The core loop

1. **Reveal** — spend Gold to peel back the fog. Cost scales steeply with
   distance from the Townhall. **The frontier stays connected**, and a building
   sees further than it can buy.
2. **Clear** — every ruin opens with a gate, and discovering the ruin starts
   the gate's counter: clear it with hero and troops before it raids the city.
3. **Harvest** — tap resource cells directly. Every tap spends **1 Mana**. Cells
   exhaust after a number of taps and recover on a timer.
4. **Build** — place districts on revealed land. Costs are charged up front;
   construction takes time and runs while the player is away.
5. **Grow** — train villagers at the Townhall. Housed villagers pay taxes, the
   idle backbone of the economy.
6. **Staff** — assign workers. They are units that walk to cells inside their
   building's area of influence, harvest, and carry back.
7. **Reinvest** — upgrade districts, research technologies, buy upgrades.
8. **Fight** — clear the garrison at a ruin's gate, then take its rooms one at
   a time with a hero and a party.
9. **Empower** — fill the albums that level the relics, and spend Mana on magic.

## The fog

Paid fog is the mechanic the game is built around. It pays back three ways:

| Found in the fog | Gives |
|---|---|
| **Resources** — forest, berries, game, rocks, shoals, iron | the raw materials |
| **Landmarks** — shrines, standing stones, leysprings | **+10 max Mana**, permanently |
| **Ruins** | dungeons of rooms to clear — card packs, Stardust, hero fragments |
| **Garrisons** — on every landmark and ruin | the first job for the army: clear them, or they raid |

- Landmarks compound: a bigger Mana pool is a bigger session and a bigger ad
  reward, because the ad reward is a whole pool.

> explore → a bigger pool → a bigger ad → more taps → explore further

- Ruins are a non-repeating reward at the end of the fog's cost curve, and a
  place the player returns to.
- Every site is held by a garrison. Discovering one starts a counter measured
  in minutes; when it runs out the garrison raids the city and takes a bounded
  slice of the banked materials, at most three times, all of it returned when
  the garrison is cleared. **Defend your village** is the doorway to combat
  ([`features/18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md)).

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
  - rooms → card packs → albums → relic levels

**Full design:** [`features/03-economy.md`](features/03-economy.md).

## Mana

- **Mana is what magic costs, wherever you are.** In the city it hurries
  production — a tap is a small spell. On the world map it bends an expedition
  or shortens a march.
- The only capped currency. It refills whether or not the player is playing.
- A new kingdom starts full.
- The pool fills in 10 hours at every stage — past the 8-hour offline cap, so
  the pool can run out.
- **Nothing draws against it but the player.** Relics carry no upkeep.
- Unspent potential is lost, never property.

**Full design:** [`features/08-magic.md`](features/08-magic.md).

## Relics and the collection

- A relic is a **permanent kingdom passive with no ceiling**: one effect, one
  number, rising with the relic's level. Every relic the player has is on.
- Relics are **levelled by a card collection**: a 30-day season on a shared
  calendar, ten albums of nine cards, two albums per relic. The first album a
  relic ever completes hands it over; every album after adds a level.
- Cards come in **packs** — every ruin room pays one — and an album pays a
  level, a chest of production hours, keys and Gems. Completing all ten pays
  the season hero and a pile of Gems.
- At the close the cards are wiped and the levels stay. A duplicate is free to
  give, which is what makes trading work.
- **Spells are a separate thing, in the Magic tome**: discovered as a research
  node, improved by the upgrades under it, castable for Mana from then on.
  **A relic is what the kingdom has; a spell is what you know**
  ([`features/07-research.md`](features/07-research.md) §6).

> **A relic never drops, is never worn, and never goes anywhere. It is a
> number the kingdom has earned, season after season.**

**Full design:** [`features/09-relics.md`](features/09-relics.md).

## Ruins

- A ruin is a **ladder of rooms**: numbered depths, numbered rooms, a boss at
  the end of every depth. One room is one fight.
- A **garrison** stands at the gate before Depth 1, with a clock on it: clear
  it or it raids the city ([`features/18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md)).
- The party is **a hero** (mandatory) plus troops in the slots of the battle
  screen; supplies are paid on the way in.
- **The fight resolves the instant the room is entered.** There is nothing in
  flight, nothing to wait for and nothing to come back from.
- Rooms are cleared **in order and never replayed**. Clearing the last room of
  a depth opens the next one.
- **A room pays the moment it falls**, so nothing is ever carried and nothing
  can be lost on the way home.
- **A fight costs soldiers, win or lose.** Most of the fallen are dead; a
  tenth come home **wounded** and wait in the Infirmary until the player pays
  a fraction of what recruiting them would cost, and research and medic heroes
  buy that share upward. Supplies and bodies are
  the whole price of an attempt — a room that beats the party takes nothing
  else the player has banked, and it is still there to try again.

> **Enter the room, or go and train?**

- Combat is a **deterministic tick auto-battler**: six troop slots and three
  hero slots a side, units with DMG/DEF/HP, and a type chart that rewards
  composition. It resolves the instant the room is entered and the screen
  replays the log ([`features/combat.md`](features/combat.md)).
- Party HP does not carry between rooms.

**Full design:** [`features/11-expeditions.md`](features/11-expeditions.md).

## Progression

Three arcs run at different speeds.

| Arc | Gated by | Measured in |
|---|---|---|
| **The city** | the Townhall level — how many of each district, and how high | hours |
| **The army** — garrisons cleared, and therefore how deep the rooms go | four military buildings the player chooses to build | hours to days |
| **The collection** — relics and heroes | card albums on a 30-day shared season; Fragments and Hero XP | **weeks and seasons** |

## The three scopes of the map

| Layer | What it is | Verb |
|---|---|---|
| **Your province** | authored, identical for every player, **bounded** | **tapped** |
| **Temporary provinces** | event maps inside a window — the event format | tapped |
| **The world map** | a shared hex lattice, outposts not cities | **sent to** |

> **Your village can never be attacked by another player. Everything outside it
> can be contested.**

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
- Timers — the build queue, research, a gate's raid, event windows — resolve in
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
