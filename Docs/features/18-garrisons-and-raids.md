# 18 · The gate — a garrison with a clock

> **Scope.** The garrison that holds every ruin's entrance, the counter that
> starts when the ruin is discovered, the raid it makes on the city when the
> counter runs out, and the room fight that clears it. The ruin behind the gate
> is [`11-expeditions.md`](11-expeditions.md); the fight is
> [`combat.md`](combat.md); the screens are [`11a-ruins-ui.md`](11a-ruins-ui.md).
>
> **Status: built as the province's lairs** (`src/sim/lairs.ts`): the clock,
> the raid, the hoard and the fight, through the resolver
> ([`combat.md`](combat.md)). A lair has no ruin behind it — cleared, it is
> gone — and its zone denies the ground around it
> ([`../proposals/lairs.md`](../proposals/lairs.md) §3).

## 1. The rules, up front

1. **A lair is a path of fights**: its tier's count, one board each, fought
   in order. The last one beats it, and nothing stands behind it (§5).
2. **The gate is a room on the surface.** It is generated from its `guard` the
   way a room is generated from its budget, and clearing it is a room attempt
   like any other — the player attacks, the enemy never does.
3. **Discovering the lair starts its counter**, authored in minutes.
   When it runs out the garrison raids the city, then **three times a day**,
   inside the player's raid window, for as long as it stands.
4. **A raid is not a fight.** Nothing defends. The garrison takes, and the
   answers are to collect and to go and clear the gate.
5. **A raid takes from the buildings' stores, never from the wallet, and only
   materials** ([`03-economy.md`](03-economy.md) §3.2). What the player has
   collected is safe: collecting is the defence. Gold, Food, Wood, Stone. Never
   the Townhall's own Gold — the city's floor — and never Gems, Mana, Knowledge, Stardust, Hero XP, goods, cards, relics, heroes
   or units.
6. **A raid is priced in production, not in units**, capped by a fraction of
   what the stores hold. **A lair carries at most a day of raids** of each
   material; what it takes over that is lost. Clearing it returns its
   hoard.
7. **The gate is the incentive, not the punishment.** It is a small personal
   event with a clock, whose whole job is to send the player into the ruin.

## 2. The gate

- Authored **per lair**, in `?dev=data#map` ([`../map-editor.md`](../map-editor.md)):

```
guard { threat, power, warningMinutes }
```

- `threat` is a unit type or `Any`. The creature is derived from it; there is
  no second list:

| `threat` | Reads as | `threatMix` | Composition answer |
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
- **A `mix` makes an army of its own**: weights by unit type, the generator
  spending the budget on those types alone, the heaviest first. Without one,
  the threat takes the lion's share and the rest is split evenly. A world
  camp of the same creature fields the same mix.
- **Recommended `power`: below the ruin's `powerStart` at Depth 1.** The gate is
  easier than the first room, because it is the room the player is pushed
  into on a clock.
- The warning is per lair: a harder lair gets a longer one, because the
  army it needs takes longer to build.
- A ruin's **tier** keys the `garrisons` entries that are not per site: take
  seconds, Hero XP and Bag items (§8).

| Lair | Tier | `threat` | `mix` | `power` | Warning |
|---|---|---|---|---|---|
| Orcs | 1 | Warrior | Warriors 4 · Lancers 1 | **60** | **30 min** |
| Harpies | 2 | Archer | Archers 7 · Cavalry 3 | 300 | 90 min |
| Goblins | 3 | Lancer | — | 440 | 120 min |
| Wolf riders | 4 | Cavalry | — | 700 | 180 min |
| Drake | 5 | Any | — | 1,000 | 240 min |

- **`power` is a budget in troops' worth, and the count is what the player
  sees**: the generator spends it on each unit's `power`, so fifteen orcs is
  15 × 3 (§2, [`combat.md`](combat.md) §5).
- **A garrison more than six squads of rank I can hold fields evolved
  creatures** — veteran orcs beside orcs ([`combat.md`](combat.md) §6, §11).
  No province lair today is that big.

## 3. The counter

- The counter starts the moment the lair is **discovered** — any cell of its
  zone Revealed ([`01-map-and-fog.md`](01-map-and-fog.md) §4):
  `nextRaidAt = discoveredAt + warningMinutes`.
