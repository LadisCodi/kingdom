# 18 · The gate — a garrison with a clock

> **Scope.** The garrison that holds every ruin's entrance, the counter that
> starts when the ruin is discovered, the raid it makes on the city when the
> counter runs out, and the room fight that clears it. The ruin behind the gate
> is [`11-expeditions.md`](11-expeditions.md); the fight is
> [`combat.md`](combat.md); the screens are [`11a-ruins-ui.md`](11a-ruins-ui.md).
>
> **Status: built 2026-09-09.** The clock, the raid, the hoard, the fight and
> the screens all ship. The fight resolves on the delve's scoring pass
> ([`11-expeditions.md`](11-expeditions.md) §5) until the tick resolver
> ([`combat.md`](combat.md)) lands; `power` is the number it is scored
> against either way.

## 1. The rules, up front

1. **Every ruin opens with a gate**: one garrison, one room, before Depth 1.
   Nothing in the ruin can be entered until the gate is cleared.
2. **The gate is a room on the surface.** It is generated from its `guard` the
   way a room is generated from its budget, and clearing it is a room attempt
   like any other — the player attacks, the enemy never does.
3. **Discovering the ruin starts the gate's counter**, authored in minutes.
   When it runs out the garrison raids the city, and raids again every period
   until the gate is cleared or the garrison is out of trips.
4. **A raid is not a fight.** Nothing defends. The garrison takes, the city
   keeps what it makes, and the only answer is to go and clear the gate.
5. **A raid steals banked materials, and only materials.** Gold, Food, Wood,
   Stone. Never Gems, Mana, Knowledge, Stardust, Hero XP, goods, relics, heroes
   or units.
6. **A raid is priced in production, not in units**, capped by a fraction of the
   purse, and **a garrison makes at most three trips**, then sits on what it
   took. Bounded, and **recoverable**: clearing the gate returns its whole
   hoard.
7. **The gate is the incentive, not the punishment.** It is a small personal
   event with a clock, whose whole job is to send the player into the ruin.

## 2. The gate

- Authored **per ruin**, in `?dev=map` ([`../map-editor.md`](../map-editor.md)):

```
guard { threat, power, warningMinutes, periodMinutes }
```

- `threat` is a unit type or `Any`. The creature is derived from it; there is
  no second list:

| `threat` | Reads as | `threat_mix` | Composition answer |
|---|---|---|---|
| Warrior | **Orcs** | all Warrior | Archers |
| Lancer | **Goblins** | all Lancer | Warriors |
| Archer | **Harpies** | all Archer | Cavalry |
| Cavalry | **Wolf riders** | all Cavalry | Lancers |
| Any | **a Drake** | even across the four | none — a raw power check |

- `power` is what the party has to beat: its attack after the type chart,
  scored against this number. It is on the same scale as a room's `power_req`
  ([`11-expeditions.md`](11-expeditions.md) §6), so when the resolver arrives
  the same figure becomes the budget the generator spends on squads, seeded
  from the ruin id ([`combat.md`](combat.md) §11). Same ruin, same gate, every
  time.
- **The gate's `threat` is the ruin's affinity**, so the first fight teaches
  the matchup the whole ruin is built on.
- **Recommended `power`: below the ruin's `power_start(D1)`.** The gate is
  easier than the first room, because it is the room the player is pushed
  into on a clock.
- The two counters are per ruin: a harder ruin gets a longer one, because the
  army it needs takes longer to build.
- A ruin's **tier** keys the workbook rows that are not per site: take seconds
  and gate supplies (§8).

| Ruin | Gate | `power` | Enemies | Warning · period | Board that beats it |
|---|---|---|---|---|---|
| Hollow Barrow | Orcs | **60** | **20** | **30 · 30 min** | the company the chain musters — 24 soldiers and the free hero |
| Sunken Chapel | Harpies | 144 | 24 | 90 · 90 min | a company that answers Archers |
| Drowned Ironworks | Goblins | 250 | 50 | 120 · 120 min | fifty-odd, well matched |
| The Counting House | Wolf riders | 500 | 71 | 180 · 180 min | a hundred, or seventy that answer Cavalry |
| Star Observatory | Drake | 1,000 | 211 | 240 · 240 min | a full board; no type answer |

