# Hero skills — a skill per hero and villain, ranked up with Stardust

> **Scope.** Gives every hero and every villain one **skill** that acts in
> the fights it is in; keeps the kingdom passive (the BOON) for Legendaries
> only; replaces the TRAIT
> ([`../features/10-heroes.md`](../features/10-heroes.md) §2.5). The body and
> the type passive are unchanged.
>
> **Status: proposal — decisions taken (2026-10-06)**, ready to build.

## 1. The rule

- **Every hero has one SKILL, and it acts only in the fights the hero is
  in.** Owning a hero gives nothing; sending it does.
- **Only a Legendary also has a BOON**, on while owned (unchanged).
- **Every villain has a skill too**: the heroes' counterpoint, from the same
  list, by the same rules.
- **No effect twice within a rarity.** An effect may appear in several
  rarities, stronger in the higher one.
- **A skill has five RANKS**, bought with Stardust once the hero's level
  allows (§5).

## 2. The kinds

Five kinds in code; their variants are data.

| Kind | Variants (the effect) | Fires |
|---|---|---|
| **Strike** — an extra hit at X% of the hero's damage | **Sharpshot** (the enemy with least HP) · **Crush** (the enemy with most HP) · **Cleave** (every enemy front-row slot) · **Ambush** (the enemy back-row slot with least HP) · **Volley** (every enemy slot) | every N s |
| **Heal** — X% of the target's max HP | **Mend** (the most wounded ally) · **Wave** (every ally) | every N s |
| **Shield** — soaks X% of the hero's HP of damage | the front-row ally with least HP | every N s |
| **Daze** — the target's next attack comes X s later | the enemy with the highest damage | every N s |
| **Rally** — for the whole fight, every ally squad of every type | **War cry** (+X% damage) · **Bulwark** (+X DEF) · **Vigour** (+X% HP) | at the start |
| **Spoils** — when the fight is won | **Plunder** (+X% hoard and loot) · **Lore** (+X% Knowledge) · **Seasoned** (+X% Hero XP) · **Field medic** (+X points of the fallen carried home wounded) | at the end |

- **Timed skills** run their own countdown beside the hero's attack, on the
  100 ms tick, while the hero lives. A fixed target rule and integer
  arithmetic: no roll, the fight stays deterministic.
- **A Rally** is applied at battle start and stands if the hero falls — the
  type passive's rules, for every type, smaller.
- **Spoils** count if the fight is won, whether the hero survived it or not.
  A villain carries no Spoils.

## 3. Heroes

### 3.1 Common — 14 heroes, 14 effects

| Hero | Type | Skill (rank 1) |
|---|---|---|
| Warden | Warrior | **Shield** — every 5 s, 15% of its HP |
| Sellsword | Warrior | **Cleave** — every 4 s, 60% of its damage |
| Quartermaster | Lancer | **Bulwark** — +2 DEF |
| Cook | Lancer | **Vigour** — +5% HP |
| Bard | Archer | **War cry** — +5% damage |
| Cleric | Warrior | **Mend** — every 4 s, 10% |
| Gardener | Warrior | **Wave** — every 6 s, 3% |
| Joker | Archer | **Daze** — every 5 s, 1 s |
| Rogue | Cavalry | **Sharpshot** — every 4 s, 80% of its damage |
| Beastkin Hunter | Cavalry | **Ambush** — every 4 s, 100% of its damage |
| Three Mice | Archer | **Volley** — every 5 s, 25% of its damage |
| Merchant | Lancer | **Plunder** — +15% |
| Adventurer | Lancer | **Seasoned** — +20% |
| Priest | Warrior | **Field medic** — +10 points |

### 3.2 Rare — 12 heroes, 12 effects

| Hero | Type | Skill (rank 1) |
|---|---|---|
| Dark Knight | Warrior | **Crush** — every 4 s, 120% of its damage |
| Paladin | Warrior | **Shield** — every 5 s, 25% of its HP |
| Holy Warrior | Cavalry | **War cry** — +8% damage |
| Ice Lancer | Lancer | **Daze** — every 4 s, 2 s |
| Druid | Lancer | **Wave** — every 5 s, 5% |
| Witch | Archer | **Mend** — every 4 s, 15% |
| Wizard | Archer | **Volley** — every 5 s, 40% of its damage |
| Electric Archer | Archer | **Sharpshot** — every 3 s, 100% of its damage |
| Spymaster | Archer | **Ambush** — every 3 s, 120% of its damage |
| Savage Warrior | Cavalry | **Cleave** — every 3 s, 80% of its damage |
| Relic-hunter | Cavalry | **Plunder** — +30% |
| Scholar | Archer | **Lore** — +25% |

### 3.3 Legendary — 6 heroes, 6 effects, and the boon

