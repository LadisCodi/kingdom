# 11 · Expeditions — ruins, delves, the army and combat

> **Scope.** The army, what it is made of, how a fight is resolved, and the
> staged delve that is the only decision-under-uncertainty in the game. What a
> ruin *pays* is [`10-heroes.md`](10-heroes.md) §4; what it *holds* is
> [`01-map-and-fog.md`](01-map-and-fog.md) §6.
>
> **Status: built**, minus contested landmarks — see
> [`15-social.md`](15-social.md) §6.

## 1. The rules, up front

1. **A hero is mandatory.** Units never delve alone.
2. **Combat is a scoring pass, not a simulation.** No rounds, no targeting, no
   battle screen.
3. **Nothing is ever lost but the haul.** No unit casualties, ever.
4. **A failed push costs 50% of the carried haul** and ends the run.
5. **A well-prepared run never fails.** The safe depth is computable and shown
   before launch.
6. **Delve timers never pause.** The offline cap governs the city's idle economy
   only.
7. **Military buildings raise the army cap; the Townhall does not.**

## 2. The delve

Commit **one hero** plus **units** → pay **supplies** → the party clears one
**depth** at a time. After each depth it stops at a checkpoint and asks one
question:

> **Go deeper, or come back with what you're carrying?**

Deeper pays more. Failing loses half the haul and ends the run.

**This is what gives a visit texture.** A single long expedition produces one
decision per visit, so some visits contain nothing; staged depths produce three
or four, and the run is **self-terminating** — you push until you choose to stop.

### The five ruins

| Ruin | Distance | Tier | Base depth | Growth | Max depth | Full clear | Supplies | Affinity |
|---|---|---|---|---|---|---|---|---|
| Hollow Barrow | ~3 | I | 3 min | ×1.15 | 5 | ~20 min | 20 F + 50 G | Warrior |
| Sunken Chapel | ~6 | II | 5 min | ×1.20 | 7 | ~65 min | 40 F + 150 G | Archer |
| Drowned Ironworks | ~8 | III | 8 min | ×1.25 | 9 | ~3.5 h | 60 F + 400 G + 30 S | Lancer |
| The Counting House | ~10 | IV | 12 min | ×1.30 | 11 | ~9 h | 100 F + 900 G + 60 S | Cavalry |
| Star Observatory | ~12 | V | 18 min | ×1.35 | 13 | ~1.5 days | 150 F + 2000 G + 120 S | any |

```
depthTime = base(tier) × growth^(depth − 1)
```

**Time grows with depth inside a run**, not only across tiers. That is what makes
*one more depth* a real escalation — each further step is a longer commitment
before the next safe point — and it naturally caps how far anyone pushes in one
sitting. **Tier I teaches the loop inside a single visit; Tier V is a multi-day
project held together by its checkpoints.**

A ruin's **affinity** is the threat type dominating its depths, so a dungeon
rewards a *composition* rather than a single unit.

**Supplies are a flat cost at launch, not per depth.** The depth decision should
be purely risk against reward, with nothing else muddying it.

## 3. The party

**A hero is mandatory** — every party is one hero commanding troops. Heroes carry
a unit type of their own, so the hero choice feeds the same matchup chart as the
troops, and a second hero becomes valuable for **coverage** as well as
concurrency.

**Party slots** start at **2** (hero + one unit) and expand to **5**. One slot
unlocks through **research** — which gives the tree new leaves and a reason to
matter past the three-hour mark — and the rest cost **Gems**
(`25 × 2.2^purchased`). Research is the earned half of the gate, so the paid gate
is never the only route in.

A party may also carry **one relic** ([`09-relics.md`](09-relics.md) §5.1).

## 4. Combat — a scoring pass

Units carry **ATK / DEF / HP**. Each depth carries an authored **threat profile**
(type + strength). Resolving a depth is one deterministic pass over the party:

- **ATK vs the threat**, multiplied by the type chart → did you clear the depth?
- **The threat vs DEF** → damage, absorbed by party HP.
- **HP does not regenerate between depths.** That is the attrition.

| Unit | ATK / power | DEF | HP | Recruit | Train |
|---|---|---|---|---|---|
| **Warrior** | 3 | 3 | 12 | 50 G + 10 W + 20 F | 30 s |
| **Lancer** | 5 | 2 | 8 | 100 G + 30 W + 10 F | 40 s |
| **Archer** | 6 | 1 | 6 | 60 G + 30 W | 25 s |
| **Cavalry** | 7 | 2 | 10 | 150 G + 40 F + 60 S | 60 s |

A unit's **power** — what it costs against the army cap — equals its ATK, so the
cap reads directly as attack potential.

