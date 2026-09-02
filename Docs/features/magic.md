# Feature: Magic — Mana, artifacts and attunement

> Design doc for restoring magic to Kingdom as its identity and its second
> progression axis: a capped Mana economy that paces the player's visits, and
> **artifacts** — relics won from the fog that grant a passive while attuned and,
> usually, one active ability.
> Status: **built** (2026-09-02). Implemented in `src/sim/mana.ts`,
> `landmarks.ts`, `artifacts.ts`, `collection.ts` and `casting.ts`, with the
> screens in `src/ui/reliquarySheet.ts`, `siteCard.ts` and `castPanel.ts`.

Companion docs: [`expeditions.md`](expeditions.md) (where artifacts come from),
[`heroes-and-gacha.md`](heroes-and-gacha.md) (the shared collection substrate),
[`engine-seams.md`](engine-seams.md) (the machinery all of this needs).

## Why this exists

`Docs/00-design-intent.md` still pitches a "wizard-monarch… shaping the land with
magic". The web build cut spells and Mana, and the 2026-09-01 positioning audit
recorded the result: the game "reads as a generic (charming) village simulator".

Two other findings from that audit set the shape of everything below:

- **The session budget is ~30 min/day across 2–3 visits** — mid-core PvE builders
  have the least session time of the whole comparable set. The game must be
  played in *visits*, not sittings.
- **The bottleneck is lifetime, not monetization per user.** The prototype's
  content arc ends at Townhall 3 in 2–3 hours (`balancing-v1.md`), after which
  the quest chain runs out and there are no goals at all.

Magic is the answer to both: Mana is what makes a visit worth starting, and
artifacts are a progression axis whose faucets are limited by *time* rather than
by content, so it keeps giving for weeks.

## Summary of the change

| Today | With this feature |
|---|---|
| Ten currencies, every one `cap: null` | **Mana** is capped and overflows — the first reason to return before it fills |
| `Knowledge` declared, kingdom-scoped, zero faucets and zero sinks | Knowledge is the **levelling currency** for artifacts and heroes alike |
| Effects come only from upgrade levels via five `effectiveX` helpers | Effects also come from **modifiers**: artifact passives (permanent) and actives (timed) |
| The fog costs Gold and returns more of a resource you already have | The fog also holds **landmarks** (Mana production) and **ruins** (artifacts) |
| Nothing in the game expires | Mana overflows; actives run out; the Conjunction closes |

## Resolved decisions (2026-09-01/02)

1. **Artifacts, not a spellbook.** A loadout limit only has weight when the
   equipped thing works continuously. An active-only slot is trivially
   circumvented — you swap the ability in at the moment you cast — so the limit
   would tax casting instead of creating a decision. A passive is consumed every
   second, so committing a slot to it costs you the alternative for as long as it
   is worn.
2. **Slots: one to start, a second through research, the rest with Gems.** Earned
   breadth first, so the paid gate is never the only thing between a player and
   the system. Same pattern as party slots in `expeditions.md`.
3. **Swapping is immediate; the slot then locks for 5 minutes.**
4. ~~**Upkeep applies to kingdom attunement only.**~~ **Upkeep was removed
   entirely on 2026-09-02.** Once Mana became the energy every tap is paid
   from, the two jobs fought: at Townhall 1 the full relic set drew exactly
   what the Townhall made, so wearing everything stalled the pool dead.
   Attuning is free now, and attune-or-arm rests on exclusivity alone — see
   [`ad-economy.md`](ad-economy.md) §2.
5. ~~**Upkeep is flat per artifact and does not scale with level.**~~ Moot —
   see 4. Levelling a relic is unambiguously good because it costs nothing to
   hold at any level.
6. ~~**Net regen floors at zero, never negative.**~~ Moot — with no upkeep
   there is nothing to subtract, so regen is `base(TH) + Σ landmarks` and
   cannot be negative in the first place.
7. **No random stat rolls.** Every artifact is a named, hand-authored thing with
   one legible effect.

---

## 1. Mana

A new **city-scoped** currency, and the only one in the game with a cap.

Accrual mirrors `accrueTaxes` (`src/sim/population.ts:172-185`) exactly: whole
units against a `city.lastManaAt` anchor, replayed deterministically offline.
Note that `addToWallet` (`src/sim/state.ts:160-162`) does **not** clamp today —
capping is new behaviour and belongs in exactly one place.

### Two dials that must keep doing different jobs

| Dial | Raised by | What it means to the player |
|---|---|---|
| **Production** (Mana/h) | Townhall level | How much you get for *free* |
| **Capacity** (pool size) | The **Sanctum**, a new city district | How long an *absence* you can bank |

```
net regen/h = base(TH) + Σ landmarks
```

