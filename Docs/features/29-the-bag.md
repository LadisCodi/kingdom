# 29 · The Bag — items held until they are used

> **Scope.** The Bag: everything the player owns that is not a currency, a
> building or a relic — chests, speed-ups, boosts, flasks, tomes, keys and
> the pieces a ruin needs. Every kind of item and what using it does; the
> Speed-up picker on every timer; the sheet a shortfall raises; where items
> come from and how they are sold; the screens and the door. Relics are kept
> on the Bag's Relics tab; everything else about them is
> [`09-relics.md`](09-relics.md).
>
> **Status: built.**

## 1. The rules

- **An item is not a currency.** It sits in the Bag until it is **used**.
  Nothing is priced in items; the only things that spend one are a key on a
  call and a part on a repair.
- **An item that pays a coin is a duration of the city's own production**,
  read at the moment of use — never a fixed amount — and rounded to three
  significant figures (`roundPrice`).
- **Items never expire.**
- **The Bag has no cap.** Items of one id stack into one count.
- **Nothing takes from the Bag**: no raid, no trade, no loss.
- **A use is a command at `now`.** It lands in the wallet past any building's
  store, so the offline replay never sees it.

## 2. The items

52 items in eight kinds (`items` › `kind`). Which tab shows an item is a fact
of its kind.

| Kind | Tab | Items | Sizes | Using one |
|---|---|---|---|---|
| **Chest** | Resources | 12 — Gold, Food, Wood, Stone | 10 min · 1 h · 8 h | pays that long of what the city makes of its coin (§2.1) |
| **Choice chest** | Resources | 2 | 1 h · 8 h | the same, of the coin picked when it is opened |
| **Speed-up** | Speed ups | 28 — General, Construction, Training, Workshop | 1 min · 5 min · 15 min · 1 h · 3 h · 8 h · 24 h | takes its time off a running timer (§4) |
| **Boost** | Boosts | 3 — Rent, Harvest, Mana | see §2.2 | raises one number for a while |
| **Mana flask** | Other | 2 | 25% · 100% of the pool | fills that share of the Mana pool; what goes over the cap is lost |
| **Knowledge tome** | Other | 2 | 2 · 5 Knowledge | pays that Knowledge, over the bar's cap like a lump |
| **Key** | Other | 2 — Silver, Gold | — | one call on the banner that names it ([`10-heroes.md`](10-heroes.md)) |
| **Part** | Other | 1 — the Watchtower's lens | — | spent by the repair of the ruin that names it (`buildings` › `repairItem`) |

### 2.1 Chests

- One chest pays `seconds` × what the city makes of its coin a second, at
  least `bag.chestFloorPerHour` (60) of the coin per hour of its size.
- What the city makes: for Gold, rent and Gold gatherers together; for Food,
  Wood and Stone, its gatherers' throughput.
- **Use ×N pays N times what one pays now.**
- A choice chest pays Gold, Food, Wood or Stone, picked when it is opened.

### 2.2 Boosts

| Boost | While it runs | For |
|---|---|---|
| **Rent** | houses pay +25% | 8 h |
| **Harvest** | a tap takes +50% | 1 h |
| **Mana** | Mana fills +50% faster | 8 h |

- A boost is a modifier on its number (`taxRate`, `tapYield`, `manaRegen`)
  for the whole city. It multiplies with every other bonus on that number,
  a relic's aura included.
- **A second boost of the same kind extends the running one; it never
  stacks.** It adds its length to the running end (or to `now`); if it is
  stronger, the running one takes its value.
- Use ×N runs N times as long.
- Its end is a boundary: an absence replays it to the second.

## 3. Using an item

- **From the Bag** (§9.3): chests, choice chests, boosts, flasks and tomes —
  **Use**, or **Use ×N** with the quantity row. A choice chest says **Open**.
- **On a timer**: a speed-up, from the timer's **Speed up** (§4). The Bag's
  popover sends the player there.
- **On a call**: a key, from the store. Its popover's **Use** opens the
  store's Heroes tab, where the banners are.
- **On a repair**: a part, taken when the repair starts.
- **On a refusal**: a chest, from the shortfall sheet (§5).
- **On a relic short of Mana**: the smallest flask held, from the relic's
  card ([`09-relics.md`](09-relics.md) §11).
- Nothing is confirmed. What a use pays flies to the header.

## 4. The Speed-up picker

### 4.1 What a speed-up fits

| Timer | Typed speed-up | General |
|---|---|---|
| a build or an upgrade, in the province | Construction | yes |
| a build on the world board | Construction | yes |
| a training line — the whole line | Training | yes |
| a workshop's item in progress | Workshop | yes |
| an explorer's trip | — | yes |
| an army's march | — | yes |

- **It never gives time away.** What it finishes completes at `now`; what
  follows starts at `now`.
