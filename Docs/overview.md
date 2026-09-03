# Kingdom — the game in five minutes

> **What this is.** The concept, the loops and the promises, at the altitude you
> need to understand what the game *is* before reading how any of it works. Every
> claim here is expanded in a feature doc; nothing here is the source of truth
> for a number.

## The pitch

Kingdom is a cozy **city-builder / idle-management** game on a fog-shrouded
fantasy map, built for the web.

You are a **wizard-monarch** growing a city outward from a single Townhall. You
**buy back the map from the fog**, one tap at a time. You build districts whose
workers walk out and harvest for you. You grow a population that pays taxes. And
you recover the lost magic buried in the ruins out there.

Costs scale with distance and ambition, so play rewards thoughtful spatial and
economic planning. The starter city is **Oakville**, in the province of
**Region_01**.

**It is played in visits, not sittings.** Roughly half an hour a day across two
or three check-ins. Every system in the game is shaped by that budget — mid-core
PvE builders have the lowest session times in the whole competitive set, and
designing against that number rather than around it is the discipline the whole
design depends on.

## The three promises

**1. Nothing you own is ever taken from you.**
No raids, no decay, no starvation, no failure state. Pressure comes from
**opportunity that expires** — a Mana pool that overflows, an event window that
closes, a haul you chose to risk — never from loss of property.

**2. The best-managed economy wins.**
Combat is a sink for the economy, not a test of reflexes. There is no battle
screen. A well-prepared expedition never fails, and the thing you are really
competing on is how well you built.

**3. Wallets buy comfort and breadth; play buys everything else.**
Nothing is purchase-only that cannot also be earned. Every paid ladder is earned
first — research grants a slot before Gems can buy one.

These three sentences are load-bearing. Several designs in this repository exist
in the shape they do because a more obvious alternative would have broken one of
them, and each of those places says so.

## The core loop

1. **Reveal** — spend Gold to peel back the fog. Cost scales steeply with
   distance from the Townhall, so exploration is a deliberate, financed campaign.
   **The frontier stays connected**, and a building sees further than it can buy.
2. **Harvest** — tap resource cells directly. Every tap spends **1 Mana**. Cells
   exhaust after a number of taps and recover on a timer.
3. **Build** — place districts on revealed land. Costs are charged up front;
   construction takes time and runs while you are away.
4. **Grow** — train villagers at the Townhall. Housed villagers pay taxes, which
   is the idle backbone of the whole economy.
5. **Staff** — assign workers. They are units that walk to cells inside their
   building's area of influence, harvest, and carry back.
6. **Reinvest** — upgrade districts, research technologies, buy upgrades.
7. **Delve** — send a hero and a party into the ruins you uncovered, and decide
   at every checkpoint whether to go deeper or bank what you carry.
8. **Empower** — attune the relics they bring back, and spend Mana on the magic
   that makes the next loop cheaper.

## Why the fog is the point

Paid fog is the mechanic the game is built around and **the one thing nobody else
in the category does**. Which means it has to pay back three different ways or it
is a treadmill:

| Found in the fog | Gives |
|---|---|
| **Resources** — forest, berries, game, rocks, shoals, iron | the raw materials |
| **Landmarks** — shrines, standing stones, leysprings | **+10 max Mana**, permanently |
| **Ruins** | dungeons to delve — relics, ingredients, Stardust |

**Landmarks are what make exploration compound.** A bigger Mana pool is a bigger
session *and* a bigger ad, because the ad reward is a whole pool. So every shrine
claimed makes every future refill permanently larger, and the next stretch of fog
easier to clear:

> explore → a bigger pool → a bigger ad → more taps → explore further

**Ruins are what stop the fog from being a treadmill** — a non-repeating reward
at the end of an exponential cost curve, and a *place you can return to* rather
than a pickup you collect once.

**Full design:** [`features/01-map-and-fog.md`](features/01-map-and-fog.md).

## The economy

> **The city runs on Gold, Food, Wood and Stone. Mana is what magic costs.
> Stardust comes out of dungeons. Knowledge is a clock that paces research.**

Eight wallet rows, **five things on the plank, three of them for the whole first
hour** — and four city materials is the genre *ceiling*, not the floor.

A cell's identity and the coin it pays are two different things: berry bushes,
wild game and fish shoals all pay **Food** (1, 3 and 2 a tap), and an iron vein
is a rich **Stone** node at 3. The map keeps all of its texture; the purse stops
carrying a row per biome.

The everyday flow: **housing taxes → Gold → fog, buildings and research**;
**harvest → materials → buildings**; **Mana → magic**; **delves → relics and
Stardust → a stronger collection.**

**Full design:** [`features/03-economy.md`](features/03-economy.md).

## Mana, and why it is capped

**Mana is what magic costs, wherever you are.** In the city it hurries production
— a tap is a small spell. On the world map it will bend an expedition or shorten
a siege.

It is the only currency in the game with a cap, it refills whether you are
playing or not, and **a new kingdom starts full.** The pool fills in 10 hours at
every stage — deliberately past the 8-hour offline cap — because Mana is a
**spend** budget rather than an absence budget, and **a spend budget has to be
able to run out or a refill has nothing to sell.**

**Nothing draws against it but the player.** Relics used to charge hourly upkeep;
that was removed, because at Townhall 1 the full set drew exactly what the
Townhall made — so wearing everything stalled the pool dead.

