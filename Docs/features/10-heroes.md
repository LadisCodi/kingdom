# 10 · Heroes, the collection substrate and the gacha

> **Scope.** The thirty-two heroes, the one set of collection rules heroes and
> relics share, and the two-banner gacha. Relics are
> [`09-relics.md`](09-relics.md); where heroes are *used* is
> [`11-expeditions.md`](11-expeditions.md), and how they fight is
> [`combat.md`](combat.md) §9.
>
> **Status: built**, except the ingredient conversion (§3) and one hole — hero
> XP is written and never read (§9). **Designed, not built:** the **Tavern**,
> the building heroes arrive through (§7,
> [`../plans/builder-30-days.md`](../plans/builder-30-days.md) §9).

## 1. The collection substrate

- **One substrate, two content types.** Heroes and relics share one set of
  collection rules: collect → gate → level → equip into limited slots.
- A tier gate raises the level cap; Stardust buys levels within it.
- No second vocabulary for either type. **OQ-6.**

## 2. The heroes

- One hero is free at the start; the rest come from the gacha.
- Each hero carries a **rarity**, a **unit type** (it feeds the same matchup
  chart as the troops), one **trait**, a **level** bought with Stardust, and a
  tier cap.

### 2.1 Rarity

| Rarity | Count | Stat band at L1 | Trait magnitude |
|---|---|---|---|
| **Common** | 14 | 4–7 ATK · 2–6 DEF · 13–24 HP | +15–25% |
| **Rare** | 12 | 5–9 ATK · 3–8 DEF · 18–32 HP | +25–30% |
| **Legendary** | 6 | 7–13 ATK · 4–11 DEF · 23–43 HP | +40–85% |

- **Rarity is a stat band and a pool, never a new mechanism.** It drives
  `atk`/`def`/`hp` and `trait_value`, all of which are already columns; nothing
  reads rarity at combat time.
- **The five traits are shared across the roster.** A Legendary is a Common's
  trait with a bigger number, so a duplicate role is a real choice about stats
  rather than a second vocabulary.

### 2.2 The roster

- **Common** — Warden, Quartermaster, Adventurer, Bard, Beastkin Hunter,
  Cleric, Cook, Gardener, Joker, Merchant, Priest, Rogue, Sellsword, Three
  Mice.
- **Rare** — Scholar, Relic-hunter, Dark Knight, Paladin, Wizard, Witch, Druid,
  Ice Lancer, Holy Warrior, Savage Warrior, Spymaster, Electric Archer.
- **Legendary** — Scout, Golden Dragon, Vampire Lord, Necromancer, Pharao,
  Elven Princess.

| Trait | What it moves |
|---|---|
| **Party DEF** | the party's defence, folded into its stats |
| **Supply discount** | what an expedition's supplies cost |
| **Stardust bonus** | Stardust out of a delve |
| **Fragment bonus** | ingredient yield |
| **Reveal next depth** | the next depth's threat, before committing |

- **A hero is mandatory** to send a party into a ruin or against a garrison.
  Heroes gate throughput: one hero, one job at a time — a delve or an assault
  ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §5).
- A second hero adds another concurrent delve and another matchup covered.
- **A party-wide bonus is folded into the party's stats**, not displayed
  beside them. Preview, safe depth, launch HP and each depth's damage all read
  the same numbers; the test asserts the damage, not the displayed stat.

## 3. The collection ladder

| | Gate | Levels |
|---|---|---|
| **Built** | Fragments raise a tier cap | Stardust buys levels inside it |
| **Designed, not built** | **nine ingredients** raise the tier ([`09-relics.md`](09-relics.md) §4) | Stardust, unchanged |

- **A tier is worth exactly two levels.** Both ladders end together at tier 5 /
  level 10.

| Raise | Fragments (built) | Cumulative | New level cap |
|---|---|---|---|
| tier 1 → 2 | 10 | 10 | 4 |
| tier 2 → 3 | 20 | 30 | 6 |
| tier 3 → 4 | 40 | 70 | 8 |
| tier 4 → 5 | 80 | **150** | **10** (max) |

