# 10 · Heroes, the collection substrate and the gacha

> **Scope.** The thirty-two heroes, what one does on the battle board, how it
> levels and ascends, the hero slots, and the two-banner gacha. Relics are
> [`09-relics.md`](09-relics.md); where heroes fight is
> [`11-expeditions.md`](11-expeditions.md) and how the fight resolves is
> [`combat.md`](combat.md) §9.
>
> **Status: built** — the gacha (§6); the nav tab, the roster grid, the hero
> card and the reveal screen (§8); the stat block and the type passive on the
> board (§2.3, §2.4), the skills (§2.5) and the boons (§2.6); the whole ladder
> (§4); the Gem-bought hero slots (§3); and the **Tavern**, whose standing
> opens the Heroes tab and the banner. **Not built:** the rarity multipliers
> (§2.1) — every hero's numbers are authored whole in `heroes` — and the banner
> moving into the Tavern (§8.3).

## 1. The collection substrate

- Heroes and relics are the game's two collections, and **they are built to
  feel different** ([`09-relics.md`](09-relics.md) §1). A hero is a **ladder**:
  collect → the ascension caps the level → a currency buys levels inside the cap →
  equip into limited slots. A relic is an **album**: its own nine cards a
  season, completed once, and a permanent level with no cap and no slot.
- A hero's ascension is **five stars of six points** — thirty ascensions —
  and each **full star** is worth **eight levels**, up to **level 50**. A
  relic's ladder never ends.
- The currencies differ by type. A hero levels on **Hero XP** and ascends on
  **Fragments + Stardust**; a relic is levelled by **cards** and nothing else,
  so the toll is Stardust's only sink (**OQ-78**). **OQ-6.**
- The two meet twice: an album pays **keys**, and the collection prize is a
  golden call guaranteed to be the **season hero**
  ([`09-relics.md`](09-relics.md) §5, §10).

## 2. The hero

Each hero carries a **rarity**, a **unit type**, a **stat block**, one
**passive**, a **level** and an **ascension**.

### 2.1 Rarity

- **Rarity multiplies the stat block and the passive, and picks the pool.**
  Nothing reads rarity at combat time.
- **A Legendary also carries a BOON** (§2.6) — one kingdom passive no other
  rarity has. That is the one place rarity is a mechanism, and it is
  deliberate: a Legendary that was only a bigger number was a thin prize for
  the golden call's 25% slice.

| Rarity | Count | Stat multiplier | Passive multiplier |
|---|---|---|---|
| **Common** | Warden **Shield** 15% every 4.5 s · Quartermaster **Bulwark** +2 DEF · Adventurer **Seasoned** +20% · Bard **War cry** +5% damage · Beastkin Hunter **Ambush** 100% every 3.5 s · Cleric **Mend** 10% every 3.5 s · Cook **Vigour** +5% HP · Gardener **Wave** 3% every 5.2 s · Joker **Daze** 1 s every 4.5 s · Merchant **Plunder** +15% · Priest **Field medic** +10 · Rogue **Sharpshot** 80% every 3.5 s · Three Mice **Volley** 25% every 4.5 s · Sellsword **Cleave** 60% every 3.5 s |
| **Rare** | Scholar **Lore** +25% · Relic-hunter **Plunder** +30% · Dark Knight **Crush** 120% every 3.5 s · Paladin **Shield** 25% every 4.5 s · Wizard **Volley** 40% every 4.5 s · Witch **Mend** 15% every 3.5 s · Druid **Wave** 5% every 4.5 s · Ice Lancer **Daze** 2 s every 3.5 s · Holy Warrior **War cry** +8% damage · Savage Warrior **Cleave** 80% every 2.5 s · Spymaster **Ambush** 120% every 2.5 s · Electric Archer **Sharpshot** 100% every 2.5 s |
| **Legendary** | Ranger **Sharpshot** 150% every 2.5 s · Golden Dragon **Cleave** 120% every 4.5 s · Vampire Lord **Crush** 180% every 2.5 s · Necromancer **Volley** 60% every 4.5 s · Pharaoh **War cry** +15% damage · Elven Princess **Wave** 6% every 4.5 s |

- Below Legendary, a Rare is a Common with bigger numbers, so a duplicate role
  is a real choice about stats rather than a second vocabulary.

### 2.2 The roster

- **Common** — Warden, Quartermaster, Adventurer, Bard, Beastkin Hunter,
  Cleric, Cook, Gardener, Joker, Merchant, Priest, Rogue, Sellsword, Three
  Mice.
