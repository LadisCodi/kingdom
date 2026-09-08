# 10 · Heroes, the collection substrate and the gacha

> **Scope.** The thirty-two heroes, what one does on the battle board, how it
> levels and ascends, the hero slots, and the two-banner gacha. Relics are
> [`09-relics.md`](09-relics.md); where heroes fight is
> [`11-expeditions.md`](11-expeditions.md) and how the fight resolves is
> [`combat.md`](combat.md) §9.
>
> **Status: the gacha is built** (§6), and so are **the nav tab, the roster
> grid, the hero card and the reveal screen** (§8, built 2026-09-08), and
> **the whole ladder** (§4): **Hero XP buys levels**, ten fragments recruit a
> hero, and an ascension costs fragments plus a Stardust toll. **The hero itself is
> designed, not built — reworked 2026-09-08 onto the resolver**: the stat
> block and the passive (§2), XP-bought levels and the
> Fragment-plus-Stardust ascension (§4), and Gem-bought hero slots (§3)
> replace the delve-era hero the code still carries. **One thing is still ahead of the sim**: the
> card's passive line reads a delve-era trait until Step 8 lands
> ([`../implementation-plan.md`](../implementation-plan.md) §4), which changes
> that one call site and nothing about the layout. The **Tavern**, the
> building heroes arrive through, is designed and unbuilt
> ([`../plans/builder-30-days.md`](../plans/builder-30-days.md) §9).

## 1. The collection substrate

- Heroes and relics share one **ladder shape**: collect → a tier caps the
  level → a currency buys levels inside the cap → equip into limited slots.
- **A tier is worth two levels**; both ladders end at tier 5 / level 10.
- The currencies differ by type. A hero levels on **Hero XP** and ascends on
  **Fragments + Stardust**; a relic levels on Stardust and tiers on ingredients
  ([`09-relics.md`](09-relics.md) §4). No second vocabulary beyond that.
  **OQ-6.**

## 2. The hero

Each hero carries a **rarity**, a **unit type**, a **stat block**, one
**passive**, a **level** and an **ascension tier**.

### 2.1 Rarity

- **Rarity is a multiplier and a pool, never a mechanism.** It multiplies the
  stat block and the passive; nothing reads rarity at combat time.

| Rarity | Count | Stat multiplier | Passive multiplier |
|---|---|---|---|
| **Common** | 14 | ×1.0 | ×1.0 |
| **Rare** | 12 | ×1.2 | ×1.25 |
| **Legendary** | 6 | ×1.5 | ×1.75 |

- A Legendary is a Common with bigger numbers, so a duplicate role is a real
  choice about stats rather than a second vocabulary.

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
  `dmg`, `hp`, `def`, `cooldown`, `frontage = 1`, `alive = 1`
  ([`combat.md`](combat.md) §9.1).
- Its type sits in the matchup chart on both sides, as attacker and as target.
- **Balanced to ~70% of a full squad's output at equivalent investment.** The
  hero is a second body and a buff, not the army.
- `dmg` and `hp` grow per level (`dmg_per_level`, `hp_per_level`); `def` and
  `cooldown` do not move.
- It dies at 0 HP and stops attacking. Nothing is permanent: the party is whole
  again when the fight ends.

### 2.4 The passive

- **A hero buffs the troops of its own type**, every squad of that type on its
  side of the board, regardless of slot or row. Nothing else.
- Three numbers, authored per hero: `troop_dmg_mult`, `troop_hp_mult`,
  `troop_def_bonus` (flat, because `def` is a flat subtraction). A hero leans
  one way — a Warden's Warriors hold, a Sellsword's Warriors hit — which is
  what tells two heroes of one type apart.
- Several heroes of one type add on the excess: `1 + Σ(mult − 1)`.
- Computed at battle start; it **stands if the hero dies**.
- **The passive grows with ascension, not level**: `passive_per_tier` steps
  each of the three numbers at every tier. Level moves the body, ascension
  moves the buff, so both ladders are felt.
- A hero on a board with no troops of its type fights and buffs nobody.

### 2.5 The party rule

- **At least one hero is mandatory** in every fight: gates, rooms, bosses.
  There is no fight without a hero and no hero-only fight.
