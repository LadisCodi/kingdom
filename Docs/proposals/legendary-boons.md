# Proposal — the legendary boon

> **What this is.** One **kingdom passive per Legendary hero**, so a Legendary
> is a different KIND of thing to own rather than a Common with bigger
> numbers. It is a **proposal**, not a feature doc: the six effects below are
> candidates, spread across economy, research, exploration and combat, for you
> to pick from. Nothing here is built. Every number is a first pass.
>
> **Five of the six can be built today.** The Scout's moves the world map's
> exploration timer ([`../features/19-world-map.md`](../features/19-world-map.md)),
> which is designed and unbuilt, so his slot is reserved rather than filled.
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

- **A boon is a speed, a yield or a capacity — never a discount, a cost or a
  time.** The relic rule, applied here: a number that goes DOWN dies when it
  reaches zero, and a permanent passive that can be finished is a passive with
  a ceiling.
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

| Hero | Area | Stat | Op | Proposed | Reads |
|---|---|---|---|---|---|
| **The Pharaoh** | economy | `buildSpeed` **(new)** | mul | **×1.20** — the builders work a fifth faster | `upgrades.ts#effectiveBuildTimeMultiplier` |
| **The Elven Princess** | economy | `manaRegen` | mul | **×1.25** Mana a minute | `mana.ts#manaProduction` |
| **The Necromancer** | research | `knowledgeYield` | mul | **×1.25** Knowledge an hour | `mana.ts#knowledgePerHour` |
| **The Scout** | exploration | `worldRevealSpeed` **(new, pending)** | mul | **×1.25** — a world-map cell is scouted faster | the world map's reveal timer — **not built** |
| **The Vampire Lord** | exploration | `heroXp` | mul | **×1.25** Hero XP out of every room | `heroes.ts#addHeroXp` |
| **The Golden Dragon** | combat | `unitAtk` | add | **+3 ATK** on every unit | `expeditions.ts#drillOf` |

- **Every one of the six points up**, and none has a level at which it stops
  being worth having (§2.1). Five are yields or speeds multiplied upward; one
  is a flat addition to a number with no top.
- **Five of the six can be built today.** The Scout's waits on the world map
  and says so.
- **The Pharaoh builds.** The one boon a city feels on day one and still feels
  at Townhall 10, because the build queue never stops being the bottleneck. It
  is a SPEED, so `effectiveBuildTimeMultiplier` divides by it and its floor of
  0.25 — a hard 4× ceiling — goes away.
- **The Elven Princess is the tap budget.** Every tap costs 1 Mana, so a
  quarter more Mana is a quarter more game per session — the most-felt number
  in the list and the reason she is not given something rarer.
- **The Necromancer asks the previous expedition**, which is the card's own
  line. Research is the only pillar with no relic and no live trait pointed at
  it, and the yield is the up-shaped half of it: Knowledge an hour grows for
  ever where research TIME would have run out.
- **The Scout goes on ahead — on the world map, when there is one.** Revealing
  a world-map cell costs **Gold and TIME**, with a countdown a player can rush
  with Gems ([`../features/19-world-map.md`](../features/19-world-map.md),
  *Niebla y exploración*). That timer is the only exploration clock the game
  will have: a ruin's depth resolves the instant the player enters it, so there
  is no delve time for the Scout to shorten. His boon is a **speed on that
  timer**, divided in exactly as the Pharaoh's is (§2.1).
- **His boon ships with the world map and not before.** A stat nothing reads
  is a bonus nobody collects, so `worldRevealSpeed` is declared when the timer
  that reads it is. Until then the Scout carries his `SupplyDiscount` trait,
  which works, and no boon. **Writing it down now is the point**: the world
  map's reveal timer should be built with the hook in it, which costs one
  `resolve()` at the call site and nothing else — retrofitting it later costs
  a balance pass on a live number.
- **`discoverRadius` is deliberately left unassigned.** It was the Scout's in
  the first draft and it is a better fit for nobody else; a boon is permanent
  on a hero players own, so handing him a placeholder now means he keeps it
  when the real one arrives.
- **The Vampire Lord collects, and has done for centuries.** Every room teaches
  the heroes more, which is the one faucet the hero ladder runs on — and the
  nearest live thing to the `FragmentBonus` his card has been promising into
  the void.
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

- **One new `ModifierStat` now: `buildSpeed`.** Four of the six are already
  declared, resolved at a live call site and not retired — unlike `delveSpeed`
  and `haulLoss`, which the room model left behind and which nothing reads.
  The Pharaoh's is new because §2.1 will not take `buildTime`: one line in
  `modifiers.ts`, and `effectiveBuildTimeMultiplier` becomes
  `techValue(...) / resolve(state, 'buildSpeed', 1)` with its 0.25 floor
  deleted. `buildTime` stays exactly as it is for the tree's ranks.
- **One more later: `worldRevealSpeed`**, declared with the world map's reveal
  timer and read by it. Nothing to build for it today except the note in
  [`../features/19-world-map.md`](../features/19-world-map.md).
- **No new screen.** The hero card already has the line.

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
