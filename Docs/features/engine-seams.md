# Engine seams: what the long game needs from the sim

> Design doc for five pieces of engine groundwork that let seasons, events,
> spells, banners and gacha arrive later as **data rather than as rewrites** —
> plus the two worked examples that prove them.
> Status: **built** (2026-09-02), in the order §8 prescribes. The boundary
> loop is in `src/sim/commands.ts`; the rest are `modifiers.ts`, `rng.ts`,
> `timeline.ts`, and the migration chain in `save.ts`.

Companion docs: [`magic.md`](magic.md), [`expeditions.md`](expeditions.md),
[`heroes-and-gacha.md`](heroes-and-gacha.md).

## Why this exists

The sim core is in good shape — pure TypeScript, no DOM, no clock, `now` always
passed in, and a single `advance(state, map, toTime)` serving both the live 1 s
tick and offline replay. That determinism is the prototype's best asset and a
hard constraint on everything below.

But it has no vocabulary for anything that *happens on a schedule* or *stops
being true*:

- Effects come only from upgrade **levels**, read through five `effectiveX`
  helpers in `src/sim/upgrades.ts`. Nothing can apply a temporary or
  externally-sourced effect.
- `type Rng` is declared (`src/sim/state.ts:155`), exported
  (`src/sim/commands.ts:258`) and **never called** anywhere in `src/` or `tests/`.
- The save is a monolith that **rejects older versions and starts a fresh game**,
  so any content drop during live operation would wipe players.
- `advance()` interleaves its continuous sims but applies research **once at the
  end** (`src/sim/commands.ts:250`) — a real live-vs-offline divergence.

Every feature in the companion docs needs at least one of these. None of them
should be invented twice.

---

## 1. An earliest-next-boundary loop in `advance()`

**Files:** `src/sim/commands.ts`. New `tests/advance.test.ts`.

Today the loop pivots **only** on build-queue completion times
(`commands.ts:230-235`), then calls `advanceResearch` once at `toTime`
(`commands.ts:250`). A tech completing mid-window therefore applies at the very
end during a single-call offline replay, but immediately when live-ticking.

Split the loop body into two named pieces and let a `nextBoundary()` function own
the pivot set:

```ts
/** Discrete work due AT `t`: everything that changes another subsystem's inputs. */
function applyDueAt(state, map, t, builders, out) {
  for (const item of advanceQueue(state.city.queue, t, builders)) {
    completeQueueItem(state, map, item, Math.min(completesAt(item), t));
    out.completedItems.push(item);
  }
  out.completedResearch.push(...advanceResearch(state, t));
  // + pruneExpiredModifiers(state, t)      §2
  // + advanceSchedule(state, t, out)       §5
}

/** The continuous sims, run only BETWEEN boundaries. */
function runContinuous(state, map, t, out) {
  advanceRespawns(state, map, t);
  out.deposits.push(...advanceWorkers(state, map, t));
  const life = advanceCityLife(state, t);
  out.goldEarned += life.gold;
  out.trainedPopulation += life.trained;
}

/** Earliest moment STRICTLY after `after` at which discrete work becomes due.
 *  Adding a source is one loop. */
function nextBoundary(state, after, builders) {
  let t = Infinity;
  const consider = (at) => { if (at > after && at < t) t = at; };
  for (const item of state.city.queue.slice(0, builders))
    if (item.startedAt !== null) consider(completesAt(item));
  for (const a of state.research.active) {
    const at = techCompletesAt(state, a.id);
    if (at !== null) consider(at);
  }
  // + modifier expiries                    §2
  // + schedule starts and ends             §5
  return t;
}
```

The loop then becomes: `applyDueAt(cursor)` → find `nextBoundary` → if it is past
`toTime`, break → `runContinuous(next)` → advance the cursor. After the loop,
`runContinuous(toTime)`.

### Three properties worth stating in the file header

1. **Termination is structural.** `consider` only accepts `at > after`, and
   `applyDueAt(cursor)` drains every source at `cursor` before `nextBoundary` is
   asked, so the cursor strictly increases. A step cap is a seatbelt only.
2. **Boundaries are absolute-time, not tick-relative.** This is *why* stepped
   ticking and one-call replay converge exactly rather than approximately. A tech
   completing at `C` splits the window at `C` in both paths, identically.
3. **A boundary landing exactly on `toTime` is still applied**, because
   `applyDueAt` sits at the top of the loop body. `tests/research.test.ts:35-38`
   relies on this.

