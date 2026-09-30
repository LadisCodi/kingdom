# Proposal — lairs

> **What this is.** The province's five ruins become **lairs**: a monster camp
> that raids the city on a clock, denies the ground around it, and is cleared
> once by one fight — then it is gone. It is a **proposal**, not a feature doc:
> nothing here is built.
>
> **It replaces** the ruin behind the gate. The gate
> ([`../features/18-garrisons-and-raids.md`](../features/18-garrisons-and-raids.md))
> is kept almost whole and becomes the lair; the depths, rooms, bosses and the
> Adventurers' Guild ([`../features/11-expeditions.md`](../features/11-expeditions.md))
> leave the province. **Repeatable dungeons belong to the world map**
> ([`../features/19-world-map.md`](../features/19-world-map.md) §8), which is
> unbuilt.

## 1. The rules, up front

1. **A lair is one fight.** One garrison, one board, one clear. Nothing behind it.
2. **A lair is discovered when the player reveals any cell of its zone.**
   Its first raid comes after a warning; from then on it raids **three times a
   day, for as long as it stands**, taking only from the buildings' stores.
3. **A lair holds ground.** Every cell within its **radius** is its zone: no
   tap, no build, no harvest there until it is cleared.
4. **Clearing it pays once and removes it.** The hoard comes back — up to a
   day of raids, the rest is lost — the reward is paid, the zone lifts and the site is ordinary ground.
5. **A cleared lair never returns.**

## 2. The lair

Authored **per lair**, in `?dev=data#map`:

```
lair { tier, size, guard { threat, power, warningMinutes }, radius, flavour }
```

- `guard` is the gate's ([`18`](../features/18-garrisons-and-raids.md) §2)
  without `periodMinutes`: the raids after the first follow the daily
  schedule (§4). `threat` names the creature.
- `size` is the lair's footprint, **2×2** for every lair: the camp is a site
  on the map, not a marker on one cell.
- `radius` is the zone, in **Chebyshev** rings around the lair's footprint.
- `flavour` is the card's line over its illustration (§6): two lines at most.
- `tier` keys the `garrisons` entries that are not per site (take seconds,
  supplies) and the reward (§5).

| Lair | Tier | Creature | `radius` | Zone |
|---|---|---|---|---|
| Orc Lair | I | Orcs | **1** | 4×4 |
| Harpy Roost | II | Harpies | **1** | 4×4 |
| Goblin Den | III | Goblins | **2** | 6×6 |
| Wolf-rider Camp | IV | Wolf riders | **2** | 6×6 |
| Drake's Lair | V | a Drake | **3** | 8×8 |

- Placement is authored; the fog is unchanged
  ([`../features/01-map-and-fog.md`](../features/01-map-and-fog.md) §4).

### 2.1 Discovery

- **A lair is discovered the moment any cell of its zone becomes Revealed** —
  by a paid fog tap, a building's reveal ring, a spell, anything that reveals.
- A cell that is only **Discovered** (under the scrim) does not wake it: a
  building's discover ring or a claim's discover ring never finds a lair.
- On discovery the lair's cell and its whole zone are drawn, and its clock
  starts (§4).
- Until then the lair is not drawn and its zone denies nothing.

## 3. The zone

- **Drawn from the moment the lair is discovered** (§2.1), over every fog
  state, the way the reach is drawn: a border and a tint on every cell inside.
- **Inside the zone:**
  - **No tap on the ground.** A tap on a feature is refused and costs no Mana.
  - **No placing, and no moving a building in.** A footprint with any cell
    inside is refused.
  - **No harvest.** A crew never picks a node inside; a haul already on its way
    lands.
  - **Spells skip it.** An area cast works every cell of its area except the
    zone's.
- **What the zone does not touch:**
  - **The fog.** A cell inside may be paid for, so the frontier can reach the
    lair.
- **No building ever stands inside.** A building stands only on Revealed
  cells, and revealing one of the zone's discovers the lair first.
- A feature with a footprint is inside if any of its cells is.
- Zones that overlap are one zone.

## 4. Raids

### 4.1 When

- **The first raid** lands `warningMinutes` after discovery.
- **After it, `raid.perDay` (3) raids every day**, for as long as the lair
  stands. No trip limit.
- **A day is the player's local day.** The raids fall inside the **raid
  window**, `raid.windowStartHour`–`raid.windowEndHour` local (9–23), so they
  land in the hours the player plays, never at night.
  - The window is cut into `raid.perDay` equal slices; each raid falls at a
    random moment inside its own slice, so two raids are never on top of each
    other.
  - The moment is a hash of the lair, the day and the slice — the same lair on
    the same day always raids at the same times, whenever the day is replayed.
- A raid due inside the first raid's warning is skipped.
- **The player's local offset** is kept in the kingdom and updated when the
  device reports a new one; a change moves the schedule from the next slice
  on.