- A build: its end moves by the speed-up's time; the rest of a speed-up
  bigger than the wait is lost.
- A training line is one wait: what is left of the head first, the rest
  onto the next trainee.
- A workshop: that many seconds of the crew's work on the front item only;
  the rest is lost.
- A world build and an army's march are the world server's: the server
  moves the timer first, and the items are spent only on its yes.
- Research takes no time, so nothing speeds it.

### 4.2 The sheet

- **Every timer's button**: **Speed up** when the Bag holds a speed-up that
  fits; otherwise the bare Gem **Finish**.
- A centred sheet, *Speed up*:
  - **the job** — its icon, its name, a bar, the time left, large;
  - **Auto**, gold, saying what it will spend (*Auto · 2× 1h, 1× 15m*);
  - **a row per speed-up held that fits** — typed first, then General, each
    smallest first: the tile, its count, its name, **Use** (one);
  - **Finish**, last, its Gem price at `rush.secondsPerGem`.
- Each Use shortens the time left in place. At zero the sheet closes back to
  where it was opened, and the job finishes there.
- **Auto** spends the fewest items that finish the job, wasting less than the
  smallest item it uses; a tie goes to the less waste. When everything held
  cannot finish it, Auto spends everything held.

## 5. Short of a coin

- A **build, an upgrade, a villager or a troop** refused for a coin the Bag
  holds a chest of raises a sheet instead of shaking the purse.
- It is also raised, with no chest, once the Bag and the store are open and
  the short coin is Gold, Food, Wood or Stone.
- *Not enough Wood*; one line: what was asked, *needs · you have*.
- **Rows**: the chests of that coin, then choice chests, each smallest first,
  with what one pays **now** and **Use**. A choice chest pays the short coin.
- When the shortfall is met the sheet closes and what was asked for starts.
- With no chest: one line, and **Store**, which opens its Supplies tab. A
  coin is never priced in Gems here.

## 6. Where items come from

| Source | Pays | Data |
|---|---|---|
| **Fog treasures** | every 4th: a 10 min Gold, Food, Wood or Stone chest, or a 5 min speed-up, by weight ([`01-map-and-fog.md`](01-map-and-fog.md)) | `exploration` › `treasure.itemEvery`, `treasure.items` |
| **Quests** | on some steps: 1 h chests and choice chests, speed-ups, Rent boosts, small flasks | `quests` › `rewardItems` |
| **Lairs**, when claimed | by tier, below | `garrisons` › `rewardItems` |
| **The Survey** | the free column: a speed-up, a chest, a choice chest or a Rent boost every fourth level; the paid column: a 1 h choice chest every fourth level; keys on both ([`25-the-survey.md`](25-the-survey.md)) | `survey` › `freeItems`, `paidItems`, `*SilverKeys`, `*GoldKeys` |
| **Hero calls** | every call's supplies slot: a 5 min typed speed-up or a 10 min chest (silver call), 1 h (gold call) ([`10-heroes.md`](10-heroes.md) §6.4) | `banners` › `loot`, rows with `reward: Item` |
| **Daily help** | a friend's help: a 5 min Construction speed-up ([`15-social.md`](15-social.md) §3) | `social` › `friendHelp.giftItem` |
| **The store** | §7 | `store` › `items`, `nextDayItems` |

| Lair tier | Items |
|---|---|
| 1 | 15 min Construction speed-up, the Watchtower's lens |
| 2 | 1 h speed-up |
| 3 | 2× 1 h speed-up, Harvest boost |
| 4 | 3 h speed-up, 1 h choice chest |
| 5 | 8 h speed-up, 8 h choice chest |

## 7. How items are sold

- **Six bundles**, on the store's Supplies tab under *For the Bag*, shown
  once the Bag's door is open. They grant no Gems
  ([`14-monetization.md`](14-monetization.md) §2.3).

  | Bundle | Price | Items |
  |---|---|---|
  | A satchel of speed-ups | $1.99 | 2× 1 h, 2× 15 min speed-up |
  | A crate of speed-ups | $4.99 | 3 h, 2× 1 h speed-up, 1 h Construction |
  | A chest of speed-ups | $9.99 | 8 h speed-up, 3 h Construction, 1 h Training |
  | A sack of chests | $1.99 | 8 h choice chest |
  | A cart of chests | $4.99 | 3× 8 h choice chest |
  | The builder's crate | $4.99 | 4× 1 h, 3 h Construction, 1 h choice chest |

- **Offers and daily offers** carry items beside their Gems
  ([`14-monetization.md`](14-monetization.md) §2.4–§2.5).
- **Keys** are bought one at a time for Gems on the store's Heroes tab
  (`banners` › `keyGemCost`).
- Nothing else in the Bag is sold for Gems, and the Bag sells nothing.