- **Rare** — Scholar, Relic-hunter, Dark Knight, Paladin, Wizard, Witch, Druid,
  Ice Lancer, Holy Warrior, Savage Warrior, Spymaster, Electric Archer.
- **Legendary** — Ranger, Golden Dragon, Vampire Lord, Necromancer, Pharao,
  Elven Princess.

*Ranger* was *Scout*; the Guild's room-threat preview owns that word
([`11-expeditions.md`](11-expeditions.md) §3).

### 2.3 It fights

- A hero occupies a **hero slot** on the board and attacks like a squad of one:
  `atk`, `dmg`, `def`, `hp`, `cooldown`, `frontage = 1`, `alive = 1`
  ([`combat.md`](combat.md) §9.1).
- Its type sits in the matchup chart on both sides, as attacker and as target.
- **Balanced to ~70% of a full squad's output at equivalent investment.** The
  hero is a second body and a buff, not the army.
- Attack and Defence are ratings, read against the other side's by the
  Heroes III rule ([`combat.md`](combat.md) §7); Damage is what its blow takes off.
- `atk`, `dmg`, `def` and `hp` grow per level (`atkPerLevel`, `dmgPerLevel`,
  `defPerLevel`, `hpPerLevel`); `cooldown` does not move.
- It dies at 0 HP and stops attacking. Nothing is permanent: the party is whole
  again when the fight ends.

### 2.4 The passive

- **A hero buffs the troops of its own type**, every squad of that type on its
  side of the board, regardless of slot or row. Nothing else.
- Three numbers, authored per hero: `troopDmgMult`, `troopHpMult`,
  `troopDefBonus` (flat, because `def` is a rating). A hero leans
  one way — a Warden's Warriors hold, a Sellsword's Warriors hit — which is
  what tells two heroes of one type apart.
- Several heroes of one type add on the excess: `1 + Σ(mult − 1)`.
- Computed at battle start; it **stands if the hero dies**.
- **The passive does not grow.** Level and ascension both move the body
  (§4.2).
- A hero on a board with no troops of its type fights and buffs nobody.

### 2.5 The skill

- **Every hero has one SKILL, and it acts only in the fights the hero is
  in.** Owning a hero gives nothing; sending it does. A villain carries one
  too, by the same rules ([`combat.md`](combat.md) §9.3).
- **No skill twice within a rarity.** A skill may appear in several rarities,
  stronger in the higher one (a data rule).
- **Six kinds**: Strike, Heal, Shield, Daze fire on their own clock; a Rally
  holds for the whole fight; Spoils pay when the fight is won. Their
  variants and how each fires are [`combat.md`](combat.md) §9.3.
- **Spoils**, when the fight is won, whether the hero survived it or not:
  - **Plunder**: +X% of a lair's hoard (when it falls) and of a world fight's
    Gold.
  - **Lore**: +X% Knowledge — a lair's first-clear lump, a world room's.
  - **Seasoned**: +X% Hero XP.
  - **Field medic**: +X points of the fallen carried home wounded, capped as
    the wounded share is ([`combat.md`](combat.md) §4).
  - Two heroes' spoils add up.

| Rarity | Hero · skill (rank 1) |
|---|---|
| **Common** | Warden **Shield** 15% every 4.5 s · Quartermaster **Bulwark** +2 DEF · Adventurer **Seasoned** +20% · Bard **War cry** +5% damage · Beastkin Hunter **Ambush** 100% every 3.5 s · Cleric **Mend** 10% every 3.5 s · Cook **Vigour** +5% HP · Gardener **Wave** 3% every 5.2 s · Joker **Daze** 1 s every 4.5 s · Merchant **Plunder** +15% · Priest **Field medic** +10 · Rogue **Sharpshot** 80% every 3.5 s · Three Mice **Volley** 25% every 4.5 s · Sellsword **Cleave** 60% every 3.5 s |
| **Rare** | Scholar **Lore** +25% · Relic-hunter **Plunder** +30% · Dark Knight **Crush** 120% every 3.5 s · Paladin **Shield** 25% every 4.5 s · Wizard **Volley** 40% every 4.5 s · Witch **Mend** 15% every 3.5 s · Druid **Wave** 5% every 4.5 s · Ice Lancer **Daze** 2 s every 3.5 s · Holy Warrior **War cry** +8% damage · Savage Warrior **Cleave** 80% every 2.5 s · Spymaster **Ambush** 120% every 2.5 s · Electric Archer **Sharpshot** 100% every 2.5 s |
| **Legendary** | Ranger **Sharpshot** 150% every 2.5 s · Golden Dragon **Cleave** 120% every 4.5 s · Vampire Lord **Crush** 180% every 2.5 s · Necromancer **Volley** 60% every 4.5 s · Pharaoh **War cry** +15% damage · Elven Princess **Wave** 6% every 4.5 s |

