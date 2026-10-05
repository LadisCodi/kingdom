# Kingdom — the design documentation

**Kingdom** is a **4X for people who bounce off 4X** — a city-builder on a
fog-shrouded province that opens onto a hex world shared with other players,
built for the web. **This folder is the design.** It describes the game as
currently designed — not its history, and not how it is coded.

## Start here

| File | What it is |
|---|---|
| **[`overview.md`](overview.md)** | **The game in five minutes** — the pitch, the promises, the loops, the scopes. Read this first. |
| [`open-questions.md`](open-questions.md) | **Every decision still to make**, and every known soft spot, with a stable id (`OQ-n`) that the feature docs point at. |
| [`open-questions-closed.md`](open-questions-closed.md) | The decisions already taken, and why. The ledger, never the authority. |
| [`implementation-plan.md`](implementation-plan.md) | **What is built, what is not, and what design has to answer before the next thing can start.** |

## The design intentions

Every feature below is shaped by these.

**The three promises**

1. **Your city can never be attacked. Everything outside it can be.** The
   province is inviolable. The only thing that ever takes from it is a lair
   you have found and left standing — three raids a day from the buildings'
   stores, never the wallet, and what it carries handed back when you clear
   it. **What a player
   can take from a player is territory**: a claimed hex on the world map, never
   a building and never a purse. Every other pressure is *opportunity that
   expires* — a pool that overflows, a window that closes, a haul you chose to
   risk.
2. **The best-managed economy wins.** Combat is a sink for the economy, not a
   test of reflexes. A fight is composed, never played.
3. **Wallets buy power, comfort and breadth — but never exclusivity.**
   Nothing is purchase-only that cannot also be earned, and every paid ladder
   is earned first.

**The five working rules**

1. **It is played in visits, not sittings** — ~30 minutes a day across two or
   three check-ins. **If a feature needs more, the feature is wrong.**
2. **Price every reward in a duration of the player's own production**, never in
   absolute amounts. A tap pays seconds of WORK on what you tapped; a
   Survey chest pays hours of production. A ladder is relative too: a Wonder's cost
   is a curve, not a table.
3. **There is no offline cap.** An absence is replayed in full; what the city
   makes is bounded by what it can hold — each building's store, the Mana
   pool, the Knowledge bar, the queues.
4. **Adding a wallet row needs an argument.** Eleven rows, five things on the
   plank. A counter beside the thing it belongs to usually beats a coin — the
   argument that wins is that the thing is a *price* on a button, which is
   what the two gacha keys are.
5. **One job per currency.**

**The paid fog is the differentiator.** It pays back in resources,
treasures, abandoned buildings and landmarks that make exploration compound
([`01`](features/01-map-and-fog.md)) — and it hides the lairs the army has to
clear ([`18`](features/18-garrisons-and-raids.md)).

## The features

One file per feature, in the order a player meets them.

