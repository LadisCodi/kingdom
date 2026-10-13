# 11a · Dungeons and fights — the screens

> **Scope.** The screens of a world dungeon, and the two screens every fight
> in the game uses: the battle screen that composes the party, and the
> playback. Systems: [`11-expeditions.md`](11-expeditions.md) and
> [`19-world-map.md`](19-world-map.md) §8. The fight itself:
> [`combat.md`](combat.md).
>
> **Status: built.**

## 1. Flow

```
World map ──▶ dungeon hex ──▶ the dungeon's card ──▶ Delve ──▶ the delve
                                                                 │
                     no army there: Send ──▶ battle screen ──▶ march
                     army camped:   Attack ──▶ playback ──▶ spoils on the descent
                                                              │
                                                  Fight next / Fight again / Back
```

A lair ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md)) and every
army sent onto the world board go through the same battle screen (§2.5) and
the same playback (§2.7).

## 2. Screens

### 2.1 Map marker

- A dungeon's hex carries a **ring filled as far as the player has gone**,
  *13/24*.
- A **red badge** while the player's army is camped there.
- Its progress label shows once the camera is close enough
  ([`19-world-map.md`](19-world-map.md) §1.2).
- A tap opens the dungeon's card.

### 2.2 The dungeon's card

| | |
|---|---|
| Title | The dungeon's name |
| Head | Its entrance, *Held by {creature}. Three depths of 8 rooms.*, how far it is, and **Delve** |
| Progress | *Depth n/3* and *Room n/8* — or *Cleared, to the bottom* |
| The race | *First to beat {boss} closes it for everyone, and is paid his chest ×2*; then every kingdom in it as the world ranking's rows, each with its rooms cleared (*13/24*), furthest first, opened on the player's own. Empty: *Nobody has cleared a room yet.* |

### 2.3 The delve

The full-height menu where rooms are fought: the descent, the depth tabs,
the army docked at the foot and the spoils after a fight —
[`19-world-map.md`](19-world-map.md) §8.2. The Portal's descent is built the
same way (§10.3a there).

### 2.4 The army sheet

Sending an army onto the world board is the battle screen (§2.5) with:

- **The title**: where it goes — *Ground nobody holds*, *A dungeon*, *The
  Dark Portal*, a camp's name, *Your Fortress*, or the holder's ground.
- **The enemy**: a camp's squads, which are seeded by its hex and shown
  before the fight; nothing for a dungeon, the Portal or a rival.
- **The widgets** under the boards: a camp's **LOOT**, and the **TERRAIN** —
  the ground, the hexes and the march there, and each ground rule that applies
  ([`19-world-map.md`](19-world-map.md) §4.2). Below ground (a dungeon, the
  Portal) there is no terrain.
- **The price**: Mana only on an attack on a rival; a camp, a room and a
  floor are paid when fought.
- **The button**: *Attack*, *Claim*, *Garrison*, *Delve*, *Descend* or
  *March* (to a camp). It needs a hero in the party.

### 2.5 The battle screen

One screen serves every fight that is composed: a lair's attack and every
army sent onto the world board. The caller hands it a descriptor; what
differs between two fights is the title, the enemy, the widgets and the
button.

| | |
|---|---|
| Data | The fight's title, the enemy's squads, villains and power, the party's slots and attack, the price, the soldiers the fight will cost, and the caller's widgets |
| Elements, top to bottom | The **enemy's board** (cold) and **your board** (warm), each with its power; the **roster**; the widgets; the **action box** — the price over the primary button, *Quick deploy* beside it, the expected losses under it |
| Height | The sheet takes the **whole frame**. The spare height goes to the two boards, so the button never moves as the party changes |
| States | Party over power · party under power (your board warns, the button still goes) · blocked (the button says why: no Mana, no hero, a hero who cannot fight…) |
| Rules | A power shortfall **warns, never blocks**. The enemy's squads are what the fight is scored against. **No prose that restates the screen's own numbers**: the two boards and their power are the comparison. No rows: a squad's place in the fight is its type's ([`combat.md`](combat.md) §8) |

### 2.6 Party composition — slots and the roster

Two rows of slots on the battle screen, filled from the roster under them.

| | |
|---|---|
| Data | Troop slots and hero slots — open, filled or **locked**; the roster; the party's attack, live |
| Flow | Tap a troop tile → **the next free troop slot fills**. Tap a hero slot → the hero picker. *Quick deploy* (on a lair) fills the board: the highest-level heroes that can fight, then squad after squad, the best answer to the lair first |
| Fill rule | A tile sends **as much as it legally can**: a whole squad (`squadSize`), or everything left of that type, or everything the army cap still allows |
| Clearing | A tap on a filled troop slot sends that squad home |
| Locked slots | **Hero slots only** — a padlock, and the Gem price on the one a purchase would open. Every troop slot is open from the first fight |
| Roster | One tile per troop type: rank I always, a higher rank once the kingdom has any; its bust, how many are at home, its name. A tile that can send nothing says why when tapped |

### 2.7 The fight — the playback

Its own full-screen mount at z 90, under the reveal (100) and over the nav
(10): nothing behind it can be tapped.

**The fight is already over when this opens.** The resolver ran on the tap,
the rewards are banked and the fallen are off the roster — this replays the
event stream ([`combat.md`](combat.md) §13) at the tick it was written in. An
interrupted replay changes nothing.