**The trade is deliberate.** Archers buy the most ATK per Gold and the least
survivability, so a glass party clears shallow depths cheaply but cannot sustain
a deep push, where attrition decides. Warriors are the opposite. **Neither is
correct on its own, which is the point** — and it is what earns DEF and HP their
place: a pure power score would not need them.

| Beats | Why |
|---|---|
| **Lancer** → Cavalry | spears stop horses |
| **Cavalry** → Archer | horses run down bowmen |
| **Archer** → Warrior | arrows beat heavy infantry at range |
| **Warrior** → Lancer | shields close the gap on spears |

**×1.5 advantage / ×0.75 disadvantage.** Sharper values (×2/×0.5) are more
dramatic but make one bad guess feel like a wasted trip, which is the un-cozy end
of the dial.

**The type chart does its work at COMPOSITION time**, which is where the decision
belongs in a management game. A tactical resolution would move the decision
inside a fight — a different genre, and one that eats the 30-minute session
budget. And the middle option is the worst of the three: **simulating combat in
detail without showing it means the player sees only win or lose and learns
nothing from all that machinery.**

**No battle screen.** Resolution is instant and reported at the checkpoint: what
you cleared, what it cost in HP, what you carry. The moment there is a fight to
watch, the game is spending its scarcest resource on the part that is not the
pitch.

**Units return wounded and recover fully on reaching the city** — no healing
management, no second timer.

## 5. The law on randomness, and how the gamble respects it

**A well-prepared run never fails.** Everything in §4 is deterministic, so a
party's **guaranteed depth is computable and shown before launch.**

> The gamble is **information, not dice.**

You do not know the next depth's threat type until you commit to it. That
preserves the law — you are never robbed by a roll, you simply did not know what
was down there — and it gives a hero trait something to sell: **The Scout**
reveals the next depth, turning information into a purchasable advantage.

**Attrition is what makes the risk curve emergent rather than authored.** The
deeper you go, the more worn the party, so danger rises visibly on a depleting
bar instead of following a probability curve someone invented.

> Your economy decides how deep you go **safely**. Everything past that is a
> gamble you opt into, on information you chose not to wait for.

Seeded RNG rolls only *which* rewards drop. And the safe floor must be **truly
safe**: it has to assume the **worst matchup the depth can produce**, not the
ruin's affinity — the threat draw is weighted toward the affinity but can still
produce any of the four types. A safe depth that is not safe turns
push-your-luck into being robbed.

### Two rules that keep this cozy

- **The haul is not yours until you extract it.** That framing is what makes a
  50% loss legitimate under *nothing you own is ever taken* — nothing you *own*
  is taken; you declined a sure thing. Identical logic to Mana overflow:
  unrealised gain, never property. **The UI must sell this from the first depth**
  or players will feel robbed whatever the technicality.
- **A checkpoint never expires.** The party waits at depth 3 indefinitely — no
  decision timer, no interrupt, no auto-fail while away. That is what stops the
  system becoming an interruption engine, and it turns a parked delve into a
  return hook: *your party waits at depth 3 — 12 pieces so far.* The cost of not
  deciding is real but gentle: that hero stays committed until you do.

### Standing orders — the opt-out

Set **"delve to depth N, then return"** at launch and the whole run resolves
offline with no prompts. **Push-your-luck becomes the engaged player's mode;
anyone else sets it and leaves.** Deeper standing orders are exactly the comfort
purchase the third promise authorises. Both modes ship, so they can be compared
directly.

## 6. Military buildings raise the army cap

Army size stops being a passive consequence of a gate the player was going to
pass anyway and becomes a **city-building decision**. Each unit type is trained
by its own building, each gated behind the military branch that already exists.

| Building | Trains | Cap per level |
|---|---|---|
| **Barracks** | Warrior · Lancer · Archer | 6 / 10 / 15 |
| **Spear Hall** | Lancer | 6 / 10 / 15 |
| **Shooting Grounds** | Archer | 6 / 10 / 15 |
| **Stables** | Cavalry | 6 / 10 / 15 |

**The Barracks turns out every foot soldier and Cavalry keeps the Stables**, with
each unit still behind its own technology — so the choice fills in as the player
researches rather than arriving all at once. That leaves the Spear Hall and
Shooting Grounds as **specialists rather than sole sources**: a second hall is a
second *parallel* training line and more army cap, not a different roster. Which
building a unit is queued at therefore matters, and training takes the hall
explicitly — the player pressed TRAIN on a specific card.

The curve lines up exactly with the five ruins:

| Military development | Army cap | Unlocks |
|---|---|---|
| One building, L1 | 6 | Tier I (difficulty 6) |
| Two buildings, one at L2 | 16 | Tier II (14) |
| All four, L1 | 24 | Tier III (24) |
| All four, L2 | 40 | Tier IV (36) |
| All four, L3 | 60 | Tier V (50) |