- **`power` is a budget in troops' worth, and the count is what the player
  sees**: the generator spends it on `power_per_troop`, so twenty orcs is 20 ×
  3 (§2, [`combat.md`](combat.md) §5).
- Every one of them is under the strength of the ruin's own first depth, and
  `tests/gates.test.ts` holds them there.

## 3. The counter

- The counter starts the moment the ruin is **discovered**
  ([`01-map-and-fog.md`](01-map-and-fog.md) §4): `nextRaidAt = discoveredAt +
  warningMinutes`. Each raid sets `nextRaidAt += periodMinutes`. Cleared, or
  out of trips: no counter.
- **One counter per gate.** Several may run at once; raids due at the same
  instant resolve in ruin order.
- **It is a timer.** It runs and resolves in full while the player is away; the
  offline cap does not touch it ([`../implementation-plan.md`](../implementation-plan.md) §1).
- A cleared gate is gone for good. No re-infestation.
- **Minutes, not hours.** The Barrow's thirty minutes says *you have this
  session and maybe the next*. What bounds a long absence is the trip limit
  (§4), not the counter.

## 4. The raid

- Resolved at `nextRaidAt`, with no fight. **The take**, per material in Gold,
  Food, Wood, Stone:

```
base = cityRate × take_seconds(tier)                 # seconds of the city's own production
take = floor( min(base, banked × take_fraction_max) )
```

- `cityRate` is the city's current production of that material — the crews'
  gather rate, plus rent for Gold. It is a fact about the city, not an
  accrual, so a raid replays identically. **They take from what you make**: a
  material the city does not produce is not taken.
- `take_fraction_max` bounds a raid on a small purse; `take_seconds` bounds one
  on a large purse.
- **Trips.** A raid that takes anything counts one trip. At `max_raids` the
  garrison stops raiding and holds its hoard. The worst case of any absence is
  three raids per open gate, each at most a tenth of the purse — and it all
  comes back when the gate is cleared (§5).
- The **hoard** is a per-gate counter of what it has taken.
- A raid writes a **report** — ruin, time, what was taken — that the widget
  shows until dismissed (§7).

## 5. Clearing the gate

- The gate is the ruin's **frontier room while it stands**: it sits at the top
  of the room ladder, before `Depth 1 · Room 1`, and is entered from the
  battle screen like any room ([`11a-ruins-ui.md`](11a-ruins-ui.md) §2.5) —
  the garrison's squads in view without the Guild's scouting, their power
  against the party's, supplies, the slots, **Clear the gate** in place of
  *Descend*.
- **What the player sees is what they fight.** The squads are derived from
  `guard` (§2) and their sum is the number the attempt is scored against, so
  the authored budget never appears on screen and never has to be trusted.
- **A hero alone is a legal board.** Troops are welcome and never required,
  which is what lets the first fight in the game be fought before the player
  owns an army.
- **No hero is ever busy here.** The fight resolves on entry, so the hero
  parked in a delve still leads it ([`10-heroes.md`](10-heroes.md) §2.5).
- **Supplies** are a flat cost per tier, paid on entry and never refunded.
- The fight resolves on entry, the player attacking
  ([`11-expeditions.md`](11-expeditions.md) §5). A power shortfall warns,
  never blocks. Retry is unlimited and identical to a first attempt.
  - **Win:** the gate is cleared, its counter stops, its hoard is paid, and
    `Depth 1 · Room 1` becomes the frontier.
  - **Lose:** the supplies are gone and the gate stands.
- **A GARRISON FIGHTS BACK: the attempt costs soldiers, win or lose.** The
  dead are gone for good — the one place in the game where a fight has
  permanent casualties ([`combat.md`](combat.md) §4).
  - The damage is the gate's power against the party's defence, the same
    arithmetic a depth uses, spread across the committed squads by their share
    of the party's hit points. Only whole troops die, and never fewer than one.
  - **A rout costs less than a repulse.** A party that wins takes the damage
    in proportion to how outmatched the garrison was, so bringing more than
    enough buys fewer funerals as well as a win; a party that is driven off
    pays it in full.
  - Heroes are never among the dead: a hero can fall in a fight and is whole
    when it ends ([`10-heroes.md`](10-heroes.md) §2.3).
  - **The screen says the price before it is paid** — the expected losses sit
    under the button, beside the supplies.