There is **no upkeep term**. Artifact upkeep was removed on 2026-09-02: the
formula above used to subtract `Σ upkeep of attuned artifacts` and floor at 0,
and nothing in `src/sim/mana.ts` has done that since. Attunement is now free to
hold — what it costs is *exclusivity* (§3), which is a stronger constraint
anyway because it cannot be out-produced.

Conflating them would waste both. Production answers "how many relics can I
wear"; capacity answers "how long can I be away without spilling".

### The pool, retuned 2026-09-02

Cap **100 / 130 / 160** by Townhall level (Sanctum +24/48/72), regen
**10 / 13 / 16** an hour. Fill time is **10 h at every level**, deliberately
past the 8 h offline cap. Every tap in the game costs 1 Mana, so the pool is a
session's worth of tapping and a rewarded ad refills it — see
[`ad-economy.md`](ad-economy.md).

### The tuning law — SUSPENDED 2026-09-02

> **cap ≈ 8 × net regen**

This kept "an overnight absence fills the pool exactly" true at *every* stage of
the game. Fill time sat just under the 8 h offline cap, so the two caps
reinforced each other instead of fighting, and the Sanctum became worth building
precisely when production had grown into it.

**That law belonged to a pool whose only job was sustaining artifacts — an
ABSENCE budget.** Mana is now also the energy every player tap is paid from
(`balancing-v2.md` §1.1), which makes it a **SPEND budget**, and the two want
opposite things: an absence budget should refill exactly overnight, while a
spend budget has to be able to run out or there is nothing for a refill to
sell.

**So the law is suspended by decision, not by drift.** The authored pool fills
in **10 h at every Townhall level** — past the 8 h offline cap on purpose — and
that gap between 8 and 10 is the demand a Gem refill sells against. It is
recorded here rather than quietly re-tuned because the next person to touch
`mana.production_per_townhall_level` has to know which budget they are tuning
for. `tests/mana.test.ts` asserts the new intent, not the old law.

> An earlier revision of this section described a starting cap of **50** and a
> 12.5 h fill. That state does not exist in the workbook and never shipped;
> the numbers above are the authored ones. See
> [`balancing-v3.md`](balancing-v3.md) §1.

A player who checks in 2–3 times a day wastes nothing. A player who checks in
once a day wastes some. That is the audit's session budget expressed as a
mechanic — and it is pressure that takes nothing away: you lose unspent
potential, never a building.

### Sinks

- **Every player tap** costs 1 Mana (`tap.manaCost`) — the largest sink by far,
  and the reason the pool is a spend budget.
- **Actives** cost Mana to cast. Passives cost **nothing** to hold; they cost a
  socket.
- **Gems** buy a refill (`mana.gemRefillPerGem`, 4 Mana a Gem) and buy
  attunement slots.

---

## 2. Artifacts

An artifact grants a **passive** while attuned to the kingdom and, usually, one
**active** ability. Both scale with the artifact's level.

> The **Upkeep** column this table used to carry is gone: upkeep was removed on
> 2026-09-02 (§Resolved 4) and nothing in `src/sim/mana.ts` has charged it
> since. Holding a relic is free; the cost is the socket.

| Artifact | Passive | Active | Mana | Won from |
|---|---|---|---|---|
| **Dowsing Rod** 🔮 | reveal costs −15% | **Divination** — pays a Discovered cell's *entire* remaining reveal cost | 8 | Hollow Barrow |
| **Verdant Seal** 🌱 | cell recovery −25% | **Bloom** — clears exhaustion on every resource cell within radius | 6 | Sunken Chapel |
| **Foreman's Sigil** ⚡ | worker yield +1 | **Haste** — worker yield ×2 for 60 min | 10 | Drowned Ironworks |
| **Gilded Ledger** 🪙 | tax rate +20% | *none* | — | The Counting House |
| **Wanderer's Compass** 🧭 | Knowledge +50% | 2/h | **Beckon** — a finite feature respawns on a cell you choose | 5 | Star Observatory |

Three notes carry most of the design weight:

- **Divination costs the same Mana at every distance, while the Gold reveal cost
  doubles every ring** (`src/sim/fog.ts:24-41` — 320 Gold and 320 taps for one
  distance-9 iron vein). Its value therefore *grows with depth*, exactly where the
  pain is. This single relic converts the fog from a chore into a real economic
  decision: Gold or Mana?
- **Haste is cast on the way out.** Divination and Bloom reward being present;
  Haste rewards leaving well. A visit-based game needs a good departure move.
- **The Gilded Ledger has no active at all** — deliberate, and the clearest proof
  that the slot rather than the ability is the constraint.

### Casting

Cast mode **reuses placement mode**. Select → valid cells highlight → tap to
commit is exactly what `placementInfo()`, `markers()` and the priority-300 tap
handler already do (`src/game.ts:213`). Cast mode is a second mode through the
same machinery, not a new interaction model.

