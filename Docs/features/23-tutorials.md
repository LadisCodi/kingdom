# 23 · Tutorials — the First Morning, the introductions and the help

> **Scope.** How the game teaches: the one scripted stretch at the start (the
> **First Morning**), the **introduction** every other system gets the first
> time it opens, the **help** that comes when the player is stuck, and the
> **input lock**. What opens when is [`22-progression.md`](22-progression.md);
> how a line is drawn is [`24-dialogue.md`](24-dialogue.md); the quests the
> beats follow are [`12-quests.md`](12-quests.md) §2.
>
> **Status: built 2026-10-01** on `feat/ftue`. Every line below is
> data in `?dev=data` › Progression › **Scenes**.

## 1. The rules

1. **The quest chain teaches; the advisor speaks.** A beat never asks for
   anything the active quest does not.
2. **Scripted stretches**: the First Morning, quests 1–7, about ten
   minutes, and short **lessons** (§3.1) — the Farm and the Sawmill, the
   first buildings that work for the player, and Stone, when the Barracks
   first asks for it. They are the only places
   input is locked.
3. **Every other system is introduced once**, the first time its door opens,
   by a short scene the player taps through.
4. **Help is asked for, or earned by being stuck.** After the First Morning
   nothing points unprompted.
5. **A scene plays once per kingdom**, and the save remembers it.
6. **A scene waits its turn.** It never starts over the battle playback, the
   gacha reveal, the rewarded video or a sheet the player opened — unless the
   sheet is what the scene is about. Scenes due at once queue in authored
   order, and an introduction waits a breath (20 s) after the last scene.
7. **A scene is never skipped, only tapped through**: a tap anywhere moves
   a line on ([`24-dialogue.md`](24-dialogue.md) §2).

## 2. Three kinds of guidance

| Kind | Blocks | Moves on | Used for |
|---|---|---|---|
| **Beat** | everything but its target | when its condition is met | the First Morning |
| **Introduction** | everything, until tapped through | a tap per line | a door opening, a first event |
| **Hint** | nothing | the player acts, or it times out | the quest pill, idle help |

## 3. The First Morning

Played on the real kingdom, from the first frame after the payer profile. The
camera starts on the Townhall. **Isolde**, the Royal Advisor, speaks from the
left unless a line says otherwise.

**Isolde tells the kingdom's story, not the interface's**: she says what the
kingdom lacks — a roof, food, people — and asks the player to put it right,
praises each thing put right, and wears the face that goes with it
([`24-dialogue.md`](24-dialogue.md) §6).

