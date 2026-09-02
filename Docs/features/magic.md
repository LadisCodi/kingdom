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
4. **Upkeep applies to kingdom attunement only.** An artifact carried by a hero
   into a delve costs no Mana.
5. **Upkeep is flat per artifact and does not scale with level**, so levelling a
   relic is unambiguously good.
6. **Net regen floors at zero, never negative.** You can stall; you can never go
   bankrupt.
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
| **Production** (Mana/h) | Townhall level + **landmarks claimed on the map** | How much magic you can *sustain* |
| **Capacity** (pool size) | The **Sanctum**, a new city district | How long an *absence* you can bank |

```
net regen/h = base(TH) + Σ landmarks − Σ upkeep of attuned artifacts    (floored at 0)
```

Conflating them would waste both. Production answers "how many relics can I
wear"; capacity answers "how long can I be away without spilling".

### The tuning law

> **cap ≈ 8 × net regen**

This keeps "an overnight absence fills the pool exactly" true at *every* stage of
the game. Fill time sits just under the 8 h offline cap, so the two caps
reinforce each other instead of fighting, and the Sanctum becomes worth building
precisely when production has grown into it.

A player who checks in 2–3 times a day wastes nothing. A player who checks in
once a day wastes some. That is the audit's session budget expressed as a
mechanic — and it is pressure that takes nothing away: you lose unspent
potential, never a building.

### Sinks

- **Actives** cost Mana to cast. Passives cost only their hourly upkeep.
- **Gems** buy a refill (priced on the amount missing) and buy attunement slots.

---

## 2. Artifacts

An artifact grants a **passive** while attuned to the kingdom and, usually, one
**active** ability. Both scale with the artifact's level.

| Artifact | Passive | Upkeep | Active | Mana | Won from |
|---|---|---|---|---|---|
| **Dowsing Rod** 🔮 | reveal costs −15% | 1/h | **Divination** — pays a Discovered cell's *entire* remaining reveal cost | 8 | Hollow Barrow |
| **Verdant Seal** 🌱 | cell recovery −25% | 2/h | **Bloom** — clears exhaustion on every resource cell within radius | 6 | Sunken Chapel |
| **Foreman's Sigil** ⚡ | worker yield +1 | 2/h | **Haste** — worker yield ×2 for 60 min | 10 | Drowned Ironworks |
| **Gilded Ledger** 🪙 | tax rate +20% | 3/h | *none* | — | The Counting House |
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

An artifact is either **attuned to the kingdom** (economy passive, Mana upkeep)
**or** **carried by a hero into a delve** (a `carried` ATK/DEF/HP block, no
upkeep) — never both at once. See `heroes-and-gacha.md`. The asymmetry does real
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
stone, a leyspring. 8–12 across the map. Claiming one raises Mana production by
**+1/h** permanently. Claiming rules and the contested variant live in
`expeditions.md`.

They are what makes exploration *compound*, and they are the design's answer to
the audit's strongest keeper — paid fog as the primary economic sink, which it
notes nobody else in the category does:

> explore → more Mana/h → afford more upkeep → wear more relics → explore further

A flat resource drip cannot do this, because it does not feed the constraint that
gates everything else.

**The Sanctum** is a new city district raising the Mana cap (3 levels, +12 each).
It reuses `districts.ts` wholesale — count caps, distance costs, level gates.

---

## 5. UI

Follows `Docs/art/ui-menus-redesign.md`.

- **Header**: `18/24` plus **one** net rate figure. Never three numbers — the
  breakdown belongs in the reliquary, on tap. `+6/h base −4/h upkeep = +2/h` in
  the HUD is exactly the spreadsheet chrome the brief exists to kill.
- **Reliquary**: bottom sheet over the live dimmed map (principle 1) — attuned
  slots first, then relics owned, then Knowledge and Fragments. Locked slots show
  their remaining time. This is where the production/upkeep breakdown lives.
- **Cast mode**: placement machinery, one big green confirm (principle 2).
- **Navigation**: 🔨 Build / 🔮 Artifacts / 🔬 Research, Settings as the floating
  knob. Army loses its tab — see `expeditions.md`.

---

## 6. Tunables (starting proposals — change the table, not the design)

| | TH1 | TH2 | TH3 |
|---|---|---|---|
| Base production / h | 4 | 5 | 6 |
| Base cap | 24 | 32 | 40 |
| Fill from empty | 6 h | 6.4 h | 6.7 h |

| Constant | Value | Rationale |
|---|---|---|
| Sanctum cap bonus | +12 / level, 3 levels | Keeps `cap ≈ 8 × net regen` as landmarks accumulate |
| Landmark production | +1 Mana/h | 8–12 on the map ≈ doubles base production when fully claimed |
| Attunement slots | 1 → 1 research → 5 max | Gem price escalates per slot |
| Slot swap lock | 5 min | Long enough to prevent hot-swapping, short enough not to punish |
| Artifact upkeep | 1–3 Mana/h, flat | Strongest passive costs most; never scales with level |
| Artifact level cost | `round(20 × 1.6^level)`, max 10 | Reuses `upgradeCost` (`upgrades.ts:15`); ≈3,630 Knowledge to max one |
| Knowledge drip | 2/h per discovered ruin | 5 ruins ≈ 240/day → one artifact maxed in ~15 days |

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

None blocking. Every number in §6 is a starting proposal in the tradition of
`harvest-loop.md` §7. One thing worth verifying before committing hard to the
upkeep model: Forge of Empires and Elvenar both gate output on population/culture
upkeep, so the architecture has precedent in this exact quadrant — but applied to
*buildings*, not equipment. A Game IQ check would confirm whether the equipment
variant is genuinely novel.
