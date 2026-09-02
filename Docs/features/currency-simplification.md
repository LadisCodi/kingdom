# Currency simplification: eleven wallet rows down to seven

**Built 2026-09-02.**

The game carried **eleven wallet currencies**: Gold, Food, Wood, Stone, Iron,
Knowledge, Gems, Mana, Berries, Meat and Fish — plus Fragments as a
per-collectible counter and a hero-XP field that was written and never read.

The docs had already named this twice without acting on it.
[`magic.md`](magic.md) lists *"Ten currencies, every one `cap: null`"* as the
state being fixed, and fixed exactly one of them (Mana gained a cap).
[`../art/ui-menus-redesign.md`](../art/ui-menus-redesign.md) §1 opens with
*"The header is a spreadsheet"* and leaves open question 3 — *"How many
currencies should ever be visible?"* — warning that the hide-until-relevant
rule is one-way, so a late-game player ends up back at five coins plus Mana
plus Gems on a 390 px row.

## What the comparable games do

| Game | City currencies | Premium | Research paid in |
|---|---|---|---|
| Polytopia (mobile 4X) | **1** (Stars) | — | Stars |
| Rise of Kingdoms | 4 (food/wood/stone/gold) | Gems | the same 4 |
| Age of Empires Mobile | 4 | Gems | the same 4 |
| Whiteout Survival | 4 (meat/wood/coal/iron) | Gems | the same 4 |
| Clash of Clans | 3 | Gems | the same 3 |
| Elvenar | 3 (coins/supplies/goods) | Diamonds | Knowledge Points — **time-accrued** |
| Forge of Empires | 2 + 5 goods/era | Diamonds | Forge Points — **time-accrued** |

Two things fall out of that table.

**Four city materials is the genre ceiling, not the floor.** Kingdom had six
spendable materials before its second region existed. Forge of Empires is the
only comparable with more, and it grew into that across fourteen years of
content.

**Nobody makes a research currency do three jobs.** In Elvenar, Forge of
Empires and Rise of Cultures the research currency is a *clock* — accrued per
hour, never earned, existing only to pace the tree. Kingdom's Knowledge was an
earned exploration reward **and** a tech gate **and** the relic/hero levelling
currency.

---

## The four cuts

### 1. Berries, Meat and Fish fold into Food, at harvest

They were already `countsAs: Food` — three wallet rows, three atlas coin cells
and a whole equivalence engine to express *"a berry is a unit of food."*

Now the cell pays Food directly, at the rate its wallet row was worth:
**Berries 1, Meat 3, Fish 2** a tap. The cells keep everything that made them
different — their art, their tech gates (Forestry, Hunting), their
taps-to-exhaust, their respawn timers, whether they are finite. What went is
the row in the purse.

A cell's **identity** and the currency it **pays** are now two separate
fields (`HarvestSpec.id` and `HarvestSpec.currencyId`), which is also what the
cell-scoped upgrades hang on: Butchery is about butchering and Irrigation is
about fields, even though both now move Food.

> **Fish resolves upward, to 2.** It carried two contradictory values — 1 Food
> as a cost but 2 Gold at the Market — so the fold had to pick one. It picked
> the higher, so the Docks / `Fishing` / `BigNets` line still earns the tech
> that opens it. The one number in this pass that genuinely moved; watch it.

Deleted with it: `src/sim/wallet.ts`'s equivalence engine (`equivalentsOf`,
`effectiveAmount`, the cheapest-first payment order, change-making), the purse
sheet's Food breakdown, and `Game.effectiveWalletValue` — which merged back
into `walletValue`, so ~20 UI call sites lost a distinction they never wanted.

### 2. Iron folds into Stone

Iron's stated job in [`resource-expansion.md`](resource-expansion.md) was
*"the metal that decides how deep you can delve"* and the far-fog payoff. It
had two build sinks (the Stables), one unit (the Cavalry) and expedition
supplies at tier 3+.

**Distance carries that payoff without a wallet row.** An iron vein is now a
*rich* Stone node: 3 a tap against a plain rock's 1, keeping its 5 taps and
its 300-second recovery. A vein pays 15 Stone a cycle where a rock pays 5 —
visibly worth the walk, at the far end of the fog curve where it always sat.

Everything converts at **1 Iron = 3 Stone**, their `gold_value` ratio: Stables
30/90, Cavalry 60, deep-ruin supplies 30/60/120, and a tier-3+ delve haul pays
triple material. `DeepMining`, `Mining` and `IronPicks` keep their names and
now move Stone; the Mine still works veins. `FeatureId.IronVein` and the map's
`I` code are untouched, so no map edit and no region-map regeneration.

