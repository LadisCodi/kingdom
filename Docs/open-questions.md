# Open questions — what design still has to decide

> **What this is.** Every decision not yet taken, every soft spot in the design,
> and every feature still missing a design — in one place, with a stable id so a
> feature doc can point at it (`OQ-n`).
>
> **How to close one.** Edit the feature doc that owns it, then strike the row
> here with the date and the answer in one line. **A decision is closed by
> editing the design, not by writing the answer down here.**
>
> **What is NOT here:** work that is designed and merely unbuilt — that is
> [`implementation-plan.md`](implementation-plan.md). This file is only for
> things where *nobody knows the answer yet.*

## How to read the columns

| | |
|---|---|
| **Blocks** | what cannot be built, or cannot be trusted, until this is answered |
| **Owner doc** | where the answer gets written |
| **Rec.** | the recommendation on record, where one exists. A recommendation is not a decision. |

---

## A · Structure and scope — these decide the shape of the game

The most expensive group, because the save is the one artefact that cannot be
changed retroactively.

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-1** | **Is the province plot bounded?** A balance number, not a refactor — and the thing that makes placement a decision and adjacency matter at all. Cheap enough to land early, and it is a 30-day-retention question. | placement depth, adjacency v2, expansions as a reward | [`02-map-scopes.md`](features/02-map-scopes.md) §7 | **yes** |
| **OQ-2** | **Does the world map ever allow raiding a player's city?** This is the fork that decides the *audience*, not the feature list. **If the answer becomes yes, promise 1 has to be reopened deliberately and said out loud in the pitch** — not discovered by a playtester losing their granary. | the whole shape of the game | [`02-map-scopes.md`](features/02-map-scopes.md) §5 | **no** |
| **OQ-3** | **Shard size and season length.** Decides whether the world feels populated or empty, and whether a new player lands beside a maxed one. | the world map | [`02-map-scopes.md`](features/02-map-scopes.md) §9 | — |
| **OQ-4** | **Is a temporary province generated or authored per drop?** Authored is cheaper to make *good* and needs no generator; generated is the only version that scales past a designer's throughput. | the event pipeline's marginal cost | [`13-events.md`](features/13-events.md) §2.3 | — |
| **OQ-5** | **Does a claimed world node open as a temporary province for a one-off clear?** It would merge conquest and events into one system serving three purposes. Elegant, and possibly more than a prototype needs. | — | [`02-map-scopes.md`](features/02-map-scopes.md) §9 | — |
| **OQ-6** | **How many systems can this game carry?** Ten progression systems are on record as a standing accepted risk; the current plan adds four more. **The defence is that the four are shells around existing ones** — orders are quests, the chest is Mana, the event track is the timeline, the guild weekly is a delve scoring pass. **If any of them turns out to need its own economy, its own currency and its own screen, it has stopped being a shell and should be cut instead of shipped.** | every feature | [`10-heroes.md`](features/10-heroes.md) §1 | the shell test |

> **OQ-6 is the one that should make everyone uncomfortable, so it gets said
> directly: this plan makes the game bigger, and the game was already flagged as
> too big.** The currency half of that risk was cut — eleven wallet rows to
> eight, and one job per currency. The systems half never was.

## B · The collection — ingredients, Stardust, trading

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-7** | **Are 3★ ingredients world-map-only?** It ties the game's only week-scale arc to the most expensive layer in the plan. **The cost, stated deliberately: a player who refuses the social layer caps out at level 3 of 5.** That is what Forge of Empires and Elvenar do, and it is acceptable because the siege is co-op — but it is a decision, not a detail. | the relic arc's ceiling | [`09-relics.md`](features/09-relics.md) §4.1 | **yes, but only once the world map exists** — until then 3★ drop from the co-op siege, which is the world map's first node |
| **OQ-8** | **Shared ingredient pool, or unique per relic?** Nine unique × 10 relics is 90 pieces of art, and unique-per-relic *makes trading worse* because nothing overlaps. | the art bill, and whether trading works | [`09-relics.md`](features/09-relics.md) §4.2 | **hybrid** — 1★/2★ from a shared pool of ~20, 3★ unique and named per relic |
| **OQ-9** | **What is Stardust for once ingredients are the tier gate?** With ingredients as the real gate, the level cost becomes a formality you can always afford. Two honest exits: Stardust **pays to attune and reconfigure** (a recurring job instead of a terminal one, which also gives the swap lock an economic partner), or accept it as secondary and **cut its curve**. **What should not happen is two gates where one never closes.** | the rename, and the whole collection economy | [`09-relics.md`](features/09-relics.md) §9 | — |
| **OQ-10** | **Trading rules, and whether trading exists in the prototype at all.** It is the most socially interesting mechanic here and the one most likely to be abused by the very playtesters we need honest data from. **It must be born with a cap, a window, and 3★ either untradeable or one per event**, or 3★ scarcity evaporates in a week and with it the reason to visit the world map. | the social layer's economy | [`09-relics.md`](features/09-relics.md) §6 | born with all three limits |
| **OQ-11** | **Do ingredients drop for relics you do not own yet?** | the album screen | [`09-relics.md`](features/09-relics.md) §7 | **they must** — otherwise an unowned relic can never start, and progress on a silhouette is the screen's strongest pull |

