# 19 · The world map — the shared board

> **Scope.** The hex board six players share: how it is shaped, how it is
> explored, how ground is claimed, held, lost and taken, what it produces, and
> the Dark Portal that opens on it every week. The province is
> [`01`](01-map-and-fog.md) and [`05`](05-city-and-districts.md); who is
> authoritative over what is [`02`](02-map-scopes.md); the resolver every
> fight goes through is [`combat.md`](combat.md).
>
> **Status: built against a local stand-in for the world server**:
> the fog and the explorers (§3); the chain and inactive hexes (§5.2–§5.3);
> armies, the War Camp, attacks, conquest and denial, Fortress garrisons
> (§4, §6); Dungeons (§8.1) and the Dark Portal (§10), which opens on
> Fridays (UTC) for three days, its numbers in `worldPortal`. Five stand-in
> rivals claim, build, man a Fortress and now and then attack on their own.
>
> **Designed, not yet built: the board of radius 6 (§1), one feature a hex
> (§2, §8, §9) and districts (§5.1, §7)** — today the board is radius 5,
> a hex holds up to two features, and a claim is an Outpost and then an
> improvement. The plan is [`../plans/world-districts.md`](../plans/world-districts.md).

## 1. The board

- **A pointy-top hex board, radius 6 from the centre: 127 hexes.**
- **Six players a board.** A seventh player opens a new instance; for the
  prototype that is enough.
- **A player joins the first board with a free city**, on its first free
  corner, assigned at random.
- Rings are roles, not decoration:

| Ring | Hexes | Its job |
|---|---|---|
| **0 — the centre** | 1 | The Dark Portal. Never owned, never built on, never fogged (§10) |
| **1 — the inner ring** | 6 | The richest ground on the board: **+200% to districts built on it** (§7) |
| **2–4 — the corridors** | 54 | The ground between a city and the centre. Nothing special, and unavoidable |
| **5 — the home ring** | 30 | The six city hexes, on its corners, and the ground between them |
| **6 — the outer ring** | 36 | Dungeons and Sanctuaries. Poor in production, rich in what production cannot buy |

- A city is **five hexes** from the centre and five from each neighbouring
  city: four hexes of ground lie between two neighbours.
- An inner-ring hex is four hexes from its nearest city and at most six from
  any.
- **The board is small on purpose.** There is nowhere to hide, every hex has a
  job, and conflict is a property of the geometry rather than a rule.

### 1.1 The hexagon

- **The hexagon is a unit of measure, not a container.** Distance is countable,
  reveal is bounded, and a hex holds contents — it never opens a map of its own.
- **Real axial coordinates.** `grid.ts` is square-grid maths with three metrics
  and is **not** reused.
- No code is shared with the province: no workers, no influence radius, no
  adjacency that pays Gold.

### 1.2 Two zoom registers

| Register | Hex width | On a 390 pt phone | Its job |
|---|---|---|---|
| **Tactical** | ~130 pt | ~3 across | **Look at a place.** What it holds, what you can do, and the sheet that acts on it |
| **Strategic** | ~45 pt | ~8–9 across | **Measure and plan.** Count hexes, judge march time, read borders and ownership |

- The jump between registers is ~3×. The strategic register is a planning
  surface, not an overview, and ships with the board.
- 3–4 content elements are legible on a tactical hex.
- **The board opens on your city**, in the tactical register.
- **Content icons are read, never tapped.** At ~130 pt an icon lands at 25–40 pt,
  under the 44 pt / 48 dp minimums. **The hexagon is the tap target; a dispatch
  sheet is where actions happen.**

## 2. The anatomy of a hex

| | |
|---|---|
| **Terrain** | Grassland, Plains or Desert |
| **Feature** | **none or one** — Forest, Mountain, Fertile land, Game, or a site (§8) |
| **Control** | neutral, or one named player |
| **Connection** | active or inactive — only meaningful on a controlled hex (§5) |
| **District** | what its controller built on it, decided by its feature, and its upgrades (§7) |

- **The feature decides the hex.** It is what the hex is worth, what can be
  built there, and what its art is. The terrain is the ground under it.

## 3. Fog and exploring

> **The province is tapped. The world is sent to.**

