# 11 · Dungeons — depths and rooms

> **Scope.** The depths and rooms of a world-map dungeon: what a room fields,
> what it costs and what it pays. Where a dungeon stands, how an army camps
> there, the race to close it and the delve screen are
> [`19-world-map.md`](19-world-map.md) §8.1–§8.2. Combat resolution, unit
> stats and party rules: [`combat.md`](combat.md). Screens:
> [`11a-ruins-ui.md`](11a-ruins-ui.md).
>
> **Status: built.** One shape for every dungeon, its numbers in
> `worldDungeon` (`?dev=data` › World board).

## 1. Structure

- A **dungeon** → numbered **depths** → numbered **rooms**. One room = one
  fight.
- Every dungeon is `depths` (3) depths of `roomsPerDepth` (8) rooms.
- The last room of a depth is its **boss**.
- Address: `Depth 2 · Room 5`.
- Each player's progress in a dungeon is **the rooms they have cleared**.
  Rooms are cleared in order and never replayed.
- Progress lasts as long as the dungeon: when it closes, everyone's is gone
  ([`19-world-map.md`](19-world-map.md) §8.1).

## 2. What a room fields

- A room's enemy is **generated on its power** (§6) by the resolver's
  generator ([`combat.md`](combat.md) §11), seeded by the dungeon, the depth
  and the room — the same enemy every attempt.
- **Affinity**: each dungeon fields one troop type more than the rest
  (Warrior, Lancer, Archer or Cavalry), rolled when it appears. The creature
  that holds it is the lair creature of that type.
- **A boss room fields villains** ([`combat.md`](combat.md) §9.3) on
  `bossMultiplier` (×1.6) of the room's power.
- Rooms and floors are fought below ground: no terrain rule applies
  ([`19-world-map.md`](19-world-map.md) §4.2).

## 3. Gates

- **Depth 1 is open** to any army that reaches the dungeon.
- **Depth N+1 opens when depth N's boss falls.** Nothing else gates a depth.

## 4. Content

- Nothing is authored per dungeon or per room: every dungeon is the same
  shape, and the numbers in `worldDungeon` make every room.
- A dungeon is named when it appears, from `nameFirst` and `nameSecond`, and
  each depth's boss from `bossNames`
  ([`19-world-map.md`](19-world-map.md) §8.1).

## 5. Attempt flow

1. Send an army to the dungeon; it camps there
   ([`19-world-map.md`](19-world-map.md) §8.1). A hero is mandatory.
2. On the delve screen, **Attack** fights the frontier room at once.
3. **Cleared:** the room pays (§7), the frontier moves on.
   **Failed:** nothing is paid; the room stands.

Rules:

- **Every attempt costs `combat.fightMana` (20) Mana**, paid when the server
  accepts it, never refunded.
- **The room fights back: an attempt costs soldiers, win or lose.** A share
  of the fallen comes home wounded to the Infirmary; the rest are gone
  ([`combat.md`](combat.md) §4).
- **The camped army's losses and its heroes' wounds carry from room to
  room.** To bring fresh troops, withdraw it and send another.
- An army with no hero left walks home.
- No attempt cap, no cooldown (**OQ-75**). A retry is identical to a first
  attempt.

## 6. Power

```
power(D, r) = powerStart(D) + powerStep(D) × (r − 1)
```

- The boss room fields `bossMultiplier` (1.6) times that.
- A depth starts harder than the last room before its boss:
  `powerStart(D+1) ≥ powerStart(D) + powerStep(D) × (rooms − 1)`.
- Shown against the army's power on the delve screen. The outcome is
  [`combat.md`](combat.md)'s.

## 7. Rewards

### 7.1 Rooms — formula

For room `r` of depth `D`:

```
scale     = rewardBase(D) × rewardGrowth^(r − 1)          (× bossRewardMultiplier on a boss)
gold      = 20   × scale
hero_xp   = 30   × scale
stardust  =  2   × scale
knowledge = max(1, 0.25 × scale)
precious  = max(1, 1 × scale)        a lump of one of the three, rolled per room
```