## C · Research and tomes

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-12** | **Does the weekly event's 60 lump pay Knowledge or Stardust?** It reads as arcane insight, which argues Knowledge; it has always fed the collection, which argues Stardust. | the rename | [`07-research.md`](features/07-research.md) §9 | **split it** |
| **OQ-13** | **What is a tome's Knowledge cost, and what is the accrual rate?** **The whole pacing of the game past hour three lives in these two numbers, and neither can be derived.** They need the 30-day playtest. | tomes, and all post-hour-3 pacing | [`07-research.md`](features/07-research.md) §8 | needs playtest |
| **OQ-14** | **Do upgrades stay Gold-only forever?** If Gold becomes abundant once the fog is spent, upgrades are the natural place to put the surplus — which argues for repeatable levels on an exponential curve. | late-game Gold sinks | [`07-research.md`](features/07-research.md) §1.4 | Gold-only for now |
| **OQ-15** | **Naming the tomes.** *Earth, Stone, Tide, War, Arcana* is a first pass and deliberately plain. **The tome titles are one of the cheapest places to put character into the game.** | nothing — but it is free flavour | [`07-research.md`](features/07-research.md) §4 | — |

## D · The daily habit and orders

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-16** | **Do orders expire?** A deadline is not a loss under promise 1 — but **a *daily* deadline reads as a chore**, which is a different problem, and a ~30 min/day budget has no room for three mandatory errands. | orders | [`12-quests.md`](features/12-quests.md) §3.4 | **no** — an unclaimed order is *replaced* at the refresh, never failed. Three slots you cannot all clear is choice, which is better pressure than a timer |
| **OQ-17** | **Does an order ever ask for Mana?** | orders | [`12-quests.md`](features/12-quests.md) §3 | **never** — Mana is the session budget; spending it on an errand competes with the thing it exists to pay for |

## E · Events

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-18** | **Does an event currency get a wallet row?** The wallet was just cut from eleven rows to eight on purpose; adding one back per event would undo that within one content drop. | the event archetype | [`13-events.md`](features/13-events.md) §2.1 | **no** — event points are a *counter*, shown on the event screen and nowhere else, exactly as a per-collectible counter already is |
| **OQ-19** | **Do events have a closing date?** **This is not a dial: a deadline is a content-pipeline commitment.** | the whole event cadence | [`13-events.md`](features/13-events.md) §4 | **yes** — the pillar authorises it by name, it already shipped in the weekly event, and without a close the track is a checklist and the shop is a store |
| **OQ-20** | **One track or two per event** — one ladder with two columns, or a separate free ladder and premium ladder? | the pass | [`13-events.md`](features/13-events.md) §2.4 | **one ladder, two columns** — simpler to author, simpler to explain, and it keeps the free player on the same bar as the payer, which is what makes the paid column legible |
| **OQ-21** | **Do event points carry over between events?** | the archetype | [`13-events.md`](features/13-events.md) | **no** — scoped to the occurrence. Carry-over turns an event into a currency and re-opens OQ-18 |
| **OQ-22** | **Does an event island need its own art?** A reskinned terrain set is the cheapest version and it will look like a reskin. **The honest answer is that event art is most of the cost of an event in this genre, and the second-event timing has to include it or the number is a lie.** | the marginal cost of a content drop | [`13-events.md`](features/13-events.md) §8 | — |
| **OQ-23** | **Does the event island obey reveal-cost modifiers?** A relic that discounts the real map should not trivialise the event map. Needs a scope on the modifier, which the existing scope union can express. | the island | [`13-events.md`](features/13-events.md) | **no** |
| **OQ-24** | **Does the 8 h offline cap limit event rewards?** Today an event fires in the post-cap tail, so a 20 h absence spanning a 24 h window pays in full. **Harmless with one weekly event; a support ticket once there is a calendar.** | the calendar | [`13-events.md`](features/13-events.md) §5 | **no, and ratify it as the rule with a test** — the cap limits production, never a timer, and a window is a timer |