- A hero is never *busy*. Fights resolve on entry
  ([`11-expeditions.md`](11-expeditions.md) §5), so the same hero leads every
  room the player enters.

## 3. The hero slots

- **One hero slot is free. Every further one is Gems, always** — up to the
  board's three ([`combat.md`](combat.md) §3).
- Price: `heroes.slot_gem_cost_base × heroes.slot_gem_cost_growth^n`, the
  party-slot ladder with a higher base, because a hero slot carries a type buff.
- The Adventurers' Guild opens **depths**, never slots
  ([`11-expeditions.md`](11-expeditions.md) §3).
- A second hero is worth two things: a second buffed type, and a second body on
  the board.

## 4. The ladder

| | Raise | Cost |
|---|---|---|
| **Recruit** | not owned → owned, at tier 1 level 1 | **10 of that hero's Fragments** |
| **Level** | +1, up to the tier cap | Hero XP: `round(100 × 1.6^level)` — **18,060** to carry one hero to level 10 |
| **Ascension** | +1 tier, cap +2 levels | that hero's Fragments **and** a Stardust toll |

### 4.1 Two doors to a hero

- **A call hands over either a hero or fragments of one. They are different
  prizes**, and both end at the same place: **ten fragments recruit the hero
  outright.**
- Without that second door, fragments of a stranger pile up against a door
  with no handle, and §4's promise that every drop has a play-based route is
  only true for heroes the banner has already given you.
- **Recruiting is not an ascension.** A hero recruited with fragments starts
  at tier 1 with the whole ladder below still ahead of them, exactly as a
  pulled one does.
- The price is the ladder's own base rung, so **the recruit and the first
  ascension ask for the same ten** and the player learns one number. Change on
  a bigger pile carries over.

| Ascension | Fragments | Cumulative | Stardust toll | New level cap |
|---|---|---|---|---|
| tier 1 → 2 | 10 | 10 | 50 | 4 |
| tier 2 → 3 | 20 | 30 | 100 | 6 |
| tier 3 → 4 | 40 | 70 | 200 | 8 |
| tier 4 → 5 | 80 | **150** | 400 | **10** (max) |

- **Hero XP is a kingdom currency**, one counter spent on any hero. It survives
  a region reset like Stardust. Nothing is local to a hero: a Legendary pulled
  today is levelled with the XP the Commons earned.
- **The XP curve is five times the relics' Stardust one**, because its faucet
  is: a room pays ×10 XP against ×2 Stardust and the completed-depth trickle
  keeps the same ratio ([`11-expeditions.md`](11-expeditions.md) §7). Same
  pacing, bigger numbers. Whether that holds up in play is **OQ-79**.
- **Fragments are per hero**, a counter beside the hero, as today.
- The Stardust toll totals **750** to max one hero — about a fifth of what a
  relic costs to max (~3,612) — so Stardust stays the relics' currency with a
  hero tax on it, not a second hero currency.
- **Every gacha drop has a play-based route.** Fragments fall from boss chests
  as well as from calls; the wallet buys the same hero sooner, never alone.

## 5. Where the currencies come from

Every faucet is a fight or a banner. Amounts are
[`11-expeditions.md`](11-expeditions.md) §7.

| Currency | Source |
|---|---|
| **Hero XP** | every cleared room · the completed-depth trickle (`10 × tier × depth` /h) |
| **Fragments** | boss chests, from a per-boss pool (OQ-80) · a duplicate or a miss on a call |
| **Stardust** | every cleared room · the completed-depth trickle · **every call, hero or not** |

- **The trickle is gated on completed depths**, not discovered ruins.
- The chain is **army → hero → cleared gate → rooms → XP and Stardust →
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
  rarity, so no banner needs a pool column: Common is common-call only,
  Legendary is golden-call only, and Rare is in both.
- **The golden call is the only door to a Legendary**, and its ordinary pull is
  already stronger — a Rare floor against a Common one.
- **The first call on the common banner is free.** The button reads
  **"Call — free"**, not a price of zero; a ten-call over it charges nine.