- Three fog states, matching the province's
  ([`01-map-and-fog.md`](01-map-and-fog.md) §4):

| State | Looks like | Province equivalent |
|---|---|---|
| **Revealed** | full terrain, contents, borders | Revealed |
| **Sensed** | under a thin veil of cloud, what stands on it a pale silhouette (art-direction §8.1) | Discovered |
| **Unknown** | under the cloud bank (art-direction §8.1): the hex is not there | Undiscovered |

- At the start only two hexes are revealed: **your city, and the Dark Portal.**
- **A hex is Sensed when it is next to a hex you revealed.** The Portal,
  revealed for everyone, senses nothing.
- **Only a Revealed hex can be acted on.** Claiming, building and sending an
  army all need the hex explored first; on Sensed or Unknown ground the only
  action is Explore, and a Revealed hex never offers it.
- **A march never passes through fog**: every hex on its way is Revealed;
  only an explorer's destination may be Sensed.

### 3.1 Explorers

- **You explore by sending an explorer to a Sensed hex.** It marches there,
  works there, and marches home. There is no button that buys fog.
- **Explorers are slots, like builders.** *Cartography* (Atlas) gives the
  first; a rank ladder in the Atlas gives more. No training.
- **Sending one costs Gold**, paid when it leaves:
  `exploreGoldBase` (2,500) × `exploreGoldGrowth` (×1.5) for every hex past
  the first from the city — 2,500 next door, about 19,000 at 6 hexes, 96,000
  at 10. A short purse refuses the trip.
- **An explorer never fights and can never be stopped, attacked or lost.** It
  lives in the player's own save, like the fog it reveals.
- **The work**: once there, the explorer works the hex for
  `exploreWorkSeconds` (30) plus `exploreWorkSecondsPerHex` (30) for every
  hex it lies from the city.
- When the work is done, the hex **and the six around it** are revealed. The
  radius upgrades to 2. Nothing is revealed on the way.
- **A march costs time, hex by hex** (§4.1).
- An explorer's time per hex divides by `worldRevealSpeed`; its work does not.
- **One trip per hex.** No explorer is sent to a hex one already out will
  reveal — its target, or a hex within its reveal.
- **A hex an explorer is out to shows the trip** in place of Explore: what
  it is doing (on the way, exploring, coming home), one bar for the whole
  trip, and **Finish**: Gems for the time left until it is home, at
  `rush.secondsPerGem` like every other wait. Finished, its hexes are
  revealed and the explorer is home.

## 4. Armies

> **How many armies a player has is the balancing lever for the whole board.**

- **An army is a party sent out**: the same party a lair attack fields — at
  least one hero and up to six squads ([`combat.md`](combat.md) §3) — composed
  on the same screen.
- Armies take neutral ground, attack a rival, garrison a Fortress and dive the
  Portal.
- **An army is busy for its whole march and the action at the end of it**:
  - its troops leave the roster and cannot fight a lair;
  - **its heroes are busy** and cannot lead another party
    ([`10-heroes.md`](10-heroes.md) §2.7);
  - it comes home with its survivors and its heroes' wounds; casualties are
    charged as in any fight ([`combat.md`](combat.md) §4).
- **Army slots:**
  - every player has **one** from the moment the world opens;
  - the **War Camp** — a building, one per city, opened by the Atlas card
    *Muster* — adds **one per level**.
- How many armies can march at once is also bounded by heroes free to lead
  them.
- A march is a **timer**: an army sent before a twelve-hour absence has
  arrived on return ([`02-map-scopes.md`](02-map-scopes.md) §4).

### 4.1 March time

- **A march is a path, hex by hex**, and the way taken is **the quickest** —
  through Revealed hexes only (§3).
- **Every hex adds its time when the marcher leaves it**: out, the city and
  every hex before the destination; home, the destination and every hex
  before the city.
- A hex's time is the marcher's **pace** times the hex's **ground**:

| Pace on open ground | Seconds a hex |
|---|---|
| Explorer (`explorerSecondsPerHex`) | 60 |
| Army (`armySecondsPerHex`) | 120 |

