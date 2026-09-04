# 10 · Heroes, the collection substrate and the gacha

> **Scope.** The five heroes, the one set of collection rules heroes and relics
> share, and the Gems-funded gacha. Relics are [`09-relics.md`](09-relics.md);
> where heroes are *used* is [`11-expeditions.md`](11-expeditions.md).
>
> **Status: built**, except the ingredient conversion (§3) and one hole — hero
> XP is written and never read (§9).

## 1. The collection substrate

- **One substrate, two content types.** Heroes and relics share one set of
  collection rules: collect → gate → level → equip into limited slots.
- A tier gate raises the level cap; Stardust buys levels within it.
- No second vocabulary for either type. **OQ-6.**

## 2. The heroes

- One hero is free at the start; the rest come from the gacha.
- Each hero carries a **unit type** (it feeds the same matchup chart as the
  troops), one **trait**, a **level** bought with Stardust, and a tier cap.

| Hero | Type | ATK/DEF/HP at L1 | Trait |
|---|---|---|---|
| **The Warden** | Warrior | 4 / 6 / 24 | +20% party DEF |
| **The Quartermaster** | Lancer | 6 / 3 / 16 | −25% supply cost |
| **The Scholar** | Archer | 7 / 2 / 12 | +50% Stardust from delves |
| **The Relic-hunter** | Cavalry | 8 / 3 / 18 | +50% ingredient yield |
| **The Scout** | Archer | 6 / 3 / 14 | reveals the next depth's threat before you commit |

- **A hero is mandatory** to send a party into a ruin. Heroes gate delve
  throughput: one hero, one delve at a time.
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
  as pulled; the wallet buys speed and breadth, never access.

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
- The chain is **army → hero → discovered ruin → first clear → Stardust →
  relic levels.** A player who never delves makes no progress on the
  weeks-long arc. **OQ-41.**

## 5. The gacha

| Dial | Value | Key |
|---|---|---|
| Pull price | **1,000 Gems** ($1.99 on the ladder) | `gacha.pull_gem_cost` |
| Base hero chance | **6%** | `gacha.hero_chance` |
| Soft pity from | pull **40** | `gacha.soft_pity_at` |
| Hard pity at | pull **60** | `gacha.hard_pity_at` |
| A duplicate pays | 20 Fragments → **ingredients** | `gacha.duplicate_fragments` |
| A miss pays | 3 Fragments → **ingredients** | `gacha.fragments_per_miss` |
| Every pull pays | **50 Stardust** | `gacha.pull_knowledge` |

- **Pity is mandatory.** The rates are shown plainly on the banner screen and
  the pity counter is always visible.
- **No dead pulls.** A duplicate converts. A miss pays 3 pieces and 50
  Stardust.
- **Pulls cost Gems directly.** No dedicated gacha currency, no second premium
  currency. Events gift Gems.
- **The first call on the standard banner is free.** The button reads
  **"Call — free"**, not a price of zero.
- **Banners are data** — `{ id, startsAt, endsAt, pool, rateUp }` on the same
  timeline as the weekly event. A legendary event hero is one banner row and
  one hero row.
- **Rolls are a deterministic hash of `(seed, bannerId, pullNumber)`**, not a
  stream.
- **The gacha sells breadth and speed. It never sells a power ceiling that
  cannot be earned.** Legendary event heroes are different, not stronger — or
  earnable more slowly by playing.

## 6. Expandability

Each of these is data, not code:

| Want to ship | Costs |
|---|---|
| A seasonal hero | one hero row + one banner row |
| A rate-up week | one banner row |
| An event that gifts ingredients | one timeline entry |
| A new relic | one relic row + one ruin, or a banner pool entry |
| **Managers** | hero rows with economy traits |

## 7. The screens

- **The Reliquary** carries heroes and relics as **two tabs of one screen**.
- **The banner** lives on the store, first thing on it; the Reliquary's heroes
  tab points there ([`14-monetization.md`](14-monetization.md) §2.1). It has
  no tab of its own.
- **There is no standing hero-management destination.** Heroes are configured
  in the expedition sheet.

## 8. Deliberately not in this design

- A second premium currency
- Standalone equipment with random stats or duplicate fusion
- Gacha-exclusive power ceilings
- Multi-banner rotation logic
- A server-authoritative implementation
- A hero that is strictly stronger than an earnable one

## 9. Known holes

- **Hero XP is written and never read.** Every extraction banks it; nothing
  consumes it.
- **No banner is authored.** The timeline carries a banner payload and the
  activation query exists; the catalogue holds only the weekly event, so
  rate-up is untested.

**Open questions:** OQ-6, OQ-11, OQ-12, OQ-41.
