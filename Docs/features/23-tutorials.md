# 23 · Tutorials — the First Morning, the introductions and the help

> **Scope.** How the game teaches: the one scripted stretch at the start (the
> **First Morning**), the **introduction** every other system gets the first
> time it opens, the **help** that comes when the player is stuck, and the
> **input lock**. What opens when is [`22-progression.md`](22-progression.md);
> how a line is drawn is [`24-dialogue.md`](24-dialogue.md); the quests the
> beats follow are [`12-quests.md`](12-quests.md) §2.
>
> **Status: built.** Every line below is data in `?dev=data` › Progression ›
> **Scenes**.

## 1. The rules

1. **The quest chain teaches; the advisor speaks.** A beat never asks for
   anything the active quest does not.
2. **Scripted stretches**: the First Morning, quests 1–7, about ten
   minutes, and short **lessons** (§3.1) — the Farm and the Sawmill, the
   first buildings that work for the player, and Stone, when the House's
   second story first asks for it. They are the only places
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
8. **Before pointing at the nav bar, a scene takes the player back to the
   map**: with a sheet, a card or a placement open, Isolde first asks them to
   set it aside and points at its close ([`24-dialogue.md`](24-dialogue.md)
   §4).

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

**She speaks inside the fiction**, in her own voice — cheerful, a little
nervous, a bookworm who got the job because nobody else stayed:

| The game's | Isolde's |
|---|---|
| a quest, its reward, Claim | the townsfolk's request, their gift, accept it |
| Mana | the kingdom's magic, in its well |
| research, a card | a chapter in her books, a craft to learn |
| a building's store | its purse, its barn |

- The words the screen prints — Mana, Knowledge, Gold, the fog — she uses as
  they are, so a line and the HUD name the same thing.

