# 7 · Research — the tree today, the tomes it becomes, and upgrades

> **Scope.** Technologies, instant upgrades, the shape of the tree, and the
> planned conversion of the tree into **tomes** paced by **Knowledge as a
> clock**.
>
> **Status: the tree is built and Gold-priced. Tomes, and Knowledge as a clock,
> are designed and unstarted.** §1–§3 describe what ships; §4–§7 describe what
> it becomes and why.

## 1. What ships

One menu, **one tree**. Technologies are rounded **squares**; upgrades are
smaller **circles** hanging below the technology that unlocked them — what you
can improve is always shown in the context of how you unlocked it. Shape carries
the kind; they used to differ only in size, which is a weak signal on a busy
tree.

### 1.1 Technologies

One-time researches that **unlock new content** — buildings, units, upgrades,
slots, and levels of buildings you already own.

- **Cost Gold + time**, paid up front from the **city** purse. Gold and nothing
  else, so the tree competes with clearing fog and raising a building for **one
  budget**. Three calls on one purse is the decision the economy is built around.
- Complete through the same advance the build queue uses, so they finish while
  you are away, in real time.
- Limited by **concurrent research slots**: base 1, max 3. Slot 2 costs 10 Gems,
  slot 3 costs 30 (`base × growth^purchased`).
- Each lists `requires`; content gates on `requiredTech`.

**24 technologies, 6,600 Gold in total.** Against a quest chain that pays
11,865, that is a ratio of **1.80×** — which is the measurement §4 is built on.

### 1.2 The tree

**Forestry** is the root: it opens the Forest *and* the berry bushes to the tap,
and carries the three global upgrades. Five branches leave it.

| Branch | Chain |
|---|---|
| **Civics** | Urban Planning (Housing L2) → Communities (+1 bed everywhere) → Architecture (Townhall L3) |
| **Economics — wood** | Saws (the Sawmill) · Hunting (the wild-game tap) |
| **Economics — farm** | Agriculture (FarmLands **and** the Farm) → Farming (Farm L2) · Agriculture → Market |
| **Economics — stone** | **Scaling Tools** (mountains answer a pick) → Masonry (Quarry) → Mining (Mine) → Deep Mining (Mine L2) · Masonry → Engineering (Quarry L2, Sawmill L3) |
| **Exploration** | Cartography (**every fog tap counts double**) → Sailing (water) → Fishing (Docks) → Shipbuilding (Docks L2) |
| **Military** | Warrior (Barracks) → Spears (Spear Hall) · Archery (Shooting Grounds) → Warband · Cavalry (Stables) |
| **Arcana** | Attunement (the Sanctum, the second attunement slot, Resonance) |

Two shapes here are deliberate and easy to undo by accident:

- **Chopping by hand and automating it are two separate decisions**, ten
  onboarding beats apart. That is why **Saws** hangs off Forestry separately
  rather than Forestry unlocking the Sawmill. **Stone repeats the pattern
  exactly**: Scaling Tools opens a mountain to the pick, Masonry unlocks the
  Quarry that automates it. Masonry cannot come first, or researching it would
  hand the player a Quarry with nothing to quarry — the same lie as a node that
  unlocks nothing.
- **Scaling Tools left the exploration branch**, because it no longer gates
  reaching anything: mountains became a feature, so it gates *working* one
  ([`01-map-and-fog.md`](01-map-and-fog.md) §3.1). Its upgrade **Pitons** stayed
  behind with the fog and now hangs off Cartography, beside Surveying — which is
  where the two of them always belonged, since one discounts the Gold a cell
  costs and the other buys back the taps.
- **Agriculture unlocks the Farm as well as FarmLands** — one research, so
  nothing sits between tapping a plot and automating it. When it took over the
  Farm, `Farming` inherited the level-2 gate and **Crop Rotation was retired**:
  a node in the tree that unlocks nothing is the same lie as a lit tab that
  leads nowhere.
- **Cartography carries an effect of its own** rather than only gating what
  follows. A technology with a stat effect is not new — Communities adds a bed
  the same way.

### 1.3 Tree fog

The tree is discovered like the map.

| State | Drawn as |
|---|---|
| **Normal** | researched, researching, or all requirements met |
| **"?" silhouette** | one step ahead — every prerequisite is normal. A dim dashed square with a `?`: no name, no cost, not tappable. You know *something* is there. |
| **Hidden** | anything deeper does not render at all |