| Hero | Type | Skill (rank 1) | Boon (unchanged) |
|---|---|---|---|
| Pharaoh | Warrior | **War cry** — +15% damage | +20% build speed |
| Elven Princess | Lancer | **Wave** — every 5 s, 6% | +25% Mana |
| Necromancer | Archer | **Volley** — every 5 s, 60% of its damage | +25% Knowledge |
| Golden Dragon | Cavalry | **Cleave** — every 5 s, 120% of its damage | +10% unit health |
| Vampire Lord | Cavalry | **Crush** — every 3 s, 180% of its damage | +25% Hero XP |
| Ranger | Archer | **Sharpshot** — every 3 s, 150% of its damage | +25% explorer speed |

## 4. Villains

| Villain | Type | Skill |
|---|---|---|
| Barrow Thane | Warrior | **Mend** — every 5 s, 12% |
| Drowned Choir | Archer | **Volley** — every 5 s, 30% of its damage |
| Slag Warden | Lancer | **Bulwark** — +3 DEF |
| The Ledger Keeper | Cavalry | **Daze** — every 4 s, 1.5 s |
| The Star Seer | Archer | **Crush** — every 4 s, 140% of its damage |

- A villain's skill is authored at its rank, as its stat block is: no
  ladder.

## 5. Ranks

- **Five ranks.** Rank 1 comes with the hero.
- **A rank UNLOCKS at a level** and is then **BOUGHT with Stardust**. It is
  never raised on its own.
- The unlock levels sit past a tier cap, so each rank asks for an
  **ascension and levels**:

  | Rank | Unlocks at level | Needs tier | Stardust |
  |---|---|---|---|
  | 1 | — (recruited) | 1 | — |
  | 2 | 15 | 2 | 100 |
  | 3 | 25 | 3 | 200 |
  | 4 | 35 | 4 | 400 |
  | 5 | 45 | 5 | 800 |

- **Each rank adds 25% of the rank-1 value**: rank 5 is twice rank 1. What
  grows is the X — the hit, the heal, the shield, the delay, the bonus;
  never how often it fires.
- **1,500 Stardust** ranks one hero to the top — a second Stardust sink
  beside ascension's 750 (**OQ-78**).
- Dials: `heroLadder.skillRankLevels`, `skillRankStardust`, `skillRankStep`.

## 6. The screens

- **The hero card** gains a **Skill** section under the type passive:
  - its name, its icon, five rank pips, and the generated sentence at the
    current rank (*Every 4 s, heals the most wounded ally for 10% of its
    health*);
  - **next rank**: the sentence at the next rank, and either the
    **Upgrade** button with its Stardust price, or a padlock with what is
    missing (*Reach level 15*, *Ascend to tier 2*);
  - a dot on the card and on the roster tile when a rank can be bought now.
- **The roster** shows the rank pips on every owned hero's tile.
- **The battle playback**: a skill fires with its name over the hero and its
  effect on the target — green numbers for a heal, a bubble for a shield,
  the hit as any other. A villain's the same.
- **The attack sheet** lists each villain's skill beside its stats. The
  expected losses come from running the fight, so they count every skill.

## 7. What goes

- **The five traits** and their readers: `SupplyDiscount` (supplies back to
  the base price), `PartyDefence`, `WoundedRecovery` (now **Field medic**),
  `KnowledgeBonus` and `FragmentBonus` (now **Lore** and **Plunder**).
  **OQ-95** closes.
- The heroes doc's "no hero ability beyond the type passive" and combat §18's
  "abilities … beyond the type passive".

## 8. Building it, in order

1. **Data**: `skill` on `heroes` and `villains` — `{ kind, variant, value,
   every? }`; the rank dials on `heroLadder`; `trait` and `traitValue` go. A
   rule: no `kind`+`variant` twice within a rarity.
2. **Combat**: a skill countdown per hero slot, the four timed kinds, Rally
   folded into the battle-start bonuses, a `skill` event in the stream. The
   golden battle test is rewritten, on purpose.
3. **Spoils**: read where a won fight pays out.
4. **Ranks**: `state.heroes.skillRank` per hero (an additive save field, no
   migrator), the buy command and its Stardust price.
5. **UI**: the card's Skill section and Upgrade, the roster pips, the
   playback's skill pop, the villain's skill on the attack sheet.
6. **Docs**: 10-heroes §2.5 becomes the skill, combat §9 gains §9.3; this
   proposal is retired.

## 9. Deliberately not in this design

- A kingdom passive below Legendary.
- A skill the player triggers: no input during the fight.
- A random skill — a chance to crit, to dodge, to proc.
- Two skills on one hero.
- A rank that makes a skill fire more often.
- For the prototype: Taunt, Rise, Sunder, Inspire, Drain.
