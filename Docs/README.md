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
   it. **What a player can take from a player is ground on the world map** —
   a hex, with the district and the store on it — never the province and
   never a purse. Every other pressure is *opportunity that expires* — a pool
   that overflows, a window that closes, a haul you chose to risk.
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
   Survey purse pays minutes of Gold production. A ladder is relative too: a
   Wonder's cost is a curve, not a table.
3. **There is no offline cap.** An absence is replayed in full; what the city
   makes is bounded by what it can hold — each building's store, the Mana
   pool, the Knowledge bar, the queues.
4. **Adding a wallet row needs an argument.** Nine rows, five on the plank. A
   counter beside the thing it belongs to — hero Fragments, refined goods,
   relic fragments — or an item in the Bag — keys, speed-ups, chests —
   usually beats a coin.
5. **One job per currency.**

**The paid fog is the differentiator.** It pays back in resources,
treasures, abandoned buildings and landmarks that make exploration compound
([`01`](features/01-map-and-fog.md)) — and it hides the lairs the army has to
clear ([`18`](features/18-garrisons-and-raids.md)).

## The features

One file per feature, in the order a player meets them.

| # | Feature | Covers | State |
|---|---|---|---|
| 1 | [The map and the fog](features/01-map-and-fog.md) | the grid, terrain, features, the three fog states, the reveal price, and what the fog holds — **treasures, abandoned buildings, landmarks and lairs** | built, but for the wisps of a tear and a reveal |
| 2 | [Map scopes](features/02-map-scopes.md) | **structural** — the province, the world and the temporary province, who is authoritative over each, what the save records, and what the promises allow to be contested | the province and the world built; temporary provinces and the guild siege not built |
| 3 | [The economy](features/03-economy.md) | the nine wallet rows and the job of each, rent, building stores, adjacency, villagers, what a tap is worth | built |
| 4 | [Harvest](features/04-harvest.md) | **the cell as a depot, the tap as a duration**, the strike, migration, the map's production ceiling | built, but for the map's production census |
| 5 | [The city](features/05-city-and-districts.md) | every district, the Townhall as era gate, **every level's cost authored and priced by the building's instance ordinal**, placement, moving a building; the building list is [`buildings.md`](features/buildings.md) | built |
| 6 | [Construction](features/06-construction.md) | no waiting line, builders, and the offer a refused build raises | built |
| 7 | [Research](features/07-research.md) | **one tree, *Kingdom*, read in nine chapters** — one per Townhall step, each paying relic fragments when finished whole — and **the books found by play** (the Sagas, the Atlas); Knowledge poured into a technology, completed on the spot; the Knowledge bar; the node list is [`tech-tree.md`](features/tech-tree.md) | built, but for guild investment |
| 8 | [Magic](features/08-magic.md) | Mana and its cap, the Sanctum, landmarks, and the refill — a rewarded ad or Gems | built |
| 9 | [Relics](features/09-relics.md) | eight relics, **each restored from six fragments** and levelled with a full set again and Stardust; where fragments come from, the fragment pack, trading, and **hosting** — a city relic in a Shrine, a world relic in a Chapel | built; three world relics move numbers nothing reads yet |
| 10 | [Heroes and the gacha](features/10-heroes.md) | thirty-two heroes as **a body, a type buff and a skill** on the battle board, boons for Legendaries, Hero XP levels, Fragment-and-Stardust ascension, HP and rest, Gem-bought hero slots, two banners called with silver and gold keys, with pity and no dead pulls | built |
| 11 | [Dungeons](features/11-expeditions.md) | **depths of numbered rooms** on the world board, a boss at the end of every depth, per-room rewards; the first to beat the last boss closes it for everyone; the resolver is [`combat.md`](features/combat.md) | built as 3 depths × 8 rooms; supplies, boss chests and permanent generation not built |
| 11a | [Dungeons — the screens](features/11a-ruins-ui.md) | the battle screen, the playback, and the room screens | partly built |
| — | [Combat](features/combat.md) | **the resolver every fight goes through** — a deterministic tick auto-battler on a six-slot board, squads by unit type and rank, heroes and villains in slots of their own, and the event stream the renderer replays; the army cap, the four training halls and troop evolutions. **The resolver lairs, dungeons and the world map all call** | built, but for authored boss formations and villains in a dungeon's standard room |
| — | [Buildings](features/buildings.md) | **the building list** — every district, its levels, the workshops, the decorations | built; Wonders not built |
| — | [The tech tree](features/tech-tree.md) | **the node list** — every technology by chapter and book, generated from the tree file | built |
| 12 | [Quests and onboarding](features/12-quests.md) | the quest chain and the authored onboarding it carries | built |
| 13 | [Events](features/13-events.md) | **the archetype authored ten times a year** — points, the fog island, the track, the shop, the deadline — and the scheduling machinery under it | machinery built, **catalogue empty**; the archetype designed |
| 14 | [Monetisation](features/14-monetization.md) | what a wallet may buy, and a **simulated** store that never charges — payer profiles with a monthly budget, Gem packs, Bag bundles, offers and daily offers, the Survey's paid column; the Gem sinks; rewarded video; the funnel | built, but for the cosmetic probe and three of the six ad placements |
| 15 | [The social layer](features/15-social.md) | identity, the friends list, the crest, the Inbox, **the wish board** where friends trade fragments, daily help; a guild, its weekly bar, and the siege | friends, crest, Inbox, wish board and daily help built; the guild designed |
| 16 | [Wonders](features/16-wonders.md) | **the ladder with no top** — buildings whose upgrade curve never ends | designed |
| 17 | [Workshops and refined goods](features/17-workshops-and-goods.md) | the four refined goods, the four workshops that make them, and the queue a villager works | built |
| 18 | [Lairs and raids](features/18-garrisons-and-raids.md) | **a monster camp with a clock** — the province's lairs: the counter revealing its ground starts, three bounded and recoverable raids a day while it stands, the ground it denies, and the three to seven fights that clear it for good: the doorway to combat | built |
| 19 | [The world map](features/19-world-map.md) | **the shared board** — seven boards of six seats, 889 hexes, 41 other kingdoms or stand-in rivals; explorers that march to reveal, districts and their stores, chains and inactive hexes, conquest against denial, the Fortress, monster camps, dungeons, Sanctuaries, Observatories and precious deposits, and the weekly Dark Portal | built on the world server; the season not built |
| 21 | [Harmony and the decorations](features/21-harmony.md) | the city stat eleven decorations supply and the levels from 8 demand — a gate, never a drain | built |
| 22 | [Progression](features/22-progression.md) | **how the game opens up** — the doors and what opens each, the chapters of the tree and the found books, the Orcs, the Thorned Shrine and the Watchtower as places that open mechanics, heroes by story then by the Tavern, and the pace of the tree | built |
| 23 | [Tutorials](features/23-tutorials.md) | the **First Morning** — ten scripted minutes, beat by beat — then one introduction per system, help when stuck, and the input lock | built |
| 24 | [Dialogue](features/24-dialogue.md) | the **visual-novel stage** every tutorial speaks through: a character each side, a box that can sit anywhere, the pointer, the conditions, and the cast led by **Isolde, the Royal Advisor** | built |
| 25 | [The Survey](features/25-the-survey.md) | **a ladder that pays for exploring** — 36 levels over the whole province, climbed by cells revealed, a free column and a paid one bought once; never resets | built, but for the seal that flies to the pill |
| 26 | [Notices](features/26-notices.md) | **the bubbles in the corner** — news and standing states for what the player may not have seen, in the province and on the board, each a card with a way to go there | built |
| 27 | [Plantables](features/27-plantables.md) | **editing the ground** — crop plots planted from the Build menu as features, and trees and plots moved with a long press, growing again where they land | built |
| 28 | [Languages](features/28-languages.md) | **English and Spanish** — the choice in Settings, the code's text through `tr()`, the data's through overlays, numbers in the language's locale | built |

