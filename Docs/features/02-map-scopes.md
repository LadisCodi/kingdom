# 2 · Map scopes — which scope a thing is in, and who is authoritative over it

> **Scope.** The three scopes every system lives in, who owns each, what the
> save records, and what the promises allow to be contested. **Structural, not
> a map design**: the province's map is [`01`](01-map-and-fog.md), the world
> board is [`19`](19-world-map.md).
>
> **Status:** the province is built; the world board is built against a local
> stand-in for the world server ([`19-world-map.md`](19-world-map.md)).
> Temporary provinces and the guild siege are not built.

## 1. Three scopes

| Scope | What it is | Authority | The verb | Lifetime |
|---|---|---|---|---|
| **Your province** | authored, **identical for every player**, square grid, buildable wherever it is revealed | client | build, tap, harvest | permanent, **inviolable** |
| **Temporary provinces** | event maps, PvE, compressed scale, square grid | client | the same verbs, inside a window | disposable |
| **The world board** | a shared pointy-top hex board, six players, districts not cities | **server** for control, **client** for fog | explore, claim, contest | permanent, contestable |

### 1.1 Your province

- One authored map, identical for every player: `region-map.json` as it is. **No
  procedural province generator.**
- 1,470 cells; the whole fog costs **2,522,803,392 Gold** across the 1,466 that
  are priced.
- **The buildable plot is the revealed province** — no bound, no ring, no
  expansion to buy ([`05-city-and-districts.md`](05-city-and-districts.md) §4).
  **Paying the fog is what buys room.**
- What guides a layout is **adjacency, not permission**
  ([`03-economy.md`](03-economy.md) §3.1): a placement can be better or worse,
  none is illegal.
- Square grid with its three distance metrics ([`01`](01-map-and-fog.md) §1).

### 1.2 Temporary provinces

- The province's verbs as **the event format**: a small shrouded map where event
  points buy reveals and the rewards are under the fog
  ([`13-events.md`](13-events.md) §2.3).
- Reuses fog, harvest, placement, workers and exhaustion. An event is a map plus
  a reward table.
- **A lightweight state module, not a region**: no buildings, no workers, no
  economy. Things are *found* there, not produced. No `GameState` reshape.

### 1.3 The world board

Designed in full in [`19-world-map.md`](19-world-map.md). What belongs here is
only what it is structurally:

- 91 hexes, six players, **real axial coordinates**. `grid.ts` is square-grid
  maths with three metrics and is **not** reused.
- No code shared with the province: no workers, no influence radius, no
  adjacency that pays Gold.
- **A hexagon never opens a map of its own.** Contents sit on the hex;
  actions live in a dispatch sheet.

## 2. The two tempos

> **The province is tapped. The world is sent to.**

| | Province | World |
|---|---|---|
| The gesture | tap a cell, 1 Mana | send an explorer or an army, and it marches |
| Resolves | now | over the march |
| Frequency | high, tactile | low, planning |
| It ends | yes — the fog is finite | no |

One tactile loop and one planning loop, across two or three visits a day.

## 3. Authority

- **The province is client-authoritative.** It is private, nobody else can
  observe it, and nothing another player does can reach it.
- **World control is server-authoritative.** Who holds a hex, and what is built
  on it, is contested state and cannot live in a save.
- **World fog gates actions**: a hex must be Revealed before it is claimed,
  built on or sent an army ([`19-world-map.md`](19-world-map.md) §3).
- **So world fog is server-authoritative** — the server checks it. Until the
  real server exists the fog lives in the player's save (a bitset over 91
  hexes) and the client applies the rule; the local stand-in trusts it.

### 3.1 Armies on the server

- **An army is server state from the moment it leaves.** Sending one takes
  its troops off the roster and marks its heroes busy in the save; the server
  holds the army until it is home.
- **Every army fight is resolved on the server**, with the same resolver
  ([`combat.md`](combat.md)): attacks, garrisons, dungeon rooms and Portal
  floors.