| # | Feature | Covers | State |
|---|---|---|---|
| 1 | [The map and the fog](features/01-map-and-fog.md) | the grid, terrain, features, the three fog states, the reveal curve, what the fog holds — **treasures and abandoned buildings** | built, but for the wisps of a tear and a reveal |
| 2 | [Map scopes](features/02-map-scopes.md) | **structural** — the three scopes, who is authoritative over each, what the save records, and what the promises allow to be contested | the province built; the world board built against a local stand-in; temporary provinces and the guild siege not built |
| 3 | [The economy](features/03-economy.md) | every currency and its one job, housing taxes, adjacency, villager training, what a tap is worth | built |
| 4 | [Harvest](features/04-harvest.md) | **the cell as a depot, the tap as a duration**, the strike, migration, the map's production ceiling | built |
| 5 | [The city](features/05-city-and-districts.md) | every district, the Townhall as era gate, **every level's cost authored and multiplied by the building's instance ordinal**, placement, moving a building; the building list is [`buildings.md`](features/buildings.md) | built |
| 6 | [Construction](features/06-construction.md) | no waiting line, builders, and the offer a refused build raises | built |
| 7 | [Research](features/07-research.md) | **spellbooks — three general ones (Civics, Warfare, Magic) plus books the player FINDS (the Sagas, the Atlas)**, each opened by a fact about the world — one flow-chart page each, eras opened by exploring, climbing bonuses only, and Knowledge as the research clock; the node list is [`tech-tree.md`](features/tech-tree.md) | built |
| 8 | [Magic](features/08-magic.md) | Mana and its cap, the Sanctum, landmarks, and the rewarded ad as one loop | built |
| 9 | [Relics and the collection](features/09-relics.md) | eight relics as **permanent passives with no ceiling**, levelled by **card albums in a 28-day shared season** — packs, duplicates, the vault, trading, wildcards, the season hero | built; trading and the season hero's rate-up not built |
| 10 | [Heroes and the gacha](features/10-heroes.md) | thirty-two heroes as **a body and a type buff** on the battle board, XP-bought levels, Fragment-plus-Stardust ascension, Gem-bought hero slots, the two-banner gacha with pity and no dead pulls | built |
| 11 | [Ruins](features/11-expeditions.md) | **depths of numbered rooms**, a boss at the end of every depth, per-room rewards — the world board's dungeons; the resolver is [`combat.md`](features/combat.md) | built on the world board as 3 depths × 8 rooms; supplies, boss chests and permanent generation not built |
| 11a | [Ruins — the screens](features/11a-ruins-ui.md) | the battle screen, the playback, and the room screens | partly built |
| — | [Combat](features/combat.md) | **the resolver every fight goes through** — a deterministic tick auto-battler on a six-slot board, squads by unit type and tier, heroes and villains in slots of their own, and the event stream the renderer replays; the army cap and the four military halls. **The resolver 11, 18 and the world map all call** | built; unit tiers T2–T5 not built |
| — | [Buildings](features/buildings.md) | **the building list** — every district, its levels, the late ladder, the decorations | built; Wonders not built |
| — | [The tech tree](features/tech-tree.md) | **the node list** — every technology by book and era, generated from the tree file | built |
| 12 | [Quests and onboarding](features/12-quests.md) | the quest chain and the authored onboarding it carries | built |
| 13 | [Events](features/13-events.md) | **the archetype we author ten times a year** — points, the fog island, the track that is also the pass, the shop, the deadline | machinery built, **catalogue empty** |
| 14 | [Monetisation](features/14-monetization.md) | what a wallet may buy, six ad placements, and a **simulated** store that never charges — payer profiles with a monthly budget, Gem packs, builders, the hero banner | partly built |
| 15 | [The social layer](features/15-social.md) | identity, neighbours and capped daily help, a guild, a weekly collective bar, and the siege that clears the world map's landmarks | designed |
| 16 | [Wonders](features/16-wonders.md) | **the ladder with no top** — buildings whose upgrade curve never ends | designed |
| 17 | [Workshops and refined goods](features/17-workshops-and-goods.md) | the four goods, the four buildings that make them, and the queue a villager works — the first producer that is a crew from the start | built |
| 18 | [The gate](features/18-garrisons-and-raids.md) | **a garrison with a clock** — the province's lairs: the minute-scale counter discovery starts, the bounded and recoverable raids it makes while it stands, and the fight that clears it: the doorway to combat | built |
| 19 | [The world map](features/19-world-map.md) | **the shared board** — 91 hexes and six players in rings around the Dark Portal, explorers that march to reveal, connection chains and inactive hexes, conquest against denial, the Fortress, dungeons, and the weekly Portal dive | built against a local stand-in for the world server |
| 20 | [The season pass](features/20-season-pass.md) | **a ladder that pays for playing** — 40 levels on the collection's 28-day clock, two reward columns, and the eight generated missions that are the only thing that climbs it; the Survey pays for exploring, this pays for playing | built |
| 21 | [Harmony and the decorations](features/21-harmony.md) | the city stat six decorations supply and the levels from 8 demand — a gate, never a drain, priced in variety and the workshop queue | built |
| 22 | [Progression](features/22-progression.md) | **how the game opens up** — the doors and what opens each, the five books and the milestones that open them, the Orcs, the Thorned Shrine and the Watchtower as places that open mechanics, heroes by story then by the Tavern, the first pack, and the pace of the tree | built |
| 23 | [Tutorials](features/23-tutorials.md) | the **First Morning** — ten scripted minutes, beat by beat — then one introduction per system, help when stuck, and the input lock | built |
| 24 | [Dialogue](features/24-dialogue.md) | the **visual-novel stage** every tutorial speaks through: a character each side, a box that can sit anywhere, the pointer, the conditions, and the cast led by **Isolde, the Royal Advisor** | built |
| 25 | [The Survey](features/25-the-survey.md) | **a ladder that pays for exploring** — 36 levels over the whole province, climbed by cells revealed, a free column and a paid one bought once; never resets | built, but for the seal that flies to the pill |

## Reference

Not features — how content and art are made.