- After the first raid, `raid.perDay` (3) raids a local day: the window
  `raid.windowStartHour`–`windowEndHour` (9–23) is cut into equal slices, one
  raid in each, at a moment hashed from the lair, the day and the slice.
  Cleared: no counter.
- **One counter per gate.** Several may run at once; raids due at the same
  instant resolve in ruin order.
- **It is a timer.** It runs and resolves in full while the player is away.
- A cleared gate is gone for good. No re-infestation.
- **Minutes, not hours.** The Orcs' thirty minutes says *you have this
  session and maybe the next*. What bounds a long absence is the hoard cap
  (§4), not the counter.

## 4. The raid

- Resolved at `nextRaidAt`, with no fight. **The take**, per material in Gold,
  Food, Wood, Stone:

```
base = cityRate × takeSeconds(tier)                  # seconds of the city's own production
take = floor( min(base, stored × raid.takeFractionMax) )
```

- `cityRate` is the city's current production of that material — the crews'
  gather rate, plus rent for Gold. It is a fact about the city, not an
  accrual, so a raid replays identically. **They take from what you make**: a
  material the city does not produce is not taken.
- `stored` is what every store in the city holds of that material.
- `raid.takeFractionMax` (0.5) bounds a raid on nearly empty stores;
  `takeSeconds` bounds one on full stores.
- The take is spread across the buildings in proportion to what each holds.
- A raid that empties a full store sets its crew going again from that moment.
- The **hoard** is a per-lair counter of what it has taken, capped per
  material at a day of raids (`perDay × cityRate × takeSeconds`); a raid over
  the cap still takes, and the rest is lost.
- A raid writes a **report** — ruin, time, what was taken — that the widget
  shows until dismissed (§7).

## 5. Clearing the gate

- The gate is the ruin's **frontier room while it stands**: it sits at the top
  of the room ladder, before `Depth 1 · Room 1`, and is entered from the
  battle screen like any room ([`11a-ruins-ui.md`](11a-ruins-ui.md) §2.5) —
  the garrison's squads in view without the Guild's scouting, their power
  against the party's, its Mana, the slots, **Clear the gate** in place of
  *Descend*.
- **What the player sees is what they fight.** The squads are derived from
  `guard` (§2) and their sum is the number the attempt is scored against, so
  the authored budget never appears on screen and never has to be trusted.
- **A lair wants soldiers**: soldiers alone, or soldiers with heroes. A hero
  alone is refused (*A lair wants soldiers*), and so is nobody at all. The
  first fight in the game is soldiers alone: it comes before the Tavern, and
  the kingdom owns no hero until then.
- **No hero is ever busy.** Every fight in the game resolves the instant it is
  entered, so a hero is never away and never unavailable
  ([`10-heroes.md`](10-heroes.md) §2.7).
- **Supplies** are a flat cost per tier, paid on entry and never refunded.
- The fight resolves on entry, the player attacking
  ([`11-expeditions.md`](11-expeditions.md) §5). A power shortfall warns,
  never blocks. Retry is unlimited and identical to a first attempt.
  - **Win, short of the last fight:** the path moves one step on and pays
    its share of Hero XP. The lair still stands, holds its ground and
    **keeps raiding**.
  - **Win, the last fight:** the garrison is beaten, its counter stops, and
    its card offers **Claim**.
  - **Lose:** the Mana is spent and the path stays where it was.
- **The path** (`garrisons` › `fights`, by tier):

  | Tier | 1 | 2 | 3 | 4 | 5 |
  |---|---|---|---|---|---|
  | Fights | 3 | 4 | 5 | 6 | 7 |

  - **The last fight is the lair's own garrison**, at its `guard.power`.
  - The fights before it ramp evenly up to it from **half its power**
    (`delve.firstFightPower`). The path makes a lair longer, never harder to
    finish.
  - Each fight's garrison is rolled for that fight, the lair's creature in
    the lead.
- **An attempt costs Mana**, win or lose: `combat.fightMana` (20), as every
  attack does ([`08-magic.md`](08-magic.md) §1).
- **The attempt costs soldiers, win or lose**, by the rule every fight
  follows ([`combat.md`](combat.md) §4): the gate's power against the party's
  defence, most of the fallen into the infirmary and the rest gone.
  - Heroes are never among the dead: a hero can fall in a fight and is whole
    when it ends ([`10-heroes.md`](10-heroes.md) §2.3).
  - **The screen says the price before it is paid** — the expected losses sit
    under the button, beside the Mana.
