# Feature: tomes and research — Knowledge as a clock, the tree as a shelf

> Reworks research into an Elvenar-style **trickle-and-commit** currency, turns
> the radial tech tree into **tomes of magic** whose tiers *are* eras, and
> renames the dungeon currency to **Stardust** so that one name stops doing two
> jobs. **Status: designed, unstarted.**
>
> Companion docs: [`research-and-upgrades.md`](research-and-upgrades.md) (the
> tree this replaces), [`knowledge.md`](knowledge.md) (becoming `stardust.md`,
> §2), [`magic.md`](magic.md) (Mana, which this deliberately does *not* touch),
> [`social-layer.md`](social-layer.md) (§9, the prize this unlocks),
> [`map-scopes.md`](map-scopes.md) (where the capacity landmarks live).

## 0. Why, and the argument the repo already makes

`research-and-upgrades.md` says the tree today is *"more a checklist than a
tree"*: one root gate, five branches that never reconverge, maximum depth 4, no
exclusive choices, exhausted inside the 2–3 hour arc. And its Gold cost is
**6,600 across 24 techs** against a quest chain that pays **12,075**
([`balancing-v3.md`](balancing-v3.md) §2) — a ratio of 1.83×, which means the
tree is not a sink, it is a formality.

The fix is not more nodes. And [`knowledge.md`](knowledge.md) already contains
the argument for the shape it should take:

> *"No comparable game asks a research currency to do that — in Elvenar, Forge
> of Empires and Rise of Cultures the research currency is a **clock**, accrued
> per hour and never earned, existing only to pace the tree."*

That is the model. This document adopts it.

## 1. Knowledge, the clock

- **Accrues with time to a cap.** Not earned, not dropped, not bought with
  resources.
- **Committed** into a technology: a tech takes N Knowledge poured in over
  several visits, and *then* resources (Gold, Wood, Stone) plus build time to
  develop.
- **Gems finish it**, priced on the Knowledge still missing — Elvenar's model,
  and a clean comfort purchase under pillar 3.
- **Cap raised by contested world-map landmarks** (§8).

The commit step is what makes this better than a price tag: a tech becomes
something you are *working towards* across visits, visible as `12 / 40`, which
is a much better fit for a game played in two or three check-ins than a number
you either can or cannot afford.

### 1.1 Mana is not this currency, and that was the fork

Mana is already a capped, time-generated pool: production 10/13/16 per hour, cap
100/130/160, filling in 10 h. Making it pay for research too would have been
elegant — one budget, three spends, and *"research is literally magic in this
game"* — but it reopens the tuning that [`balancing-v3.md`](balancing-v3.md) §1
just closed, and the ad reward is priced as *one pool ≈ one span of production*.

**Decided: a second trickle currency.** Mana stays what magic costs
([`relics-and-ingredients.md`](relics-and-ingredients.md) §3), the ad keeps its
meaning, and `tap.boostSeconds` = 45 stays untouched. The cost is one more pool
to reason about; the benefit is that nothing already tuned moves.

### 1.2 Committed Knowledge is not a wallet balance

`wallet.ts` holds balances. Committed points are *"N unassigned plus M spread
across half-finished techs"*, which is a different shape. **Commitments live on
the tech's progress record; the wallet holds only uncommitted Knowledge.** That
also makes the player read exactly what they see: *this tome is at 12 of 40*.

### 1.3 A lump payment against a cap

The Conjunction pays a lump of 60. Against a capped pool, a lump gets eaten by
the ceiling — which `adOffers.ts` already solved, with the rule written down:
the reward **lands on top of the cap** (`grantMana` may overcharge), because
*"a reward clamped to a ceiling the player is already near would pay nothing and
read as broken"*. Knowledge lumps follow the same rule. No new argument needed.

## 2. The rename: Knowledge ↔ Stardust

One name cannot hold two jobs — that is how the docs ended up contradicting
themselves, which Phase 0 just spent a pass cleaning up.

| Name | Job | Source | Scope |
|---|---|---|---|
| **Knowledge** | the research clock | time, capped | **city** |
| **Stardust** | levels of relics and heroes | dungeons | **kingdom** |

Both names import a convention instead of teaching one: Knowledge is the word
Elvenar and Rise of Cultures use for this exact mechanic, and Stardust reads
across the market as the currency you pour into levelling a collectible. In the
docs and in code the key is **`Stardust`**; *Polvo estelar* is the localised
string. A currency with two names in two files is how balance bugs are born.

### 2.1 This is a migrator, not a find-and-replace

