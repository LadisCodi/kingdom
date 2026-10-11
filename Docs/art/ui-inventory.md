# The Bag — UI/UX of the inventory

> **Scope.** The screens of [`../proposals/inventory.md`](../proposals/inventory.md):
> the Bag, its tabs, the tile and the popover an item opens, and the three
> places an item is used without opening the Bag — a timer's Speed up, a
> shortfall, and a choice chest. Built from the shipped UI kit
> ([`ui-menus-redesign.md`](ui-menus-redesign.md) §7.17); the reference for
> the flow is Kingshot's *Mochila*, captured in
> [`ui/mockups/m69-refs/kingshot/`](ui/mockups/m69-refs/kingshot).
>
> **Status: designed, not built.** Mockups M69–M72 in `ui/mockups/`
> ([`ui/mockups/inventory-prompts.md`](ui/mockups/inventory-prompts.md)).

## 1. What the reference does

From the five captures:

- **A nav tab, "Mochila"**, third of six, with a red dot when something is new
  (`ks-1`).
- **A full-screen menu**: a back arrow and the title, five folder tabs —
  Resources, Speed up, Boosts, Gear, Other — and a red dot on a tab with
  something new (`ks-2`).
- **A grid of square tiles, four a row.** The tile's colour is the item's
  value tier (grey, green, blue, violet, gold); its size or amount is printed
  at the top ("1K", "1 h"); the count at the bottom right (`ks-2`, `ks-4`).
- **A type badge on the icon**: the same chevrons carry a hammer
  (construction), a helmet (training), a book (research), a cross (healing);
  no badge is general (`ks-4`).
- **Tapping a tile opens a popover in the grid**, between rows, pushing the
  rows below down; the tile gets corner brackets (`ks-3`, `ks-5`):
  - a resource: name, one line, a **slider with − / + , a number and a max
    button**, and **Use** (`ks-3`);
  - a key: name, one line, **Use** (`ks-5`);
  - a speedup: name and one line, **no Use** — speedups are spent from the
    timer (`ks-4`).
- An item at zero is not shown. Items sort by kind, then size.

## 2. What the Bag takes, and what it changes

| | Kingshot | The Bag |
|---|---|---|
| Door | a nav tab | **the nav tab that was Relics**, with the red badge orb |
| Frame | back arrow, flat panel | the kit's full-screen menu: header plank kept, title plank, red close knob (as M62) |
| Tabs | 5 folder tabs | **Resources · Speed ups · Boosts · Relics · Other**, carved wood tabs, the lit one parchment-faced |
| Grid | 4 a row, tier colour | **4 a row**, the tier as the plate's colour (§3.2) |
| Popover | inline, pushes rows | **the same**, a parchment plate with a notch towards its tile |
| Amount | fixed ("10K") | **a duration** ("1 h") on the tile; the popover says what it is worth **now** |
| Speedup in the Bag | description only | description and **Speed up a timer**, which lists running timers (§3.5) |
| Relics | gear-like tiles | **cards**, not tiles (§3.6) |

## 3. The screens

### 3.1 The door

- The nav beam's second tab, **Bag**, a satchel icon, replaces **Relics**.
- The red badge orb shows the count of items **new since the Bag was last
  opened**; it clears when the Bag opens.
- Padlocked until the first item is held, like every door.

### 3.2 The Bag

- Full screen; the header plank stays at the top, untouched.
- **Title plank** "Bag", the red close knob at its right end.
- **Tabs** under it, full width. A tab with something new carries a small red
  dot; a tab with nothing in it is still shown, greyed.
- **The grid**, four tiles a row, scrolling; the tabs never scroll away.
- **Tile** (a square plate, 44 pt minimum, ~80 pt at 375 pt wide):
  - the plate's colour is its tier: **cream** (smallest) · **green** · **blue**
    · **violet** · **gold** (largest);
  - the icon, centred, large;
  - the size or amount at the top in cream lettering with a dark outline:
    "10 min", "1 h", "8 h";
  - the count at the bottom right, same lettering;
  - a **type badge** at the icon's lower left where the kind has one (§3.5);
  - a small **sparkle** on a tile new since the last visit, gone once tapped.
- **Order**: by kind, then size, smallest first — the reference's order.
- **Empty tab**: one parchment line in the middle — *Chests turn up in the
  fog and in quests* — and nothing else.

### 3.3 The popover

- A tap on a tile opens a **parchment plate inside the grid**, under that
  tile's row, the rows below pushed down; a notch points at the tile, which
  gets the kit's gold corner brackets. A second tap, or a tap on another tile,
  closes it or moves it.
- Contents, top to bottom: the item's **name**; **one line** of what it does;
  the **controls** of its kind; one button.
- **Quantity** (anything that can be used several at once): a wood trough
  slider with − and + knobs, the number in a small parchment field, and a
  **max** knob; under it **what the choice gives, in total**, with the coin
  icon: *×3 → 16,200 Gold*.
- **Use** is the kit's green button, the price-free kind; it reads **Use** or
  **Use ×3**.

### 3.4 Resources

- Gold, Food, Wood and Stone chests, by coin then size, then the **choice
  chest**.