| | |
|---|---|
| Data | The log, and nothing else: the two boards from its `start`, then every `attack`, `troops_lost` and `slot_wiped` in order |
| Elements | **The power bar** at the top — two totals and one split fill, falling as squads come apart (§12). **Six rows of slots**: their heroes · their back · their front · *a gap* · our front · our back · our heroes. The back rank draws smaller, because the row is what decides who gets hit. **Each slot's ring is its health** — leaf for ours, clay for theirs — emptying round the dial; what a blow just took stays pale for a beat |
| Ground | The board stands on the ground of its kind of fight, seen from above and quiet in the middle: the **field** for a lair or a camp, a **dungeon** room, a depth's **boss** hall, the **Portal**'s depths ([`../art/battle/README.md`](../art/battle/README.md)) |
| Opening | The replay holds **0.8 s** while each side's rows slide in from its own edge, front rank first, the crossed swords on the bar clash and the place's plaque swings down on its rope, the knobs after it |
| Swing | The attacker moves first, timed so the blow lands **on the tick the log wrote**. Melee lunges at its target (Cavalry further, raising dust); a shooter draws back and looses — an arrow per troop line (up to three), a bolt for a hero — and it lands on the tick |
| Hit | The target flashes, flinches away from the blow and a hit sound plays. A blade's mark crosses it — a slash, a straight thrust for Lancers — with sparks; an arrow throws sparks only. The weight of all of it scales with the share of the slot's health the blow took |
| Numbers | Each blow's damage rises off the target. **Blows on one slot within ¼ s add up into one number that grows**; never more than six in the air. Advantage on the type chart = larger, amber; disadvantage = smaller, dull; a heal = leaf `+N`; what a shield soaked = sky `(N)` |
| Skills | A timed skill **charges** 0.32 s before it lands: its caster glows in the skill's tint and a **ribbon** of dyed cloth unrolls across the line between the armies with the skill's name — one at a time, the newest replacing it. Then it is cast to land on its tick: **Volley** rains arrows on every target · **Cleave** and **Crush** lunge at the targets, Crush with a ring of air, a shaken board and a hold · **Ambush** crosses the board to the target and back · **Sharpshot** is a line of light · **Mend**, **Wave**, **Shield**, **Daze** throw a bolt of their tint (Wave also a ring from its caster); a heal raises lights off its target. **Rallies** are named one by one after the armies march on, and every slot of their side flares in the rally's colour |
| Shield | A bubble round the slot **for as long as the shield lasts**; it wobbles when it soaks a blow and shatters when it is spent |
| Daze | The slot dims and three stars circle over it for the daze's length |
| Weight | A heavy blow with the advantage (≥ 8% of the slot) and a squad going down **hold the replay** for a beat (70 · 110 ms), never two within half a second of the fight |
| Death | The slot shakes, its ring **cracks** — grooves run in from the rim — and bursts into chips (wood; gold for a hero), the portrait desaturates and a skull is **stamped** on it with a thud; a hero's portrait slumps in its broken ring. A death sound plays. The troop count pops red on every loss, and a helmet or two tumbles off the ring |
| Power bar | Its two numbers **roll down** to what is left; a loss worth ≥ 4% of a side's opening power jolts the bar and pops that side's number |
| Sound | Its own tune under the fight, giving way at the plaque. Every blow sounds by who struck it (sword · lance · hooves-and-armour · arrow), an archer's release and a cavalry line's gallop before it; a ring cracking, its skull landing, a hero falling; a skill's charge, its ribbon and its own sound; each rally its call; the slow last blow; a fanfare for *Victory*, a lament for *Defeat*. Frequent sounds are voice-limited so a dozen blows a second never become a roar. The sound map is [`audio-wishlist.md`](../audio-wishlist.md) |
| Haptics | Where the device vibrates: a short buzz on a heavy blow, a longer one on a wipe, a pattern on the verdict; never two within 120 ms, and none under reduced motion |
| Reduced motion | No opening, swings, flinches, effects, holds, slow motion or flash; the plaque and the skull appear without moving. The ring, the numbers and the cracks stay |
| Ending | A fight won by a wipe plays its **last 0.3 s at 0.3×** and ends on a white flash. **0.6 s** later the plaque lands over the middle of the board: *Victory* drops in and bounces in a burst of gold; *Defeat* lands heavy and askew, cracked, and the field goes grey under it |
| Rewards | On a victory with spoils, the **reveal** deals them over the board one at a time, from the war chest ([`10-heroes.md`](10-heroes.md) §8.3) |
| Leaving | Then, and only then, **Leave the field** at the bottom. It returns to what the fight was called from (§2.8) |
| Rules | Two controls under the bar: **speed** — ×1, ×2, ×4 in turn, kept for the next fight — and **Skip** (straight to the result). At ×1 one tick is 100 ms, so the replay is as long as the fight was |

### 2.8 After the fight

There is no separate result screen. The playback closes onto what the fight
was called from:

- **a dungeon room or a Portal floor**: the delve or the descent, with the
  spoils over it — what the room paid and the soldiers it cost — and **Fight
  next** (or **Fight again** after a defeat) and **Back**
  ([`19-world-map.md`](19-world-map.md) §8.2);
- **a lair**: the lair's card, its path a step on — or *Claim* once its
  last fight is won ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md));
- **a camp**: the board, the army marching home.

## 3. Dials, in the order to reach for them

| Dial | Key |
|---|---|
| Hero slots, and the Gem price of the next one | `party.heroSlots`, `party.heroSlotGemCostBase`, `.heroSlotGemCostGrowth` |
| Troop slots (6) | `party.troopSlots` |
| Replay pace at ×1 (100 ms a tick) | `combat.tickMs` |

## 4. Deliberately not in this design

- A screen per dungeon, per depth or per room: the delve is the one screen.
- A preview of a room's enemy before it is fought; only the boss shows his
  face.
- A separate result screen (§2.8).
- A control for how far to go: one room, one fight, resolved on the tap.
- A troop slot that is locked or sold.
- Choosing a squad's row.
