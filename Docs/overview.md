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
  Townhall, then pushing past its borders into a world shared with **41 other
  kingdoms**.
- **The twist is exploration.** The player **buys back the map from the fog**,
  one tap at a time; builds districts whose workers harvest; grows a population
  that pays rent; and drives out the monsters camped in it.
- Costs scale with distance and ambition.
- The starter city is **Oakville**.
- **Played in visits, not sittings**: roughly half an hour a day across two or
  three check-ins. Every system is sized to that budget.
- **It looks like a diorama**: a stylized-3D isometric city under a bright
  midday sun, and a hex world map in the same hand
  ([`art/style-prompt.md`](art/style-prompt.md)).

## The fantasies

> **The player feels they are winning back a kingdom the fog swallowed, never
> sure what the next cell holds.**

- **The column is the treasure hunt**, and its verb is the paid fog: a tap on
  a fogged cell, five to a reveal.
- **Three layers, one job each:**

| Fantasy | Its job | Felt when |
|---|---|---|
| **Accumulation** | come back tomorrow | the stores' bubbles and a full Mana well after a night away |
| **Collection** | keep playing for weeks | the relic one fragment short of whole; the next of thirty-two heroes |
| **Power, against the world** | the reason to pay | a Legendary hero takes the room the party lost |

- **The framing is the monarch who came home** — *Your Majesty — you came!* —
  and a kingdom put right, in Isolde's voice
  ([`features/23-tutorials.md`](features/23-tutorials.md) §3). It is the
  column's voice, not a layer.
- **Nothing else is declared as a fantasy.** Optimisation (adjacency,
  workshops, Harmony), the raids and the world are mechanics serving the four
  above (**OQ-6**).
- **First session:** the column at the First Morning's first reveal, which
  sets a chest in the fog beside it (beats 1.1b–1.1c), and again at the old
  House found in the fog (4.1–4.3); accumulation at the first rent (7.1).
- **What is sold expresses the fantasies**: the column through **the
  Survey**, a ladder climbed by cells revealed with a paid column
  ([`features/25-the-survey.md`](features/25-the-survey.md)); the layers
  through hero keys at published odds, the relic fragment pack, and Gems and
  Bag bundles ([`features/14-monetization.md`](features/14-monetization.md) §2).
- **Playtest:** the sentence a player should describe the game with —
  *"I'm finding what the fog took from my kingdom."* How a session checks it
  is [`playtest.md`](playtest.md).

## The three promises

1. **Your city can never be attacked or lost. Everything outside it can be.**
   - No player reaches the province.
   - The only thing that takes from it is a lair you have found and left
     standing: three raids a day, each taking at most half of what sits
     uncollected in the buildings' stores, never the wallet. What it carried,
     up to a day of raids, is handed back when you clear it.
   - No decay, no starvation, no failure state.
   - Your city's hex on the world map can never be attacked.
   - **Everything else on the world map can be taken.** A conquered hex
     changes hands with the district on it and its store; a denied hex is
     emptied. A relic in a lost Chapel goes back to the Bag.
2. **The best-managed economy wins.** Combat is a sink for the economy, not a
   test of reflexes. The battle screen is where a fight is **composed**, never
   played: the party is chosen, the numbers are shown, and the outcome is
   decided the moment the player commits. Against the world's own garrisons a
   well-prepared party never fails; against another player's, preparation is
   what you can control and the rest is their preparation.
3. **Wallets buy power, comfort and breadth — but never exclusivity.**
   Nothing is purchase-only that cannot also be earned. Every paid ladder is
   earned first — Knowledge drips before Gold or Gems can buy more.

## The core loop

1. **Reveal** — spend Gold to peel back the fog. The price rises with distance
   from the Townhall and with the cells already revealed; the Townhall level
   sets how far the fog can be bought. **The frontier stays connected.**
   Mountains, landmarks, lairs and ruins are sighted as silhouettes beyond it.
   What the fog kept comes out: **treasures** to pick up, and **abandoned
   buildings** to repair.
2. **Clear** — revealing a lair's ground starts its counter: clear it with
   soldiers, and heroes if you have them, before it raids the city.
3. **Harvest** — tap resource cells directly. Every tap on the ground spends
   **1 Mana**. Forests and crops run out and recover in place; berries, game
   and shoals are used up and grow back on another cell; mountains never run
   out.
