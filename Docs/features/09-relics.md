# 9 · Relics

> **Scope.** The five relics, their passives, how they are levelled, the
> nine-piece **ingredient set** that gates tiers, and the attune-or-arm rule.
> Heroes share the same substrate — [`10-heroes.md`](10-heroes.md).
>
> **Status.** Relics, attunement and attune-or-arm are **built**. Ingredients
> and trading (§4, §6) are **designed, not built**; the build gates tiers with
> **Fragments**, a per-collectible counter. Spells as tome nodes
> ([`07-research.md`](07-research.md) §6) are **designed, not built**; the build
> still casts a relic's active from the relic sheet (§7).

## 1. The model

- A relic grants one **passive** while attuned to the kingdom. That is all it
  does at home.
- The passive scales with the relic's **level**.
- A relic is **attuned to the kingdom** *or* **carried by a hero into a delve**
  — never both (§5).
- **Levels cost Stardust.** Unlocking a relic, and each tier after, needs nine
  ingredients (§4).
- No random stat rolls: every relic is named and hand-authored, with one effect.
- A relic has no active. Abilities are **spells**, nodes in the Magic tome:

| | Lives on | Gated by | Improved by |
|---|---|---|---|
| **Passive** | the relic | being attuned | the relic's level (Stardust) |
| **Spell** | a tome node ([`07-research.md`](07-research.md) §6) | being discovered, once | tome upgrades (Gold, instant, stacking) |

- A discovered spell costs only **Mana** to cast.

## 2. The five relics

| Relic | Passive | Won from |
|---|---|---|
| **Dowsing Rod** | reveal costs −15% | Hollow Barrow |
| **Verdant Seal** | cell recovery −25% | Sunken Chapel |
| **Foreman's Sigil** | worker yield +1 | Drowned Ironworks |
| **Gilded Ledger** | tax rate +20% | The Counting House |
| **Wanderer's Compass** | Stardust +50% | Star Observatory |

## 3. Mana on both maps

| Action | Costs |
|---|---|
| Tap a province cell | **1 Mana** |
| Cast a **spell**, either map ([`07-research.md`](07-research.md) §6) | **Mana** |
| Reveal a world hex | **Gold + time**, scaling with distance |
| Send a party, claim, besiege | supplies, army commitment, time |

- A spell aimed at a shared node or a guild siege is *a modifier with an expiry,
  delivered as a pending effect* — the daily-help mechanism of
  [`15-social.md`](15-social.md) §3.1. Examples:
  - reveal the threat on a contested node (the Scout's trait, pointed at the
    world);
  - speed every guildmate's committed units in a siege (Haste, guild scope);
  - shield a claim for 12 hours.
- Casting reuses **placement mode**: select, valid cells highlight, tap to
  commit. A world-map cast is the same flow in another scope.

## 4. Ingredients

- Unlocking a relic, and each tier after, needs **9 ingredients** filling a 3×3
  grid.
- Ingredients carry **1★ / 2★ / 3★ rarity within the same set**.
- **Duplicates accumulate** (`+1`, `+2`); spares are what is traded.
- **Ingredients are tradeable** (§6).
- Gacha duplicates pay **ingredients**.
- **Stardust buys the level itself** once the set is complete
  (~3,612 to max one relic). Whether that curve stays or is cut: **OQ-9**.
- Ingredients **drop for relics the player does not own yet** (§7, **OQ-11**).

### 4.1 The rarity split

| Rarity | Source | Role |
|---|---|---|
| **1★** | province ruins, delve hauls, the daily chest | plentiful — carries a relic to level 2–3 alone |
| **2★** | hard province content and **temporary event provinces** | uncommon |
| **3★** | **the world map only**: contested ruins, siege spoils, guild chests | rare — the only tier that is really traded |

- The province alone carries a relic to level 3
  ([`02-map-scopes.md`](02-map-scopes.md)); the world map is the only route to
  max level.
- A player who never touches the social layer caps at **level 3 of 5**. **OQ-7.**

### 4.2 The ingredient pool