Deliberately preserved: there is **no** trailing `applyDueAt(toTime)`. The
current code never calls `advanceQueue` at `toTime` either, and adding one would
change when a newly enqueued item is stamped.

### The regression test

`Communities` (90 s) adds +1 capacity to every district housing anyone
(`population.ts:18`). With two L1 Housing (capacity `[2,4]` → 4) and population
5, housed goes 4 → 5 and `cityGoldPerMinute` goes 120 → 150 the instant it lands.

Over a 120 s window: the old code accrues 120 s at 120/min = **240 Gold**; the
correct answer is 90 s @ 120 + 30 s @ 150 = **255 Gold**. Red before, green
after, and comfortably outside rounding noise. Put it beside
`tests/taxes.test.ts:43-60`, which covers the same property for training.

**No existing test needs updating** — the change is behaviour-preserving for
every path except research-mid-window, which nothing currently asserts.

### Do not promote respawns to boundaries

`advanceRespawns` stays inside `runContinuous`, where it is today. Over an 8 h
replay `featureRespawns` can cycle dozens of times per finite feature, and each
boundary costs a full `advanceWorkers` sweep — `O(workers × workableCells)` with
a fresh allocation per worker (`workers.ts:103-115`, `grid.ts:91`). Thousands of
boundaries would turn a ~10-iteration replay into a multi-second one. There is a
small symmetric inaccuracy here (a batch-placed feature can be worked
retroactively, because an idle worker's wake time is
`max(w.stateStartedAt, recoversAt)` at `workers.ts:111`); both paths do the same
wrong thing, so nothing observes it. Fixing it is one `consider()` line plus a
`wakeIdleWorkersAt` call — but it should be its own change, with its own test and
a perf measurement.

---

## 2. The modifier layer

**Files:** new `src/sim/modifiers.ts`; `state.ts`, `upgrades.ts`, `commands.ts`,
`save.ts`, `population.ts`. New `tests/modifiers.test.ts`.

```ts
export type ModifierStat =
  | 'tapYield' | 'workerYield' | 'salePrice' | 'taxRate' | 'autoTapCooldown'
  | 'manaRegen' | 'revealCost' | 'cellRecovery';

export interface Modifier {
  id: string;                      // newId() — deterministic, persisted
  source: 'artifact' | 'season' | 'event' | 'hero' | 'debug';
  stat: ModifierStat;
  scope: CurrencyId | HarvestSourceId | DistrictId | null;  // null = all
  op: 'add' | 'mul';
  value: number;
  expiresAt: number | null;        // half-open: active while t < expiresAt
}
```

Lives at the **top level of `GameState`**, next to `upgrades` (`state.ts:139`) —
not inside `city`, because artifact passives, seasons and hero traits are
kingdom-scoped concepts.

The five `effectiveX` helpers become **base → upgrade levels → modifier stack**.

### Resolution

**All adds summed, then all muls multiplied**, matching what upgrades already do
(additive on flat yields at `upgrades.ts:39,75`, multiplicative on rates at
`upgrades.ts:81,85`).

**Fold in `id` order.** Floating-point addition and multiplication are not
associative, so two clients with the same set of modifiers in different array
order could differ in the last bit. Sorting converts "order happens to be
preserved" into "order is irrelevant". Stacks are tiny; the sort is free.

**An empty stack is the bit-exact identity** — `(base + 0) × 1 === base`. This is
what lets the layer ship without touching a single existing assertion.

Integer stats (`tapYield`, `workerYield`) round **once**, at the `effectiveX`
boundary, because they feed `addToWallet` directly and a fractional wallet would
leak into quest counters, the Market and every displayed number. `Math.round`,
not `floor` — flooring makes small multipliers useless at base-1 yields.

### How expiry is enforced, given the sim is pulled not pushed

Two mechanisms, and neither requires threading `now` through the helpers:

1. **Push side (correctness):** `expiresAt` is a boundary source in
   `nextBoundary`, and `applyDueAt` calls `pruneExpiredModifiers(state, t)`. A
   continuous accrual can therefore never straddle an expiry at the wrong rate —
   the window is split at the expiry instant in both live and offline paths.
   Without §1 this seam is simply broken; with it, it is free.
2. **Pull side:** `resolve` filters on `isActive(m, state.lastAdvance)` — **the
   sim's own clock, read off state**, not a `now` parameter.