## F · Monetisation

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-25** | **How is a pass "bought" in a game with no purchases?** A euro SKU against the simulated credit, or a Gem price? | the pass, and where the store and the event meet | [`14-monetization.md`](features/14-monetization.md) | **in euros** — every comparable sells a pass that way, and pricing it in Gems hides the decision behind a currency conversion the player has to do, which corrupts the intent signal |
| **OQ-26** | **Does cosmetic content exist at all?** Nothing in the game is cosmetic today, and it is the natural monetisation of the audience identified as the money — and the only family with zero economic effect. **Also a pipeline, not a dial.** | the cosmetic thesis | [`14-monetization.md`](features/14-monetization.md) §5 | **one family as a probe, not a system** — three or four Townhall banner variants. A negative result costs an afternoon and is worth knowing |
| **OQ-27** | **Is a full Mana refill really worth more than a hero pull?** 40 Gems against 30. It may well be right — a refill is consumable and a hero permanent — but it has never been argued, and **it is the first price in the game a player can put side by side, so it is the first one that can feel wrong.** | the Gem price list | [`14-monetization.md`](features/14-monetization.md) §9 | — |
| **OQ-28** | **Is €20/month the right simulated budget, and does the monthly card auto-renew?** The budget should be set so a playtester can afford roughly two mid-tier SKUs a month **and must choose** — scarcity is what makes the choice reveal a preference. | the read-out's validity | [`14-monetization.md`](features/14-monetization.md) §3 | sanity-check in week one; **auto-renew yes, with a visible cancel** — the renewal decision is the interesting part |
| **OQ-29** | **Do we tell playtesters we are measuring intent?** | the ethics of the instrument | [`14-monetization.md`](features/14-monetization.md) | **yes, plainly, up front.** They are named colleagues, not a population; an undisclosed measurement of a friend's spending impulses is not worth the data, and disclosure costs almost nothing in signal because **the budget is what makes the choice honest, not ignorance** |
| **OQ-30** | **Is 30 Gems right for the second builder?** Priced at a gacha pull on purpose, but nobody has watched a player meet it — and the offer arrives *very* early, since one builder is the opening state. | the first conversion surface | [`06-construction.md`](features/06-construction.md) | needs playtest |
| **OQ-31** | **Should the builder offer have a cooldown?** A player mid-expansion can meet the refusal several times a minute. **If that reads as nagging, the fix is a "don't offer again for N minutes" flag rather than a quieter refusal — the offer is the point.** | — | [`06-construction.md`](features/06-construction.md) | needs playtest |
| **OQ-32** | **Does a builder ever come from a quest?** A granted second builder late in the chain would **teach the mechanic before it is ever sold**, which is the pattern every other slot in the game follows. | — | [`06-construction.md`](features/06-construction.md) | **yes** |

