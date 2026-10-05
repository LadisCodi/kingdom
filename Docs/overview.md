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
  that pays rent; and drives out the monsters camped in it.
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

## The fantasies

> **The player feels they are winning back a kingdom the fog swallowed, never
> sure what the next cell holds.**

- **The column is the treasure hunt**, and its verb is the paid fog: a tap on
  a fogged cell, five to a reveal.
- **Three layers, one job each:**

| Fantasy | Its job | Felt when |
|---|---|---|
| **Accumulation** | come back tomorrow | the stores' bubbles and a full Mana well after a night away |
| **Collection** | keep playing for weeks | the card missing from a 28-day album; the next of thirty-two heroes |
| **Power, against the world** | the reason to pay | a Legendary hero takes the room the party lost |

- **The framing is the monarch who came home** — *Your Majesty — you came!* —
  and a kingdom put right, in Isolde's voice
  ([`features/23-tutorials.md`](features/23-tutorials.md) §3). It is the
  column's voice, not a layer.
- **Nothing else is declared as a fantasy.** Optimisation (adjacency,
  workshops, Harmony), the raids, the Wonders, the guild and the world are
  mechanics serving the four above (**OQ-6**).
- **First session:** the column at the First Morning's first reveal, which
  sets a chest in the fog beside it (beats 1.1b–1.1c), and again at the old House found in the fog
  (4.1–4.3); accumulation at the first rent (7.1).
- **What is sold expresses the fantasies**: the column through **the
  Survey**, a ladder climbed by cells revealed with a paid column
  ([`features/25-the-survey.md`](features/25-the-survey.md)); the layers
  through keys and card packs, at published odds
  ([`features/14-monetization.md`](features/14-monetization.md) §2).
- **Playtest:** the sentence a player should describe the game with —
  *"I'm finding what the fog took from my kingdom."* How a session checks it
  is [`playtest.md`](playtest.md).

## The three promises

1. **Your city can never be attacked. Everything outside it can be.** The
   province is inviolable: no player reaches it, and the only thing that ever
   takes from it is a lair you have found and left standing — three raids a
   day, at most half of what sits uncollected in the buildings' stores each —
   never the wallet — and what it carries, up to a day of raids, handed back
   when you clear it. No decay, no starvation, no failure state. **What a player can
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
   earned first — Knowledge drips before Gold or Gems can buy more.

## The core loop

1. **Reveal** — spend Gold to peel back the fog. Cost scales steeply with
   distance from the Townhall. **The frontier stays connected**, and a building
   sees further than it can buy. What the fog kept comes out: **treasures** to
   pick up, and **abandoned buildings** to repair.
2. **Clear** — discovering a lair starts its counter: clear it with a hero
   and troops before it raids the city.
3. **Harvest** — tap resource cells directly. Every tap on the ground spends
   **1 Mana**. Cells exhaust after a number of taps and recover on a timer.
4. **Build** — repair what the fog kept, then place districts on revealed
   land. Costs are charged up front; construction takes time and runs while
   the player is away.
5. **Grow** — train villagers at the Townhall. Housed villagers pay rent, the
   idle backbone of the economy.
6. **Staff** — assign workers. They are units that walk to cells inside their
   building's area of influence, harvest, and carry back.
7. **Collect** — what a building makes waits in its store, under a bubble. A
   tap collects it, free. A full store stops the building.
8. **Reinvest** — upgrade districts, research technologies, buy upgrades.
9. **Fight** — clear the lairs with a hero and a party; on the world board,
   take a dungeon's rooms one at a time.
10. **Empower** — fill the albums that level the relics, and spend Mana on magic.

## The fog

Paid fog is the mechanic the game is built around. It pays back three ways:

| Found in the fog | Gives |
|---|---|
| **Resources** — forest, berries, game, rocks, shoals, iron | the raw materials |
| **Treasures** — one every five cells revealed, a chest in the fog beside the last | a coin, picked up with a free tap once its cell is revealed |
| **Abandoned buildings** — the village the fog swallowed, seen first as silhouettes of their ruins | a House, plots, a Farm, a Sawmill… repaired before the player can build their own |
| **Landmarks** — shrines, standing stones, leysprings | **+10 max Mana**, permanently |
| **Lairs** — monster camps that hold the ground around them | the first job for the army: clear them, or they raid |