- **What it pays:** the hoard, in full, banked immediately; Hero XP by the
  ruin's tier; event points ([`13-events.md`](13-events.md) §2.2); the
  `ClearGarrisons` quest goal ([`12-quests.md`](12-quests.md) §1.1). No room
  reward, no loot table — the ruin behind it is the reward.
- No technology gates the gate.

## 6. The doorway to combat

- The first fight is **the Hollow Barrow's gate: on the surface, the enemy in
  view, the outcome guaranteed by authoring.** It teaches the room sheet, the
  type chart and the board before Depth 1 adds the power ladder.
- **Twenty orcs is a company's job, not a hero's.** The chain musters
  twenty-four soldiers one beat before it
  ([`12-quests.md`](12-quests.md) §2), so the fight is won by the army the
  onboarding just built and the hero that leads it — which is what makes the
  military block mean something.
- Discovering the Barrow starts its thirty minutes, so the military block sits
  right after the reveal that finds it in the onboarding
  ([`12-quests.md`](12-quests.md) §2): Warrior → Barracks → first soldier →
  free summon → **a company of twenty-four** → **`DriveThemOut`**.
- Every later gate is the argument for the next hall, the next squad, the next
  tier.

## 7. The screens

- **The raid widget** sits on the **right edge of the screen, in the slot the
  Mana-refill offer uses**, and hides behind any sheet. It shows the gate
  whose counter is nearest and its countdown — *Orcs at the Hollow Barrow raid
  in 27 min* — with a count when more are open. After a raid it carries the
  report until dismissed; several raids in one absence are one summary.
  Tapping it opens the ruin sheet. It never opens itself.
- **The ruin's card** ([`11a-ruins-ui.md`](11a-ruins-ui.md) §2.3) leads with
  the gate while it stands: the creature and its type, the countdown, trips
  left, and the hoard if any — *they hold 320 Gold and 90 Food; cleared, it
  comes back*. One tap into the room sheet, and **no way past it** — the
  depths behind are not offered at all.
- **The map marker** carries the countdown badge while a gate is open.
- **The room sheet, on a gate**: threat always visible, power comparison,
  supplies, party, **Clear the gate**.
- No raid sheet, no defence screen, no army tab.

## 8. Dials, in the order to reach for them

| Dial | Recommended | Where |
|---|---|---|
| a ruin's gate: threat, power, warning and period in minutes | §2 | `?dev=map` |
| take seconds per tier | 300 × tier | `Garrisons` sheet, one row per tier |
| take fraction max | 0.10 | `raid.take_fraction_max` (Settings) |
| max raids per gate | 3 | `raid.max_raids` (Settings) |
| gate supplies per tier | half the ruin's own supplies | `Garrisons` sheet |

## 9. Deliberately not in this design

- **A home defence.** Nothing at home fights a raid; the roster is for
  attacking. A raid is a bill, not a battle.
- **Garrisons on landmarks.** A landmark is claimed for its Gold
  ([`01-map-and-fog.md`](01-map-and-fog.md) §6); the world map's siege is the
  contested landmark ([`15-social.md`](15-social.md) §6).
- Escalating waves; re-infestation of a cleared gate.
- An authored formation per gate — the generator builds it from `guard`, as
  it builds a room. Named villains belong to bosses.
- One raid clock for the whole city; counters in hours or days; a counter in
  the workbook.
- Rousing conditions beyond discovery — a hall, a hero, an army.
- Raids on Gems, Mana, Knowledge, Stardust, Hero XP, goods, relics, heroes or
  units.
- Buying protection: a Gem shield, an ad that repels a raid, a "peace" SKU.
- A base hoard, a hoard cap in production-seconds, a loot table, a room reward
  on the gate.
- A march, a return march, a wounded state, anything *away* from home.
- Workers fighting; a wall or tower district.
- A creature list beside the threat type; randomness in resolution.
- A widget that opens itself.
- Player-versus-player raiding ([`02-map-scopes.md`](02-map-scopes.md) §4).
- A technology that gates the gate (`Siegecraft` is retired).

**Open questions:** OQ-72, OQ-74 in
[`../open-questions.md`](../open-questions.md).
