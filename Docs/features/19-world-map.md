# 19 · The world map — the shared board

> **Scope.** The hex world 42 players share: how it is shaped, how it is
> explored, how ground is claimed, held, lost and taken, what it produces, and
> the Dark Portal that opens on it every week. The province is
> [`01`](01-map-and-fog.md) and [`05`](05-city-and-districts.md); who is
> authoritative over what is [`02`](02-map-scopes.md); the resolver every
> fight goes through is [`combat.md`](combat.md).
>
> **Status: built against a local stand-in for the world server**:
> the world of seven boards of radius 6 and one feature a hex (§1, §2, §8, §9); the fog and
> the explorers and their scouting rewards (§3, §3.2); claiming a district, its store, its roads and the
> Fortress upgrade (§5.1, §7); the chain and inactive hexes (§5.2–§5.3);
> armies, the War Camp, attacks, conquest and denial, Fortress garrisons
> (§4, §6); monster camps and their raids (§5.4–§5.5), their numbers in
> `worldCamps`; Dungeons
> and the delve screen (§8.1–§8.2), the ranking (§12) and the Dark Portal (§10), which opens on Fridays (UTC) for three
> days, its numbers in `worldPortal`. Stand-in rivals in every free seat claim, build, beat
> camps, man a Fortress and now and then
> attack on their own.
> The art is [`../plans/world-hex-art.md`](../plans/world-hex-art.md).

## 1. The board

- **A world is seven boards** — one in the middle, six round it, in a
  honeycomb: 42 seats, 889 hexes. To the player it is one board: claims,
  armies, explorers and fog cross from one to the next as anywhere else.
- **Every board is a pointy-top hex board, radius 6 from its centre: 127
  hexes**, with its own Portal at the centre, six seats, and its own roll
  (§9). Rings, wedges and roles are counted on a hex's own board.
- **Where two boards touch**, their outer rings lie side by side: twice the
  dungeons and sanctuaries, a frontier two neighbourhoods contest.
- **A player joins when they first go out onto the world** (§1.3).
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
- **The board opens on your city**, in the tactical register. The camera
  goes out as far as one board across; **the minimap** in the bottom-left
  corner shows the whole world — mist, explored ground, every kingdom's
  ground in its colour, the cities, the Portals and the camera's frame — and
  a tap there moves the camera.
- **Labels thin out as the camera goes out**, the least important first:
  - always: your kingdom's name, the Portals' times, a raid on you (its arc,
    its time and the camp's power), the armies;
  - from a hex ~60 pt wide: every camp's power and the rivals' names;
  - from ~80 pt: the dungeons' progress, the deposits' materials, what
    exploring promises.
- **Content icons are read, never tapped.** At ~130 pt an icon lands at 25–40 pt,
  under the 44 pt / 48 dp minimums. **The hexagon is the tap target; a dispatch
  sheet is where actions happen.**

### 1.3 Joining

- A player is on no board until they first go out onto the world map.
- The first time out, they choose a **nickname**:
  - 3–16 letters, numbers, spaces, `_` or `-`;
  - unique across the game, whatever its case;
  - never changed. It is the name every other player reads on the board,
    on a wooden plank under the city, banded in the kingdom's colour, with
    the kingdom's crest at its left end ([`15-social.md`](15-social.md)
    §2.2). A rival's city carries its name the same way, once it is out of
    the fog.
- **A friend's city** ([`15-social.md`](15-social.md) §2.1) on the same
  world shows through the fog: the city, its name and the ground it holds,
  on the board and the minimap, at every zoom. It does not count as
  explored. Seating ignores friendships: a friend is seen only when both
  share a world.
- The name is asked for the moment the world map opens, after its splash
  and its scene, or on the first tap of the world button if dismissed.