- **A march is resolved when the board is read.** Before answering any read
  or action on a board, the server resolves every march that has arrived, in
  order of arrival time, ties broken by hash. The outcome never depends on
  when anyone looks.
- **What comes home is a server effect**: the survivors, the heroes' wounds,
  and every reward, collect and battle report. Effects are drained at load,
  before the offline advance ([`15-social.md`](15-social.md) §1.2).
- **The server trusts the party the client sends**: its troops, levels and
  bonuses are not validated (prototype, as [`15-social.md`](15-social.md)
  §1.1).

## 4. Absences are replayed in full

- There is no offline cap. An absence is replayed whole by the same advance
  the live tick runs.
- **Production is bounded by its own ceiling**: each building's store, each
  world improvement's store, the Mana pool, the Knowledge bar, the workshop
  and training queues
  ([`03-economy.md`](03-economy.md) §3.2).
- **Timers resolve in full**: the build queue, a lair's raid, event windows
  and an explorer's march. An army's march is resolved on the server (§3.1).
- An army sent before a twelve-hour absence has arrived on return.
- Anything new that is time-based and produces names its ceiling in its doc.

## 5. What the promises allow to be contested

> **Your city can never be attacked. Everything outside it can be.**

| Degree | What is contested | Breaks a promise? |
|---|---|---|
| Leagues and rankings | status | No |
| **Contested claim** — first to a hex keeps it | the opportunity | **No** — "opportunity that expires", with another player as the clock |
| **Territory that changes hands** — hold a hex, it produces for you, it can be taken | **the hex, never your property** | **No** — what is lost is future rent from something that was never in your city |
| **A garrison raiding your city** ([`18`](18-garrisons-and-raids.md)) | materials waiting uncollected in the buildings' stores — bounded, and returned when it is cleared | **Yes, by design** — the one exception, and it is never another player |
| **Raiding another player's city** | their property | **Yes, head-on. Excluded** |

- Design rule, technical boundary and marketing line at once: **province private
  and client-authoritative, world shared and server-authoritative.**
- **A district is a claim, not a building.** If the hex falls, the player keeps
  everything they already collected from it; what sits in its stores goes
  with the hex ([`19`](19-world-map.md) §7.3).

## 6. The save shape

- **The save says which scope a thing is in.**
- World control is not in the save at all — it is server state (§3). What the
  save carries for the world is the player's **fog bitset** and their
  explorers' whereabouts. Armies are server state.
- The guild siege lives on the world board ([`15-social.md`](15-social.md) §6).
- This is larger than the `regions: Record<RegionId, RegionState>` reshape and
  **is not an early item**; the save shape is the one artefact that cannot
  change retroactively.

## 7. Build order

Each is playable without the ones after it.

1. **The board proper**: axial coordinates, neighbours, distance, march time,
   both zoom registers, client-side fog, explorers, the dispatch sheet
   ([`19`](19-world-map.md) §1–§3).
2. **Control**: districts, connection, inactive hexes, upgrades and their
   stores ([`19`](19-world-map.md) §5, §7).
3. **Contest**: armies, attacks, conquest and denial, the Fortress, resolved
   on the server (§3.1; [`19`](19-world-map.md) §4, §6).
4. **Dungeons** ([`19`](19-world-map.md) §8.1).
5. **The Dark Portal** ([`19`](19-world-map.md) §10).
6. **The guild siege**, with the social layer ([`15-social.md`](15-social.md) §6).

**Temporary provinces** ([`13-events.md`](13-events.md)) are independent of
the board and can come at any point.

## 8. Deliberately not in this design

- A procedural province generator.
- A hexagon that opens a map of its own (§1.3).
- Cities on the world board.
- Raiding a player's city (§5).
- Reusing `grid.ts` for the lattice (§1.3).
- Anything multi-region beyond the existing `regionId` discriminator.

**Open questions:** OQ-3, OQ-4, OQ-38 in
[`../open-questions.md`](../open-questions.md).
