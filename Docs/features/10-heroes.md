# 10 · Heroes, the collection substrate and the gacha

> **Scope.** The five heroes, the one set of collection rules heroes and relics
> share, and the Gems-funded gacha. Relics are [`09-relics.md`](09-relics.md);
> where heroes are *used* is [`11-expeditions.md`](11-expeditions.md).
>
> **Status: built**, except the ingredient conversion (§3) and one hole — hero
> XP is written and never read.

## 1. The load-bearing constraint

Heroes-with-a-gacha and relics are structurally the same thing: collect → gate →
level → equip into limited slots. Built as two systems they would teach the
player the same lesson twice and neither would feel special.

> **One substrate, two content types.** A tier gate raises the level cap;
> Stardust buys levels within it. Heroes and relics are two *kinds of thing*,
> not two systems with two vocabularies.

That is also the discipline test the whole design is under: the game already
carries ten progression systems, and the single collection substrate is the only
thing keeping the list learnable. **OQ-6.**

## 2. The heroes

**One hero free at the start; the rest come from the gacha.** Each carries a
**unit type** — so the hero feeds the same matchup chart as the troops — one
**trait**, a **level** bought with Stardust, and a tier cap.

| Hero | Type | ATK/DEF/HP at L1 | Trait |
|---|---|---|---|
| **The Warden** | Warrior | 4 / 6 / 24 | +20% party DEF |
| **The Quartermaster** | Lancer | 6 / 3 / 16 | −25% supply cost |
| **The Scholar** | Archer | 7 / 2 / 12 | +50% Stardust from delves |
| **The Relic-hunter** | Cavalry | 8 / 3 / 18 | +50% ingredient yield |
| **The Scout** | Archer | 6 / 3 / 14 | reveals the next depth's threat before you commit |

**A hero is mandatory** to send any party into a ruin, so heroes gate delve
throughput as well as capability. **A second hero is a prize twice over:** another
delve at a time, and coverage of another matchup.

**The Scout deserves note as a design piece rather than a stat.** It converts the
delve's uncertainty from something you endure into something you can buy your way
out of, which is exactly what a management game should sell.

> **A party-wide bonus must be folded into the party's stats, not displayed
> beside them.** The Warden's +20% DEF once applied to the preview's *displayed*
> numbers and to nothing else — so the starting hero's only trait was a number on
> a screen. Preview, safe depth, launch HP and each depth's damage all read one
> set of numbers now, and the test asserts the **damage** rather than the
> displayed stat.

## 3. The collection ladder

| | Gate | Levels |
|---|---|---|
| **Today** | Fragments raise a tier cap | Stardust buys levels inside it |
| **Designed** | **nine ingredients** raise the tier ([`09-relics.md`](09-relics.md) §4) | Stardust, unchanged |

**A tier is worth exactly two levels**, so a tier chase always converts into
somewhere for the Stardust drip to go — that interlock is the point, and it only
works because both ladders end together at tier 5 / level 10.

| Raise | Fragments (today) | Cumulative | New level cap |
|---|---|---|---|
| tier 1 → 2 | 10 | 10 | 4 |
| tier 2 → 3 | 20 | 30 | 6 |
| tier 3 → 4 | 40 | 70 | 8 |
| tier 4 → 5 | 80 | **150** | **10** (max) |

Levels cost `round(20 × 1.6^level)` — the same curve as a building upgrade,
reused — so **maxing one collectible costs 3,612 Stardust**, and ten of them
≈36,000.

**Runway.** Five *cleared* ruins drip ~240 Stardust/day whether or not a party is
out, so one collectible maxes in about **fifteen days** at the drip alone, and the
whole set in ~75. **Meaningful progress inside 30 days, an endgame horizon well
past it** — which is the only arc in the game measured in weeks rather than
hours.

**Every gacha drop has a play-based route.** Tier gates are earnable as well as
pulled, so the wallet buys speed and breadth, never access.

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

**The drip is gated on CLEARED ruins, not discovered ones.** It used to pay the
moment a ruin came out of the fog, which meant spotting one paid you forever for
doing nothing with it. Now **clearing a dungeon is what turns it into a permanent
faucet.** The idle floor a 30-minute-a-day game needs is still there; it just has
to be earned one dungeon at a time.

