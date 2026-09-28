# 2 · Map scopes — which scope a thing is in, and who is authoritative over it

> **Scope.** The three scopes every system lives in, who owns each, what the
> save records, and what the promises allow to be contested. **Structural, not
> a map design**: the province's map is [`01`](01-map-and-fog.md), the world
> board is [`19`](19-world-map.md).
>
> **Status: designed, not built.**

## 1. Three scopes

| Scope | What it is | Authority | The verb | Lifetime |
|---|---|---|---|---|
| **Your province** | authored, **identical for every player**, square grid, buildable wherever it is revealed | client | build, tap, harvest | permanent, **inviolable** |
| **Temporary provinces** | event maps, PvE, compressed scale, square grid | client | the same verbs, inside a window | disposable |
| **The world board** | a shared pointy-top hex board, six players, outposts not cities | **server** for control, **client** for fog | explore, claim, contest | permanent, contestable |

### 1.1 Your province

- One authored map, identical for every player: `region-map.json` as it is. **No
  procedural province generator.**
- 1,470 cells; the whole fog costs **4,729,789,354 Gold** across the 1,466 that
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
- **A hexagon never opens a map of its own** (OQ-5). Contents sit on the hex;
  actions live in a dispatch sheet.

## 2. The two tempos

> **The province is tapped. The world is sent to.**

| | Province | World |
|---|---|---|
| The gesture | tap a cell, 1 Mana | send an army, and it marches |
| Resolves | now | over the march |
| Frequency | high, tactile | low, planning |
| It ends | yes — the fog is finite | no |

One tactile loop and one planning loop, across two or three visits a day.

## 3. Authority

- **The province is client-authoritative.** It is private, nobody else can
  observe it, and nothing another player does can reach it.
- **World control is server-authoritative.** Who holds a hex, and what is built
  on it, is contested state and cannot live in a save.
- **World fog is client-authoritative**, and lives in the player's own save: a
  small bitset over 91 hexes. It falls on the client side **because it decides
  nothing** — fog is information, never permission, and never blocks a move or
  an action.
- If fog is ever made to gate something — *you cannot attack what you have not
  explored* — it becomes server-authoritative state. **That is a deliberate
  decision, never a drift.**

## 4. Production is capped; timers are not

- Production — workers, taxes, Mana regen — stops at the 8-hour offline cap.
- **Timers resolve in full**, uncapped: the build queue, research, a gate's
  raid, event windows, **and every world-map march**.
- An army sent before a twelve-hour absence has arrived on return.
- Anything new that is time-based is classified as one or the other in its doc.

## 5. What the promises allow to be contested

> **Your city can never be attacked. Everything outside it can be.**

| Degree | What is contested | Breaks a promise? |
|---|---|---|
| Leagues and rankings | status | No |
| **Contested claim** — first to a hex keeps it | the opportunity | **No** — "opportunity that expires", with another player as the clock |
| **Territory that changes hands** — hold a hex, it produces for you, it can be taken | **the hex, never your property** | **No** — what is lost is future rent from something that was never in your city |
| **A garrison raiding your city** ([`18`](18-garrisons-and-raids.md)) | banked materials — bounded, and returned when it is cleared | **Yes, by design** — the one exception, and it is never another player |
| **Raiding another player's city** | their property | **Yes, head-on. Excluded** |

- Design rule, technical boundary and marketing line at once: **province private
  and client-authoritative, world shared and server-authoritative.**
- **An outpost is a claim, not a building.** If the hex falls, the player keeps
  everything it already produced.

## 6. The save shape

- **The save says which scope a thing is in.**
- World control is not in the save at all — it is server state (§3). What the
  save carries for the world is the player's **fog bitset** and their armies'
  whereabouts.
- The guild siege lives on the world board ([`15-social.md`](15-social.md) §6).
- This is larger than the `regions: Record<RegionId, RegionState>` reshape and
  **is not an early item**; the save shape is the one artefact that cannot
  change retroactively.

## 7. Build order

Each is playable without the ones after it.

1. **Temporary provinces** as the event format ([`13-events.md`](13-events.md)).
2. **The guild siege as the world's first place**: one hex, co-op, no board, no
   PvP, no fog — the world map with a single entry, on the code path the full
   scope will use.
3. **The board proper**: axial coordinates, neighbours, distance, march time,
   both zoom registers, client-side fog, the dispatch sheet
   ([`19`](19-world-map.md) §1–§4).
4. **Control**: outposts, connection, inactive hexes, improvements
   ([`19`](19-world-map.md) §5–§7).
5. **Contest**: attacks, conquest and denial, the Fortress, and server-side
   resolution — a deterministic scoring pass, not a simulation.
6. **The Dark Portal** ([`19`](19-world-map.md) §10).

## 8. Deliberately not in this design

- A procedural province generator.
- Server-authoritative world fog (§3).
- A hexagon that opens a map of its own (§1.3).
- Cities on the world board.
- Raiding a player's city (§5).
- Reusing `grid.ts` for the lattice (§1.3).
- Anything multi-region beyond the existing `regionId` discriminator.

**Open questions:** OQ-3, OQ-4, OQ-38 in
[`../open-questions.md`](../open-questions.md).
