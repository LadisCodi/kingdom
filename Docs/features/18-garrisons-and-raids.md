# 18 · Garrisons and raids — defend your village

> **Scope.** The enemy garrison that holds every ruin and landmark, the counter
> a discovered garrison starts, the raid it makes on the city when the counter
> runs out, the home defence that meets it, and the assault that clears it.
> What a cleared site then pays is [`01-map-and-fog.md`](01-map-and-fog.md) §6
> and [`11-expeditions.md`](11-expeditions.md); the co-op siege on the world
> map is [`15-social.md`](15-social.md) §6.
>
> **Status: designed, not built.** Nothing writes a cleared flag today.

## 1. The rules, up front

1. **A garrison holds every site, the near shrine included.** Nothing at a
   guarded site can be claimed or delved until its garrison is cleared.
2. **Discovering a garrison rouses it and starts its own counter**, authored in
   minutes per site. When it runs out the garrison raids the city, and raids
   again every period until it is cleared or out of trips.
3. **A raid steals banked materials, and only materials.** Gold, Food, Wood,
   Stone. Never Gems, Mana, Knowledge, Stardust, goods, relics, heroes or units.
4. **A raid is priced in production, not in units**, capped by a fraction of the
   purse, and **a garrison makes at most three trips**, then sits on what it
   took. Bounded, and **recoverable**: clearing the garrison returns its whole
   hoard.
5. **A well-defended city is never robbed.** Home defence is deterministic; a
   garrison whose strength the home roster beats takes nothing.
6. **Defence protects; it never conquers.** Only an assault clears a garrison.
7. **Combat is the delve's scoring pass**: ATK × the type chart against a
   strength. No battle screen, no casualties, ever.
8. **The garrison's type is visible.** A camp on the surface shows what it is,
   so the assault preview is exact — win or lose, before you launch.

## 2. The garrison

- Authored **per site**, on every ruin and landmark, in `?dev=map`
  ([`../map-editor.md`](../map-editor.md)):

```
guard { threat, strength, warningMinutes, periodMinutes }
```

- `threat` is a unit type or `Any`. The creature is derived from it; there is
  no second list:

| `threat` | Reads as | Composition answer |
|---|---|---|
| Warrior | **Orcs** | Archers |
| Lancer | **Goblins** | Warriors |
| Archer | **Harpies** | Cavalry |
| Cavalry | **Wolf riders** | Lancers |
| Any | **a Drake** | none — a raw power check |

- `strength` is the number the party's effective ATK must reach
  ([`11-expeditions.md`](11-expeditions.md) §4).
- The two counters are per site because they are what tunes the experience
  site by site: a harder ruin gets a longer one.
- A site's **tier** is derived — a ruin's own tier; a landmark's from its
  claim-cost band (near I, middle II, far V) — and keys the workbook rows that
  are not per site: take seconds and assault supplies (§10).
- Recommended authoring: strength at about twice the site's depth-1 threat and
  under the army cap that opens the same delve tier
  ([`11-expeditions.md`](11-expeditions.md) §6); counters in minutes, longer
  the harder the site, so a raid reads as *this session, maybe the next*.

| Site | Guard | Strength | Warning · period | Army that beats it |
|---|---|---|---|---|
| Thorned Shrine (near) | Orcs | **2** | **30 · 30 min** | the free hero alone — the first fight |
| Hollow Barrow | Orcs | 4 | 45 · 45 min | hero + 1 Warrior |
| Middle-ring landmarks ×5 | mixed | 6–8 | 60 · 60 min | one hall L1 with the right type |
| Sunken Chapel | Harpies | 8 | 90 · 90 min | two halls (cap 16) |
| Drowned Ironworks | Goblins | 14 | 120 · 120 min | all four halls L1 (24) |
| The Counting House | Wolf riders | 22 | 180 · 180 min | all four L2 (40) |
| Far-ring landmarks ×4 | Drake | 30–36 | 240 · 240 min | all four L3 (60); no type answer |
| Star Observatory | Drake | 30 | 240 · 240 min | all four L3 (60); no type answer |