| # | Quest | Isolde says | Points at | Lock | Moves on |
|---|---|---|---|---|---|
| 0.1 | — | *Your Majesty! Welcome home to Oakville — or to what the fog has left of it.* | — | all | tap |
| 0.2 | — | *I am Isolde, your Royal Advisor. I keep the maps, the ledgers and, on good days, the peace.* | — | all | tap |
| 0.3 | — | *The fog swallowed everything past the Townhall — our forests, our fields, our people's work. We must win it back.* | — | all | tap |
| 1.1 | `FirstSteps` | *Those trees in the dark are ours to reclaim. Tap that patch: five taps clear a cell, and each costs a pinch of Gold.* | the nearest fogged forest | that cell | the cell is revealed |
| 1.2 | `FirstSteps` | *Timber! The forest remembers us. Three more stands, and our axes will have work again.* | the next fogged forest | the map | the quest completes |
| 1.3 | `FirstSteps` | *Splendid work, Your Majesty! The scroll has a reward for you — tap it.* | the quest pill | the pill | claimed |
| 2.1 | `Woodcraft` | *Trees at last — and no one left who remembers how to fell them. The Book of Civics will remind us.* | **Research** (its padlock breaks) | the tab | the book is open |
| 2.2 | `Woodcraft` | *Every card in the book is something our people can learn. This one is Forestry.* | the Forestry card | the card | its sheet is open |
| 2.3 | `Woodcraft` | *Learning runs on Knowledge. Pour ours in…* | **+N** | the button | the Knowledge is in |
| 2.4 | `Woodcraft` | *…then pay the Gold, and the craft is ours at once.* | **Research** | the button | Forestry is done |
| 2.5 | `Woodcraft` | *Listen — axes in the woods already! Knowledge comes back by itself, a point an hour, up to ten. Spend it before the bar fills.* | the Knowledge tab | all | tap |
| 2.6 | `Woodcraft` | *Close the book. Let's put that craft to work.* | the close knob | the knob | the book is shut |
| 3.1 | `Timber` | *Show them how it's done: tap a tree. Every tap on the ground spends one Mana — the blue gauge up top.* | the nearest forest | the map | three taps |
| 3.2 | `Timber` | *Hold your finger down and the axe keeps swinging. When a stand is felled, move on — it grows back.* | the nearest forest with wood left | none | the quest completes |
| 3.3 | `Timber` | *Every tree you felled drew a drop of Mana from the blue gauge. Don't fret — the well fills again on its own, hour by hour.* | the Mana gauge | everything | a tap |
| 3.4 | `Timber` | *Wood for the kingdom! Claim it — the scroll pours some Mana back, though the well would refill in time anyway.* | the quest pill | the pill | claimed |
| 4.1 | `ARoof` | *Wood, at last — and not one roof to sleep under. No one will settle here like this. Let's build a House.* | **Build** (its padlock breaks) | the tab | the build menu is open |
| 4.2 | `ARoof` | *Buildings are paid for up front. Pick the House.* | the Housing card | the card | placing |
| 4.3 | `ARoof` | *Anywhere on cleared ground. Drag it where you like, then confirm.* | the confirm button | the map and the panel | placed |
| 4.4 | `ARoof` | *Hear that? Hammers! A builder is on it, and buildings keep rising while you are away.* | the construction | all | tap |
| 4.5 | `ARoof` | *Our first roof! The scroll has a reward waiting — tap it.* | the quest pill | the pill | claimed |
| 5.1 | `Rations` | *A roof is a start, but villagers eat. We must find them food — berry bushes would do. Clear the fog off one, then tap it.* | the nearest berries, fogged or not | none | the quest completes |
| 5.2 | `Rations` | *Berries enough to feed a household! Tap the scroll.* | the quest pill | the pill | claimed |
| 6.0 | `FirstVillager` | *The House is still going up. No family moves in under scaffolding.* (skipped if it stands) | the House | none | the House is finished |
| 6.1 | `FirstVillager` | *A roof and a pantry — now we need people. The Townhall trains villagers. Open it.* | the Townhall | the Townhall | its card is open |
| 6.2 | `FirstVillager` | *Train one. They'll need that roof — and a moment to arrive.* | **Train** | none | a villager arrives |
| 6.3 | `FirstVillager` | **Villager** (right): *A roof, a hearth and a monarch! I'll pay my rent on time, Your Majesty.* | — | all | tap |
| 6.3b | `FirstVillager` | *Close the Townhall — the scroll is waiting behind it.* (skipped if it is closed) | the card's close knob | the knob | the scroll is on screen |
| 6.4 | `FirstVillager` | *Oakville has its first citizen! You've earned this — tap the scroll.* | the quest pill | the pill | claimed |
| 7.1 | `TaxDay` | *Our villager pays rent into the House's store. When the bubble shows, tap it — collecting never costs a thing.* | the House | none | the quest completes |
| 7.1b | `TaxDay` | *Gold in the coffers! Tap the scroll.* | the quest pill | the pill | claimed |
| 7.2 | `TaxDay` | *That is how a kingdom is kept, Your Majesty: clear the fog, gather, build, grow. The scroll will always hold the next task.* | the quest pill | all | tap |
| 7.3 | `TaxDay` | *Lost? Tap the scroll and I'll point the way. And come back tomorrow — I'll have a gift for you.* | the quest pill | all | tap — **the First Morning ends** |

- **A beat checks its condition when it starts**, so a beat already met is
  skipped.
- **The Townhall's own Gold stays quiet through the First Morning**: no
  bubble, and a tap opens it rather than collecting. Its Gold piles up and
  shows once `TaxDay` is claimed.
