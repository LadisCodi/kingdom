# 19 · The world map — the shared board

> **Scope.** The hex board six players share: how it is shaped, how it is
> explored, how ground is claimed, held, lost and taken, what it produces, and
> the Dark Portal that opens on it every week. The province is
> [`01`](01-map-and-fog.md) and [`05`](05-city-and-districts.md); who is
> authoritative over what is [`02`](02-map-scopes.md); the resolver every
> fight goes through is [`combat.md`](combat.md).
>
> **Status: designed, not built.** Nothing of this exists in code but the
> `worldRevealSpeed` modifier stat.

## 1. The board

- **A pointy-top hex board, radius 5 from the centre: 91 hexes.**
- **Six players a board.** A seventh player opens a new instance; for the
  prototype that is enough.
- A player's starting hex is assigned at random from the free ones.
- Rings are roles, not decoration:

| Ring | Hexes | Its job |
|---|---|---|
| **0 — the centre** | 1 | The Dark Portal. Never owned, never built on, never fogged (§9) |
| **1 — the inner ring** | 6 | The richest ground on the board: **+200% to improvements built on it** (§6.3) |
| **2 — the corridors** | 12 | The ground between a city and the centre. Nothing special, and unavoidable |
| **3 — the home ring** | 18 | The six city hexes, equidistant, and the ground between them |
| **4 — the outer ring** | 24 | Dungeons, Sanctuaries and the rare books. Poor in production, rich in what production cannot buy |

- From a city on ring 3 the centre is **three hexes away**: two corridor hexes
  on ring 2, then one on ring 1.
- **The inner ring is the best ground and the worst to hold** — it is one hex
  from all five rivals and hangs off an exposed corridor.
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
- **Fog is information, not permission.** It never blocks movement or an action,
  which is what keeps it client-authoritative and in the player's own save
  ([`02-map-scopes.md`](02-map-scopes.md) §3).

### 3.1 Exploring costs an army

- **You explore by sending an army, and it marches.** There is no button that
  buys fog: a hex is revealed because something of yours went and looked.
- An army reveals **its own hex and the six around it** at every hex it passes
  through — so a march opens a corridor, not a dot. The radius is a progression
  axis and upgrades to 2.
- **Marching costs time, scaling with distance** (§4). It costs **no Gold**:
  Gold's sink out here is building (§6), and charging for the march as well
  would be charging twice for one decision.
- Exploring, claiming, attacking, defending a corridor and diving the Portal
  all draw on the same armies. **Choosing to explore is choosing not to do the
  other four** (§4).
- The march timer divides by `worldRevealSpeed` from the modifier stack — a
  multiplier, never a subtracted discount.
- The board is small and opens quickly by design. **Discovery is not the
  bottleneck here; the army is.**

## 4. The army is the bottleneck

> **This is the balancing lever for the whole board.**

- One bag of troops does everything: takes neutral ground, attacks a rival,
  garrisons a corridor, collects free hexes, and dives the Portal.
- An army is **occupied for the whole march and the action at the end of it**,
  and troops lost take time to replace.
- **When the board feels wrong — too much conflict, too little, the Portal
  eating every army — the numbers to move are how many armies a player has and
  how long casualties take to replace.** Not the +200%, not the march times.
- Marching is a **timer**, so the offline cap never touches it: an army sent
  before a twelve-hour absence has arrived on return
  ([`02-map-scopes.md`](02-map-scopes.md) §4).
- March time is **linear in hexes** — *Y hexes cost X·Y*. The board is ten hexes
  across at its widest; superlinear scaling exists to stop large maps
  collapsing and there is no large map here.

## 5. Control, claiming and connection

### 5.1 Claiming

- Hexes are **neutral by default**. A player's city hex is always theirs, always
  active, and **can never be attacked**.
- **Adjacency is always required.** A player may only take a hex adjacent to an
  **active** hex of their own.