- **1★ and 2★ slots draw from a shared pool of ~20 common ingredients.**
- **3★ slots are unique and named per relic.**
- Art: ~20 shared pieces plus 10–20 uniques. **OQ-8.**

## 5. Attunement, and attune-or-arm

- **Slots:** 1 at start → a second through research → up to **5** with Gems, at
  `20 × 2.5^purchased` each.
- **Swapping applies immediately, then locks that slot for 5 minutes.** The
  lock stops a passive being attuned for one transaction (pay a frontier cell
  at −15%, swap back).
- **A relic is attuned to the kingdom, or carried by a hero into a delve.
  Never both.** Exclusivity is the whole cost; there is no upkeep.
- Both directions refuse: a launch will not take an attuned relic, and the
  Reliquary will not take back one that is underground.
- One item pool, one equip screen.

### 5.1 A relic underground

- Units are ATK 3–7 / DEF 1–3 / HP 6–12; a level-1 Warden is 4/6/24. **A relic
  is worth about one good unit at level 1 and about two at level 10.**
- **Carried ATK is type-neutral**: a relic has no unit type, so its ATK lands
  whole against any matchup.
- A relic is **excluded from the launch sheet's matchup chip**.
- Reference: in the Drowned Ironworks a four-Warrior party under the Warden is
  safe to **depth 2**, and to **depth 7** carrying the Foreman's Sigil (the
  floor is depth 9). The Verdant Seal does not move the safe depth (the wall
  there is ATK-limited); it buys survival past the floor.
- **The launch sheet shows stat deltas as well as the safe depth.**
- **The relic's level is snapshotted at launch.** Levelling it at home does not
  re-arm a party already underground.
- A relic is committed for exactly as long as its delve lasts; hero and relic
  are released together.

### 5.2 Three states with the world map

- With the world map, exclusivity is three states: **home, underground, or
  abroad**.
- The 5-minute swap lock is unchanged.

## 6. Trading

- A **cap** on trades per window.
- A **window**, not an always-open market.
- **3★ either untradeable or one per event.**
- **OQ-10.**

## 7. The screens

**Relics menu**
- An `Attuned` row of slots: a filled slot shows level, the passive summary
  and, when locked, the remaining swap time; an `Empty` slot; a Gem-priced
  `Unlock` for the next slot.
- The `Relics` grid: owned relics with level, passive chip, name and an `n/9`
  progress bar.
- Unowned relics are **silhouettes in black**, not `?`, with their ingredient
  progress shown.

**Relic details**
- Name, level, icon, passive line.
- The active as its own panel with its Mana cost and a `Cast` button (built;
  leaves with the spells to the tome — designed, not built).
- The 3×3 ingredient grid: star rarity per slot, `+n` on duplicates.
- `Upgrade`, with its Stardust cost.

## 8. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Attunement slots | 1 → 5, `20 × 2.5^n` Gems | `attunement.*` |
| Swap lock | 300 s | `attunement.swap_lock_seconds` |
| Level cost | `round(20 × 1.6^level)`, max 10 → **3,612** to max one | `collection.level_cost_*` |
| Tier ladder | 5 tiers, 2 levels each | `collection.max_tier`, `levels_per_tier` |
| Passive base and per-level | per relic | `Artifacts` sheet |
| Carried ATK / DEF / HP and per-level | per relic | `Artifacts` sheet |
| **Ingredients per tier, and the 1★/2★/3★ split** | undecided | — |

## 9. Deliberately not in this design

- Upkeep.
- An active on a relic.
- Casting gated on a loadout slot.
- Relics with random stat rolls.
- A second item system for hero equipment — relics are dual-purpose.
- Standalone equipment with duplicate fusion.
- A relic reachable through an upgrade, or vice versa
  ([`07-research.md`](07-research.md) §1.1).
- A power ceiling only a wallet can reach.
- Fragments as the tier gate (the shipped counter; ingredients replace it).

**Open questions:** OQ-7, OQ-8, OQ-9, OQ-10, OQ-11 in
[`../open-questions.md`](../open-questions.md).
