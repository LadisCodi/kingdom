# Proposal — the legendary boon

> **What this is.** One **kingdom passive per Legendary hero**, so a Legendary
> is a different KIND of thing to own rather than a Common with bigger
> numbers. It is a **proposal**, not a feature doc: the six effects below are
> candidates, spread across economy, research, exploration and combat, for you
> to pick from. Nothing here is built. Every number is a first pass.
>
> **It contradicts one line of the current design on purpose.**
> [`../features/10-heroes.md`](../features/10-heroes.md) §2.1 says *"rarity is
> a multiplier and a pool, never a mechanism"*. The boon makes it a mechanism
> for one rarity. §10's *"a rarity that changes how combat resolves"* stays
> intact: a boon acts on the kingdom, and the one combat-flavoured boon enters
> through the `Drill` the resolver already receives.

## 1. Where the two collections stand today

### 1.1 The five relics — every one of them taken

| Relic | Says | Stat | Op | L1 | Per level |
|---|---|---|---|---|---|
| **Dowsing Rod** | Forests, crops and stone recover faster | `cellRecovery` | mul | ×0.85 | −0.05 |
| **Verdant Seal** | Berries, game and shoals come back sooner | `cellRespawn` | mul | ×0.85 | −0.05 |
| **Foreman's Sigil** | Every worker carries more | `workerYield` | add | +1 | +0.5 |
| **Gilded Ledger** | Your villagers pay more tax | `taxRate` | mul | ×1.10 | +0.10 |
| **Wanderer's Compass** | Rooms pay more Stardust | `stardustYield` | mul | ×1.25 | +0.25 |

- **Those five stats are off the table for a boon.** A Legendary that moved
  `taxRate` would be a Gilded Ledger the player pulled instead of collected.

### 1.2 The six Legendaries — what they carry now

| Hero | Type | Trait | Read by the game? |
|---|---|---|---|
| **The Scout** *(Ranger)* · Goes on ahead | Archer | `SupplyDiscount` 0.40 | yes |
| **The Golden Dragon** · Older than the ruin, and bored of it | Cavalry | `PartyDefence` 0.45 | yes |
| **The Vampire Lord** · Collects, and has done for centuries | Cavalry | `FragmentBonus` 0.85 | **no** |
| **The Necromancer** · Asks the previous expedition | Archer | `KnowledgeBonus` 0.85 | **no** |
| **The Pharaoh** · Was buried with better men | Warrior | `WoundedRecovery` 0.40 | yes |
| **The Elven Princess** · Travels light, and expects you to | Lancer | `SupplyDiscount` 0.40 | yes |

- Every Legendary shares one stat block shape (`×1.5`) and one type passive
  (`dmg ×1.25`, `hp ×1.15`, `def +2`). **Nothing but the number tells them
  apart.**
- Two of the six carry a **dead trait**. `KnowledgeBonus` and `FragmentBonus`
  exist in the `HeroTrait` union and on the sheet, and **no call site reads
  either** — 14 of the 32 heroes have no off-board effect at all. The
  Necromancer's card also promises *"85% more Stardust"* while its trait is
  `KnowledgeBonus`, which is neither read nor Stardust.
- **Two Legendaries duplicate the same trait** (Scout and Elven Princess, both
  `SupplyDiscount`), and a party takes the best rather than the sum — so owning
  both is worth nothing over owning one.

## 2. What a boon is

- **One kingdom-wide passive, on while the hero is OWNED.** No slot, no
  equip, no party. There is no persistent hero board to hang it on — a party
  is composed per fight — and a passive that came and went with a battle
  screen would be unreadable.
- **A modifier at the base stage**, in the same stack a relic uses
  (`ModifierSource` already declares `'hero'`). One entry per owned Legendary,
  `expiresAt: null`, rebuilt from `heroes.owned` rather than added
  incrementally.
- **Commons and Rares have none.** That is the whole point.

### 2.1 How it differs from a relic

| | A relic | A boon |
|---|---|---|
| Shape | a **slope** — no ceiling, +1 level a season | a **step** — one number, fixed for ever |
| Earned by | completing an album, on the season's clock | pulling the hero, once |
| Moves | the five rates the city runs on (§1.1) | six numbers no relic touches |

- **A boon never scales.** Not with level, not with ascension, not with
  season. Level moves the body, ascension moves the type passive, and the boon
  is what arrives with the hero — three ladders, three jobs.
- **Boons stack; traits do not.** A party trait is the best in the party
  because two quartermasters must not buy a free trip. A boon is not a party
  thing: two Legendaries are two passives, and the stack sums them.
- **A duplicate adds nothing.** Owning is owning; a second copy pays
  Fragments, as it already does.

## 3. The six — one per Legendary

Spread so that **a boon pays off where the hero's sword cannot**: combat is
where a Legendary already acts, through its stat block and its type passive,
so it takes one boon and the kingdom takes five.