- **A scene resumes where the kingdom is**: after a reload it picks up after
  the last line whose PROGRESS condition already holds (a quest, a research,
  a building) — never on a moment like a sheet being shut.
- **A lock releases itself** if its target is missing for five seconds; the
  beat then shows as a hint. Nothing can strand the player.
- The camera glides (0.2 s) to a map target before the beat's line appears, again
  when the target moves on (a cleared forest, the next one pointed at), and
  again when it has been out of sight — panned away, or under the box — for
  1.5 s with the player's hands off the screen.
- A control scrolled out of its row (the fourth card of the build menu) is
  brought into view, so a lock never holds the player in front of something
  out of reach.

### 3.1 The lessons: buildings that work for you

Beats, as the First Morning's, each on its quest.

| Scene | Quest | Isolde says | Points at | Lock | Moves on |
|---|---|---|---|---|---|
| `farm` | `Farmhand` | *Reaping every plot by hand will wear us thin — and each tap costs Mana. A Farm sends villagers to do it for you, day and night.* | the crop plots | all | tap |
| | | *Let's build one.* | **Build** | the tab | the build menu is open |
| | | *Pick the Farm.* | the Farm card | the card | placing |
| | | *A Farm reaches one step round itself, corners too. Set it beside the plots — each one in reach shows what it holds — then Build.* | the crop plots | the map and the panel | placed |
| | | *A Farm for Oakville! The scroll counts it already — claim it.* | the quest pill | the pill | claimed |
| `workers` | `ToWork` | *The Farm is still going up. When it stands, it will need hands.* (skipped if it stands) | the Farm | none | the Farm is finished |
| | | *The Farm stands — and nobody works it. Tap it.* | the Farm | the Farm | its card is open |
| | | *Send a villager. They walk to a plot in reach, reap it and carry the crop home — more hands, more trips.* | the card's **+** | none | the quest completes |
| | | *Look at them go! The harvest waits in the Farm's store: tap the Farm when its bubble shows. A full store stops the work.* | the Farm | all | tap |
| `saws` | `SawTeeth` | *The Farm reaps on its own. Why not the forest too? The Book of Civics knows how.* | **Research** | the tab | the book is open |
| | | *Saws. It teaches us to build a Sawmill.* | the Saws card | the card | its sheet is open |
| | | *Pour in its Knowledge…* · *…and research it.* | **+N** · **Research** | the button | filled · done |
| | | *Close the book, and let's build it.* | the close knob | the knob | the book is shut |
| `sawmill` | `TheSawmill` | *A Sawmill sends woodcutters into the trees around it — Wood without a single tap from you.* | **Build** | the tab | the build menu is open |
| | | *Pick the Sawmill.* | the Sawmill card | the card | placing |
| | | *Like the Farm, it works only what is in its reach. Set it where the most trees stand inside the outline, then Build.* | the confirm button | the map and the panel | placed |
| | | *Another builder at work! The scroll counts it already — claim it.* | the quest pill | the pill | claimed |
| `sawmillCrew` | `Crewed` | *The Sawmill is still going up. When it stands, it will need hands.* (skipped if it stands) | the Sawmill | none | the Sawmill is finished |
| | | *The Sawmill stands idle — saws, and no one to swing them. Tap it.* | the Sawmill | the Sawmill | its card is open |
| | | *Send it woodcutters. The scroll wants three villagers at work, the Farm's included.* | the card's **+** | none | the quest completes |
| | | *Food and Wood now come in on their own, even while you are away. You have the makings of a real town, Your Majesty.* | the Sawmill | all | tap |

| `picks` | `Picks` | *The orcs won't wait, and a Barracks is built of stone — which our people cannot cut. The Book of Civics can teach them.* | **Research** | the tab | the book is open |
| | | *Pickaxes. It opens the mountains to us.* | the Pickaxes card | the card | its sheet is open |
| | | *Pour in its Knowledge…* · *…and research it.* | **+N** · **Research** | the button | filled · done |
| | | *Close the book, and let's find some rock.* | the close knob | the knob | the book is shut |
| `rubble` | `Rubble` | *Tap a mountain. Every swing of the pick brings home Stone — and spends a Mana, like the axe. Clear the fog off one if you must.* | the nearest mountain, fogged or not | none | the quest completes |
| | | *Stone enough for walls! Tap the scroll.* | the quest pill | the pill | claimed |

