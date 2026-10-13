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
| **OQ-3** | **How long is a season on the board?** A world is seven boards of six seats, 889 hexes ([`19-world-map.md`](features/19-world-map.md) §1), but nothing says when a world ends, whether it ends at all, or what a player carries out of it. It decides whether a lost corridor is a setback or a permanent demotion, and whether a new player can ever land on a board that is already carved up. | the world board | [`19-world-map.md`](features/19-world-map.md) §1 | — |
| **OQ-4** | **Is a temporary province generated or authored per drop?** Authored is cheaper to make *good* and needs no generator; generated is the only version that scales past a designer's throughput. | the event pipeline's marginal cost | [`13-events.md`](features/13-events.md) §2.3 | — |
| **OQ-6** | **How many systems can this game carry?** Ten progression systems are on record as a standing accepted risk; the current plan adds three more. **The defence is that the three are shells around existing ones** — a Wonder is a district plus an upgrade curve, the event track is the timeline, the guild weekly is a delve scoring pass. **If any of them turns out to need its own economy, its own currency and its own screen, it has stopped being a shell and should be cut instead of shipped.** | every feature | [`10-heroes.md`](features/10-heroes.md) §1 | the shell test |

> **OQ-6 is the one that should make everyone uncomfortable, so it gets said
> directly: this plan makes the game bigger, and the game was already flagged as
> too big.** The currency half of that risk was cut — nine wallet rows, one
> job per currency. The systems half never was.

## B · The collection

None open.

## C · Research and tomes

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-12** | **Does the weekly event's 60 lump pay Knowledge or Stardust?** **Sharper since 2026-09-03, and no longer a naming detail:** the two currencies now do genuinely different jobs and sit at different scopes — Knowledge is the **kingdom's** capped research bar — and a lump lands over the cap in full — Stardust is the **kingdom's** collection currency that survives a region reset ([`03-economy.md`](features/03-economy.md) §1.1). So the lump is a choice between *pacing this city's tree* and *permanent progress on the collection*, and **a Knowledge lump has to land over the cap** ([`07-research.md`](features/07-research.md) §3) while a Stardust lump has no ceiling to clear. | the event's reward table | [`07-research.md`](features/07-research.md) §3 | **split it** |
| **OQ-13** | **Every number in the tree.** A technology's Knowledge and Gold by chapter, what each chapter asks for in revealed cells (`tech-tree.json` › `eras`), the lumps, and the pace they yield together. None of them can be derived; they need the 30-day playtest. | all post-hour-3 pacing | [`07-research.md`](features/07-research.md) §3; [`tech-tree.md`](features/tech-tree.md) | needs playtest |
| **OQ-105** | **The price of a point of Knowledge.** The Gold price of the first point bought (`knowledge.goldPriceBase`), which the linear, never-reset ladder multiplies by the count ever bought, and the fixed Gem price of a point (`knowledge.gemsPerPoint`). The Gold base has to sit against a technology's own Gold price, and the Gem price against the ~4,500 Gems a month the free faucet pays. | the purchase | [`07-research.md`](features/07-research.md) §3.2 | needs the harness |
| **OQ-69** | **Where does villager training live?** It stays on the Townhall (`townhallTap`); if the Townhall is to be nothing but permission, training needs a home first. | the Townhall's role | [`05-city-and-districts.md`](features/05-city-and-districts.md) §1, [`03-economy.md`](features/03-economy.md) §5 | — |

## D · The daily habit

None open.