## G · The social layer and the world

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-33** | **What is a guild in a game with no PvP** — purely cooperative, or ranked between guilds? The design's own line points at ranked-on-economy, which is the softest competition available. **But with five to ten playtesters there is no league, and a leaderboard with two entries teaches nothing and looks broken.** | the guild | [`15-social.md`](features/15-social.md) §4.1 | **ship the cooperative bar; design and defer the league** |
| **OQ-34** | **Does helping touch the other player's state, or only your own?** | daily help | [`15-social.md`](features/15-social.md) §3.1 | **only your own, plus a gift they claim.** Cheaper, needs no presence, cannot corrupt a save, and keeps the determinism rule intact. The gift is not instant, which nobody will notice |
| **OQ-35** | **How is a defended landmark cleared** — the full expedition sheet with a hero and a party, or a lighter one-off that spends army power? **Four of ten landmarks are a visible dead end today, and this is the only thing that gives combat a job outside a dungeon.** | the far landmark ring, and the guild weekly's first content | [`15-social.md`](features/15-social.md) §6 | **neither and both: commit army power to a siege that resolves at the week's deadline.** One command whose contributor count can be one or ten — a solo player takes weeks, a guild takes one week |
| **OQ-36** | **Does a guild need a minimum size to score?** With ten playtesters, one guild of two and one of eight makes the bar meaningless. Either thresholds scale with member count — **which invites roster-gaming** — or the prototype runs one guild. | the bar's thresholds | [`15-social.md`](features/15-social.md) | **one guild for the prototype**, and the scaling problem is a real design question for later |
| **OQ-37** | **Donations: which resources, and does it become a laundering loop?** The order rule applies — a contribution must never pay back what it asked for — **but donations sit closer to that line than orders do.** | the guild bar | [`15-social.md`](features/15-social.md) §5.1 | — |
| **OQ-38** | **What happens to committed units if a player leaves the guild mid-siege?** | the siege | [`15-social.md`](features/15-social.md) §6 | **the commitment stands until the deadline, then returns.** Anything else needs a withdrawal path nobody will use |
| **OQ-39** | **Rate limits on a free hosted project.** Five playtesters is nothing; a contribution firing on every order and every depth is not. **Batch it, and say so before the first playtest rather than after it.** | the first playtest | [`15-social.md`](features/15-social.md) | batch, like the telemetry queue |

## H · Numbers only a playtest can close

Not arguments. Do not litigate these — instrument them.

