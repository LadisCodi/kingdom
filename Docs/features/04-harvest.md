# 4 · Harvest — the cell as a depot, the tap as a duration

> **Scope.** How resources leave the ground: what a cell holds, what a tap is
> worth, how a worker automates it, and what the map's production ceiling is.
> What a tap *costs* is [`08-magic.md`](08-magic.md); where the coins go is
> [`03-economy.md`](03-economy.md).
>
> **Status: built 2026-09-03.** It replaced a model that inflated without a
> ceiling (§2). What the old one was, and what the change deleted, is §11.

## 1. The two rules

> **Nothing produces from nothing.** A cell holds a **stock** of units, and
> everything that extracts — thumb or worker — draws that stock down. A cell
> refills by consuming its own recovery. Nothing else in the city makes matter.

> **One tap is ten seconds of work.** Whatever you tap, the tap advances it by
> `tap.workSeconds` of what that thing does on its own: ten seconds of a
> woodcutter's swing at a tree, ten seconds of a house's rent.

The first rule is what gives the economy a ceiling. The second is what makes
every tap in the game one sentence, and it is the rule this design already
believed in — `03-economy.md` §5 has said *"a tap hands you N seconds of what
the thing you tapped is producing"* since the tap was first priced. What was
wrong was the **denominator**.

> **A tap is priced against the ground and the thumb, never against the payroll.**

### 1.1 What the thumb is worth, and the law that keeps it worth something

A held finger lands a tap every `tap.collectCooldownSeconds`, so:

```
the thumb, in workers = tap.workSeconds ÷ collect cooldown = 10 ÷ 0.5 = 20
```

> **The thumb's worker-equivalent has to stay ahead of the crew, or the hand
> stops beating the machine.**

That single relation replaces the suspended `cap ≈ 8 × regen` law in
[`08-magic.md`](08-magic.md) as the thing to hold while tuning, because it is
also what decides what a rewarded ad is worth (§4.3).

**And at `tap.workSeconds` = 10 it does not hold at the bottom of the ladder.**
Twenty workers against the thirty a Townhall-3 city can house: a bare thumb is
**two thirds of the crew it already owns**, so late-game hand-play only pays
once the player has bought into it — `QuickHands` takes the thumb to forty and
`TapPower` at the top of its ladder to sixty (a hundred and twenty with both).
The number was set on **tactile** grounds — ten taps to a tree rather than five
— and this is what that costs. It is priced honestly rather than argued away:
if hand-play in a mature city feels pointless, this is the dial, and doubling it
doubles the ad with it (§4.3).

## 2. What this replaces, and the number that forced it

The shipped model counts depletion in **taps**, not units, and prices a tap
against `cityGatherPerSecond` — what *all* of your buildings produce of that
resource. Both halves inflate, and they multiply:

| One tap on one tree pays | Shipped model |
|---|---|
| First hour, no workers | **1** Wood |
| One Sawmill L1, 3 workers | **11** |
| Three Sawmills L3, no worker upgrades | **59** |
| Three Sawmills L3, worker upgrades maxed | **413** |

And because the cell counts *taps* rather than units, the same tree holds ten
taps at every stage:

> **The same tree is worth 10 Wood in the first hour and 4,130 at the end**, and
> a full Mana pool at 332 is worth **137,000 Wood** — several hundred times
> everything standing on the map. **No number anywhere says what this province
> can produce per hour**, which is why nothing can be balanced against it.

A second, quieter failure falls out of the same code: `TapPower` only raises the
**floor**, and `cityGather × boostSeconds` beats that floor from the first
staffed Sawmill. **`TapPower` is a dead upgrade about forty minutes into a new
game.**

## 3. The cell is a depot

Every resource cell carries:

| | What it is |
|---|---|
| **`stock`** | units it holds when full — the **burst** |
| **`recoverySeconds`** | time from empty back to full — the **availability** |
| **`unitsPerStrike`** | units one extraction takes — the **chunk** |
| **`secondsPerStrike`** | seconds one extraction takes — the **rhythm** |