## Reference

Not features — how the game is tested, built and authored.

| File | What it covers |
|---|---|
| [`playtest.md`](playtest.md) | **how a playtest checks the fantasy**: the moments each fantasy is pinned to, what to watch, the five questions to ask after, how to read the numbers, and the signals the log carries |
| [`dev-saves.md`](dev-saves.md) | how to put the game into a late state on purpose, to look at screens a new save never shows |
| [`map-editor.md`](map-editor.md) | the map editor (`?dev=data#map`) the province is painted in, and the one module that says what a legal map is |
| [`tech-tree-editor.md`](tech-tree-editor.md) | the tech tree editor (`?dev=data#tree`) technologies are created and arranged in, and the one module that says what a legal tree is |
| [`audio-wishlist.md`](audio-wishlist.md) | the sound map: every sound the build plays and what it is for |

**Plans** — the steps from what was built to a design.

| File | What it covers |
|---|---|
| [`plans/data-editor.md`](plans/data-editor.md) | `?dev=data`, the tool every piece of game data is authored in: its collections, views and navigation, the files it saves, and the module that says what legal data is |
| [`plans/analytics.md`](plans/analytics.md) | what the game sends the server about how it is played — the events, how they are sent, and the views they are read from |
| [`plans/online-server.md`](plans/online-server.md) | the world server and the cloud save on Supabase, then the social layer; the protocol every world request follows |
| [`plans/world-districts.md`](plans/world-districts.md) | districts on the radius-6 world board, and the art they need |
| [`plans/world-hex-art.md`](plans/world-hex-art.md) | how a hex of the world board is drawn — terrain, feature, district, Fortress, roads |
| [`plans/precious-deposits.md`](plans/precious-deposits.md) | the precious deposits, and a world of many boards |
| [`plans/tech-tree-rework.md`](plans/tech-tree-rework.md) | research as one tree in chapters, one per Townhall step |
| [`plans/relics-and-bag.md`](plans/relics-and-bag.md) | the Bag, and relics restored from fragments and hosted in Shrines and Chapels |
| [`plans/review-readiness.md`](plans/review-readiness.md) | what is left before the studio's prototype review: the decisions the checklist asks for, the builds still missing, and where each answer comes from |
| [`plans/ux-pass.md`](plans/ux-pass.md) | usability fixes found playing on a phone as a free player — one branch each, with what was seen, the rule, where it lives and when it is done |