**The scopes swap.** Knowledge lives in `state.kingdom.wallet` today,
deliberately kingdom-scoped *so it survives a region reset*. That reasoning now
describes **Stardust**. The new Knowledge is **city-scoped**, like Mana, because
research belongs to this city.

Keys that currently say Knowledge and now mean Stardust:

| Key | Value |
|---|---|
| `delve.knowledgePerDepthPerTier` | 6 |
| `delve.firstClearKnowledge` | 150 |
| `knowledge.dripPerClearedRuinPerHour` | 2 |
| `gacha.pullKnowledge` | 50 |
| `rewardKnowledge` (Quests sheet) | 158 total |
| `collection.levelCostBase` / `levelCostGrowth` | 20 / 1.6 |
| `CONJUNCTION_BOONS[*].knowledge` | 60 — **decide: Stardust or the new Knowledge?** |
| `technologies[*].cost.Gold` | 6,600 → becomes committed Knowledge + resources + time |

`SAVE_VERSION` 21 → 22 **with a migrator**: move the balance from
`kingdom.wallet.Knowledge` to `kingdom.wallet.Stardust`, and create
`city.wallet.Knowledge` at zero.

**The trap, which is the same one the currency-simplification migrator had to
avoid:** a player mid-flight holds a Knowledge balance **earned as collection
currency**. It must become Stardust. A bare key rename hands the whole tech tree
to anyone with a balance. That doc's rule applies — *balances convert at the
rates they were earned*.

### 2.2 Do the docs and the code in one commit

Renaming in the docs first would leave them describing a currency the build does
not have, which is precisely the doc/code drift Phase 0 exists to remove. **The
rename lands as one change: balance keys, code, migrator and docs together.**

Docs that describe the wrong currency until then: `knowledge.md` (becomes
`stardust.md` — its §1 is already the definition of Stardust),
`00-design-intent.md`'s economy section, `currency-simplification.md`'s
seven-row wallet table (which becomes eight), and
`research-and-upgrades.md`. The frozen Unity snapshot (`01`–`11`) is **not**
touched: it is history.

No code collision: `research.ts`, `src/ui/research/` and `research.techSlots`
stay valid. Research is the activity; Knowledge is the currency.

## 3. Upgrades stay instant

The idea of upgrades consuming a research slot is tempting and should be
refused. Today an upgrade is **instant, Gold-only, cumulative**, applied through
the `effectiveX` helpers. Put it in the queue and a purchase that used to be one
tap now **blocks tech progress** — which makes players stop buying them. That
prices out the small satisfying purchase that fills the gaps between the big
ones.

**A slot's value comes from parallelising the slow things.** Make techs slower
and Knowledge-gated and the second slot sells itself. Two rhythms, deliberately:
the tome is the long deposit, the upgrade is the impulse buy.

## 4. Tomes: the value is navigation, and eras come free

The current tree is 24 techs at hand-authored `node:{x,y}` positions, depth 4,
with the canvas sized to what is visible. At a hundred techs a radial
hand-positioned canvas is ungovernable — and the bottleneck is not rendering, it
is that **the layout is authored content**.

> **A tome is a screen, not a region of a canvas.** One unbounded canvas becomes
> N bounded pages.

Positions stay hand-authored, but each layout is ~8 nodes instead of a hundred.
Navigation stops growing with content. The magic framing is a bonus; the saving
is structural.

**And tomes have tiers, which are the eras.** Age of Wonders 4's tomes are
tiered, and that is the mechanism the tree is missing: exhaust the Tome of Earth
I and the Tome of Earth II opens. It is an era gate, but **per branch instead of
global** — better for a game where players specialise, and a content drop adds
*Tome of Earth IV* as **a data row** rather than restructuring a global ladder.

Initial shelf, mapping the existing branches: **Earth** (agriculture, harvest,
terrain), **Stone** (masonry, mining, construction), **Tide** (sailing, fishing,
water), **War** (units, military buildings), **Arcana** (attunement, casting,
Mana). The current 24 techs redistribute across their first tiers.

## 5. Tomes found in ruins

Not over-engineering — it fixes three things at once.

**It gives the province a permanent reason to exist.** If tomes are *found* in
the authored province's ruins, the province is the source of the tech tree's
structure. Authored, so cheap and controllable.

**It gives ruins a second payload.** A first clear currently pays an artifact,
10 Gems and 150 Stardust, then becomes a repeatable faucet. Adding "and a tome"
makes the five ruins read as milestones of progress rather than difficulty
tiers.