| # | Quest | Isolde says | Points at | Lock | Moves on |
|---|---|---|---|---|---|
| 0.1 | — | *Oh! Your Majesty — you came! Welcome home to Oakville. Well… to what the fog has left of it.* | — | all | tap |
| 0.2 | — | *I'm Isolde. I kept the royal library — but everyone else fled the fog, so… I'm your Royal Advisor now. I'll do my very best!* | — | all | tap |
| 0.3 | — | *The fog swallowed everything past the Townhall — our forests, our fields, our people's work. The books say it can be pushed back. I hope.* | — | all | tap |
| 1.1 | `FirstSteps` | *Those trees in the fog are ours! A few coins and a little patience clear a patch — tap it, Your Majesty. Five times, I've read.* | the nearest fogged forest | that cell | the cell is revealed |
| 1.1b | `FirstSteps` | *Timber! Oh, it worked! And — look, right beside it! Something in the fog. Clear that one too!* | the chest ([`01-map-and-fog.md`](01-map-and-fog.md) §6.2) | that cell | revealed |
| 1.1c | `FirstSteps` | *A purse someone dropped when they fled! Tap it — it's ours now.* | the treasure | that cell | picked up |
| 1.2 | `FirstSteps` | *The fog keeps more of what they left, I'm sure of it. Three more stands, and our axes will have work again.* | the next fogged forest | the map | the quest completes |
| 1.3 | `FirstSteps` | *The townsfolk saw you win the woods back — they've gathered a gift! Go on, accept it. They'd be ever so pleased.* | the quest pill | the pill | claimed |
| 2.1 | `Woodcraft` | *Trees at last — and, um, nobody left who remembers how to fell them. But I have a book for that! I have a book for most things.* | **Research** (its padlock breaks) | the tab | the book is open |
| 2.2 | `Woodcraft` | *Each page is a craft our people can learn. This one's Forestry — chapter one. My favourite!* | the Forestry card | the card | its sheet is open |
| 2.3 | `Woodcraft` | *Learning takes Knowledge, and ours is right here. Pour it in…* | **+N** | the button | the Knowledge is in |
| 2.4 | `Woodcraft` | *…then a little Gold for the tools, and the craft is ours. Just like that!* | **Research** | the button | Forestry is done |
| 2.5 | `Woodcraft` | *Listen — axes in the woods already! And I keep studying: a point of Knowledge an hour, up to ten. Best spend it before then.* | the Knowledge tab | all | tap |
| 2.6 | `Woodcraft` | *Let's close the book and go and watch them work. I'll — I'll mark the page.* | the close knob | the knob | the book is shut |
| 3.1 | `Timber` | *Shall we show them how it's done? Tap a tree. Each swing draws a drop of Mana — the kingdom's magic, in that blue well up there.* | the nearest forest | the map | three taps |
| 3.2 | `Timber` | *Hold your finger down and the axe keeps swinging! When a stand is bare, move on — it grows back. Trees are patient like that.* | the nearest forest with wood left | none | the quest completes |
| 3.3 | `Timber` | *Oh — the well is lower. Every swing drew a drop. Don't fret! It fills itself again, slowly, hour by hour. I checked twice.* | the Mana gauge | everything | a tap |
| 3.4 | `Timber` | *Wood for the kingdom! The woodfolk have sent their thanks — accept it, and the well gets a little of its magic back.* | the quest pill | the pill | claimed |
| 4.1 | `ARoof` | *Wood at last — and not one roof to sleep under. But that shape past the trees… the Millers' house! The fog has it. Clear it, Your Majesty!* | the old House ([`01-map-and-fog.md`](01-map-and-fog.md) §6.3) | that cell | revealed |
| 4.2 | `ARoof` | *There it is! The roof's fallen in, but the walls are sound. Open it.* | the old House | the House | its card is open |
| 4.3 | `ARoof` | *Builders want their wood up front — it says so in the guild charter. Repair it!* | **Repair** | the button | repairing |
| 4.4 | `ARoof` | *Hear that? Hammers! And builders keep at it while you're away — they don't need watching. Unlike me.* | the construction | all | tap |
| 4.5 | `ARoof` | *Our first roof! The townsfolk want to thank you for it — please, accept their gift.* | the quest pill | the pill | claimed |
| 5.1 | `Rations` | *A roof is a start — but people eat, and our pantry is… a shelf. Berry bushes would do. Clear the fog off one, then pick it.* | the nearest berries, fogged or not | none | the quest completes |
| 5.2 | `Rations` | *Berries enough for a whole household! The townsfolk have something for you — do accept it.* | the quest pill | the pill | claimed |
| 6.0 | `FirstVillager` | *The House is still going up. No family moves in under scaffolding — I asked.* (skipped if it stands) | the House | none | the House is finished |
| 6.1 | `FirstVillager` | *A roof, a pantry… now we need people! The Townhall calls settlers in from the roads. Open it, Your Majesty.* | the Townhall | the Townhall | its card is open |
| 6.2 | `FirstVillager` | *Call one! They'll need that roof — and a little Food for the road.* | **Train** | none | a villager is in training |
| 6.2b | `FirstVillager` | *They're on their way! We can wait for them to arrive — or a few Gems would hurry them along. Whichever you think best!* | **Finish** | none | a villager arrives |
| 6.3 | `FirstVillager` | **Villager** (right): *A roof, a hearth and a monarch! I'll pay my rent on time, Your Majesty.* | — | all | tap |
| 6.3b | `FirstVillager` | *Let's close the Townhall — the townsfolk are waiting to thank you.* (skipped if it is closed) | the card's close knob | the knob | the scroll is on screen |
| 6.4 | `FirstVillager` | *Oakville has its first citizen! Oh, this calls for a celebration — they've brought you a gift. Accept it!* | the quest pill | the pill | claimed |
| 7.1 | `TaxDay` | *Our villager pays rent into the House. When the purse shows, gather it — it's theirs to give, and it costs you nothing.* | the House | none | the quest completes |
| 7.1b | `TaxDay` | *Gold in the coffers! And another gift from the townsfolk — they're very generous today.* | the quest pill | the pill | claimed |
| 7.2 | `TaxDay` | *That's how a kingdom is kept, I think: clear the fog, gather, build, grow. The townsfolk will always have their next request.* | the quest pill | all | tap |
| 7.3 | `TaxDay` | *Lost? Look at their request and I'll point the way. Come back tomorrow — the barns and the purse fill up overnight.* | the quest pill | all | tap — **the First Morning ends** |

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
| `farm` | `Farmhand` | *Reaping every plot by hand will wear us out — and drain the well. A Farm sends villagers to do it, day and night.* | the crop plots | all | tap |
| | | *And there was one! The old farm, right beside the fields. Clear its fog and open it, Your Majesty.* | the old Farm, its ruin or its silhouette | none | its card is open |
| | | *A Farm works the plots one step around it, corners too — and this one stands right beside ours. Repair it!* | **Repair** | the button | repairing |
| | | *A Farm for Oakville! The townsfolk are grateful already — accept their gift.* | the quest pill | the pill | claimed |
| `workers` | `ToWork` | *The Farm is still going up. When it stands, it'll need hands.* (skipped if it stands) | the Farm | none | the Farm is finished |
| | | *The Farm stands — and nobody works it. Oh dear. Open it, Your Majesty.* | the Farm | the Farm | its card is open |
| | | *Send a villager! They'll walk to a plot in reach, reap it and carry the crop home. More hands, more trips.* | the card's **+** | none | the quest completes |
| | | *Look at them go! The harvest piles up in the Farm's barn — gather it when it's ready. A full barn stops the work.* | the Farm | all | tap |
| `secondHouse` | `GrowingTown` | *That House is full — two to a roof. And the fog kept no other… so we'll raise one of our own!* | **Build** (its padlock breaks) | the tab | the build menu is open |
| | | *Oh — a new House wants more Wood than we hold. Here, I put some by for just this!* (only while the Wood is short; she makes up the difference) | nothing | all | tap |
| | | *Builders want their wood up front — it says so in the guild charter. Choose the House.* | the Housing card | the card | placing |
| | | *Anywhere on the cleared ground. Drag it wherever feels right, then confirm. I'd pick somewhere sunny.* | the confirm button | the map and the panel | placed |
| | | *Our very own House! The townsfolk want to thank you — please, accept their gift.* | the quest pill | the pill | claimed |
| `sawmill` | `TheSawmill` | *The Farm reaps by itself… so why not the forest? There was a Sawmill among the trees — the old one. Find it, Your Majesty, and open it.* | the old Sawmill, its ruin or its silhouette | none | its card is open |
| | | *Oh — mending it wants more Wood than we hold. Here, I put some by for just this!* (only while the Wood is short; she makes up the difference) | nothing | all | tap |
| | | *A Sawmill sends woodcutters into the trees around it — Wood without a single swing from you. Repair it!* | **Repair** | the button | repairing |
| | | *Another builder at work! The townsfolk have noticed — accept their thanks.* | the quest pill | the pill | claimed |
| `sawmillCrew` | `Crewed` | *The Sawmill is still going up. When it stands, it'll need hands.* (skipped if it stands) | the Sawmill | none | the Sawmill is finished |
| | | *The Sawmill stands idle — saws, and nobody to swing them. Open it.* | the Sawmill | the Sawmill | its card is open |
| | | *Send it woodcutters. The townsfolk hope to see three villagers at work — the Farm's count too.* | the card's **+** | none | the quest completes |
| | | *Food and Wood come in by themselves now, even while you're away. A real town, Your Majesty! I— I'm a little proud.* | the Sawmill | all | tap |
| `picks` | `Picks` | *A second story wants stone, and nobody here knows how to cut it. But I'm sure I know a chapter that can teach them!* | **Research** | the tab | the book is open |
| | | *Pickaxes. It opens the mountains to us.* | the Pickaxes card | the card | its sheet is open |
| | | *Pour in our Knowledge…* · *…and a little Gold for the iron. Done!* | **+N** · **Research** | the button | filled · done |
| | | *Let's close the book and go and find some rock.* | the close knob | the knob | the book is shut |
| `rubble` | `Rubble` | *Tap a mountain — clear its fog first, if need be. Every swing brings home Stone, and draws a drop from the well, like the axe.* | the nearest mountain, fogged or not | none | the quest completes |
| | | *Stone enough for walls! The masons have sent a gift — accept it.* | the quest pill | the pill | claimed |

