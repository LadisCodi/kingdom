# Feature: Heroes, the collection substrate and the gacha

> Design doc for the collectible layer: **one** set of collection rules shared by
> heroes and artifacts, a Gems-funded gacha as the LiveOps faucet, and artifacts
> doing double duty as hero equipment so there is no second item system.
> Status: **built** (2026-09-02). Implemented in `src/sim/heroes.ts` on the
> shared substrate in `collection.ts`; the roster and the banner are tabs of
> the Reliquary.
>
> **Supersedes `managers.md`.** That stub asked for collectible characters
> granting economy multipliers and gating content; heroes are that feature, and
> managers become a content skin here rather than a parallel system.

Companion docs: [`magic.md`](magic.md), [`expeditions.md`](expeditions.md),
[`engine-seams.md`](engine-seams.md).

## Why this exists

The 2026-09-01 positioning audit names the **event/LiveOps engine** as the real
moat and **lifetime** as the real bottleneck. A gacha is the standard answer to
both: it is an unbounded progression runway and a faucet every future event can
pay into. Codigames already operates this pattern in-house.

The risk it introduces is equally real and worth stating plainly, because it
shapes every decision below. The audit already flags that the art argument
(pixel → indie/core) and the audience argument (cozy management, 35–55) point at
two different people. A full RPG gacha is a *third* direction. So the gacha is
taken exactly as far as heroes and no further.

## The load-bearing constraint

Heroes-with-a-gacha and artifacts are structurally the same thing: collect →
fragment → level → equip into limited slots. Built as two systems they would
teach the player the same lesson twice and neither would feel special.

> **One substrate, two content types.** Fragments raise a tier cap; Knowledge
> buys levels within it. Heroes and artifacts are two *kinds of thing*, not two
> systems with two vocabularies.

## Resolved decisions (2026-09-02)

1. **No standalone hero-equipment system.** Artifacts are dual-purpose instead.
2. **Pulls cost Gems directly.** No dedicated gacha currency, no second premium
   currency.
3. **Pity is mandatory.**
4. **Duplicates always convert to Fragments.** No dead pulls.
5. **Banners are data**, on the same timeline the Conjunction uses.
6. **Rolls use the seeded hash RNG**, so they are replay-safe and portable to a
   server.

---

## 1. Heroes

One hero free at the start; the rest come from the gacha. Each carries a **unit
type** (so the hero feeds the same matchup chart as the troops — see
`expeditions.md` §4), one **trait**, a **level** bought with Knowledge, and a
**tier cap** raised with that hero's Fragments.

| Hero | Type | Trait |
|---|---|---|
| **The Warden** | Warrior | +20% party DEF |
| **The Quartermaster** | Lancer | −25% supply cost |
| **The Scholar** | Archer | +50% Knowledge from delves |
| **The Relic-hunter** | Cavalry | +50% Fragment yield |
| **The Scout** | Archer | reveals the next depth's threat before you commit |

A hero is **required** to send any party into a ruin, so heroes gate delve
throughput as well as capability. A second hero is a prize twice over: another
delve at a time, and coverage of another matchup.

**The Scout** deserves note as a design piece rather than a stat: it converts the
delve's uncertainty from something you endure into something you can buy your way
out of, which is exactly what a management game should sell.

---

## 2. Artifacts as hero equipment

An artifact is either:

- **attuned to the kingdom** — economy passive, costs Mana upkeep every hour, or
- **carried by a hero into a delve** — combat effects, **no upkeep**

…never both at once.

The upkeep asymmetry is deliberate and does real work. Attuning costs Mana every
hour; arming a hero costs none. So the trade is never "which is cheaper" but
**"which do I need right now"** — a standing economic benefit against a burst of
delve power. One item pool, one equip screen, and the best decision in the
design: *wear the Foreman's Sigil for +1 worker yield, or send it down to reach
depth 6?*

That single rule is what welds the city half of the game to the delve half.

**Duplicate-fusion already exists here under another name.** Repeat delves and
gacha duplicates both pay **Fragments**, which raise tier caps. A second item
class with its own fusion loop would add a third collection system, the grindiest
mechanic in the gacha vocabulary, and would directly contradict the
"hand-authored, one legible effect, no random rolls" rule that keeps artifacts
cozy (`magic.md` §Resolved decisions).

---

## 3. Progression currencies

| Currency | Earned from | Spends on |
|---|---|---|
| **Knowledge** | Ruin drip (2/h each) · delves · the Conjunction · quests | **Levels**, for heroes and artifacts alike |
| **Fragments** (per collectible) | Repeat delves · gacha duplicates | Raising that collectible's **tier cap** |
| **Gems** | Quests · the Conjunction · purchase | Pulls · slots · Mana refills · rushes |

Knowledge is the steady drip that always has somewhere to go. Fragments are the
targeted chase that unlocks further depth. Levels are priced
`round(20 × 1.6^level)` — the same formula as `upgradeCost`
(`src/sim/upgrades.ts:15`), reused — so maxing one collectible costs ≈3,630
Knowledge.

Runway: five ruins drip ~240 Knowledge/day, so one artifact maxes in ~15 days and
the artifact set in ~75, before heroes are counted. Meaningful progress inside 30
days, an endgame horizon well past it.

**Every gacha drop has a play-based route.** Fragments are earnable as well as
pulled, so the wallet buys speed and breadth, never access.

---

## 4. The gacha

Standard RPG-gacha grammar, kept minimal.

- **Pity is mandatory** — a guaranteed hero within N pulls, with soft pity before
  it. This is the single thing that makes a gacha read as fair rather than
  predatory, and it matters more here, in a cozy game, than it would in a
  mid-core one.