| Ground (`worldTravel`) | Factor |
|---|---|
| Grassland, Plains | ×1 |
| Desert | ×1.5 |
| Mountain (a feature, on top of the terrain) | ×3 |
| Forest (a feature) | ×1.5 |
| Every other feature, the Portal | ×1 |

- Factors multiply: a mountain on desert is ×4.5.
- *Example, an explorer*: leaving open plain 1 min, a plain with forest
  1 min 30 s, a mountain on grassland 3 min.
- **A speed divides one hex's time** and never lengthens it — the hook for a
  hero or technology that is quicker over some ground.
- **Your explorers and armies show their way**: footprints along the hexes
  walked, a dashed line along the hexes still to go, ringed on the hex it is
  bound for — the target out, the city home. A rival's army shows only itself.

## 5. Control, claiming and connection

### 5.1 Claiming

- Hexes are **neutral by default**. A player's city hex is always theirs, always
  active, and **can never be attacked**.
- **Adjacency is always required.** A player may only take a hex adjacent to an
  **active** hex of their own.
- **A neutral hex with nothing on it is claimed by building its district**:
  its Gold and a builder's time. There is no choice to make — **the hex's
  feature decides which district it is** (§7).
- **Each claim costs more than the last**, by the hexes already held.
- **While its district is building, the hex is claimed but not held**: its
  owner's border runs round it dashed, and turns solid when the district
  stands.
- **World builds use the province's builders**: a district or an upgrade
  holds a builder until it stands, like a building in the city.
- **A build on your own hex shows its progress** on the hex's sheet — what
  is being built, one bar for the whole build, and **Finish**: Gems for the
  time left, at `rush.secondsPerGem` like every other wait. Finished, it
  stands at once and the builder is home.
- **A neutral hex that still carries its district** — someone held it and
  lost it — is claimed by marching an army there; the district and its
  upgrades change hands intact.

### 5.2 Connection

- Every controlled hex needs an unbroken chain of its owner's **active**,
  adjacent hexes back to their city hex.
- **The city is the root and never disconnects.**
- The Dark Portal hex is a void: armies march through it, but it **carries no
  connection** and counts as nobody's hex for any purpose.
- An **inactive** hex carries no connection either — a fallen branch cannot be
  reconnected through another fallen branch.

### 5.3 Inactive hexes

A hex that loses its chain to the city **is not lost — it goes inactive.** While
inactive:

- its district produces nothing;
- it grants neither the inner-ring bonus nor its features' passive effects, the
  Sanctuary included;
- it cannot claim neighbours and cannot carry connection;
- **it is still its owner's, and its buildings stand untouched**;
- it can be attacked normally, and whoever attacks it still needs adjacency to
  take it.

Recalculation is **immediate and in one pass**: any change of control
recomputes the connection of all affected territory at once, never hex by hex
and never on a tick. Reconnecting reactivates instantly, at no cost and no
time.

**Cutting a corridor switches off the economy behind it without handing over
the ground** — to own it you still take the hexes one at a time. With six
neighbours per hex, a corridor with one hex of redundancy does not fall to a
single attack: **cutting is a deliberate operation of several hexes, never an
accident.**

## 6. Attacking

- **Hexes are attacked one at a time. There is no cascade** — beating the
  defender of a hex does nothing to the rest of that player's territory.
- The fight goes through the ordinary resolver ([`combat.md`](combat.md)) and
  **resolves the moment the army arrives**. The defender is told what happened
  with a battle report; there is nothing to answer in the moment, and nothing
  that needs them awake.
- **Defence is pre-positioned, never reactive:** what defends a hex is what was
  garrisoned there before the attack (§6.1).
- **A hex no Fortress covers has no defence.** An enemy army that arrives
  takes it or denies it without a fight.

Two plays out of one button:

| | Needs | Gives | Called |
|---|---|---|---|
| The attacked hex **is** adjacent to active ground of yours | having expanded to it | you take the hex and everything built on it, intact | **a conquest** |
| The attacked hex **is not** | only an army and a march | the defender loses it — it goes **neutral, buildings standing** — and your troops march home | **a denial** |

- A denial costs an army and a trip and takes nothing. The ground it frees is in
  reach of anyone with a hex beside it, **so denying can hand the ground to a
  third player.**
- **Nothing throttles conflict but the price in troops** (§4).