4. **Build** — repair what the fog kept, then place districts on revealed
   land, and plant trees and crops where they are wanted. Costs are charged up
   front; construction takes time and runs while the player is away.
5. **Grow** — train villagers at the Townhall. Housed villagers pay rent, the
   idle backbone of the economy.
6. **Staff** — assign workers. They are units that walk to cells inside their
   building's area of influence, harvest, and carry back.
7. **Collect** — what a building makes waits in its store, under a bubble. A
   tap collects it, free. A full store stops the building.
8. **Reinvest** — upgrade districts and research technologies.
9. **Fight** — clear the lairs; on the world board, claim and take ground,
   beat the monster camps, delve the dungeons and climb the Portal.
10. **Empower** — restore and level relics from their fragments, level and
    ascend heroes, and spend Mana.

## The fog

Paid fog is the mechanic the game is built around. What it keeps:

| Found in the fog | Gives |
|---|---|
| **Resources** — forest, berries, game, shoals, mountains (plain, iron, gold) | the raw materials |
| **Treasures** — one every five paid reveals, in a cell that reveal uncovered | a coin, picked up with a free tap; every 4th also a Bag item, every 6th a city relic fragment |
| **Abandoned buildings** — the village the fog swallowed, seen first as silhouettes of their ruins | a House, plots, a Farm, a Sawmill, the Watchtower, the Thorned Shrine… repaired before the player can build their own |
| **Landmarks** — standing stones, leysprings, the repaired Watchtower | **+10 max Mana**, permanently, and a lump of Knowledge |
| **Lairs** — monster camps that hold the ground around them | the first job for the army: clear them, or they raid |

- Landmarks compound: a bigger Mana pool is a bigger session and a bigger ad
  reward, because the ad reward is a whole pool.

> explore → a bigger pool → a bigger ad → more taps → explore further

- **A lair holds its ground**: while it stands, nothing in its zone can be
  tapped, built on or harvested.
- **Revealing its ground starts a counter** measured in minutes. When it runs
  out the lair raids the city three times a day, inside local daytime, and
  takes a bounded slice of what waits uncollected in the stores, returned
  when the lair is cleared.