## E · Events

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-18** | **Does an event currency get a wallet row?** The wallet is nine rows on purpose; adding one per event would undo that within one content drop. | the event archetype | [`13-events.md`](features/13-events.md) §2.1 | **no** — event points are a *counter*, shown on the event screen and nowhere else, exactly as a per-collectible counter already is |
| **OQ-19** | **Do events have a closing date?** **This is not a dial: a deadline is a content-pipeline commitment.** | the whole event cadence | [`13-events.md`](features/13-events.md) §2.6 | **yes** — the pillar authorises it by name, it already shipped in the weekly event, and without a close the track is a checklist and the shop is a store |
| **OQ-20** | **One track or two per event** — one ladder with two columns, or a separate free ladder and premium ladder? | the pass | [`13-events.md`](features/13-events.md) §2.4 | **one ladder, two columns** — simpler to author, simpler to explain, and it keeps the free player on the same bar as the payer, which is what makes the paid column legible |
| **OQ-21** | **Do event points carry over between events?** | the archetype | [`13-events.md`](features/13-events.md) | **no** — scoped to the occurrence. Carry-over turns an event into a currency and re-opens OQ-18 |
| **OQ-22** | **Does an event island need its own art?** A reskinned terrain set is the cheapest version and it will look like a reskin. **The honest answer is that event art is most of the cost of an event in this genre, and the second-event timing has to include it or the number is a lie.** | the marginal cost of a content drop | [`13-events.md`](features/13-events.md) §2.3 | — |
| **OQ-23** | **Does the event island obey reveal-cost modifiers?** A relic that discounts the real map should not trivialise the event map. Needs a scope on the modifier, which the existing scope union can express. | the island | [`13-events.md`](features/13-events.md) | **no** |

## F · Monetisation

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-25** | **How is an event track's paid column bought** — a dollar `store` entry, like the Survey's, or a Gem price? | an event track's paid column | [`14-monetization.md`](features/14-monetization.md) | **in dollars** — pricing it in Gems hides the decision behind a currency conversion, which corrupts the intent signal |
| **OQ-26** | **Does cosmetic content exist at all?** Nothing in the game is cosmetic today, and it is the natural monetisation of the audience identified as the money — and the only family with zero economic effect. **Also a pipeline, not a dial.** | the cosmetic thesis | [`14-monetization.md`](features/14-monetization.md) §5 | **one family as a probe, not a system** — three or four Townhall banner variants. A negative result costs an afternoon and is worth knowing |
| **OQ-29** | **Do we tell playtesters we are measuring intent?** | the ethics of the instrument | [`14-monetization.md`](features/14-monetization.md) | **yes, plainly, up front.** They are named colleagues, not a population; an undisclosed measurement of a friend's spending impulses is not worth the data, and disclosure costs almost nothing in signal because **the budget is what makes the choice honest, not ignorance** |
| **OQ-31** | **Should the builder offer have a cooldown?** A player mid-expansion can meet the refusal several times a minute. **If that reads as nagging, the fix is a "don't offer again for N minutes" flag rather than a quieter refusal — the offer is the point.** | — | [`06-construction.md`](features/06-construction.md) | needs playtest |
| **OQ-32** | **Does a builder ever come from a quest?** A granted second builder late in the chain would **teach the mechanic before it is ever sold**, which is the pattern every other slot in the game follows. | — | [`06-construction.md`](features/06-construction.md) | **yes** |

## G · The social layer and the world

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-33** | **Is a guild purely cooperative, or ranked between guilds?** The design's own line points at ranked-on-economy, which is the softest competition available. **But with five to ten playtesters there is no league, and a leaderboard with two entries teaches nothing and looks broken.** | the guild | [`15-social.md`](features/15-social.md) §4.1 | **ship the cooperative bar; design and defer the league** |
| **OQ-36** | **Does a guild need a minimum size to score?** With ten playtesters, one guild of two and one of eight makes the bar meaningless. Either thresholds scale with member count — **which invites roster-gaming** — or the prototype runs one guild. | the bar's thresholds | [`15-social.md`](features/15-social.md) | **one guild for the prototype**, and the scaling problem is a real design question for later |
| **OQ-37** | **Donations: which resources, and does it become a laundering loop?** The sink rule applies — a contribution must never pay back what it asked for ([`16-wonders.md`](features/16-wonders.md) §3.1) — **but donations sit closer to that line than a Wonder level does**, because a donation is denominated in the same resources the bar pays out. | the guild bar | [`15-social.md`](features/15-social.md) §5.1 | — |
| **OQ-38** | **What happens to committed units if a player leaves the guild mid-siege?** | the siege | [`15-social.md`](features/15-social.md) §6 | **the commitment stands until the deadline, then returns.** Anything else needs a withdrawal path nobody will use |
| **OQ-39** | **Rate limits on a free hosted project.** Five playtesters is nothing; a contribution firing on every Wonder level and every depth is not. **Batch it, and say so before the first playtest rather than after it.** | the first playtest | [`15-social.md`](features/15-social.md) | batch, like the telemetry queue |

