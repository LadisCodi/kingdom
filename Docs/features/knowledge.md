# Knowledge: what dungeons are for

**Built 2026-09-02. Rewritten 2026-09-02 by the currency simplification** —
see [`currency-simplification.md`](currency-simplification.md).

Knowledge existed from the first commit and did nothing. It had a currency
row, an icon, a purse line and a drip from ruins — and `11-gaps` recorded the
truth: *"Knowledge has no source or sink."*

The first fix made it buy the technology tree, earned by clearing fog. That
gave it a job, but it gave it **three**: an exploration reward, a tech gate,
and the levelling currency for relics and heroes. No comparable game asks a
research currency to do that — in Elvenar, Forge of Empires and Rise of
Cultures the research currency is a *clock*, accrued per hour and never
earned, existing only to pace the tree.

And the arithmetic said the tree was never really the point. The whole tree
cost 655 Knowledge; one maxed collectible costs ~3,630, and there are ten.
**Knowledge was already ~98% a collection currency**, and the 2% was what
forced it onto the header.

So the tree moved to Gold, and Knowledge kept the job it was always doing.

---

## 1. The rule

> **Knowledge comes out of dungeons, and buys nothing but heroes and relics.**

- **It has exactly two sinks**: a relic's level and a hero's level, both
  through the shared collection substrate (`src/sim/collection.ts`). Fragments
  raise the tier cap; Knowledge buys levels within it.
- **Technologies cost Gold**, out of the city purse, like everything else the
  city does — see
  [`research-and-upgrades.md`](research-and-upgrades.md).
- **Clearing fog pays no currency at all.** A reveal buys *ground*: resource
  cells, buildable land, ruins and landmarks, against a Gold price that
  doubles from ring 4. That is a cleaner statement of what exploring is for
  than a ring-value drip ever was.
- Knowledge stays **kingdom-scoped**. It lives in `state.kingdom.wallet`, not
  the city's, so it survives a region reset — which is what it is for when
  Regions become the content treadmill.

The two-axis split that made the old design work is still there. Only the
second row changed:

| | pays for | earned by | purse |
|---|---|---|---|
| **Gold** | buildings, upgrades, fog, **the tech tree** | the city working | city |
| **Knowledge** | relic and hero levels | **delving and pulling** | kingdom |

## 2. Where it comes from

Four faucets, and every one of them is a dungeon or a banner:

| source | rate | where |
|---|---|---|
| **A first clear** | `delve.first_clear_knowledge` (150), once per ruin | `expeditions.ts` |
| **The cleared-ruin drip** | `knowledge.drip_per_cleared_ruin_per_hour` (2/h) | `mana.ts` |
| **A delve haul** | `delve.knowledge_per_depth_per_tier` (6) × tier × depth | `expeditions.ts` |
| **A gacha pull** | `gacha.pull_knowledge` (50), on **every** pull | `heroes.ts` |

Plus the weekly **Conjunction** lump (60), which is live-ops content rather
than a standing faucet, and the handful of **long-game quests** that pay it —
`ClearRuins`, `ReachDepth`, `OwnArtifacts`, `OwnHeroes` and nothing else.

Two of those deserve their reasons written down.

**The drip is gated on CLEARED ruins, not discovered ones.** It used to pay
2/h the moment a ruin came out of the fog, which meant spotting one paid you
forever for doing nothing with it. Now clearing a dungeon is what turns it
into a permanent faucet. The idle floor a 30-minute-a-day game needs is still
there — five cleared ruins drip ~240/day whether or not a party is out — but
it has to be earned one dungeon at a time.

**Every pull pays Knowledge, hero or not.** Fragments only ever point at one
hero; Knowledge levels whoever the player already has. That is what stops a
pull being dead once the roster fills up, and it is the second half of the
doc's own "no dead pulls" rule.

## 3. Supply against demand

The old arithmetic here compared three one-time totals — tree 655, quest chain
571, whole map 2,902 — and all three are now zero or near it. Knowledge is not
a stockpile you spend down; it is a **runway**.

