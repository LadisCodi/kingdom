# Kingdom — the game in five minutes

> **What this is.** The concept, the loops and the promises, at the altitude
> needed to understand what the game *is* before reading how any of it works.
> Every claim here is expanded in a feature doc; nothing here is the source of
> truth for a number.

## The pitch

- Kingdom is a **4X for people who bounce off 4X** — the genre of Rise of
  Kingdoms and Kingshot on mobile, Civilization and Age of Wonders on PC, with
  the barrier to entry taken out.
- The player is a **wizard-monarch** growing a city outward from a single
  Townhall, then pushing past its borders into a world shared with other
  players.
- **The twist is exploration.** The player **buys back the map from the fog**,
  one tap at a time; builds districts whose workers harvest; grows a population
  that pays taxes; and recovers the magic buried in ruins.
- **Magic is how a kingdom becomes yours.** Spellbooks hold the research that
  opens mechanics, and which books you own is a choice the game does not make
  for you (§ *Magic and the books*).
- Costs scale with distance and ambition.
- The starter city is **Oakville**, in the province of **Region_01**.
- **Played in visits, not sittings**: roughly half an hour a day across two or
  three check-ins. Every system is sized to that budget.
- **It looks like a diorama**: a stylized-3D isometric city under a bright
  midday sun, and a hex world map in the same hand
  ([`art/style-prompt.md`](art/style-prompt.md)).

## The three promises

1. **Your city can never be attacked. Everything outside it can be.** The
   province is inviolable: no player reaches it, and the only thing that ever
   takes from it is a garrison you have seen and left standing — three raids
   per camp at most, a tenth of the purse each, and handed back in full when
   you clear it. No decay, no starvation, no failure state. **What a player can
   take from a player is territory** — a claimed hex on the world map, never a
   building, never a purse. Losing ground costs you what it was producing; it
   never costs you what you built.
2. **The best-managed economy wins.** Combat is a sink for the economy, not a
   test of reflexes. The battle screen is where a fight is **composed**, never
   played: the party is chosen, the numbers are shown, and the outcome is
   decided the moment the player commits. Against the world's own garrisons a
   well-prepared party never fails; against another player's, preparation is
   what you can control and the rest is their preparation.
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

## Magic and the books

> **A book is a choice about what kind of kingdom this is.**

- Research lives in **spellbooks**. A book is a page of technologies; a
  technology opens a mechanic, a building, a unit or a number, and **Knowledge
  is the clock** that paces it.
- **General books** are open from the start and every kingdom has them. They
  hold the spine of the game: the city, the army, the basic enchantments.
- **Specific books are found, not bought** — at the bottom of a ruin, out of an
  event, on the world map. A specific book is narrow and deep: it does one thing
  no general book does.
- **Personalisation comes from which books you own and in what order**, not from
  a renunciation. Nothing is locked away by choosing; two kingdoms differ
  because they found different books and studied them in a different order.
- This is what makes the province's ruins matter past their loot: **a ruin can
  pay a book**, and a book is the only reward that changes how the game is
  played rather than how fast.

**Full design:** [`features/07-research.md`](features/07-research.md).

## Relics and the collection

- A relic is a **permanent kingdom passive with no ceiling**: one effect, one
  number, rising with the relic's level. Every relic the player has is on.
- Relics are **levelled by a card collection**: a 28-day season on a shared
  calendar, **five albums of nine cards, one per relic**. The first season a
  relic's album is completed hands it over; every season after adds a level,
  so a relic rises at most once a season.
- Cards come in **packs** — every ruin room pays one — and an album pays a
  level, a chest of production hours, keys and Gems. Completing all five pays
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
| **The collection** — relics and heroes | card albums on a 28-day shared season; Fragments and Hero XP | **weeks and seasons** |
| **The world** — ground claimed and held | the army, and the books the province paid for | days to weeks |

## The two scales, and the road between them

The game is played at two scales, and they are deliberately not the same game.

| | **Your province** | **The world** |
|---|---|---|
| Shape | authored square grid, identical for every player | shared **hex lattice** |
| Who else is there | nobody | five other players |
| Authority | client | **server** for claims, client for fog |
| The verb | **you tap** | **you send** |
| Exploring costs | Gold and a thumb, resolved instantly | an explorer who marches, and the time the march takes |
| Tempo | active, minutes | idle, hours |
| What it can take from you | nothing you built | ground you claimed |
| It ends | yes — 1,470 cells and the fog is bought out | no |

**Temporary provinces** are a third, disposable scale: event maps that borrow
the province's verbs inside a window — the event format
([`features/13-events.md`](features/13-events.md) §2.3).

> **Your city can never be attacked. Everything outside it can be.**

### The road between them

The province is not a tutorial the player leaves behind — it is the engine that
supplies the world.

1. **The province teaches.** Fog, harvest, building and the first fights are all
   learned alone, with nothing at stake and nobody watching.
2. **The province arms.** Its ruins pay the card packs that level relics, and
   the **spellbooks** that decide what kind of kingdom this is.
3. **The world tests.** An explorer marches out, ground is claimed, and what the
   player built at home is what they bring.
4. **The world feeds the province.** Held hexes produce into the city that holds
   them, so the two scales are one economy and not two.

**Full design:** [`features/02-map-scopes.md`](features/02-map-scopes.md),
[`features/19-world-map.md`](features/19-world-map.md).

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