**Every pull pays Stardust, hero or not.** A tier gate only ever points at one
hero; Stardust levels whoever the player already has. That is what stops a pull
being dead once the roster fills up.

> **The chain is army → hero → discovered ruin → first clear → Stardust → relic
> levels.** That gives the military buildings a job outside dungeons, which the
> design wants — but **a player who never delves makes no progress on the
> weeks-long arc at all.** First thing to watch in playtest, and if it bites the
> cheapest answer is a small early Stardust sink in the Reliquary, **not** putting
> the technology tree back on this currency. **OQ-41.**

## 5. The gacha

Standard RPG-gacha grammar, kept minimal.

| Dial | Value | Key |
|---|---|---|
| Pull price | **30 Gems** | `gacha.pull_gem_cost` |
| Base hero chance | **6%** | `gacha.hero_chance` |
| Soft pity from | pull **40** | `gacha.soft_pity_at` |
| Hard pity at | pull **60** | `gacha.hard_pity_at` |
| A duplicate pays | 20 Fragments → **ingredients** | `gacha.duplicate_fragments` |
| A miss pays | 3 Fragments → **ingredients** | `gacha.fragments_per_miss` |
| Every pull pays | **50 Stardust** | `gacha.pull_knowledge` |

- **Pity is mandatory.** It is the single thing that makes a gacha read as fair
  rather than predatory, and it matters *more* here, in a cozy game, than it
  would in a mid-core one. **The rates are shown plainly on the banner screen
  and the pity counter is always visible** — which is a promise to the player, so
  the numbers have to live in a document that can be reviewed, not only in a
  spreadsheet.
- **No dead pulls, ever.** A duplicate converts. A miss pays 3 pieces and 50
  Stardust. The rule applies at both levels.
- **Pulls cost Gems directly.** No dedicated gacha currency, no second premium
  currency: one wallet, one thing to understand, and events gift Gems like
  everything else does.
- **The first call on the standard banner is free.** A summon the player has
  never seen is not one they can judge the price of, and a banner whose first
  impression is *you cannot afford this* teaches the wrong thing about the whole
  system. The button reads **"Call — free"** rather than rendering a price of
  zero.
- **Banners are data** — `{ id, startsAt, endsAt, pool, rateUp }` on the same
  timeline the weekly event runs on. A legendary event hero is **one banner row
  and one hero row.**
- **Rolls are a deterministic hash of `(seed, bannerId, pullNumber)`**, not a
  stream. Gacha odds are the one thing that will eventually *have* to be
  server-authoritative, and this makes that a lift-and-shift rather than a
  rewrite.

### The line that keeps monetisation honest

> **The gacha sells breadth and speed. It never sells a power ceiling you cannot
> earn.**

Legendary event heroes are **different, not stronger** — or earnable more slowly
by playing. Break that and the positioning goes with it.

## 6. Expandability

The whole point of building it this way. Each of these is data, not code:

| Want to ship | Costs |
|---|---|
| A seasonal hero | one hero row + one banner row |
| A rate-up week | one banner row |
| An event that gifts ingredients | one timeline entry |
| A new relic | one relic row + one ruin, or a banner pool entry |
| **Managers**, as originally specced elsewhere | hero rows with economy traits |

That last line closes an older feature request outright: collectible characters
granting economy multipliers and gating content *are* heroes. Managers become a
content skin, not a parallel system.

## 7. The screens

- **The Reliquary** carries heroes and relics as **two tabs of one screen**,
  because they share one set of rules.
- **The banner** is reachable from the Reliquary, not the nav bar.
- **There is no standing hero-management destination.** Heroes are configured
  where they are used, in the expedition sheet.

## 8. Deliberately not in this design

A second premium currency · standalone equipment with random stats or duplicate
fusion · gacha-exclusive power ceilings · multi-banner rotation logic · a
server-authoritative implementation — the RNG design leaves room for it, nothing
here builds it · a hero that is strictly stronger than an earnable one.

## 9. Known holes

- **Hero XP is written and never read.** Every extraction banks it; nothing
  consumes it. Either give it a job or delete the field — a number that
  accumulates and does nothing is the exact fault this design pass removed
  elsewhere and reintroduced here.
- **No banner is authored.** The timeline carries a banner payload and the
  activation query exists, but the catalogue holds only the weekly event, so
  rate-up is untested code.

**Open questions:** OQ-6, OQ-11, OQ-12, OQ-41.