Extraction draws units down. At zero the cell is **exhausted**: it cannot be
tapped or worked, it shows its exhausted art and a recovery bar, and it comes
back **full** after `recoverySeconds`. Recovery is timestamp-based, so it works
offline for free and costs exactly one boundary.

**Binary recovery was chosen deliberately over continuous regrowth.** Continuous
regrowth is cheaper to reason about and gives a smoother curve, and it was
rejected anyway, for three reasons that are all about what the player can see:

- **Exhaustion is the most legible state in the game.** A stump says *this is
  spent* with no UI at all. A cell hovering at 18% says nothing.
- **It is what makes workers move.** A worker that drains a cell and walks to the
  next one gives the map life; a worker parked forever on a cell that never
  empties is a number with a hat on.
- **It is what makes the growth upgrade visible.** Buying faster recovery *looks
  like* stumps becoming trees again and fields coming back sooner. A rate
  changing by 30% looks like nothing.

The cost of that choice is recorded in §5: it rules out a reserve floor, and
therefore the thumb has no claim on worked ground.

### 3.1 The authoring law

A cell drains over `stock ÷ unitsPerStrike` **round trips** and is then dead for
`recoverySeconds`. That ratio is not a detail — it **is** how many workers a
cell can keep busy:

```
workers a cell supports = drain ÷ (drain + recovery)
```

It can never reach 1, which gives the law the whole economy hangs off:

> **Under binary recovery you need roughly two cells per worker.**
>
> Author `secondsPerStrike ÷ unitsPerStrike ≈ 1.1 × (recoverySeconds ÷ stock)`
> and a cell supports about **0.55** workers, rising with the walk — 0.59 for a
> Forest cell next door, because a longer trip drains it more slowly.

The law authors the **cell**; the trip belongs to wherever the player put the
shed. That split is why the table below can be a property of the ground and the
rate column still varies with distance.

**As authored.** The rhythms come from the law; `tap.workSeconds` = 10 comes
from wanting **about ten taps to a tree** (§4).

The worker column is a **round trip**, so it is quoted at both ends of a
level-3 radius — that spread is the influence radius earning its keep.

| Cell | `unitsPerStrike` | `secondsPerStrike` | `stock` | `recoverySeconds` | a tap pays | taps to empty | worker, next door → radius 4 | workers/cell |
|---|---|---|---|---|---|---|---|---|
| **Forest** | 1 | 10 | 10 | 90 | **1** | **10** | 4.7 → 3.3/min | 0.59 |
| **Crops** | 1 | 8 | 10 | 60 | 1 (+¼ carried) | 8 | 5.6 → 3.8/min | 0.64 |
| **Berries** | 1 | 10 | 10 | finite | 1 | 10 | 4.7 → 3.3/min | — |
| **Meat** | 3 | 20 | 30 | finite | 1 (+½ carried) | 20 | 7.9 → 6.4/min | — |
| **Stone** | 1 | 26 | 5 | 120 | 1 *(floor)* | 5 | 2.1 → 1.8/min | 0.55 |
| **Fish** | 2 | 20 | 10 | finite | 1 | 10 | 5.3 → 4.3/min | — |
| **MountainIron** | 5 | 60 | 25 | 300 | 1 *(floor)* | 25 | 4.8 → 4.4/min | 0.51 |
| **MountainGold** | 3 | 60 | 15 | 300 | 1 *(floor)* | 15 | 2.9 → 2.6/min | 0.51 |

Note how the spread narrows as the ground slows: a tree next door is worth 1.4×
one at radius 4, an iron peak only 1.1×, because a sixty-second swing swallows
the walk. **Fast ground rewards placing the shed close; slow ground does not
care** — which is a placement lesson nobody had to author.

The renewables hold the law to within a hundredth. Two things about this column
of ones are worth saying out loud:

- **On slow ground the FLOOR governs, not the convention.** Ten seconds of work
  on a rock, an iron peak or a gold peak is 0.38, 0.83 and 0.50 units, so all
  three pay the floor's 1 — which means the tap stops distinguishing between
  them and richness shows up only in how *long* the grind is (5 taps, 25, 15).
  It is coherent and it is a thin reading of three different mountains; the
  first `TapPower` levels are what pull them apart again.