- A lair is a path of three to seven fights. A cleared lair is gone for good.
  **Defend your village** is the doorway to combat
  ([`features/18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md)).

**Full design:** [`features/01-map-and-fog.md`](features/01-map-and-fog.md).

## The economy

> **The city runs on Gold, Food, Wood and Stone. Mana is what magic and
> fights cost. Gems are the premium coin. Knowledge fills a bar, and research
> is paid in it.**

- **Nine wallet rows** — Gold, Food, Wood, Stone, Mana, Knowledge, Stardust,
  Hero XP, Gems. Five on the plank, three of them for the whole first hour.
- A cell's identity and the coin it pays are different things: berry bushes,
  wild game and fish shoals all pay **Food**; an iron mountain pays **Stone**,
  a gold mountain **Gold**.
- **Refined goods** — Planks, Cut Stone, Iron, Runestone — are made in
  workshops and counted apart from the wallet. Later building levels and
  research ask for them, and the late city also asks for the world's
  **precious materials**.
- **The Bag** holds items: speed-ups, resource chests, boosts, flasks, tomes
  and keys.
- **Harmony**: decorations raise the city's tax rate.
- Flows:
  - housing rent → the house's store → a collect → Gold → fog, buildings and
    research
  - harvest → the building's store → a collect → materials → buildings
  - Mana → taps on the ground, a city relic's activation, every fight, the
    world spells
  - time, lumps, Gold, Gems → Knowledge → research
  - fog, lairs, quests, research chapters, the world, the store → relic
    fragments → relics
  - dungeons, quests, hero calls → Stardust → relic levels and hero ascension

**Full design:** [`features/03-economy.md`](features/03-economy.md).

## Mana

- **Mana is what magic and fighting cost.** In the city, a tap on the ground
  is a small spell and a city relic is activated with it. Collecting a
  building is free. **Every fight costs Mana**, win or lose — a lair, a camp,
  a rival, a dungeon room, a Portal floor.
- Capped; what the drip brings over the cap is lost. A refill — an ad, or
  Gems — lands a whole pool on top of what is there.
- It refills whether or not the player is playing.
- A new kingdom starts full.
- The pool fills in about a night at every stage, so the pool can run out.
- **Nothing draws against it but the player.** Relics carry no upkeep.

**Full design:** [`features/08-magic.md`](features/08-magic.md).

## The tree and the books

> **One tree every kingdom reads, and books found by play.**

- Research is a page of technologies; a technology opens a mechanic, a
  building, a unit or a number. **Knowledge is poured into it** until it is
  full, then it is completed on the spot — Gold, and later materials, refined
  goods or precious materials. There is no research time and no queue.
- **Knowledge fills a bar, 1 an hour up to 10**, and the drip stops while the
  bar is full. Landmarks, lairs, quests and dungeons pay it in lumps that land
  over the cap. More can be bought with Gold, dearer with every point ever
  bought, or with Gems.
- **The Kingdom tree** is read in nine chapters, one per Townhall step,
  mixing the city, the army and the world. A chapter opens on revealed cells
  and ends in a finale that opens the next Townhall level; finishing a
  chapter whole pays relic fragments
  ([`features/07-research.md`](features/07-research.md) §2.1).
- **Found books are found, not bought** — the Sagas when a Tavern stands, the
  Atlas when the Watchtower is repaired. A found book is narrow and deep: it
  does one thing the tree does not.
- Two kingdoms differ by the order they read in.

**Full design:** [`features/07-research.md`](features/07-research.md).

## Relics

- A relic is **one effect, one number, no ceiling**. There are eight: four
  city relics and four world relics.
- **A relic is six fragments** — five pieces and a keystone. Six distinct
  fragments restore it at level 1; every level after takes a full set again,
  and Stardust.
- **Fragments are found.** A relic's first fragment comes from its door — a
  lair for a city relic, a world source for a world one. After that they come
  from fog treasures, lairs, quests, research chapters, dungeons, the Portal,
  scouting, and the store's fragment pack.
- **A relic works only where it is hosted.** A city relic sits in a Shrine
  and acts inside its aura for a window opened with Mana; a world relic acts
  while a Chapel on a world district holds it. An unhosted relic waits in the
  Bag.
- **Found fragments can be traded** between friends; bought ones are bound.
- Nothing expires.

> **A relic is never lost. It is a number the kingdom has earned.**

**Full design:** [`features/09-relics.md`](features/09-relics.md).

## Heroes

- **Thirty-two heroes**, called on banners with keys at published odds. The
  Tavern opens them.
- A hero levels on **Hero XP** and ascends on its own **Fragments and
  Stardust**, and fights in a hero slot.

**Full design:** [`features/10-heroes.md`](features/10-heroes.md).

## Lairs and dungeons

- A **lair** is a monster camp in the province: a path of fights — three to
  seven — with a clock on it: clear it or it raids the city. Its last fight
  beats it, and cleared, it is gone
  ([`features/18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md)).
- A lair is fought by **soldiers**; heroes are optional. A world army needs a
  hero.
- A **dungeon** stands on the world board: three depths of eight rooms, a
  boss at the end of every depth. An army camps at it and takes the rooms one
  at a time, in order. **The first player to beat the last boss closes it for
  everyone**, and a new dungeon rises elsewhere hours later
  ([`features/19-world-map.md`](features/19-world-map.md) §8.1).
- **The fight resolves the instant it is entered.** A room pays the moment it
  falls.
- **A fight costs Mana and soldiers, win or lose.** Of the fallen, a tenth
  come home **wounded** to the Infirmary's beds and are healed for a share of
  what recruiting them would cost; the rest die. **Heroes lose HP**, which
  mends over hours, and a hero at zero cannot be sent until whole.

> **Enter the room, or go and train?**

- Combat is a **deterministic tick auto-battler**: six troop slots and three
  hero slots a side, units with ATK/DMG/DEF/HP, and a type chart that rewards
  composition. The screen replays the log
  ([`features/combat.md`](features/combat.md)).
- In a dungeon the camped army's losses carry from room to room.

**Full design:** [`features/11-expeditions.md`](features/11-expeditions.md).

## Progression

Four arcs run at different speeds.