### Dual purpose

An artifact is either **attuned to the kingdom** (economy passive) **or**
**carried by a hero into a delve** (a `carried` ATK/DEF/HP block) — never both
at once. Neither side costs Mana to hold; what you spend is the relic's
availability. See `heroes-and-gacha.md`. The asymmetry does real
work: the trade is never "which is cheaper" but "which do I need right now".

**Built 2026-09-02.** Both directions refuse: a launch will not take a relic the
kingdom is wearing, and attuning will not take back one that is underground.

---

## 3. Attunement

- **Slots**: 1 at start → 1 through research → up to 5 with Gems (escalating).
- **Swapping** applies the new passive immediately, then **locks that slot for
  5 minutes**. Modelled as `lockedUntil` per slot — the same lazily-derived
  timestamp pattern as `exhaustedUntil` on harvest cells (`state.ts:86`).
- The lock is what kills hot-swapping a relic in for a single cast, without ever
  making the player wait for a benefit they have already earned.

The real cost of a swap is never the timer. It is going without the passive you
were living off.

---

## 4. Landmarks and the Sanctum

**Landmarks** are small, numerous, passive map features — a shrine, a standing
stone, a leyspring. Ten across the map. Claiming one does two things,
permanently:

1. raises the Mana **cap** by **+10** (it used to be +1/h of production — see
   `ad-economy.md`);
2. **lifts the fog for `fog.claim_discover_radius` cells around it** — every
   cell in that square becomes **Discovered**, never Revealed (2026-09-02).

That second effect is the one worth being careful about. Discovered-not-
revealed keeps the paid reveal as the economy's main sink: a claim hands the
player a *place to look*, not ground. At radius 5 that is an 11×11 square —
around a hundred cells of dark tiles with their features showing, which is a
map to plan against and a frontier to push at. It also gives the second and
third sanctuaries a job beyond capacity: each is a lantern held up over a new
part of the world, which turns "go and claim the far one" into a reason to
explore rather than a chore at the end of exploring.

Cells the player already cleared are left alone — revealed outranks
discovered, and overwriting would undo paid-for progress.

Claiming rules and the contested variant live in `expeditions.md`.

**Placed and priced as destinations, not pickups** (2026-09-02, revised the
same day). **No sanctuary — and no ruin — is visible when a kingdom begins.**
The opening shows terrain and the things you can work; a shrine is something
the player uncovers, not a lure laid out in front of them. Sites do draw
through the Discovered scrim once the fog reaches them, so the moment one
comes into view it reads as a destination.

What the placement guarantees is the shape past that: **the nearest sanctuary
is also the cheapest, by a wide margin**, so the first one the player meets is
the one they can plausibly save for. Get that backwards and the fog's cost
curve stops meaning anything.

| Tier | Cost | Count |
|---|---|---|
| The near one | **2,000** | 1 |
| The middle ring | **25,000** | 5 |
| The far ring | **100,000** | 4 — all of them **defended** |

The dearest tier is exactly the defended set, so the last sanctuaries need both
the Gold *and* an army — which is also the only thing that gives combat a job
outside a dungeon.

Costs are **authored per sanctuary**, not derived from distance. The tiers are
the design, and no `base × growth^distance` curve lands on those numbers.

They are what makes exploration *compound*, and they are the design's answer to
the audit's strongest keeper — paid fog as the primary economic sink, which it
notes nobody else in the category does:

> explore → a bigger pool → a bigger ad → more taps → explore further

A flat resource drip cannot do this, because it does not feed the constraint that
gates everything else.

**The Sanctum** is a new city district raising the Mana cap (3 levels, +24/48/72).
It reuses `districts.ts` wholesale — count caps, distance costs, level gates.

---

## 5. UI

Follows `Docs/art/ui-menus-redesign.md`.

- **Header**: the pool, as a gauge. **One** figure — the fill bar draws the
  ratio and the rim turns gold when it is spilling, so `64/100` was the same
  fact twice in the tightest row in the game. Never a breakdown:
  `+6/h base −4/h upkeep = +2/h` in the HUD is exactly the spreadsheet chrome
  the brief exists to kill, and there is no upkeep to break down any more.
- **Reliquary**: bottom sheet over the live dimmed map (principle 1) — attuned
  slots first, then relics owned, then Knowledge and Fragments. Locked slots show
  their remaining time. This is where the full `value / cap` reading and the
  production breakdown live.
- **Cast mode**: placement machinery, one big green confirm (principle 2).
- **Navigation**: 🔨 Build / 🔮 Artifacts / 🔬 Research, Settings as the floating
  knob. Army loses its tab — see `expeditions.md`.

---

## 6. Tunables