- The server then seats them:
  - **in a rival's city on the newest world that still has a rival** — on
    the board of that world with the most players, the middle one first, so
    a world fills board by board. The rival leaves with its armies and claims
    under way; its districts stand on, nobody's, their stores empty;
  - **else in a new world of their own**, its other 41 seats rivals (named
    from `world.rivals`, numbered past the list: *Lady Maren VII*).
- A world with no rival left is full.

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
- **Up to `explorersForSale` (2) more are bought**, for Gems
  (`explorerGemCostBase` 2,500, ×`explorerGemCostGrowth` 2 each) or in the
  Explorer pack ([`14-monetization.md`](14-monetization.md) §2.4). A bought
  explorer waits for *Cartography* like the first.
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
- **While a hex in the mist is open, the header's plaque counts the free
  explorers** (*2/3*), as it counts free builders while building.
- **A hex an explorer is out to shows the trip** in place of Explore: what
  it is doing (on the way, exploring, coming home), one bar for the whole
  trip, and **Finish**: Gems for the time left until it is home, at
  `rush.secondsPerGem` like every other wait. Finished, its hexes are
  revealed and the explorer is home.

### 3.2 Scouting rewards

- **Every hex has a promise**, rolled with the board by its kind of ring
  (`worldScouting.rewards`, by weight): Gold, Wood, Food, Stone, Hero XP,
  Knowledge, Stardust, Gems, a card pack or a lump of precious material
  (§7.4). None on a city, the Portal or a
  dungeon. Past the inner ring every wedge has the same promises.
- **A Sensed hex shows it**: a brass medallion with the reward's icon, and
  under it a plank with the Gold its exploring costs. The hex's sheet says
  what it pays. Once an explorer is on its way there, the plank goes.
- **Paid when the explorer sent to it is home** (or finished with Gems), and
  named in the toast that says it is home.
- **Only the target pays.** The hexes revealed round it pay nothing, and a
  hex revealed that way has lost its promise.
- **Gold, Wood, Food and Stone are priced in production** when paid:
  `hoursByRole` hours of the city's own production of it, floored at the
  reward's `amount`. Every other reward pays its `amount`.

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
- **A fight costs Mana** ([`08-magic.md`](08-magic.md) §1):
  `fightManaHours` (1) hours of the city's Mana regen, at least 1.
  - Paid for an army sent to a camp (§5.4) or a rival (§6), for each dungeon
    room (§8.2) and for each Portal floor (§10.3).
  - Claiming nobody's ground, garrisoning and the march to a dungeon or the
    Portal cost none.
  - Paid when the server accepts the order; a lost fight is not refunded.

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
  hero or technology that is quicker over some ground. The tree's
  `explorerSpeed` and `armyMarchSpeed` are two; an army's is priced by the
  city and sent with it, like its board.
- **Your explorers and armies show their way**: footprints along the hexes
  walked, a dashed line along the hexes still to go, ringed on the hex it is
  bound for — the target out, the city home. A rival's army shows only itself.

### 4.2 The ground of a fight

- **A fight on a hex is fought on its ground**: a camp cleared, a raid on a
  district, an attack on a rival's garrisons. A dungeon's rooms and the
  Portal's floors are below ground and take none.
- **Each rule names a terrain or a feature, a troop type, and a share of
  its attack** (`worldTerrainCombat`); a hex's terrain and features add up.
- **It is the ground's, so it holds for both sides.**

| Ground | Troop | Attack |
|---|---|---|
| Plains | Cavalry | +10% |
| Desert | Cavalry | −10% |
| Forest | Archers | −10% |
| Mountain | Lancers | +10% |

- **The deployment shows it**: under the roster, the fight's LOOT and its
  TERRAIN — the ground, the march there, and each rule that applies.

## 5. Control, claiming and connection

### 5.1 Claiming

- Hexes are **neutral by default**. A player's city hex is always theirs, always
  active, and **can never be attacked**.
- **Adjacency is always required.** A player may only take a hex adjacent to an
  **active** hex of their own.