**And it gives the tree a narrative origin, which it completely lacks.** Right
now you unlock Forestry because you unlock Forestry. `00-design-intent.md`
admits the game *"reads like a generic village simulator (charming)"* after
magic was cut. **Finding a grimoire in a ruin and having a branch of magic open
that you did not have is a beat the current tree cannot produce**, and it is the
differentiation against Kingshot and Whiteout that costs a column in the `Ruins`
sheet.

**Caution:** do not gate every tome behind a ruin. A ruin needs a hero and an
army, and `knowledge.md` §6 already flags that delve gate as the live risk — a
player who never delves makes no progress. **Two or three tomes available from
the start; ruins open the rest.**

## 6. Contested landmarks raise the cap, not the rate

Contested world-map landmarks that boost Knowledge are exactly the kind of thing
players will fight over, which is the point. But a **rate** bonus is a
compounding advantage, and compounding advantages held by whoever is already
winning are how a competitive layer becomes a runaway: the guild holding them
researches faster, grows stronger, and holds them harder.

The repo already made this exact decision, for this exact reason.
`ad-economy.md` §3b and `magic.md` §4: sanctuaries raise Mana **capacity, not
production** (changed 2026-09-02), because *"+1 Mana/h was worth most on the day
you found it and less every day after — production is a rate, and the things it
competed with kept growing"*.

> **A contested landmark raises your Knowledge cap.** You bank more research
> between visits — highly visible, highly valuable, and it does not snowball.

## 7. The prize nobody has claimed yet

In Elvenar and Forge of Empires the trickle currency does not only pay for
research. **Knowledge Points and Forge Points are invested into other players'
Ancient Wonders and Great Buildings, and the top five contributors are paid when
it completes.** That is the economy of favours behind FoE's FP market and The
Arc — and it is the mechanic the 2026-09-02 competitive review named as the
number-one missing pillar.

So a trickle-and-commit currency buys **research and the best-documented social
mechanic in the quadrant with the same verb**. The same "invest N points" action
points at your own tome or at a guild structure, and a top-contributor payout
does the rest.

That makes this feature a dependency of [`social-layer.md`](social-layer.md)
rather than a neighbour of it, and it is the strongest argument for doing the
rework at all.

## 8. Where every currency lands

| Currency | Source | Buys | Scope |
|---|---|---|---|
| **Knowledge** | time, cap raised by contested landmarks | commit techs · **invest in guild structures** | city |
| **Mana** | time, cap by Townhall + sanctuaries | taps · relic actives, on both maps | city |
| **Stardust** | dungeons | relic and hero levels | kingdom |
| **Ingredients** | 1★ province · 2★ events · 3★ world map | each relic's tier gate | kingdom |
| **Gems** | quests, first clears, simulated store | comfort and breadth — and finishing a tech early | player |

One job each, which is the rule `currency-simplification.md` fought to
establish. Eight wallet rows, five things on the plank.

## 9. Build order

1. The rename, whole (§2): keys, code, migrator, docs, one commit.
2. Knowledge as a clock: accrual, cap, commit, the Gem finish. Techs reprice
   from Gold to committed Knowledge + resources + time.
3. Lumps land over the cap (§1.3), with the test.
4. Tomes as screens: the shelf, five tomes, the existing 24 techs
   redistributed. Positions stay authored, per page.
5. Tome tiers, and the second tier of one tome authored to prove the era shape.
6. Tomes from ruins: a column in `Ruins`, two or three tomes open at the start.
7. Contested landmarks raise the cap — after the world map exists.
8. Investing Knowledge in a guild structure — with `social-layer.md`.

## Open decisions

1. **Does the Conjunction's 60 lump pay Knowledge or Stardust?** It reads as
   arcane insight, which argues Knowledge; it has always fed the collection,
   which argues Stardust. Cheapest answer: split it.
2. **What is a tech's Knowledge cost, and what is the accrual rate?** The whole
   pacing of the game past hour three lives in these two numbers, and neither
   can be derived — they need the 30-day playtest.
3. **What Stardust does once ingredients are the real gate**
   ([`relics-and-ingredients.md`](relics-and-ingredients.md) §8).
4. **Do upgrades stay Gold-only forever?** §3 says yes for now. If Gold becomes
   abundant once the fog is spent, upgrades are the natural place to put the
   surplus, and that argues for repeatable levels with an exponential curve —
   which `upgradeCost` already computes.
5. **Naming the tomes.** *Earth, Stone, Tide, War, Arcana* is a first pass and
   deliberately plain; the tome titles are one of the cheapest places to put
   character into the game.