- **A metal peak is a long grind by hand and worth a building.** Its richness is
  real, and it is in the **depot** and the **crew**: 25 units in one cell
  against a rock's 5, and five units a swing against one.

**The chunk and the rhythm are character, not just rate.** Iron as three units
every 72 seconds is a heavy swing; crops as one every five is a light tick. Two
cells can pay the same per minute and feel nothing alike, and that is a texture
the single global work time could not express.

**FarmLands still shares the `Crops` row**, so a built plot behaves exactly like
wild crops. Giving it its own rhythm — fast and thirsty where the wild kind is
slow and patient — needs a new harvest source id, which is code rather than
data. Small, and worth doing; not done.

### 3.2 The ground under the cell

> **Terrain multiplies what a cell HOLDS, per currency.** A grassland tree is
> worth thirteen Wood, a snowy one eight, a desert one five.

| Terrain | Food | Wood | Stone | What it is |
|---|---|---|---|---|
| **Grassland** | ×1.25 | ×1.25 | ×1 | the good ground: farm and forest here |
| **Plains** | ×1 | ×1 | ×1 | the baseline everything else is read against |
| **Snow** | ×0.75 | ×0.75 | ×1 | poor, and poor at nothing in particular |
| **Desert** | ×0.5 | ×0.5 | **×1.5** | starves you and pays in rock |
| **Tundra** | ×0.75 | **×1.5** | **×1.5** | as poor as Snow at food, and **the best timber AND stone in the world** |
| Water | ×1 | ×1 | ×1 | left alone — see below |

**Every terrain except Snow now has a reason to be walked to**, and that is the
test a biome has to pass: Grassland grows things, Desert pays in rock, Tundra is
the frontier you go to for timber and stone at the price of not eating there.
Snow is the one that is only a penalty, which is fine — a map needs somewhere
that is simply hard.

**It lives on the terrain rather than on the building**, because it is a fact
about the ground and it has to reach several different things: a Forest, a
FarmLands and a rock on the same sand all want it, and none of them is a Farm.

**And it scales the STOCK rather than a single extraction, which was forced
rather than chosen.** `unitsPerStrike` is 1 on most cells and `1 × 0.75` rounds
straight back to 1 — a percentage on a chunk of one is a no-op. Stock runs 5 to
30, which has room for a quarter either way in whole units. Two consequences
worth knowing:

- **The thumb and the crew are both affected, with no second set of books**,
  because they draw the same depot (§1).
- **Poor ground is bad twice.** Total per cycle scales exactly with the
  multiplier, but the *sustainable rate* falls further, because recovery is a
  fixed cost the poorer cell still pays: a desert forest drains in 50 s and
  then sits out 90, so it yields 2.1 Wood/min against a grassland tree's 3.5 —
  61%, not 50%. And its workers-per-cell drops from 0.59 to 0.36, so **a desert
  needs about three cells per worker where a grassland needs under two.** A
  desert should feel like that.

**Water is authored at ×1 on purpose.** Fish shoals sit on it and pay Food, and
a wet-field multiplier silently retuning the whole fishing line is not what
anybody asked for.

**But a multiplier only exists where the map puts something to harvest**, and
today it mostly does not. Counted on the province as painted: Grassland holds 44
of the 57 trees, so its timber bonus is fully live — while **Desert's stone
bonus reaches exactly one mountain in 81 cells, and Tundra holds no trees at
all**, so the best timber in the world is currently unreachable. The dials are
authored; the map has not caught up (OQ-56).

### 3.3 The map now has a ceiling

`stock ÷ (drain + recovery)` is a cell's sustainable rate, so the province has
one too. At **57 Trees** on the map as authored today, with sheds next door:

- **157 Wood/min** is everything this province can grow, ever, at these dials.
- It takes **33 workers** to collect all of it — against the 30 a Townhall-3
  city can house, so the map as painted is authored almost exactly for the
  biggest crew the city can hire, with a little room left. Not by design; it is
  worth knowing before either number moves.
- Both figures move with the walk: sheds further from their trees collect less
  of the same ceiling, and need more bodies to do it.

That number is the thing three balance passes have been missing. It is also a
census the map editor can compute, and it should
([`../map-editor.md`](../map-editor.md), OQ-50) — and it now has to weigh
each cell by its ground, because the same tree is worth 13 or 5 depending on
what it stands on.

## 4. The tap

```
seconds = tap.workSeconds × (1 + TapPower)
owed    = seconds × unitsPerStrike ÷ secondsPerStrike
paid    = max(1, floor(owed + carry))     — capped by what the cell still holds
carry   = max(0, owed + carry − paid)
```

- **`tap.workSeconds` = 10**, and it is global, because it is a property of the
  thumb rather than of the ground. **It is a tactile number, set by hand**: it
  is what makes a ten-unit tree about ten taps, which is a length of gesture
  worth holding a finger down for. It was briefly 20 (five taps a tree) and came
  back down on play. What that costs is priced in §1.1 and §4.3.
- **`TapPower` buys duration, not units**: **+20% per level, ten levels, ×3 at
  the top** — a tap worth thirty seconds of work. It is a *relative* ladder, so
  it never goes stale (README working rule 2), and priced in Gold it is the
  permanent sink the economy loses when the technology tree runs out.
- **The carry exists so percentages are honest.** A +20% upgrade on a cell that
  pays one unit is destroyed by rounding; carrying the remainder per currency
  means the fifth tap pays two. Four numbers, additive to the save.
- **The floor of one unit is what keeps the thumb worth using on slow ground.**
  Ten seconds of work on a bare rock is 0.38 units, and a tap that pays nothing
  is a bug the player experiences as one. The floor is generous on slow ground
  on purpose: stone and metal are where hand-play matters most, because that is
  where a worker is slowest. **At this duration the floor covers four of the
  eight cells** (§3.1), which is more than a floor should have to do.
- **The shortfall when the depot runs dry is NOT carried.** A maxed thumb wants
  3 Wood and a tree holds 10, so the last tap of a tree pays what is left and
  the rest is waste. That waste is the signal: *your thumb has outgrown your
  ground, go buy abundance.* It is what moves the bottleneck, and it is why
  raising `TapPower` past the ground's richness buys less and less.

**Where the iron vein's richness went.** The design has said *"an iron vein is a
rich Stone node at 3 a tap"* since the resource expansion. Under the convention a
tap on a vein pays 1, not 3 — because a vein is slow ground. **Its richness moved
from the tap to the depot**: 15 units in one cell against a rock's 5, and a
heavy three-unit swing. It is still the rich node; it is rich in the way this
model can express without inventing matter.

### 4.1 The house tap, and the one place the game mints

Tapping a house moves the tax anchor back by `workSeconds × that house's share
of city income` — exactly `workSeconds` of that house's own rent. It has always
followed the convention; **the number changed, 45 → 20**, and `TapPower` now
lifts it too. One dial, one meaning, two call sites.

But it does **mint**, and it has to: taxes already accrue on their own, so an
"advance" against a continuous accrual would be a no-op — a house tap either
makes new Gold or does nothing at all. **A house tap is therefore the single
deliberate exception to §1's first rule, and the Mana pool is its only bound.**

### 4.1.1 The advance budget, built and removed

A depot for houses was designed, built and then **cut on playtest the same day**.
The design was consistent — a house holds the rent of the next 120 s and no
more, tapping sells 20 s of it, six taps of arrival burst and then one every
twenty seconds as the clock catches up — and it bought a clean ceiling: *a house
can never pay more than twice its own rent.* It is recorded here because the
argument for it is still true and somebody will reach for it again.

**Why it went:** it read as an arbitrary refusal on the building the player taps
most. A stump is a picture and a spent house is not, so the same rule that feels
like the world pushing back on a tree feels like the game saying no. The bound
was legible on paper and illegible in the hand, and the hand is the test.