## H · Numbers only a playtest can close

Not arguments. Do not litigate these — instrument them.

| # | Question | Owner doc |
|---|---|---|
| **OQ-92** | **The two brakes on the fog.** The reach ladder (3 · 5 · 7 · 8 · 10 · 11 · 13 · 15 · 17 · 23 rings, `exploration` › `reachPerTownhallLevel`) and the count dials (×1.05 every 10 revealed cells) are guesses. In the harness the reach is the brake in week 1 and the count multiplier from week 2 on; the measure is how much Gold the bot holds at day 30 and how many landmarks it claims. First to watch: the TH2 window's margin over the chain's `DiscoverCells` goals. | [`01-map-and-fog.md`](features/01-map-and-fog.md) §4, §5 |
| **OQ-93** | **The villagers each Townhall level asks for.** The ladder (3 · 5 · 12 · 20 · 30 · 40 · 50 · 60 · 72) and the villager price growth it needed (×1.45 → ×1.05, or the 20th villager costs 181,636 Food and the ladder dies at Townhall 4) are guesses fitted to the harness on 2026-09-10: 3 · 7 · 8 · 10 · 11 · 13 · 16 · 22 · 30, with TH3 moving from day 3 to day 7 and the month ending on 76 villagers. Is day 7 the right beat for TH3, or should its five villagers be three? And the city is now big enough — 76 crew — that the worker loop's cost shows: an 8-hour catch-up is measured in seconds, and the harness's month in ~25 s. | [`05-city-and-districts.md`](features/05-city-and-districts.md) §1 |
| **OQ-94** | **Does the new chrome land on the phone?** The density (header 44, nav 52, sheets ≤ 70%, 44px targets), the scale (22 / 16 / 13) and the smooth 64px icon atlas were built on 2026-09-10 against ChatGPT mockups at 1080×2340 (`Docs/art/ui/mockups/`) and the `?dev=kit` phone frame, not against the device — the Chrome extension cannot reach `localhost`. The board settled fit-to-content sheets and the close knob in the plank on 2026-09-11, and the type became one family in four weights (Nunito 800/700/600/400) the same day; what is left is the device. The district card is still rebuilt each tick (Step 4 of the plan) — the one place a held button or an iOS fling can still be interrupted. | [`art/ui-menus-redesign.md`](art/ui-menus-redesign.md) §3.4–3.6, §6.8 |
| **OQ-43** | ~~**Late-game costs against scaled taps** — a watcher gathers ~50% faster.~~ **CORRECTED 2026-09-03: the 50% was computed on a tap that minted.** Priced against the ground ([`04-harvest.md`](features/04-harvest.md) §3.3) a full pool is ~5.5 minutes of the city's own production, so at five ads a day a watcher gathers about **2–3%** more, not 50%. The arithmetic is not negotiable: twenty hours a day of crew production dwarfs anything a thumb does in a 30-minute visit, and reaching 50% would need a pool worth two and a half hours — which is the model that just got deleted. **The ad's job is the visit, not the day**, and the surviving question is whether that is a good enough offer to be worth six placements. | [`14-monetization.md`](features/14-monetization.md) §6 |
| **OQ-44** | **Cell exhaustion is the ceiling on the Mana pool**, and it is now the *binding* one. A 332-tap pool at 1 Wood a tap wants **332 Wood**; **the province as painted holds 50 trees — 500 Wood standing** — and the crew is drawing on the same depots. At `work_seconds` 10 that fits with room to spare — halving the tap halved the demand — so this is comfortable **today** and tightens again the moment either the tap or the crew grows. **Which of the two ends a session — the pool or the map — is a decision, and it should be the pool**, because that is the half a refill can sell against. The exits are OQ-54. | [`04-harvest.md`](features/04-harvest.md) §2.3, [`08-magic.md`](features/08-magic.md) |
| **OQ-45** | **Ads per day is a target, not a measurement.** ~10/day across three visits is an intention. **The acceptance test is timing a real visit and counting.** Same for the ~30 min/day event budget. | [`14-monetization.md`](features/14-monetization.md) §6 |
| **OQ-51** | **Is a full pool an offer worth six ad placements?** `tap.workSeconds` is **10**, so a full pool is a few minutes of the city's own production for a few minutes of thumb, and a refill for Gems climbs the `mana.gemRefillCosts` ladder. Whether that is worth building six ad placements around — and whether *more landmarks make every future ad bigger* still means anything at that purchasing power — is not settled. `workSeconds` is the lever: doubling it doubles the ad. **Instrument it before widening the placements.** | [`04-harvest.md`](features/04-harvest.md) §3.3, [`08-magic.md`](features/08-magic.md) |
| **OQ-56** | **The ground multipliers are authored where the map has nothing to harvest.** ~~What is Tundra for?~~ **Closed 2026-09-03: Tundra is as poor as Snow at food (×0.75) and the best timber AND stone in the world (×1.5 both)** — the cold frontier you walk to for materials at the price of not eating there. What is left is a MAP question, not a balance one: **re-censused on the province as redrawn 2026-09-03:** Grassland holds 42 of the 50 trees, so its bonus is fully live, and Tundra's stone bonus is now real — 10 mountains and an iron peak in 26 cells. What did **not** move is the other half: **Desert's stone bonus still reaches exactly one mountain in 81 cells, and Tundra still holds zero trees**, so the ×1.5 timber that is the whole reason to walk to the cold frontier pays out on nothing. The two biomes with a positive reason to be walked to have almost nothing to walk to. Conifers on the tundra and rock in the sand, or the dials are decoration. | [`04-harvest.md`](features/04-harvest.md) §2.2, [`../map-editor.md`](map-editor.md) |
| **OQ-54** | **Map density: does a full pool have anywhere to be spent?** A 332-tap pool wants 332 Wood and the province holds **500 standing (50 trees × 10)**, most of whose regrowth the crew is already taking. Comfortable at `work_seconds` 10; it was marginal at 20 and would be again. Three exits: **more cells** (pure map authoring, and the editor can census it), **more stock per cell** (which makes workers park instead of migrating, costing the §3 beat), or **a smaller pool** (which shrinks the ad). **Recommendation: density.** It is the only one of the three that costs nothing else, and it is the lever already in a designer's hands. | [`04-harvest.md`](features/04-harvest.md) §2.3, [`../map-editor.md`](map-editor.md) |
| **OQ-52** | **The thumb raiding its own crews' cells.** A claim blocks other workers but not taps, and with no reserve floor a player can exhaust the tree their own woodcutter is felling and send them walking. It is honest — both draw on the same ground — and it is a real decision when you need twenty Wood *now*. **Whether it reads as clever or as self-sabotage is a table question.** If it bites, the dial back is a worker-only reserve floor, at the cost of the exhaustion beat and the migration it drives. | [`04-harvest.md`](features/04-harvest.md) §5 |
| **OQ-53** | **`CollectTaps` distinguishes who collected; `CollectResource` does not.** Both paths bank the same collect event, so the quest *"tap the plots for Food — doing this forever is not the plan"* **can be completed today without touching anything, by the workers**. It asks with the hand and pays out for the machine. It bites harder with an automation ladder, where half the beats worth authoring are *"now let the Sawmill do it"* — which wants a **`WorkerCollect`** goal type, and a goal type is code rather than data. | [`12-quests.md`](features/12-quests.md) §1.1 |
| **OQ-72** | **Every number in the lair design** — each lair's warning in minutes, `takeSeconds` per tier, the 0.5 fraction of what the stores hold, three raids a day. A lair's `power` is the one that IS derived. The rest are guesses wearing a decimal point. **The first to watch is the Orcs' warning**: too short and the first raid lands before the Barracks stands; too long and the counter is decoration. | [`18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md) §2, §8 |
| **OQ-96** | **What a legendary boon is worth.** The six boons ([`10-heroes.md`](features/10-heroes.md) §2.6) are a first pass, and they are the first numbers in the game a player can only reach through the gacha's Legendary slice. Too small and the pull is a stat block; too large and the golden call is the way the kingdom is built. | [`10-heroes.md`](features/10-heroes.md) §2.6 |
| **OQ-107** | **The full store, and the load that lands over it.** Capacity is 1 h of a building at level 1 rising to 12 h at level 10 ([`03-economy.md`](features/03-economy.md) §3.2), so a store is full by the next of three visits a day. Does a full store (a red bubble, a crew by the door) read as a nudge or a scold? A haul already on its way when the store fills lands whole, so a store can sit one load over capacity — matter is never destroyed; watch whether the number over the cap confuses. | [`03-economy.md`](features/03-economy.md) §3.2, [`04-harvest.md`](features/04-harvest.md) §4 |
| **OQ-138** | **Does `power` read a rank fairly?** A rank multiplies `dmg` and `hp` together but `power` once (×1.6 a rank), so a squad of rank V against one of rank I is stronger than the estimate says, and a generated board that mixes R−1 and R is priced the same way. Fight a rank against the rank below in the harness before the evolutions' numbers are frozen; the exit is a steeper `power` ladder, authored per rank. | [`combat.md`](features/combat.md) §6, §12 |

