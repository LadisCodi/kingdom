# 17 · Workshops and refined goods

> **Scope.** The four refined goods, the four buildings that make them, and the
> queue a villager works; the world's precious materials, which are counted
> with them. What a good is spent on is the advanced building level
> ([`buildings.md`](buildings.md) §4.11) and the deeper research; the worker,
> the building and the cell as three actors is [`04-harvest.md`](04-harvest.md)
> §7; where precious materials come from is
> [`19-world-map.md`](19-world-map.md) §7.4.
>
> **Status: built**, and reachable at Townhall 4 — the workshops' count cap
> opens there, one level before the first Townhall level priced in refined
> goods (5).

## 1. A good is not a currency

- The city keeps a **counter per good** (`state.city.goods`). No coin on the
  plank, no cap, no Gold price. Goods are city-scoped, and no part of the
  wallet.
- **Refined goods** — Planks, Cut Stone, Iron, Runestone — are made in
  workshops (§2).
- **Precious materials** — Starmetal, Heartwood, Moonglass (`precious` in
  `goods`) — are goods too: no recipe, no work time, made by no workshop,
  found only on the world board ([`19-world-map.md`](19-world-map.md) §7.4).
  They are traded between friends on the wish board
  ([`15-social.md`](15-social.md) §2.4).
- A good is read where it is spent, as a `goods` term on a price:
  - **building levels** — levels 4 and 5 ask for a precious material, levels
    6–10 for refined goods, and 8–10 for all three precious materials too;
    Housing from level 6, in Planks
    ([`buildings.md`](buildings.md) §4.11);
  - **the late decorations** — the Well, the Orchard, the Statue, the Plaza
    ([`21-harmony.md`](21-harmony.md) §2.2);
  - **research** — Kingdom chapters 5–9 ask for refined goods, 5 on for
    precious materials ([`07-research.md`](07-research.md));
  - **a workshop's queue** — the Runestone's 2 Cut Stone.
- No city reaches level 10 without a workshop.
- **No price asks for precious material while the world is shut**: until the
  Watchtower is repaired, those terms are left off
  ([`19-world-map.md`](19-world-map.md) §7.6).

## 2. The four refined goods

| Good | One item is made of | Work (one villager) | Made in |
|---|---|---|---|
| **Planks** | 10 Wood | 20 min | Carpenter |
| **Cut Stone** | 10 Stone | 30 min | Mason's Yard |
| **Iron** | 20 Stone + 200 Gold | 1 h | Smelter |
| **Runestone** *(tier 2)* | 2 Cut Stone + 20 Mana | 3 h | Rune Carver |

- Runestone is the only good made of another good, and the only one that
  takes Mana ([`08-magic.md`](08-magic.md) §3).
- **Work is authored for one villager.** A level never shortens it; the crew
  is the speed (§4).
- What does shorten it, priced when the item is queued and stored on it:
  - the workshop's neighbour, −10% ([`03-economy.md`](03-economy.md) §3.1);
  - **Guild Halls I–II**, +15% speed each (`workshopSpeed`).

## 3. The four workshops

| Workshop | Makes | Footprint | Unlock | Count cap |
|---|---|---|---|---|
| **Carpenter** | Planks | 2×2 | `Joinery` (chapter 4) | 1 at TH4, 2 at TH8 |
| **Mason's Yard** | Cut Stone | 2×2 | `Stone Dressing` (chapter 4) | 1 at TH4, 2 at TH8 |
| **Smelter** | Iron | 2×2 | `Mining` (chapter 3) | 1 at TH4, 2 at TH8 |
| **Rune Carver** | Runestone | 2×2 | `Attunement II` (chapter 5) | 1 at TH4, 2 at TH8 |

- Max level **10**; levels 6–10 need Townhall 6–10. Fog ring: reveal 0,
  discover 2. Movable.
- A tap opens the queue. It does not hurry the work and costs no Mana.
- Build cost: Carpenter 5,400 Gold + 300 Wood · Mason's Yard 7,200 Gold +
  250 Wood + 150 Stone · Smelter 12,000 Gold + 300 Stone · Rune Carver 24,000
  Gold + 500 Stone. Each level's price is authored (`costPerLevel`)
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

- **Apprentices I** adds one queue slot to every workshop
  (`workshopQueueSlots`).

## 5. The queue

- The player queues one item at a time, up to the queue's length.
- **Inputs are paid when the item is queued**, not when work on it starts.
- Cancelling refunds the inputs in full — resources, goods and Mana — at any
  position in the queue. The work already done is lost; the materials never
  are.
- A queue is refused for want of resources, of a good, or of Mana — each says
  which.

## 6. Offline

- A workshop runs while the player is away until its queue is done. The
  queue's length is its only ceiling ([`04-harvest.md`](04-harvest.md) §8).
- Goods go straight to the stockpile; a workshop has no store to collect, and
  a raid never reaches goods.

## 7. Hurrying the item in progress

- **Gems** finish the item being worked, priced on the wall-clock time it has
  left at the current crew — `rush.secondsPerGem` (5 s a Gem), the rush rule
  of a build ([`14-monetization.md`](14-monetization.md) §1).
- **Workshop and General speed-ups** from the Bag add that many seconds of the
  crew's work to it; the rest of a speed-up bigger than the wait is lost.
- More villagers on an item make its rush cheaper.
- Only the item in progress can be hurried. Never the queue behind it, never
  a worker slot.

## 8. The card

- The district card carries: what this workshop makes and out of what, how
  many are in store, the crew line, the queue as slots, and one button.
- The crew line **says in words** when there is nobody there — a queue with no
  villager on it does not move at all.
- The front slots run; every slot can be cancelled; the item in progress shows
  its remaining time and its Gem price.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| What one item is made of | §2 | `goods` › `input`, `inputGood`, `inputGoodAmount`, `inputMana` |
| Work for one villager | 20 min / 30 min / 1 h / 3 h | `goods` › `workSeconds` |
| Which workshop makes which good | §3 | `buildings` › `produces` |
| Queue length by level | 3 → 12 | `buildings` › `queueLengthPerLevel` |
| Crew by level | 1 → 6 | `buildings` › `maxWorkersPerLevel` |
| How many the city may own | 1 at TH4, 2 at TH8 | `buildings` › `maxCountPerTownhallLevel` |
| What a building level costs in goods | [`buildings.md`](buildings.md) §4.11 | `buildings` › `costPerLevel`, that level's `goods` — [`05-city-and-districts.md`](05-city-and-districts.md) §3.2 |
| Gem price of the item in progress | 5 s a Gem | `rush.secondsPerGem` |

## 10. Deliberately not in this design

- **A good as a wallet row** ([`03-economy.md`](03-economy.md) §1).
- **Selling goods for Gold.**
- **Hand production and a collect tap.** The villager is the only engine.
- **A workshop level that shortens the work.** A level buys crew and queue.
- **Buying the queue.** Gems and speed-ups reach the item in progress and
  nothing else.
- **A workshop that makes a precious material**, and a third tier of refined
  goods.
- **Trading refined goods.** Only precious materials and relic fragments are
  traded.
