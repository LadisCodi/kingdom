# Kingdom — the design documentation

**Kingdom** is a cozy square-grid city-builder / idle-management game on a
fog-shrouded fantasy map, built for the web. **This folder is the design.** It
describes the game as currently designed — not its history, and not how it is
coded.

## Start here

| File | What it is |
|---|---|
| **[`overview.md`](overview.md)** | **The game in five minutes** — the pitch, the promises, the loops, the scopes. Read this first. |
| [`open-questions.md`](open-questions.md) | **Every decision still to make**, and every known soft spot, with a stable id (`OQ-n`) that the feature docs point at. |
| [`implementation-plan.md`](implementation-plan.md) | **What is built, what is not, and what design has to answer before the next thing can start.** |

## The design intentions

Every feature below is shaped by these.

**The three promises**

1. **No other player can ever touch your city.** The only thing that ever
   takes from you is a garrison you have seen and left standing — three raids
   per camp at most, a tenth of the purse each, and handed back in full when
   you clear it. Every other pressure is *opportunity that expires* — a pool
   that overflows, a window that closes, a haul you chose to risk.
2. **The best-managed economy wins.** Combat is a sink for the economy, not a
   test of reflexes. There is no battle screen.
3. **Wallets buy power, comfort and breadth — but never exclusivity.**
   Nothing is purchase-only that cannot also be earned, and every paid ladder
   is earned first.

**The five working rules**

1. **It is played in visits, not sittings** — ~30 minutes a day across two or
   three check-ins. **If a feature needs more, the feature is wrong.**
2. **Price every reward in a duration of the player's own production**, never in
   absolute amounts. A tap pays seconds of WORK on what you tapped; a daily
   chest pays a fraction of the pool. A ladder is relative too: a Wonder's cost
   is a curve, not a table.
3. **The offline cap limits what the city produces, never what a timer does.**
4. **Adding a wallet row needs an argument.** Ten rows, five things on the
   plank. A counter beside the thing it belongs to usually beats a coin — the
   argument that wins is that the thing is a *price* on a button, which is
   what the two gacha keys are.
5. **One job per currency.**

**The paid fog is the differentiator.** It pays back three ways: resources,
landmarks that make exploration compound, and ruins that are places you return
to ([`01`](features/01-map-and-fog.md)) — and every ruin opens with a gate
the army has to clear before the ruin pays
([`18`](features/18-garrisons-and-raids.md)).

## The features

One file per feature, in the order a player meets them.

| # | Feature | Covers | State |
|---|---|---|---|
| 1 | [The map and the fog](features/01-map-and-fog.md) | the grid, terrain, features, the three fog states, the reveal curve, what the fog holds | built |
| 2 | [Map scopes](features/02-map-scopes.md) | **structural** — the bounded province, temporary provinces as the event format, the world map as a **hex lattice** with two zoom registers and per-player fog, travel time as its pacing dial, and how much PvP the promises allow | designed |
| 3 | [The economy](features/03-economy.md) | every currency and its one job, housing taxes, adjacency, villager training, the Market, what a tap is worth | built |
| 4 | [Harvest](features/04-harvest.md) | **the cell as a depot, the tap as a duration**, the strike, migration, the map's production ceiling | built |
| 5 | [The city](features/05-city-and-districts.md) | all fourteen districts, the Townhall as era gate, cost curves, placement, moving a building; the building list is [`buildings.md`](features/buildings.md) | built |
| 6 | [Construction](features/06-construction.md) | no waiting line, builders, and the offer a refused build raises | built |
| 7 | [Research](features/07-research.md) | **three tomes — Civics, Warfare, Magic — one flow-chart page each, eras opened by exploring, minor ranks in place of upgrades, and Knowledge as the research clock**; the node list is [`tech-tree.md`](features/tech-tree.md) | built |
| 8 | [Magic](features/08-magic.md) | Mana and its cap, the Sanctum, landmarks, and the rewarded ad as one loop | built |
| 9 | [Relics](features/09-relics.md) | the five relics as **passives only**, attune-or-arm, and the **nine-piece ingredient set** | built / designed |
| 10 | [Heroes and the gacha](features/10-heroes.md) | thirty-two heroes as **a body and a type buff** on the battle board, XP-bought levels, Fragment-plus-Stardust ascension, Gem-bought hero slots, the two-banner gacha with pity and no dead pulls | gacha built; **hero reworked 2026-09-08** |
| 11 | [Ruins](features/11-expeditions.md) | ruins as **depths of numbered rooms**, opened by the Adventurers' Guild, a boss at the end of every depth, per-room rewards and permanent generation on a clear; the resolver is [`combat.md`](features/combat.md), the screens are [`11a-ruins-ui.md`](features/11a-ruins-ui.md) | delves built; **rooms designed 2026-09-08** |
| 11 | [Combat](features/combat.md) | **the resolver every fight goes through** — a deterministic tick auto-battler on a six-slot board, squads by unit type and tier, heroes and villains in slots of their own, and the event stream the renderer replays; the army cap and the four military halls | designed 2026-09-08 |
| 12 | [Quests and the daily habit](features/12-quests.md) | the 50-quest chain, the 34-quest authored onboarding, the daily chest — a 20-day season of 14 rungs, free track and Royal track | built |
| 13 | [Events](features/13-events.md) | **the archetype we author ten times a year** — points, the fog island, the track that is also the pass, the shop, the deadline | machinery built, **catalogue empty** |
| 14 | [Monetisation](features/14-monetization.md) | what a wallet may buy, five ad placements, and a **simulated** store that never charges — payer profiles with a monthly budget, Gem packs, builders, the hero banner | partly built |
| 15 | [The social layer](features/15-social.md) | identity, neighbours and capped daily help, a guild, a weekly collective bar, and the siege that clears the world map's landmarks | designed |
| 16 | [Wonders](features/16-wonders.md) | **the ladder with no top** — buildings whose upgrade curve never ends | designed |
| 17 | [Workshops and refined goods](features/17-workshops-and-goods.md) | the four goods, the four buildings that make them, and the queue a villager works — the first producer that is a crew from the start | built |
| 18 | [Harmony and the decorations](features/18-harmony.md) | the city stat six decorations supply and the levels from 8 demand — a gate, never a drain, priced in variety and the workshop queue | built, waiting on the Townhall ladder |
| 18 | [The gate](features/18-garrisons-and-raids.md) | **a garrison with a clock** — one garrison room before every ruin's Depth 1, the minute-scale counter discovery starts, the bounded and recoverable raid it makes if the gate still stands, and the room fight that clears it: the doorway to combat | built |