### 3. The technology tree is priced in Gold

Research is paid out of `city.wallet` now, so the tree competes with clearing
fog and raising a building for **one budget**. Three calls on one purse is the
decision the economy is built around; a second purse just removed the tree
from that contest.

The prices are the pre-Knowledge Gold column restored from `1256a42^` — minus
that version's Wood/Stone/Food/Iron riders, since the decision is Gold-only —
with Forestry cut 75 → 25 because the opening is tighter than it was then, and
Hunting and Cartography priced beside their branch neighbours. **6,600 Gold
across 24 technologies**, against the 6,425 that left when the tree went
Knowledge-only ([`knowledge.md`](knowledge.md) §6 flagged that as an
unmeasured hole; this fills it).

The line between technologies and instant upgrades is no longer which currency
they cost. It is that **an upgrade is permanent and stacking; a technology is
a one-time unlock**.

### 4. Knowledge becomes a dungeon reward

The larger half of the change, and its own doc:
[`knowledge.md`](knowledge.md). In short — clearing fog pays no Knowledge, the
ruin drip is re-gated on **cleared** ruins rather than discovered ones, the
early quest chain pays Gold instead, and the two new faucets are a first-clear
lump and every gacha pull.

Knowledge leaves the header entirely and reads in the Reliquary, beside the
Study buttons that spend it.

---

## What the wallet looks like now

| | Before | After |
|---|---|---|
| Wallet rows | 11 | **7** |
| Coins the plank can hold | 6 | **4** (3 for the first hour) |
| Currency-equivalence engine | 52 lines | **deleted** |
| Market crates | 6 | **3** (Food 1, Stone 2, Wood 3) |

**Gold · Food · Wood · Stone** are the city coins. **Mana** is the energy
gauge, not a coin — it is capped, it is drawn as a bar, and it is what every
tap is paid from. **Knowledge** is kingdom-scoped and lives in the Reliquary.
**Gems** are the player's. Fragments stay a per-collectible counter, not a
wallet row.

## Migration

`SAVE_VERSION` 20 → 21, with one migrator (`src/sim/save.ts`). A save's
balances convert at the rates they were **earned** at — the old `countsAs`
values (1, 3, 1) and Iron's 3:1 against Stone — not at whatever a cell pays
per tap today. Somebody who banked 10 Fish banked 10 Food's worth of buying
power, whatever a shoal is worth now.

Kingdom and player purses are untouched: a player who banked Knowledge from
fog keeps it, which is the generous reading and costs nothing. Queued builds
need no migration — `cancelQueueItem` recomputes the refund from the formula
rather than a stored snapshot.

## Balance surface

The `Currencies` sheet loses `counts_as` and `unit_value`; `Technologies`
loses `cost_knowledge` for `cost_gold`; `Districts`, `Units`, `Quests` and
`Ruins` lose their `*_iron` columns. `Settings` drops
`knowledge.per_reveal_ring` and `fog.silver_per_tap` (dead Unity residue), and
gains `delve.first_clear_knowledge` and `gacha.pull_knowledge`.

`balance/balance.xlsx` is the source of truth and `predev`/`prebuild` run the
importer, so **editing `balance.json` alone gets silently overwritten**. The
order that works is: edit the JSON and the importer schema together, then
`npm run balance:export` (JSON → xlsx), then `npm run balance` (xlsx → JSON)
to prove the round-trip.

## Open questions

- **`ui-menus-redesign.md` questions 3 and 7 are answered.** The plank holds
  four coins at its worst, three for the first hour, and the hide-an-unused-
  coin rule floated in question 3 is no longer needed.
- **The delve gate.** Collection progress now sits behind army → hero → ruin →
  first clear. That gives the military buildings a job outside dungeons, which
  `00-design-intent.md`'s backlog wants, but a player who never delves makes
  no progress on the weeks-long arc at all. First thing to watch in playtest.
- **The restored Gold sink is unmeasured** past the onboarding.
  `tests/onboarding.test.ts` proves steps 1–14 work on nothing but what the
  game grants; the mid-game has not been played.
- **Ten progression systems is still the standing risk**
  ([`heroes-and-gacha.md`](heroes-and-gacha.md)). This pass cuts the currency
  half of it and leaves the systems count alone.