## I · Contradictions in the written design

Not decisions — **known disagreements between two things we wrote down.** Each one
needs somebody to say which is right, and then a test so it cannot drift back.

| # | Contradiction | Where | Note |
|---|---|---|---|
| **OQ-46** | **Housing capacity is `[2, 4]` in the data, and three balance passes derived every pacing figure from `[1, 2]`** — quoting *TH1 ≈ 60 Gold/min* where the data gives 120. The onboarding rewrite is what moved it, deliberately: *a level-1 House holds 2, so the second villager needs no second roof.* **The data is almost certainly right and the derived tables are stale — but every early-pacing number in the design descends from the wrong one.** | [`03-economy.md`](features/03-economy.md) §3 | re-derive once, then assert it |
| **OQ-125** | **Dungeon and Portal Knowledge skips the lump stage.** It lands straight in the wallet, so the Scriptorium ranks and the Necromancer's boon, which [`07`](features/07-research.md) §3 says raise every lump, do not raise it. | `07` §3 | route it through the lump, or say in `07` that it is exempt |
| **OQ-126** | **The ad's slice is not the same at every stage.** The pool grows only with landmarks, Sanctuaries and the Sanctum while production grows with the whole city, so a full pool is a smaller slice of production late than early. Is that the intended shape? | `04` §3.3, OQ-51 | re-derive, then pin it with a test |
| **OQ-127** | **Data that nothing reads.** `mana.meditationCap`, `exploration.knowledge.conquestFirstClearLump` and the `SellGoods` quest goal are authored and never read. | the data | delete or wire each one |