A player who checks in two or three times a day wastes nothing. One who checks in
once a day wastes some. **You lose unspent potential, never property.**

**Full design:** [`features/08-magic.md`](features/08-magic.md).

## Relics, and the one rule the design turns on

Relics are won from ruins. Each grants a **passive** while attuned to the kingdom
and usually one **active** cast on the map for Mana. You start with a single
attunement slot; a second comes from research and the rest cost Gems.

> **A relic is attuned to the kingdom, or carried by a hero into a delve. Never
> both.**

That exclusivity is the decision everything else hangs off, and the question it
poses is never *which is cheaper* but **which do I need right now** — a standing
economic benefit at home, or a burst of power below. *Wear the Foreman's Sigil
for +1 worker yield, or send it down to reach depth 6?* **That single rule is
what welds the city half of the game to the delve half.**

Unlocking and levelling a relic will need a **nine-piece ingredient set** with
1★/2★/3★ rarities from three different sources — because nine named pieces are a
*set*, and you can see which one is missing.

**Full design:** [`features/09-relics.md`](features/09-relics.md).

## Expeditions

A ruin is a **repeatable dungeon**. Send **one hero** — mandatory — plus units,
pay supplies, and the party clears one **depth** at a time. At every checkpoint
it asks a single question:

> **Go deeper, or come back with what you're carrying?**

Failing costs half the haul and ends the run — **and the haul was never yours
until you extracted it**, which is what makes that legitimate under promise 1.

Combat is a **scoring pass, not a simulation**: units have ATK/DEF/HP, each
dungeon has a threat type, and a matchup chart rewards composition. **There is no
battle screen.** Party HP does not recover between depths, so danger rises
visibly the deeper you go — an *emergent* risk curve rather than an authored one.

And the gamble is **information, not dice**: your economy decides how deep you go
*safely*, and everything past that is a risk you opted into on information you
chose not to wait for.

**Full design:** [`features/11-expeditions.md`](features/11-expeditions.md).

## Progression, in one line

Three arcs run at different speeds, and the Townhall is no longer the only gate.

| Arc | Gated by | Measured in |
|---|---|---|
| **The city** | the Townhall level — how many of each district, and how high | hours |
| **The army, and therefore delve depth** | four military buildings you choose to build | hours to days |
| **The collection** — relics and heroes | ingredients and Stardust | **weeks** |

The third is the only one measured in weeks, which is why it matters
disproportionately to a game whose real question is *months active*.

## The three scopes the map becomes

The map today is one grid doing three jobs, and two of them contradict: a city
canvas wants to be **tight** so placement is a decision; an adventure space wants
to be **inexhaustible**. Measured, the whole map is 3.6 hours of end-game income,
and three maxed Sawmills field 21 workers for 17 forest cells.

So the map splits into three layers, each with its own verb:

| Layer | What it is | Verb |
|---|---|---|
| **Your province** | authored, identical for every player, **bounded** | **tapped** |
| **Temporary provinces** | event maps inside a window — the event format | tapped |
| **The world map** | a shared node graph, outposts not cities | **sent to** |

> **Your village can never be attacked. Everything outside it can be contested.**

That is a design rule, a technical boundary and a marketing line at once — and
Forge of Empires and Elvenar have run twelve and nine years of territorial PvP
without anybody ever losing a building in their city.

**Full design:** [`features/02-map-scopes.md`](features/02-map-scopes.md).

## The rules that govern every new number

Two of them, and they have earned their place by working:

> **A tap hands you 45 seconds of what the thing you tapped is producing**,
> floored at the authored yield.

That means a full Mana pool is worth the same *fraction* of progress at every
stage of the game, with nothing re-derived per era — 73 minutes of production
against one Sawmill, 97 against two, 120 against three. **Every reward we author
should follow it.** Absolute Gold amounts in a spreadsheet go stale on their own
by era three; a duration of the player's own production does not.

> **The offline cap limits what the city PRODUCES while you are away. It never
> limits what a TIMER does.**

Production — workers, taxes, Mana regen — stops at 8 hours. Timers — the build
queue, research, delve depths, event windows — resolve in full. When adding
anything time-based, decide which it is and say so.

## What the prototype is for

**Kingdom is a disposable web prototype.** It exists to answer questions, not to
be shipped. Three consequences:

- **No real purchases, ever.** Monetisation is *simulated and instrumented*:
  nothing charges, everything is recorded — with the reading rule attached,
  **an intent is not a conversion.**
- **The city stays client-authoritative.** The sim is written so it *could* run
  on a server, and that property is worth keeping. What gets server authority is
  the social layer and the telemetry, because those are where a lying client
  destroys the data rather than just its own save.
- **Some questions stay out of scope.** CPI, IPM, real cohorted D30, measured
  ARPDAU. Those need user acquisition, not a better prototype.

The three questions it *is* for:

1. **Does the loop hold for thirty days?** Not *is it fun* — **on day 14, is
   there still something to want that nobody had to author by hand?**
2. **Where would people pay?** Not *how much*. Which surfaces have demand.
3. **Is there a demo that carries the thesis?** The paid fog is filmable and
   nobody else has it.

## Where to read next

- **[`README.md`](README.md)** — the index, and the full feature list.
- **[`open-questions.md`](open-questions.md)** — every decision still to make,
  and every soft spot in the design.
- **[`implementation-plan.md`](implementation-plan.md)** — what is built, what is
  not, and what design has to answer before the next thing can start.