- **A worker building's ghost starts where it would work the most** — the
  Farm beside the plots, the Sawmill in the thickest trees — the nearest of
  those to the Townhall.
- **The fog's buildings are the opening's buildings.** The House, the plots,
  the Farm and the Sawmill are found and repaired, and no technology is
  researched to have them; the first building the player raises is the
  second House, in the `secondHouse` lesson, where the Build tab's padlock
  breaks.

## 4. The introductions

Each plays once, the first time its trigger is true. Lines are tapped through.
A scene that points at something does so after its
last line, as a hint.

### 4.1 The village

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `townhall2` | the Townhall reaches level 2 (quest `ProperCapital` complete) | Isolde | *A grander Townhall! Its watch reaches further now — the dotted line marks how far we can push the fog — and more can live here.* | the Townhall |
| `survey` | the Survey opens, after `townhall2` | Isolde | *And look — the Royal Survey! Every patch we win back from the fog is written in it, and the crown pays for every page. We've filled a few already!* | the Survey pill |
| `builders` | the builder offer opens — a build refused because every builder is busy | Isolde | *Every builder is busy — I counted. Wait for one to finish, or hire another pair of hands, and two things rise at once.* | — |
| `manaEmpty` | the Mana pool reaches 0, for the first time | Isolde | *The well has run dry, Your Majesty. It fills again by itself, about a pool a night — or our patrons could refill it now.* | the Mana gauge |
| `eras` | 43 cells revealed — Civics chapter II | Isolde | *You've seen more of the land than any monarch in years — and look, the books have noticed! Chapter II is open.* | Research |