- **A camp the player has not beaten guards its hex** (§5.4): the claim is
  refused *Guarded*.
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

### 5.4 Monster camps

- **A camp is a monster army standing on a neutral hex**, fought once
  through the ordinary resolver ([`combat.md`](combat.md)). Its creatures are
  the province's lairs' (Orcs, Harpies, Goblins, Wolf-riders, a Drake); its
  lair's threat is its formation's type, as a lair's garrison is
  ([`18`](18-garrisons-and-raids.md) §2).
- **Rolled with the board**, in the wedge (§9): every seat faces the same
  camps at the same distances.
  - About two thirds (`share`, 0.65) of the hexes on rings 2–6, never
    beside a city, never on a Dungeon, Sanctuary or Landmark.
  - **Every inner-ring hex has one**, the strongest: the inner ring's bonus
    is earned.
  - Power by ring (`powerByRing`), ± `powerJitter`; which creatures by role.
- **Each player beats a camp for themselves.** Beating it opens the hex to
  that player only. Once anyone holds the hex its camp no longer matters.
- **A beaten camp comes back** to the player who beat or paid it
  `returnHours` (12) later, whole, unless somebody holds its hex by then.
- **Seen or lurking.** A standing camp shows on a Sensed hex as a silhouette;
  a lurking one (`lurkingShare`) shows only once the hex is Revealed. On
  explored ground a pill over the camp shows its **power** — the units the
  player's own army is measured in — written in the colour of how hard it is
  against the strongest party they could send: Very easy (green) · Easy ·
  Fair · Hard · Deadly (red). The camp's sheet names the difficulty.
- **Fighting it**: an army sent to *clear* it — the party screen, march and
  slot of an attack (§4) — fights on arrival.
  - Won: the camp is beaten for that player, and pays when the army is
    home, by its power:
    - Gold (`goldPerPower`) and Hero XP (`heroXpPerPower`);
    - Wood, Food and Stone: `productionHoursPer1000Power` (1) hours of the
      city's own production per 1,000 power;
    - a lump of precious material (§7.4).
  - The camp's sheet shows what it pays before the army is sent.
  - Lost: the army walks home with its survivors; the camp stands, whole.
- **Paying it off**: its *tribute*, from the hex's sheet, no army, no wait.
  It is the training cost of the soldiers a winning army would lose
  (`tributeLossShare` of the camp's power, in Warriors), times
  `tributePremium` — **always dearer than the fight**. A paid camp pays no
  loot.
- **A rival beats a camp in its way** after `botHoursPer1000Power` hours per
  1,000 of the camp's power, without a fight.

### 5.5 Camp raids

- **One raid at a time per player.** Every camp could raid; only one does.
  - **A camp chooses**: one of the camps beside one of the player's districts
    (held, not burnt), standing for that player and seen, rolled per player.
  - **It announces the raid** `raidWarnHours` (1) before it lands: its arc,
    its time, the district.
  - **The raid lands**, unless by then the player has beaten or paid off the
    camp, or the district is no longer theirs or already burnt.
  - **The next camp chooses** `raidGapMinHours`–`raidGapMaxHours` (1–3)
    after the raid lands or is called off. With no camp in reach, it tries
    again a gap later.
  - Raids run in real time, online or not.
- **Only a camp the player has seen raids**: a standing one always; a
  lurking one once the player's client has told the server it was revealed.
- **A garrisoned Fortress fights the raiders** — the camp's army against the
  garrison, as an attack is fought (§6).
  - The garrison holds: the district is spared; its losses stand.
  - The garrison falls: what is left of it walks home, and the raid goes on.
- **A raided district burns**: the raiders carry off `raidShare` (40%) of its
  stores, its precious store included, and it makes nothing until it is
  repaired. It is still its owner's and still carries the chain. A burning
  district is not raided again.
- **Repairing** takes a builder `repairTimeShare` (10%) of a district's
  build time and `repairCostShare` (10%) of what a claim costs now; Gems
  finish it like any wait.
- **On the map**: a burnt district is charred, with fire at its foot and
  smoke rising. A raid to come is a dashed red arc from the camp to each of
  the player's districts it will raid, high in the middle and landing on an
  arrowhead, its dashes running from the camp to the district; the camp
  carries the time left on a red pill with crossed
  swords. The district's sheet says who raids it and when; the camp's sheet
  says which district it raids and that beating it first calls it off.
- The stand-in rivals are never raided.

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
| **Heartwood Grove** | **Grove Camp** | Heartwood (§7.4) |
| **Starfall Crater** | **Starmetal Dig** | Starmetal (§7.4) |
| **Moonglass Spires** | **Spire Quarry** | Moonglass (§7.4) |
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
- **A district has slots for its upgrades**: one; two on bare ground (the
  Rural district), which has no feature to work (`worldBuild.districts.*.slots`).
  An upgrade takes a slot from the moment it starts; raising its level
  takes none. A Shrine district's own Chapel fills its slot.
- **The Fortress fits any district**: three levels, garrisoned by an army,
  covering its hex and the six around it (§6.1).
- **The Chapel** hosts one world relic ([`../proposals/relic-restoration.md`](../proposals/relic-restoration.md) §5.2).
- **On the district's card**: each slot, empty (a tap opens the buildings
  that fit it, and a tap on one builds it) or holding its building (a tap
  opens what it does and its next level; a Chapel's relic socket opens the
  relic picker).

