# 2 · Map scopes — the province, the temporary provinces, and the world

> **Scope.** Where every future system lives. This is a structural decision
> rather than a feature: one of its consequences — the shape of the save —
> cannot be changed retroactively, which is why it is written down before it is
> built.
>
> **Status: designed, unstarted.** One piece of it is cheap enough to land
> early and is worth landing early: bounding the buildable plot (§7).

## 0. The problem, with numbers

The map is a single grid that is simultaneously the city canvas, the resource
hinterland and the adventure space. Two measurements say that cannot hold.

**The fog runs dry in an afternoon.** The whole map is **194,142 Gold** across
253 cells; a Townhall-3 city makes **~900 Gold/min idle**. That is **3.6 hours
of end-game income for the entire map** — the differentiator, the main Gold sink
and 253 hand-placed cells.

**And the influence radii oversubscribe the map before the fog even runs out.**
A district at level 3 covers Chebyshev radius 3 — **48 cells of influence** on a
253-cell map. Three Sawmills at L3 is 144 cells, 57% of everything. But the
binding constraint is worse: a Sawmill L3 fields **7 workers**, and the map
holds on the order of 13–17 forest cells. **Three maxed Sawmills are 21 worker
slots competing for 17 trees**, and the claim system (one worker per cell)
leaves the rest Idle.

So the map does not "eventually run out". **The buildings ask for more cells
than the map contains, long before the fog runs out of tiles to sell.**

## 1. Three jobs, and two of them contradict

| Job | Wants |
|---|---|
| **City canvas** — where buildings go | to be **finite and tight**; a tight plot is what makes placement a decision |
| **Resource hinterland** — what workers harvest | proximity and density |
| **Adventure space** — ruins, landmarks, the frontier | to be **inexhaustible**; it is the content treadmill |

Jobs 1 and 3 ask for opposite geometries. Size the map for the treadmill and the
canvas becomes infinite, so placement stops mattering. Bound it for the canvas
and the treadmill ends — which is the three-hour content cliff wearing a
different hat.

This also explains why **one adjacency rule** has never been enough (OQ-48). It
is not that rules are missing: **adjacency rules cannot matter on a canvas that
grows by buying tiles.** Scarcity is the precondition for spatial play.

## 2. What the genre does, which is unanimous

| Game | City | Exploration |
|---|---|---|
| Forge of Empires | bounded plot; **expansions** bought with diamonds, tech, quests | **Campaign Map**, separate — provinces negotiated or fought, paying expansions and goods back into the city |
| Elvenar | bounded plot + expansions (47 premium ones, diamonds-only) | **World Map** of provinces scouted → relics + expansions |
| Whiteout / Kingshot / Last War | fixed plot, grows by building levels not tiles | shared server map |
| Township | plot + land expansion paid with **tools from trains** | mine, zoo, islands, Expedition — each its own screen |
| Family Island | one island | **other islands** — Adventure Island expeditions |

**The city is bounded, plot growth is a reward earned elsewhere, and exploration
lives in a separate scope.** Nobody puts both on one grid.

## 3. Three layers

| Layer | What it is | Authority | Verb | Lifetime |
|---|---|---|---|---|
| **Your province** | authored, **identical for every player**, bounded plot | client | build, tap, harvest | permanent, inviolable |
| **Temporary provinces** | event maps, PvE, compressed scale | client | the same verbs, inside a window | disposable |
| **The world map** | shared node graph, **outposts not cities** | **server** | send, claim, contest | permanent, contestable |

### 3.1 Why an identical authored province is the right call

One map to balance, one FTUE to tune — and the quest chain is already pinned
beat by beat against it — and **retention numbers that are comparable between
players**, which is what the prototype has to measure. It also removes the
procedural region generator from the plan entirely: `region-map.json` stays as
it is.

### 3.2 Why the province plot must be bounded

So that placement is a decision, moving a building is a decision, and adjacency
has something to bite on. Growth comes in **authored increments** — an
expansion block, not a tile — which is the Forge of Empires and Elvenar model.
The Gold curve for expansions can then be priced indefinitely, instead of
draining a finite inventory of 253 cells.

### 3.3 Temporary provinces are how the province mechanic survives

The failure mode this whole document exists to avoid is a **transition**: the
game you learned in week one being gone by month two. The fix is that the
province's verbs never retire — they become **the event format**.

That is already the plan. [`13-events.md`](13-events.md) §2.3 specifies the
event minigame as *a small map, shrouded, where event points buy reveals and the
rewards are under the fog.* Naming it a temporary province changes nothing about
the work and clarifies what it is.

Precedent in the exact comparable set: Family Island's **Adventure Island**
expeditions, Township's **Expedition**, Klondike's sled expeditions, Sunrise
Village's **Maze**.

The payoff: **every content drop reuses the most expensive systems already
built** — fog, harvest, placement, workers, exhaustion — instead of needing new
ones. An event becomes a map and a reward table.

**A lightweight state module, not a region.** No buildings, no workers, no
economy: things are *found* there, not produced. That avoids the `GameState`
reshape and is a dry run for it.

### 3.4 The world map is a node graph, not a tile grid

- A graph **generates procedurally** in a few lines; 253 hand-placed cells do
  not.
- A node is a large tap target. A tile at the current zoom floor is ~29 px,
  under both the 44 pt (Apple) and 48 dp (Material) minimums.
- It is what an expedition actually needs: a ruin is a **destination**, not
  somewhere you build. Today dungeons sit between wheat fields, which also
  forces the province grid out to distance 12.
- It makes a second region a data row.