- Landmarks compound: a bigger Mana pool is a bigger session and a bigger ad
  reward, because the ad reward is a whole pool.

> explore → a bigger pool → a bigger ad → more taps → explore further

- Every lair is held by a garrison. Discovering one starts a counter measured
  in minutes; when it runs out the garrison raids the city, three times a day,
  and takes a bounded slice of what waits uncollected in the buildings'
  stores, returned when the lair is cleared. A cleared lair is gone for good. **Defend your village** is the doorway to combat
  ([`features/18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md)).

**Full design:** [`features/01-map-and-fog.md`](features/01-map-and-fog.md).

## The economy

> **The city runs on Gold, Food, Wood and Stone. Mana is what magic costs.
> Stardust comes out of dungeons. Knowledge fills a bar, and research is paid
> in it.**

- Eleven wallet rows; **five on the plank, three of them for the whole first
  hour**.
- A cell's identity and the coin it pays are different things: berry bushes,
  wild game and fish shoals all pay **Food** (1, 3 and 2 a tap); an iron vein
  is a **Stone** node at 3.
- Flows:
  - housing rent → the house's store → a collect → Gold → fog, buildings and
    research
  - harvest → the building's store → a collect → materials → buildings
  - Mana → magic
  - time, lumps, Gold, Gems → Knowledge → research
  - quests, the Survey, the pass, the Portal and the store → card packs →
    albums → relic levels

**Full design:** [`features/03-economy.md`](features/03-economy.md).

## Mana

- **Mana is what magic costs, wherever you are.** In the city it hurries
  production — a tap on the ground is a small spell. Collecting a building is
  free. On the world map it costs nothing.
- Capped, and what arrives over the cap is lost. It refills whether or not
  the player is playing.
- A new kingdom starts full.
- The pool fills in about a night at every stage, so the pool can run out.
- **Nothing draws against it but the player.** Relics carry no upkeep.
- Unspent potential is lost, never property.

**Full design:** [`features/08-magic.md`](features/08-magic.md).

## Magic and the books

> **A book is a choice about what kind of kingdom this is.**

- Research lives in **spellbooks**. A book is a page of technologies; a
  technology opens a mechanic, a building, a unit or a number. **Knowledge is
  poured into it** until it is full, then Gold completes it on the spot — there
  is no research time and no queue.
- **Knowledge fills a bar, 1 an hour up to 10**, and the drip stops while the
  bar is full. Landmarks, lairs, quests and dungeons pay it in lumps that land
  over the cap. More can be bought with Gold, dearer with every point ever
  bought, or with Gems.
- **One tree** every kingdom has, read in nine chapters — one per Townhall
  step — mixing the city, the army and the magic. A chapter opens on revealed
  cells and ends in a finale that opens the next Townhall level; finishing a
  chapter whole pays a card pack
  ([`features/07-research.md`](features/07-research.md) §2.1).
- **Found books are found, not bought** — the Sagas when a Tavern stands, the
  Atlas when the Watchtower is claimed. A found book is narrow and deep: it
  does one thing no general book does.
- **Personalisation comes from which books you own and in what order**, not from
  a renunciation. Nothing is locked away by choosing; two kingdoms differ
  because they found different books and studied them in a different order.
- **A place can pay a book**, and a book is the only reward that changes how
  the game is played rather than how fast.

**Full design:** [`features/07-research.md`](features/07-research.md).

## Relics and the collection

- A relic is a **permanent kingdom passive with no ceiling**: one effect, one
  number, rising with the relic's level. Every relic the player has is on.
- Relics are **levelled by a card collection**: a 28-day season on a shared
  calendar, **eight albums of nine cards**. The first season a
  relic's album is completed hands it over; every season after adds a level,
  so a relic rises at most once a season.
- Cards come in **packs** — from quests, the Survey, the pass, the Portal and
  the store — and an album pays a level, a chest of production hours, keys and
  Gems. Completing all eight pays the season hero and a pile of Gems.
- At the close the cards are wiped and the levels stay. A duplicate is free to
  give, which is what makes trading work.
- **The Magic tome does not cast.** An ability is a relic's active, cast from
  the relic that owns it ([`features/07-research.md`](features/07-research.md) §6).

> **A relic never drops, is never worn, and never goes anywhere. It is a
> number the kingdom has earned, season after season.**

**Full design:** [`features/09-relics.md`](features/09-relics.md).

## Lairs and dungeons

- A **lair** is a monster camp in the province: one garrison, one fight, with
  a clock on it — clear it or it raids the city. Cleared, it is gone
  ([`features/18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md)).
