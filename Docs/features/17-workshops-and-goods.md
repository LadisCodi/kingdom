# 17 · Workshops and refined goods

> **Scope.** The four refined goods, the four buildings that make them, and the
> queue a villager works. What a good is spent on is the advanced building
> level ([`buildings.md`](buildings.md)); the worker, the building and the
> cell as three actors is [`04-harvest.md`](04-harvest.md) §7.
>
> **Status: built**, and reachable at Townhall 4 — the count cap below opens
> there, one level before the first Townhall level that is priced in goods,
> so the ladder never asks for a good nothing can yet make.

## 1. A good is not a currency

- The city keeps a **counter per good**, like the collection's ingredients.
  No coin on the plank, no cap, no Gold price.
- A good is read where it is spent: a workshop's queue, and the price of a
  building level — **every** level from 6 upward, on every building that has
  one ([`buildings.md`](buildings.md) §4.11), so no city reaches level 10
  without a workshop.
- Goods are city-scoped, and no part of the wallet.

## 2. The four goods

| Good | One item is made of | Work (one villager) | Made in |
|---|---|---|---|
| **Planks** | 10 Wood | 20 min | Carpenter |
| **Cut Stone** | 10 Stone | 30 min | Mason's Yard |
| **Iron** | 20 Stone + 200 Gold | 1 h | Smelter |
| **Runestone** *(tier 2)* | 2 Cut Stone + 20 Mana | 3 h | Rune Carver |

- Runestone is the only good made of another good, and the only one that
  takes Mana — the first Mana sink that is not a tap
  ([`08-magic.md`](08-magic.md)).
- **Work is authored for one villager.** A level never shortens it; the crew
  is the speed (§4).

## 3. The four workshops

| Workshop | Makes | Footprint | Unlock | Count cap |
|---|---|---|---|---|
| **Carpenter** | Planks | 1×1 | `Engineering` | 1 at TH4, 2 at TH8 |
| **Mason's Yard** | Cut Stone | 1×1 | `Engineering` | 1 at TH4, 2 at TH8 |
| **Smelter** | Iron | 1×1 | `Mining` | 1 at TH4, 2 at TH8 |
| **Rune Carver** | Runestone | 1×1 | `Attunement II` | 1 at TH4, 2 at TH8 |

- Max level **10**. Fog ring as any building: reveal 1, discover 2. Movable.
- A tap opens the queue. It does not hurry the work and costs no Mana.
- Build cost: Carpenter 120 Wood · Mason's Yard 100 Wood + 60 Stone ·
  Smelter 400 Gold + 120 Stone · Rune Carver 800 Gold + 200 Stone. Upgrades
  follow the ×1.6-a-level curve
  ([`05-city-and-districts.md`](05-city-and-districts.md) §3).

## 4. The crew is the engine

- **Nothing happens without a worker.** A workshop with nobody assigned does
  not advance: the queue waits. There is no hand production and no collect
  tap.
- Workers come from Housing population and are assigned like a Sawmill's crew.
- The crew spreads over the items **in progress**: at most one item per
  worker, front of the queue first; a worker with no item of its own helps on
  another.
- **Item speed = workers on it.** Two workers on one 1-hour item finish it in
  30 minutes; two workers on two 1-hour items finish both in 1 hour; three
  workers on two finish both in 40 minutes.
- Throughput is always **one item-hour per worker-hour**, whatever the queue
  holds — so one more villager is always faster.
- A finished item is delivered to the stockpile the moment it finishes.

**What a level buys**

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Crew | 1 | 2 | 3 | 3 | 4 | 4 | 5 | 5 | 6 | 6 |
| Queue | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |

## 5. The queue

- The player queues one item at a time, up to the level's queue length.
- **Inputs are paid when the item is queued**, not when work on it starts.
- Cancelling refunds the inputs in full, at any position in the queue. The
  work already done is lost; the materials never are.
- A queue is refused for want of resources, of a good, or of Mana — each says
  which, because the errand is different for each.

## 6. Offline, and the timer rule

- A workshop crew is **production**: it stops at the 8-hour offline cap, as a
  Sawmill's crew does ([`04-harvest.md`](04-harvest.md) §8).
- A player away twelve hours comes back to eight hours of goods, delivered.
  What is queued past that waits.

## 7. Gems

- Gems **finish the item being worked**, priced on the wall-clock time it has
  left at the current crew — the rush rule of a build
  ([`14-monetization.md`](14-monetization.md) §2.2).
- More villagers on an item make its rush cheaper.
- Only the item in progress is for sale. Never the queue behind it, never a
  worker slot.

## 8. The card

- The district card carries: what this workshop makes and out of what, how
  many are in store, the crew line, the queue as slots, and one button.
- The crew line **says in words** when there is nobody there — a queue with no
  villager on it does not move at all, which a progress bar that never fills
  does not communicate.
- The front slots run; every slot can be cancelled; the item in progress shows
  its remaining time and its Gem price.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| What one item is made of | §2 | `Goods.input_*`, `input_good`, `input_mana` |
| Work for one villager | 20 min / 30 min / 1 h / 3 h | `Goods.work_seconds` |
| Which workshop makes which good | §3 | `Districts.produces` |
| Queue length by level | 3 → 12 | `Districts.queue_length_per_level` |
| Crew by level | 1 → 6 | `Districts.max_workers_per_level` |
| How many the city may own | 1 at TH4, 2 at TH8 | `Districts.max_count_per_townhall_level` |
| What a building level costs in goods | [`buildings.md`](buildings.md) §4.11 | the `DistrictCosts` sheet, that level's row — [`05-city-and-districts.md`](05-city-and-districts.md) §3.2 |
| Gem price of the item in progress | 5 s a Gem | `rush.seconds_per_gem` |
| Offline cap | 8 h | `offlineCapHours` |

## 10. Deliberately not in this design

- **A good as a wallet row.** Four coins on the plank is the ceiling; a
  counter beside the thing it belongs to is the answer
  ([`03-economy.md`](03-economy.md) §1).
- **Selling goods for Gold.** A refined good has one use, which is being
  spent on the city — and nothing in the game buys a resource for coin.
- **Hand production and a collect tap.** The villager is the only engine.
- **A level that shortens the work.** Speed is villagers, so housing them is
  the pressure the workshops exist to create.
- **Buying the queue.** Gems reach the item in progress and nothing else.
- **A third tier of goods, and a trader.** One tier plus Runestone is the
  whole ladder.