### 7.3 Stores

- **A producing district fills a store of its own**, as a province building
  does ([`03-economy.md`](03-economy.md) §3.2). A full store stops it.
- **A tap on its hex collects the store into the city's wallet**, free,
  once it is a quarter full or holds a precious lump; otherwise the tap
  opens the district's card.
- **Yield and store size are authored amounts per district**, times what the
  owner's research adds (`improvementYield`, `improvementStore`). The city
  sends that boost when it joins and after a research that moves it; the
  server settles every store at that moment, so nothing already made is
  repriced.
- An inactive hex's store stops filling and can still be collected.
- **The store goes with the hex.** A conquest hands it to the conqueror; a
  denial empties it. Collecting is the defence.

### 7.4 Precious materials

- **Three materials only the world yields**: Starmetal, Heartwood and
  Moonglass. They are goods ([`17`](17-workshops-and-goods.md) §1), kept with
  the refined goods, never made.
- **Each comes from a deposit of its own** — a feature, as a Forest is
  (§8): a **Heartwood Grove**, a **Starfall Crater**, **Moonglass Spires**.
  The district built on one yields only its material into a store:
  `perDay` (2) a day, holding `storeDays` (1) of it; the inner ring and
  research multiply it as they do any district. Explored, a deposit shows
  its material's icon; its sheet says *Yields …*.
- **Every seat is dealt 3/2/1**: three deposits of its **strong** material,
  two of its **middle**, one of its **weak**, in its corridor two to three
  hexes from its city (`worldGen.deposits`).
  - The six places are the same in every wedge; the material on each is the
    seat's deal.
  - **The bag:** the six orders of the three materials, one per seat,
    shuffled by the board's seed. Every material is strong for two seats,
    middle for two, weak for two — twelve deposits of each on the corridors.
  - **The inner ring** holds six more: the hex facing each seat is a deposit
    of that seat's weak material — two of each — guarded by the strongest
    camps (§5.4).
  - Deposits are conquered and denied like any hex (§6).
  - The player's own city sheet says their deal: *Your deposits: Starmetal
    ×3 · Heartwood ×2 · Moonglass ×1*.
- **Lumps** are any of the three alike:
  - a beaten camp pays `campPerPower` of its power (§5.4);
  - a scouting reward may be one (§3.2);
  - every dungeon room pays one (§8.1), and every fifth Portal floor
    (§10.4).