- A fight lasts ten seconds or more ([`combat.md`](combat.md) §5), so a
  timed skill fires every 2.5–5 s.

#### 2.5.1 Ranks

- **Five ranks.** Rank 1 comes with the hero.
- **A rank UNLOCKS at a level and is then BOUGHT** with Stardust and the
  skill family's precious material. It is never raised on its own.
- The unlock levels are the first past a star's level cap, so each rank asks
  for an ascension too:

  | Rank | Unlocks at level | Stars | Stardust | Material |
  |---|---|---|---|---|
  | 2 | 11 | 1 | 100 | 2 |
  | 3 | 19 | 2 | 200 | 4 |
  | 4 | 27 | 3 | 400 | 8 |
  | 5 | 35 | 4 | 800 | 12 |

- **Each rank adds 25% of the rank-1 value**: rank 5 is twice rank 1. What
  grows is the X; never how often it fires.
- **The material is the family's**: Strike → Starmetal; Heal, Shield →
  Moonglass; Rally, Daze, Spoils → Heartwood. **While the world is shut** a
  rank asks for Stardust alone ([`19-world-map.md`](19-world-map.md) §7.6).
- Each axis has its own key: a level is Hero XP, an ascension Fragments and
  Stardust, a rank Stardust and material.
- **Hero XP comes from the world**: a lair pays its tier once; a dungeon
  room, a camp and a Portal floor pay it for good
  ([`19-world-map.md`](19-world-map.md) §8.1).

### 2.6 The boon

> **Built.** Design and rationale:
> [`../proposals/legendary-boons.md`](../proposals/legendary-boons.md).

- **Every LEGENDARY carries one kingdom passive, and no Common or Rare does.**
  It is what a Legendary is for; the stat block and the type passive are only
  bigger numbers.
- It is **on while the hero is OWNED** — no slot, no equip, no party — and it
  is a modifier at the base stage, in the same stack a relic uses.
- **Always a multiplier, always above 1.** A speed, a yield or a capacity,
  never a discount, a cost or a time: a flat bonus is worth less every hour the
  kingdom grows, and a falling number has a floor, which is a ceiling on a
  passive that never ends. Where the game owns a TIME, the boon owns the SPEED
  and the call site divides by it.
- **A boon never scales.** Level and ascension move the body; the boon is
  what arrives with the hero.
- **Boons stack; a duplicate adds nothing.** Two Legendaries are two heroes —
  unlike a party trait, which is best-of.
- The six:

| Hero | Boon |
|---|---|
| **The Pharaoh** | the builders work **20% faster** |
| **The Elven Princess** | the kingdom makes **25% more Mana** |
| **The Necromancer** | every lump of Knowledge is **25% bigger** |
| **The Scout** | explorers march **25% faster** |
| **The Vampire Lord** | every room teaches your heroes **25% more** |
| **The Golden Dragon** | every unit you field has **10% more health** |

- The **sentence is generated** from the stat and the number, never authored
  beside them — the technology card's rule, for the same reason.
- **It breaks §2.1 on purpose**: rarity is now a mechanism, for one rarity.
  §10's line holds — a boon acts on the kingdom, and the combat one is a
  multiplier in the `Drill` the resolver is already handed, so nothing reads
  rarity at combat time.

### 2.7 The party rule

- **A lair takes soldiers alone, or soldiers with heroes — never a hero
  alone** ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)). A
  party with nobody in it is refused. The kingdom owns no hero until the Tavern's first
  call, so the first fights are soldiers alone.
- **An army on the world map needs a hero** to lead it.
- In the province a hero is never *busy*. Fights resolve on entry; what
  limits leading every fight with the same hero is its HP (§2.8).
- **On the world map a hero in an army is busy** for the army's whole march
  and the action at the end of it
  ([`19-world-map.md`](19-world-map.md) §4).

### 2.8 Wounds carry over

- **A hero keeps the damage a fight did to it**, win or lose, and walks into
  the next fight with the HP it has left.
- **HP comes back on its own**, linearly: a whole bar every
  `party.heroRecoverHours` (8), so a hero at half is whole in 4 hours.
- It is kept as a **share of the bar**, so a level gained while hurt raises
  the ceiling and keeps the same share missing.
- **A hero a fight takes to 0 HP is EXHAUSTED**: it cannot be sent anywhere
  until its HP is full again — a whole `heroRecoverHours`. Quick deploy and
  the opening party leave it out.