- **Duplicates convert to that hero's Fragments.** No dead pulls, ever.
- **Pulls cost Gems directly.** One wallet, one thing to understand; events gift
  Gems like everything else does.
- **Banners are data**: `{ id, startsAt, endsAt, pool, rateUp }` — the same
  timeline the Conjunction runs on (`engine-seams.md` §5). A legendary event hero
  is **one banner row and one hero row**. That expandability costs nothing extra
  because the timeline has to exist anyway.
- **Rolls use the seeded hash RNG** (`engine-seams.md` §3). Not incidental:
  `src/sim/state.ts:1-3` already declares the sim should be "portable to a
  server", and gacha odds are the one thing that will eventually *have* to be
  server-authoritative. The counter/hash design makes that a lift-and-shift
  rather than a rewrite — a pull is keyed by `(seed, bannerId, pullNumber)`, and
  the pull counter is persisted for pity anyway.

### The line that keeps monetization honest

From the pillar the audit quotes — *"que la habilidad económica decida los
podios, que las carteras compren comodidad"*:

> **The gacha sells breadth and speed. It never sells a power ceiling you cannot
> earn.**

Legendary event heroes are **different, not stronger** — or earnable more slowly
by playing. Break that and the positioning goes with it.

---

## 5. Expandability

The whole point of building it this way. Each of these is data, not code:

| Want to ship | Costs |
|---|---|
| A seasonal hero | one hero row + one banner row |
| A rate-up week | one banner row |
| An event that gifts Fragments | one timeline entry |
| A new artifact | one artifact row + one ruin, or a banner pool entry |
| Managers, as originally specced | hero rows with economy traits |

---

## 6. UI

- **Reliquary** (shared with `magic.md`): heroes and artifacts as two tabs of one
  screen, because they share one set of rules.
- **Banner screen**: reachable from the reliquary, not the nav bar. Rates shown
  plainly, pity counter always visible.
- No standing "hero management" destination — heroes are configured where they
  are used, in the expedition sheet.

## 7. Persistence

```
kingdom.heroes  { owned[], levels{}, tiers{}, fragments{}, xp{} }
kingdom.gacha   { pullCounts{}, pityCounters{} }
```

Additive; no migrator needed (`engine-seams.md` §4).

## 8. Implementation plan — done, minus the load-bearing rule

Landed 2026-09-02 on `feature/engine-seams`.

| Step | Commit | Notes |
|---|---|---|
| The collection substrate — Fragments, tier caps, Knowledge levels | `e57ec98` | `collection.ts`, shared verbatim by relics and heroes |
| Heroes — roster, types, traits, XP | `4c59dce` | XP accumulates and **nothing reads it** — backlog gap 2 |
| **Artifacts as hero equipment; the exclusive attune-or-arm rule** | `9c0b174` | Built 2026-09-02. Needed a `carried` stat block first (`7552ba1`) — the docs said "combat effects" but none were ever authored |
| The gacha — banners as data, pity, duplicate conversion, seeded rolls | `4c59dce` | Pity, soft pity and duplicate conversion all shipped; **no banner is authored**, so rate-up is untested — backlog gap 4 |
| Reliquary tabs and the banner screen | `bbfbb8f` | Two tabs of one screen, as §6 asks |
| Mark `managers.md` superseded | `26092c4` | |

### What the rule cost, in the end

The shape was as predicted — a `Delve` gained an artifact field, `launchDelve`
takes one and refuses anything attuned, `manaUpkeep` needed no change because it
already reads `attuned`, and the expedition sheet gained a slot next to the hero
picker. Two things were not predicted:

**There was nothing to be on the "arm" side of the rule.** §2 promised "combat
effects" and `ARTIFACTS` held an economy passive and a map active and nothing
else. Six new balance columns (`carried_atk`/`def`/`hp`, plus `_per_level`) had
to land first. Sized against the real ladder — units are ATK 3–7 / DEF 1–3 /
HP 6–12, a level-1 Warden is 4/6/24 — a relic is worth about one good unit at
level 1 and about two at level 10.

**Carried ATK is type-neutral**, because a relic has no unit type. That is not a
shortcut, it is what makes a relic worth socketing: it lands whole whatever is
down there, so it is worth most in exactly the run where the matchup went
against you. It also means a relic must be excluded from the launch sheet's
matchup chip, or socketing one would make a good matchup read *worse* while the
party got stronger.

Measured in the Drowned Ironworks, a 4-Warrior party under the Warden is safe to
depth 2, and to depth 7 carrying the Foreman's Sigil — the trade §2 names, and
still short of the depth-9 bottom. The Verdant Seal moves that number not at
all, because the wall there is ATK-limited: a defensive relic buys survival
*past* the safe floor rather than a deeper floor. Both readings are correct, and
the sheet has to show stat deltas as well as the safe depth or the Seal looks
broken.

The level is snapshotted at launch, so levelling a relic back home never
retroactively re-arms a party already underground; and a relic is committed for
exactly as long as its delve sits in `state.delves` — the same span
`heroIsBusy` uses — so a hero and its relic are released together.

## 9. Out of scope

A second premium currency · standalone equipment with random stats or duplicate
fusion · gacha-exclusive power ceilings · multi-banner rotation logic · a
server-authoritative implementation (the RNG design leaves room for it; nothing
here builds it).

## Open questions

**Ten progression systems is the standing risk**, accepted deliberately rather
than resolved: technologies, gold upgrades, artifacts, heroes, delve depth, city
buildings, the Mana economy, army, landmarks, gacha. The single collection
substrate is what keeps that list learnable. If playtest still says it is too
much, merging heroes and artifacts further is the next cut to make.