## Reference

Not features — how content and art are made.

| File | What it covers |
|---|---|
| [`proposals/builder-30-days.md`](proposals/builder-30-days.md) | a **proposal**, not a spec: the building content that gives the city thirty days — levels 6–10, workshops, Harmony, the Watchtower, Reliquary, Tavern and Dragon's Nest |
| [`plans/builder-30-days.md`](plans/builder-30-days.md) | the step-by-step plan for that proposal — data, then logic, then UI, per building |
| [`map-editor.md`](map-editor.md) | the `?dev=map` tool the world is painted in, and the one module that says what a legal map is |
| [`tech-tree-editor.md`](tech-tree-editor.md) | the `?dev=tree` tool technologies are created and arranged in, and the one module that says what a legal tree is |
| [`audio-wishlist.md`](audio-wishlist.md) | the sounds the build wants and what each one is for |
| [`art/ui-menus-redesign.md`](art/ui-menus-redesign.md) | the parchment-and-carved-wood UI system, its palette and its shapes |
| [`art/ui-long-game.md`](art/ui-long-game.md) | screens for the systems that arrived after the first UI pass |
| [`art/sprite-prompts.md`](art/sprite-prompts.md) | how the world and UI art was generated, and the prompts that did it |
| [`art/world-map-mockup-prompts.md`](art/world-map-mockup-prompts.md) | the world-map mockups: what two rounds of renders settled, and the three prompts |
| [`art/portraits/prompt-template.md`](art/portraits/prompt-template.md) | the hero-portrait prompt: the generic style block, the per-character block, and how to verify the alpha |

## House rules for these docs

- **These are DESIGN documents.** They specify HOW the game works. No
  implementation detail unless a decision turns on it; code-level contracts
  live in `CLAUDE.md` and in [`implementation-plan.md`](implementation-plan.md)
  §1.
- **Specification, not design process.** Write what the feature does, not why
  it does it that way, and not the alternatives that were considered.
- **The current design only.** No history: not how a feature has changed, not
  when, not why.
- **As simple as possible.** Prefer bullet lists and tables to prose. Less is
  more.
- **A feature doc opens with a scope-and-status blockquote**, uses numbered `##`
  sections referenced elsewhere as `§n`, carries a **dials table in the order to
  reach for them**, and ends with a **deliberately not in this design** list —
  one line per exclusion.
- **Open questions live in one file**, not scattered. A feature doc names them by
  id.
- **When a doc and the code disagree, the code is usually right and the doc is
  stale.** Fix the doc in the same commit, and prefer a test over a paragraph
  for any number that has now been argued twice.
- **The workbook is the source of truth for every number**, the map editor for
  the map. A doc quoting a number is a convenience, never the authority.
- **Docs are written in English.** Keep it that way.