## J · Authoring

| # | Question | Owner doc | Note |
|---|---|---|---|
| **OQ-49** | **Should a map change force a save-version bump?** Today it is a note and a human remembering. The editor knows exactly which cells moved and *could* warn when a change touches ground a live save has revealed — but **"which edits actually break a save" has not been pinned down, and guessing it wrong in either direction is worse than the note.** | [`map-editor.md`](map-editor.md) | authoring |
| **OQ-50** | **Should the map editor's census have budgets?** It counts, and a designer compares against a number in their head. Authoring *ring ≤ 4 wants ≥ 12 Wood* would turn the census into a second validator — useful, **but it is a balance statement, and those live in the workbook, which no longer knows where anything is.** | [`map-editor.md`](map-editor.md) | authoring |

## K · Wonders — the ladder with no top

New with [`16-wonders.md`](features/16-wonders.md) (2026-09-03), **reviewed and
narrowed to three the same day.** None of them blocks building the feature: the
mechanism, the fit and the rules are closed, and what is left is **the art bill,
the numbers, and one later layer.** OQ-60 closed on review (a Wonder stands on
the province) and is in *Recently closed*.

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-57** | **How many Wonders, and what is the art bill — including the cosmetic tiers?** Elvenar ships around twenty; the design commits to **three**, one per call site (§7.1), and each is the *only* one of its kind in the world (§3.2). So **a Wonder is the most-looked-at sprite in the city** and a reskinned district will read as one. On top of the base art, §5.3 puts the endless ladder's only beats in a **visual tier every N levels** — which is the cosmetic probe OQ-26 wants, arriving inside a feature rather than as a store card, and which multiplies the art per Wonder. **This is the same fault line as OQ-22: the art is most of the cost, and a count chosen without the art bill in it is a count chosen wrong.** | the set, the art schedule, and OQ-26's probe | [`16-wonders.md`](features/16-wonders.md) §5, §7.1 | **three, each with real art** — a fourth arrives nearly free with the event archetype's `buildSpeed` |
| **OQ-58** | **The three numbers: `cost_growth`, `cost_base`, `effect_per_level`.** The design fixes the *shape* — an exponential cost against a linear effect — and deliberately sets none of the values, because a late-game pacing target invented before the late game exists is a guess wearing a decimal point. `cost_growth` is the one that decides sink-or-formality on its own. **The tuning brief is a sentence: the first levels should feel worth buying and a deep one should not.** ~~And is the Market leak real?~~ **The leak half closed 2026-09-03 by shape rather than by tuning** ([`16-wonders.md`](features/16-wonders.md) §6.1): a production Wonder does pay materials that the Market turns back into Gold, but the payback period is an exponential cost over a linear return, so it grows without bound and the loop cannot run away at any value of the dial. | the feature's balance, not its shape | [`16-wonders.md`](features/16-wonders.md) §6 | needs the late game to exist first |
| **OQ-59** | **Does the social donate hook exist?** In Elvenar the loop that makes a wonder social is **donating Knowledge Points to someone else's**, paid back in runes — it is the reason to have neighbours at all. Kingdom's answer to *does helping touch the other player's state* is already **no** (OQ-34), which a donation contradicts. **If the hook ships, it ships as a gift the owner claims, not as a write into their city.** | the social layer's shape | [`15-social.md`](features/15-social.md) §3.1 | defer to the social layer (plan Step 4); gift-shaped or not at all |

