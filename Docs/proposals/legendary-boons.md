# Proposal — the legendary boon

> **What this is.** One **kingdom passive per Legendary hero**, so a Legendary
> is a different KIND of thing to own rather than a Common with bigger
> numbers.
>
> **Status: built 2026-09-14**, all six, less the one call site the world map
> owes. Every number here is a first pass (**OQ-96**).
>
> **The Scout's boon is declared and not yet collected.** It moves the world
> map's cell-exploration timer
> ([`../features/19-world-map.md`](../features/19-world-map.md)), which is
> designed and unbuilt; `worldRevealSpeed` is in the stack, the hero carries
> it, and the timer reads it the day it exists. This is a prototype and a
> pending wire is acceptable; `tests/heroBoons.test.ts` names it so it cannot
> be forgotten.
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
- **Two of the five break their own rule.**
  [`../features/09-relics.md`](../features/09-relics.md) §2 says *"a speed or
  a yield, never a discount, because a discount dies at 100%"* — and the
  Dowsing Rod and the Verdant Seal are authored as time multipliers falling
  0.05 a level. **Both reach zero at level 18** and every season after that
  pays nothing. The other three are additive or grow upward and never end.
  **OQ-97.**

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

### 2.1 Every boon points UP

- **A boon is always a MULTIPLIER, always above 1.** There is no `op` column,
  because there is no choice to author: a flat bonus is worth less every hour
  the kingdom grows, and a multiplier stays proportionally worth the same for
  ever.
- **A speed, a yield or a capacity — never a discount, a cost or a time.** The
  relic rule, applied here: a number that goes DOWN dies when it reaches zero,
  and a permanent passive that can be finished is a passive with a ceiling.
- Where the number the game owns is a **time**, the boon moves a **speed** and
  the call site divides by it:

  | Boon | Time it produces | |
  |---|---|---|
  | ×1.20 | 83% | a fifth faster |
  | ×2.00 | 50% | twice as fast |
  | ×5.00 | 20% | five times as fast |

  It approaches zero and never arrives, so there is no clamp to write and no
  level at which the next one is worth nothing. `workerSpeed` is already
  shaped this way — tiles a second, multiplied up — so the pattern is the
  codebase's, not a new one.
- **No boon moves a cost.** `revealCost`, `supplyCost`, `claimCost`,
  `recruitCost` and `activeCost` all die at 100% off, so none of them can
  carry a passive that never stops growing.

### 2.2 How it differs from a relic

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

| Hero | Area | Stat | Boon | Reads |
|---|---|---|---|---|
| **The Pharaoh** | economy | `buildSpeed` | **×1.20** — the builders work a fifth faster | `upgrades.ts#effectiveBuildTimeMultiplier` |
| **The Elven Princess** | economy | `manaRegen` | **×1.25** Mana a minute | `mana.ts#manaProduction` |
| **The Necromancer** | research | `researchSpeed` | **×1.25** — research runs a quarter faster | `upgrades.ts#effectiveResearchTimeMultiplier` |
| **The Scout** | exploration | `worldRevealSpeed` | **×1.25** — a world-map cell is scouted faster | the world map's reveal timer — **pending** |
| **The Vampire Lord** | exploration | `heroXp` | **×1.25** Hero XP out of every room | `heroes.ts#addHeroXp` |
| **The Golden Dragon** | combat | `unitHp` | **×1.10** health on every unit | `expeditions.ts#drillOf`, and `battle.ts#buildBoard` |

- **Every one is a multiplier**, so the six stay proportionally worth the same
  as the kingdom grows, and none has a level at which it stops being worth
  having (§2.1).
- **The Pharaoh builds.** The one boon a city feels on day one and still feels
  at Townhall 10, because the build queue never stops being the bottleneck.
- **The Elven Princess is the tap budget.** Every tap costs 1 Mana, so a
  quarter more Mana is a quarter more game per session.
- **The Necromancer asks the previous expedition**, which is the card's own
  line. Research is the only pillar with no relic and no live trait pointed at
  it, and the speed is the up-shaped half of it: research TIME would have run
  out, a speed only ever approaches zero.