**What it leaves live, and this is the cost of the decision.** There are far
fewer houses than workers — six against thirty — and a house has no depot, so
Mana spent on rent is worth several times Mana spent on trees: a full pool
sweeping the neighbourhood is worth roughly **9 minutes** of the city's tax
income against **1.8** for the same pool spent on wood. The optimal play is
therefore *stop tapping trees*, which makes the harvest tap — the signature
verb — an early-game and frontier move rather than a standing one.

That may be fine: Gold is the real bottleneck (fog, research, upgrades) and
materials are abundant, so "Mana buys Gold" is a sensible optimum and the thumb
still owns the uncovered ground (§6). But it is a live risk rather than a
resolved one, and it is **OQ-55**. The cheapest lever if it bites is not the
budget coming back — it is making a harvest tap worth more, which is
`tap.workSeconds` and the ground's abundance.

### 4.2 The taps that are removed

**Tapping a training queue is deleted** — villagers at the Townhall and soldiers
at the halls alike. A queue is a fixed duration and a tap is now a scaling one,
so a maxed thumb would finish a 20-second villager in one press. A timer is
hurried with Gems, not with Mana.

The consequence is that **the Townhall stops answering a tap**, and with it the
onboarding beat *"tap the Townhall to hurry your first villager"*. Twenty seconds
unaided is fine; the quest copy needs a pass.

**Paying fog stays outside the convention**, explicitly: it costs Gold rather
than Mana and it buys cells rather than production. `Surveying` is unaffected.

### 4.3 What a full pool is worth, and why it is finally flat

A rewarded ad pays a whole pool, so this table is what an ad is worth:

| City | pool | tap | ad pays | = production |
|---|---|---|---|---|
| 1 Sawmill L1, 3 workers, `TapPower` 0 | 100 | 1 Wood | 100 Wood | **5.6 min** |
| 30 workers, `TapPower` 0 | 332 | 1 Wood | 332 Wood | 1.8 min |
| 30 workers, `TapPower` 10 | 332 | 3 Wood | ~1,000 Wood | **5.5 min** |

**About five and a half minutes at both ends of the game** — where the old model
spanned 73 minutes to over three hours and kept climbing. The rule
[`03-economy.md`](03-economy.md) §5 was reaching for is satisfied here **by
construction** rather than by a scaling hack, and without the tap ever reading
the payroll.

Read the middle row before celebrating: **`TapPower` is what holds the ad's
value up as the crew grows.** Pool ×3.3 against crew ×10 leaves the ad worth a
third as much by Townhall 3; the ×3 duration ladder puts it back. That is a good
shape rather than a tax — the ad is worth more to a player who has invested Gold
in their own thumb — but it is a *relation*, and §1.1 is the law that states it.

Three consequences worth saying plainly:

- **An ad buys about three minutes of things to do**, not a windfall: a full
  pool is 332 taps and a held finger spends it in under three minutes.
- **`tap.workSeconds` is the ad's dial, and halving it halved the ad.** It went
  20 → 10 on play, for the feel of the gesture (§4), and a pool went from ~11
  minutes of production to ~5.5. Whether ~5.5 minutes for three minutes of thumb
  is an offer worth building six ad placements around is **OQ-51**, and it is a
  sharper question at this duration than at the last one.
- **You cannot also have "a watcher gathers 50% more."** Twenty hours a day of
  crew production dwarfs anything a thumb does in a visit, so at five ads a day
  the gap is about **2–3%**, not 50%. Reaching 50% needs a pool worth two and a
  half hours — which is exactly the broken model. The ad's job is the **visit**,
  not the day, and that also protects the player who never watches one, which
  promise 3 wants. OQ-43 said 50% and was computed on the inflated tap; it is
  corrected there.

## 5. The strike, and the haul

A worker walks out to its claimed cell, **strikes** it once, and walks the load
home. Then it goes out again. The loop is `Idle → MovingToCell → Working →
MovingHome`, and the whole of it is worth watching because of where the units
are at each moment:

> **Units leave the DEPOT when the swing lands. They reach the WALLET when the
> worker gets home.**

That one detail is what makes the round trip better than either thing it
replaced. The shipped model credited the wallet on delivery but debited the cell
by a **tap count**, so the player and the worker could take the same wood twice
and the counter never matched the matter. A middle version had workers strike in
place and credit instantly, which fixed the double-dip and cost the map its
life: with no journey, a cell at distance 4 was worth exactly as much as one
next door and the influence radius stopped being a decision.

Debiting at the strike and crediting at the shed keeps both. **A load in transit
is real matter** — already out of the ground, not yet yours — and everything
else follows from taking that literally:

- **Nobody double-dips.** Tap the tree your own woodcutter just swung at and you
  get what is left, because their load is already gone from it. The cell can
  show a stump while it is still being carried.
- **Moving a building has something to protect again.** A carrying worker keeps
  its load and walks to the new address (§6, and
  [`05-city-and-districts.md`](05-city-and-districts.md) §4). Confiscating it
  would destroy matter *and* charge the player for a trip already worked for.
- **Unassigning a loaded worker loses the load**, deliberately and visibly.
  Those units left the ground; somebody has to eat them.
- **The walk is the distance cost**, and it is legible: 4.7 Wood a minute from a
  tree next door against 3.3 from one at radius 4. A per-distance penalty on
  the strike *rate* was designed and rejected for exactly this reason — the
  player cannot see why a worker standing still is slower than another worker
  standing still, but they can see one walking further.

- **The strike is the player's tap, performed by somebody else.** Same hit on
  the same cell with the same foley, at **half volume** and **without the white
  flash** — the flash is what says *that was me*, and thirty woodcutters would
  drown it. The punch is scaled to **0.55** of the player's, enough to read as
  the same gesture and not enough to compete with it.
- **The hit and the number are in different places, on purpose.** A strike
  punches the **cell**; the haul's floater pops at the **building**, when the
  wallet actually moves. The gap between them is the walk.
- **The strike IS a simulation boundary**, and the feedback is a consequence of
  it. It has to be: the strike moves the wallet and the depot, so a second,
  derived clock for the visual could only drift from the one that pays. What the
  renderer receives is the strike event the sim already emitted — the struck
  **cell** and the **ground** it was struck on, so the hit lands on the tree
  rather than on the shed and the foley matches the rock.
  **The rule that matters is the other direction: nothing about the feedback may
  feed back into the sim.** Dropping a sound or skipping a punch can never
  change what was extracted, which is exactly what makes it safe to gate the
  feedback on the camera — and offline replay produces the same strikes with no
  feedback at all.
- **Audio is limited, or it is a machine gun.** Thirty workers at one strike
  every ten seconds is three a second before a single upgrade. So: **on-screen
  cells only** (a hit you cannot see makes no sound), **silent below zoom 0.8**
  (at that scale you are reading a city, not a tree), **at most three voices**
  in flight with the rest dropped in silence, and **±5% extra pitch jitter** on
  top of the sound's own so two strikes landing together do not phase-lock into
  a drone.
- **A strike is not a tap for quests.** Both paths bank a `collect`; only the
  thumb banks a `tap`. The visual similarity is going to invite someone to
  unify them, which would auto-complete every `CollectTaps` goal with the city
  standing idle — so it carries a comment at both call sites and a test in
  `quests.test.ts`. The reverse gap, a goal that asks to *automate*, is OQ-53.

**What the tap reads, and what it does not.** A cell's rate is its chunk over
its rhythm, `unitsPerStrike ÷ secondsPerStrike`, with **no travel in it** —
because travel is a property of where you put the shed, not of the ground, and
a thumb does not walk. That is what a tap is priced against (§4).

`cityGatherPerSecond` is the opposite case and keeps its travel term, including
the old fudge of taking the influence radius as the distance: a NOMINAL rate,
not a measured one. **The tap stopped reading it** — that was the whole 413-Wood
fault.