- **Why 3/2/1:** the three are asked for alike (§7.6), so alone the weak one
  sets the pace; trading one for one with friends (§7.5) evens them out and
  doubles it. Trade speeds the late city up; it never walls it off.

### 7.5 Trading

- **The materials are traded between friends**, on the wish board
  ([`15-social.md`](15-social.md) §2.4) — never on the world map.

### 7.6 What they buy

- **Never while the world is shut.** Until the Watchtower is claimed, no
  price asks for precious material: its terms are left off.
- **Early: a few, by name.** A building's level 4 asks 2 of one material
  and its level 5 asks 3 of another (the Townhall 5), the three asked for
  alike across the buildings; Farsight II, Scouts II and Pathfinding (the
  Atlas) ask 2 of one each. Fortress level 2 asks 10 of *any* — paid from
  what the player holds most of, after the named terms, the price showing
  the materials it will take.
- **Late: each of the three, named.** Levels 8–10 of every building but
  Housing name all three materials:

  | Buildings | Level 8 | Level 9 | Level 10 |
  |---|---|---|---|
  | producers and workshops | 2 each | 4 each | 6 each |
  | the Sanctum, the Tavern, the halls, the Infirmary, the War Camp | 4 each | 8 each | 12 each |
  | the Townhall | 10 each | 20 each | 30 each |

  Fortress level 3 asks 10 of each.
- **Research, from the middle of the tree on** — the deepest cards of each
  Kingdom chapter, more of them and dearer as the tree goes on:

  | Chapter | Cards | Each asks |
  |---|---|---|
  | 5 | 2 | 5 of any |
  | 6 | 3 | 10 of any |
  | 7 | 4 | 5 of each |
  | 8 | 5 | 10 of each |
  | 9 | 6 | 15 of each |

  A card's `goods` name materials; its `anyPrecious` asks for any
  (`tech-tree.json`, at `?dev=data#tree`).
- They are goods terms on a price: `buildings` › `costPerLevel` (`goods`,
  `anyPrecious`), `worldBuild.upgrades` › `levels`, and a technology's
  `goods` and `anyPrecious`.

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
| **Heartwood Grove**, **Starfall Crater**, **Moonglass Spires** | the deposits: their districts yield a precious material (§7.4). **Dealt, never rolled**: six a seat on its corridor, and the inner ring |

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
- **An army camps at the dungeon.** From the delve screen (§8.2) the player
  attacks its rooms one at a time; each fight resolves at once.
  - The camped army's losses and its heroes' wounds carry from room to room.
  - Recalling it marches it home, to be reinforced and sent again.
- **Depth N+1 opens when depth N's boss falls.** Nothing else gates a depth.
- **Every dungeon is 3 depths of 8 rooms**; the last room of a depth is its
  boss, which fields more and pays a multiple of a room.
- **Every room pays** Gold, Knowledge, Hero XP and Stardust, by depth and
  room ([`11-expeditions.md`](11-expeditions.md) §7.1), and a lump of
  precious material on the same scale (`precious`, §7.4). What a dungeon pays
  beyond its rooms — the found book — is **OQ-122**.
- **A dungeon is named when it appears** — *The Sunken Barrow* — from
  `nameFirst` and `nameSecond`; each sixth keeps its own first word, so no
  two standing share a name. It is held by the creature its rooms' formation
  fights as, and each depth has its boss (`bossNames`).

### 8.2 The delve

- **The dungeon's sheet has one button, Delve**, which opens the delve: a
  full-height menu.
- **The title**: the dungeon's name; under it *Depth 2 · Room 5 of 8*, who
  holds it, and who closes it and is paid for it.
- **Depth tabs** down the right edge: one per depth, ticked once cleared,
  locked until reached, each counting the kingdoms in it.
