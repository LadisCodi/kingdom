# 18 · Harmony and the decorations

> **Scope.** The city stat a decoration supplies and an advanced building
> level demands, the six pieces, the gate between them, and what a surplus
> pays. What a level otherwise costs is [`buildings.md`](buildings.md) §4.11;
> where a piece is discovered is [`tech-tree.md`](tech-tree.md) §2.3.
>
> **Status: built** (`src/sim/harmony.ts`), and waiting on the Townhall: the
> first piece opens at Townhall 5 and the first level that demands any is 8,
> while the Townhall's own ladder stops at 4 until the builder programme's
> step 7 ([`../plans/builder-30-days.md`](../plans/builder-30-days.md) §7).

## 1. A stat, not a currency

- Harmony is **`supply − demand`**, computed on read. Nothing is stored,
  nothing is spent, nothing is serialized.
- **Supply** is what the decorations standing in the city add up to.
- **Demand** is what every building asks for at the level it holds — or at the
  level it is **upgrading to**, so two waits cannot be started against one
  surplus.
- It is a **gate, never a drain**: asked once, when a build or an upgrade
  starts, and never read again. A deficit blocks the next thing; it cannot
  punish the last. Nothing owned is ever taken.
- Supply only grows and demand only grows, since nothing is demolished, so a
  city is never pushed into deficit by anything but its own next purchase.

## 2. Supply — the six pieces

| Piece | Size | Supply | Build cost | Stands from | Discovered by |
|---|---|---|---|---|---|
| **Garden** | 1×1 | 4 | 200 Wood · 100 Food | TH5, up to 4 → 14 | Gardening |
| **Well** | 1×1 | 6 | 200 Stone · 1 Cut Stone | TH6, up to 2 → 10 | Sculpture |
| **Orchard** | 2×1 | 12 | 500 Food · 2 Planks | TH6, up to 1 → 5 | Gardening |
| **Statue** | 1×1 | 10 | 5,000 Gold · 2 Cut Stone | TH7, up to 1 → 4 | Sculpture |
| **Plaza** | 2×2 | 30 | 800 Stone · 4 Planks · 4 Cut Stone | TH8, up to 1 → 3 | Paving |
| **Shrine** | 2×2 | 40 | 20,000 Gold · 2 Runestone | TH9, up to 1 → 2 | Sacred Grounds |

- A decoration has **one level, no crew, no tap and no fog ring**. It is
  movable like anything else, and a piece under construction supplies nothing.
- **Every piece past the Garden costs a refined good**, paid when the build is
  queued and refunded in full on cancel — the rule a workshop item follows.
- The count cap per piece is the Townhall gate and the ceiling in one, and it
  grows with the Townhall. Meeting a demand therefore takes **several kinds**
  of piece, each priced in a different good: that is what prices Harmony now
  the plot is unbounded (OQ-1), in place of the ground.
- Most supply a Townhall level allows: TH5 **16**, TH6 **48**, TH7 **90**,
  TH8 **162**, TH9 **274**, TH10 **386**.

## 3. Demand — the levels from 8

- Every building that reaches level 10 demands **2 at level 8, 4 at 9, 6 at
  10**, and nothing below 8. The Townhall's own demand lands with its ladder.
- The number is the **total at that level, not an increment** — indexed from
  level 1 like an army cap — so one column states the gate on building a thing
  and every gate on its levels, and a level replaces the one under it rather
  than stacking on it: 8 → 9 asks for 4 in total, not 2 + 4.

## 4. The gate

- A build or an upgrade may **start** only while
  `supply ≥ demand − what this building demands today + what it will demand`.
- An upgrade is refused in the order of the errands that answer it: the
  Townhall first, then the refined goods, then Harmony. Each is a different
  trip — the map, a workshop queue, a decoration.
- A refused build never reaches the map: the build sheet says *Needs N more
  Harmony* on the card, and the count cap stays the harder wall of the two,
  since no decoration lifts it.

## 5. The surplus bonus

- `ratio = supply / demand`, and three tiers on the tax rate: **110% → +5%**,
  **125% → +10%**, **150% → +15%** — the last tier the ratio reaches.
- A base-stage term in the rate, beside the Market's level multiplier, never a
  modifier.
- **A city that demands nothing has no ratio and no bonus.** Otherwise one
  Garden at Townhall 5 would pay the top tier for the whole midgame, for free.

## 6. Where a piece stands

- Position is paid for by adjacency, never by the gate: a **house beside a
  decoration collects +1 Gold a minute** for each one, the mirror of the
  crowding penalty ([`03-economy.md`](03-economy.md) §3.1). `AnyDecoration` is
  a kind, so the rule is one row.
- A decoration reveals no fog, so a cheap piece is never a cheaper frontier
  than paying for one.

## 7. The sheet and the cards

- The build sheet carries a **Harmony header** — `supply / demand`, and either
  the tier that pays or the next one to reach — from the moment a piece is
  both discovered and permitted, and a **Decorations** section under the
  buildings. A piece whose technology is unread is hidden, like any building.
- Every place a build is priced — the card, the sheet, the placement bar —
  shows refined goods beside the currencies; the upgrade button shows Harmony
  with them, as a requirement quoted at the price.
- The placement bar's verdict for a decoration is the supply it adds.
- The Townhall card reads the same line as the header; a decoration's card
  says what it supplies.

## 8. Save

- Nothing new is serialized. Save version 31, no migrator: the bump exists so
  that a build without the decorations refuses a save that names one, rather
  than loading an id it cannot resolve.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| What a piece supplies | §2 | `Districts.harmony_supply` |
| What a level demands, as a total from level 1 | `,,,,,,,2,4,6` | `Districts.harmony_cost_per_level` |
| When a piece may stand, and how many | §2 | `Districts.max_count_per_townhall_level` |
| What a piece costs in goods | §2 | `Districts.build_cost_goods` |
| The surplus tiers and what each pays | `1.10:0.05\|1.25:0.10\|1.50:0.15` | `harmony.surplus_tiers` |
| Which technology discovers a piece | §2 | the card's `unlocks` in `?dev=tree` |
| A house's rent beside a piece | +1 a minute | the `Adjacency` sheet |

## 10. Deliberately not in this design

- **Harmony as a wallet row, or as anything spent.** It is read where it is
  asked and never leaves the city.
- **Harmony with reach**, supplied only within a radius. It would make a
  placement refusable, which adjacency exists to keep from ever being true
  (OQ-48).
- **Demand that drains or decays**, and any deficit that reaches a building
  already standing.
- **A bonus at demand zero.**
- **A stat setting for what the surplus moves.** The stat a bonus moves is a
  call site; a setting whose only legal value is the tax rate would be a knob
  that cannot turn.
- **Store decorations.** [`14-monetization.md`](14-monetization.md) decides
  them (OQ-26).
- **The Sanctum's Mana beside a decoration.** It waits for a Mana adjacency
  stat.