- The attack screen shows every hero's current HP as a bar along the foot of
  its card, in the party and in the roster; the Heroes screen shows it on every
  owned hero's tile.
- **An exhausted hero is shown asleep**, on both screens: its art darkened
  (never the unfound silhouette), three white Zs rising off its top-right,
  and how long the rest has left over its HP bar.
- Villains carry nothing between fights.

## 3. The hero slots

> **Built.** A party fields one hero per slot, and the battle
> screen's hero row is where they are picked
> ([`11a-ruins-ui.md`](11a-ruins-ui.md) §2.6).

- **One hero slot is free. Every further one is Gems, always** — up to the
  board's three ([`combat.md`](combat.md) §3).
- Price: `party.heroSlotGemCostBase × party.heroSlotGemCostGrowth^n`,
  the escalating-slot curve builders use, with a higher
  base because a hero slot carries a type buff as well as a body. They sit under `party.*` rather than `heroes.*`
  because that key is the Heroes SHEET.
- **It is the only slot in a party that is sold.** Every troop slot on the
  board is open from the first fight ([`combat.md`](combat.md) §3).
- A second hero is worth two things: a second buffed type, and a second body on
  the board.

## 4. The ladder

| | Raise | Cost |
|---|---|---|
| **Recruit** | not owned → owned, no star, level 1 | **10 of that hero's Fragments** |
| **Level** | +1, up to the ascension's cap | Hero XP: `round(100 × 1.09^level)` — 109 for level 2, 6,822 for level 50, **81,412** for the whole ladder |
| **Ascension** | +1 point of the current star: **every stat +2%**; a **full star** also lifts the cap **+8 levels** | that hero's Fragments **and** a Stardust toll |

### 4.1 Two doors to a hero

- **A call hands over either a hero or fragments of one. They are different
  prizes**, and both end at the same place: **ten fragments recruit the hero
  outright.**
- Without that second door, fragments of a stranger pile up against a door
  with no handle, and §4's promise that every drop has a play-based route is
  only true for heroes the banner has already given you.
- **A call that brings them to ten recruits on the spot**, in the reveal
  (§8.3). Fragments from anywhere else wait for the roster's Recruit button.
- **Recruiting is not an ascension.** A hero recruited with fragments starts
  with every star empty, exactly as a pulled one does. Change on a bigger pile
  carries over.

### 4.2 The stars

- **Five stars, six points each.** One ascension fills one point; points fill
  clockwise from the top, and a star is finished before the next one starts.
- **Every point lifts Attack, Damage, Defence and HP by 2%** of what the level gives —
  +60% with every star full. The card, the board, the power estimate and the
  HP bar all read the one formula.
- **Only a full star moves the level cap**: 10 with no star, +8 a star, 50 at
  five.
- **Every point of a star costs the same**, and each star costs twice the one
  before.

| Star | Fragments a point | Stardust a point | Cap once full |
|---|---|---|---|
| 1 | 1 | 4 | 18 |
| 2 | 2 | 8 | 26 |
| 3 | 4 | 16 | 34 |
| 4 | 8 | 32 | 42 |
| 5 | 16 | 64 | **50** (max) |
| **All 30** | **186** | **744** | |

- **Hero XP is a kingdom currency**, one counter spent on any hero. It survives
  a region reset like Stardust. Nothing is local to a hero: a Legendary pulled
  today is levelled with the XP the Commons earned.
- **The XP curve flattens because the ladder is long**: the growth carries
  the length and the TOTAL is what is held steady. Whether that survives a
  playtest is **OQ-79**.
- **Fragments are per hero**, a counter beside the hero, as today.
- The Stardust toll totals **744** to max one hero. The toll is **Stardust's
  only sink**; whether the trickle is oversized is **OQ-78**.
- **Every gacha drop has a play-based route.** Fragments fall from boss chests
  (not built, **OQ-80**) as well as from calls; the wallet buys the same hero
  sooner, never alone.

## 5. Where the currencies come from

Every faucet is a fight or a banner. Room and floor amounts are
[`19-world-map.md`](19-world-map.md) §8.1 and §10.

| Currency | Source |
|---|---|
| **Hero XP** | every lair cleared · every world-map dungeon room and Portal floor |
| **Fragments** | a duplicate or a miss on a call · boss chests, from a per-boss pool (not built, OQ-80) |
| **Stardust** | every dungeon room and Portal floor · **every call, hero or not** · the quest chain and the Survey |