### 6.2 The free call

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
| A seasonal hero | one `Heroes` row (rarity, type, stat block, passive) plus its portrait |
| A third banner | one `Banners` row — its weights are its pool |
| Rebalancing a banner | its row: odds, both pities, weights, key price, free calls |
| Rebalancing the hero's share of a fight | the rarity multipliers and the 70% target, on the `Heroes` sheet |
| A new relic | one relic row + one ruin |

## 8. The screens

- **Heroes have a nav tab of their own**, beside Relics. The two share a
  collection LADDER, which was the argument for sharing a screen, but not a
  job: the Reliquary's job is the socket, and a roster of thirty-two under it
  made that decision the smaller half of the page.

### 8.1 The roster

- **A grid of portraits, three across.** Thirty-two heroes, most of them not
  owned, only read as a collection when the gaps are visible; a list of rows
  cannot show them.
- **Rarity is the tile's background**, blue → violet → gold, so the ladder
  reads with no label. An unfound hero loses its rarity for warm stone: a
  locked tile that still glowed gold would advertise a Legendary the player
  cannot act on.
- A tile carries the portrait, its **unit type** top-left, its **level** and
  its **ascension stars** along the foot.
- **An unfound hero shows its fragment count** against the ten that recruit
  them, not a padlock — a silhouette with progress on it is something to want.
- **A green mark** on any tile that can take a level or an ascension right
  now. It is the roster's whole job: point at the one card worth opening.
- **Owned first, then the gaps**, both in roster order. No sort control.
- One line above the grid: Stardust held, and how many of the roster are
  found. One button below it: **Call for aid**, into the banner.

### 8.2 The card

- Opened by tapping a tile. **The card has no header**: the portrait and the
  name below it are the title, and a plank repeating the name above them would
  spend a band of the screen saying it twice.
- Portrait on its rarity, with the **rarity** at the foot and the **unit type**
  in the corner, an arrow each side that steps to the next hero — comparing
  two of them is most of what the card is for — and **the way back riding on
  the portrait**, not in a row of its own. Every pixel above the fold belongs
  to the art.
- **Each ladder sits with the thing it moves.** The **ascension stars** ride
  on the portrait's lower edge, overlapping it, at the size the chase
  deserves; **Ascend** is a button in the frame's bottom-right corner, showing
  the Stardust toll and the fragment count it also asks for.
- Name and title, then the stat block and the passive.
- **The level and its button are one widget at the foot of the card.** They
  were a number in one box and a button four rows below it, which is two
  places to look for one decision.
- **An unowned hero gets the same card**, stats and passive and all. What the
  player is deciding is whether to chase this one, and that is a question
  about its type, its numbers and what it does — a fragment bar alone is a
  progress meter for a thing it never described.
- The foot widget is the one part that differs, and only in what it reads and
  what its button does: **fragments of ten**, and **Call for aid** into the
  banner, which becomes **Recruit** the moment ten have piled up. One button,
  whichever door is open.
- **The card is centred, not anchored to the bottom.** A drawer is something
  you pull up over a screen you are still working with; the card is the whole
  of what the player is doing.

### 8.3 The reveal

What a call paid, and the only screen in the game that covers everything but
the rewarded video.

- **A grid of prize widgets that deals itself**, one every tenth of a second.
  A call is the one moment the player paid for a surprise; a finished grid
  handed over at once is a receipt.
- **The prompt to leave appears only when the last tile has landed.** A screen
  saying *tap to finish* while it is still dealing is asking to be skipped.
- **A ten-call condenses.** Same thing, one widget with a count: ten calls
  paying 50 Stardust each are one 500, and four fragments of one hero are one
  stack of four. Otherwise a ten is a wall of identical tiles nobody reads.
- **Heroes come last**, so the sequence arrives at what the player called for
  rather than opening with it.
- **A hero interrupts.** When the next tile would be a hero, the sequence
  stops and the hero takes the whole screen — portrait, name, rarity — because
  a roster entry arriving is a different size of event from four fragments and
  must not be a tile a thumb is already moving past. Tap to carry on.
- **One tap, three meanings**, in this order: put a hero curtain away and
  carry on; deal the rest at once, never skipping a curtain; leave. Skipping
  to the end is what a thumb tries first, and a screen that ignores it feels
  stuck.