Three things fall out, which is why the change was worth making:

- **Tiers IV–V become reachable by building, not by waiting.** The deepest ruins
  stop being locked behind a Townhall level and start being locked behind a city
  you chose to build — which is the pitch.
- **Composition costs map space.** Wanting Cavalry means placing Stables, so the
  type chart reaches back into the city-builder rather than living only in a
  party screen. **This is the strongest link between the two halves of the
  game.**
- **Training takes time**, boostable at the relevant hall. Instant training
  stopped making sense once units became expedition capital.

A full roster of Warriors at cap 24 fields 24 effective ATK against a neutral
depth and 18 against an unfavourable one — so **Tier III is exactly clearable
with the right composition and not with the wrong one.**

## 7. Rewards and throughput

- **The haul accumulates per depth** and banks only on extraction.
- **First clear of the max depth** pays the ruin's **relic, guaranteed** — no
  randomness on the thing that gates a system — plus **10 Gems** and a **150
  Stardust** lump, both banked immediately rather than on extraction. A party
  parked at the bottom has already earned them.
- **A cleared ruin then drips 2 Stardust/h, forever.** Discovery pays nothing;
  **clearing is what turns a dungeon into a faucet.**
- **Repeat delves** pay ingredients, Stardust and resources, scaling with depth
  reached: 25 Gold, 4 material and 6 Stardust per depth per tier.
- **Hero XP** on every delve — currently written and never read
  ([`10-heroes.md`](10-heroes.md) §9).

**Throughput is the throttle.** No cooldowns. Concurrency is limited by heroes
(one per delve), party slots, and units (committed until the party extracts). One
hero means one delve at a time, **which makes the second hero a genuine prize.**

## 8. Landmarks, and the four that cannot be claimed

Claiming comes in two flavours, which is what keeps them from being a formality:

- **Undefended** — pay a one-off Gold cost, authored per sanctuary in tiers
  ([`01-map-and-fog.md`](01-map-and-fog.md) §6). A pure economic decision, and
  another sink on the fog's own curve.
- **Defended** — an enemy army holds it. Clear it, then claim. This gives combat
  a second job outside dungeons, and it is a **one-off encounter, not a permanent
  commitment**: the army is never locked up holding ground.

A contested landmark resolves through the same scoring pass a delve depth uses,
so it costs no new machinery — one threat profile per landmark.

**Four of the ten are defended and none of them can be claimed today**, because
nothing writes the cleared flag. The design for clearing them is a siege that
scales from one player to ten: [`15-social.md`](15-social.md) §6. **OQ-35.**

## 9. The screens

- **Expedition sheet** (from a discovered ruin): hero, party slots, the relic
  slot, supply cost, the **guaranteed-depth** read (*safe to depth 4*), the
  matchup read against the ruin's affinity, standing orders, one big green
  Launch.
- **Checkpoint**: party HP, haul so far, what is known about the next depth, and
  two choices of **equal visual weight** — *go deeper* and *take the haul*. It
  must read as an offer, never a threat, and must make plain that the haul is not
  banked yet.
- **A delve pill**, so a parked party is visible without a screen. The
  *checkpoint never expires* rule needs it.
- **The army has no nav tab.** An army only matters at the moment it is sent
  somewhere, so composition is set inside the expedition sheet and the standing
  screen does not exist.

## 10. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| **Failed-push haul loss** | **50%** — the number that most needs playtest | `delve.fail_haul_loss` |
| Type advantage / disadvantage | ×1.5 / ×0.75 | `army.type_advantage`, `…_disadvantage` |
| Per-tier depth curve, supplies, affinity | §2 | the map editor |
| Damage per strength, absorbed per defence | 0.9 / 0.5 | `army.damage_*` |
| Threat floor fraction | 0.4 | `army.threat_floor_fraction` |
| Haul per depth per tier | 25 G · 4 material · 6 Stardust · 1 piece | `delve.*` |
| First clear | 10 Gems + 150 Stardust | `delve.first_clear_*` |
| Party slots | 2 → 5, `25 × 2.2^n` Gems | `party.*` |
| Army cap per hall level | 6 / 10 / 15 | `Districts.army_cap_per_level` |
| Unit stats and train time | §4 | `Units` sheet |

## 11. Deliberately not in this design

Tactical or round-based combat · a battle screen · unit casualties · healing
timers · permanent garrisons · per-depth supply costs · a decision timer on a
checkpoint · PvP · an army cap that comes from the Townhall level.

**Open questions:** OQ-35 (how a defended landmark is cleared), OQ-40 (the 50%),
OQ-41.