## 3. The counter

- A garrison is **roused** at the later of two moments: its site becoming
  visible (Discovered, [`01-map-and-fog.md`](01-map-and-fog.md) §4), and the
  city's **first military hall completing**. A city with no army is never
  raided: it can neither answer nor attack, so the pressure would buy nothing.
- Rousing sets `nextRaidAt = now + warningMinutes`. Each raid sets
  `nextRaidAt += periodMinutes`. Out of trips (§4) or cleared: no counter.
- **One counter per garrison.** Several may run at once; raids due at the same
  instant resolve in site order, and defenders do not tire.
- **It is a timer.** It runs and resolves in full while the player is away; the
  offline cap does not touch it ([`../implementation-plan.md`](../implementation-plan.md) §1).
- A cleared garrison is gone for good. No re-infestation.
- **Minutes, not hours.** The shrine's thirty minutes says *you have this
  session and maybe the next*. Harder sites get longer counters because the
  army they need takes longer to build, never so the raid can be waited out.
  What bounds a long absence is the trip limit (§4), not the counter.

## 4. The raid

- Resolved at `nextRaidAt` as one scoring pass.
- **Defenders** are every unit and every hero **at home**. Away means
  committed to a delve or an assault, and **a party parked at a checkpoint is
  away** ([`11-expeditions.md`](11-expeditions.md) §5).

```
defence   = effectiveAttack(home roster, threat)
shortfall = max(0, 1 − defence / strength)          # 0 → repelled
```

- **The take**, per material in Gold, Food, Wood, Stone:

```
base = cityRate × take_seconds(tier)                 # seconds of the city's own production
take = floor( min(base, banked × take_fraction_max) × shortfall )
```

- `cityRate` is the city's current production of that material — the crews'
  gather rate, plus rent for Gold. It is a fact about the city, not an
  accrual, so a raid replays identically. **They take from what you make**: a
  material the city does not produce is not taken.
- `take_fraction_max` bounds a raid on a small purse; `take_seconds` bounds one
  on a large purse.
- **Trips.** A raid that takes anything counts one trip. At `max_raids` the
  garrison stops raiding and holds its hoard. With minute-scale counters a
  garrison spends its trips inside a few hours, so the worst case of any
  absence is three raids per roused camp, each at most a tenth of the purse —
  and it all comes back when the camp is cleared (§6).
- The **hoard** is a per-garrison counter of what it has taken.
- **The decision the design wants:** units in a ruin are not at home. The free
  hero alone repels the shrine's and the Barrow's Orcs; the first raids only
  bite a city whose whole army is away.
- A raid writes a **report** — site, time, defence against strength, what was
  taken — that the widget shows until dismissed (§9).

## 5. The assault

- Launched from the raid sheet's **Defend** button (§9), which opens the
  expedition sheet in **assault mode**: hero (mandatory), party slots, the
  relic slot, supplies, and an exact read — *Wins, HP after 35 / 36*, or
  *Loses by 3 ATK* — because the threat is known.
- **Supplies** are a flat cost per tier, paid at launch.
- **Launch is the battle.** It resolves after a march of
  `BFS distance × march_seconds_per_cell`; at zero the battle resolves on
  Launch. The march is a timer. Gems finish it the way they finish a build
  *(not built)*.
- Resolution is one pass, the delve's: cleared if `attack ≥ strength` and the
  party's HP survives the damage. **The party is home the moment it resolves**;
  there is no return march.
  - **Win:** the site is cleared, its counter stops, its hoard is paid.
  - **Lose:** nothing is lost; the garrison stands. The delve's *failing costs
    the haul*, with no haul.
- Units and the hero are committed from launch to resolution: not home
  defenders, and one hero, one job — no delve while marching.
- A raid due mid-march fires with the army away; the assault still resolves on
  arrival.
- No technology gates an assault.

## 6. What clearing pays

- **The site.** A landmark becomes claimable for its Gold
  ([`01-map-and-fog.md`](01-map-and-fog.md) §6); a ruin becomes delvable.
  There is no loot table.