### 4.2 The Orcs

**`firstLair` — the Book of Warfare is handed over.** The first lair found,
Orcs or Harpies, plays this before the lair's own scene. Its lines are beats.

| Isolde says | Points at | Lock | Moves on |
|---|---|---|---|
| *Your Majesty — a camp, out past the fog! Whoever they are, they've seen our smoke too. Tap it… carefully.* | the lair | the lair | its card is open |
| *Raiders! See that clock? When it runs out, they rob our stores — and nothing near their camp can be worked while it stands.* | the lair's card | all | tap |
| *Axes won't do. But — wait! I have a book for this. The Book of Warfare. I never dared open it… here, it's yours now.* | — | all | tap — **she gives the book**: it opens, and its splash follows (§4.6) |

- **The Book of Warfare opens on her gift and nothing else** — not on the
  lair. A veteran kingdom has every book open.

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `orcs` | the Orcs are discovered | **Grukk** (right), **the Warden** (right), Isolde | **Grukk:** *Grrr. Your town smells of bread and gold. We come for both.* · **Warden:** *Warden of the Guard, Your Majesty. Give me soldiers and I'll drive them out.* · **Isolde:** *Soldiers it is! The Book of Warfare starts with a Barracks — let's read it together.* | Research |
| `raid` | the first raid lands | Isolde | *They've robbed our stores! Never the treasury, at least. Gather often and they find less — clear the camp to win it all back.* | the lair |
| `battle` | the first attack sheet opens | the Warden | *Pick who goes in: me in a hero slot, soldiers in the others. The numbers tell you how it'll go before we march.* | the attack button |
| `victory` | the first lair is cleared | the Warden, Isolde | **Warden:** *They're scattered! And look what they left behind.* · **Isolde:** *Oakville is safe! Take the camp — whatever they stole comes home, and the ground is ours again.* | the lair |
| `relics` | Relics opens | Isolde | *Cards! Collect a whole page and the kingdom earns a relic — a gift that grows every season. I do love collecting things.* | Relics |

### 4.3 Magic, heroes, the world

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `magic` | the first landmark is claimed | Isolde | *Do you feel that? The old stones hum — the well runs deeper already. And the Book of Magic is open! I've waited years for this.* | Research |
| `tavern` | the first Tavern is finished | **Bess** (right), Isolde | **Bess:** *Doors open, fire lit, soup on! Heroes will come from every road for a bowl of this.* · **Bess:** *And me? I'm not bad with a ladle in a scrap, either.* · **Isolde:** *The Tavern flies the banner — your first call is on the house. And a new book, the Sagas! Heroes, legends… my favourite shelf.* | Heroes |
| `towerSighted` | the Watchtower is sighted (01-map-and-fog.md §4.1) | Isolde | *Do you see that shape on the northern hills? Something tall, past the fog. Clear the way towards it and we'll know. I hope it's friendly.* | the Watchtower |
| `watchtowerSeen` | the Watchtower is discovered | Isolde | *An old watchtower! From its top you could see past the mountains — to whoever else is out there. Oh, I'd love to sketch it.* | the Watchtower |
| `world` | the Watchtower is claimed | Isolde | *Other kingdoms, Your Majesty. Other banners! Our scouts are mapping the roads — and the Atlas will help us read them.* | the world knob |

### 4.4 What the fog gives up