- **A neutral hex with nothing on it** is claimed by building an **Outpost**,
  paying its cost and its time.
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

- A **Fortress** stations troops on a hex. They defend that hex **and every hex
  adjacent to it**: while they stand, no enemy takes any of them.
- The Fortress itself can be attacked directly, with its troops as the
  defenders. **That is how a blockade is broken** — from the front.

## 7. Improvements

Built only on a hex the player already controls, and only after the Outpost.

| Improvement | Needs | Gives |
|---|---|---|
| **Outpost** | — | takes the hex, and opens the rest of this table |
| **Sawmill** | a Forest | Wood to the main city, hourly |
| **Farm** | a hex with no feature | Food to the main city, hourly |
| **Quarry** | a Mountain | Stone to the main city, hourly |
| **Fortress** | — | stations troops; defends this hex and its six neighbours (§6.1) |

- **Improvements are what Gold buys out here.** They are the world's Gold sink,
  which is why the march is free.
- **The inner ring pays +200%** to improvements standing on it. Permanent,
  independent of whether the Portal is open, and **only while the hex is
  active**.

## 8. Features

A hex holds 0…N. Some open an improvement, some give a passive while the hex is
held, some are destinations.

| Feature | What it does |
|---|---|
| **Forest** | opens the Sawmill |
| **Fertile land** | a Farm here yields extra Food |
| **Game** | a Farm here yields extra Food |
| **Dungeon** | held by enemies. Cleared, it takes expeditions — and it is where the **rare spellbooks** are ([`07-research.md`](07-research.md)). **Outer ring only** |
| **Sanctuary** | raises max Mana while the hex is held and active. **Outer ring only** |

> **The province's ruins pay the basic books; the outer ring's dungeons pay the
> rare ones.** A player who never contests the board still has a complete route
> through research — the world widens what a kingdom can become, it never
> monopolises it.

## 9. Generation

Contents are rolled at board creation, under rules:

- A hex designated for a player start is always **Grassland with no feature**.
- Every player has **at least one Grassland + Forest** hex adjacent to their
  city.
- Every player has **at least one Grassland with no feature** adjacent to their
  city.
- **No dungeon** is adjacent to a player's city.
- **The inner ring is not rolled — it is authored by hand**, so all six hexes
  are worth something and no two are alike. Proposed split: 2 Forest, 2 empty
  (one of them Fertile land), 2 Mountain.
- Dungeons and Sanctuaries appear **only on the outer ring**.

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

- **By depth** — an immediate reward for clearing each floor. This is the main
  line, and it makes diving worth it for a player with no interest in the
  ranking.
- **By milestone** — an exclusive reward for the first player to a given depth,
  reset every event.
- **By final rank** — Top 1 / Top 2–3 / Top 4–6.

## 11. What the world pays the province

The outer scope feeds the inner one.

| The world pays | Which lands in |
|---|---|
| **Wood, Food and Stone**, hourly, from improvements | the city's own purse |
| **Max Mana**, from held Sanctuaries | [`08-magic.md`](08-magic.md) |
| **Rare spellbooks**, from outer-ring dungeons | [`07-research.md`](07-research.md) |
| **Star card packs** — a gold card guaranteed | the collection's two hardest albums ([`09-relics.md`](09-relics.md) §6) |
| **Knowledge cap**, from held landmarks | research ([`07-research.md`](07-research.md) §7) |

- The loop: **the world pays the province, the province arms the army, the army
  takes more world.** One economy across two scales, never two economies.

## 12. The dials, in the order to reach for them

| Dial | Moves | Reach for it when |
|---|---|---|
| **Armies per player** | everything — conflict, exploring, the Portal | the board feels too quiet or too violent |
| **Casualty replacement time** | how often a player can act at all | attacks are too cheap to repeat |
| **March time per hex** | the tempo of the whole scope | the board resolves too fast or feels like waiting |
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