- **The Scout goes on ahead.** The world map's reveal timer is the only
  exploration clock the game will have — a ruin's depth resolves the instant
  the player enters it, so there is no delve time to shorten.
- **The Vampire Lord collects, and has done for centuries.** Every room teaches
  the heroes more, which is the one faucet the hero ladder runs on — and the
  nearest live thing to the `FragmentBonus` his card has been promising into
  the void.
- **The Golden Dragon is the war one.** A multiplier on every unit's health
  rather than flat ATK, so it is worth the same fraction of a fight at ten
  Warriors as at a hundred. It reaches the RESOLVER as well as the estimate:
  a bonus the launch screen shows and the fight does not keep is a promise on
  the sheet, which `combat.ts` says in its own words.

### 3.1 What this fixes on the way

- The Vampire Lord and the Necromancer stop being the two Legendaries with **no
  off-board effect whatsoever**.
- The Scout and the Elven Princess stop being **the same hero twice**.
- The Necromancer's card stops promising Stardust it does not pay — **OQ-95**
  is the wider version of that hole, since 14 heroes carry a dead trait.

## 4. What it took

| Step | Where |
|---|---|
| Two columns on the `Heroes` sheet — `boon_stat`, `boon_value` — blank on every Common and Rare, and refused below 1 | `balance.xlsx`, `scripts/balance.mjs` |
| `HeroDef.boon: HeroBoon \| null`, the shape `ArtifactDef.passive` already had, minus the op | `data/definitions.ts` |
| `syncHeroBoons(state)` — filter the `hero:` prefix, re-add one per owned Legendary. A mirror of `syncArtifactModifiers`, idempotent and total | `sim/heroes.ts` |
| Called where a hero lands and on load | `heroes.ts#grantHero`, `save.ts` |
| `boonText()` — the sentence, GENERATED from the stat and the number, never authored beside them | `sim/heroes.ts` |
| A second line on the hero card, under a gold rule | `ui/heroesSheet.ts`, `styles/screens/heroes.css` |
| `SAVE_VERSION` 45, **no migrator** — the boon is derived from `heroes.owned` | `sim/save.ts` |

**Four new `ModifierStat`s**, all of them speeds or multipliers:

- `buildSpeed` and `researchSpeed` — the stack's half of two numbers the TREE
  discounts. The tree keeps `buildTime` and `researchTime` because a rank
  ladder is bounded; the stack divides by a speed because a passive is not.
  Both helpers lost nothing: the tree's floor of 0.25 still holds on its own
  half.
- `unitHp` — a global multiplier on the `Drill`, which reaches `partyStats`
  (the estimate) **and** `buildBoard` (the resolver), so the launch screen and
  the fight agree.
- `worldRevealSpeed` — declared, in the stack, and read by nothing until the
  world map's timer exists.

## 5. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| Which rarity has a boon | **Legendary only** | the sheet: blank = none |
| What each boon moves, and by how much | §3 | `Heroes` sheet, `boon_*` |
| Which direction a boon may point | **up only** — a speed, a yield or a capacity | §2.1, and a test |
| When a boon ships | **with the call site that reads it**, never before | the Scout's waits on the world map |
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
- **A boon that ships before the number it moves exists.** A stat nothing
  reads is a bonus nobody collects; the slot is reserved in writing instead,
  and a hero waits rather than carrying a placeholder he would keep.
- **A boon shaped as a discount, a cost or a time.** A number that falls has
  a floor, and a permanent passive that can be finished is a passive with a
  ceiling (§2.1). Where the game owns a time, the boon owns the speed.
- **A boon that changes how combat resolves.** The one combat boon is a flat
  number in the `Drill`; nothing reads rarity at combat time.
- **A boon on one of the five relic stats.** A pulled relic is not a
  Legendary.
- **An active, an ultimate, or anything the player presses.** The hero is a
  body, a buff and — now — a passive.
- **Retiring the trait.** The trait is the party-level thing and the boon is
  the kingdom-level thing; they are two layers, not two attempts at one.

**Open questions:** OQ-95, OQ-96, OQ-97 in
[`../open-questions.md`](../open-questions.md).
