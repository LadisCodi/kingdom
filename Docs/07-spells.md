# 07 — Spells

Magic is the tactile layer over the idle economy: spells cost **Mana** (kingdom
wallet, capped 100, regenerating 5/min) and are cast by **tapping a target hex**.

## Spellbook model

- A `SpellDefinition` has: name, description (with `{value:…}`/`{duration}` template
  tags the UI formats), icon, world-view prefab, an **EffectId** string, flags
  `UnlockedFromStart` / `Stackable`, and a list of levels
  `{ManaCost, DurationSeconds, EffectMagnitude, UpgradeCost}`.
- The spellbook creates one runtime `Spell {IsUnlocked, Level}` per definition,
  unlocking those flagged from start. An upgrade flow exists
  (`SpellUpgradeResult`), but both current spells have a single level and no upgrade
  cost.

## Current spells

| Spell | EffectId | Unlocked | Stackable | Mana | Duration | Magnitude |
|---|---|---|---|---|---|---|
| **Rain** | `Currencies.Food.Boost` | from start | no | 10 | 30 s | 5 |
| **Tap** | `Cell.Tap` | from start | **yes** | 1 | 0 s (instant) | 5 (unused) |

## Casting flow

Selecting a spell in the Spellbook enters **targeting mode** (a tap handler at
priority 200, above fog reveal): every map cell where the spell's effect `CanTarget`
is highlighted with a target marker plus a per-cell info label; taps outside valid
cells are swallowed; a Cast Spell overlay menu is shown.

Cast checks, in order: unlocked → (if non-stackable) not already active on that cell →
effect can target the cell → Mana affordable → **pay Mana** → create
`ActiveSpell {definition, cell, level, magnitude, effect, expiresAt = now + duration}` →
apply the effect. Result enum: `Cast | NotUnlocked | AlreadyActive | NotEnoughMana |
InvalidTarget`.

A per-second driver ticks active spells and expires those past `expiresAt`
(running the effect's removal side effects and despawning the spell's world view).

## Effects are composed from interactions

An effect is the **composite of all interactions registered for its EffectId**:
`CanTarget` = any interaction can apply; `Apply`/`Remove` = every interaction that can.

### Rain (`Currencies.Food.Boost`)

1. **Food boost** — targets a cell whose district has a Food generator with rate > 0
   (a staffed Farm or a FarmLands). Adds a **Percentage** modifier of
   `magnitude − 1` (= +4 ⇒ ×5 total) in category `Spell` to that Food generator.
   Removed when the rain ends. Production recalcs never touch Spell modifiers, so the
   boost survives worker/population changes mid-rain.
2. **Forest regrowth** — targets a `TreesCut` cell; **when the rain expires**, the
   feature upgrades back to `Trees` (with world feedback "Grow trees"). Nothing
   happens while the rain is active.

### Tap (`Cell.Tap`)

Instant extraction on a **wilderness feature cell** (has a feature, no district):

1. Pick a random currency from the feature's positive `BaseYield` entries and grant
   **1 unit** — to the city wallet, or the kingdom wallet for kingdom currencies.
2. Register one tap on the cell's **durability counter**. Each cell rolls a random
   `DestroyThreshold = randomInt(clamp(minTaps,1,maxTaps), maxTaps)` per feature
   instance (Trees: min 5, max 12); the counter resets if the cell's feature changes.
3. Reaching the threshold **destroys the feature** — replaced by its
   `DestroyedReplacement` (Trees → TreesCut) with destruction feedback, and the owning
   city's production recalculates (a Lumber camp loses that worked tile).

The tension by design: over-tapping fells forests; Rain regrows them.

> **As-is data gap:** both `Trees` and `TreesCut` currently have an **empty
> BaseYield**, so step 1 finds no currency and `CanTarget` is false everywhere — the
> Tap spell has **no valid targets** in the current data. The whole extraction and
> wear-out machinery is implemented but unreachable. See
> `11-gaps-and-discrepancies.md`.

## Feature replacement

A shared service swaps a cell's feature (domain + tilemap tile), recalculates the
owning city's production, and plays the feature's authored destroyed/upgraded
feedback. Used by Tap destruction and Rain regrowth.

## Persistence

Saved: the spellbook (`IsUnlocked`, `Level` per spell) and active casts
(`SpellID, TargetCell, Level, Magnitude, ExpiresAt`). On load, casts that expired
while away are **dropped without running their removal effects** — a rain that ended
offline does *not* regrow its forest. Still-active casts are re-applied and their
world views re-shown.
