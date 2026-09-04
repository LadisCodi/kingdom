# 7 · Research — the tree today, the tomes it becomes, and upgrades

> **Scope.** Technologies, instant upgrades, the shape of the tree, and its
> conversion into **three tomes with tiers** — Civics, Warfare, Magic — paced by
> **Knowledge as a clock**.
>
> **Status: the tome rework is BUILT.** It landed on `develop` and was merged
> into the harvest branch on 2026-09-04. The **system** is
> [`tomes-and-research.md`](tomes-and-research.md) and the **node list** is
> [`tech-tree.md`](tech-tree.md) — read those for what ships. §1–§2 below
> describe the pre-tome tree they replaced, and §3 onward the design as it was
> settled on 2026-09-03; where the two disagree, the companion docs win.
>
> **Five decisions were taken on 2026-09-03** and everything downstream depends
> on them: **a tome is a page of technologies**, not the thing you pour into
> (§6); **the Knowledge drip is flat and ungated**, and cleared ruins raise the
> **cap** rather than the rate (§3.1, §3.3); **the collection currency becomes
> Stardust** so the clock can take the name Knowledge (§4); and **the tiers get
> newly authored technologies** rather than a re-sort of the existing 24 (§6.4);
> and **the shelf is three tomes — Civics, Warfare, Magic** — laid out as a
> vertical spine three columns wide with a **join node** for every tier gate
> (§6.1, §6.3, §6.5).
>
> **No numbers are set here.** The rate, the cap, a technology's Knowledge cost
> and the tier threshold are balance and they need the playtest (**OQ-13**);
> this document owns their *shape* and the ceiling one of them cannot cross
> (§3.2).

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
  **The rework keeps this and adds Knowledge in front of it** (§5): Knowledge
  paces, Gold prices.
- Complete through the same advance the build queue uses, so they finish while
  you are away, in real time.
- Limited by **concurrent research slots**: base 1, max 3. Slot 2 costs 2,500
  Gems, slot 3 costs 5,000 (`base × growth^purchased`) — a second queue is
  priced as a second builder.
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
| **Economics — stone** | Masonry (Quarry) → Mining (iron mountains) → Deep Mining (gold mountains) · Masonry → Engineering (Quarry L2, Sawmill L3) |
| **Exploration** | Cartography (**every fog tap counts double**) → Sailing (water) → Fishing (Docks) → Shipbuilding (Docks L2) |
| **Military** | Warrior (Barracks) → Spears (Spear Hall) · Archery (Shooting Grounds) → Warband · Cavalry (Stables) |
| **Arcana** | Attunement (the Sanctum, the second attunement slot, Resonance) |

Two shapes here are deliberate and easy to undo by accident:

- **Chopping by hand and automating it are two separate decisions**, ten
  onboarding beats apart. That is why **Saws** hangs off Forestry separately
  rather than Forestry unlocking the Sawmill. **Stone does not repeat it**:
  the bare peak answers a pick from the first second and Masonry unlocks the
  Quarry that automates it. It was going to — Scaling Tools was to open the
  mountain — but the tome tree parks Scaling Tools in Magic era 2, and a
  Quarry that stood idle until then would be the same lie as a node that
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

**The fix is not more nodes** — not on *this* canvas. At a hundred technologies a
radial hand-positioned layout is ungovernable, and the bottleneck is not
rendering, it is that **the layout is authored content.**

**The fix is pages, and then more nodes.** Bounded pages are what make a
hundredth technology affordable, because it lands on page twelve instead of in
the middle of everything — so the structure comes first and the content follows
it (§6.4). What ships today spreads **very unevenly** across the three tomes —
**Civics 18, Warfare 5, Magic 5** with the spells folded in (§6.1) — so one tome
needs splitting into tiers and two need writing. **The shelf is a container the
game only partly has the books for.**

## 3. Knowledge, the clock

The model every comparable uses: in Elvenar, Forge of Empires and Rise of
Cultures the research currency is a **clock**, accrued per hour and never
earned, existing only to pace the tree.

**The machinery already ships**, which is the cheapest thing about this rework.
`knowledgePerHour` and `accrueKnowledge` (`src/sim/mana.ts`) already accrue
whole units against a stored anchor — **the same shape as taxes and Mana, so all
three replay identically.** What changes is not how it accrues; it is **what
generates it, what bounds it, and what it buys.**

### 3.1 What generates it — a base drip, and nothing gates it

> **Knowledge accrues from the first minute of a new game, before the player
> owns anything.**

Today's generator is *2 an hour per cleared ruin*, and it returns **zero with no
cleared ruin**. That was correct while Knowledge fed the collection — the arc it
paid for was the arc you earned it in. **It would be wrong for a research
currency**, because it would put the entire technology tree behind a dungeon,
and a dungeon needs a hero and an army. **OQ-41** already names that gate as the
live risk for collection progress; pointing all progression through it would
turn a risk into the shape of the game.

So the rate is **flat, ungated, and the same for everyone.** The exits that were
considered and rejected:

| Rejected generator | Why |
|---|---|
| Cleared ruins set the **rate** (today's model) | the whole tree behind a delve |
| Scales with **Townhall level or population** | thematic, and a *compounding* rate — the exact thing §9 rejects, and it makes the biggest city research fastest, which is backwards for a catch-up-friendly game |
| Bought with resources | it stops being a clock; a clock you can buy is a price tag |
| A **library district** or a **scholar** worker assignment | already refused in [`03-economy.md`](03-economy.md) §9 — both put the research clock back inside the city's *worked* economy, which is what a clock exists not to be |

**What the rate does NOT do is grow.** A flat rate against tiers that cost more
means the game slows down forever, which sounds like a flaw and is the genre's
load-bearing shape: it is what makes a late tome a *project* rather than an
afternoon. If a rate multiplier is ever wanted, `knowledgeYield` already exists
as a modifier stat — but it should be temporary (a relic, a boon), never
permanent, for the reason §9 gives.

### 3.2 The cap, and the two ceilings that are easy to confuse

Knowledge accrues **to a cap**, and overflow is lost. That is the same pressure
Mana uses and it is promise-1-safe for the same reason: **an opportunity that
expires is not property taken away.**

**But there are two ceilings on what an absence banks, and only one of them is
visible.** `accrueKnowledge` runs in the sim's *continuous* pass — it is city
idle **production**, exactly like Mana regen and taxes — so **invariant 2
applies: it stops at the 8-hour offline cap.** A 20-hour absence banks 8 hours of
drip no matter how large the pool is.

That has a consequence nobody would find until a player complained:

> **The pool cap only does any work while it sits BELOW eight hours of drip.**
> Above that it is decoration, and the thing actually limiting a long absence is
> an invariant the player cannot see.

**So the rule is that the cap ladder tops out at or below eight hours of drip**
(**OQ-13** owns the numbers). Kept there, the player only ever meets the ceiling
they can read on the screen, and the invisible one never fires. It is the kind of
number that has now been argued once; **it should be asserted before it is
argued twice.**

### 3.3 Cleared ruins raise the cap, not the rate

Today's per-ruin drip does not disappear — **it changes what it pays into.**
Each cleared ruin raises the **cap**, and the rate is untouched.

This is the same decision, for the same reason, that §9 makes for contested
landmarks and that [`08-magic.md`](08-magic.md) already made for sanctuaries:
*a rate bonus is worth most on the day you found it and less every day after;
capacity is worth more the longer you play.* And it keeps the province's ruins
paying into research without gating research on them — **you research from
minute one, and clearing ruins lets you bank more of it between visits.**

The ceiling on that reward is §3.2's rule: **the last ruin's rung has to still
sit under eight hours of drip**, or the deepest, hardest content in the province
pays nothing at all.

### 3.4 Committed Knowledge is not a wallet balance

The wallet holds balances. Committed points are *N unassigned plus M spread
across half-finished technologies*, which is a different shape.
**Commitments live on the technology's own progress record; the wallet holds
only uncommitted Knowledge.** That also makes the player read exactly what they
see: *this technology is at 12 of 40.*

### 3.5 A lump lands over the cap

A weekly event pays a lump. Against a capped pool a lump gets eaten by the
ceiling, so — following the rule the Mana ad reward already established — **the
reward lands on top of the cap**, because a reward clamped to a ceiling the
player is already near would pay nothing and read as broken.

### 3.6 Mana is not this currency, and that was the fork

Mana is already a capped, time-generated pool. Making it pay for research too
would have been elegant — one budget, three spends, and *research is literally
magic in this game* — but it reopens tuning that was deliberately closed, and
the ad reward is priced as *one pool ≈ one span of production*.

**Decided: a second trickle currency.** Mana stays what magic costs, the ad keeps
its meaning, and what a tap is worth stays untouched by *this* feature. The cost
is one more pool to reason about; the benefit is that nothing already tuned
moves.

**The symmetry is worth naming, because it is what makes the second pool
teachable rather than confusing:** Mana is the session budget for **the map**,
Knowledge is the session budget for **the tree**. Both fill with time, both have
a ceiling, both waste what overflows, and both are what the player comes back to
spend. One verb each, and neither reaches into the other's half of the game.

## 4. The rename — and it is already the written design

**Knowledge cannot be the research clock while it is the collection currency.**
Today it is the latter: it buys hero and relic levels (`src/sim/collection.ts`,
`src/sim/artifacts.ts`) and it buys nothing else.

**Twelve design documents already call that currency Stardust. The code has zero
occurrences of the word.** So this is not a rename being proposed here — it is
**doc/code drift being closed in the direction the design already chose**, and
the name *Knowledge* was always being held for the clock.

| | Before | After |
|---|---|---|
| Hero and relic levels | Knowledge, **kingdom**-scoped | **Stardust**, kingdom-scoped |
| Pacing the technology tree | Gold only | **Knowledge**, **city**-scoped |

**The scopes swap, and that is a decision rather than a detail**
([`03-economy.md`](03-economy.md) §1.1). Today's Knowledge is kingdom-scoped
deliberately *so it survives a region reset* — and that reasoning is about the
**collection**, so it follows Stardust. **The new Knowledge is city-scoped, like
Mana, because research belongs to this city.** The two pools that pace a session
therefore live at the same level and reset together, which is the other half of
§3.6's symmetry.

### 4.1 The migrator, and the exact trap it exists to avoid

**This needs a real migrator, not a version bump**, and the plan already names
the trap: *a bare key rename hands the whole technology tree to anyone holding
Knowledge.* Stated precisely, because it is the one thing that must not be got
wrong:

> A live save's `Knowledge` balance was earned as **collection** currency. It
> must arrive as **Stardust**, and the new research `Knowledge` must be born at
> **zero.**

That is the whole migration, and it is the easy direction: the balance keeps its
meaning and changes its name, so **no rate conversion is needed** — unlike the
currency simplification, where balances had to convert at the rates they were
earned. The danger is only in doing nothing: leave the key alone and a
mid-flight player's collection savings silently become free research.

### 4.2 `knowledgeYield` follows the thing it was earned from

The modifier stat and its two consumers — the Wanderer's Compass relic
(*"brings back half again as much Knowledge"*) and the `insight` delve boon —
were written to multiply an **expedition** payout. They belong with Stardust,
so **the stat renames with the currency.** A multiplier on the research clock
should be born separately, if anything ever wants one, and §3.1 says it should
be temporary when it is.

**The rename lands as ONE change — balance keys, code, migrator, saves and docs
together.** Renaming in the docs first would leave them describing a currency
the build does not have, which is exactly the drift this closes.

## 5. How a technology is bought — pour, then price

Three states, and the middle one is the whole feature:

| State | What the player sees | What it costs |
|---|---|---|
| **Sealed** | `0 / 40` and what it will unlock | nothing yet |
| **Filling** | `12 / 40`, across visits | **Knowledge**, poured by hand |
| **Ready** | a normal researchable node | **Gold + time**, and a research slot |

**The commit step is what makes this better than a price tag.** A technology
becomes something you are *working towards* across visits, visible as `12 / 40`,
which fits a game played in two or three check-ins far better than a number you
either can or cannot afford.

- **The player pours; the drip does not pour itself.** See §11 for why the
  obvious alternative was rejected.
- **Pouring is unlimited and free of slots.** You may spread the pool across as
  many sealed nodes as you like — the slot gates *developing*, not *saving*.
- **Nothing can be un-poured.** Committed Knowledge stays in the technology it
  was committed to. Promise 1 is not violated: nothing is taken away, it is
  banked in the thing you chose — but it does mean a pour is a **decision**, and
  the design wants it to be one.
- **Gems finish a fill**, priced on the Knowledge still missing. A clean comfort
  purchase, and the third promise's *wallets buy comfort* in its purest form.
- **Gold and time stay exactly as they ship.** A ready technology is today's
  technology: paid from the city purse, developed through the same advance the
  build queue uses, finishing while the player is away, and limited by
  concurrent research slots. **`techCompletesAt` remains the boundary source it
  already is, so invariant 1 does not gain a line.**

### 5.1 Why Gold stays, and why this is what OQ-42 was waiting for

A second gate that never binds is decoration, and 6,600 Gold across 24
technologies never binds — it is **0.85% of the province's one-time Gold sink**
([`16-wonders.md`](16-wonders.md) §1). So Gold in the tree was heading for one of
two ends: removed, or made to mean something.

**Tiers are eras** (§6), and **OQ-42** has been waiting for eras to decide
whether to re-derive the tree's Gold. It no longer has to wait: **a tome's Gold
is priced per tier**, so tier I is pocket change and a deep tome is a real call
on the same purse as the fog and the next building. *Three calls on one budget*
— the decision [`03-economy.md`](03-economy.md) is built around — survives, and
starts binding instead of merely existing.

### 5.2 Tapping a node opens a centred sheet, and what it must say

**One tap on a node, one sheet over the tree.** Not the floating card that ships
today — a **centred sheet with its own close knob**, which is the primitive
`kit/surface.ts` already provides and already documents for exactly this:
*"for a short, modal, one-decision sheet — an offer or a confirmation — where
the bottom-sheet idiom is the wrong metaphor."* **A node is one decision**, so it
qualifies.

**The header and the nav bar stay above it, and that is the rule rather than an
accident.** `src/style.css` says why, and names this screen: the exception that
let a full-screen menu cover the resource bar was removed because *"that hid the
resource bar exactly when the player was reading prices — the Research screen
being the worst of it."* **The purse has to stay readable while the player
decides what to pour.**

What the sheet says depends on which of the three node kinds was tapped, and
**they are genuinely different questions**:

| | **Technology** | **Spell node** (§7) | **Upgrade** (the circle) |
|---|---|---|---|
| Title | name **+ tier numeral** — *Communities I* | name + numeral | name |
| Badge on the icon | the pour, **`12 / 40`** | the pour | **`Lv 2 / 5`** as pips |
| The block that matters | **Unlocks:** the sprite of what it gives | **Unlocks:** the spell, with its Mana cost | **the before → after** |
| Meter | the Knowledge pour | the pour | none — an upgrade is instant |
| Requirements | prerequisite medallions, ✓ / ✗, tappable to scroll there | same | not shown; a circle is only drawn once its parent is done |
| Action | **Pour** · **Finish with Gems** · then **Research** | same | **Upgrade** |

Two of those rows carry the whole value of the screen.

**`Unlocks:` is the single most valuable missing piece of information in the
UI**, and it has been named as such in the art brief for as long as the brief
has existed: *today the player cannot tell what a tech gives them until it
finishes and a banner announces it.* The code already knows — `requiredTech` on
districts, units and upgrades — and the panel has simply never said it. **A
technology's sheet leads with the sprite of the building it hands over.**

**`before → after` is what an upgrade's sheet leads with instead**, because an
upgrade has no *unlock* to show — it moves a number, and the only honest way to
present that is both values:

```
Level              2  →  3
Tap Power        +40%  →  +60%
```

That is the distinction the two kinds have always had and the screen has never
drawn: **a technology is discrete and answers *what do I get*; an upgrade is
continuous and answers *how much better*.** A spell node is both, which is why
its sheet shows the unlock and its circles below show deltas.

### 5.3 The Pour button pours everything, and never overfills

**How much one tap pours was the open question, and a stepper is the wrong
answer** — a slider on a cozy game's research screen is a spreadsheet.

> **Pour puts the whole uncommitted pool into this node, capped at what the node
> still needs.**

That single rule does all the work §5 asked for. **Spreading the pool across
several nodes needs no extra control**: pour into the first until it is full, the
surplus stays in the pool, pour into the next. Taps only, no arithmetic, and the
sheet can state the outcome before it happens — *`12 / 40` becomes `31 / 40`* —
because it is fully determined.

**No attempt limit and no contribution cooldown.** The reference layouts this
screen borrows from meter pouring with *attempts* that refill on a timer, and it
is worth saying plainly that Kingdom must not: **the pool is already the
limiter**, a second one would be two ceilings doing one job (§3.2's fault in
miniature), and a timer that hands the player three taps an hour is the *chore*
reading §12 keeps out of the whole design.

## 6. The shelf — three tomes, tiers, and one page rule

> **A tome is a screen, not a region of a canvas.** One unbounded canvas becomes
> **six vertical pages, one per tome**, and **the technology stays the unit** —
> you pour into a node, never into a tome.

Navigation stops growing with content: a tome is a **tab**, and a tab is a
single column of content you **scroll down**. The magic framing is a bonus; the
saving is structural — and §6.5 is where most of it actually comes from, because
a vertical page with a bounded width **stops the layout being authored art.**

**Tiers are the eras, per branch instead of global.** Exhaust *Civics I* and
*Civics II* opens. Better for a game where players specialise, and a content
drop adds *Civics IV* as **a data row** rather than restructuring a global
ladder.

### 6.1 Three tomes, and where the existing 24 land

**Three, settled 2026-09-03**, down from a proposed six. Three is what a tab
strip holds on a phone — the reference layouts this screen borrows from all use
three — and it is the number that makes each tome a **place**, rather than a
shelf of thin pages nobody can hold in their head.

| Tome | Remit | From what ships |
|---|---|---|
| **Civics** | the city and everything non-magical: buildings and their levels, population, trade, the ground, the fog, the water | **18** — Forestry · Urban Planning · Communities · Architecture · Market · Saws · Hunting · Agriculture · Farming · Scaling Tools · Masonry · Mining · Deep Mining · Engineering · Cartography · Sailing · Fishing · Shipbuilding |
| **Warfare** | units, the military halls, and what makes an army better | **5** — Warrior · Spears · Archery · Warband · Cavalry |
| **Magic** | **spells** (§7), and any effect the fiction can carry as enchantment — *the trees grow faster because you made them* | **1** — Attunement, **plus the four spells**, which is what makes this tome a page rather than a node |

**The lopsidedness moved rather than going away.** Six tomes left *Arcana* at one
node; three leave **Civics at eighteen** while Warfare and Magic sit at five
each. That is a better problem: **eighteen is a tome that needs splitting into
tiers, which is authoring it already has the content for**, where one node was a
tome that needed content invented for it.

### 6.1.1 Magic is not the spell tab — it is a third of the economy, enchanted

The remit that makes three tomes work rather than merely fit is Magic's, and it
is wider than *spells*: **any effect the fiction can carry as enchantment.**
Faster tree regrowth is the example that proves it — that is `cellRecovery`,
which is an economic stat, and *the grove grows back because you sang to it* is
as good a reason as *you bought better saws.*

So the shelf is not *city / army / magic-as-a-side-dish*. It is:

> **Civics is the mundane route to an outcome. Magic is the enchanted route to
> the same outcome. Warfare is the outcome nobody else offers.**

That is where this shelf earns something the old tree conspicuously lacked. §2's
complaint is that the tree has *no exclusive choices*; with a Knowledge clock
that is genuinely scarce, **pouring into the enchanted route instead of the
mundane one is a real choice with real opportunity cost** — and because a
skipped node can always be filled later, it is a **choice without a lock**,
which is the only kind §12 allows.

**One rule keeps it from becoming duplication:**

> **Two tomes may aim at the same outcome. They may never move the same stat.**

More wood is an outcome. *More per strike* (`workerYield`, Civics — better
tools) and *faster regrowth* (`cellRecovery`, Magic — enchanted growth) are two
stats reaching it. That is two levers on one goal, which is depth. **The same
stat appearing in both tomes is not depth, it is the same node authored twice**,
and it is the exact fault [`09-relics.md`](09-relics.md) §10 already forbids
between relics and upgrades.

### 6.2 Tier I of every tome opens from the start, because the root has to go

Under the three-tome shelf there are **exactly two cross-tome prerequisites, and
both of them are Forestry**: `Forestry → Warrior` and `Forestry → Attunement`.
Everything else already lives inside its own tome, because Civics absorbed the
whole economic half of the tree.

So the same conclusion as before, reached with less to argue about — the page
rule:

> **A prerequisite may only point inside its own tome. The tier ladder is the
> only cross-tome gate.**

Which means the universal root stops being one. **Both remaining edges are the
same node**, and that node is §2's first complaint about the tree: *one root gate
with 8 of 24 technologies hanging directly off it.* Cutting them costs two rows
and it is not a loss — **Forestry gating the Barracks and the Sanctum was never
saying anything.** Nobody researches woodcutting in order to learn magic.

**So every tome's tier I is open from the first minute**, three pages wide, and
the player chooses which to pour into. That is *players specialise* actually
delivered rather than promised behind a gate everyone opens first — and at three
tomes it is a real choice on the first visit instead of a menu of six.

Two things keep it from flooding a new player: **the quest chain still directs**
them (it is the onboarding's whole job), and **tree fog still hides depth within
a page** (§1.3) — a tier I page shows its first nodes and silhouettes the rest.
And researching ahead does not skip the city's ladder, because **content gates on
Townhall level independently of the tree.**

### 6.3 A tier gate is a JOIN NODE — the threshold, made visible

Requiring **every** node of a tier punishes specialising *within* a branch,
which is the same fault as requiring one root before anything. So a tier opens
on a **threshold** — *most of this band, not all of it.* And because a skipped
node can always be filled later, **it is a choice without a lock**: no exclusive
branch picks, which §12 keeps out of this design.

**What the threshold should NOT be is a global rule the player has to be told.**
It is a node:

> **Every tier ends in a single node that all the band's columns converge into.
> Reaching that node IS the tier.** Completing it opens the band below.

That node carries the tier's name and numeral — *Civics I*, then *Civics II* —
and it is the one place on the page where the three columns become one. **The
gate stops being a percentage in a tooltip and becomes a thing at the bottom of
the screen that the player can see they are walking towards.**

A join node's own requirement is authored as *any N of the columns feeding it*,
so the threshold is **local and per band** rather than one global fraction. Its
value is a dial (**OQ-13**); its shape is not: **a fraction of the feeders,
never all of them.**

### 6.4 The tiers need technologies that do not exist

**Decided: author them.** Not a re-sort, and not an empty shelf.

This is the largest piece of work in the rework and it should be said plainly:
**a container with nothing on the upper shelves teaches the player that the
game is over**, and splitting 24 nodes into two tiers of three makes pages too
thin to be worth a screen. **The alternative to writing content is shipping a
promise.**

It also has to answer §2 honestly. §2 says *the fix is not more nodes* — and
that was right about the **old** tree, where more nodes meant more of one
ungovernable hand-positioned canvas. **The tome structure is precisely what
makes more nodes affordable**, because a page is bounded and a hundredth node
lands on page twelve rather than in the middle of everything. So the two are not
in conflict: **the structure had to come first, and it is what unblocks the
content.**

What each new node must earn, or it is the lie §1.2 already forbids — *a node
that unlocks nothing*:

- **It unlocks content**: a building, a level, a unit, a slot, an upgrade.
- **Its prerequisite is inside its own tome** (§6.2).
- **Its Gold is priced for its tier** (§5.1).

**The three tomes need three different kinds of work, and only one of them is
writing new nodes:**

| Tome | At | What it needs |
|---|---|---|
| **Civics** | 18 nodes | **splitting, not writing.** The content exists; §6.6's derived layering already lays it out in five natural layers, which is three tiers with room. Do this one first — it is the opening game, and it is the only tome that can be authored without inventing anything |
| **Warfare** | 5 nodes | **one more tier.** Unit bonuses are the easiest nodes in the game to author honestly — *this unit type hits harder* is a stat that exists and a sentence a player understands with no explanation |
| **Magic** | 5 nodes with the spells in | **the most invention, and the most upside.** §6.1.1's remit is wide open: every enchanted route to an economic outcome is a legal node, and none of them has been written |

### 6.5 The shape of a page: a vertical spine, three columns wide

The layout is a **downward flow**, and it has exactly four kinds of position:

```
                    ┌──────────┐
                    │  SPINE   │   Civics I — one node, full width, centred
                    └────┬─────┘
              ┌──────────┴──────────┐        ← BRANCH: one rail, out to the columns
         ┌────┴────┐           ┌────┴────┐
         │  col 0  │           │  col 2  │   parallel, independent, ≤ 3 of them
         └────┬────┘           └────┬────┘
         ┌────┴────┐           ┌────┴────┐
         │  col 0  │           │  col 2  │
         └────┬────┘           └────┬────┘
              └──────────┬──────────┘        ← JOIN: the rail back in
                    ┌────┴─────┐
                    │  SPINE   │   Civics II — the tier gate (§6.3)
                    └────┬─────┘
```

| | Rule |
|---|---|
| **Direction** | **top to bottom, and only that.** The page scrolls vertically; there is no horizontal pan and no two-axis canvas |
| **Width** | **at most three parallel columns.** Three is the phone's limit, not a preference — a fourth column either shrinks the node or pushes the page sideways, and sideways is what this layout exists to delete. *(Three columns and three tomes are the same number by coincidence: one is how wide a page is, the other is how many pages there are.)* |
| **Spine node** | one node, centred, the full width of the page. **Every tier boundary is one** (§6.3), and a tome may place others mid-band wherever it wants to say *everything above matters to what follows* |
| **Branch node** | a spine node whose single rail fans out to two or three columns |
| **Join node** | a spine node two or three columns converge into — **the tier gate, and the only cross-column requirement on the page** |
| **Columns** | independent while they run. A prerequisite inside a column is the normal case; **a prerequisite that crosses columns mid-band is not allowed** — that is what a join node is for |

**Tiers are bands on one page, not separate pages.** You scroll from *Civics I*
past its columns to *Civics II* and onward. That is what keeps the tier ladder
legible: **the player can see the next era before they can reach it**, which is
the same pull tree fog already uses (§1.3), delivered by the scroll instead of
by a silhouette.

**Connectors are vertical–horizontal–vertical**: down out of the parent, along a
rail that sits in the gap *between* two rows, then down into each child. Today's
route is horizontal-then-vertical (`src/ui/research/layout.ts`), so this is a
change to one function — and it buys the reference's look for free, because
**every sibling edge leaving one parent shares the same rail row and merges into
a single bar.**

### 6.6 The layout stops being authored, which is what makes §6.4 affordable

§2 names the real bottleneck: *the bottleneck is not rendering, it is that the
layout is authored content.* Today every technology carries a hand-placed
`node: {x, y}` on a free 2D grid, and `tests/research.test.ts` exists to stop
somebody adding a node whose connector runs through another one — **the only
test in the repository protecting a UI decision.**

A vertical page three columns wide deletes that problem rather than testing it:

> **A node authors its `tome`, its `column` (0–2), and its `requires`. Its ROW
> is derived** — the longest path from the tome's first node, which is the
> standard layering of a directed acyclic graph. **`node: {x, y}` goes away.**

**With one correction that the real data forced.** Longest-path layering can
produce a layer **wider than the page**, and Civics does it immediately: its
depth-2 layer holds **six** nodes — Urban Planning, Saws, Hunting, Agriculture,
Cartography, Scaling Tools — against three columns. So the derivation is
layering **plus a greedy pack down each column**:

```
row(node) = max( longest path from the tome's root,
                 first free row in the node's own column )
```

Sheet order breaks the tie, which is already this repo's convention — *row order
is chain order* for quests. **A node may always be drawn lower than its earliest
possible row, never higher**, so the packing can never put a child above its
parent. Still only `column` authored, still deterministic, and it means **the
five natural layers of Civics fall out as bands without anybody placing a
thing.**

What that changes:

- **Adding a technology stops being a layout decision.** One row in a sheet,
  a column index, and a prerequisite. **This is the difference between
  authoring twenty new nodes and authoring twenty new nodes plus twenty
  positions that must not collide** — and §6.4 commits to writing them, so this
  is the half that makes the commitment survivable.
- **The whole class of bug the test protects against mostly evaporates.** A rail
  runs between rows and never through one, so an elbow cannot cross an
  unrelated node. **The one case that survives is a same-column skip** — a
  parent at row 0 linking to a child at row 2 in its own column, passing
  through row 1. `edgeCells` should keep asserting exactly that, and nothing
  else.
- **The layout can be validated instead of eyeballed.** *Is this graph three
  columns wide, does every band end in a join, does any prerequisite cross
  columns?* Those are checks, and they are the same shape as the ones
  `mapRules.ts` already runs for the map — **one module that says what a legal
  page is**, read by the renderer and by the test.

**The upgrade fan is the one thing three columns squeezes.** A tech's upgrade
circles fan horizontally below it (`FAN_DX` 56px against a 120px column), so
**three upgrades on one node overflow its column** — and Forestry, which carries
three global upgrades today, is exactly that node. **Vertical space is the free
axis here**, so the fan hangs in the row gap, centred under its parent, **at
most two across, wrapping to a second rank and growing the gap.** A spell node
with three upgrade dials (§7.1) hits this immediately, so it is not a
hypothetical.

## 7. Spells — what a tome hands the player, besides a building

**The four magic actions used to hang off relics.** They moved here on
2026-09-03, and [`09-relics.md`](09-relics.md) §1.1 owns the argument: a
continuous effect, an instantaneous effect and *whether the object is worn* were
three orthogonal things braided into one item, and the bundle had the ability
held hostage to justify a loadout slot.

> **A relic is what you wear. A spell is what you know.**

### 7.1 A spell is a node, and its upgrades are the circles under it

**This needs no new mechanism, and that is the whole reason it is cheap.** §1.4
already describes the shape: *an upgrade's circle fans in below its parent
square when the parent completes — the visible reward of the research.*

- **A spell node is a technology** whose unlock grants a castable spell. It
  passes §6.4's test unchanged: it unlocks content.
- **A spell's power, radius and duration are upgrade rows under it** — Gold,
  instant, levelled, stacking, exactly like Sawpits or MarketStall. One row per
  dial.
- **A spell is discovered once and never gated again.** No slot, no equip, no
  charges, no cooldown. **Mana is the only thing between a known spell and a
  cast**, which is what Mana is for ([`08-magic.md`](08-magic.md) §1).

The scaling term changes hands with the ability: a spell used to scale with the
**relic's level** (Stardust, on a collection curve) and now scales with **its
own upgrade levels** (Gold, instant). That is a better home for it — the
upgrade ladder is the game's established way to say *this number goes up*, and
§1.4's *two rhythms* argument applies: **the tome is the long deposit, the
upgrade under it is the impulse buy.**

### 7.2 Spells live in Magic

> **Every spell is a node in the Magic tome.**

**This reverses a call taken earlier the same day**, and it is worth recording
why, because the reversal is the shelf changing under the argument rather than
the argument being wrong.

The earlier version spread the spells onto the pages of the things they act on —
Divination beside Cartography, Bloom in the harvest tome — and rejected
concentrating them on the grounds that *it would make one tome magical and five
mundane, so a player who plays with magic would pour into exactly one page.*

**Three tomes kill that objection**, in two independent ways:

1. **Magic is a third of the shelf, not a sixth.** Pouring into one of three
   pages is not a funnel; it is a specialisation, which is what §6.2 says the
   shelf is *for*.
2. **Magic is not a spellbook** (§6.1.1). Its remit is *any effect the fiction
   can carry as enchantment*, so it holds economic nodes too — enchanted
   regrowth, enchanted yield. **A player who pours only into Magic is not
   pouring only into spells**, and the page they end up on is not a side dish.

What is lost is the adjacency, and it was the best thing about the old
arrangement: *research mapmaking, then divination of the map.* **It is
recoverable and should be** — a spell's sheet lists its prerequisites as
tappable medallions (§5.2), so **Divination may still require Cartography.**
That reads across tomes, which §6.2's page rule forbids for *prerequisites*…
and this is the one place it will be tempting to break it.

**It must not be broken.** A spell requiring a Civics node would make Magic
unpourable until Civics was poured, which is the universal-root fault again. The
adjacency comes back the other way instead: **the sheet may name a related
node without requiring it** — *"the maps this reads were drawn by Cartography"*
as a tappable thumbnail, not a gate. Flavour and navigation, no dependency.

| Spell | Was | Why it is a Magic node |
|---|---|---|
| **Divination** — pays a Discovered cell's entire remaining reveal cost | Dowsing Rod | its Mana cost is flat while the Gold reveal cost doubles every ring, so its value **grows with depth** — which is the fog's own argument, and it is what makes the fog a choice between two currencies rather than a chore |
| **Bloom** — clears exhaustion on every resource cell in radius 2 | Verdant Seal | the enchanted answer to exhaustion, against Civics' mundane one |
| **Beckon** — a finite feature respawns on a cell you choose | Wanderer's Compass | it calls something back that is gone; there is no non-magical version of that, which makes it the purest node on the page |
| **Haste** — worker yield ×2 for 60 minutes | Foreman's Sigil | **the departure move.** Divination and Bloom reward being present; Haste rewards *leaving well*, and a visit-based game needs one |

**Magic also holds meta-magic** — attunement slots, `Resonance` (cast cost) and
what raises the Mana cap — so the tome is *spells, what spells cost, and what
magic does to the economy.* That is a page, and it is the tome with the most
room to grow (§6.4).

### 7.3 What it costs in code, and what it deletes

The effect functions are untouched — they are already pure
`(state, map, target, now)` with no closures and no clock, which is why this
moves at all. What changes is the **gate**:

| Today | After |
|---|---|
| `CastBlock` = `NotOwned` \| `NoActive` \| `NotAttuned` \| `NotEnoughMana` \| `InvalidTarget` | `NotDiscovered` \| `NotEnoughMana` \| `InvalidTarget` |
| `castBlock` reads `ownsArtifact` and `isAttuned` | it reads **whether the discovering technology is complete** |
| scaling reads the relic's level | scaling reads `effect(state, <the spell's upgrade>)` |
| `ArtifactDef.active: ArtifactActive \| null` | **deleted** — `ArtifactActive` becomes a spell definition keyed by its technology |

**Three of the five cast blocks disappear**, which is the measure of how much of
the old model was bookkeeping about equipment rather than about magic.

Two stale comments in `ArtifactDef` should go in the same pass, because they
already describe a rule that was removed: a dangling *"Mana per hour drawn while
attuned"*, and `carried`'s docblock still explaining that *"attuning draws Mana
every hour; carrying draws none"*. **Upkeep was deleted entirely** and the code
still argues for it.

### 7.4 A player who never delves can now cast

Today every spell sits behind a **ruin**, because it sits behind a relic and a
relic is a first-clear reward — and a ruin needs a hero and an army. **OQ-41**
names that as the live risk. Spells moving into the tomes puts them behind
**research**, which §3.1 just made flat and ungated.

> **The same argument that ungated the Knowledge drip ungates magic.** A player
> who never sends a party can now discover, cast and upgrade spells; what they
> still cannot get is the **relics**, which are passives and remain the
> province's reward for going underground.

That is a strictly better division than the one that ships: **the delve pays
what you wear, the tree pays what you know.**

## 8. Tomes found in ruins

The original proposal: tomes are *found* in the province's ruins, which gives
the province a permanent reason to exist, gives ruins a second payload, and
gives the tree a narrative origin it completely lacks — *finding a grimoire in a
ruin and having a branch of magic open that you did not have.*

**Amended, because §3.1 and §3.3 took the other half of the ruin's job.** Ruins
now raise the Knowledge **cap**, and the whole reason the drip is ungated is
that the tree must not sit behind a delve. **Gating a tome behind a ruin puts a
branch of the tree back behind exactly that delve** — a smaller version of the
fault §3.1 exists to avoid, and it would land on the same players.

So the rule:

> **No tome on the critical path is gated behind a ruin.** A ruin may open a
> tome that is entirely optional — a seventh shelf nobody needs — and it may
> raise the cap, and that is the whole of its relationship with research.

The narrative beat survives in the optional case, which is where it was always
strongest: **a grimoire in a ruin should open something you did not know
existed**, not something you were going to get anyway.

## 9. Contested landmarks raise the cap, not the rate

Contested world-map landmarks that boost Knowledge are exactly the kind of thing
players will fight over, which is the point. But a **rate** bonus is a
compounding advantage, and compounding advantages held by whoever is already
winning are how a competitive layer becomes a runaway: the guild holding them
researches faster, grows stronger, and holds them harder.

> **A contested landmark raises your Knowledge cap.** You bank more research
> between visits — highly visible, highly valuable, and it does not snowball.

**And §3.2's ceiling binds here too**, which is worth knowing before the world
map is authored: a cap raise above eight hours of drip pays nothing, so
**contested landmarks and cleared ruins are competing for rungs on one bounded
ladder.** Either the ladder's rungs get smaller as it climbs, or the two rewards
have to be different things.

## 10. The prize nobody has claimed yet

In Elvenar and Forge of Empires the trickle currency does not only pay for
research. **Knowledge Points and Forge Points are invested into other players'
Ancient Wonders and Great Buildings, and the top contributors are paid when it
completes.** That is the economy of favours behind FoE's FP market and The Arc —
and it is the single missing pillar the competitive review named first.

So a trickle-and-commit currency buys **research and the best-documented social
mechanic in the quadrant with the same verb**. The same *pour N points* action
points at your own technology or at a guild structure, and a top-contributor
payout does the rest.

**This is also the Wonder hook**, and it is now written down in two places on
purpose: [`16-wonders.md`](16-wonders.md) §12 keeps *donating to another
player's Wonder* out of that design and points at **OQ-59**, and the verb it
would need is the one this section describes. **If the social layer ever wants
it, the pour is already built.**

That makes this a **dependency** of [`15-social.md`](15-social.md) rather than a
neighbour of it, and it is the strongest argument for doing the rework at all.

## 11. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| **The Knowledge rate** | undecided — **OQ-13** | flat, ungated (§3.1) |
| **The Knowledge cap, and each ruin's rung** | undecided — **OQ-13**, bounded by §3.2 | must stay under 8 h of drip |
| **A technology's Knowledge cost, by tier** | undecided — **OQ-13** | the pacing of the whole game past hour three |
| **The tier threshold** | undecided — a fraction, never the whole page (§6.3) | — |
| Technology Gold, **re-priced per tier** | 24 rows today, 6,600 Gold | `Technologies` sheet, and it closes **OQ-42** |
| Gems to finish a fill | undecided | priced on the Knowledge still missing |
| Research slots | 1, max 3, Gem price `10 × 3^n` | `research.*` — unchanged (§5) |
| Upgrade costs and effects | §1.4 | `Upgrades` sheet |
| **A spell's Mana cost** | per spell — unchanged from the relic actives | `Spells` sheet (was `Artifacts`) |
| **A spell's power, radius and duration, per upgrade level** | one row per dial under its node (§7.1) | `Upgrades` sheet |
| **A node's `tome` and `column` (0–2)** | the row is **derived**, not authored (§6.6) | `Technologies` sheet |
| **A join node's threshold** — *any N of the columns feeding it* | undecided — **OQ-13**, and it is per band (§6.3) | `Technologies` sheet |

## 12. Deliberately not in this design

Upgrades consuming a research slot (§1.4) · a global age ladder instead of
per-tome tiers · exclusive branch picks (§6.3) · a tome as the unit you pour
into rather than a page of nodes (§6) · a prerequisite that crosses tomes
(§6.2) · **a spell that requires a node in another tome** (§7.2) · **the same
stat appearing in two tomes** (§6.1.1) · un-pouring committed Knowledge (§5) ·
a permanent multiplier on the Knowledge rate (§3.1) · buying Knowledge with
resources (§3.1) · **a spell gated on anything after its discovery** — a slot, a
charge, a cooldown, an equipped item (§7.1) · **an attempt limit or a
contribution cooldown on pouring** (§5.3) · **a stepper or slider for how much
to pour** (§5.3) · **a floating info card instead of a sheet** (§5.2) · **a
fourth parallel column** (§6.5) · **horizontal panning, or a two-axis canvas of
any kind** (§6.5) · **hand-authored node positions** (§6.6) · **a prerequisite
that crosses columns mid-band** — that is what a join node is for (§6.5) · a
general upgrade-scoping mechanism — the scoped tap and worker yields are small
lookup tables at the call site, because a handful is all the game has.

**Two that were considered properly and rejected, because both will be proposed
again:**

- **The drip pouring itself into open research.** It is strictly nicer in the
  hand — research would progress during an absence with no tapping ritual, and a
  research slot would become the thing that lets you absorb more of your own
  drip, which sells a slot far better than today's argument does. **It was
  rejected because it makes the cap decoration.** A player who keeps anything on
  the desk would never meet the ceiling, so the ceiling would only ever punish
  neglect — **and then raising the cap with a cleared ruin is a reward paid to
  the player who was not playing** (§3.3). It would also make a technology
  complete off-boundary, which costs a new `consider()` line that the manual
  pour does not.
- **Re-pricing the tree's Gold before tiers land.** That was **OQ-42**, and the
  answer arrived with the tiers rather than before them (§5.1).

**Open questions:** **OQ-12** (does the event lump pay Knowledge or Stardust —
now a live fork rather than a naming detail, since the two currencies do
different jobs), **OQ-13** (every number in §10, and it needs the playtest),
**OQ-14** (do upgrades stay Gold-only), **OQ-15** (naming the tomes), and
**OQ-42**, which §5.1 closes.
