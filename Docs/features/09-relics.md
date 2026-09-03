# 9 · Relics — passives, actives, and a set with a shape

> **Scope.** The five relics, what they do, how they are levelled, the
> nine-piece **ingredient set** that replaces Fragments, and the attune-or-arm
> rule the whole design turns on. Heroes share the same substrate —
> [`10-heroes.md`](10-heroes.md).
>
> **Status: the relics, attunement and attune-or-arm are built. Ingredients are
> designed and unstarted** (§4–§7), replacing the Fragment counter that ships
> today.

## 1. The model

- Every relic grants a **passive** while attuned to the kingdom.
- Most also grant an **active** — a magic action cast on the map for Mana.
- Both scale with the relic's **level**.
- A relic is **attuned to the kingdom** *or* **carried by a hero into a delve** —
  never both (§5).
- **Levels cost Stardust**; **unlocking a relic and each tier after needs nine
  ingredients** (§4).

**Artifacts, not a spellbook**, and that was the founding decision. A loadout
limit only has weight when the equipped thing works continuously. An active-only
slot is trivially circumvented — you swap the ability in at the moment you cast
— so the limit would tax *casting* instead of creating a decision. A passive is
consumed every second, so committing a slot to it costs you the alternative for
as long as it is worn.

**No random stat rolls.** Every relic is a named, hand-authored thing with one
legible effect. That is what keeps them cozy, and it is why duplicate-fusion
with random stats is out of scope (§8).

## 2. The five relics

| Relic | Passive | Active | Mana | Won from |
|---|---|---|---|---|
| **Dowsing Rod** 🔮 | reveal costs −15% | **Divination** — pays a Discovered cell's *entire* remaining reveal cost | 8 | Hollow Barrow |
| **Verdant Seal** 🌱 | cell recovery −25% | **Bloom** — clears exhaustion on every resource cell in radius 2 | 6 | Sunken Chapel |
| **Foreman's Sigil** ⚡ | worker yield +1 | **Haste** — worker yield ×2 for 60 min | 10 | Drowned Ironworks |
| **Gilded Ledger** 🪙 | tax rate +20% | *none* | — | The Counting House |
| **Wanderer's Compass** 🧭 | Stardust +50% | **Beckon** — a finite feature respawns on a cell you choose | 5 | Star Observatory |

Three notes carry most of the design weight.

**Divination costs the same Mana at every distance, while the Gold reveal cost
doubles every ring.** Its value therefore *grows with depth*, exactly where the
pain is. This single relic converts the fog from a chore into a real economic
decision: **Gold or Mana?**

**Haste is cast on the way out.** Divination and Bloom reward being present;
Haste rewards *leaving well*. A visit-based game needs a good departure move.

**The Gilded Ledger has no active at all** — deliberate, and the clearest proof
that the **slot** rather than the ability is the constraint.

## 3. Mana is what magic costs, on both maps

> Mana rides the *magic* verb, which appears in both scopes. The province is
> tapped; the world map is sent to.

| Action | Costs |
|---|---|
| Tap a province cell | **1 Mana** |
| Cast a relic active, either map | **Mana** |
| Reveal a world node | **Gold + time**, scaling with distance |
| Send a party, claim, besiege | supplies, army commitment, time |

That split is what stops the two scopes competing for one budget.

**Actives aimed at other players need no new architecture.** A relic active
pointed at a shared node or a guild siege is *a modifier with an expiry,
delivered as a pending effect* — the exact mechanism the social layer already
designs for daily help ([`15-social.md`](15-social.md) §3.1). Three examples
from the catalogue that already exists:

- **Reveal the threat on a contested node** before committing units — the
  Scout's trait, pointed at the world.
- **Speed every guildmate's committed units** in a siege — Haste with a guild
  scope.
- **Shield your claim for 12 hours** — defence without anybody losing property,
  so it sits inside promise 1.

Casting reuses **placement mode**: select, valid cells highlight, tap to commit.
A world-map cast is the same code pointed at another scope.

## 4. Ingredients — a set instead of a counter

Today a relic raises its tier cap with **Fragments**, a fungible per-collectible
counter. That is the standard gacha shape and it is **forgettable**: twenty
fragments of the Warden's Seal is a number going up.

> **Nine named ingredients with rarities are a set, and a set has a shape.** You
> can see which piece is missing, and a missing piece is a want.

That is the whole engine of a sticker album, and it is why trading works in that
genre.

And it **removes a system rather than adding one**: ingredients become the tier
gate, so the collection substrate no longer needs two axes and **Fragments can
be deleted**.