| # | Question | Owner doc |
|---|---|---|
| **OQ-40** | **The 50% haul loss on a failed push.** The number that most needs playtest rather than argument: lower is gentler and may make pushing automatic; higher bites but starts to feel like the loss aversion the positioning rules out. | [`11-expeditions.md`](features/11-expeditions.md) §10 |
| **OQ-41** | **Collection progress sits behind the army.** The chain is army → hero → ruin → first clear → Stardust → relic levels. That gives the military buildings a job outside dungeons, which the design wants — **but a player who never delves makes no progress on the weeks-long arc at all.** First thing to watch. If it bites, the cheapest answer is a small early Stardust sink in the Reliquary, **not** putting the technology tree back on this currency. | [`10-heroes.md`](features/10-heroes.md) §4 |
| **OQ-42** | **Re-derive the tree's Gold now, or with eras?** It is 56% of what the quest chain pays. Re-pricing now is a one-line change to 24 rows; doing it with eras is doing it once. **Leaning: leave it, and let the measured 1.80× be the argument for eras.** | [`07-research.md`](features/07-research.md) §2 |
| **OQ-43** | ~~**Late-game costs against scaled taps** — a watcher gathers ~50% faster.~~ **CORRECTED 2026-09-03: the 50% was computed on a tap that minted.** Priced against the ground ([`04-harvest.md`](features/04-harvest.md) §4.3) a full pool is ~5.5 minutes of the city's own production, so at five ads a day a watcher gathers about **2–3%** more, not 50%. The arithmetic is not negotiable: twenty hours a day of crew production dwarfs anything a thumb does in a 30-minute visit, and reaching 50% would need a pool worth two and a half hours — which is the model that just got deleted. **The ad's job is the visit, not the day**, and the surviving question is whether that is a good enough offer to be worth six placements. | [`14-monetization.md`](features/14-monetization.md) §6 |
| **OQ-44** | **Cell exhaustion is the ceiling on the Mana pool**, and it is now the *binding* one. A 332-tap pool at 1 Wood a tap wants **332 Wood**; the map's 57 trees hold 570 standing and regrow ~157/min, and the crew is drawing on the same depots. At `work_seconds` 10 that fits with room to spare — halving the tap halved the demand — so this is comfortable **today** and tightens again the moment either the tap or the crew grows. **Which of the two ends a session — the pool or the map — is a decision, and it should be the pool**, because that is the half a refill can sell against. The exits are OQ-54. | [`04-harvest.md`](features/04-harvest.md) §3.2, [`08-magic.md`](features/08-magic.md) |
| **OQ-45** | **Ads per day is a target, not a measurement.** ~10/day across three visits is an intention. **The acceptance test is timing a real visit and counting.** Same for the ~30 min/day event budget. | [`14-monetization.md`](features/14-monetization.md) §6 |
| **OQ-51** | **Does the ad economy still balance now that a pool is worth ~800× less?** The dials were re-derived on 2026-09-03 — `tap.work_seconds` **10** (a tactile choice: about ten taps to a tree) and `mana.gem_refill_fraction` **0.34**, so a full pool is ~**5.5 minutes** of the city's own production and 3 Gems at every stage. What is NOT settled is whether ~5.5 minutes for ~3 minutes of thumb is an offer worth building six ad placements around, and whether *ten landmarks double every future ad* still means anything at that purchasing power. **A sharper question at 10 than it was at 20**, and `work_seconds` is the lever: doubling it doubles the ad. **Instrument it before widening the placements.** | [`04-harvest.md`](features/04-harvest.md) §4.3, [`08-magic.md`](features/08-magic.md) §8 |
| **OQ-55** | **Mana spent on rent is worth several times Mana spent on trees, and nothing bounds it.** A house tap mints (it must — an advance against a continuous accrual is a no-op), there are six houses against thirty workers, and the per-house advance budget that capped it was **built and cut on playtest**: it read as an arbitrary refusal on the building the player taps most. So a full pool sweeping the neighbourhood is worth ~**9 minutes** of tax income against ~**1.8** spent on wood, and the optimal play is *stop tapping trees* — which makes the signature verb an opening and frontier move rather than a standing one. **Possibly fine** (Gold is the real bottleneck and materials are abundant), possibly the thing that hollows out the harvest loop. Watch it in play. If it bites, the lever is making a harvest tap worth more — `tap.work_seconds` and the ground's abundance — **not** the budget coming back. | [`04-harvest.md`](features/04-harvest.md) §4.1 |
| **OQ-54** | **Map density: does a full pool have anywhere to be spent?** A 332-tap pool wants 332 Wood and the province holds 570 standing (57 trees × 10), most of whose regrowth the crew is already taking. Comfortable at `work_seconds` 10; it was marginal at 20 and would be again. Three exits: **more cells** (pure map authoring, and the editor can census it), **more stock per cell** (which makes workers park instead of migrating, costing the §3 beat), or **a smaller pool** (which shrinks the ad). **Recommendation: density.** It is the only one of the three that costs nothing else, and it is the lever already in a designer's hands. | [`04-harvest.md`](features/04-harvest.md) §3.2, [`../map-editor.md`](map-editor.md) |
| **OQ-52** | **The thumb raiding its own crews' cells.** A claim blocks other workers but not taps, and with no reserve floor a player can exhaust the tree their own woodcutter is felling and send them walking. It is honest — both draw on the same ground — and it is a real decision when you need twenty Wood *now*. **Whether it reads as clever or as self-sabotage is a table question.** If it bites, the dial back is a worker-only reserve floor, at the cost of the exhaustion beat and the migration it drives. | [`04-harvest.md`](features/04-harvest.md) §6 |
| **OQ-53** | **`CollectTaps` distinguishes who collected; `CollectResource` does not.** Both paths bank the same collect event, so the quest *"tap the plots for Food — doing this forever is not the plan"* **can be completed today without touching anything, by the workers**. It asks with the hand and pays out for the machine. It bites harder with an automation ladder, where half the beats worth authoring are *"now let the Sawmill do it"* — which wants a **`WorkerCollect`** goal type, and a goal type is code rather than data. | [`12-quests.md`](features/12-quests.md) §3 |

## I · Contradictions in the written design

Not decisions — **known disagreements between two things we wrote down.** Each one
needs somebody to say which is right, and then a test so it cannot drift back.

| # | Contradiction | Where | Note |
|---|---|---|---|
| **OQ-46** | **Housing capacity is `[2, 4]` in the data, and three balance passes derived every pacing figure from `[1, 2]`** — quoting *TH1 ≈ 60 Gold/min* where the data gives 120. The onboarding rewrite is what moved it, deliberately: *a level-1 House holds 2, so the second villager needs no second roof.* **The data is almost certainly right and the derived tables are stale — but every early-pacing number in the design descends from the wrong one.** | [`03-economy.md`](features/03-economy.md) §3 | re-derive once, then assert it |
| **OQ-47** | **The near shrine's price is three different numbers.** The map authors **2,000**; the onboarding writeup says it was *re-priced to 400*; two other docs said *5,000 for the one in sight*. **2,000 is what ships.** The prose that disagreed is now deleted, but the *design* question survives: **is 2,000 the right price for the step-25 beat**, where the player has two Houses and a Sawmill? | [`01-map-and-fog.md`](features/01-map-and-fog.md) §6 | 2,000 is the data; validate the beat |
| **OQ-48** | **Adjacency is exactly one rule** (Housing↔Housing, −1 Gold/min) against **fourteen districts** competing for the same ground. Pure data — the sheet is directed pairs with one effect column. **Widen the column beyond Gold once and author twenty rules: the most design depth per hour of work in the repository.** But it is downstream of OQ-1, because **adjacency rules cannot matter on a canvas that grows by buying tiles.** | [`03-economy.md`](features/03-economy.md) §3 | blocked on OQ-1 |