- Every amount is rounded to three significant figures (`roundPrice`).
- `rewardBase` is 1, 2.2, 4.5 by depth; `rewardGrowth` 1.06; a boss pays
  `bossRewardMultiplier` (3) times the formula.
- On top, when it lands: the party's spoils skills (Plunder on the Gold,
  Lore on the Knowledge, Seasoned on the Hero XP), then the Atlas's
  `dungeonLoot` (*Delvers*) on every amount and `worldHeroXp` (*Battle
  Lore*) on the Hero XP.
- Gold goes to the city's purse, Knowledge into the bar over its cap
  ([`07-research.md`](07-research.md) §3), Hero XP and Stardust to the
  kingdom, the lump to the city's goods.

### 7.2 Bosses

- A boss pays its room ×3 and **one world relic fragment**
  ([`09-relics.md`](09-relics.md) §6).
- The first room a player ever clears opens the Delver's Lantern's door, the
  first boss the Muster Horn's ([`09-relics.md`](09-relics.md) §5).
- **Closing the dungeon** — the first to beat the last boss — pays that boss
  again `closeRewardMultiplier` (2) times over, its Hero XP
  `closeHeroXpMultiplier` (20) times over
  ([`19-world-map.md`](19-world-map.md) §8.1).
- What else a boss pays is **OQ-122**.

### 7.3 Depth completion

- Finishing a depth pays nothing beyond its boss room (**OQ-122**).

## 8. Currencies

| Currency | Use | Source here |
|---|---|---|
| Gold | everything in the city | every room |
| Knowledge | research ([`07-research.md`](07-research.md)) | every room, at least 1 |
| Hero XP | hero levels, any hero ([`10-heroes.md`](10-heroes.md) §4) | every room; ×20 on the close |
| Stardust | relic levels, hero ascension | every room |
| Precious materials | late building levels and research ([`19-world-map.md`](19-world-map.md) §7.6) | a lump every room |
| World relic fragments | the world relics ([`09-relics.md`](09-relics.md)) | one every boss |

## 9. Screens

[`11a-ruins-ui.md`](11a-ruins-ui.md), and the delve screen in
[`19-world-map.md`](19-world-map.md) §8.2.

## 10. Dials, in the order to reach for them

| Dial | Key |
|---|---|
| Room power, start and step, per depth | `worldDungeon.powerStart`, `.powerStep` |
| Reward base per depth and growth per room (×1.06) | `worldDungeon.rewardBase`, `.rewardGrowth` |
| Gold, Hero XP, Stardust, Knowledge, precious per room (×20, ×30, ×2, ×0.25, ×1) | `worldDungeon.gold`, `.heroXp`, `.stardust`, `.knowledge`, `.precious` |
| Boss power and reward (×1.6, ×3) | `worldDungeon.bossMultiplier`, `.bossRewardMultiplier` |
| The close's prize (×2, ×20 Hero XP) | `worldDungeon.closeRewardMultiplier`, `.closeHeroXpMultiplier` |
| Depths, and rooms per depth (3, 8) | `worldDungeon.depths`, `.roomsPerDepth` |
| Mana per attempt (20) | `combat.fightMana` |

## 11. Adding content

- A deeper dungeon is `depths` + one more entry in `powerStart`, `powerStep`
  and `rewardBase`. Nothing is authored per room.
- More names: `nameFirst`, `nameSecond`, `bossNames` (the data rules ask for
  two names a sixth of the world).

## 12. Deliberately not in this design

- A dungeon in the province: the province has lairs
  ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)).
- Tiers, or a dungeon authored by hand.
- Supplies, or any price per attempt but Mana.
- A preview of a room's enemy: no room shows it but the boss.
- A gate fight before Depth 1.
- Replaying a cleared room.
- Party HP that resets between rooms.

**Open questions:** OQ-75, OQ-122 in
[`../open-questions.md`](../open-questions.md).