- A **dungeon** stands on the world board: numbered depths of rooms, a boss
  at the end of every depth. An army camps at it and takes the rooms one at a
  time, in order, never replayed
  ([`features/19-world-map.md`](features/19-world-map.md) §8.1).
- The party is **a hero** (mandatory) plus troops in the slots of the battle
  screen.
- **The fight resolves the instant it is entered.** A room pays the moment it
  falls.
- **A fight costs soldiers, win or lose.** Most of the fallen are dead; a
  tenth come home **wounded** and wait in the Infirmary until the player pays
  a fraction of what recruiting them would cost, and research and medic heroes
  buy that share upward. A fight that beats the party takes nothing else the
  player has banked, and it is still there to try again.

> **Enter the room, or go and train?**

- Combat is a **deterministic tick auto-battler**: six troop slots and three
  hero slots a side, units with DMG/DEF/HP, and a type chart that rewards
  composition. It resolves the instant the room is entered and the screen
  replays the log ([`features/combat.md`](features/combat.md)).
- In a dungeon the camped army's losses and its heroes' wounds carry from
  room to room.

**Full design:** [`features/11-expeditions.md`](features/11-expeditions.md).

## Progression

Four arcs run at different speeds.

| Arc | Gated by | Measured in |
|---|---|---|
| **The city** | the Townhall level — how many of each district, and how high | hours |
| **The army** — lairs cleared | four military buildings the player chooses to build | hours to days |
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
2. **The province arms.** Its lairs, landmarks and buildings open the
   **spellbooks** that decide what kind of kingdom this is.
3. **The world tests.** An explorer marches out, ground is claimed, and what the
   player built at home is what they bring.
4. **The world feeds the province.** Held hexes produce into the city that holds
   them, so the two scales are one economy and not two.

**Full design:** [`features/02-map-scopes.md`](features/02-map-scopes.md),
[`features/19-world-map.md`](features/19-world-map.md).

## The rules that govern every new number

> **A tap hands you 10 seconds of work on the thing you tapped**,
> floored at one unit.

- A full Mana pool buys about the same slice of progress at every stage — about
  five and a half minutes of production, early and late.
- **Every authored reward follows it.** Rewards are durations of the player's
  own production, never absolute amounts.
- A tap is priced against **the ground and the thumb, never against the
  payroll** ([`features/04-harvest.md`](features/04-harvest.md)).

> **There is no offline cap. What the city makes while you are away is bounded
> by what it can hold.**

- An absence is replayed in full.
- Production stops at its own ceiling: each building's store, the Mana pool,
  the Knowledge bar, the workshop and training queues.
- Timers — the build queue, a lair's raid, event windows — resolve in full.
- Anything new that is time-based and produces names its ceiling in its doc.

## What the prototype is for

**Kingdom is a disposable web prototype.** It exists to answer questions, not to
be shipped.

- **No real purchases, ever.** Monetisation is *simulated and instrumented*:
  nothing charges, everything is recorded. Reading rule: **an intent is not a
  conversion.**
- **The city stays client-authoritative.** The sim can run on a server; server
  authority is for the social layer and the telemetry.
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