- **A worker building's ghost starts where it would work the most** — the
  Farm beside the plots, the Sawmill in the thickest trees — the nearest of
  those to the Townhall.

## 4. The introductions

Each plays once, the first time its trigger is true. Lines are tapped through.
A scene that points at something does so after its
last line, as a hint.

### 4.1 The village

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `fullHouse` | quest `GrowingTown` reached | Isolde | *That House is full — two to a roof, and no room for anyone else. Build another, and the town can grow.* | the House |
| `townhall2` | quest `ProperCapital` reached | Isolde | *A grander Townhall, Your Majesty! We can clear fog further out now — the dotted line is how far — and the city can hold more.* | the Townhall |
| `builders` | the builder offer opens — a build refused because every builder is busy | Isolde | *Every builder is busy. Wait for one to finish — or hire another hand, and two things rise at once.* | — |
| `manaEmpty` | the Mana pool reaches 0, for the first time | Isolde | *We're out of Mana, Your Majesty. It refills on its own, about a pool a night — or a word from our patrons refills it now.* | the Mana gauge |
| `eras` | 30 cells revealed | Isolde | *You've seen more of the land than any monarch in years — and the books have noticed. Chapter II is open!* | Research |

### 4.2 The Orcs

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `orcs` | the Orcs are discovered | **Grukk** (right), Isolde, **the Warden** (right) | **Grukk:** *Grrr. Your town smells of bread and gold. We come for both.* · **Isolde:** *Orcs! While their camp stands they'll raid our stores — and nothing near it can be worked.* · **Warden:** *Warden of the Guard, Your Majesty. Give me soldiers and I'll drive them out.* · **Isolde:** *The Book of Warfare is open to us now. We'll need soldiers — start with the Barracks.* | the raid widget |
| `raid` | the first raid lands | Isolde | *They've robbed our stores! Never the treasury, at least. Collect often and they find less — clear the camp to win it all back.* | the lair |
| `battle` | the first attack sheet opens | the Warden | *Pick who goes in: me in a hero slot, soldiers in the others. The numbers tell you how it'll go before we march.* | the attack button |
| `victory` | the first lair is cleared | the Warden, Isolde | **Warden:** *They're scattered! And look what they left behind.* · **Isolde:** *Oakville is safe! Claim the camp — whatever they took comes back, and the ground is ours again.* | the lair |
| `relics` | Relics opens | Isolde | *Cards! Collect a page of them and the kingdom earns a relic — a gift that keeps growing every season.* | Relics |

### 4.3 Magic, heroes, the world

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `magic` | the first landmark is claimed | Isolde | *Feel that? Old stones still hum with power — our Mana pool is deeper already. The Book of Magic is open.* | Research |
| `tavern` | the first Tavern is finished | **Bess** (right), Isolde | **Bess:** *Doors open, fire lit, soup on! Heroes will come from every road for a bowl of this.* · **Bess:** *And me? I'm not bad with a ladle in a scrap, either.* · **Isolde:** *The Tavern hosts the banner — your first call is on the house. And a new book: the Sagas.* | Heroes |
| `watchtowerSeen` | the Watchtower is discovered | Isolde | *An old watchtower, north. From its top you could see past the mountains — to whoever else is out there.* | the Watchtower |
| `world` | the Watchtower is claimed | Isolde | *Other kingdoms, Your Majesty. Other banners. The roads out are being scouted — and the Atlas will help us read them.* | the world knob |

### 4.4 What the fog gives up

| Scene | Trigger | Says (Isolde) |
|---|---|---|
| `shrineSeen` | the Thorned Shrine is out of the dark | *Old stones, still standing — a shrine. Claimed, it deepens our Mana for good. Though not while the Orcs squat beside it.* |
| `huntSeen` | the first wild game | *Game in the woods. A tap brings home three times what a berry bush does — once Hunting teaches us how.* |
| `ironSeen` | the first iron mountain | *Iron in that rock. The Quarry cannot cut it until we learn Mining — and then it pays five times a bare peak.* |
| `goldSeen` | the first gold mountain | *Gold in the mountain! Deep Mining, one day, and the Quarry will dig coin out of it.* |
| `fishSeen` | the first shoal | *Fish in the shallows. The Docks will net them, once we have learned to build on the water.* |
| `harpies` | the Harpies are discovered | *Harpies — anything that shines is theirs by morning. They are archers on the wing: send riders, if we have them.* |