- The tile shows the **duration**; the popover's line reads it in the
  player's money: *1 h of Wood — 2,400 now*. The total under the slider
  updates as it moves.
- **The choice chest** opens a centred sheet (§3.8).
- Used, the coins fly from the popover to the header plank (`rewardFly`).

### 3.5 Speed ups

- Type badges, drawn on the shared chevrons: **hammer** construction ·
  **helmet** training · **anvil** workshop · **boot** march; none for General.
- The popover: name, line, and a wood button **Speed up a timer**. It opens
  the **Speed-up picker** (§3.7) for the first running timer of that kind;
  with none running it reads *Nothing of this kind is running* and the button
  is not drawn.

### 3.6 Relics

- **Two cards a row**, not tiles: the relic's art on its plate, its name, a
  **blue seal** with its level, and under it **six small slots** — the
  fragments found, set; the missing ones, chalk outlines; the keystone
  centred.
- A **host mark** at the card's top right: a small Shrine or Chapel icon when
  it is hosted, nothing when it is not. City and world relics are two
  sections with thin ornamental headers, *CITY* and *WORLD*.
- A tap opens the relic's sheet: **Restore** / **Level up**, **Host** (which
  Shrine or Chapel, or *Store it*), the replica offer, the Dowser's map
  ([`../proposals/relic-restoration.md`](../proposals/relic-restoration.md) §4,
  §9). Its layout is M67's lower panel.

### 3.7 The Speed-up picker

The way a speedup is really used. Opened by a timer's **Speed up** — a build,
an upgrade, a training line, a workshop item, a march — and by §3.5.

- A centred sheet over the dimmed screen, title plank **Speed up**, the close
  knob.
- **The job**: its icon, its name ("Sawmill · level 4"), a trough filling to
  its progress, and the **time left** large.
- **Rows**, one per speedup that applies, **typed first, then General**,
  smallest first. A row: the tile, its count, and a green **Use**; a long
  press on Use uses one after another.
- **Auto**, a gold button over the rows: uses the fewest items that finish the
  job without wasting more than the smallest size; its face says what it will
  spend: *Auto · 2× 1 h, 1× 15 min*.
- **Finish**, a green button at the bottom with its Gem price inside it, at
  `rush.secondsPerGem` — always last, never first.
- Each Use shortens the time left in place; when it reaches zero the sheet
  closes and the job finishes where the player can see it.

### 3.8 The choice chest

- A centred sheet, title plank with the chest's name.
- Four plates in a row — Gold, Food, Wood, Stone — each its icon and what it
  would give **now**; one is picked, gold rim.
- The quantity row of §3.3 and **Open**.

### 3.9 Short of something

When a build, upgrade or training is refused for a coin the player has not
got, the refusal is a sheet, like the builder's offer
([`../features/06-construction.md`](../features/06-construction.md) §2), never
a toast.

- Title plank *Not enough Wood*; one line: *Needs 1,200 · you have 400*.
- **Rows** of the Bag's chests of that coin, smallest first, each with its
  worth now and a green **Use**; the shortfall line updates after each.
- When the shortfall is met, the sheet closes and the build starts.
- With no chest in the Bag, the sheet says so in one line and offers only the
  existing way to get it — the store's resource bundle — never a Gem price
  for a coin.

### 3.10 Boosts and Other

- **Boosts**: an active boost is a **ribbon over the grid**, its icon and
  time left; its tile's popover adds *Extends the running one*.
- **Other**: keys, maps, flasks, tomes, event tools. A key's popover is name,
  line, **Use** — it opens the banner's call. A map's opens its relic picker.

## 4. Rules

- **One verb per button** ([`ui-menus-redesign.md`](ui-menus-redesign.md)
  §6.9): Use, Open, Speed up a timer, Auto, Finish.
- **A price lives in the button that spends it** (§6.4 there): only Finish
  carries a Gem price; the Bag never sells.
- **The Bag never takes the player away** except Speed up a timer and a key's
  Use, which go where the item acts.
- **Nothing is confirmed twice.** Use is immediate; the only confirmation is
  the store's, for money.

## 5. Mockups

| # | Screen | Shows | File |
|---|---|---|---|
| **M69** | The Bag, Resources | the grid, a popover open on a 1 h Wood chest with the slider | `ui/mockups/m69-bag-resources.png` |
| **M70** | The Bag, Speed ups | typed badges, a popover with Speed up a timer | `ui/mockups/m70-bag-speedups.png` |
| **M71** | The Speed-up picker | a Sawmill upgrade, typed rows, Auto, Finish | `ui/mockups/m71-speedup-picker.png` |
| **M72** | The Bag, Relics | the relic cards, city and world, host marks | `ui/mockups/m72-bag-relics.png` |

- The shortfall sheet (§3.9) and the choice chest (§3.8) are not mocked; they
  are the kit's centred sheet with rows, as M71.
- Everything a relic does outside the Bag is [`ui-relics.md`](ui-relics.md).

## 6. Deliberately not in this design

- A shop inside the Bag, a Buy on a tile.
- Items at zero shown greyed.
- A sort or filter control.
- Selling, discarding or gifting an item.
- A confirmation on Use.
- A Gem price for a coin in the shortfall sheet.