- Levels cost `round(20 × 1.6^level)` — the building-upgrade curve, reused.
- Maxing one collectible costs **3,612 Stardust**; ten of them ≈36,000.
- **Runway.** Five *cleared* ruins drip ~240 Stardust/day; one collectible
  maxes in about **fifteen days** on the drip alone, the whole set in ~75.
  Meaningful progress inside 30 days, an endgame horizon past it.
- **Every gacha drop has a play-based route.** Tier gates are earnable as well
  as pulled; the wallet buys the same collectible sooner, never alone.

## 4. Where Stardust comes from

Every faucet is a dungeon or a banner.

| Source | Rate |
|---|---|
| **A first clear** | 150, once per ruin |
| **The cleared-ruin drip** | 2/h per cleared ruin — five is ~240/day |
| **A delve haul** | 6 × tier × depth, on extraction |
| **A gacha pull** | **50, on every pull** |
| The weekly event lump | 60 — OQ-12 |
| Long-game quests | 158 total, on four goal types only |

- **The drip is gated on CLEARED ruins, not discovered ones.** Discovery pays
  nothing; clearing turns a dungeon into a permanent faucet.
- **Every pull pays Stardust, hero or not.** A tier gate points at one hero;
  Stardust levels whoever the player already has.
- The chain is **army → hero → cleared garrison → ruin → first clear →
  Stardust → relic levels.** A player who never delves makes no progress on the
  weeks-long arc. **OQ-41.**

## 5. The gacha

### 5.1 Two banners, two keys

- **A pull is priced in a key, not in Gems.** Gems buy keys in the store;
  keys are the only thing a call spends.
- Both banners are always open. They are drawn as two cards on one screen,
  because choosing between them is a price comparison.

| | **The common call** | **The golden call** |
|---|---|---|
| Key | Silver | Gold |
| A key costs | **500 Gems** | **1,500 Gems** |
| Base hero chance | **6%** | **12%** |
| Soft pity from | pull 40 | pull 30 |
| A hero guaranteed at | pull **60** | pull **50** |
| A Legendary guaranteed at | — | pull **40** |
| Rarity weights | 80 Common / 20 Rare | 75 Rare / 25 Legendary |
| Pool | ~26 heroes | ~18 heroes |
| A duplicate pays | 20 Fragments | 40 Fragments |
| A miss pays | 3 Fragments | 6 Fragments |
| Every call pays | 50 Stardust | 150 Stardust |
| Free calls a day | **5**, one every 5 minutes | **1** |

- **A banner's rarity weights are its pool.** A weight of zero excludes a
  rarity, so no banner needs a pool column: Common is common-call only,
  Legendary is golden-call only, and Rare is in both.
- **The golden call is the only door to a Legendary**, and its ordinary pull is
  already stronger — a Rare floor against a Common one.
- **The first call on the common banner is free.** The button reads
  **"Call — free"**, not a price of zero; a ten-call over it charges nine.

### 5.2 The free call

- A rewarded video pays for a call: **five a day on the common banner, one on
  the golden one**.
- The common banner spaces its five by a **5-minute cooldown**; the golden one
  has none, because a cap of one a day is already the whole rule.
- The allowance is stamped with the UTC day and rolls over lazily on the next
  read — the same stamp-plus-counter shape the monthly budget uses.
- **The free call is not a boundary source.** `advance()` never touches the
  ledger: a recurring 5-minute timer would propose thousands of boundaries
  across a long absence. It is read on demand and written only by a live claim.
- This is what keeps a Legendary reachable without a wallet: ~30 free golden
  calls a month.

### 5.3 The two pities

- **Pity is mandatory and always visible.** A hidden pity counter is the same
  as no pity counter.
- **A hero pity** ramps the rate from the soft-pity pull to a certainty at the
  hard one, and resets on any hero.
- **A Legendary pity** runs only on the golden banner, increments on **every**
  call, and resets only on a Legendary.
- **No dead pulls.** A duplicate converts to Fragments. A miss pays Fragments
  and Stardust.
- **Rolls are a deterministic hash of `(seed, namespace, bannerId,
  pullNumber)`**, not a stream — one draw for hit/miss, one for rarity, one for
  the hero within it.
