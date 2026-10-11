# Plan — the Bag, relics found and hosted

> **What this is.** The steps from today's relics (a card season levelling
> kingdom-wide passives) to the design of
> [`../proposals/inventory.md`](../proposals/inventory.md) and
> [`../proposals/relic-restoration.md`](../proposals/relic-restoration.md):
> a Bag of items, relics restored from fragments and hosted in Shrines and
> Chapels, trading, and the Excavation. The screens are
> [`../art/ui-inventory.md`](../art/ui-inventory.md) and
> [`../art/ui-relics.md`](../art/ui-relics.md); the mockups M67–M72 are in
> [`../art/ui/mockups/`](../art/ui/mockups).
>
> **Status: steps 0–4 built** (PRs #149–#156, 2026-10-05): the Bag, speed-ups
> (city and world), boosts, flasks, tomes, the choice chest, the shortfall
> sheet, one reward path, keys in the Bag, items as rewards, the store's
> item bundles. Step 5 waits on the Gem faucet (§6). The world's `hurry`
> command ships with the next release's server deploy.

## 1. Steps

Each step is a branch and a PR into `develop`, and leaves the game playable.

| # | Step | What changes | Screens |
|---|---|---|---|
| 0 | **Groundwork** | no behaviour change: what the city makes of each coin a second in `sim/production.ts`; the 28-day clock in `sim/seasonClock.ts`, its length in the pass; the hero tier and XP numbers in their own collection, `heroLadder` | — |
| 1 | **The Bag** | `state.bag` (item id → count); the `items` collection in `?dev=data`; Use / Use ×N as commands at `t`; resource chests valued at use from `cityMakesPerSecond`; a `bag` door and a Bag tab on the nav, beside Relics until step 5 | §3.1–§3.4, M69 |
| 2 | **Speedups** | typed speedups (General, Construction, Training, Workshop) shortening a queue item, a training line, a workshop item, an explorer or a world build at `t`; the Speed-up picker on every timer, Auto, Gems last | §3.5, §3.7, M70, M71 |
| 3 | **Boosts, flasks, tomes, the choice chest, the shortfall sheet** | boosts as modifiers that extend, never stack; the shortfall sheet replaces the coin refusal toast for builds, upgrades and training | §3.8–§3.10 |
| 4 | **Items as rewards** | one grant path (`sim/rewards.ts`) that every source pays through; fog treasures, lairs, quests, the Survey, the pass and the store pay items; the store's item bundles; keys moved from the wallet to the Bag | — |
| 5 | **Fragments and restoration** | each relic whole in its data: kind (city / world), family, sources, level costs, passive, active; fragments and spares in `state.relics`, found and bound counted apart, shown in the Bag; Restore, Level up, replicas, Dowser's maps; the card season, packs, stars, vault and wildcards removed | relic sheet (`ui-relics` §2), M72, M67 lower panel |
| 6 | **Shrines** | one shrine ruin on the map (`?dev=data#map`), repaired into a movable 2×2 Shrine; four premium Shrines for Gems; +10 max Mana each; Harmony supply; a hosted city relic's passive over the aura; actives cast on the aura, ended by a move | `ui-relics` §3 |
| 7 | **Chapels** | the second district upgrade; world relic passives and actives resolved by the world server; the relic goes home on a conquest or denial | `ui-relics` §4 |
| 8 | **Trading** | the wanted board and envoys, a server mutation on the model of daily help; bound fragments refused | `ui-relics` §5 |
| 9 | **The Excavation** | the event archetype's first content: a shared fog island on the board, tools, three ladders | `ui-relics` §6, M68 |
| 10 | **Docs** | `09-relics.md` rewritten from the proposal; `08`, `14`, `19`, `21`, `implementation-plan.md`; the proposals retired | — |

- **Step 0 changes nothing a player sees**: it moves what step 5 deletes
  out of the way.
- **Steps 1–4 stand alone**: the Bag is useful before relics change.
- **Step 5 is the break**: from it, the old collection is gone, and the
  Relics tab leaves the nav for the Bag's own.

## 2. Engine rules each step keeps

- **A Use is a command at `t`.** A speedup moves the item's absolute end, a
  chest lands now, a boost starts now: nothing reads a clock, and the offline
  replay still equals stepped ticking.
- **A chest's amount is read at use**, from the city's rates at `t`.
- **A boost is a modifier** (it happened and expires). **A hosted relic's
  passive is not**: it is a fact about the kingdom, so it resolves as its own
  stage, **base → technologies → relic auras → modifiers**. Overlapping auras
  of one relic take the strongest.
- **A speedup never gives time away**: an item it finishes completes at
  `t`, and the next one in its line starts at `t`, never earlier.
- **Workshops have no end**, only work done: a workshop speedup adds the
  crew's work at `t` for its duration, up to what the item needs.
- **Every change to an aura is repriced**: hosting, swapping, moving or
  levelling a Shrine runs inside `repriceTaxAnchorAround`, since rent is
  priced house by house.
- **Moving and building are separate facts**: a Shrine is never built for
  Gold, and still moves.
- **Rolls are counter/hash** on the event that paid them: a fragment from a
  treasure keys on that treasure, never on the moment.
- **Every number is data** in `?dev=data`: `items`, `relics`, the shrine
  sites on the map; what a legal document is goes in `dataRules.ts`.
- **World relics are server state.** Chapel hosting, its passive and active,
  envoys and the Excavation's shared dig go through `handleWorld`;
  `npm run server:bundle` and the release rule apply.

## 3. Saves

- Steps 1–3 are **additive**: `bag` defaults empty; a version bump, no
  migrator.
- Step 4 **moves the keys**: Silver and Gold keys in the player's wallet
  convert to the same count in the Bag.
- Step 5 is a **semantic change** and needs a migrator: the live season's
  cards and packs convert to fragments of the relics they belonged to; relic
  levels carry over as restored relics at the same level, unhosted.
- Step 6 converts **claimed shrine landmarks** into Shrines, keeping the
  +10 max Mana of each.

## 4. Gates

| Step | Done when |
|---|---|
| 0 | every suite green with no test changed but imports |
| 1 | a chest used at two Townhall levels pays two different amounts; Use ×N equals N single uses |
| 2 | a speedup used during an absence's replay ends the item at the same `t` as when used live; Auto never wastes more than the smallest size |
| 3 | two Rent boosts extend, never stack; the shortfall sheet's Use starts the build when the shortfall is met |
| 5 | an old save loads with every relic level intact, unhosted; six distinct fragments restore, spares level |
| 6 | a house inside two Ledger auras gets the stronger, not the sum; moving a Shrine ends its active and keeps the cooldown |
| 7 | a conquered Chapel's relic is back in its owner's Bag, at its level, on the next load |
| 8 | a bound fragment cannot be sent; the daily cap holds against a client that sends twice |
| 9 | a cell dug by one player is dug for the other five at their next load |

## 5. Decided

- **Shrines**: five in all — one ruin found in the province, four premium
  for Gems (`premiumShrines` = 4).
- **Landmarks keep their +10 max Mana**: Standing Stones, Leysprings and the
  Watchtower still raise the cap when claimed; a Shrine adds its own.
- **Fragments are `state.relics`**, not Bag entries: found and bound are
  counted apart; the Bag only shows them.
- **March speedups are deferred**: armies have no rush and their time is
  server state.

## 6. Blocked on

- Step 5: **the Gem faucet's total** (`relic-restoration.md` §12).
- Step 6: what the three other shrine landmarks a save has claimed become.
- Step 9: **the event archetype** (`implementation-plan.md` Step 3, OQ-18,
  OQ-19).
- Steps 7–9: **OQ-3**, the world season.

## 7. Deliberately not in this plan

- Art for the items: the mockups' icons are placeholders until an icon sheet
  is generated (`ui-menus-redesign.md` §7.18).
- Shields, teleports, research speedups.
- March speedups (§5).