## 8. The door

- The **Bag** door opens with the first item held or the first relic
  fragment met (`sim/doors.ts`). Padlocked, it says *Find a chest to open
  this.*
- It opens with its unlock splash (`unlocks` › `bag`).
- The First Morning's `chest` lesson: the `SecondVillager` quest pays a 1 h
  Wood chest, used from the Bag ([`23-tutorials.md`](23-tutorials.md) §3.1).
- The first speed-up held raises the `speedups` introduction
  ([`23-tutorials.md`](23-tutorials.md) §4.1).

## 9. The screens

### 9.1 The nav tab

- **Bag**, a satchel, the nav's second tab.
- Its red orb counts the items received since the Bag was last opened;
  opening it clears the orb.

### 9.2 The Bag

- Full screen, title *Bag*, the close knob.
- **Tabs**: Resources · Speed ups · Boosts · Relics · Other. A tab holding
  something new carries a red dot; a tab with nothing in it is greyed, still
  shown. The tabs stay put; the pane under them scrolls.
- **The grid**: four tiles a row, in the order of `items` — kind, then size.
  An item at zero is not shown.
- **A tile**:
  - the plate's colour is its `tier`: 1 cream · 2 green · 3 blue · 4 violet
    · 5 gold;
  - its icon;
  - its size at the top — a duration, a flask's share, a tome's Knowledge;
    none on a key or a part, or where its own art carries it;
  - its count at the bottom right;
  - a speed-up drawn with the shared icon carries its type's badge: a hammer
    (Construction), a helmet (Training), an anvil (Workshop);
  - a sparkle while it is new, gone once tapped.
- **An empty tab**: one line saying where its items turn up.
- **Boosts**: a ribbon over the grid per running boost — its icon, what it
  raises, the time left.
- **Relics**: the Shrines and the relic cards
  ([`09-relics.md`](09-relics.md) §11.1).

### 9.3 The popover

- A tap on a tile opens a parchment plate **under that tile's row**, the
  rows below pushed down, a notch at the tile. A second tap closes it.
- It holds the item's name with its size (*1h Wood chest*), one line on what
  one does or is worth now (*1h of Wood — 2,400 now*), the controls of its
  kind and one button.

| Kind | Controls | Button |
|---|---|---|
| Chest | quantity, and the total (*×3 → 7,200 Wood*) | **Use** / **Use ×N** |
| Choice chest | four coin plates, each with what it pays now, the picked one rimmed in gold; quantity and total | **Open** / **Open ×N** |
| Boost | *Extends the running one* while one runs; quantity | **Use** / **Use ×N** |
| Flask, tome | quantity | **Use** / **Use ×N** |
| Speed-up | — | **Speed up a timer** — the picker on the first running timer it fits; with none, *Nothing of this kind is running* |
| Key | — | **Use** — the store's Heroes tab |
| Part | the building it repairs | none |

- **Quantity** shows only when more than one is held: − · a slider · + · the
  number · **Max**.

## 10. Dials, in the order to reach for them

| Dial | Now | Where |
|---|---|---|
| What a chest is worth | 10 min · 1 h · 8 h of production | `items` › `seconds` |
| What a chest pays before its coin is made | 60 of the coin per hour of size | `bag.chestFloorPerHour` |
| How strong and how long a boost is | Rent +25% 8 h · Harvest +50% 1 h · Mana +50% 8 h | `items` › `value`, `seconds` |
| Speed-up sizes | 1 min … 24 h, four types | `items` › `seconds`, `speeds` |
| Flask and tome sizes | 25% · 100% · 2 · 5 | `items` › `value` |
| Which treasures pay an item, and which | every 4th, by weight | `exploration` › `treasure.itemEvery`, `treasure.items` |
| Items by quest step | 26 steps | `quests` › `rewardItems` |
| Items by lair tier | §6 | `garrisons` › `rewardItems` |
| Items by Survey level | §6 | `survey` › `freeItems`, `paidItems` |
| Items in a call's supplies slot | §6 | `banners` › `loot` |
| A friend's gift | 5 min Construction speed-up | `social` › `friendHelp.giftItem` |
| What a product puts in the Bag | §7 | `store` › `items`, `nextDayItems` |
| A tile's plate | 1–5 | `items` › `tier` |
| What Finish costs in the picker | 5 s a Gem | `rush.secondsPerGem` |

## 11. Deliberately not in this design

- An item with a fixed amount of a coin.
- Items that expire; a Bag with a cap.
- A boost that stacks with itself.
- A research speed-up; a March speed-up.
- Selling, discarding, gifting or trading an item.
- A Buy on a tile, a sort or filter control, items at zero shown greyed.
- A confirmation on Use.
- A Gem price for a coin in the shortfall sheet.