- Unlocking a relic, and each tier after, needs **9 ingredients** filling a 3×3
  grid.
- Ingredients carry **1★ / 2★ / 3★ rarity within the same set.** This is the
  load-bearing detail: **the last piece is always the rare one**, so the set has
  a tension curve rather than a progress bar.
- **Duplicates accumulate** (`+1`, `+2`), and spares are what there is to trade.
- **Ingredients are tradeable** — the social layer's first peer-to-peer economy.
- **Stardust still buys the level itself** once the set is complete. See §8 on
  why that needs a decision.

### 4.1 The rarity split — which source pays which star

This is the most important table in the document, and it exists to stop the
relic arc from being gated entirely behind the most expensive layer in the plan.

| Rarity | Source | Role |
|---|---|---|
| **1★** | province ruins, delve hauls, orders, the daily chest | plentiful — carries a relic to level 2–3 alone |
| **2★** | hard province content and **temporary event provinces** | uncommon — gives an event a reason to be played |
| **3★** | **the world map only**: contested ruins, siege spoils, guild chests | rare, and **the only tier that is really traded** |

Three things follow.

**The province keeps a real faucet into the long arc.** If ingredients came only
from the world map, the game's only week-scale progression would sit behind the
layer that needs a server, shards and PvP — the largest project in the plan and
the one that might never ship. The prototype would have its deepest system with
no source at all. It would also recreate exactly the failure
[`02-map-scopes.md`](02-map-scopes.md) exists to prevent: the province becoming a
place where nothing that matters happens.

**The world map gets something unique**, which is the whole question it has to
answer: it is the only route to max-level relics, whose passives improve the
province economy. The loop closes.

**Trading gets a gradient.** Nobody trades 1★; everybody wants 3★. That is what
makes the social layer load-bearing instead of decorative — if every ingredient
were equally rare there would be no trade, only queueing.

**The cost, stated deliberately:** a player who refuses the social layer **caps
out** — level 3 of 5 and no further. That is what Forge of Empires and Elvenar
do, and it is acceptable because the siege is co-op rather than PvP. But it is a
decision, not a detail. **OQ-7.**

### 4.2 The content bill, and the shape to author

Nine unique ingredients × 10 relics is **90 pieces of art**, and 180 if relics
reach twenty. Monopoly Go can afford that because the album *is* the game; here
it is a subsystem. Unique-per-relic also **makes trading worse**: if nothing
overlaps, your spares only help someone chasing the same relic.

> **1★ and 2★ slots draw from a shared pool of ~20 common ingredients. The 3★
> slots are unique and named per relic.**

Art cost ~20 shared plus 10–20 uniques instead of 90, more overlap to trade on,
and the *nine seals of the Warden* fantasy survives where it matters — on the
piece that is actually missing. **OQ-8.**

## 5. Attunement, and attune-or-arm

- **Slots:** 1 at start → a second through research → up to **5** with Gems, on
  an escalating price (`20 × 2.5^purchased`). Earned breadth first, so the paid
  gate is never the only thing between a player and the system.
- **Swapping applies immediately, then locks that slot for 5 minutes.** The lock
  kills hot-swapping a relic in for a single cast, without ever making the player
  wait for a benefit they have already earned.
- **The real cost of a swap is never the timer.** It is going without the passive
  you were living off.

> **A relic is attuned to the kingdom, or carried by a hero into a delve. Never
> both.**

That exclusivity is the decision the whole design turns on, and **exclusivity is
the whole cost** — an earlier version rested on an upkeep asymmetry, and the
argument is better without it. The trade was never *which is cheaper*, it is
**which do I need right now**: a standing economic benefit against a burst of
delve power.

Both directions refuse: a launch will not take a relic the kingdom is wearing,
and the Reliquary will not take back one that is underground.

One item pool, one equip screen, and the best decision in the design: *wear the
Foreman's Sigil for +1 worker yield, or send it down to reach depth 6?* That
single rule is what welds the city half of the game to the delve half.

### 5.1 What a relic is worth underground

Sized against the real unit ladder — units are ATK 3–7 / DEF 1–3 / HP 6–12, a
level-1 Warden is 4/6/24 — **a relic is worth about one good unit at level 1 and
about two at level 10.**

**Carried ATK is type-neutral**, because a relic has no unit type. That is not a
shortcut, it is what makes a relic worth socketing: **it lands whole whatever is
down there**, so it is worth most in exactly the run where the matchup went
against you. It also means a relic must be excluded from the launch sheet's
matchup chip, or socketing one would make a good matchup read *worse* while the
party got stronger.