- **The pool prefers a hero the player does not own**, so breadth comes before
  a duplicate.

### 5.4 The ten-call

- **×10 is ten calls at ten keys**, no discount: the value of a batch is the
  pity it walks, not a price break.
- It refuses up front if the purse cannot pay all ten — never a partial batch.
- Both pities carry across the ten, and each call rolls with its own pull
  number, so a batch is identical to ten taps.

- **The gacha sells power.** A Legendary is stronger than a Common, and the
  golden call is how one is reached — by a wallet, or by the daily free call
  ([`14-monetization.md`](14-monetization.md) §1).

## 6. Expandability

Each of these is data, not code:

| Want to ship | Costs |
|---|---|
| A seasonal hero | one `Heroes` row (rarity, type, trait, stats) plus its portrait |
| A third banner | one `Banners` row — its weights are its pool |
| Rebalancing a banner | its row: odds, both pities, weights, key price, free calls |
| An event that gifts ingredients | one timeline entry |
| A new relic | one relic row + one ruin |
| **Managers** | hero rows with economy traits |

## 7. The screens

- **The Reliquary** carries heroes and relics as **two tabs of one screen** —
  a nav tab, and **not a building**: relics unlock on owning the first one
  ([`09-relics.md`](09-relics.md) §1.1).
- **The banners live in the Tavern** (*designed, not built*): heroes are
  unlocked by that building and **tapping it is how one is called**, the way
  tapping the Market opens the trade screen
  ([`14-monetization.md`](14-monetization.md) §2.1).
- **The keys stay in the store**, one Gem-priced card each. The store is where
  a currency is bought; the Tavern is where a key is spent.
- Until the Tavern is built, the banners keep their place on the store — the
  relocation is one mount, and it lands with the building.
- Each banner card shows, always: the chance right now, the calls to a
  guaranteed hero, the calls to a guaranteed Legendary where there is one,
  **two buttons side by side**, and a line saying how many keys the player
  holds and how much of today's free allowance is left.
- **The free call is not its own button.** It is one of three faces the ×1
  slot wears, in this order: **Free** when the call costs nothing, **▶ Free**
  when an ad will pay for it, and **Call ×1** with its price otherwise. A call
  that is already free never asks for an ad.
- When the ×1 slot is not free it says when it next will be — *Free in 3m 32s*
  inside the button while the cooldown runs, *Free tomorrow* once the day's
  allowance is spent. The ×10 is always the ten and always priced.
- **There is no standing hero-management destination.** Heroes are configured
  in the expedition sheet.

## 8. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| What a key costs in Gems | 500 / 1,500 | `Banners.key_gem_cost` |
| The odds and both pities | §5.1 | `Banners.hero_chance`, `soft_pity_at`, `hard_pity_at`, `legendary_pity_at` |
| What a banner's pool is | §5.1 | `Banners.weight_common` / `weight_rare` / `weight_legendary` |
| What a miss and a duplicate pay | §5.1 | `Banners.fragments_per_miss`, `duplicate_fragments` |
| What a call pays in Stardust | §5.1 | `Banners.pull_stardust` |
| The free calls and their spacing | §5.2 | `Banners.free_per_day`, `free_cooldown_seconds` |
| A hero's rarity, stats and trait | §2 | the `Heroes` sheet |

## 9. Deliberately not in this design

- **A gacha currency Gems cannot buy.** The keys are a price on a button and
  a free ad path; nothing else mints them.
- **A discount on the ten-call.** A batch buys pity walked, not a cheaper key.
- Standalone equipment with random stats or duplicate fusion
- **A hero no amount of play can reach** — every rarity is on a free call
- Rotating or time-limited banners — both are permanent
- A rarity that changes how combat resolves
- A server-authoritative implementation

## 10. Known holes

- **Hero XP is written and never read.** Every extraction banks it; nothing
  consumes it.
- **Rate-up is untested.** The timeline still carries a banner payload and the
  activation query exists, but the two banners are permanent rows, so nothing
  exercises a scheduled one.

**Open questions:** OQ-6, OQ-11, OQ-12, OQ-41.