**Outposts, not cities:** one or two structures per node, so the placement verb
survives at world scale without multiplying city management. A player with N
cities is a player with an N× session, and the budget is ~30 min/day.

## 4. The verb split, and the expensive problem it deletes

> **The province is tapped. The world map is sent to.**

Province: tap a tile, 1 Mana, something happens now — tactile, high frequency.
World map: dispatch a party, a caravan, a claim, and it resolves over time —
planning, low frequency. A 30-minute budget across two or three visits wants
**one tactile loop and one planning loop**, not two competing for the same
thumbs.

And that deletes the hardest technical requirement. If the world map is not
tapped cell by cell, **it does not need per-cell fog**. Per-(player × cell) fog
on a shared map is an enormous table and, as far as we can tell, **nothing in
the genre does it** — the shared-map 4X titles show the whole world.

> **World fog is derived, not stored.** Persist only *which nodes the player has
> touched* — a handful of ids — and compute the fog client-side as a radius
> around them. State goes from O(cells) to O(nodes visited).

That is the same shape as the claim discover radius, which already lifts fog
around a claimed landmark and leaves the cells **Discovered, never Revealed**.
The Discovered/Revealed distinction the game already has *is* a world layer in
embryo.

Revealing a world node costs **Gold and time, scaling with distance** —
Elvenar's scouting. **Not Mana** ([`09-relics.md`](09-relics.md) §3). That also
gives Gold a sink at world scale, which it badly needs once the province's
194,142 is spent.

## 5. How much PvP the promises allow

Promise 1 says, in as many words: *nothing you own is ever taken from you. **No
raids**, no decay, no starvation, no failure state. Pressure comes from
opportunity that expires.*

"PvP" is a gradient and only its far end breaks that.

| Degree | What is contested | Breaks promise 1? |
|---|---|---|
| Leagues and rankings | status | No |
| **Contested claim** — first to a node keeps it | **the opportunity** | **No** — "opportunity that expires", with another player as the clock |
| **Territory that changes hands** — hold a node, it produces for you, it can be taken | **the node, never your property** | **No** — what is lost is future rent from something never in your city |
| Raiding another player's city | **their property** | **Yes, head-on** |

> **Your village can never be attacked. Everything outside it can be
> contested.**

That is a design rule, a technical boundary and a marketing line at once, and it
lands exactly on the scope split: province private and client-authoritative,
world map shared and server-authoritative.

**It is not a theory.** Guild Battlegrounds moves provinces between guilds every
hour, Tournaments and the Spire are competitive, there are leagues with
promotion and relegation — and **nobody ever loses a building in their city** in
either Forge of Empires or Elvenar. Twelve and nine years of territorial PvP
with no looting, in *this* quadrant rather than the survival 4X one.

**An outpost is a claim, not a building.** If it falls, the node reverts to
unclaimed and the player keeps everything it already produced.

## 6. What the world map uniquely gives — and how the loop closes

The test this document is built on: **does the outer scope feed the inner one?**
If it does not, it is a transition and the player will notice the game was
swapped.

| The world map pays | Which lands in |
|---|---|
| **3★ relic ingredients** — its exclusive output | the collection arc, whose passives improve the province economy |
| **Plot expansions** | a bigger province |
| Resources the province cannot produce | province sinks |

The loop: world → 3★ → maxed relics → economy passives → a stronger province →
more capacity to contest the world. Same structure as Guild Expeditions → goods
and blueprints → Great Buildings → city economy, which has run twelve years.
Rarity split: [`09-relics.md`](09-relics.md) §2.

## 7. The minimum to spend now

This is larger than the `regions: Record<RegionId, RegionState>` reshape that
was deliberately deferred, and it is **not** an early item. But the argument
applies with more force here: **the save is the only artefact that cannot be
changed retroactively.** A save that assumes one grid where city and content
coexist makes scope separation later a migration nightmare.

1. **Bound the buildable area in data** — a `city.maxBuildDistance` or a
   buildable flag on the plot. A balance number, not a refactor, and it puts the
   placement decision **inside the prototype**, which is a 30-day-retention
   question. Adjacency starts earning its keep the same day. (OQ-1.)
2. **Leave the fog as it is**, but stop treating "more tiles" as its only
   reward: the far ring pays **content access**. Nearly true already — ruins and
   landmarks sit at distance 3–12 and the far cells are mostly mountain and
   water, which are not buildable.
3. **Let the save say which scope a thing is in.** Cheap now, impossible later.
4. **Move the siege to the world map in the design** — which is what
   [`15-social.md`](15-social.md) §6 does.

## 8. Staged build

Each step is playable before the next exists.

1. Bound the plot. Expansions as authored increments.
2. **The world map's first node is the guild siege** — a screen showing one
   node, co-op, no shard, no PvP. It is the world map with a single entry, and
   the same code path the full scope needs later.
3. Temporary provinces ship as the event format ([`13-events.md`](13-events.md)).
4. The node graph proper: generation, scouting, derived fog, outposts.
5. Shards, seasons, and contested claims — the point at which PvP exists.
6. Server-side combat resolution. Feasible because combat is a deterministic
   scoring pass rather than a simulation — ATK/DEF/HP, a type chart, one pass.

## 9. Deliberately not in this design

A procedural province generator · per-cell shared-map fog · cities on the world
map · raiding (§5) · anything multi-region beyond the `regionId` discriminator
that already exists.

**Open questions:** OQ-1, OQ-2, OQ-3, OQ-4, OQ-5 in
[`../open-questions.md`](../open-questions.md).