## M · Lairs, dungeons and the combat resolver

Lairs are [`18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md),
dungeons [`11-expeditions.md`](features/11-expeditions.md) and their screens
[`11a-ruins-ui.md`](features/11a-ruins-ui.md); the resolver is
[`combat.md`](features/combat.md).

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-75** | **Does a dungeon room need a daily attempt cap?** Retry is unlimited and costs only its Mana (20). **If Mana is plentiful enough to ignore, a wall is beaten by repetition rather than by composition.** | the retry economy | [`11-expeditions.md`](features/11-expeditions.md) §5 | Mana is the throttle; a cap is the fallback, not the first dial |
| **OQ-86** | **A room's `power` has to be authored against the full rank I–V range.** A troop's `power` spans **×1.0 to ×6.8** across its evolutions ([`combat.md`](features/combat.md) §6), so a depth priced against rank I is trivial at rank V and one priced for rank V is a wall at rank I. | authoring depths | [`11-expeditions.md`](features/11-expeditions.md) §6 | price a depth against the rank the player can have by then |
| **OQ-109** | **How wide is a lair's zone?** The proposal's `1 · 1 · 2 · 2 · 3` rings are a guess. Too narrow and the zone is a marker; too wide and the first lair walls off the early city before the Barracks stands. The zone is the ground-side half of the pressure, so it is one of the two numbers that decide whether a lair is attacked or ignored. | Lair authoring | [`18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md) §2 | Playtest the Orcs first |
| **OQ-110** | **Is the hoard, Hero XP and 15 Knowledge enough for a one-shot fight?** A lair pays what the gate paid, plus the first-clear lump and the ground it held. Nothing else in the fight is new, so the reward is the whole argument for the army a tier-V Drake needs. | Lair reward | [`18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md) §5 | — |
| **OQ-112** | **Three raids a day, for ever, is the other half of the pressure.** A lair has no trip limit: it raids `raid.perDay` (3) times inside the local 9–23 window until it is cleared, and its hoard stops at a day of raids, so everything past it is lost. Each raid is small — `takeSeconds` of production, at most half the stores — but it never stops, and a lair the player cannot yet beat (a Drake found early) is a daily bill with no answer but the army. Watch whether three is a nudge or a nag, and whether a player with five lairs open (fifteen raids a day) reads the summary as one event or as noise. | Lair pacing | [`18-garrisons-and-raids.md`](features/18-garrisons-and-raids.md) §4 | Playtest |
| **OQ-113** | **Three world relics move numbers nothing reads.** The Wisp Lantern (`roomHaul`, and its Lamplight), the Stargazer's Orb (`stardustYield`) and the Steward's Signet (`worldImprovementYield`) load, level and host, and change nothing. | three relics' cards | [`09-relics.md`](features/09-relics.md) §2 | — |

## N · The first-time experience

New with [`22-progression.md`](features/22-progression.md),
[`23-tutorials.md`](features/23-tutorials.md) and
[`24-dialogue.md`](features/24-dialogue.md) (2026-10-01).

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-115** | **Is there enough Hero XP for the Tavern's levels to matter?** Every Tavern level adds +10% Hero XP, but the faucet is thin: lairs, dungeon rooms, the Portal and the Survey's paid column. A percentage of little is little. The natural answer is a Tavern whose **store fills with Hero XP**, the way a House fills with rent. | hero levelling, the Sagas book | [`22-progression.md`](features/22-progression.md) §6 | give the Tavern a Hero XP store |
| **OQ-116** | **Does the tree last as long as §8 says?** The prices were set against a drip of ~20 a day and the lumps; era 3 at ~750 K is about six weeks. The harness (2026-10-01) reaches Townhall 3 on day 8, 4 on day 9, 5 on 11, 6 on 12, 7 on 17 and 8 on 25 — against develop's 6 · 12 · 15 · 16 · 18 · 25 — and fails its own day-7 bound on Townhall 3 (develop already failed day 8 on Townhall 4). | research pacing, the harness's bounds | [`22-progression.md`](features/22-progression.md) §8 | re-set the harness's bounds to the new tree once a playtest agrees; move era-2 prices before the drip |
| **OQ-122** | **What does a dungeon pay beyond its rooms?** A boss pays a multiple of a room and a world relic fragment, and the first to close a dungeon is paid 2× its last boss. A found book, hero Fragments, permanent generation — or nothing more. | the reason to go to the outer ring | [`19-world-map.md`](features/19-world-map.md) §8.1 | — |
| **OQ-117** | **Is the First Morning the right length, and is idle help welcome or a nag?** Ten minutes of locked beats is at the long end for the genre; the idle thresholds (30 s, 60 s) are guesses. | the opening's retention | [`23-tutorials.md`](features/23-tutorials.md) §3, §5 | playtest; cut beats before cutting the lock |

## O · The fantasies

New with the fantasies in [`overview.md`](overview.md) (2026-10-02).

| # | Question | Blocks | Owner doc | Rec. |
|---|---|---|---|---|
| **OQ-120** | **How often, and how much, does the fog pay in treasure?** One every five cells revealed, at 120 s of production, is a guess. Too rare and the fog goes back to confirming what the player saw; too often and a chest is noise, and the fog's price curve is paid back faster than it was tuned for. | the fog's pace | [`01-map-and-fog.md`](features/01-map-and-fog.md) §6.2 | instrument treasures picked up per session in the 30-day harness |
| **OQ-121** | **Does the Survey's ladder match the pace of the fog, and what may it pay?** Its levels sit at 20 → 1,470 cells revealed, dense early and spread where the fog is dear, but how many cells a kingdom reveals a week is the harness's to say — if a level is weeks apart by month two, the ladder has stopped being a reason to explore. Its free column adds Gems and gold keys to the faucet ([`14-monetization.md`](features/14-monetization.md) §1.1), and costs $9.99 once for the whole province. | the Survey's rewards table | [`25-the-survey.md`](features/25-the-survey.md) §3 | read cells revealed per day off the 30-day harness before pricing a single rung |



---

**Closed decisions** move to [`open-questions-closed.md`](open-questions-closed.md).