> **These are the AUTHORED values**, read from `src/sim/data/balance.json`.
> This table used to carry the original starting proposals (production 4/5/6,
> cap 24/32/40, Sanctum +12×3) long after the workbook had moved past them —
> three incompatible number sets for one dial inside one document, which is
> what [`balancing-v3.md`](balancing-v3.md) §1 was opened to end. Change the
> workbook, run `npm run balance`, then change this table.

| | TH1 | TH2 | TH3 | Key |
|---|---|---|---|---|
| Base production / h | 10 | 13 | 16 | `mana.productionPerTownhallLevel` |
| Base cap | 100 | 130 | 160 | `mana.baseCapPerTownhallLevel` |
| Fill from empty | 10 h | 10 h | 10 h | — |

| Constant | Value | Key | Rationale |
|---|---|---|---|
| Sanctum cap bonus | +24 / 48 / 72 | `mana.sanctumCapPerLevel` | Capacity is the Sanctum's whole job; production is the Townhall's |
| Landmark capacity | **+10 max Mana** | `mana.landmarkCap` | Ten on the map, so a full sweep DOUBLES the base pool — and doubles what every ad pays, since the reward is a whole pool |
| Gem refill rate | 4 Mana a Gem | `mana.gemRefillPerGem` | See the open question below: a full 160 pool is 40 Gems, against a gacha pull at 30 |
| Tap cost | 1 Mana | `tap.manaCost` | Every tap in the game, fog excepted |
| Tap boost | 45 s of production | `tap.boostSeconds` | The rule the whole reward table should follow (`../road-to-mvp.md` §10) |
| Attunement slots | 1 → 5 max | `attunement.*` | Gem price escalates per slot |
| Artifact level cost | `round(20 × 1.6^level)`, max 10 | `collection.*` | Reuses `upgradeCost` (`upgrades.ts:15`); 3,612 Knowledge to max one |

## 7. Persistence

New save modules, all additive — every module read in `save.ts` is already
defensive, so these need no migrator, only a `SAVE_VERSION` bump (see
`engine-seams.md` §4).

```
city.wallet.Mana, city.lastManaAt
kingdom.artifacts   { owned[], levels{}, tiers{}, attuned[], slots, lockedUntil[] }
kingdom.landmarks   { claimed[] }
```

**Mana regen is city idle production, so it IS subject to the 8 h offline cap.**
Artifact modifier expiry is not — see `engine-seams.md` for the rule.

## 8. Implementation plan — done

Landed 2026-09-02 on `feature/engine-seams`, after `engine-seams.md` steps 1–5.

| Step | Commit | Notes |
|---|---|---|
| Mana — currency, cap clamp, accrual, production/capacity split | `1850430` | Clamping lives in `addMana`, not `addToWallet`; the tuning law `cap ≈ 8 × net regen` is asserted at every Townhall level |
| The Sanctum; landmarks, claiming, production contribution | `1850430` | **Contested claiming is NOT built** — see backlog gap 1 |
| Artifacts — ownership, levels, Knowledge sink, sockets, the 5-min lock, passives as permanent modifiers | `e57ec98` | `syncArtifactModifiers` is a total idempotent rebuild rather than incremental add/remove |
| The four actives | `e57ec98` | Cast mode reuses placement mode, as §2 said it should |
| Reliquary sheet, header Mana widget, cast mode, nav change | `bbfbb8f` | Army lost its tab to the Reliquary |
| Docs | `26092c4` | |

**One test found a real bug.** "Mana is city production, so the 8h offline cap
applies to it" failed: the cap's pause shifted `lastTaxAt` and not
`lastManaAt`, so a 40-hour absence paid Mana in full.

**Not built from this doc:** the contested landmark (backlog gap 1). Everything
else in §1–§7 shipped. The dual-purpose rule in §2 landed separately on
2026-09-02 — see `heroes-and-gacha.md` §8.

## 9. Out of scope

Ley lines as a spatial magic layer · spell schools or a magic tech tree ·
artifacts with random stat rolls · upkeep that scales with level · Mana as a
build cost · offline casting.

## Open questions

- **Is a full Mana refill really worth more than a hero pull?** At
  `mana.gemRefillPerGem` 4, refilling a 160-cap pool from empty is **40 Gems**,
  against a gacha pull at **30**. It may well be correct — a refill is
  consumable and a hero is permanent — but it has never actually been argued,
  and it is the first price in the game a player can put side by side, so it is
  the first one that can feel wrong. → decision for
  [`monetization-sim.md`](monetization-sim.md). (`balancing-v3.md` §1.)

The upkeep question that used to sit here is closed: **upkeep was removed**, so
there is no equipment-upkeep model left to check for precedent. Attune-or-arm
rests on exclusivity instead (§3).