- The chain is **army → hero → lairs and dungeon rooms → XP and Stardust →
  levels.** A player who never fights makes no progress on the
  weeks-long arc. **OQ-41.**

## 6. The gacha

### 6.1 Two banners, two keys

- **A pull is priced in a key, not in Gems.** Gems buy keys in the store;
  keys are the only thing a call spends.
- Both banners are always open. They are drawn as two cards on one screen,
  because choosing between them is a price comparison.

| | **The common call** | **The golden call** |
|---|---|---|
| Key | Silver | Gold |
| A key costs | **500 Gems** | **1,500 Gems** |
| Base hero chance | **6%** | **12%** |
| Soft pity from | pull 40 | pull 30 |
| A hero guaranteed at | pull **60** | pull **50** |
| A Legendary guaranteed at | — | pull **40** |
| Rarity weights | 80 Common / 20 Rare | 75 Rare / 25 Legendary |
| Pool | ~26 heroes | ~18 heroes |
| A duplicate pays | 20 Fragments | 40 Fragments |
| A miss pays | 3 Fragments | 6 Fragments |
| Every call pays | 50 Stardust | 150 Stardust |
| Free calls a day | **5**, one every 5 minutes | **1** |

- **A banner's rarity weights are its pool.** A weight of zero excludes a
  rarity, so no banner needs a pool field: Common is common-call only,
  Legendary is golden-call only, and Rare is in both.
- **The golden call is the only door to a Legendary**, and its ordinary pull is
  already stronger — a Rare floor against a Common one.
- **The first call on the common banner is free.** The button reads
  **"Call — free"**, not a price of zero; a ten-call over it charges nine.

### 6.2 The free call

- **The first call on the common banner is free and always a hero**: only the
  hit is forced, the hero is still the roll's
  ([`22-progression.md`](22-progression.md) §6).
- **The first two calls, counted across both banners, are each a new hero**
  (`heroLadder` › `firstCallsNewHero`): the hit is forced and the hero is one
  not yet owned.
- **The banner hangs in the Tavern.** Until a Tavern stands, the Heroes tab
  and the Store's banner are padlocked. **The kingdom starts with no hero**:
  its first is this free call, and no hero is ever granted by the story.
- A rewarded video pays for a call: **five a day on the common banner, one on
  the golden one**.
- The common banner spaces its five by a **5-minute cooldown**; the golden one
  has none, because a cap of one a day is already the whole rule.
- The allowance is stamped with the UTC day and rolls over lazily on the next
  read — the same stamp-plus-counter shape the monthly budget uses.
- **The free call is not a boundary source.** `advance()` never touches the
  ledger: a recurring 5-minute timer would propose thousands of boundaries
  across a long absence. It is read on demand and written only by a live claim.
- This is what keeps a Legendary reachable without a wallet: ~30 free golden
  calls a month.

### 6.3 The two pities

- **Pity is mandatory and always visible.** A hidden pity counter is the same
  as no pity counter.
- **A hero pity** ramps the rate from the soft-pity pull to a certainty at the
  hard one, and resets on any hero.
- **A Legendary pity** runs only on the golden banner, increments on **every**
  call, and resets only on a Legendary.
- **No dead pulls.** A duplicate converts to Fragments. A miss pays Fragments
  and Stardust.
- **Rolls are a deterministic hash of `(seed, namespace, bannerId,
  pullNumber)`**, not a stream — one draw for hit/miss, one for rarity, one for
  the hero within it.
- **The pool prefers a hero the player does not own**, so breadth comes before
  a duplicate.

### 6.4 The ten-call

- **×10 is ten calls at ten keys**, no discount: the value of a batch is the
  pity it walks, not a price break.
- It refuses up front if the purse cannot pay all ten — never a partial batch.
- Both pities carry across the ten, and each call rolls with its own pull
  number, so a batch is identical to ten taps.

- **The gacha sells power.** A Legendary is stronger than a Common, and the
  golden call is how one is reached — by a wallet, or by the daily free call
  ([`14-monetization.md`](14-monetization.md) §1).

## 7. Expandability

Each of these is data, not code:

| Want to ship | Costs |
|---|---|
| A seasonal hero | one `heroes` entry (rarity, type, stat block, passive) plus its portrait |
| A third banner | one `banners` entry — its weights are its pool |
| Rebalancing a banner | its entry: odds, both pities, weights, key price, free calls |
| Rebalancing the hero's share of a fight | the rarity multipliers and the 70% target, in `heroes` |
| A new relic | one `artifacts` entry + **its** album in the seasons file ([`09-relics.md`](09-relics.md) §3) |

## 8. The screens

