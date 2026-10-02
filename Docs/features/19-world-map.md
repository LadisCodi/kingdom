# 19 · The world map — the shared board

> **Scope.** The hex board six players share: how it is shaped, how it is
> explored, how ground is claimed, held, lost and taken, what it produces, and
> the Dark Portal that opens on it every week. The province is
> [`01`](01-map-and-fog.md) and [`05`](05-city-and-districts.md); who is
> authoritative over what is [`02`](02-map-scopes.md); the resolver every
> fight goes through is [`combat.md`](combat.md).
>
> **Status: built against a local stand-in for the world server**
> ([`../plans/world-board.md`](../plans/world-board.md)): the board, the fog
> and the explorers (§1–§3, §9); claiming, the chain, inactive hexes,
> improvements and their stores, landmarks and Sanctuaries (§5, §7, §8);
> armies, the War Camp, attacks, conquest and denial, Fortress garrisons
> (§4, §6). Five stand-in rivals claim, build, man a Fortress and now and
> then attack on their own. The hex art is the province's, arranged on a
> hex. Dungeons (§8.1) are built; the Portal (§10) is designed, not built.

## 1. The board

- **A pointy-top hex board, radius 5 from the centre: 91 hexes.**
- **Six players a board.** A seventh player opens a new instance; for the
  prototype that is enough.
- **A player joins the first board with a free city**, on its first free
  corner, assigned at random.
- Rings are roles, not decoration:

| Ring | Hexes | Its job |
|---|---|---|
| **0 — the centre** | 1 | The Dark Portal. Never owned, never built on, never fogged (§10) |
| **1 — the inner ring** | 6 | The richest ground on the board: **+200% to improvements built on it** (§7) |
| **2–3 — the corridors** | 30 | The ground between a city and the centre. Nothing special, and unavoidable |
| **4 — the home ring** | 24 | The six city hexes, on its corners, and the ground between them |
| **5 — the outer ring** | 30 | Dungeons and Sanctuaries. Poor in production, rich in what production cannot buy |

- A city is **four hexes** from the centre and four from each neighbouring
  city.
- An inner-ring hex is three hexes from its nearest city and at most five from
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
- **Content icons are read, never tapped.** At ~130 pt an icon lands at 25–40 pt,
  under the 44 pt / 48 dp minimums. **The hexagon is the tap target; a dispatch
  sheet is where actions happen.**

## 2. The anatomy of a hex

| | |
|---|---|
| **Terrain** | grassland, plains, desert, mountain, … |
| **Features** | **0…N of them** — a world hex is larger than a province cell and may hold several (§7) |
| **Control** | neutral, or one named player |
| **Connection** | active or inactive — only meaningful on a controlled hex (§5) |
| **Improvements** | what the controlling player has built on it (§6) |

## 3. Fog and exploring

> **The province is tapped. The world is sent to.**

- Three fog states, matching the province's
  ([`01-map-and-fog.md`](01-map-and-fog.md) §4):

| State | Looks like | Province equivalent |
|---|---|---|
| **Revealed** | full terrain, contents, borders | Revealed |
| **Sensed** | dimmed and half-veiled, faint silhouettes showing through | Discovered |
| **Unknown** | opaque rolling mist, the whole hex hidden | Undiscovered |

- At the start only two hexes are revealed: **your city, and the Dark Portal.**
- **A hex is Sensed when it is next to a hex you revealed.** The Portal,
  revealed for everyone, senses nothing.
- **Fog is information, not permission.** It never blocks movement or an action,
  which is what keeps it client-authoritative and in the player's own save
  ([`02-map-scopes.md`](02-map-scopes.md) §3).

### 3.1 Explorers

- **You explore by sending an explorer to a hex.** It marches there, reveals,
  and marches home. There is no button that buys fog.
- **Explorers are slots, like builders.** *Cartography* (Atlas) gives the
  first; a rank ladder in the Atlas gives more. No training, no cost per use.
- **An explorer never fights and can never be stopped, attacked or lost.** It
  lives in the player's own save, like the fog it reveals.
- Anything of yours that marches — an explorer or an army — reveals **its own
  hex and the six around it** on reaching each hex of its path, from the first
  hex past the city; leaving reveals nothing. The radius upgrades to 2.
- **A march costs time, linear in hexes** (§4), and no Gold.
- An explorer's march time divides by `worldRevealSpeed`.

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
- March time is **linear in hexes** — *Y hexes cost X·Y*.

## 5. Control, claiming and connection

### 5.1 Claiming

- Hexes are **neutral by default**. A player's city hex is always theirs, always
  active, and **can never be attacked**.
- **Adjacency is always required.** A player may only take a hex adjacent to an
  **active** hex of their own.
- **A neutral hex with nothing on it** is claimed by building an **Outpost**,
  paying its Gold and a builder's time. Each Outpost costs more than the last,
  by the hexes already held.
- **World builds use the province's builders**: an Outpost or an improvement
  level holds a builder until it stands, like a building in the city.
- **A neutral hex that still carries buildings** — someone held it and lost it —
  has its Outpost already standing: marching an army there is enough to claim
  it, and its improvements change hands intact.

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

- its improvements produce nothing;
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

## 7. Improvements

Built only on a hex the player already controls, and only after the Outpost.
**Each is opened by its own Atlas card**; *Cartography* opens the first
explorer and the Outpost.