**It now has no caller in `src/` at all.** Order sizing was the last one, and
orders were cut ([`12-quests.md`](12-quests.md) §6). It is kept rather than
deleted because *"a duration of the city's own production"* is working rule 2
and something will ask for it again — but **it is dead code today, and a dead
export with a nominal travel fudge in it is exactly the kind of thing that gets
wired back into a tap by someone who does not know why it exists.** The comment
above it says so; the alternative is deleting it and re-deriving it later.

## 6. Areas of influence, claims and migration

A worker building works cells **of its type** within Chebyshev `radius(level)` of
itself. Revealed cells only. **One worker per cell, globally** — a claim system
keeps two crews off the same tree, and `tryDispatch` takes the nearest unclaimed
cell, which is what spreads a crew out without any smarter assignment.

A worker whose cell exhausts releases the claim and walks to another, so the
radius decides **two** things at once and both are visible:

- **The gradient**, through the round trip (§5): a tree next door pays 1.4× one
  at radius 4, and you can watch the difference as a longer walk.
- **Coverage** — how many cells of the right type the building can reach at all,
  which under the two-cells-per-worker law (§3.1) is what decides how many of
  its plazas are ever busy rather than loitering (§7).

Coverage is countable and the gradient is watchable, which is the standard a
placement decision has to meet.

**No reserve floor.** Making workers stop at 20% of stock would guarantee the
thumb something to draw on worked ground, and it was cut because it is
incompatible with §3: a cell workers never empty never exhausts, so nothing
migrates and nothing looks spent. The consequence, stated plainly:

> **Your thumb works the frontier; your crews work the covered ground.**

With a crew matched to the map, essentially every live cell inside a radius is
claimed at any moment, so newly revealed ground is where hand-play lives — which
hands the paid fog one more job. A claim blocks other *workers*, not taps, so the
player can still raid a tree their own woodcutter is felling, exhaust it early
and send them walking. That is honest — both draw on the same ground — and it is
a real decision when you need twenty Wood now. Whether it feels bad is OQ-52.

## 7. Idle workers are the signal

Workers with no cell to claim are the most actionable fact in the game: it says
*you over-hired* or *you need more ground*. Today they wait invisibly inside the
building.

- **They wait outside**, milling in the cells around their building, with an
  idle animation, no strikes and no destination.
- **The silhouettes are already distinct**, which is what makes this free: with
  the return trip gone, a worker moving with purpose can only be migrating, and
  a knot of workers loitering by a door can only be idle. No icon needed.
- **The count lives in the district card only** — `4/7` busy. Nothing on the map:
  the characters *are* the map's readout.
- **The good beat**: when a stump becomes a tree, one of the loiterers heads for
  it. That is the reward for buying recovery, and it is already in the model.
- A player who never over-hires never sees any of this, so it wants one
  onboarding beat that makes them hire past their ground on purpose, around the
  time the Tome of Earth opens.

## 8. The three actors, one dial each

| Actor | Dial | Raises | Symptom it answers |
|---|---|---|---|
| **The ground** | abundance (`stock`), recovery, richness (`unitsPerStrike`) | what the map can give | "everything is a stump" · "they never stop walking" |
| **The thumb** | `TapPower` | seconds per tap | "I want it now" |
| **The payroll** | `WorkerLoad`, plazas per level, **where the shed sits** | units a trip, and how long the trip is | "I am collecting too slowly" |

**The seven cell-scoped upgrades become abundance of the ground** — Sawpits,
Irrigation, Stonecutting, Big Nets, Iron Picks, Butchery, Scythes — and therefore
lift **the tap and the worker alike**, because both draw from the same depot.
That is the change that unifies the two feelings: nobody creates matter, and
everyone pulls from the same place at a different speed. `WorkerLoad` stays the
one payroll-only dial, and it is the pressure generator: more units per strike
empties cells faster and is what pushes a well-fed city past its ground.