- **Heroes have a nav tab of their own**, beside the Collection. A roster of
  thirty-two and five albums of nine cards are two screens with two jobs; the
  one thing they share is the reveal ([`09-relics.md`](09-relics.md) §11.5).

### 8.1 The roster

- **The hero picker's window without the party** (§8.4): the same filter
  bar (All, one tab per unit type, the sort by level or rarity), the same
  cards three to a row, scrolling on their own.
- **Owned first**, in the picker's order, **then the heroes not found yet**,
  in roster order — both under the type filter.
- A card carries the portrait on its **rarity's face** (blue → violet →
  gold), its **unit type** on a banner top-left, its **level** and
  **ascension stars** at the foot, and its **HP**.
- **An unfound hero is the same card on warm stone**: a dark silhouette, and
  its **fragments** against the ten that recruit them in place of the level.
- **A green orb** on any card that can take a level, an ascension or a
  recruit right now.
- One line over the grid: how many of the roster are found.
- One button under it: **Call for aid**, into the banner.
- **The two purses this screen spends from ride on the game's own plank while
  it is open** — Hero XP and Stardust, in place of the city coins.

### 8.2 The card

- Opened by tapping a card; a **centred window** with the hero's **name on
  its plank** and the close that goes back to the roster.
- **The header** carries the **rarity** on a cloth ribbon at its left end
  and the **unit type** on a small banner before the close; a long name sets
  smaller to fit between them. The hero's title is not shown.
- **The stage** under the header, the card's largest piece: the hero on its
  rarity's painted vault, the full width of the window, fading into the
  paper at its foot.
- **Stats** on the stage, a column down its left edge beside the hero:
  Attack, Damage, Defence and Health, each its icon beside its label over
  its value, in white with no background. A stat that rose — a level, an
  ascension — punches, and its gain floats up beside it in green.
- **Ascension**, on the stage with no background of its own (owned heroes
  only): the five stars in its top-left corner, and **Ascend** with its
  Stardust toll and fragment count over it at its foot, right. Every star
  full: no button.
- Then one tile each, with no section head — only the boon keeps one; the
  card fits the screen without scrolling:
  - **Skill** — one widget: its name, its rank pips and what it does at its
    rank; at its foot the next rank's price and **Upgrade** (what the next
    rank does is not shown), or a padlock saying what is missing (*Reach
    level 11*, *Ascend, then reach level 19*). A rank that can be bought now
    lights the card's orb. A rank bought punches its new pip and every number
    in the sentence that grew, and the gain floats up beside the pips in
    green.
  - **Kingdom boon** — on the six that have one.
  - On the roster, a skill past rank 1 shows as a brass numeral on the card.
  - **Level** — *Level n of cap* over a green bar, and **Level Up** with its
    Hero XP price over it. At the ascension's ceiling the button is gone and
    the tray shows *Ascend to* over the stars to reach — the next star full; at the last level, *At the
    ceiling*.
- **An unowned hero gets the same card**, stats and passive and all, without
  Ascension, on a stone stage with a silhouette. **Fragments** takes the
  Level section's place — *Fragments n of 10* over the bar — with **Call for
  aid** into the banner, which becomes **Recruit** once ten have piled up.

### 8.3 The reveal

What a call paid, opened from a chest — the only screen in the game that
covers everything but the rewarded video. Mockups `m99a`–`m99d`.

- **A stage of its own**: a treasure hall at night, torches, a red carpet.
  The kingdom is not seen behind it.
- **The chest says where the rewards come from**: silver-bound for the common
  call, gold for the golden call, violet for a relic fragment pack, a rope-tied
  war chest for spoils. Every reveal of RANDOM rewards uses it.
- **The sequence**:
  1. the chest drops onto the carpet with a count of the cards inside and
     opens on its own — the player already paid;
  2. the first card rises face down — *Tap to reveal*;
  3. a tap flips it;
  4. the next tap sends it to its own place on the stage — smaller and
     dimmed — while the next card rises.