The canvas is sized to what is currently visible, so the tree physically grows
as you research.

### 1.4 Upgrades stay instant

**Instant, Gold-only, levelled** numeric boosts. `round(base × growth^level)`.

An upgrade's circle fans in below its parent square **when the parent
completes** — the visible reward of the research. Before that it is not shown at
all.

| Upgrade | Parent | Effect per level | Max |
|---|---|---|---|
| TapPower | Forestry | +1 per tap | 5 |
| QuickHands | Forestry | −5% collect cooldown | 5 |
| WorkerLoad | Forestry | +1 per delivery | 3 |
| Sawpits · Irrigation · Stonecutting · Big Nets · Iron Picks | their line | +1 per delivery | 3 |
| Butchery · Scythes | Hunting · Farming | +1 per collect tap | 3 |
| Surveying | Cartography | +1 more cell per fog tap | 2 |
| Pitons | Cartography | −10% on the Gold a cell costs | 2 |
| MarketStall | Market | +5% sale prices | 4 |
| TradeRoutes | Market | +10% tax income | 5 |
| Resonance | Attunement | −20% on a relic's Mana cast cost | 2 |

**The line between a technology and an upgrade is not the currency** — both are
Gold. It is that **an upgrade is permanent and stacking; a technology is a
one-time unlock.**

> **Upgrades must stay out of the research queue**, and the temptation to put
> them in should be refused. Put an upgrade in the queue and a purchase that
> used to be one tap **blocks tech progress**, which makes players stop buying
> them — and prices out the small satisfying purchase that fills the gaps
> between the big ones. **A slot's value comes from parallelising the slow
> things.** Make techs slower and Knowledge-gated and the second slot sells
> itself. Two rhythms, deliberately: the tome is the long deposit, the upgrade is
> the impulse buy.

**Upgrades and relics must not overlap.** Upgrades are permanent, stacking and
bought with Gold; relics are exclusive, swappable and levelled with Stardust. No
single effect should be reachable through both.

## 2. Why the tree has to change

The tree today is **a checklist rather than a tree**: one root gate with 8 of 24
technologies hanging directly off it, five branches that never reconverge, no
exclusive choices, maximum depth 4, and fully exhausted inside the 2–3 hour arc.

And the arithmetic says it was never really the point: **6,600 Gold against a
chain that pays 11,865.** The tree is not a sink; it is a formality the chain
funds twice over.

**The fix is not more nodes.** At a hundred technologies a radial hand-positioned
canvas is ungovernable — and the bottleneck is not rendering, it is that **the
layout is authored content.**

## 3. Knowledge, the clock

The model every comparable uses: in Elvenar, Forge of Empires and Rise of
Cultures the research currency is a **clock**, accrued per hour and never
earned, existing only to pace the tree.

- **Accrues with time to a cap.** Not earned, not dropped, not bought with
  resources.
- **Committed** into a technology: a tome takes N Knowledge poured in over
  several visits, and *then* resources plus build time to develop.
- **Gems finish it**, priced on the Knowledge still missing. A clean comfort
  purchase.
- **Cap raised by contested world-map landmarks** (§6).

The commit step is what makes this better than a price tag: a technology becomes
something you are *working towards* across visits, visible as `12 / 40`, which
fits a game played in two or three check-ins far better than a number you either
can or cannot afford.

### 3.1 Mana is not this currency, and that was the fork

Mana is already a capped, time-generated pool. Making it pay for research too
would have been elegant — one budget, three spends, and *research is literally
magic in this game* — but it reopens tuning that was deliberately closed, and
the ad reward is priced as *one pool ≈ one span of production*.

**Decided: a second trickle currency.** Mana stays what magic costs, the ad keeps
its meaning, and what a tap is worth stays untouched by *this* feature. The cost
is one more pool to reason about; the benefit is that nothing already tuned
moves. (What a tap is worth did move, for unrelated reasons —
[`04-harvest.md`](04-harvest.md) §4 — and with it what an ad is worth, OQ-51.)

### 3.2 Committed Knowledge is not a wallet balance

The wallet holds balances. Committed points are *N unassigned plus M spread
across half-finished tomes*, which is a different shape. **Commitments live on
the technology's progress record; the wallet holds only uncommitted Knowledge.**
That also makes the player read exactly what they see: *this tome is at 12 of
40.*

### 3.3 A lump lands over the cap