Measured in the Drowned Ironworks, a four-Warrior party under the Warden is safe
to **depth 2**, and to **depth 7** carrying the Foreman's Sigil — the trade this
section names, and still short of the depth-9 floor. The Verdant Seal moves that
number **not at all**, because the wall there is ATK-limited: a defensive relic
buys survival *past* the safe floor rather than a deeper floor. Both readings are
correct, and **the sheet has to show stat deltas as well as the safe depth or the
Seal looks broken.**

**The level is snapshotted at launch**, so levelling a relic back home never
retroactively re-arms a party already underground; and a relic is committed for
exactly as long as its delve lasts, so a hero and its relic are released
together.

### 5.2 Three states, once the world map exists

If the world map is *away*, exclusivity becomes three states — **home,
underground, or abroad** — and the question *which do I need right now* gets more
interesting rather than muddier. The 5-minute swap lock keeps the same job.

## 6. Trading, and the part that will break

The hard problem is not the ingredients, it is the abuse. Monopoly Go limits
trading with windows, trade caps and untradeable stickers precisely because open
trading collapses into alt-account farming and real-money trading.

For a prototype with named playtesters that is survivable, but the design has to
be **born with**:

- a **cap** on trades per window,
- a **window** rather than an always-open market,
- and **3★ either untradeable or one per event**.

Without those, the 3★ scarcity designed in §4.1 evaporates in a week, and with
it the reason to go to the world map at all. **OQ-10.**

## 7. The screens

**Relics menu.** An `Attuned` row of slots — filled slots show level, the passive
summary and, when locked, the remaining swap time; an `Empty` slot; and a
Gem-priced `Unlock` for the next one. Below, the `Relics` grid: owned relics with
level, passive chip, name and an **`n/9` progress bar** — which is what lets a
player see at a glance which relic is close — and **unowned relics as silhouettes
in black, not question marks**, so the set has a visible shape from the first
session.

**Relic details.** Name, level, icon, passive line, then the magic action as its
own panel with its Mana cost and a `Cast` button, then the 3×3 ingredient grid
with star rarity per slot and `+n` on duplicates, then `Upgrade` with its
Stardust cost.

The silhouette treatment matters more than it looks. A `?` says *something
exists*; a black shape says ***that* is what you are missing**, which is the
whole reason a set outperforms a counter.

**Ingredients must drop for relics you do not own yet**, or an unowned relic can
never start. That means the album shows progress on silhouettes, which is also
the strongest pull the screen has. **OQ-11.**

## 8. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Attunement slots | 1 → 5, `20 × 2.5^n` Gems | `attunement.*` |
| Swap lock | 300 s | `attunement.swap_lock_seconds` |
| Level cost | `round(20 × 1.6^level)`, max 10 → **3,612** to max one | `collection.level_cost_*` |
| Tier ladder | 5 tiers, 2 levels each | `collection.max_tier`, `levels_per_tier` |
| Passive base and per-level, active Mana cost | per relic | `Artifacts` sheet |
| Carried ATK / DEF / HP and per-level | per relic | `Artifacts` sheet |
| **Ingredients per tier, and the 1★/2★/3★ split** | undecided | — |

## 9. What ingredients delete, and what they strand

**Deleted: Fragments** — the per-tier fragment curve, the gacha duplicate payout,
the per-miss payout, the per-depth drop, and the per-collectible counter. Gacha
duplicates convert to **ingredients** instead, which is strictly better: a
duplicate that pays a named piece you can see missing beats one that pays a
number.

**Stranded: Stardust's role.** With ingredients as the real gate, the level cost
(~3,612 to max one collectible) becomes a formality you will always be able to
afford. Two honest exits:

- **Stardust pays to attune and reconfigure** — a recurring job instead of a
  terminal one, which also gives the 5-minute swap lock an economic partner.
- Or accept it as a secondary gate and **cut its curve** so it stops pretending
  to be the binding constraint.

**What should not happen is two gates where one never closes.** **OQ-9.**

## 10. Deliberately not in this design

Upkeep · relics with random stat rolls · a second item system for hero equipment
— relics are dual-purpose instead · standalone equipment with duplicate fusion ·
a relic reachable through an upgrade, or vice versa
([`07-research.md`](07-research.md) §1.4) · a power ceiling only a wallet can
reach.

**Open questions:** OQ-7, OQ-8, OQ-9, OQ-10, OQ-11, and OQ-9 (Stardust) in
[`../open-questions.md`](../open-questions.md).