- Several lairs raid on their own schedules; raids due at the same instant
  resolve in lair order.

### 4.2 What

- **The take** is the gate's
  ([`18`](../features/18-garrisons-and-raids.md) §4): per material in Gold,
  Food, Wood and Stone, `takeSeconds(tier)` of the city's production, at most
  `raid.takeFractionMax` (0.5) of what the stores hold, spread across the
  buildings in proportion. Never the wallet.
- **The hoard** is what the lair carries of it, per material.
- **The hoard's cap** is a day of raids, per material, at the city's current
  rate:

```
hoardCap = raid.perDay × cityRate × takeSeconds(tier)
```

- **A raid always takes.** What fits under the cap goes into the hoard; the
  rest is **lost**.

## 5. Clearing the lair

- The fight is the gate's fight
  ([`18`](../features/18-garrisons-and-raids.md) §5): the garrison's squads in
  view, supplies paid on entry, a hero mandatory, troops welcome, casualties
  win or lose, retry unlimited.
- **Win:** the garrison is **beaten**, not yet cleared:
  - its clock stops for good — it raids no more;
  - nothing is paid on the field;
  - it stays on the map, holding its zone and its hoard, and its card now
    offers **Claim** in place of Attack.
- **Claim** (from the card):
  - the hoard, into the wallet;
  - **Hero XP** by tier;
  - the **first-clear Knowledge lump**
    ([`../features/07-research.md`](../features/07-research.md) §3), raised by
    `Conquest` and doubled by `SanctifiedRuins` as today;
  - event points and the `ClearLairs` quest goal;
  - the card closes, and the lair **goes**: it sinks and fades under a ring
    of dust while its zone fades out, and the ground is the city's. Its cell
    keeps its terrain and fog state and is buildable like any other.
- **Lose:** the supplies are gone, the lair stands, the clock keeps running.

## 6. Screens

- **The map.** The lair's model on its cell and its zone (§3).
- **The warning bubble** floats over the lair's cell from discovery to clear.
  It is the lair's **one** world indicator:
  - the collect bubble's style and tail, in **danger red**, a little wider
    than tall;
  - the creature's head, small, on the left;
  - the countdown to the next raid on the right — an hourglass and *27m*.
  - Tapping it opens the lair's card.
  - A **beaten** lair's bubble is a store's: the parchment collect bubble
    with the reward chest, no countdown.
- **No raid count is shown**, anywhere: no pips, no *raids left*, no *raids
  today*. A lair raids on a clock until it is cleared.
- **A refused tap inside the zone** says why — *Orcs hold this ground* — and
  points at the lair.
- **Both screens are built from the existing sheet kit** — the district
  card's frame and title plank, its rounded inset boxes, the upgrade popup's
  uppercase section separators and action box, the game's own buttons. No
  new frame, seal or divider art.
- **Mockups:** [`map.png`](../art/mockups/lairs/map.png) (the lair, its zone
  and its bubble), [`card.png`](../art/mockups/lairs/card.png),
  [`attack.png`](../art/mockups/lairs/attack.png).
- **The lair's card** opens from the bubble. It holds, top to bottom:
  - **the name**, on the sheet's plain title plank — no icon, like every
    other sheet;
  - **an illustration** of the creature at its worst — what makes it a threat
    to the kingdom, in the game's style, one per lair — with **a line of
    flavour** over its bottom edge: white text with a drop shadow, two lines
    at most;
  - **the countdown**, phrased as the threat — *They will attack your city
    in 27m*;
  - **the reward** as chips: the hoard it carries, then Hero XP and
    Knowledge;
  - **Attack**, the game's green button on the sheet itself, not inside a
    box. It opens the attack screen. Once the garrison is beaten, the
    countdown box says *Orcs are beaten — claim what they left behind* and
    the button is **Claim**.
  - **Nothing else.** The enemy's squads and power are the attack screen's.
- **The attack screen** opens from **Attack**. It is the gate's battle screen
  ([`../features/11a-ruins-ui.md`](../features/11a-ruins-ui.md) §2.5–§2.6),
  top to bottom:
  - the name on the plain title plank, and one line with the countdown;
  - **the enemy's board** — up to six troop slots and its hero slots, and
    its power;
  - **your board** — six troop slots and three hero slots (one free, the
    rest bought with Gems), and your power;
  - **troop slots are rounds, hero and villain slots are 2:3 cards** — the
    hero's illustration fills the card, masked by it; your heroes carry their
    HP bar along its foot ([`../features/10-heroes.md`](../features/10-heroes.md) §2.8);
  - **no rows on this screen.** Where a squad stands in the fight — in
    front or behind — is its unit type's (melee and flankers in front, the
    ranged behind, [`../features/combat.md`](../features/combat.md) §8),
    never the player's choice, so the deploy screen does not draw it. The
    fight's playback does: that is where the rows are seen at work;
  - **the roster** (below);
  - **the action box** — the upgrade popup's cost box: the supplies' price
    on top, **Attack** under it with **Quick deploy** beside it, and the
    expected losses as its hint line.
  - **No reward on this screen**: it is the card's.
