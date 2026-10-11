# Proposal — the inventory

> **What this is.** One bag for everything the player owns that is not a
> currency or a building: consumables that hand over resources, time or a
> boost; relics and their fragments; keys and maps. Shaped on the item bag of
> Kingshot and its genre — tabs, typed speedups, resource chests, a choice
> chest, bulk use, items saved for an event — held to this game's rules. It
> is a **proposal**, not a feature doc: nothing here is built.
>
> **It goes with** [`relic-restoration.md`](relic-restoration.md), which puts
> relics and fragments in it.

## 1. The rules, up front

1. **An item is not a currency.** A currency is in the wallet and spent by a
   price; an item sits in the bag until the player **uses** it.
2. **An item that hands over resources is a duration of the player's own
   production**, read when it is used, never a fixed amount
   ([`../overview.md`](../overview.md) § *The rules that govern every new
   number*).
3. **Every item can be earned.** The store sells bundles of the same items
   the game pays.
4. **Items never expire**, except an event's own items, which convert when
   the event closes.
5. **The bag has no cap.** Items stack.
6. **Nothing in the bag can be raided** — like the wallet.

## 2. The tabs

| Tab | Holds |
|---|---|
| **Resources** | resource chests, the choice chest |
| **Speedups** | the typed speedups |
| **Boosts** | timed boosts |
| **Relics** | restored relics and their fragments ([`relic-restoration.md`](relic-restoration.md) §4) |
| **Other** | keys, Dowser's maps, Mana flasks, Knowledge tomes, event tools |

- A tab shows a count badge for items that can be used now.
- An item's card: what it does, how many, **Use** and **Use ×N**.

## 3. The items

### 3.1 Resources

| Item | Gives |
|---|---|
| **Gold / Food / Wood / Stone chest** | `10 min`, `1 h` or `8 h` of what the city makes of that coin, at the moment of use |
| **Choice chest** | one of the four, picked when opened, at its size |

- A coin the city makes none of yet pays its floor (`chestFloor`).
- The amount lands in the wallet, past any store.

### 3.2 Speedups

| Type | Shortens | Sizes |
|---|---|---|
| **General** | any timer below | 1 min · 5 min · 15 min · 1 h · 3 h · 8 h · 24 h |
| **Construction** | a build or an upgrade, city or world | same |
| **Training** | villagers and troops | same |
| **Workshop** | the item in progress | same |
| **March** | an army's or an explorer's march | 15 min · 1 h |

- **Research has no time**, so there is no research speedup.
- **Used from the timer.** A timer's *Speed up* opens a picker: the typed
  speedups first, then General, then Gems at `rush.secondsPerGem`. **Auto**
  picks the fewest items that finish it without wasting more than the
  smallest size.
- A speedup moves the timer's end by its duration **at the moment of use**: a
  command at `t` like any other, so the offline replay holds.

### 3.3 Boosts

| Boost | Does | For |
|---|---|---|
| **Rent** | houses pay +`X`% | 8 h |
| **Harvest** | a tap takes +`X`% | 1 h |
| **Mana** | Mana fills +`X`% faster | 8 h |

- A boost is a **modifier**: something that happened to the kingdom and
  expires ([`../implementation-plan.md`](../implementation-plan.md) §1). A
  second of the same kind extends it; it never stacks.
- A boost acts on the whole city. A relic acts on its host's area; the two
  multiply.

### 3.4 Other

| Item | Does |
|---|---|
| **Mana flask** | fills `X`% of the pool; what goes over the cap is lost |
| **Knowledge tome** | `N` Knowledge, landing over the bar's cap like a lump |
| **Silver / Gold key** | one call on a banner (moved here from the wallet) |
| **Dowser's map** | [`relic-restoration.md`](relic-restoration.md) §9 |
| **Event tools** | an event's currency; convert at its close |

## 4. Where items come from

| Source | Pays |
|---|---|
| Fog treasures | small resource chests, now and then a speedup |
| Lairs | a chest of the lair's tier: speedups, a boost |
| Quests | speedups and chests by step |
| The Survey, both columns | chests, speedups, maps, keys |
| The season pass, both columns | speedups, boosts, flasks, tomes |
| Events | items on their tracks; **event tasks that count items used** |
| Dungeons, the Portal | tomes, March speedups |

- **Saving for an event.** An event may score speedup minutes used or chests
  opened, as the genre does: holding items back is a choice, never a loss.

## 5. What is sold

| Product | Family | Price |
|---|---|---|
| **Speedup bundles** — mixed typed speedups | Comfort | $1.99 · $4.99 · $9.99 |
| **Resource bundles** — chests of one coin | Comfort | $1.99 · $4.99 |
| **Builder's crate** — Construction speedups and a choice chest | Comfort | $4.99 |
| **Single items for Gems** — on the bag's card when the count is 0 | Comfort | the Gem value of the time, at `rush.secondsPerGem` |

- **A bundle grants items, never Gems**, like the card bundles today.
- **Priced at 1.5× to 2× the Gem ladder**, so it stays measurable against a
  Gem pack of the same price
  ([`../features/14-monetization.md`](../features/14-monetization.md) §2.3).
- An item for Gems is never cheaper than rushing the same time with Gems.

## 6. What changes elsewhere

| Where | Today | With this |
|---|---|---|
| Rush with Gems | the only way to shorten a timer | still there, after the bag in the picker |
| Mana refill | an ad and a Gem ladder | unchanged; a flask is a reward, not its replacement |
| Keys | in the wallet | in the bag |
| Rewards | coins and packs | coins and items |
| The nav | a Relics tab | a **Bag** tab |

## 7. Dials, in the order to reach for them

| Dial | Start | Moves |
|---|---|---|
| Chest sizes | 10 min · 1 h · 8 h | what a chest is worth |
| `chestFloor` | 50 of the coin | a chest before the coin is made |
| Boost magnitudes | Rent +25% · Harvest +50% · Mana +50% | how strong a boost is |
| Speedup mix per source | by table | how much time is given away |
| Bundle multipliers | 1.5× → 2× | the money rungs |

## 8. Open questions

- **How much time a day the free player gets in speedups**, against the
  build times of [`../features/06-construction.md`](../features/06-construction.md).
- **Do event tasks count items used**, and which events.
- **A world truce item** (no attacks on a hex for a while): left out; a paid
  shield on the board sells safety from other players.

## 9. Deliberately not in this design

- An item with a fixed amount of a coin.
- A research speedup.
- A shield, a teleport, a city relocation.
- Items that expire, a bag with a cap.
- A boost that stacks with itself.
- An item sold only for money.
- A trade of items between players (fragments are traded, §7 of
  `relic-restoration.md`, and nothing else).