**Abundance and recovery are numerically interchangeable and visually opposite.**
Doubling `stock` and halving `recoverySeconds` both pay the same +29% rate — but
more stock means longer stays and less walking, and faster recovery means a
greener map and more migration. Neither dominates; the player picks by which
symptom they can see, which is exactly the pair of levers a tome branch wants.

## 9. Offline

Worker strikes, cell recoveries and Townhall cycles are replayed
deterministically, **capped at 8 hours** per absence. No player taps happen
offline.

The cap is a production cap, never a timer cap: **the offline cap limits what the
city produces while you are away, and never what a timer does.** Recovery stamps
and build queues resolve in the uncapped tail. Nothing in this redesign changes
which side of that line anything sits on.

## 10. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Seconds a tap is worth | **10** | `tap.work_seconds` |
| `TapPower` | **+20%/level, 10 levels** (→ ×3) | `Upgrades` |
| Chunk and rhythm, per cell | §3.1 | `Harvest.units_per_strike`, `.seconds_per_strike` |
| Stock, per cell | §3.1 | `Harvest.stock` |
| Ground multiplier, per terrain × currency | §3.2 | `Terrain` sheet |
| Recovery, per cell | §3.1 | `Harvest.recovery_seconds` |
| Respawn, finite features | 120 s | `Harvest.respawn_seconds` |
| Worker move speed | 1 tile/s | `worker.move_speed_tiles_per_second` |
| Influence radius, plazas per level | §6 | `Districts` |
| Mana per tap | 1 | `tap.mana_cost` |
| Auto-tap cooldown (and so the thumb's worth, §1.1) | 0.5 s | `tap.collect_cooldown_seconds` |
| Strike punch, against the player's 1 | 0.55 | `STRIKE_PUNCH`, code |
| Strike volume · extra jitter · voices | ×0.5 · ±5% · 3 | `strikeFeedback`, code |
| Zoom below which a strike is silent | 0.8 | `STRIKE_AUDIBLE_ZOOM`, code |
| Offline cap | 8 h | `offline_cap_hours` |

**Two relations to hold while tuning**, and nothing else in this document
matters as much:

1. `seconds_per_strike ÷ units_per_strike ≈ 1.1 × (recovery_seconds ÷ stock)`,
   or the workers-per-cell number drifts and the crew-versus-map balance drifts
   with it (§3.1).
2. `tap.work_seconds ÷ collect_cooldown` stays ahead of the crew the city can
   house, or the hand stops beating the machine and the ad stops being worth
   anything (§1.1, §4.3).

## 11. What this deletes, and what is deliberately not in it

**Deleted:** the tap counter (`taps_to_exhaust`), `yield_per_tap` — already
identical to `yield_per_worker` in all seven rows, so the law was already
believed as a coincidence — the global `worker.work_seconds`, and the tap's
reading of city-wide production.

**Built, deleted and restored the same day:** the worker's round trip. A version
that had crews strike in place and credit instantly is recorded here because its
argument was good and it still lost: it fixed the double-dip, and it cost the
map its life, since with no journey a cell at radius 4 was worth exactly what
one next door was and the influence radius stopped deciding anything. What kept
the fix without the cost was debiting the depot at the **strike** and crediting
the wallet at the **shed** (§5), which nobody had tried.

**Kept:** `cityGatherPerSecond`, travel term and nominal-distance fudge and all
— though with orders cut it now has **no caller at all** (§5).

**Deliberately not in this design:** pathfinding · continuous regrowth (§3) · a
per-distance strike penalty (§6) · a worker reserve floor (§6) · **a per-house
advance budget (§4.1.1 — built and cut on playtest)** · building storage, vaults
or generators of any kind · offline tapping · fractional wallets · per-cell
yield variety beyond the authored table · permanent destruction of a renewable
feature.

**Open questions:** OQ-44 (exhaustion as the ceiling on the Mana pool),
OQ-51 (re-deriving the ad and the Gem refill against the new numbers), OQ-52
(the thumb raiding its own crews' cells), OQ-53 (a `WorkerCollect` goal type, so
a quest can ask to automate rather than to tap), OQ-54 (map density — whether a
full pool has anywhere to be spent).