**Demand.** `round(20 × 1.6^level)` to level 10 is ≈**3,630 per collectible**.
Ten collectibles (five relics, five heroes) is ≈36,000, gated further by the
Fragment-bought tier caps, so nothing is reachable in a hurry.

**Supply.** Five cleared ruins pay **240/day** while the player is away, plus
whatever delving and pulling adds on top. One relic maxes in about fifteen
days at the drip alone: **meaningful progress inside a month, an endgame
horizon well past it** — which is the arc `heroes-and-gacha.md` asks for.

The change that arc pays for is that the runway now **starts with a clear**.
Before, exploring paid it and a player who never fought still progressed. Now
the chain is: army → hero → discovered ruin → first clear → Knowledge → relic
levels. That gives the military buildings a job outside dungeons, which
`00-design-intent.md`'s backlog wants — and it is the thing to watch first in
playtest, because a player who never delves now makes zero progress on the
weeks-long arc. See §6.

Asserted by tests rather than left to playtest
(`tests/expeditions.test.ts`, "Knowledge comes out of dungeons"):

1. **A ruin drips nothing until it has been cleared.**
2. **Every cleared ruin adds its own hour rate**, banked in whole units
   against an anchor, so live ticking and offline replay land on the same
   integer.
3. **Five cleared ruins carry the arc on a scale of weeks** — 240/day against
   a ~3,630 collectible is between one and four weeks, asserted as a range so
   a balance edit that makes it instant or hopeless fails here.

## 4. What the player sees

- **Knowledge is not on the plank.** It buys relic and hero levels and nothing
  else, so it reads in the **Reliquary**, beside the Study buttons that spend
  it — the way Fragments do. A coin on the plank is a coin you spend from
  anywhere; this is not one. That takes the header's worst case from six coins
  to four.
- **The Reliquary carries the purse** (`.rel-purse`, parchment against the
  Mana pool's blue), captioned *"Won from dungeons and the banner"*. It is
  hidden until the player has met the currency: a zero row would advertise a
  system they have not reached.
- **Clearing fog shows no floater.** It used to say `+3 📜`. There is nothing
  to say now — what a reveal pays is the ground itself, which the player can
  see.
- The first Knowledge — from a first clear, a haul, a pull or the Conjunction
  — triggers the standard **"new resource discovered"** banner. Supply and the
  first sink now arrive together, which is what makes that banner land instead
  of announcing a number with nowhere to go.

## 5. Balance surface

| sheet | column | note |
|---|---|---|
| `Settings` | `knowledge.drip_per_cleared_ruin_per_hour` | per **cleared** ruin |
| `Settings` | `delve.first_clear_knowledge` | the lump, once per ruin |
| `Settings` | `delve.knowledge_per_depth_per_tier` | the per-extraction haul |
| `Settings` | `gacha.pull_knowledge` | every pull, hero or not |
| `Quests` | `reward_knowledge` | long-game goal types only |

Retired with this pass: `knowledge.per_reveal_ring` (fog pays none) and
`Technologies.cost_knowledge` (replaced by `cost_gold`).

## 6. Not done

- **The delve gate is the standing risk.** A player who never sends a party
  now makes no progress on the collection at all, where fog used to pay them
  for exploring. That is deliberate — it is what gives the army a job — but it
  is the first thing to look at in playtest. If it bites, the cheapest answer
  is a small Knowledge-priced early sink in the Reliquary, **not** putting the
  tech tree back.
- **A library district and a scholar assignment are off the table.** The old
  doc listed them as candidate sources. Both would put Knowledge back in the
  city economy and contradict the rule in §1; they are dropped rather than
  left as a standing ask.
- **The restored Gold sink is unmeasured.** Pricing the tree in Gold puts
  6,600 Gold of sink back into the city economy, roughly the 6,425 that left
  when it went Knowledge-only. `tests/onboarding.test.ts` proves the first
  fourteen steps still work on nothing but what the game grants; the mid-game
  has not been played.