- **The descent**: the depth's rooms down a stair in the rock, one node each,
  with **every kingdom's shield on the room it has reached** — the
  player's own larger, *You*:
  - cleared — dimmed, ticked;
  - **the frontier** — lit, its power and what it pays, its precious lump
    included;
  - ahead — its power only;
  - **the boss** at the foot — his face, his name, his chest open with what
    he pays. No other room shows its enemy.
- **The army**, docked at the foot, as the deployment draws it: its power,
  its squads (up to 6) with their counts and the soldiers lost so far, its
  heroes (up to 3) with their HP. **Withdraw** and **Attack** (the frontier,
  at once, priced in Mana, §4). On its way: when it arrives, and Withdraw.
  None there: **Send**. To bring more troops, withdraw and send another
  army.
- **After a fight**, once it has played: the spoils over the descent — what
  the room paid and the soldiers it cost — with **Fight next** (or **Fight
  again** after a defeat) and **Back**.
- **On the map**, a dungeon's hex carries a ring filled as far as the player
  has gone, *13/24*, and a red badge while their army is camped there.
- **Every army of the player's carries its power** on a label under it, on
  the road, camped or in a Fortress.
- **The dungeon's card** has Delve, how deep the player has gone, and the
  race: every kingdom in it as the world ranking's rows, furthest first,
  opened on the player's own.

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
- **The deposits are dealt, not rolled** (§7.4): each seat's six on the
  same places of its wedge, the material on each from the seat's deal.
- **The inner ring is not rolled and not turned**: each of its hexes is a
  deposit of the weak material of the seat it faces, on the terrain authored
  for it (`worldGen.innerRing`) when the deposit stands on it.
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
| **Heartwood Grove** | Grassland, Plains (dealt) |
| **Starfall Crater** | Desert (dealt) |
| **Moonglass Spires** | Plains (dealt) |

- Features roll in the table's order; **the first that rolls and fits the
  terrain is kept**. Dungeon and Sanctuary are placed instead (above).
- The rules are data (`worldGen.featureRules`), and the inner ring obeys them
  too.
- Every feature has its own art, and so has every district
  ([`../plans/world-hex-art.md`](../plans/world-hex-art.md) §2).

## 10. The Dark Portal

A recurring timed event on the centre hex of every board — seven Portals a
world, on one clock. A player dives **any Portal their army reaches**; the
floors, the milestones and the ranking are **the world's**, one for all
seven. The reference is Infinity Kingdom's Endless Tower, not Rise of
Kingdoms — this is a depth ladder, and the genre's usual siege is not what
the centre is for.

### 10.1 The hex

- No terrain and no features.
- Never controllable, never buildable, by anyone.
- **Always revealed, for everyone, with no fog.**
- Armies march through it; it carries no connection and is nobody's hex.
- Between events it shows the portal dark, and a counter to the next opening;
  open, its vortex lit (`whex_portal`, `whex_portal_open`), turning, with a
  breathing glow, a column of light, motes circling the rim and sparks rising
  out of the pit — still under reduced motion.

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
- **Every floor fought costs Mana** (§4), won or lost.
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
- **Every `preciousEvery` (5) floors, a lump of precious material** —
  `precious` on the floors' scale, any of the three (§7.4). The
  Descend button says when the next floor pays one.
- **By milestone** — an exclusive reward for the first player to a given depth,
  reset every event.
- **By final rank** — Top 1 / Top 2–3 / Top 4–6, in Gems (`worldPortal.rankGems`),
  claimed from the notices once the opening closes
  ([`26-notices.md`](26-notices.md) §2.2).

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

## 12. The ranking

Every kingdom in the world, ordered by the hexes it holds. It pays nothing;
it is there to compare.

- **Hexes** = the city + every hex whose district stands under it. A hex still
  being claimed does not count yet.
- **Order**: most hexes first. Kingdoms with as many hexes share a place
  (1, 2, 2, 4).
- **Who**: every seat of the world, players and stand-in rivals alike; a free
  city is not ranked.