Threading `now` was rejected deliberately: `effectiveTaxRate` is reached from
`accrueTaxes` and from three UI files, `effectiveTapYield` from `tapCell` and
`game.ts`, and so on. It would be a wide, noisy diff across `population.ts`,
`market.ts`, `harvest.ts`, `workers.ts`, `game.ts` and several `ui/` files — and
it would introduce two notions of "now" that can disagree.

**The invariant to enforce by review: the modifier stack is exact as of
`state.lastAdvance`.** Residual staleness is a UI read inside one tick (≤1 s,
cosmetic) or a player command between ticks using a buff that lapsed
milliseconds earlier (sub-second, in the player's favour).

Half-open (`active while t < expiresAt`) matches `recoverIfDue`
(`harvest.ts:50-55`). Keep them consistent.

### Two clients on day one

Artifacts make this non-speculative: **passives are permanent modifiers**
(`expiresAt: null`), **actives are timed ones**. Both shapes exercised from the
first feature that uses the layer.

### Land `repriceTaxAnchor` here

`population.ts:164-167` reprices `lastTaxAt` when a training completion changes
the tax rate, so the partial stretch since the anchor is not repriced at the new
rate. Nothing does this for a Housing completing, `Communities` landing, or a
`taxRate` modifier expiring. Extract it and bracket `applyDueAt`'s body with a
`cityGoldPerMinute` before/after pair — one call site then covers every boundary
kind forever.

Expect a possible ±1 Gold shift in one or two assertions in `taxes.test.ts` or
`save.test.ts`. That is the change being honest, not a regression.

### Do not re-express upgrade levels as modifiers

Superficially elegant, actually a regression: upgrade levels are persisted as
levels, purchasable, and priced on a curve (`upgrades.ts:15-30`). Converting them
means a save migration plus rebuilding stack entries on every purchase. Keep the
three-stage pipeline.

---

## 3. Seeded, replay-safe randomness

**Files:** new `src/sim/rng.ts`; `state.ts`, `newGame.ts`, `harvest.ts`,
`save.ts`, `commands.ts`. New `tests/rng.test.ts`.

**Counter/hash, not a stateful stream.** Four reasons, in order of how much each
would hurt:

1. **A stream makes a draw depend on how many draws came before it — and this sim
   does not guarantee that count is the same in both paths.** `advance()`
   deliberately groups work differently in one-call replay versus stepped
   ticking. Any consumer whose *number* of rng queries varies with grouping
   silently desyncs the two paths, and the failure surfaces as a state divergence
   thousands of draws downstream from the cause. A hash makes the value a pure
   function of the **identity of the event**, so grouping is irrelevant by
   construction — a strictly stronger guarantee than "we were careful".
2. **Content drift.** Adding a random consumer mid-season shifts every subsequent
   draw for every existing player under a stream. Under a hash, a new consumer
   occupies a new key namespace and disturbs nothing.
3. **Save/load is trivial** — persist one integer. No cursor to keep consistent
   with a partially-replayed window, and no question about what the 8 h cap's
   time-shift does to it.
4. **It is already the proven pattern here.** `harvest.ts:121-125` uses exactly
   this shape for respawn placement, which is why
   `tests/respawn.test.ts:87-100` is green.

The one case a stream wins — a long unkeyed sequence like a gacha pity deck — is
a non-problem: the pull counter *is* the key, and it has to be persisted for pity
anyway.

```ts
/** [0, 1). `parts` must identify the EVENT, never the moment it was queried. */
export const rand = (seed: number, ...parts: (string | number)[]): number => …
export const randInt = (seed, max, ...parts) => …
export const pick = <T>(seed, items: readonly T[], ...parts): T => …
```

All arithmetic integer (`Math.imul`, `>>> 0`) so results are bit-identical across
JS engines — the sim is meant to be portable to a server. **Mix a separator
between parts**, or `('ab','c')` and `('a','bc')` collide, which is a real
footgun once keys are composed from coord keys.

### Wiring

- `state.ts`: add `seed: number`. **Delete `Rng` (`state.ts:155`)** and its
  re-export (`commands.ts:258`) — a `() => number` closure cannot be persisted
  and is precisely the abstraction this design rejects.
- `harvest.ts`: delete `pickIndex` (121-125); use
  `pick(state.seed, candidates, 'respawn', r.origin, r.generation)`.
- `save.ts`: `'meta.seed'` alongside `'meta.nextId'` (`save.ts:164`).

**No existing test needs updating** — respawn tests assert Chebyshev-1 adjacency
and set membership, never a specific coordinate.

`tests/rng.test.ts` must pin a **hardcoded expected value** for a fixed
`(seed, key)` pair, so a future "harmless refactor" of the mixer cannot silently
reshuffle every player's world.

---

## 4. Save migration chain

**Files:** `src/sim/save.ts`, `definitions.ts`, `main.ts`.

The insight that keeps this small: **every module read is already defensive**
(`save.ts:180, 211, 217, 227, 246, 256, 270, 279, 289, 295, 303` are all
`if (dto)` + `?? default`). So an **additive** change — a new module key, a new
optional field — needs *no migrator at all*: bump `SAVE_VERSION` and let the
reader default. Migrators exist only for renames, reshapes and semantic changes.
Design for that reality instead of building a general framework.

```ts
export const MIN_MIGRATABLE_VERSION = 16;   // below this: fresh game

const MIGRATIONS: readonly Migration[] = [   // ordered, gap-free, append-only
  // { to: 17, migrate: (m) => { …reshape… } },
];
```

Two one-liners worth doing at the same time:

- **Reject `version > SAVE_VERSION`.** A newer save synced from another device
  (`saveManager.ts:24-30`) must not be read by an older client as if current.
- **Wrap `deserialize` at `main.ts:43` in try/catch.** Today a corrupt or
  unexpected save throws out of `boot()` and **white-screens the app** rather
  than starting fresh — a worse failure than the one being fixed.

`save.test.ts:45-49` ("v1 saves are rejected") stays green: v1 is below
`MIN_MIGRATABLE_VERSION`. Do not build a fixture harness before there is a second
version to fixture.

**This lands before every feature that persists new state**, so each becomes a
version bump with a zero-length migrator rather than a player wipe.

---

## 5. The timeline

**Files:** new `src/sim/timeline.ts`; `commands.ts`, `save.ts`.

```ts
export interface ScheduledEntry {
  id: string;
  startsAt: number;
  endsAt: number | null;          // null = instant, fires onStart only
  payload: SchedulePayload;       // grantModifier | grantReward | banner | marker
  /** THE termination guarantee: applyDueAt transitions the phase, so the same
   *  boundary can never be proposed twice. Without it the loop can spin. */
  phase: 'pending' | 'active' | 'done';
}
```

Integration surface is two `consider()` lines in `nextBoundary` and one
`advanceSchedule` call in `applyDueAt`. Handlers must be **pure functions of
`(state, entry, t)`** — no closures over UI, or the sim stops being pure and the
determinism argument collapses.

`phase` must persist: an event that already paid out must not pay again on
reload.

### Three things that are easy to get wrong

1. **Catalogue reconciliation, not save-baking.** Authored entries must be merged
   into `state.schedule` at load from the *build's* catalogue, **before** the
   offline advance at `save.ts:311` — otherwise a save written before a content
   drop never learns the new event exists.
2. **Windows that opened *and* closed during an absence must still fire.** They
   will, because boundaries are absolute and reconciliation happens before the
   replay. That is the payoff.
3. **The 8 h cap will swallow event rewards.** A 20 h absence spanning a 24 h
   window replays only 8 h of it. Timed-event rewards almost certainly should not
   be capped the way idle income is. **This is a product decision — flag it at
   `save.ts:310`, do not invent a policy.**

### The rule that resolves the cap question everywhere else

> The offline cap limits what the **city produces** while you are away. It never
> limits what a **timer** does.

Build queue, research, delve depths and event windows are timers. Workers, taxes
and Mana regen are city production.

### Where schedules live

A hand-written `src/sim/data/events.json`, **not** the workbook. The xlsx is for
numbers designers tune; event schedules are live-ops content with wall-clock
dates, typically server-driven and changed after ship. If a season's
*magnitudes* need tuning, those belong in a modifier-template sheet referenced by
id from the payload.

### Do not build this speculatively

The boundary machinery in §1 is the valuable half and it stands alone. The entry
list, handler registry and reconciliation are ~120 lines whose shape the first
real consumer dictates. Build them **with** the Conjunction and the gacha banner
— which is what §7 does — not before.

---

## 6. Region discriminator

**Files:** `state.ts`, `save.ts`, `grid.ts`. About ten lines.

`export type RegionId = 'oakville'`, `regionId` on `GameState`, serialized
top-level, and `buildMapData(regionId = 'oakville')` reading a `REGIONS` table
instead of the bare import at `grid.ts:6`. The default keeps `helpers.ts:10` and
`main.ts:36` working unchanged.

**Why ten lines now rather than zero:** the save file is the only artefact you
cannot retroactively change. Every save written before the field exists is
*ambiguous* once a second region appears, and "it must be the first one" is a
guess that fails for anyone mid-migration.

**Explicitly not now:** namespacing module keys; restructuring `GameState` into
`regions: Record<RegionId, RegionState>` (that moves `city`, `fog`, `features`,
`harvest`, `workers` down a level and touches every sim file and every test);
multi-chain quests; per-region generation in `scripts/balance.mjs`.

---

## 7. The worked examples

Two consumers prove the seams rather than asserting them.

### The Conjunction

A 48-hour window every 7 days. Seeded RNG picks the week's boon — mana regen ×2 ·
active costs −50% · Knowledge ×3 · delve speed ×2 · **a free attunement slot for
the window** — it applies as a modifier, pays a Knowledge lump on opening, and
closes.

Every primitive at once: the timeline schedules it, the RNG picks it, a modifier
applies it, the deadline is the pressure. The free-slot boon earns its keep by
making this week's loadout decision different from last week's.

### A gacha banner

`{ id, startsAt, endsAt, pool, rateUp }` on the same timeline. Proves that
content with a wall-clock lifetime and a random outcome is data, not code — and
that the RNG is keyed well enough to be lifted to a server later.

---

## 8. Build order

**All thirteen steps landed on 2026-09-02**, in this order, each on its own
commit with `npm test` green.

| # | Step | Commit |
|---|---|---|
| 1 | Unblockers | `b279a5d` |
| 2 | Boundary loop in `advance()` | `db6eb1f` |
| 3 | Save migration chain | `4cf3819` |
| 4 | Seeded RNG | `48116f3` |
| 5 | Modifier layer + `repriceTaxAnchor` | `8ccbde3` |
| 6 | Mana: production, capacity, Sanctum, landmarks | `1850430` |
| 7 | Ruins, artifacts, upkeep, attunement, Knowledge | `e57ec98` |
| 8 | Military buildings, army cap, unit stats, type chart | `39849c2` |
| 9 | Delves, checkpoints, party slots, heroes | `39849c2` |
| 10 | Timeline + the Conjunction | `4c59dce` |
| 11 | Gacha: banners, pity, duplicates | `4c59dce` |
| 12 | Offline report payload | `bbfbb8f` |
| 13 | Region discriminator | `6050079` |

**The load-bearing assertion holds at every one of them**, in the shape of
`tests/taxes.test.ts:43-60`: **one-call replay equals stepped ticking** — across
a research completion (`tests/advance.test.ts`), a modifier expiry
(`tests/modifiers.test.ts`), a Mana cap fill (`tests/mana.test.ts`), army
training and a delve depth resolving (`tests/expeditions.test.ts`), and a
Conjunction window opening and closing (`tests/timeline.test.ts`).

### Two things the build changed about the design

**Feature respawns stayed out of the pivot set**, as §1 said they should, and
the perf argument was never tested because nothing forced it. The boundary
count in practice is small enough that the seatbelt (`MAX_BOUNDARY_STEPS`) has
never been approached.

**Step 12 was decided rather than flagged.** §5 asked for a marker at the
offline-cap call site and a product decision from a human; schedule and delve
events instead fire in the post-cap tail advance, so a 20h absence spanning a
24h Conjunction pays in full. That is consistent with *"the cap limits what the
city produces, never what a timer does"*, but it was not the instruction. It is
gap 5 in `Docs/00-design-intent.md`.

---

## 9. The offline report

`AdvanceResult` (`commands.ts:202-208`) gains `timelineFired` and
`expiredModifiers`. Adding fields is safe — `tick()` reads by property.

`Docs/art/ui-menus-redesign.md` §5 already names this the biggest missed beat in
the build: *"On load, `runTick()` replays the whole absence… and the player sees
none of it. The game's single strongest retention beat is invisible."* Sim-side
only here; the screen lands with the UI redesign.

## 10. Deliberately cut

Re-expressing upgrade levels as modifiers · threading `now` through the
`effectiveX` helpers · a multi-region `GameState` restructure · promoting feature
respawns to boundaries · layered D&D-style modifier buckets (add-then-mul covers
every effect in every companion doc) · per-module save versions · a migration
fixture harness before there are two versions to fixture.