| Hero | Area | Stat | Op | Proposed | Reads |
|---|---|---|---|---|---|
| **The Pharaoh** | economy | `buildTime` | mul | **−15%** on every build and upgrade | `upgrades.ts#effectiveBuildTimeMultiplier` |
| **The Elven Princess** | economy | `manaRegen` | mul | **+25%** Mana a minute | `mana.ts#manaProduction` |
| **The Necromancer** | research | `researchTime` | mul | **−15%** on every research | `upgrades.ts#effectiveResearchTimeMultiplier` |
| **The Scout** | exploration | `revealCost` | mul | **−20%** Gold on every fog reveal | `fog.ts#revealCostForCell` |
| **The Vampire Lord** | exploration | `discoverRadius` | add | **+1 ring** on every building's sight | `fog.ts#effectiveDiscoverRadius` |
| **The Golden Dragon** | combat | `unitAtk` | add | **+3 ATK** on every unit | `expeditions.ts#drillOf` |

- **The Pharaoh builds.** The one boon a city feels on day one and still feels
  at Townhall 10, because the build queue never stops being the bottleneck.
- **The Elven Princess is the tap budget.** Every tap costs 1 Mana, so a
  quarter more Mana is a quarter more game per session — the most-felt number
  in the list and the reason she is not given something rarer.
- **The Necromancer asks the previous expedition**, which is the card's own
  line, and research is the only pillar with no relic and no live trait
  pointed at it.
- **The Scout goes on ahead.** The fog is the one wall Gold buys down, and
  `revealCost` is the number the Dowsing Rod's ACTIVE already argues with — so
  the boon leans on a decision the game already has rather than inventing one.
- **The Vampire Lord sees in the dark.** A ring on every building is the only
  boon here that changes the SHAPE of what the player knows rather than a
  rate, which is what makes owning him read differently from owning the Scout
  even though both are exploration.
- **The Golden Dragon is the war one**, flat ATK on every unit, through the
  `Drill` the resolver is already handed. `combat.ts` stays pure and nothing
  reads rarity at combat time.

### 3.1 What this fixes on the way

- The Vampire Lord and the Necromancer stop being the two Legendaries with **no
  off-board effect whatsoever**.
- The Scout and the Elven Princess stop being **the same hero twice**.
- The Necromancer's card stops promising Stardust it does not pay — **OQ-95**
  is the wider version of that hole, since 14 heroes carry a dead trait.

## 4. What it costs to build

| Step | Where |
|---|---|
| Three columns on the `Heroes` sheet — `boon_stat`, `boon_op`, `boon_value` — blank on every Common and Rare | `balance.xlsx`, `scripts/balance.mjs` |
| `HeroDef.boon: { stat: ModifierStat; op; value } \| null`, the shape `ArtifactDef.passive` already has | `data/definitions.ts` |
| `syncHeroBoons(state)` — filter the `hero:` prefix, re-add one per owned Legendary. A mirror of `syncArtifactModifiers`, idempotent and total | `sim/heroes.ts` |
| Call it where a hero lands and on load | `heroes.ts#grantHero`, `save.ts` |
| One line on the hero card, under the type passive | `ui/heroesSheet.ts` (§8.2) |
| `SAVE_VERSION` bump, **no migrator** — the boon is derived from `heroes.owned` | `sim/save.ts` |

- **No new `ModifierStat`.** All six are declared, resolved at a live call
  site, and not retired — unlike `delveSpeed` and `haulLoss`, which the room
  model left behind and which nothing reads.
- **No new screen.** The hero card already has the line.

## 5. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Which rarity has a boon | **Legendary only** | the sheet: blank = none |
| What each boon moves, and by how much | §3 | `Heroes` sheet, `boon_*` |
| Does a boon scale | **no** — a step, fixed for ever | — |
| Do two boons stack | **yes**, the stack sums | — |

## 6. Deliberately not in this proposal

- **A boon on a Rare or a Common.** The moment every rarity has one, the boon
  is a hero property and the Legendary is back to being a bigger number.
- **A boon that scales with level, ascension or season.** That is the relic's
  job, and three growing ladders on one hero is two too many.
- **A boon that needs the hero equipped, in a party, or on the board.** There
  is no persistent hero board, and building one to hang this on is a feature,
  not a passive.
- **A boon that changes how combat resolves.** The one combat boon is a flat
  number in the `Drill`; nothing reads rarity at combat time.
- **A boon on one of the five relic stats.** A pulled relic is not a
  Legendary.
- **An active, an ultimate, or anything the player presses.** The hero is a
  body, a buff and — now — a passive.
- **Retiring the trait.** The trait is the party-level thing and the boon is
  the kingdom-level thing; they are two layers, not two attempts at one.

**Open questions:** OQ-95, OQ-96 in
[`../open-questions.md`](../open-questions.md).