- **What it pays:**
  - **Hero XP by tier** (`garrisons.heroXp`: 500 · 1,500 · 4,000 · 10,000 ·
    25,000), split evenly across the path: every fight short of the last pays
    its share when it falls, and the last share comes with the claim.
  - **The claim** pays the rest: the hoard in full, the first-clear Knowledge
    lump, the tier's Bag items and relic fragments, and the lair's ground.
  - The `ClearLairs` quest goal ([`12-quests.md`](12-quests.md) §1.1) counts
    a claimed lair.
- No technology gates the gate.

## 6. The doorway to combat

- The first fight is **the Orcs: on the surface, the enemy in
  view, the outcome guaranteed by authoring.** It teaches the room sheet, the
  type chart and the board before Depth 1 adds the power ladder.
- **Twenty orcs is a company's job, not a hero's.** The Orcs are three
  fights, and the company of thirty walks the whole path, its losses carried
  from one fight to the next. The chain musters those thirty soldiers one beat
  before it
  ([`12-quests.md`](12-quests.md) §2), so the fight is won by the army the
  onboarding just built and the hero that leads it — which is what makes the
  military block mean something.
- Discovering the Orcs starts their thirty minutes, so the military block sits
  right after the reveal that finds it in the onboarding
  ([`12-quests.md`](12-quests.md) §2): Warrior → Barracks → first soldier →
  **a company of thirty** → **`DriveThemOut`**.
- Every later gate is the argument for the next hall, the next squad, the next
  tier.

## 7. The screens

- **The raid notices** ([`26-notices.md`](26-notices.md) §2): the
  *Raid coming* bubble while a gate is open — the nearest raid and its
  countdown, with a count when more are open — and a *Raided* news after each
  raid; several raids in one absence are one. Go goes to the lair.
- **The lair's card**, top to bottom:
  - the painting of the creature, with its flavour line;
  - the countdown to the next raid — or, once beaten, *Claim what they left
    behind*;
  - **Progress**: the path, one delve stone a fight joined by a dotted trail.
    A fight won carries a green wax seal, the next is lit, the ones ahead are
    dim, and the last is the boss's horned stone. Under it, *Fight 2 of 3*;
  - the reward the claim pays — the hoard, the last share of Hero XP and the
    Knowledge;
  - **Attack**, which opens the attack screen on the next fight — or
    **Claim**.
- **The playback** of a fight names it — *Orcs · Fight 2 of 3* — and a fight
  short of the last shows its Hero XP as spoils.
- **The map marker** carries the countdown badge while a gate is open.
- **The room sheet, on a gate**: threat always visible, power comparison,
  its Mana, party, **Clear the gate**.
- No raid sheet, no defence screen, no army tab.

## 8. Dials, in the order to reach for them

| Dial | Recommended | Where |
|---|---|---|
| a lair's guard: threat, power, warning in minutes | §2 | `?dev=data#map` |
| take seconds per tier | 300 × tier | `garrisons` › `takeSeconds`, one entry per tier |
| take fraction max, of what the stores hold | 0.5 | `raid.takeFractionMax` (`exploration`) |
| raids a day, and the window they land in | 3 · 9–23 h | `raid.perDay`, `windowStartHour`, `windowEndHour` (`exploration`) |
| what an attempt costs | 20 Mana, as every attack | `combat.fightMana` |
| fights a lair takes, by tier | 3 · 4 · 5 · 6 · 7 | `garrisons` › `fights` |
| how hard its first fight is | half the lair's power | `delve.firstFightPower` (`exploration`) |

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
  `?dev=data`.
- Rousing conditions beyond discovery — a hall, a hero, an army.
- Raids on the wallet.
- Raids on Gems, Mana, Knowledge, Stardust, Hero XP, goods, cards, relics, heroes or
  units.
- Buying protection: a Gem shield, an ad that repels a raid, a "peace" SKU.
- A base hoard, a hoard cap in production-seconds, a loot table, a room reward
  on the gate.
- A march, a return march, a wounded state, anything *away* from home.
- Workers fighting; a wall or tower district.
- A creature list beside the threat type; randomness in resolution.
- A widget that opens itself.
- Player-versus-player raiding ([`02-map-scopes.md`](02-map-scopes.md) §5).
- A technology that gates the gate (`Siegecraft` is retired).

**Open questions:** OQ-72 in
[`../open-questions.md`](../open-questions.md).