**Proposals** — not specs. Where one was adopted, the feature doc it names is the authority.

| File | What it covers |
|---|---|
| [`proposals/builder-30-days.md`](proposals/builder-30-days.md) | the building content that gives the city thirty days — levels 6–10, workshops, Harmony, the Watchtower, Tavern and Dragon's Nest |
| [`proposals/lairs.md`](proposals/lairs.md) | the province's lairs — a monster camp found by revealing its ground, that raids on a clock, denies a radius of ground, and is cleared once |
| [`proposals/world-dynamics.md`](proposals/world-dynamics.md) | a living world map — monster camps, scouting rewards shown before exploring, precious materials only the world yields, and the delve screen |
| [`proposals/inventory.md`](proposals/inventory.md) | the Bag: one place for everything owned that is not a currency or a building |
| [`proposals/relic-restoration.md`](proposals/relic-restoration.md) | relics found as fragments, restored, hosted in Shrines and Chapels, and traded |
| [`proposals/relic-effects.md`](proposals/relic-effects.md) | what each relic does, level by level |
| [`proposals/friend-trading.md`](proposals/friend-trading.md) | trading between friends on a wish board |
| [`proposals/legendary-boons.md`](proposals/legendary-boons.md) | one kingdom passive per Legendary hero |
| [`proposals/hero-abilities.md`](proposals/hero-abilities.md) | a skill per hero and villain, ranked up with Stardust |
| [`proposals/isolde-voice.md`](proposals/isolde-voice.md) | a script pass on the opening's scene lines |
| [`proposals/world-menus.md`](proposals/world-menus.md) | every menu of the world board, rebuilt from the city's UI pieces |

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
| [`art/ui/mockups/`](art/ui/mockups) | the full-screen UI mockups and the prompts that made them — the authority for the chrome's layout, colour and shapes | **current** |
| [`art/ui-menus-redesign.md`](art/ui-menus-redesign.md) | the UI system the mockups implement, its palette and its shapes | current, but its style anchor is stale |
| [`art/ui-long-game.md`](art/ui-long-game.md) | screens for the systems that arrived after the first UI pass | current |
| [`art/ui-inventory.md`](art/ui-inventory.md) | the Bag's screens: its tabs, the tile, the popover, and using an item without opening it | current |
| [`art/ui-relics.md`](art/ui-relics.md) | a relic's sheet, the Shrine on the map, the Chapel on the world board, and trading | current |
| [`art/unit-icons.md`](art/unit-icons.md) | the round portrait every unit wears in the UI | current |
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