### 6.1 The Fortress

- **A Fortress is garrisoned by an army.** The army marches to it and stays,
  holding its army slot and its heroes, until it is recalled.
- The garrison **covers its own hex and the six around it**.
- **An attack on a covered hex is fought against the garrison**, the
  defender's real party with its heroes' current HP:
  - the attacker wins → the garrison falls and the attacker takes or denies
    the hex it attacked; the Fortress stays, empty;
  - the garrison wins, or the fight times out → the attacker marches home
    with its survivors.
- A hex covered by more than one garrison needs **every one beaten**, one
  after another on the same arrival; the army carries its losses from one
  fight into the next.
- A garrison defends whether its hex is active or not.
- Both sides' casualties are charged as in any fight
  ([`combat.md`](combat.md) §4); a fallen garrison's heroes go home
  exhausted.

## 7. Districts

**A held hex is a district**, and its feature decides which. No technology
gates them; *Cartography* opens the first explorer.

| The hex holds | District | Pays, into its store |
|---|---|---|
| **no feature** | **Rural district** — a small village | Gold: a tenth of what a full level-1 House pays (6 a minute) |
| **Forest** | **Logging Camp** | Wood |
| **Mountain** | **Quarry** | Stone |
| **Fertile land** | **Farm Lands** | Food |
| **Game** | **Hunting Grounds** | Food |
| **Landmark** | **Observatory** | Knowledge |
| **Sanctuary** | **Shrine** | raises max Mana while held and active — no store |
| **Dungeon** | — never held (§8.1) | |

- **Rural districts are the board's houses**, and pay far less than the
  city's: the city's Houses stay the main source of Gold.
- **Districts are what Gold buys out here.** They are the world's Gold sink,
  which is why the march is free.
- **The inner ring pays +200%** to districts standing on it. Permanent,
  independent of whether the Portal is open, and **only while the hex is
  active**.
- **A district has one level.** Levels are an upgrade still to design.

### 7.1 Roads

- **Every district is joined by road to its owner's neighbours**: a road runs
  from its centre to each adjacent hex its owner holds, the city included.
- Roads are drawn **between the ground and the district**: the same road
  pieces serve every district.
- A road shows the chain back to the city (§5.2): a cut-off hex is where the
  road stops.

### 7.2 Upgrades

- **An upgrade is built into a district that stands**, with Gold and a
  builder's time, and shows on its hex.
- **The Fortress is the first, and fits any district**: three levels,
  garrisoned by an army, covering its hex and the six around it (§6.1).

### 7.3 Stores

- **A producing district fills a store of its own**, as a province building
  does ([`03-economy.md`](03-economy.md) §3.2). A full store stops it.
- **A tap on its hex collects the store into the city's wallet**, free.
- **Yield and store size are authored amounts per district.**
- An inactive hex's store stops filling and can still be collected.
- **The store goes with the hex.** A conquest hands it to the conqueror; a
  denial empties it. Collecting is the defence.

## 8. Features

A hex holds **none or one**. A feature decides the district built there
(§7); some are destinations instead.

| Feature | What it does |
|---|---|
| **Forest** | its district is the Logging Camp |
| **Mountain** | its district is the Quarry. A feature, as in the province: the ground under it is a terrain like any other |
| **Fertile land** | its district is Farm Lands |
| **Game** | its district is the Hunting Grounds |
| **Dungeon** | depths of rooms, cleared per player; pays a found book (§8.1). Never held. **Outer ring only** |
| **Sanctuary** | its district is the Shrine: max Mana while held and active. **Outer ring only** |
| **Landmark** | its district is the Observatory, which fills a store of Knowledge. **Corridors only** (rings 2–4) |

### 8.1 Dungeons

- **A dungeon is depths of rooms** — the depth and room design of
  [`11-expeditions.md`](11-expeditions.md): numbered depths, one fight a room,
  a boss at the end of each depth.
- **Each player delves for themselves**: their own progress, room by room.
- **But closing it is a race.** The first player to beat a dungeon's last boss
  closes it for everyone:
  - they are paid that boss again, `closeRewardMultiplier` (2) times over;
  - every army camped there walks home, and everyone's progress in it is gone;
  - the others are told who closed it.