- **The hoard**, returned in full, banked immediately.
- Event points: a garrison cleared, a raid repelled
  ([`13-events.md`](13-events.md) §2.2).
- The `ClearGarrisons` quest goal ([`12-quests.md`](12-quests.md) §1.1).

## 7. The doorway to combat

- The first fight is **on the surface, the enemy in view, the outcome
  guaranteed.** It teaches the sheet, the type chart and the commit before the
  dungeon adds the hidden threat and the push-your-luck.
- The shrine is that fight, so the military block precedes the claim in the
  onboarding ([`12-quests.md`](12-quests.md) §2): Warrior → Barracks → first
  soldier → free summon → **`DriveThemOut`** → `OldStones`. The Barracks
  rouses the shrine two beats before the hero arrives.
- The Barrow's guard is cleared on the way to `IntoTheDark`; the quest hint
  says so.

## 8. The raid as a personal event

- The event skeleton of [`13-events.md`](13-events.md) §2.6 — a window with a
  hard deadline — with one thing said plainly: **this is the only deadline in
  the game that costs.** Bounded (§4), recoverable (§6), never a failure state.
- One widget, one number: *Orcs from the Hollow Barrow raid in 27 min.* No
  pop-up, no auto-open.

## 9. The screens

- **The raid widget** sits on the **right edge of the screen, in the slot the
  Mana-refill offer uses**, and hides behind any sheet. It shows the camp
  whose counter is nearest and its countdown, with a count when more are
  roused. After a raid it carries the report until dismissed; several raids in
  one absence are one summary. It never opens itself.
- **The raid sheet** opens from **the widget or from the garrison's site on
  the map** — one screen, two doors. Header and nav stay above it.
  - who: the creature, its type and strength, trips left, the site it holds
    and what clearing it opens;
  - the counter;
  - the stakes: what a raid would take now, and the home defence read —
    *repelled*, or *−40 %*;
  - the hoard, if any: *they hold 320 Gold and 90 Food; cleared, it comes back*;
  - **Defend**, the one big button, into the party picker (§5).
- **The map** draws a camp of the garrison's type beside its site. While a
  garrison stands, tapping the site opens the raid sheet in place of the site
  card.
- **The expedition sheet, assault mode**: the exact read, supplies, Launch.
- The defence is whatever is at home. No army tab, no defence screen beyond
  the raid sheet.

## 10. Dials, in the order to reach for them

| Dial | Recommended | Where |
|---|---|---|
| a site's guard: threat, strength, warning and period in minutes | §2 | `?dev=map` |
| take seconds per tier | 300 × tier | `Garrisons` sheet |
| take fraction max | 0.10 | `raid.take_fraction_max` |
| max raids per garrison | 3 | `raid.max_raids` |
| march seconds per cell (0: the battle resolves on Launch) | 120 | `march.seconds_per_cell` |
| assault supplies per tier | half the tier's delve supplies | `Garrisons` sheet |

## 11. Deliberately not in this design

- Casualties, on either side; escalating waves; re-infestation of a cleared site.
- An unguarded site.
- One raid clock for the whole city; counters in hours or days; a counter in
  the workbook.
- A repelled raid weakening the garrison.
- Raids on Gems, Mana, Knowledge, Stardust, goods, relics, heroes or units.
- Buying protection: a Gem shield, an ad that repels a raid, a "peace" SKU.
- A garrison that raids a city with no army.
- A base hoard, a hoard cap in production-seconds, a loot table.
- A return march; a wounded state at home.
- Workers fighting; a wall or tower district (OQ-73).
- Tree ladders that move the raid — each is a new stat in code (OQ-73).
- A creature list beside the threat type; randomness anywhere.
- A battle screen; an army nav tab; a widget that opens itself.
- Player-versus-player raiding ([`02-map-scopes.md`](02-map-scopes.md) §4).
- A technology that gates an assault (`Siegecraft` is retired).

**Open questions:** OQ-72, OQ-73, OQ-74 in
[`../open-questions.md`](../open-questions.md).
