# 18 · Lairs — a garrison with a clock

> **Scope.** The province's lairs: the ground a lair holds, the garrison in
> it, the counter that starts when it is found, the raids it makes on the
> city, the path of fights that beats it and the claim that clears it. The
> fight itself is [`combat.md`](combat.md); where the lairs stand is
> [`01-map-and-fog.md`](01-map-and-fog.md) §6.
>
> **Status: built** (`src/sim/lairs.ts`, `lairZone.ts`, `expeditions.ts`).

## 1. The rules, up front

1. **A lair holds its ground.** Every cell within its `radius` of its
   footprint is its zone. Once it is found and until it is claimed, nothing in
   the zone can be tapped, built on, repaired or harvested, no landmark in it
   can be claimed, and a spell skips it.
2. **Finding the lair starts its counter** — any cell of its zone Revealed,
   by any means. When the counter runs out the garrison raids the city, then
   **three times a day**, inside the player's local raid window, for as long
   as it stands.
3. **A raid is not a fight.** Nothing defends. The garrison takes, and the
   answers are to collect and to go and beat the lair.
4. **A raid takes from the buildings' stores, never from the wallet, and only
   Gold, Food, Wood and Stone** ([`03-economy.md`](03-economy.md) §3.2).
   Never the Townhall's own Gold. What the player has collected is safe.
5. **A raid is priced in production**, capped by a fraction of what the
   stores hold. **A lair carries at most a day of raids** of each material;
   what it takes over that is lost. Claiming it returns its hoard.
6. **A lair is a path of fights** — three to seven by tier — fought in order
   by soldiers, heroes optional. The last one beats it; the **claim** clears
   it. A cleared lair is gone for good.

## 2. The garrison

- Authored **per lair**, in `?dev=data#map` ([`../map-editor.md`](../map-editor.md)):

```
guard { threat, power, warningMinutes, mix? }
```

- `threat` is a unit type or `Any`. The creature is derived from it:

| `threat` | Reads as | Composition answer |
|---|---|---|
| Warrior | **Orcs** | Archers |
| Lancer | **Goblins** | Warriors |
| Archer | **Harpies** | Cavalry |
| Cavalry | **Wolf riders** | Lancers |
| Any | **a Drake** | none — a raw power check |

- `power` is the budget of the lair's **last** fight. The generator spends it
  on squads ([`combat.md`](combat.md) §11), seeded from the lair and the
  fight: same lair, same fight, same garrison, every time.
- **Without a `mix`**, the threat takes 60% of the budget and the rest is
  split evenly across the other types (`Any`: even across all four).
- **A `mix` makes an army of its own**: weights by unit type, the generator
  spending the budget on those types alone, the heaviest first. A world camp
  of the same creature fields the same mix.
- **`power` is a budget in troops' worth, and the count is what the player
  sees**: the generator spends it on each unit's `power`, so fifteen orcs is
  15 × 3 ([`combat.md`](combat.md) §5).
- A garrison bigger than six squads of rank I can hold fields evolved
  creatures ([`combat.md`](combat.md) §11). No province lair is that big.
- The warning is per lair: a harder lair gets a longer one.
- A lair's **tier** keys the `garrisons` entries that are not per lair: fights,
  take seconds, Hero XP and Bag items (§5, §8).

| Lair | Tier | `threat` | `mix` | `power` | Warning |
|---|---|---|---|---|---|
| Orcs | 1 | Warrior | Warriors 4 · Lancers 1 | **60** | **30 min** |
| Harpies | 2 | Archer | Archers 7 · Cavalry 3 | 300 | 90 min |
| Goblins | 3 | Lancer | — | 440 | 120 min |
| Wolf riders | 4 | Cavalry | — | 700 | 180 min |
| Drake | 5 | Any | — | 1,000 | 240 min |

## 3. The counter

- The counter starts the moment the lair is **found** — any cell of its zone
  Revealed ([`01-map-and-fog.md`](01-map-and-fog.md) §4). A building's or a
  claim's discover ring never finds a lair:
  `nextRaidAt = foundAt + warningMinutes`.