- **A closed dungeon comes back** after a roll between `returnHoursMin` and
  `returnHoursMax` (12–24 h), in its own sixth of the board:
  - on rings 3–6, on a hex nobody holds and no other site stands on;
  - never beside a city, never where it last stood;
  - it covers what the ground holds while it stands; gone, the ground is as
    it was;
  - it is a new dungeon: every player starts it from the top.
- Where every dungeon stands is server state.
- A dungeon hex is never owned and needs no adjacency: any army can march to
  it.
- **An army camps at the dungeon.** From the dungeon's sheet the player
  attacks its rooms one at a time; each fight resolves at once.
  - The camped army's losses and its heroes' wounds carry from room to room.
  - Recalling it marches it home, to be reinforced and sent again.
- **Depth N+1 opens when depth N's boss falls.** Nothing else gates a depth.
- **Every dungeon is 3 depths of 8 rooms**; the last room of a depth is its
  boss, which fields more and pays a multiple of a room.
- **Every room pays** Gold, Knowledge, Hero XP and Stardust, by depth and
  room ([`11-expeditions.md`](11-expeditions.md) §7.1). What a dungeon pays
  beyond its rooms — the found book — is **OQ-122**.

## 9. Generation

Contents are rolled at board creation, under rules:

- **One 60° wedge is rolled and turned six times**, so every seat has the same
  ground round it. A wedge is a seat's 21 hexes of rings 1–6; the inner ring
  is the exception (below).
- **A hex rolls one feature at most** (`maxFeaturesPerHex`, 1).
- A hex designated for a player start is always **Grassland with no feature**.
- Every player has **at least one Forest** hex adjacent to their city.
- Every player has **at least one hex with no feature** adjacent to their
  city.
- **No dungeon** is adjacent to a player's city.
- **The inner ring is not rolled and not turned — it is authored by hand**, so
  all six hexes are worth something and no two are alike: 2 Forest, 2
  Mountain, 1 Fertile land, 1 empty (`worldGen.innerRing`).
- **Every sixth of the board has exactly one Dungeon and one Sanctuary**, on
  its outer ring and never beside a city: six of each on every board, one for
  each seat at the same distance. They are placed, not rolled
  (`worldGen.placedPerWedge`); the ground under them turns to a terrain they
  stand on.
- Landmarks are rolled, only on the corridors.

### 9.1 Which features roll where

| Feature | Rolls on |
|---|---|
| **Forest** | Grassland, Plains |
| **Mountain** | Grassland, Plains, Desert |
| **Fertile land** | Grassland, Plains |
| **Game** | Grassland, Plains, Desert |
| **Dungeon** | any terrain (its art carries its own rock) |
| **Sanctuary** | Grassland, Plains |
| **Landmark** | Grassland, Plains, Desert |

- Features roll in the table's order; **the first that rolls and fits the
  terrain is kept**. Dungeon and Sanctuary are placed instead (above).
- The rules are data (`worldGen.featureRules`), and the inner ring obeys them
  too.
- Every feature has its own art, and so has every district
  ([`../plans/world-hex-art.md`](../plans/world-hex-art.md) §2).

## 10. The Dark Portal

A recurring timed event on the centre hex. The reference is Infinity Kingdom's
Endless Tower, not Rise of Kingdoms — this is a depth ladder, and the genre's
usual siege is not what the centre is for.

### 10.1 The hex

- No terrain and no features.
- Never controllable, never buildable, by anyone.
- **Always revealed, for everyone, with no fog.**
- Armies march through it; it carries no connection and is nobody's hex.
- Between events it shows the portal dark, and a counter to the next opening.

### 10.2 Cadence

**A 7-day cycle: 3 days open, 4 days shut, always starting on the same weekday.**
The fixed appointment is worth more than the surprise.

### 10.3 How it is dived

- Every player on the board is notified when it opens, and **every player may
  enter regardless of where their territory is**.
- A **maximum depth** of 40 floors (`worldPortal.floors`), tuned so nobody empties it in one event.
- Floors are taken **one at a time, no skipping**.
- **Three attempts a day**, restored at a fixed hour. **An attempt is spent only
  on clearing a floor — failing costs nothing.**