- A duplicate is **not** drawn as a hero. It already paid its fragments, and a
  hero tile would promise a roster entry that is already there.
- **The banners live in the Tavern** (*designed, not built*): heroes are
  unlocked by that building and **tapping it is how one is called**, the way
  tapping the Market opens the trade screen
  ([`14-monetization.md`](14-monetization.md) §2.1).
- **The keys stay in the store**, one Gem-priced card each. The store is where
  a currency is bought; the Tavern is where a key is spent.
- Until the Tavern is built, the banners keep their place on the store — the
  relocation is one mount, and it lands with the building.
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
  slot, the way it sells the next party slot. The roster is where a hero is
  GROWN; the party sheet is where one is SENT, and neither does the other's
  job.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| A hero's stat block and growth | §2.3 | `Heroes.dmg`, `hp`, `def`, `cooldown`, `dmg_per_level`, `hp_per_level` |
| A hero's passive | §2.4 | `Heroes.troop_dmg_mult`, `troop_hp_mult`, `troop_def_bonus`, `passive_per_tier` |
| The rarity multipliers | ×1.0 / ×1.2 / ×1.5 · ×1.0 / ×1.25 / ×1.75 | `heroes.rarity_stat_mult_*`, `heroes.rarity_passive_mult_*` |
| What a level costs in XP | §4 | `collection.xp_level_cost_base`, `collection.xp_level_cost_growth` |
| What a recruit costs | 10 Fragments — the ladder's base rung | `collection.fragments_per_tier_base` |
| What an ascension costs | 10 / 20 / 40 / 80 Fragments · 50 / 100 / 200 / 400 Stardust | `collection.fragments_per_tier_*`, `collection.ascension_stardust_base`, `collection.ascension_stardust_growth` |
| What a hero slot costs | §3 | `heroes.slot_gem_cost_base`, `slot_gem_cost_growth`, `heroes.max_slots` |
| What a key costs in Gems | 500 / 1,500 | `Banners.key_gem_cost` |
| The odds and both pities | §6.1 | `Banners.hero_chance`, `soft_pity_at`, `hard_pity_at`, `legendary_pity_at` |
| What a banner's pool is | §6.1 | `Banners.weight_common` / `weight_rare` / `weight_legendary` |
| What a miss and a duplicate pay | §6.1 | `Banners.fragments_per_miss`, `duplicate_fragments` |
| What a call pays in Stardust | §6.1 | `Banners.pull_stardust` |
| The free calls and their spacing | §6.2 | `Banners.free_per_day`, `free_cooldown_seconds` |

## 10. Deliberately not in this design

- **An ultimate, energy, or any hero ability beyond the type passive.** The
  hero is a body and a buff.
- **A hero-only battle mode.** Every fight fields troops and heroes. A hero
  arena is a possible future, not this version.
- **Economy traits** — supply discounts, reward bonuses, a threat reveal. The
  threat preview is a Guild perk; rewards and costs are the room's.
- **A party-wide stat.** A hero buffs its own type or nothing.
- **Per-hero XP.** One kingdom counter, or the gacha hands out heroes the
  player cannot use.
- **Guild-gated hero slots**, or a free second slot.
- **A hero that is busy, away, or parked.** Fights are instant.
- **A rarity that changes how combat resolves.**
- **A gacha currency Gems cannot buy.** The keys are a price on a button and
  a free ad path; nothing else mints them.
- **A discount on the ten-call.** A batch buys pity walked, not a cheaper key.
- **A reveal the player cannot skip**, and a reveal that offers a way out
  before it has finished dealing.
- **A second announcement of a call** — a banner or a toast beside the reveal.
  One call, one screen.
- Standalone equipment with random stats or duplicate fusion.
- **A hero no amount of play can reach** — every rarity is on a free call.
- Rotating or time-limited banners — both are permanent.
- A server-authoritative implementation.

## 11. Known holes

- **Rate-up is untested.** The timeline still carries a banner payload and the
  activation query exists, but the two banners are permanent rows, so nothing
  exercises a scheduled one.

**Open questions:** OQ-6, OQ-41, OQ-78, OQ-79, OQ-80.