- **The cards are papers**, in the research book's materials: the back an
  aged sheet with a medieval ink drawing that says how rare the card is before
  it turns — a plain rule (no rarity), a compass rose (Common), knotwork and
  blue leaves (Rare), an illuminated border with a crowned sun in red and gold
  (Legendary); a reward a torn page
  with the name in ink under a thin rule; a whole hero the roster's own card
  (its rarity's face in the thin gilt frame), its name on a parchment slip and
  NEW in red wax on its corner.
- **A hero not yet recruited is a silhouette** on their fragments card, as
  on the heroes menu; a recruit's turns to colour as the seal lands.
- **Fragments show where they leave the hero**: a bar under the card fills
  from what was held to what is held now — toward recruiting (gold) or the
  next ascension point (blue).
- **A bar that reaches the recruiting price recruits the hero**: it flares,
  the NEW wax seal is pressed onto the card, and the hero is celebrated as a whole one.
- **The places are the summary.** When the last card lands the chest sinks
  away, every card lights up, a *Rewards* plaque and **Collect** appear. No
  separate receipt is drawn.
- **A ten-call condenses.** Same thing, one card with a count: ten calls
  paying 50 Stardust each are one 500, and four fragments of one hero are one
  stack of four.
- **Heroes come last**, so the sequence arrives at what the player called for.
- **A whole new hero is the rarest thing in a chest, and is celebrated.**
  Before the flip its card back glows and trembles in its rarity over a drum
  roll (a Legendary's longer). The flip darkens the room, flashes, shakes the
  screen, raises rays, fires two confetti cannons, rains confetti, sets off
  fireworks round the card and plays a full fanfare (a Legendary's grander,
  with applause); a plaque — *A new hero answers* / *A legend answers* — and
  the hero's name, title and rarity. The celebration cannot be tapped away
  in its first second. A relic's keystone glows the same way before its flip.
- **A tap during an animation finishes it.** **Skip** deals every other card
  at once and still stops at each new hero.
- A duplicate is **not** drawn as a hero. It already paid its fragments, and a
  hero card would promise a roster entry that is already there.
- Every beat has its sound (land, latch, lid, draw, flip, whoosh, settle,
  sparkle, riser, pop, fanfare, applause, summary chime) and its particles (dust, sparks,
  confetti, embers). Reduced motion keeps the beats and drops the motion.
- **The music changes while a chest is open**: the harp fades out under a
  lively tavern tune, which ducks under a hero's fanfare; Collect fades the
  harp back in where it was. The music mute silences both.
- **The banners sit on the store**, padlocked until a Tavern stands. Moving
  them into the Tavern — **tapping it is how one is called**
  ([`14-monetization.md`](14-monetization.md) §2.1) — is designed, not built.
- **The keys stay in the store**, one Gem-priced card each. The store is where
  a currency is bought; the Tavern is where a key is spent.
- Each banner card shows, always: the chance right now, the calls to a
  guaranteed hero, the calls to a guaranteed Legendary where there is one,
  **two buttons side by side**, and a line saying how many keys the player
  holds and how much of today's free allowance is left.
- **The free call is not its own button.** It is one of three faces the ×1
  slot wears, in this order: **Free** when the call costs nothing, **▶ Free**
  when an ad will pay for it, and **Call ×1** with its price otherwise. A call
  that is already free never asks for an ad.
- When the ×1 slot is not free it says when it next will be — *Free in 3m 32s*
  inside the button while the cooldown runs, *Free tomorrow* once the day's
  allowance is spent. The ×10 is always the ten and always priced.
- **Heroes are put on the board in the party composition sheet**
  ([`11a-ruins-ui.md`](11a-ruins-ui.md) §2.6), which also sells the next hero
  slot, the way the store sells the next builder. The roster is where a hero is
  GROWN; the party sheet is where one is SENT, and neither does the other's
  job.

### 8.4 The hero picker

One popup for every place the game asks for heroes. Whoever opens it passes
how many slots it wants (1…n) and what to do with the answer.

- **The hero card** it is built from — the one card a hero is wherever it is
  offered or seated, 2:3:
  - the illustration filling it, on its **rarity's colour**;
  - the unit type's icon, top left;
  - its level and its ascension stars at the foot;
  - its HP bar inside the frame over the foot — the game's progress bar;
    on a small card, the small HP bar hung over the bottom edge;
  - a green check, top right, when it holds a slot;
  - exhausted (§2.8): asleep — darkened, the Zs rising, the rest's countdown.
  - No name: the illustration is enough.
- **Top**: the filter bar — `All`, then one tab per unit type heroes fight
  as — and the sort (level ↔ rarity).
- **Middle, scrolling**: every hero the kingdom owns, three cards to a row,
  under a text heading.
- **Bottom, fixed**: the slots asked for, in a green head panel `Party n/m`;
  an empty one is a sunk slot with a faint +.
- **Select** hands the heroes back, in slot order. The window's close leaves
  without an answer. Either way the screen that opened it comes back.
- **Taps**:
  - a hero in the list goes into the first free slot, or out of the slot it
    holds;
  - a filled slot empties;
  - no free slot, or an exhausted hero: an error sound, nothing moves.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| A hero's stat block and growth | §2.3 | `heroes.atk`, `dmg`, `def`, `hp`, `cooldown`, `atkPerLevel`, `dmgPerLevel`, `defPerLevel`, `hpPerLevel` |
| A hero's passive | §2.4 | `heroes.troopDmgMult`, `troopHpMult`, `troopDefBonus` |
| The rarity multipliers | ×1.0 / ×1.2 / ×1.5 · ×1.0 / ×1.25 / ×1.75 | `heroes.rarityStatMult*`, `heroes.rarityPassiveMult*` *(not built)* |
| What a level costs in XP | §4 | `heroLadder.xpLevelCostBase`, `heroLadder.xpLevelCostGrowth` |
| How many ascensions | 5 stars × 6 points | `heroLadder.ascensionStars`, `heroLadder.ascensionStepsPerStar` |
| What a point does to the stats | +2% Attack, Damage, Defence and HP | `heroLadder.statsPerAscension` |
| How long a hero's ladder is | 8 a star, 50 in all | `heroLadder.heroLevelsPerStar`, `heroLadder.heroMaxLevel` |
| What a recruit costs | 10 Fragments | `heroLadder.recruitFragments` |
| What an ascension costs | §4.2 — 1 Fragment · 4 Stardust a point, ×2 a star | `heroLadder.fragmentsPerStep*`, `heroLadder.ascensionStardustBase`, `heroLadder.ascensionStardustGrowth` |
| How fast a hero's HP comes back | 8 h from empty to full | `party.heroRecoverHours` |
| What a hero slot costs | §3 | `party.heroSlotGemCostBase`, `heroSlotGemCostGrowth`, `party.heroSlots` |
| What a key costs in Gems | 500 / 1,500 | `banners.keyGemCost` |
| The odds and both pities | §6.1 | `banners.heroChance`, `softPityAt`, `hardPityAt`, `legendaryPityAt` |
| What a banner's pool is | §6.1 | `banners.weights` — `Common` / `Rare` / `Legendary` |
| What a miss and a duplicate pay | §6.1 | `banners.fragmentsPerMiss`, `duplicateFragments` |
| What a call pays in Stardust | §6.1 | `banners.pullStardust` |
| The free calls and their spacing | §6.2 | `banners.freePerDay`, `freeCooldownSeconds` |

## 10. Deliberately not in this design

- **An ultimate, energy, or a skill the player triggers.** A skill fires on
  its own; there is no input during a fight.
- **A random skill** — a chance to crit, dodge or proc.
- **A kingdom passive below Legendary.**
- **A skill rank that fires more often.**
- **A hero-only battle mode.** Every fight fields troops and heroes. A hero
  arena is a possible future, not this version.
- **A party-wide stat beyond a Rally.** The type passive buffs its own type;
  only a Rally skill reaches every type.
- **Per-hero XP.** One kingdom counter, or the gacha hands out heroes the
  player cannot use.
- **Guild-gated hero slots**, or a free second slot.
- **A hero that is busy, away, or parked.** Fights are instant.
- **A rarity that changes how combat resolves.** A Legendary's boon (§2.6)
  acts on the kingdom, and the combat one is a multiplier in the `Drill`; the
  resolver never reads a rarity.
- **A gacha currency Gems cannot buy.** The keys are a price on a button and
  a free ad path; nothing else mints them.
- **A discount on the ten-call.** A batch buys pity walked, not a cheaper key.
- **A reveal the player cannot skip**, and a reveal that offers a way out
  before it has finished dealing.
- **A second announcement of a call** — a banner or a toast beside the reveal.
  One call, one screen.
- Standalone equipment with random stats or duplicate fusion.
- **A hero no amount of play can reach** — every rarity is on a free call.
- Rotating or time-limited banners — both are permanent. The **season hero**
  is a rate-up on the permanent golden banner, not a banner
  ([`09-relics.md`](09-relics.md) §10).
- A server-authoritative implementation.

## 11. Known holes

- **What a boon is worth is unproven.** The Scout's `worldRevealSpeed`
  divides an explorer's march time ([`19-world-map.md`](19-world-map.md)
  §3.1); whether ×1.25 is worth a Legendary is **OQ-96**.
- **Rate-up is untested.** The timeline still carries a banner payload and the
  activation query exists, but the two banners are permanent entries, so nothing
  exercises a scheduled one. The season hero
  ([`09-relics.md`](09-relics.md) §10) is its first consumer.

**Open questions:** OQ-6, OQ-41, OQ-78, OQ-79, OQ-80, OQ-96.