- Descending costs casualties, and **an army in the Portal is not on the board**:
  it defends nothing while it is down there.
- Ranked by **deepest floor reached**, ties broken by **who got there first**.

The attempt limit is what keeps the ranking a measure of strength and decisions
rather than hours on the sofa, and what stretches the event across its three
days instead of settling it on the first night. In production it is also the
natural Gem sale — extra attempts, which is a better thing to sell than
finishing instantly.

### 10.4 What it pays

- **By depth** — an immediate reward for clearing each floor: **Knowledge,
  Hero XP and Stardust**, and a **Rose or Golden pack** on the floors authored to carry one.
  This is the main line.
- **By milestone** — an exclusive reward for the first player to a given depth,
  reset every event.
- **By final rank** — Top 1 / Top 2–3 / Top 4–6.

## 11. What the world pays the province

The outer scope feeds the inner one.

| The world pays | Which lands in |
|---|---|
| **Gold, Wood, Food and Stone**, collected from districts' stores (§7.3) | the city's own purse |
| **Max Mana**, from held Sanctuaries | [`08-magic.md`](08-magic.md) |
| **Found books**, from dungeons (§8.1) | [`07-research.md`](07-research.md) |
| **Knowledge, Hero XP, Stardust and Rose / Golden packs**, from dungeon rooms and Portal floors | research, heroes, the collection ([`09-relics.md`](09-relics.md) §6) |
| **Knowledge**, from Observatories' stores | research ([`07-research.md`](07-research.md) §7) |

- The loop: **the world pays the province, the province arms the army, the army
  takes more world.** One economy across two scales, never two economies.

## 12. The dials, in the order to reach for them

| Dial | Moves | Reach for it when |
|---|---|---|
| **Army slots** (1, +1 per War Camp level) | everything — conflict, the Portal | the board feels too quiet or too violent |
| **Casualty replacement time** | how often a player can act at all | attacks are too cheap to repeat |
| **Army seconds per hex** (120) | the tempo of conquest | the board resolves too fast or feels like waiting |
| **Explorer seconds per hex** (60) and **work time** (30 + 30 a hex) | the tempo of exploring | the board opens too fast or too slowly |
| **Ground factors** (forest ×1.5, desert ×1.5, mountain ×3) | which ways are taken | terrain does not matter, or walls the board in |
| **Explorer slots** (Cartography, then the Atlas ladder) | how fast the board opens | exploring becomes the bottleneck |
| **Gold to explore** (2,500 × 1.5 a hex) | how much of the purse the board takes | exploring is free in practice, or crowds out building |
| **District cost and build time** | how fast territory spreads | the map is claimed out too early |
| **District yields**, the Rural district's a tenth of a House | what holding ground is worth | the world is not worth leaving home for, or out-earns the city |
| **Inner-ring multiplier** (+200%) | how badly the centre is wanted | nobody fights over ring 1, or everybody does |
| **Dungeon return time** (12–24 h) | how often a sixth has a dungeon to race for | dungeons sit closed too long, or never feel won |
| **Portal attempts per day** (3) | how much of the army the Portal eats | the Portal empties the board |
| **Reveal radius** (1, upgrading to 2) | how fast the board opens | exploring becomes the bottleneck |

## 13. Deliberately not in this design

- **Attacking a city.** A city hex is never attackable, by anyone, ever.
- **Cascading conquest** — no hex falls because a neighbour did.
- **A hex that opens a map of its own**: a dungeon is a destination, not
  a third map level.
- **Reactive defence.** Nothing is scrambled when an attack lands; what defends
  is what was garrisoned beforehand.
- **Losing a hex outright to a cut corridor** — it goes inactive, never away.
- **Cities on the world map.** One district on a claimed hex, and its upgrades.
- **Choosing what to build on a hex.** The feature decides; the choice is
  which hex to take.
- **More than one feature on a hex.**
- **An Outpost before the building.** The district is the claim.
- **Reusing `grid.ts`** for the lattice.
- **A rule that forbids continuous conflict.** The price in troops is the only
  brake.

**Open questions:** OQ-3 (season length — the shard is six players on 127 hexes,
the season is not set), OQ-122 in
[`../open-questions.md`](../open-questions.md).