Each points at what it is about.

### 4.5 Later systems

| Scene | Trigger | Says (Isolde) |
|---|---|---|
| `wounded` | the first soldier comes home wounded | *Our soldiers came home wounded — but not lost. The Infirmary patches them up for a fraction of a new recruit.* |
| `workshops` | the first workshop is finished | *A workshop! It turns raw goods into refined ones — and our grandest buildings will ask for them.* |
| `harmony` | the first decoration is unlocked | *A beautiful city is a willing one. Decorations lend Harmony, and our grandest buildings ask for it.* |
| `daily` | the daily chest opens — the day after the kingdom's first | *Welcome back, Your Majesty! One gift for every day you visit — the chest is yours. Miss a day and the next gift simply waits.* |

## 5. Help when stuck

- **The quest pill is the help button.** A tap on an unfinished quest flies to
  its target and points at it — the existing hint — and the pointer stays
  until the player taps the target or twenty seconds pass.
- **Idle help**, while the chain is in the opening (up to `Attuned`):

| Idle for | What happens |
|---|---|
| 30 s | the quest pill wiggles |
| 60 s | Isolde leans in from the left edge: *Need a hand?* — a tap shows the hint |
| after | she hides after ten seconds, and does not return for three minutes |

- Idle means no command and no open sheet while the active quest is
  unfinished. Panning the map is not a command.
- Past `Attuned` the pill still wiggles; Isolde stays away.
- **A refusal explains itself.** A tap on a padlock says what opens it; a
  refused build, research or tap says why, as it does today.

## 6. The input lock

| Lock | Taps reach |
|---|---|
| `none` | everything |
| `target` | the beat's target only — the map cell, or the one control |
| `map` | the map, the placement panel and the beat's target — nothing in the menus |
| `all` | nothing but the dialogue |

- **Panning and zooming the map are never locked.**
- `target` and `all` draw a scrim — `target` with a cut-out round the
  target — and the pointer bobs at the target.
- The lock is one gate on the map (`Game.tapGate`, asked by every tap, hold
  and ghost drag) and one capture filter on the frame for everything else.
- **A lock never outlives its beat**, and releases itself after five
  seconds with no target (§3).

## 7. What the save keeps

- The scenes played, by id. The beat of the First Morning is not saved: it
  is derived from the quests on load (§3).
- A save from before this design is read as having played every scene.

## 8. Dials, in the order to reach for them

| Dial | Value | Where |
|---|---|---|
| Every line, speaker, side and box position | §3–§4 | `?dev=data` › Scenes |
| Which scene plays on which trigger, and in what order | §3–§4 | `?dev=data` › Scenes |
| Idle wiggle · idle advisor · her rest · how long she waits | 30 s · 60 s · 3 min · 10 s | `?dev=data` › Tutorial help (`help.*`) |
| How long a pointer (and the quest hint) waits | 20 s | `help.pointerSeconds` |
| How fast a line types | 40 characters a second | `help.typeCharsPerSecond` |
| When idle help stops | quest `Attuned` | `help.untilQuest` |
| The lock's failsafe | 5 s | `help.lockFailsafeSeconds` |
| The breath between two introductions | 20 s | `help.sceneGapSeconds` |

## 9. Deliberately not in this design

- A skippable First Morning, or a skip for the whole tutorial.
- A tutorial on a separate map, a sandbox, or a replay of the opening.
- Rewards for watching a scene.
- Choices in dialogue, or branching scenes.
- A pointer that appears without being asked after the First Morning.
- Voice, and an animated portrait beyond entering, leaving and dimming.
- A scene over the battle playback, the reveal or the rewarded video.
- Re-playing a scene from the settings.

**Open questions:** **OQ-117**.