| Arc | Gated by | Measured in |
|---|---|---|
| **The city** | the Townhall level — how many of each district, how high, how far the fog can be bought | hours |
| **The army** | six military buildings — four training halls, the Infirmary, the War Camp — and a technology for every unit and rank | hours to days |
| **The collection** — relics and heroes | relic fragments and Stardust; hero Fragments and Hero XP | **weeks** |
| **The world** — ground claimed and held | the army, explorers and the Atlas | days to weeks |

## The two scales, and the road between them

The game is played at two scales, and they are deliberately not the same game.

| | **Your province** | **The world** |
|---|---|---|
| Shape | authored square grid, identical for every player | seven hex boards of six seats, 889 hexes, seen as one board |
| Who else is there | nobody | 41 other kingdoms — players, or stand-in rivals until a player takes the seat |
| Authority | client | **server**, but for the fog |
| The verb | **you tap** | **you send** |
| Exploring costs | Gold and a thumb, resolved instantly | an explorer who marches, Gold per trip, and the time the march takes |
| Tempo | active, minutes | idle, hours |
| What it can take from you | nothing | ground, and what stands on it |
| It ends | yes — 1,470 cells and the fog is bought out | no |

- **On the world** a player claims districts that produce into stores of
  their own, takes rivals' hexes or denies them, beats monster camps that
  otherwise raid, delves dungeons, and holds Sanctuaries (max Mana),
  Observatories (Knowledge) and precious deposits. The **Dark Portal** opens
  every week for one ranking across the world.
- **Temporary provinces** are designed but not built: event maps that borrow
  the province's verbs inside a window
  ([`features/13-events.md`](features/13-events.md) §2.3).

> **Your city can never be attacked. Everything outside it can be.**

### The road between them

The province is not a tutorial the player leaves behind — it is the engine that
supplies the world.

1. **The province teaches.** Fog, harvest, building and the first fights are all
   learned alone, with nothing at stake and nobody watching.
2. **The province arms.** Its army, its heroes and its research are what the
   player brings out; the repaired Watchtower opens the world and the Atlas.
3. **The world tests.** An explorer marches out, ground is claimed, and what the
   player built at home is what they bring.
4. **The world feeds the province.** Districts on held hexes fill stores the
   player collects, and the late city's prices need the world's precious
   materials.

**Full design:** [`features/02-map-scopes.md`](features/02-map-scopes.md),
[`features/19-world-map.md`](features/19-world-map.md).

## The rules that govern every new number

> **A tap hands you 10 seconds of work on the thing you tapped**,
> floored at one unit.

- **A new reward in the city's materials is a duration** of the player's own
  production, never an absolute amount. Gems, Knowledge, Stardust, Hero XP
  and items are flat.
- A tap is priced against **the ground and the thumb, never against the
  payroll** ([`features/04-harvest.md`](features/04-harvest.md)).

> **There is no offline cap. What the kingdom makes while you are away is
> bounded by what it can hold.**

- An absence is replayed in full.
- Production stops at its own ceiling: each building's store, in the province
  and on the world, the Mana pool, the Knowledge bar, the workshop and
  training queues.
- Timers — the build queue, a lair's raid, event windows — resolve in full.
- Anything new that is time-based and produces names its ceiling in its doc.

## What the prototype is for

**Kingdom is a disposable web prototype.** It exists to answer questions, not to
be shipped.

- **No real purchases, ever.** Monetisation is *simulated and instrumented*:
  nothing charges, everything is recorded. Reading rule: **an intent is not a
  conversion.**
- **The city stays client-authoritative.** The world board, the social layer
  and the telemetry are the server's.
- **Out of scope:** CPI, IPM, real cohorted D30, measured ARPDAU.

The four questions it answers:

1. **Does the loop hold for thirty days?** On day 14, is there still something
   to want that nobody had to author by hand?
2. **Where would people pay?** Which surfaces have demand, not how much.
3. **Is there a demo that carries the thesis?** The paid fog is filmable.
4. **Does the fantasy land?** A tester describes the game in the fantasy's
   words, not the mechanic's ([`playtest.md`](playtest.md)).

## Where to read next

- **[`README.md`](README.md)** — the index, and the full feature list.
- **[`open-questions.md`](open-questions.md)** — every decision still to make,
  and every soft spot in the design.
- **[`implementation-plan.md`](implementation-plan.md)** — what is built, what is
  not, and what design has to answer before the next thing can start.