| Improvement | Needs | Gives |
|---|---|---|
| **Outpost** | — | takes the hex, and opens the rest of this table |
| **Logging Camp** | a Forest | Wood, into its store |
| **Homestead** | a hex with no feature | Food, into its store |
| **Stone Pit** | a Mountain | Stone, into its store |
| **Fortress** | — | garrisoned by an army; covers this hex and its six neighbours (§6.1) |

- **Improvements are what Gold buys out here.** They are the world's Gold sink,
  which is why the march is free.
- **The inner ring pays +200%** to improvements standing on it. Permanent,
  independent of whether the Portal is open, and **only while the hex is
  active**.

### 7.1 Stores

- **A producing improvement fills a store of its own**, as a province building
  does ([`03-economy.md`](03-economy.md) §3.2). A full store stops it.
- **A tap on its hex collects the store into the city's wallet**, free.
- **Yield and store size are authored amounts per improvement level.**
- An inactive hex's store stops filling and can still be collected.
- **The store goes with the hex.** A conquest hands it to the conqueror; a
  denial empties it. Collecting is the defence.

## 8. Features

A hex holds 0…N. Some open an improvement, some give a passive while the hex is
held, some are destinations.

| Feature | What it does |
|---|---|
| **Forest** | opens the Logging Camp |
| **Fertile land** | a Homestead here yields extra Food |
| **Game** | a Homestead here yields extra Food |
| **Dungeon** | depths of rooms, cleared per player; pays a found book (§8.1). **Outer ring only** |
| **Sanctuary** | raises max Mana while the hex is held and active. **Outer ring only** |
| **Landmark** | fills a store of Knowledge while the hex is held and active, collected with a tap like an improvement's (§7.1). **Corridors only** (rings 2–3) |

### 8.1 Dungeons

- **A dungeon is depths of rooms** — the depth and room design of
  [`11-expeditions.md`](11-expeditions.md): numbered depths, one fight a room,
  a boss at the end of each depth.
- **Progress is per player.** Every player clears every room once, for
  themselves; one player's clear takes nothing from another's.
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
  beyond its rooms — the found book — is **OQ-118**.

## 9. Generation

Contents are rolled at board creation, under rules:

- **One 60° wedge is rolled and turned six times**, so every seat has the same
  ground round it. A wedge is a seat's 15 hexes of rings 1–5; the inner ring
  is the exception (below).

- A hex designated for a player start is always **Grassland with no feature**.
- Every player has **at least one Grassland + Forest** hex adjacent to their
  city.
- Every player has **at least one Grassland with no feature** adjacent to their
  city.
- **No dungeon** is adjacent to a player's city.
- **The inner ring is not rolled and not turned — it is authored by hand**, so
  all six hexes are worth something and no two are alike. Proposed split: 2 Forest, 2 empty
  (one of them Fertile land), 2 Mountain.
- Dungeons and Sanctuaries appear **only on the outer ring**; landmarks only
  on the corridors.

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
- A **maximum depth** of 30–50 floors, tuned so nobody empties it in one event.
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
| **Wood, Food and Stone**, collected from improvements' stores (§7.1) | the city's own purse |
| **Max Mana**, from held Sanctuaries | [`08-magic.md`](08-magic.md) |
| **Found books**, from dungeons (§8.1) | [`07-research.md`](07-research.md) |
| **Knowledge, Hero XP, Stardust and Rose / Golden packs**, from dungeon rooms and Portal floors | research, heroes, the collection ([`09-relics.md`](09-relics.md) §6) |
| **Knowledge**, from held landmarks' stores | research ([`07-research.md`](07-research.md) §7) |

- The loop: **the world pays the province, the province arms the army, the army
  takes more world.** One economy across two scales, never two economies.

## 12. The dials, in the order to reach for them

| Dial | Moves | Reach for it when |
|---|---|---|
| **Army slots** (1, +1 per War Camp level) | everything — conflict, the Portal | the board feels too quiet or too violent |
| **Casualty replacement time** | how often a player can act at all | attacks are too cheap to repeat |
| **March time per hex** | the tempo of the whole scope | the board resolves too fast or feels like waiting |
| **Explorer slots** (Cartography, then the Atlas ladder) | how fast the board opens | exploring becomes the bottleneck |
| **Outpost cost and build time** | how fast territory spreads | the map is claimed out too early |
| **Improvement yields** | what holding ground is worth | the world is not worth leaving home for |
| **Inner-ring multiplier** (+200%) | how badly the centre is wanted | nobody fights over ring 1, or everybody does |
| **Portal attempts per day** (3) | how much of the army the Portal eats | the Portal empties the board |
| **Reveal radius** (1, upgrading to 2) | how fast the board opens | exploring becomes the bottleneck |

## 13. Deliberately not in this design

- **Attacking a city.** A city hex is never attackable, by anyone, ever.
- **Cascading conquest** — no hex falls because a neighbour did.
- **A hex that opens a map of its own** (OQ-5): a dungeon is a destination, not
  a third map level.
- **Reactive defence.** Nothing is scrambled when an attack lands; what defends
  is what was garrisoned beforehand.
- **Losing a hex outright to a cut corridor** — it goes inactive, never away.
- **Cities on the world map.** One or two structures on a claimed hex, no more.
- **Server-authoritative fog** (`02` §3).
- **Reusing `grid.ts`** for the lattice.
- **A rule that forbids continuous conflict.** The price in troops is the only
  brake.

**Open questions:** OQ-3 (season length — the shard is six players on 91 hexes,
the season is not set), OQ-66, OQ-67 in
[`../open-questions.md`](../open-questions.md).