- After the first raid, `raid.perDay` (3) raids a local day: the window
  `raid.windowStartHour`–`windowEndHour` (9:00–23:00, the device's local time)
  is cut into equal slices, one raid in each, at a moment hashed from the
  lair, the day and the slice. A change of local time puts every standing
  lair back on the schedule; a first warning already shown is kept.
- **One counter per lair.** Several may run at once; raids due at the same
  instant resolve in lair order.
- **It is a timer.** It runs and resolves in full while the player is away.
- Beaten: no counter.

## 4. The raid

- Resolved at `nextRaidAt`, with no fight. **The take**, per material in Gold,
  Food, Wood, Stone:

```
base = cityRate × takeSeconds(tier)                  # seconds of the city's own production
take = floor( min(base, stored × raid.takeFractionMax) )
```

- `cityRate` is the city's current production of that material — the crews'
  gather rate, plus rent for Gold (not the Townhall's own). **They take from
  what you make**: a material the city does not produce is not taken.
- `stored` is what every store in the city holds of that material, the
  Townhall's excepted.
- `raid.takeFractionMax` (0.5) bounds a raid on nearly empty stores;
  `takeSeconds` bounds one on full stores.
- The take is spread across the buildings in proportion to what each holds.
- A raid that empties a full store sets its crew going again from that moment.
- The **hoard** is a per-lair counter of what it has taken, capped per
  material at a day of raids (`perDay × cityRate × takeSeconds`); a raid over
  the cap still takes, and the rest is lost.
- A raid that finds nothing still moves the counter on.
- A raid writes a **report** — lair, time, what was taken — for the notices
  (§7).

## 5. Beating the lair

- **The attack** opens the battle screen on the lair's next fight
  ([`11a-ruins-ui.md`](11a-ruins-ui.md) §2.5): the garrison's squads in view,
  their power against the party's, the Mana, the slots, **Attack**.
- **What the player sees is what they fight.** The squads are derived from
  `guard` (§2) and the path (below).
- **A lair wants soldiers**: soldiers alone, or soldiers with heroes, up to
  the hero slots owned. A hero alone is refused (*A lair wants soldiers*), and
  so is nobody at all. The first fight in the game is soldiers alone: it
  comes before the Tavern.
- **A hero can be refused**: one at 0 HP rests until its bar is whole, and
  one out with an army on the world board is busy
  ([`combat.md`](combat.md) §9.1).
- **An attempt costs Mana**, win or lose: `combat.fightMana` (20), as every
  fight does ([`08-magic.md`](08-magic.md) §1). Paid on entry, never refunded.
- The fight resolves on entry, the player attacking. A power shortfall warns,
  never blocks. Retry is unlimited and identical to a first attempt.
  - **Win, short of the last fight:** the path moves one step on and pays
    its share of Hero XP. The lair still stands, holds its ground and
    **keeps raiding**.
  - **Win, the last fight:** the garrison is beaten, its counter stops, and
    its card offers **Claim**. It still holds its ground until claimed.
  - **Lose:** the Mana is spent and the path stays where it was.
- **The path** (`garrisons` › `fights`, by tier):

  | Tier | 1 | 2 | 3 | 4 | 5 |
  |---|---|---|---|---|---|
  | Fights | 3 | 4 | 5 | 6 | 7 |

  - **The last fight is the lair's own garrison**, at its `guard.power`.
  - The fights before it ramp evenly up to it from **half its power**
    (`delve.firstFightPower`).
  - Each fight's garrison is rolled for that fight, the lair's creature in
    the lead.
- **Every attempt costs soldiers, win or lose**, by the rule every fight
  follows ([`combat.md`](combat.md) §4): who falls is read off the fight; a
  share comes home wounded to the Infirmary's beds, the rest die.
  - **Heroes lose HP**, and carry it into the next fight
    ([`combat.md`](combat.md) §9.1).
  - **The screen says the price before it is paid** — the expected losses sit
    under the button, beside the Mana.
- **What it pays:**
  - **Hero XP by tier** (`garrisons` › `heroXp`: 500 · 1,500 · 4,000 ·
    10,000 · 25,000), split evenly across the path: every fight short of the
    last pays its share when it falls, and the last share comes with the
    claim.
  - **The claim** pays the rest: the hoard in full, the first-clear Knowledge
    lump (`delve.firstClearKnowledge`, 3, raised by the tree), the tier's Bag
    items (`garrisons` › `rewardItems` — the Orcs' include the Watchtower's
    lens), and city relic fragments — first the relic whose door the lair is
    ([`09-relics.md`](09-relics.md)), then the tier's share
    (`relics` › `fragments.perLairTier`: 1 · 1 · 2 · 2 · 3). The ground it
    held is the city's.
  - Hero skills' spoils ride on it: Plunder swells the hoard, Lore the
    Knowledge, Seasoned the Hero XP ([`10-heroes.md`](10-heroes.md) §2.5).
  - The `FindLairs` quest goal counts a found lair; `ClearLairs`
    ([`12-quests.md`](12-quests.md) §1.1) counts a claimed one.
- **Relic doors**: the Orcs open the Staff of Renewal, the Harpies the Sickle
  of Plenty, the Goblins the Winged Hammer, the Wolf riders the Tribute Crown
  (`artifacts` › `door`). The Drake opens none.
- No technology gates a lair.

## 6. The doorway to combat

- The first fight is **the Orcs: the enemy in view, soldiers alone.** It
  teaches the battle screen, the type chart and the board.
- The Orcs are three fights. The chain musters a company of thirty soldiers
  before `DriveThemOut`, and the company walks the whole path, its losses
  carried from one fight to the next.
- Finding the Orcs starts their thirty minutes, so the military block sits
  right after the quest that finds them ([`12-quests.md`](12-quests.md) §2):
  `WarDrums` (find a lair) → Warrior → Barracks → first soldier → **a company
  of thirty** → **`DriveThemOut`** (clear a lair).
- Every later lair is the argument for the next hall, the next squad, the next
  tier.

## 7. The screens

- **The raid notices** ([`26-notices.md`](26-notices.md) §2): the
  *Raid coming* bubble while a lair stands — the nearest raid and its
  countdown, with a count when more are open — and a *Raided* news after each
  raid; several raids in one absence are one. Go goes to the lair.
- **The lair's card**, top to bottom:
  - the painting of the creature, with its flavour line;
  - the countdown to the next raid (*They will attack your city in*) — or,
    once beaten, *Claim what they left behind*;
  - **Progress**: the path, one stone a fight joined by a dotted trail. A
    fight won carries a green wax seal, the next is lit, the ones ahead are
    dim, and the last is the boss's horned stone. Under it, *Fight 2 of 3*;
  - **Reward**: the hoard (a material it carries all it can of marked
    *full*), the last share of Hero XP and the Knowledge;
  - **Attack**, which opens the battle screen on the next fight — or
    **Claim**.
- **The playback** of a fight names it — *Orcs · Fight 2 of 3* — and a fight
  short of the last shows its Hero XP as spoils.
- **The map marker** carries the countdown badge while a lair stands.
- No raid sheet, no defence screen.

## 8. Dials, in the order to reach for them

| Dial | Value | Where |
|---|---|---|
| A lair's guard: threat, power, warning in minutes, mix | §2 | `?dev=data#map` |
| A lair's ground and sight | §2, [`01`](01-map-and-fog.md) §6 | `radius`, `sight`, `?dev=data#map` |
| Take seconds per tier | 300 · 600 · 900 · 1,200 · 1,500 | `garrisons` › `takeSeconds` |
| Take fraction max, of what the stores hold | 0.5 | `raid.takeFractionMax` (`exploration`) |
| Raids a day, and the window they land in | 3 · 9–23 h | `raid.perDay`, `windowStartHour`, `windowEndHour` (`exploration`) |
| What an attempt costs | 20 Mana | `combat.fightMana` |
| Fights a lair takes, by tier | 3 · 4 · 5 · 6 · 7 | `garrisons` › `fights` |
| How hard its first fight is | half the lair's power | `delve.firstFightPower` (`exploration`) |
| Hero XP by tier | 500 · 1,500 · 4,000 · 10,000 · 25,000 | `garrisons` › `heroXp` |
| Bag items by tier | — | `garrisons` › `rewardItems` |
| Knowledge on the claim | 3 | `delve.firstClearKnowledge` (`exploration`) |
| Relic fragments by tier | 1 · 1 · 2 · 2 · 3 | `relics` › `fragments.perLairTier` |
| Which relic a lair opens | — | `artifacts` › `door` |

## 9. Deliberately not in this design

- **A home defence.** Nothing at home fights a raid. A raid is a bill, not a
  battle.
- **Garrisons on landmarks.** A landmark is claimed for its Gold
  ([`01-map-and-fog.md`](01-map-and-fog.md) §6).
- Escalating waves; re-infestation of a cleared lair.
- An authored formation per lair — the generator builds it from `guard`.
- One raid clock for the whole city; counters in hours or days.
- Rousing conditions beyond finding — a hall, a hero, an army.
- Raids on the wallet, on the Townhall's own Gold, or on Gems, Mana,
  Knowledge, Stardust, Hero XP, goods, relics, heroes or units.
- Buying protection: a Gem shield, an ad that repels a raid, a "peace" SKU.
- A base hoard, a loot table.
- A march, a return march, anything *away* from home.
- Workers fighting; a wall or tower district.
- A creature list beside the threat type; randomness in resolution.
- A notice that opens itself.
- Player-versus-player raiding ([`02-map-scopes.md`](02-map-scopes.md) §5).
- A technology that gates a lair.

**Open questions:** OQ-72 in
[`../open-questions.md`](../open-questions.md).