- **The widget** (mockup m100): on the world board, top left, under the
  explorers chip — "Ranking", the player's place and their hexes. A tap opens
  the list. Hidden behind any sheet.
- **The list** (mockup m101): one row a kingdom — its place on a ribbon (gold,
  silver, bronze, then wood), its crest, its name, its Townhall, a mark if it
  is a friend, its hexes. It scrolls.
  - The player's own row is gilded, and pinned again at the foot with how
    far the next place up is ("2 hexes behind #10"), or "First in this world".
  - A tap on a row closes the list and glides to that kingdom's city.
- **The Townhall** is told to the world server by each player's client, so a
  kingdom shows one once its player has been on the board. The stand-in rivals
  have none.

## 13. The dials, in the order to reach for them

| Dial | Moves | Reach for it when |
|---|---|---|
| **Army slots** (1, +1 per War Camp level) | everything — conflict, the Portal | the board feels too quiet or too violent |
| **Casualty replacement time** | how often a player can act at all | attacks are too cheap to repeat |
| **Army seconds per hex** (120) | the tempo of conquest | the board resolves too fast or feels like waiting |
| **Explorer seconds per hex** (60) and **work time** (30 + 30 a hex) | the tempo of exploring | the board opens too fast or too slowly |
| **Ground factors** (forest ×1.5, desert ×1.5, mountain ×3) | which ways are taken | terrain does not matter, or walls the board in |
| **Explorer slots** (Cartography, then the Atlas ladder) | how fast the board opens | exploring becomes the bottleneck |
| **Precious prices** — levels 4–5 by name, levels 8–10 each (§7.6) | how much the city needs the world and trade | the late city stalls, or ignores the world |
| **Deposit yield** (2 a day) and **places** (`worldGen.deposits`, 3/2/1) | how much of the world's materials the board makes, and how lopsided each seat is | late prices go unpaid, or nobody needs to trade |
| **Scouting hours by ring** and **reward lists** | what exploring pays, and how much the centre tempts | exploring feels like a toll, or out-earns the city |
| **Gold to explore** (2,500 × 1.5 a hex) | how much of the purse the board takes | exploring is free in practice, or crowds out building |
| **District cost and build time** | how fast territory spreads | the map is claimed out too early |
| **District yields**, the Rural district's a tenth of a House | what holding ground is worth | the world is not worth leaving home for, or out-earns the city |
| **Fight Mana** (1 h of regen) | how many fights a day | the board is fought too much, or not at all |
| **Camp power by ring** and **share** (0.65) | how much fighting expansion takes | the board opens too freely, or every step is a wall |
| **Camp return** (12 h) | how much there is to fight once the ground is cleared | the board empties, or a cleared border never rests |
| **Raid warning, gap and share** (1 h, 1–3 h, 40%) | how hard the camps press | border camps are ignored, or the board feels like a chore |
| **Camp loot** (Gold and Hero XP per power, 1 h of production per 1,000) | whether a camp is worth a fight | camps are skipped, or farmed |
| **Tribute premium** (×1.5) | what not fighting costs | nobody fights camps, or nobody pays one off |
| **Inner-ring multiplier** (+200%) | how badly the centre is wanted | nobody fights over ring 1, or everybody does |
| **Dungeon return time** (12–24 h) | how often a sixth has a dungeon to race for | dungeons sit closed too long, or never feel won |
| **Portal attempts per day** (3) | how much of the army the Portal eats | the Portal empties the board |
| **Reveal radius** (1, upgrading to 2) | how fast the board opens | exploring becomes the bottleneck |

## 14. Deliberately not in this design

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
- **Rewards for a place in the ranking**, or a ranking by anything but hexes.

**Open questions:** OQ-3 (season length — the shard is six players on 127 hexes,
the season is not set), OQ-122 in
[`../open-questions.md`](../open-questions.md).