| Scene | Trigger | Says (Isolde) |
|---|---|---|
| `shrineSeen` | the Thorned Shrine is out of the dark | *Old stones, still standing — a shrine! Claimed, it deepens our well for good. Though not while the Orcs squat beside it.* |
| `huntSeen` | the first wild game | *Game in the woods! A tap brings home three times what a bush does — once Hunting teaches us how.* |
| `ironSeen` | the first iron mountain | *Iron in that rock! The Quarry can't cut it until we learn Mining — and then it's worth five bare peaks.* |
| `goldSeen` | the first gold mountain | *Gold in the mountain! With Deep Mining, one day, the Quarry will dig coin right out of it.* |
| `fishSeen` | the first shoal | *Fish in the shallows! The Docks will net them, once we learn to build on the water. I can't swim, so… boats.* |
| `harpies` | the Harpies are discovered | *Harpies, roosting over our mountains! While they stand, not one stone up there is ours. Archers on the wing — riders, I think?* |

Each points at what it is about.

### 4.5 Later systems

| Scene | Trigger | Says (Isolde) |
|---|---|---|
| `wounded` | the first soldier comes home wounded | *Our soldiers came home wounded — but not lost, thank goodness. The Infirmary patches them up for less than a new recruit.* |
| `workshops` | the first workshop is finished | *A workshop! It turns raw goods into fine ones — and our grandest buildings will ask for them.* |
| `harmony` | the first decoration is unlocked | *A beautiful city is a willing one. Decorations lend Harmony — and our grandest buildings ask for it.* |

### 4.6 The unlock splash

A big opening is named full-screen before anyone talks about it.

- **What has one:** the doors Build, Research, Heroes, Relics and the world,
  and the books Warfare, Magic, Sagas and Atlas. Nothing else.
- **What it shows:** a dark veil over the whole game, the thing's icon on a
  slowly turning golden burst, its name, and one paragraph.
- **The way out:** *Tap to continue* appears two seconds after the entrance
  has played; a tap before it does nothing.
- **When:** the moment the door or book opens, once. It waits for a fight,
  the reveal or a video to end. Two that open at once show one after the
  other, in list order — Heroes before the Sagas, the world before the
  Atlas.
- **Then the scene:** an introduction about the same thing waits for the
  splash to be read. A line already on screen hides under it and is there
  again after.
- The icons are drawn in the heroes' flat cartoon
  (`Docs/art/ui/mockups/unlock-splash-prompts.md`).

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
- No lock darkens the screen: the hand and the glow mark the target.
- The lock is one gate on the map (`Game.tapGate`, asked by every tap, hold
  and ghost drag) and one capture filter on the frame for everything else.
- **A lock never outlives its beat**, and releases itself after five
  seconds with no target (§3).

## 7. What the save keeps

- The books a line has handed over (`gift:<book>`).
- The scenes played, by id. The beat of the First Morning is not saved: it
  is derived from the quests on load (§3).
- The doors and the books already announced open, so a splash shows once.
- A save from before this design is read as having played every scene.

## 8. Dials, in the order to reach for them

| Dial | Value | Where |
|---|---|---|
| Every line, speaker, side and box position | §3–§4 | `?dev=data` › Scenes |
| Which scene plays on which trigger, and in what order | §3–§4 | `?dev=data` › Scenes |
| Idle wiggle · idle advisor · her rest · how long she waits | 30 s · 60 s · 3 min · 10 s | `?dev=data` › Tutorial help (`help.*`) |
| How long a pointer (and the quest hint) waits | 20 s | `help.pointerSeconds` |
| How fast a line types | 40 characters a second | `help.typeCharsPerSecond` |
| How long a line that appears on its own takes no input | 0.5 s | `help.inputGraceSeconds` |
| When idle help stops | quest `Attuned` | `help.untilQuest` |
| The lock's failsafe | 5 s | `help.lockFailsafeSeconds` |
| The breath between two introductions | 20 s | `help.sceneGapSeconds` |
| Which openings have a splash, in what order, and what each says and shows | §4.6 | `?dev=data` › Unlock splashes |

## 9. Deliberately not in this design

- A skippable First Morning, or a skip for the whole tutorial.
- A tutorial on a separate map, a sandbox, or a replay of the opening.
- Rewards for watching a scene.
- Choices in dialogue, or branching scenes.
- A pointer that appears without being asked after the First Morning.
- Voice, and an animated portrait beyond entering, leaving and dimming.
- A scene over the battle playback, the reveal or the rewarded video.
- A splash for a building, a building level or a mechanic a technology opens: the tree's card already names it.
- Re-playing a scene from the settings.

**Open questions:** **OQ-117**.