| File | What it covers |
|---|---|
| [`playtest.md`](playtest.md) | **how a playtest checks the fantasy**: the moments each fantasy is pinned to, what to watch, the five questions to ask after, and how to read the numbers |
| [`proposals/builder-30-days.md`](proposals/builder-30-days.md) | a **proposal**, not a spec: the building content that gives the city thirty days — levels 6–10, workshops, Harmony, the Watchtower, Reliquary, Tavern and Dragon's Nest |
| [`proposals/collection-packs.md`](proposals/collection-packs.md) | a **proposal**, not a spec: six packs defined by the rarity they guarantee, three vault chests duplicates buy, what a duplicate is worth, and where each falls — with every figure measured by simulation against the authored odds |
| [`proposals/album-cycles.md`](proposals/album-cycles.md) | a **proposal**, not a spec: how a relic's level advances — running the five albums again inside a season (which needs the nine cards SPENT, or the loop never terminates), and rotating which relic each album levels so the two dearest ones are not unreachable for ever |
| [`proposals/relic-effects.md`](proposals/relic-effects.md) | a **proposal**, not a spec: what each relic does, level by level — the five that exist and the **three that have to be created** for the eight albums — a passive that never stops being worth having, and an active that is a placed ZONE on a cooldown, with exactly one of its four numbers growing with the relic's level |
| [`proposals/legendary-boons.md`](proposals/legendary-boons.md) | a **proposal**, not a spec: one kingdom passive per Legendary hero, spread across economy, research, exploration and combat, so a Legendary is a different kind of thing to own rather than a bigger number |
| [`proposals/world-dynamics.md`](proposals/world-dynamics.md) | a **proposal**, not a spec: a living world map — monster camps to beat before building, scouting rewards shown before exploring, three precious materials only the world yields, and a delve screen that sells the descent, with mockups |
| [`proposals/lairs.md`](proposals/lairs.md) | a **proposal**, not a spec: the province's ruins become **lairs** — a monster camp found by revealing its ground, that raids the city on a clock, denies a radius of ground, and is cleared once by one fight and gone; the repeatable dungeon moves to the world map |
| [`plans/world-districts.md`](plans/world-districts.md) | the steps from the world board as built — radius 5, two features a hex, an Outpost then an improvement — to districts on a radius-6 board, and the art they need |
| [`plans/online-server.md`](plans/online-server.md) | the steps from the local world stand-in and the cloud save to a real Supabase server, then the social layer; the protocol every world request follows |
| [`plans/data-editor.md`](plans/data-editor.md) | `?dev=data`, the tool every piece of game data is authored in: its collections, views and navigation, the files it saves, and the module that says what legal data is |
| [`map-editor.md`](map-editor.md) | the map editor (`?dev=data#map`) the world is painted in, and the one module that says what a legal map is |
| [`tech-tree-editor.md`](tech-tree-editor.md) | the tech tree editor (`?dev=data#tree`) technologies are created and arranged in, and the one module that says what a legal tree is |
| [`audio-wishlist.md`](audio-wishlist.md) | the sounds the build wants and what each one is for |

## Art

**The style is stylized 3D, not pixel art.** The anchor is
[`art/style-reference.png`](art/style-reference.png) — a bright isometric
diorama under a midday sun — the prompt that produces it is
[`art/style-prompt.md`](art/style-prompt.md), and what to point that prompt at
is [`art/art-direction.md`](art/art-direction.md). The chrome is a separate
discipline and is settled; the world is what the direction covers.

| File | What it covers | State |
|---|---|---|
| [`art/art-direction.md`](art/art-direction.md) | **how every asset of the WORLD is made** — the 2:1 isometric projection, canvas sizes and anchors, terrain, buildings, units, the hex board, the map's states, and the pipeline | **current** |
| [`art/style-prompt.md`](art/style-prompt.md) | **the locked visual style block**, and the prompt every new asset is generated from | **current** |
| [`art/ui/mockups/`](art/ui/mockups) | 26 full-screen UI mockups in the right style — the authority for the chrome's layout, colour and shapes | **current** |
| [`art/ui-menus-redesign.md`](art/ui-menus-redesign.md) | the UI system the mockups implement, its palette and its shapes | current, but its style anchor is stale |
| [`art/ui-long-game.md`](art/ui-long-game.md) | screens for the systems that arrived after the first UI pass | current |
| [`art/portraits/prompt-template.md`](art/portraits/prompt-template.md) | the hero-portrait prompt: the generic style block, the per-character block, and how to verify the alpha | current — generated against `style-reference.png` |
| [`art/originals/v3-sheets/`](art/originals/v3-sheets) | the generation log and the two normalisation scripts, kept because trimming and padding survive a style change | current |

> The pixel-art era — the bought UI pack, three generations of source sheets and
> the two old style references — lives on the **`archive/pixel-art-era`** branch.
> Recover a file with
> `git checkout archive/pixel-art-era -- <path>`.

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
- **`?dev=data` is the source of truth for every number**, the map and the
  tech tree included. A doc quoting a number is a convenience, never the
  authority.
- **Docs are written in English.** Keep it that way.