## J · Authoring

| # | Question | Owner doc | Note |
|---|---|---|---|
| **OQ-49** | **Should a map change force a save-version bump?** Today it is a note and a human remembering. The editor knows exactly which cells moved and *could* warn when a change touches ground a live save has revealed — but **"which edits actually break a save" has not been pinned down, and guessing it wrong in either direction is worse than the note.** | [`map-editor.md`](map-editor.md) | authoring |
| **OQ-50** | **Should the map editor's census have budgets?** It counts, and a designer compares against a number in their head. Authoring *ring ≤ 4 wants ≥ 12 Wood* would turn the census into a second validator — useful, **but it is a balance statement, and those live in the workbook, which no longer knows where anything is.** | [`map-editor.md`](map-editor.md) | authoring |

---

## Recently closed

Kept short, and only while the reasoning is still worth having to hand.

| Question | Closed | Answer |
|---|---|---|
| What does the daily chest pay, and what does a streak add? | 2026-09-02 | **Mana every day, Gems at the week marker only.** Gems daily devalues the marker and makes the faucet hard to bound. And **the ladder advances on days *played***, so a streak cannot be lost — which is what keeps it inside promise 1. |
| Does the daily pill auto-open? | 2026-09-02 | **No, it only glows.** The design is about a game that does not make demands; a build that opens with one contradicts it in the first second. |
| Do orders live on the Market or in their own building? | 2026-09-03 | **The Market, as a second tab — and the Market moved into the opening to meet them.** The fix was not to accept that orders arrive at hour three; it was to move the beat. |
| Do orders exist before the Market? | 2026-09-03 | **Moot** — the Market is now steps 15–17. |
| Is the Gem faucet over budget? | 2026-09-02 | **No.** 10 start + 15 chain + 50 first-clears = **75**, exactly the budget. The claim of 110 assumed eleven quests carried Gem rewards; four do. Now asserted by a test. |
| Should relics cost Mana upkeep? | 2026-09-02 | **No — upkeep removed entirely.** At Townhall 1 the full set drew exactly what the Townhall made, so wearing everything stalled the pool dead. **Attune-or-arm rests on exclusivity alone, and a cost you cannot out-produce is a firmer constraint than one you can.** |
| Do landmarks raise Mana production or capacity? | 2026-09-02 | **Capacity, +10 each.** A rate bonus is worth most on the day you find it and less every day after; capacity is worth *more* the longer you play, and it doubles every future ad. **The same argument now governs contested Knowledge landmarks.** |
| Should the Mana pool refill exactly overnight? | 2026-09-02 | **No — the tuning law is suspended by decision.** It belonged to an *absence* budget; Mana is a *spend* budget now, and **a spend budget has to be able to run out or a refill has nothing to sell.** |
| Is there a waiting line for builds? | 2026-09-02 | **No.** A waiting line is administratively convenient and dramatically inert — the player queues five things and never meets the constraint. **Without one the constraint has a moment, and a moment is something a game can build on.** |
| Is an iron vein just a mountain with different art? | 2026-09-03 | **Yes, and it is gone.** `IronVein` and the `Iron` source were deleted; the metal is a *kind of mountain* now — **iron** pays Stone at five times a bare peak, **gold** pays Gold at three. Both are worked by the Mine, which had been a second Quarry pointed at a second rock ever since iron stopped being a currency. The redundancy went away by making the two things genuinely different rather than by deleting one of them. |
| Should the map be authored in the workbook? | 2026-09-03 | **No.** A map is not tabular data. Terrain, features, landmarks and ruins live in a JSON document painted in `?dev=map`; the workbook keeps every *number*. |
