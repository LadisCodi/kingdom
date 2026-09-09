# 9 · Relics

> **Scope.** The five relics, their passives, how they are levelled, the
> nine-piece **ingredient set** that gates tiers, and attunement.
> Heroes share the same substrate — [`10-heroes.md`](10-heroes.md).
>
> **Status.** Relics and attunement are **built**. The nav tab
> that carries them is shown from the first relic owned (§1.1). Ingredients
> and trading (§4, §6) are **designed, not built**; the build gates tiers with
> **Fragments**, a per-collectible counter. Spells as tome nodes
> ([`07-research.md`](07-research.md) §6) are **designed, not built**; the build
> still casts a relic's active from the relic sheet (§7).

## 1. The model

- A relic grants one **passive** while attuned to the kingdom. That is all it
  does at home.
- The passive scales with the relic's **level**.
- A relic is **worn by the kingdom or it is on the shelf**. It never goes
  anywhere: nothing carries one into a fight (§5).
- **Levels cost Stardust.** Unlocking a relic, and each tier after, needs nine
  ingredients (§4).
- No random stat rolls: every relic is named and hand-authored, with one effect.
- A relic has no active. Abilities are **spells**, nodes in the Magic tome:

| | Lives on | Gated by | Improved by |
|---|---|---|---|
| **Passive** | the relic | being attuned | the relic's level (Stardust) |
| **Spell** | a tome node ([`07-research.md`](07-research.md) §6) | being discovered, once | tome upgrades (Gold, instant, stacking) |

- A discovered spell costs only **Mana** to cast.

### 1.1 How the mechanic opens

- **Owning a relic is what unlocks it.** A relic is found at the bottom of a
  ruin, and the Relics tab is hidden until the player has one — a tab for a
  system with nothing in it advertises a screen that can only disappoint, and
  the same rule already hides a currency the player has not met
  ([`03-economy.md`](03-economy.md) §1).
- **There is no building in front of it.** The builder programme proposed a
  Reliquary district whose levels capped a relic's level and it was **cut on
  2026-09-08**: a mechanic the player has just been handed the first piece of
  must not then ask them to go and build something before they may look at it.
  What that building would also have carried — ingredient trading, and a
  weekly Runestone recipe for a 3★ ingredient — has no home now, which is
  **OQ-7** open again.
- A relic's level cap is its **tier**, and a tier is Fragments (§1). Nothing
  else caps it.

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
| Send a party, clear a gate, claim, besiege | supplies, army commitment, time |

- A spell aimed at a shared node or a guild siege is *a modifier with an expiry,
  delivered as a pending effect* — the daily-help mechanism of
  [`15-social.md`](15-social.md) §3.1. Examples:
  - reveal the threat on a contested node (the Guild's scouting, pointed at
    the world);
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
| **1★** | province ruins, room rewards, the daily chest | plentiful — carries a relic to level 2–3 alone |
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

## 5. Attunement

- **Slots:** 1 at start → a second through research → up to **5** with Gems, at
  `20 × 2.5^purchased` each.
- **Swapping applies immediately, then locks that slot for 5 minutes.** The
  lock stops a passive being attuned for one transaction (pay a frontier cell
  at −15%, swap back).
- **A relic is worn by the kingdom or it sits on the shelf.** The socket is the
  only claim on one: there is no upkeep, and nothing takes a relic anywhere.
- **A relic has no battlefield stats.** It is not part of a party, it is not on
  the board, and it changes nothing about entering a room
  ([`11-expeditions.md`](11-expeditions.md) §5). What a fight is decided by is
  troops and heroes ([`combat.md`](combat.md)).
- The scarce thing is **slots**, and choosing which passives the kingdom wears
  is the whole of the decision.
- One item pool, one equip screen.

## 6. Trading

- A **cap** on trades per window.
- A **window**, not an always-open market.
- **3★ either untradeable or one per event.**
- **OQ-10.**

## 7. The screens

Two views behind one nav tab — the collection, and one piece of it opened.
Same shape as the roster ([`10-heroes.md`](10-heroes.md) §8).

### 7.1 The Reliquary

- The **Stardust** purse, hidden until the player has met it.
- The `Attuned` row — **one box per socket, with a line under each**:
  - **empty**: drawn open, and its line reads `Empty`, or the time left when
    the socket is still settling from a swap.
  - **filled**: the relic's art, and its name on the line. Tapping it opens
    that relic's card. A settling socket carries the time left on the box.
  - **the next socket to buy**: the same box in the gem tone with a plus, its
    Gems on the line. What is bought is a socket, so it is drawn as one —
    never a button under the row.
- The `Relics` grid — **three cards to a row**, one per relic, **found first
  then the gaps**, both in collection order:
  - **found**: the art, then the name, the level and the tier pips on the foot.
    Attuned reads as a **gold tile with a tick**; anything with a level or a
    tier to buy right now reads as a **green plus**. Never both — a relic in a
    socket is where the player put it.
  - **unfound**: warm stone, the art in silhouette, and **the ruin it waits
    in** — a signpost, not a locked box.
- **Every card opens**, found or not.

### 7.2 A relic's card

- Centred over the grid and **bare**: the art and the name below it are the
  title, so there is no plank repeating it.
- The art on its stage, **the tier pips overlapping its lower edge**, an arrow
  each side that steps the collection, and a close in the top-right corner.
  An attuned relic's stage is **gold** and carries an `Attuned` pill.
- The name, the level against its tier's cap, and the passive.
- The spell as its own panel; a relic without one says so.
- **`Attune` / `Remove` and `Cast` side by side**, equal widths — neither is
  the primary reading of a relic. **One line under them says why either is
  dead**, and a reason both give is printed once. Being unable to afford the
  Mana is not one of them: the red price in the button has already said it.
- **`Study`** (Stardust, one level) and **`Raise its tier`** (Fragments, the
  ceiling) — the 3×3 ingredient grid of §4 takes the second one's place when
  ingredients land.
- **An unfound relic gets the same card**: what the player is deciding is
  whether to go and get this one, which is a question about the passive, not
  about buttons it has not earned. It carries the ruin to clear instead.

## 8. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Attunement slots | 1 → 5, `20 × 2.5^n` Gems | `attunement.*` |
| Swap lock | 300 s | `attunement.swap_lock_seconds` |
| Level cost | `round(20 × 1.6^level)`, max 10 → **3,612** to max one | `collection.level_cost_*` |
| Tier ladder | 5 tiers, 2 levels each | `collection.max_tier`, `levels_per_tier` |
| Passive base and per-level | per relic | `Artifacts` sheet |
| **Ingredients per tier, and the 1★/2★/3★ split** | undecided | — |

## 9. Deliberately not in this design

- Upkeep.
- An active on a relic.
- Casting gated on a loadout slot.
- Relics with random stat rolls.
- **A relic carried into a fight.** It was one more decision in front of a
  room that already asks which troops and which heroes, and it made every
  relic two things at once. A relic is a passive the kingdom wears.
- A second item system for hero equipment.
- Standalone equipment with duplicate fusion.
- A relic reachable through an upgrade, or vice versa
  ([`07-research.md`](07-research.md) §1.1).
- A power ceiling only a wallet can reach.
- Fragments as the tier gate (the shipped counter; ingredients replace it).

**Open questions:** OQ-7, OQ-8, OQ-9, OQ-10, OQ-11 in
[`../open-questions.md`](../open-questions.md).