A weekly event pays a lump. Against a capped pool a lump gets eaten by the
ceiling, so — following the rule the Mana ad reward already established — **the
reward lands on top of the cap**, because a reward clamped to a ceiling the
player is already near would pay nothing and read as broken.

## 4. Tomes: the value is navigation, and eras come free

> **A tome is a screen, not a region of a canvas.** One unbounded canvas becomes
> N bounded pages.

Positions stay hand-authored, but each layout is ~8 nodes instead of a hundred.
Navigation stops growing with content. The magic framing is a bonus; the saving
is structural.

**And tomes have tiers, which are the eras.** Exhaust the Tome of Earth I and
the Tome of Earth II opens. It is an era gate, but **per branch instead of
global** — better for a game where players specialise, and a content drop adds
*Tome of Earth IV* as **a data row** rather than restructuring a global ladder.

Initial shelf, mapping the existing branches: **Earth** (agriculture, harvest,
terrain) · **Stone** (masonry, mining, construction) · **Tide** (sailing,
fishing, water) · **War** (units, military buildings) · **Arcana** (attunement,
casting, Mana). The current 24 technologies redistribute across their first
tiers.

## 5. Tomes found in ruins

Not over-engineering — it fixes three things at once.

**It gives the province a permanent reason to exist.** If tomes are *found* in
the authored province's ruins, the province is the source of the tree's own
structure. Authored, so cheap and controllable.

**It gives ruins a second payload.** A first clear pays an artifact, Gems and a
Stardust lump, then becomes a repeatable faucet. Adding *and a tome* makes the
five ruins read as milestones of progress rather than difficulty tiers.

**And it gives the tree a narrative origin, which it completely lacks.** Right
now you unlock Forestry because you unlock Forestry. **Finding a grimoire in a
ruin and having a branch of magic open that you did not have** is a beat the
current tree cannot produce, and it costs a column in the ruins data.

**Caution:** do not gate every tome behind a ruin. A ruin needs a hero and an
army, and that delve gate is already the live risk — a player who never delves
makes no progress. **Two or three tomes available from the start; ruins open the
rest.**

## 6. Contested landmarks raise the cap, not the rate

Contested world-map landmarks that boost Knowledge are exactly the kind of thing
players will fight over, which is the point. But a **rate** bonus is a
compounding advantage, and compounding advantages held by whoever is already
winning are how a competitive layer becomes a runaway: the guild holding them
researches faster, grows stronger, and holds them harder.

The same decision was already made, for the same reason, for Mana: sanctuaries
raise **capacity, not production**, because *+1/h was worth most on the day you
found it and less every day after — production is a rate, and the things it
competed with kept growing.*

> **A contested landmark raises your Knowledge cap.** You bank more research
> between visits — highly visible, highly valuable, and it does not snowball.

## 7. The prize nobody has claimed yet

In Elvenar and Forge of Empires the trickle currency does not only pay for
research. **Knowledge Points and Forge Points are invested into other players'
Ancient Wonders and Great Buildings, and the top contributors are paid when it
completes.** That is the economy of favours behind FoE's FP market and The Arc —
and it is the single missing pillar the competitive review named first.

So a trickle-and-commit currency buys **research and the best-documented social
mechanic in the quadrant with the same verb**. The same *invest N points* action
points at your own tome or at a guild structure, and a top-contributor payout
does the rest.

That makes this a **dependency** of [`15-social.md`](15-social.md) rather than a
neighbour of it, and it is the strongest argument for doing the rework at all.

## 8. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Technology costs and durations | 24 rows, 6,600 Gold | `Technologies` sheet |
| Research slots | 1, max 3, Gem price `10 × 3^n` | `research.*` |
| Upgrade costs and effects | §1.4 | `Upgrades` sheet |
| Node positions | authored `node:{x,y}` — the layout is content | `definitions.ts` |
| **A tome's Knowledge cost** | undecided — OQ-13 | — |
| **Knowledge accrual and cap** | undecided — OQ-13 | — |

## 9. Deliberately not in this design

Upgrades consuming a research slot (§1.4) · a global age ladder instead of
per-branch tome tiers · exclusive branch picks · re-pricing the tree's Gold
before eras land (OQ-42) · a general upgrade-scoping mechanism — the scoped
tap and worker yields are small lookup tables at the call site, because a
handful is all the game has and a table is what the handful needs.

**Open questions:** OQ-12, OQ-13, OQ-14, OQ-15, and OQ-42.