- **Choosing the army** is a **roster** fixed under the boards — no panel
  rises, no slot is picked:
  - **Troops: one round per unit type** — the board's medallion, how many
    are still at home on it, and the unit's name under it.
  - **A tap sends one squad**: up to that type's `squadSize`, into the next
    free troop slot — six of anything. Tapped again, it sends another squad
    beside the first.
    - *200 Warriors, `squadSize` 50: the first tap puts 50 on the board and
      leaves 150; the second puts 50 more beside them and leaves 100.*
    - The last squad takes what is left, if it is less than `squadSize`.
  - **Heroes: one card per hero** — illustration, level and HP bar. A tap
    toggles it: in, it wears a green check and takes the next hero slot;
    tapped again, it leaves. A hero at 0 HP is greyed and refuses.
  - A tap that cannot place — no one at home, every slot full, a locked
    hero slot — does nothing and says why in one line.
  - **Quick deploy** fills the board with the strongest legal party, answering
    the lair's creature first.
- A tap on a filled slot of **your board** empties it: a squad goes back home,
  a hero leaves.
- The board above only shows the party; it takes no input of its own beyond
  that.
- **On victory** the lair's model, bubble and zone fade from the map when the
  playback closes.
- **No raid widget.** The right-edge pill of the gate
  ([`18`](../features/18-garrisons-and-raids.md) §7) is gone; the bubble is
  the lair's only indicator.
- **No raid report.** What the raids took is the hoard, and the hoard is on
  the card as part of the reward.

## 7. What leaves the province

- **Depths, rooms and bosses** — the whole of
  [`11-expeditions.md`](../features/11-expeditions.md) §1–§7 and the depth
  stack, room ladder and room widget in
  [`11a-ruins-ui.md`](../features/11a-ruins-ui.md). They move to the world
  map's dungeons as the repeatable design.
- **Every reward only a room paid**: the per-room Knowledge, Hero XP, Stardust
  and Gold; the boss chests and their hero fragments; the permanent generation
  on a depth's completion; the Golden pack of a bottomed ruin.
  **These are not compensated**: the gap is argued when the world map's
  dungeons arrive (OQ-111).
- **The Adventurers' Guild**, whose only job is opening depths.
- **A ruin's artifact and affinity.** The creature is the lair's `threat`.

**Docs this rewrites when it is taken:** `18` (it becomes the lairs' doc),
`11` and `11a` (to the world map), `01` §6, `07` §3 and §7 (the Knowledge
sources), `09` (the Golden pack source), `19` §8 (the dungeon takes the depth
design), `combat.md` (callers), `buildings.md` (the Guild), the overview
(promise 1 loses *three raids per camp at most* and *handed back in full*).

## 8. Dials, in the order to reach for them

| Dial | Recommended | Where |
|---|---|---|
| a lair's `radius` | 1 · 1 · 2 · 2 · 3 | `?dev=data#map` |
| a lair's guard: threat, power, first-raid warning | [`18`](../features/18-garrisons-and-raids.md) §2 | `?dev=data#map` |
| raids a day | 3 | `raid.perDay` (`exploration`) |
| raid window, local hours | 9–23 | `raid.windowStartHour`, `raid.windowEndHour` (`exploration`) |
| Hero XP per tier on a clear | the gate's today | `garrisons` |
| first-clear Knowledge | 15 | `delve.firstClearKnowledge` |
| take seconds, take fraction, supplies | [`18`](../features/18-garrisons-and-raids.md) §8 | `garrisons`, `exploration` |

## 9. Deliberately not in this design

- **A repeatable lair.** Repeatable content is the world map's dungeon.
- Anything behind the lair: depths, rooms, a boss, a Guild.
- A lair found through the scrim: only a Revealed cell discovers it.
- A zone that grows, moves or spreads; a lair that respawns elsewhere.
- A zone on fog: the fog inside is bought like any other.
- Buying a lair away: a Gem clear, an ad that lifts a zone.
- A loot table or a chest on a lair.
- A home defence, a wall, a raid fought at home.
- A trip limit; a hoard with no cap; a lair that stops raiding.
- Raids at night, or at a time the player picks.
- Showing a raid count.
- A screen-edge raid pill, a notification dot, a raid report.
- The enemy's composition on the lair's card.
- A picker panel over the board; choosing which slot a squad takes.

**Open questions:** OQ-109, OQ-110, OQ-111, OQ-112 in
[`../open-questions.md`](../open-questions.md).
