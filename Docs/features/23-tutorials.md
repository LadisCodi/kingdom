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
   minutes, and short **lessons** (§3.1, §3.2) — the old plots, the Farm
   (repaired, then moved beside them) and the Sawmill, the first buildings
   that work for the player; the first chest, used from the Bag; Stone, when
   the House's second story first asks for it; and the city's growth — the
   first upgrade, more Houses, plots and villagers, a second Sawmill and its
   crew, the first decorations, the Barracks, soldiers, the first assault and
   the first hero. They are the only places input is locked.
3. **Every other system is introduced once**, the first time its door opens,
   by a short scene the player taps through.
4. **Help is asked for, or earned by being stuck.** After the First Morning
   nothing points unprompted.
5. **A scene plays once per kingdom**, and the save remembers it.
6. **A scene waits its turn.** It never starts over the battle playback, the
   gacha reveal, the rewarded video, an unlock splash or a sheet the player
   opened — unless the sheet is what the scene is about. Scenes due at once
   queue in authored order, and an introduction waits a breath (6 s) after
   the last scene. Closing the last sheet ends the breath: back on the map,
   the next scene due starts at once.
7. **A scene plays where it belongs** (`where`): the province, the world
   board, or either. A scene about the city never starts on the world board;
   one that has started pauses, out of sight and locking nothing, while the
   player is elsewhere, and goes on when they are back.
8. **One that cannot start here does not hold the others.** An introduction
   waiting for the player to come back, or to close a card, lets the next
   one due that fits go first. Only the First Morning runs strictly in order.
9. **What the player has already done is not taught** (`doneWhen`). A scene
   due when its `doneWhen` already holds — the ruin already repaired, the
   technology already researched, the hero already called — is marked
   played without playing, and what its lines hand over (a book, the Staff)
   is still handed over.
10. **A scene is never skipped, only tapped through**: a tap anywhere moves
   a line on ([`24-dialogue.md`](24-dialogue.md) §2).
11. **Before pointing at the nav bar, a scene takes the player back to the
   map**: with a sheet, a card or a placement open, Isolde first asks them to
   set it aside and points at its close ([`24-dialogue.md`](24-dialogue.md)
   §4).

## 2. Three kinds of guidance

| Kind | Blocks | Moves on | Used for |
|---|---|---|---|
| **Beat** | everything while read; then everything but its target, with the box gone and the hand on it ([`24-dialogue.md`](24-dialogue.md) §4) | when its condition is met | the First Morning |
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

| The game's | The town's |
|---|---|
| a quest, its reward, Claim | the townsfolk's request, their gift, accept it |
| fog costs Gold | the fog is greedy: it loves a shine, and gives ground back for a coin |
| Mana, a tap costs it | the kingdom's magic, in its well: every swing asks the land's leave |
| research, a card | a craft Oakville forgot, kept in Isolde's books |
| villagers | the people camped on the roads, home once there is a roof and bread |
| a building's store | its purse, its barn |

- The words the screen prints — Mana, Knowledge, Gold, the fog — she uses as
  they are, so a line and the HUD name the same thing.
- **Two more voices.** **Old Hob**, the woodcutter who never left, argues
  with her — she reads why, he knows how — and gives the town's reasons for
  the fog and the well. **Tom Miller**, the first villager home, asks for
  what the people need.
- **Every scripted quest ends on its gift accepted**: the next lesson
  starts on the next quest, so the hand leads the player from
  one to the other. Isolde asks for the first gift (`FirstSteps`); from
  then on the hand alone points at the pill, locked to it, once the quest
  is complete.
- **The hand never points at something paid for with Gems.** A line may
  name a Gem shortcut; following the hand never spends one
  (`tests/tutorialGems.test.ts`).

| # | Quest | Says (Isolde, unless named) | Points at | Lock | Moves on |
|---|---|---|---|---|---|
| 0.1 | — | *Oh! Your Majesty — you came! Welcome home to Oakville. Well… to what the fog has left of it.* | — | all | tap |
| 0.2 | — | *I'm Isolde. I kept the royal library — but most of the court fled the fog, so… I'm your Royal Advisor now!* | — | all | tap |
| 0.2b | — | **Hob:** *Advisor. Ha! Last time she advised anyone, it was the old king. To read more.* | — | all | tap |
| 0.3 | — | *This is Hob, our woodcutter. He's the only one who never left. He says the fog doesn't scare him.* | — | all | tap |
| 0.3b | — | **Hob:** *Scare me? It's greedy, that's all. Loves a shine. Toss it a coin and it gives a bit of ground back.* | — | all | tap |
| 1.1 | `FirstSteps` | *Then let's feed it! Those trees in the fog are ours — tap it, Your Majesty. Five coins, Hob says.* | the nearest fogged forest | that cell | the cell is revealed |
| 1.1b | `FirstSteps` | *Timber! It worked! And look — right beside it. Something glinting in the fog. Clear that one too!* | the chest ([`01-map-and-fog.md`](01-map-and-fog.md) §6.2) | that cell | revealed |
| 1.1c | `FirstSteps` | **Hob:** *That's Widow Pell's purse. Dropped it running, she did. Well — the fog owes us. Tap it.* | the treasure | that cell | picked up |
| 1.2 | `FirstSteps` | *The fog kept more of what they left, I'm sure of it. Three more stands, and the axes will have work again.* | the next fogged forest | the map | the quest completes |
| 1.3 | `FirstSteps` | *The folk sheltering in the Townhall saw it all — they've gathered you a gift! Go on, accept it.* | the quest pill | the pill | claimed |
| 2.0 | `Woodcraft` | **Hob:** *Trees aplenty, and nobody left who knows how to drop one safe. My hands shake too much now.* | — | all | tap |
| 2.1 | `Woodcraft` | *Then a book will teach them! I have a book for that. I have a book for most things.* | **Research** (its padlock breaks) | the tab | the book is open |
| 2.2 | `Woodcraft` | *Each page is a craft Oakville forgot. This one's Forestry — chapter one. My favourite!* | the Forestry card | the card | its sheet is open |
| 2.3 | `Woodcraft` | *Learning takes Knowledge — that's my studying, bottled up. Pour it in…* | **+N** | the button | the Knowledge is in |
| 2.4 | `Woodcraft` | *…then a little Gold for proper axes, and the craft is ours again. Just like that!* | **Research** | the button | Forestry is done |
| 2.5 | `Woodcraft` | *Hear that? Axes in the woods! I study a point of Knowledge an hour, up to ten. Best spend it before then.* | the Knowledge tab | all | tap |
| 2.6 | `Woodcraft` | *Let's close the book and go and watch them work. I'll — I'll mark the page.* | the close knob | the knob | the book is shut |
| 3.1 | `Timber` | **Hob:** *Show 'em how it's done, Majesty. Tap a tree. Every swing asks the land's leave — a drop from that blue well.* | the nearest forest | the map | three taps |
| 3.2 | `Timber` | **Hob:** *Hold it down and the axe keeps going. When a stand's bare, move on — it grows back. Trees don't sulk.* | the nearest forest with wood left | none | the quest completes |
| 3.3 | `Timber` | *Oh — the well is lower! Every swing drew a drop. Don't fret: it fills again by itself. I checked twice.* | the Mana gauge | everything | a tap |
| 3.3b | `Timber` | **Hob:** *Three times. I counted.* | — | all | tap |
| 3.4 | `Timber` | — (the hand alone) | the quest pill | the pill | claimed |
| 4.1 | `ARoof` | *Wood at last — and nowhere to sleep. But that shape past the trees… the Millers' house! Clear the fog, Your Majesty!* | the old House ([`01-map-and-fog.md`](01-map-and-fog.md) §6.3) | that cell | revealed |
| 4.2 | `ARoof` | *There it is! The roof's fallen in, but the walls are sound. Open it.* | the old House | the House | its card is open |
| 4.3 | `ARoof` | *Builders want their wood up front — it says so in the guild charter. Repair it!* | **Repair** | the button | repairing |
| 4.4 | `ARoof` | *Hear that? Hammers! And builders keep at it while you're away — they don't need watching. Unlike me.* | the construction | all | tap |
| 4.5 | `ARoof` | **Hob:** *Young Tom Miller's camped on the south road. Been waiting a year for a roof to come home to.* | — | all | tap |
| 5.1 | `Rations` | *A roof won't feed Tom, and our pantry is… a shelf. Berry bushes would do. Clear the fog off one, then pick it.* | the nearest berries, fogged or not | none | the quest completes |
| 6.0 | `FirstVillager` | *The House is still going up. Nobody moves in under scaffolding — I asked.* (skipped if it stands) | the House | none | the House is finished |
| 6.1 | `FirstVillager` | *A roof, a pantry… now Tom! The Townhall bell carries to the roads. Open it, Your Majesty.* | the Townhall | the Townhall | its card is open |
| 6.2 | `FirstVillager` | *Ring for him! He'll need that roof — and a little Food for the walk home.* | **Train** | none | a villager is in training |
| 6.2b | `FirstVillager` | *He's coming! We can wait for him — or a few Gems would hurry him along. Whichever you think best!* | — | none | a villager arrives |
| 6.3 | `FirstVillager` | **Tom:** *Is that… our roof? Your Majesty! Tom Miller, home at last. I'll pay my rent on time, I swear it.* | — | all | tap |
| 6.3a | `FirstVillager` | *Welcome home, Tom! You see, Your Majesty? Mend what the fog broke, and the people come back.* | — | all | tap |
| 6.3b | `FirstVillager` | *Let's close the Townhall — Tom's settling in.* (skipped if it is closed) | the card's close knob | the knob | the scroll is on screen |
| 7.1 | `TaxDay` | *Tom pays his rent into the House. When the purse shows, gather it — it's his to give, and it costs you nothing.* | the House | none | the quest completes |
| 7.2 | `TaxDay` | *That's how a kingdom is kept, I think: clear the fog, gather, build — and they come home, one by one.* | the quest pill | all | tap |
| 7.3 | `TaxDay` | *Lost? Look at their request and I'll point the way. Come back tomorrow — the barns and the purse fill up overnight.* | the quest pill | all | tap |
| 7.4 | `TaxDay` | — (the hand alone) | the quest pill | the pill | claimed — **the First Morning ends** |

- **Every lesson from `Woodcraft` on ends the same way**: once its lines are
  done it waits, invisible and locking nothing, for its quest to complete;
  the hand alone points at the close of anything open; then at the pill
  until the gift is accepted. The tables leave those beats out.
- **A beat checks its condition when it starts**, so a beat already met is
  skipped.
- **The Townhall's own Gold stays quiet through the First Morning**: no
  bubble, and a tap opens it rather than collecting. Its Gold piles up and
  shows once `TaxDay` is claimed.
- **A scene resumes where the kingdom is**: after a reload it picks up after
  the last line whose PROGRESS condition already holds (a quest, a research,
  a building, an upgrade under way) — never on a moment like a sheet being
  shut. Mid-scene, on the player's turn, a later line's progress already met
  jumps the scene past it the same way.
- **A tap on the plot the hand points at is a tap on that plot**, even where
  a store's bubble or a lair's picture floats over it.
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

Beats, as the First Morning's, each on its quest, and each ending on its
quest's gift accepted with the hand alone (§3).

| Scene | Quest | Says (Isolde, unless named) | Points at | Lock | Moves on |
|---|---|---|---|---|---|
| `plots` | `FirstPlot` | **Tom:** *Your Majesty! Before the fog, Dad kept two crop plots just past the Townhall. Best turnips in Oakville, he swore.* | the south plot | all | tap |
| | | **Hob:** *Turnips. Hmph. Fog's had them a year. Nothing left in there but weeds and a scarecrow.* | — | all | tap |
| | | *Weeds we can pull! First we buy the ground back from the fog — follow my finger, Your Majesty.* | the way to the south plot (`abandoned:OldPlotSouthFog`) | that cell | the plot is revealed |
| | | **Tom:** *There it is! The fence is down, but the soil's still good. Open it, Your Majesty.* | the plot | the plot | its card is open |
| | | **Hob:** *A fence wants wood. Here — off my pile. Don't make a fuss.* (only while the Wood is short; he makes up the difference) | — | all | tap |
| | | *Fresh seed, a new fence, and no builders needed — a field mends itself once it's sown. Repair it!* | **Repair** | the button | repairing |
| | | **Hob:** *Sprouting already. Soil's been waiting for somebody, that's all.* | the plot | all | tap |
| | | **Tom:** *And the other one, right beside it! Dad always planted them in pairs.* | the way to the north plot | that cell | revealed |
| | | *There — open it…* | the plot | the plot | its card is open |
| | | **Hob:** *More wood? …Fine. Last of the pile. Again.* (only while the Wood is short) | — | all | tap |
| | | *…and repair it!* | **Repair** | the button | repairing |
| | | **Tom:** *Two plots, just like Dad's! When they've grown, tap them and bring the harvest in.* | — | all | tap |
| | | **Hob:** *Every sickle swing asks the well, same as an axe. Mind the blue.* | — | all | tap |
| `farm` | `Farmhand` | *Reaping every plot by hand will wear us out — and drain the well. A Farm sends villagers to do it, day and night.* | the crop plots | all | tap |
| | | **Tom:** *Dad's old farm is still out there, past the berry bushes. Clear the way, Your Majesty — I'll know it when I see it.* | the way to the old Farm | that cell | the Farm is revealed |
| | | **Tom:** *That's her! Roof's sagging, but she's sound. Open it!* | the old Farm | the Farm | its card is open |
| | | **Hob:** *Farm wants wood too, does it. …Take it. I'll chop more.* (only while the Wood is short) | — | all | tap |
| | | *Hammers, sawdust and one cheerful racket — repair it!* | **Repair** | the button | repairing |
| `farmMove` | `Fieldside` | *Nearly done — listen to those hammers!* (skipped if it stands) | the Farm | none | the Farm is finished |
| | | *Oh. Oh no. A Farm works the plots one step around it, corners too — and ours are two steps away. I measured. Twice.* | the Farm | all | tap |
| | | **Hob:** *So pick it up and carry it. Did it with Widow Pell's henhouse once. Hens weren't pleased.* | — | all | tap |
| | | *Can we? …We can! The guild charter says a building may be moved for free, as often as you like. Page forty!* | — | all | tap |
| | | **Tom:** *It wants to stand right between the two plots. Clear the fog there first, Your Majesty.* (skipped if that ground is clear) | the spot (`reach:Farm`) | that cell | the spot is revealed |
| | | *Now open the Farm.* | the Farm | the Farm | its **Move** is on screen |
| | | *That's its Move knob. Tap it, and the whole Farm lifts right off the ground!* | **Move** | the knob | the Farm is picked up |
| | | **Tom:** *There — between Dad's plots! Tap the spot.* | the spot | that cell | the ghost reaches both plots |
| | | *Both plots in reach! Move it.* | **Move** (the placement bar) | the button | `Fieldside` complete |
| | | **Hob:** *Didn't drop a single plank. Better than the henhouse.* | — | all | tap |
| `workers` | `ToWork` | *The Farm is still going up. When it stands, it'll need hands.* (skipped if it stands) | the Farm | none | the Farm is finished |
| | | **Tom:** *The Farm stands — and nobody's working it. Open it, Your Majesty!* | the Farm | the Farm | its card is open |
| | | **Tom:** *Send me! I know every furrow. Each pair of hands walks to a plot, reaps it and carries the crop home.* | the card's **+** | none | the quest completes |
| | | *Look at them go! The harvest piles up in the Farm's barn — gather it when it's ready. A full barn stops the work.* | the Farm | all | tap |
| `chest` | the first Wood chest held (`SecondVillager`'s gift) | **Tom:** *I nearly forgot, Your Majesty! I brought something home from the road — a whole chest of good timber.* | — | all | tap |
| | | *Into the Bag with it — that's where I keep what the townsfolk give us. Open it, Your Majesty.* | **Bag** | the tab | the Bag is open |
| | | *A chest holds hours of the town's work, packed for later. Tap it.* | the Wood chest | the tile | its **Use** is on screen |
| | | *Use it, and the wood is ours — just when we need it most.* | **Use** | the button | the chest is used |
| | | **Hob:** *Good timber, that. Keep the next ones for when you're short — chests don't rot.* | — | all | tap |
| | | *Let's close the Bag and put that wood to work.* | the close knob | the knob | the Bag is shut |
| `secondHouse` | `GrowingTown` | *Word's spreading on the roads, and Tom's house is full. The fog kept no other… so we'll raise one of our own!* | **Build** (its padlock breaks) | the tab | the build menu is open |
| | | **Hob:** *New house wants more wood than you've got. Here — been stacking it all winter. Don't make a fuss.* (only while the Wood is short; he makes up the difference) | nothing | all | tap |
| | | *Builders want their wood up front — it says so in the guild charter. Choose the House.* | the Housing card | the card | placing |
| | | *Anywhere on the cleared ground. Drag it wherever feels right, then confirm. I'd pick somewhere sunny.* | the confirm button | the map and the panel | placed |
| `sawmill` | `TheSawmill` | **Hob:** *Farm reaps by itself, and an old man's still swinging an axe? There was a sawmill in the trees. Find it. Open it.* | the old Sawmill, its ruin or its silhouette | none | its card is open |
| | | **Hob:** *Mending it wants more wood than you've got. That's the last of my pile, mind.* (only while the Wood is short; he makes up the difference) | nothing | all | tap |
| | | *A Sawmill sends woodcutters into the trees around it — Wood without a single swing from you. Repair it!* | **Repair** | the button | repairing |
| `sawmillCrew` | `Crewed` | *The Sawmill is still going up. When it stands, it'll need hands.* (skipped if it stands) | the Sawmill | none | the Sawmill is finished |
| | | **Hob:** *Sawmill's up and nobody on the saws. Open it.* | the Sawmill | the Sawmill | its card is open |
| | | **Hob:** *Send it woodcutters. Young ones. The townsfolk want three at work — the Farm's count too.* | the card's **+** | none | the quest completes |
| | | *Food and Wood come in by themselves now, even while you're away. A real town, Your Majesty! I— I'm a little proud.* | the Sawmill | all | tap |
| | | **Hob:** *Hmph. …Me too.* | — | all | tap |
| `picks` | `Picks` | *Tom wants a second floor, and that wants stone. Nobody here can cut it — but I know a chapter that can!* | **Research** | the tab | the book is open |
| | | *Pickaxes. It opens the mountains to us.* | the Pickaxes card | the card | its sheet is open |
| | | *Pour in our Knowledge…* · *…and a little Gold for the iron. Done!* | **+N** · **Research** | the button | filled · done |
| | | *Let's close the book and go and find some rock.* | the close knob | the knob | the book is shut |
| `rubble` | `Rubble` | **Hob:** *Tap a mountain — clear its fog first, if need be. Every swing brings home Stone. My back's writing to complain.* | the nearest mountain, fogged or not | none | the quest completes |

- **A worker building's ghost starts where it would work the most** — the
  Farm beside the plots, the Sawmill in the thickest trees — the nearest of
  those to the Townhall.
- **The old Farm stands two steps from the plots**, out of their reach, so
  the opening teaches moving a building: `farmMove` walks the player through
  picking it up from its card and setting it between the plots. A move is
  free and instant ([`06-construction.md`](06-construction.md)).
- **A ruin's way through the fog is pointed one cell at a time**
  (`abandoned:<id>Fog`): the hand stands on the next cell the player can
  pay for, and moves on as each is cleared.
- **A repair takes about five seconds** ([`01-map-and-fog.md`](01-map-and-fog.md)
  §6.3), so a lesson never waits on its builders.
- **The fog's buildings are the opening's buildings.** The House, the plots,
  the Farm and the Sawmill are found and repaired, and no technology is
  researched to have them; the first building the player raises is the
  second House, in the `secondHouse` lesson, where the Build tab's padlock
  breaks.

### 3.2 The lessons: the city grows

Beats, as above, each on its quest and ending on its gift accepted. Every line
is data in `?dev=data` › Scenes; the table says who speaks and what the hand
walks the player through.

| Scene | Quest | Speakers | The hand walks them through |
|---|---|---|---|
| `capital` | `ProperCapital` | **Kofi** (enters), Isolde | the Townhall → its **Upgrade** → the sheet's **Upgrade**; builders work while away |
| `moreRoofs` | `MoreRoofs` | Tom, Kofi | Build → the House → placing it; a House against a House earns less. Kofi makes up the Wood when short |
| `furrows` | `FreshFurrows` | Tom, Isolde | Build → a crop plot beside the Farm (it reaches one step around) → a second one |
| `faces` | `NewFaces` | Tom, Isolde | the Townhall → **Train**, until five villagers live |
| `barn` | `BiggerBarn` | Tom, Kofi | a full barn stops the work; the Farm → **Upgrade** → **Upgrade** |
| `twoSaws` | `TwoSaws` | Hob, Kofi | Build → a second Sawmill, where the trees are thickest |
| `hands` | `ManyHands` | Hob, Tom | the new Sawmill → its **+**; more hands than ground in reach stand about |
| `pride` | `Pride` | **Priya** (enters), Isolde | Research → Village Pride → pour → research → close |
| `corner` | `PrettyCorner` | Priya, Isolde | a house beside a decoration collects more Gold; Build → Decorations → a flower bed → a second piece of the player's choice; anything moves for free |
| `upperFloors` | `UpperFloors` | Kofi | each House still below level 2, one by one |
| `barracks` | `Mustered` | the Warden | Build → Military → the Barracks |
| `recruits` | `FirstSoldier` | the Warden | the Barracks → **Train**; thirty make a company |
| `assault` | `DriveThemOut` | the Warden | the lair → **Attack** → Quick deploy → the attack; the numbers foretell the fight |
| `summon` | `FirstSummon` | Bess, Isolde | the Tavern → **Call** → the banner's free call; heroes lead soldiers |
| `secondFarm` | `SecondFarm` | Tom | Build → a second Farm among new plots |
| `civic` | `Civic` | Priya | Research → Civic Pride → pour → research → close |

- **Spending lines never lock.** A line that asks the player to pay — an
  upgrade, a call, a recruit — points with no lock, so a player short of the
  price can walk away, earn it and come back.
- **A lesson's player who has gone ahead is not taught**: each is needless
  once its quest is claimed.

## 4. The introductions

Each plays once, the first time its trigger is true. Lines are tapped through.
A scene that points at something does so after its
last line, as a hint.

### 4.1 The village

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `townhall2` | the Townhall reaches level 2 (quest `ProperCapital` complete) | Isolde | *A grander Townhall! Its bell carries further now — the dotted line marks how far we can push the fog.* | the Townhall |
| `survey` | the Survey opens, after `townhall2` | Isolde | *And the Royal Survey! The crown pays for every page we win back. Well — you're the crown. But it's tradition!* | the Survey pill |
| `builders` | the builder offer opens — a build refused because every builder is busy | Isolde | *Every builder is busy — I counted. Wait for one to finish, or hire another pair of hands, and two things rise at once.* | — |
| `manaEmpty` | the Mana pool reaches 0, for the first time | Isolde | *The well has run dry, Your Majesty. It fills again by itself, about a pool a night — or our patrons could refill it now.* | the Mana gauge |
| `eras` | 100 cells revealed — chapter 3's bar | Isolde | *You've seen more of the land than any monarch in years — and look, the tree has noticed! A new chapter can open.* | Research |
| `speedups` | the first speed-up in the Bag | Kofi | *Anything that waits shows Speed up on its card. Spend one there and the wait shrinks.* | Bag |
| `storeFull` | a building's store is full | Tom | *A full store stops the work dead — tap it and bring it home.* | that building |
| `idleCrew` | a crew has more hands than ground in reach | Tom | *Move the building nearer the work, or send them elsewhere.* | that building |
| `knowledgeFull` | the Knowledge bar at its cap | Isolde | *Ten points of Knowledge, and not one more will fit. Spend some in the book.* | the Knowledge plank |
| `store` | the Store opens | **Marisol**, Isolde | *Marisol Vega, merchant of everywhere! … She once sold my aunt a bridge.* | Store |
| `friends` | the friends' door opens | **Idris**, Isolde | *Write back, and they'll lend a hand each day. Pin a wish on the board, and a friend can fill it.* | Friends |
| `notices` | the first notice is pinned | Idris | *When something happens while you're busy, I pin a note here. Tap one to read it.* | the notice |

- `storeFull`, `idleCrew`, `knowledgeFull` and `notices` wait for the First
  Morning to end, as `sighted` does.

### 4.2 The Orcs

**`firstLair` — the first lair.** The first lair found, Orcs or Harpies,
plays this before the lair's own scene. Its lines are beats.

| Says (Isolde, unless named) | Points at | Lock | Moves on |
|---|---|---|---|
| *Your Majesty — a camp, past the fog! They've smelled our smoke. A town coming back to life draws company. Tap it… carefully.* | the lair | the lair | its card is open |
| *Raiders! See that clock? When it runs out, they rob our stores — and nothing near their camp can be worked while it stands.* | the lair's card | all | tap |
| **Hob:** *Axes won't do, not against that lot. You want soldiers — and the book knows how. Look for the Warrior.* | — | all | tap |

- The Warrior is a card in chapter 2 of the one tree; nothing is handed over.

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `orcs` | the Orcs are discovered | **Grukk** (right), **the Warden** (right), Isolde | **Grukk:** *Grrr. Your town smells of bread and gold. We come for both.* · **Warden:** *Warden of the Guard, Your Majesty — what's left of it. We followed your smoke home. Give me soldiers.* · **Isolde:** *Soldiers… there's a chapter on Barracks, I'm sure of it. Let me read up on it first—* · **Warden:** *Read. With respect, Your Majesty — orcs don't wait for chapter two.* · **Isolde:** *Then I'll read very quickly! The Barracks is in the research tree — let's open it together.* | Research |
| `raid` | the first raid lands | Hob, Isolde | **Hob:** *They've had my woodpile. MY woodpile.* · **Isolde:** *Never the treasury, at least. Gather often and they find less — clear the camp to win it all back.* | the lair |
| `battle` | the first attack sheet opens | the Warden | *Pick who goes in: as many soldiers as you can spare. The numbers tell you how it'll go before we march.* | the attack button |
| `victory` | the first lair is cleared | the Warden, Isolde, Hob | **Warden:** *They're scattered! And look what they left behind.* · **Isolde:** *Oakville is safe! Take the camp — whatever they stole comes home, and the ground is ours again.* · **Hob:** *Woodpile included.* | the lair |
| `evolution` | Warriors II is researched | the Warden | *The Barracks trains them now — if its level is high enough.* | the Barracks |
| `relics` | Relics opens | Isolde | *Cards! Collect a whole page and the kingdom earns a relic — a gift that grows every season. I do love collecting things.* | Relics |

### 4.3 Magic, heroes, the world

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `landmarkSeen` | the first landmark sighted, after the First Morning | Isolde | *Standing stones! Clear the fog around them and claim them. The well runs deeper for every one we wake.* (needless once one is claimed) | the landmark |
| `atlas` | the Atlas opens | Wren | *None of its cards is needed — but every one makes the road easier.* | Research |
| `magic` | the first landmark is claimed | Isolde | *Do you feel that? The old stones hum — the well runs deeper already. I've waited years for this.* | Research |
| `tavern` | the first Tavern is finished | **Bess** (right), Isolde | **Bess:** *Doors open, fire lit, soup on! Heroes will come from every road for a bowl of this.* · **Isolde:** *The Tavern flies the banner — your first hero is on the house! And a new book, the Sagas! Heroes, legends… my favourite shelf.* | Heroes |
| `towerSighted` | the Watchtower's ruin is sighted (01-map-and-fog.md §4.1) — in view from the start, so it plays as the First Morning ends | Isolde | *Do you see that shape on the northern hills? Something tall, past the fog. Clear the way towards it and we'll know. I hope it's friendly.* | the Watchtower |
| `watchtowerSeen` | the Watchtower's ruin is revealed | Isolde | *An old watchtower! Its great lens is gone — torn out. From its top you could see past the mountains. Oh, I'd love to sketch it.* | the Watchtower |
| `watchtowerRepair` — **locked** | the Watchtower can be repaired (`canRepair`): its ruin revealed, the lens in the Bag, the price and a builder in hand — on the main screen | Isolde | *The lens the Orcs carried off — it belongs to the old watchtower! Let's put it back. Tap the tower.* · *Set the lens and mend the stair. One minute, and we'll see past the mountains. Repair it!* | the tower, then **Repair** — nothing else can be pressed |
| `world` — **locked** | the world door opens — the Watchtower stands — on the main screen | Isolde | *The tower stands, and the lens is clear! Look, Your Majesty — come and see what lies past the hills.* · on the board: *Other kingdoms. Other banners! And all that mist between us… we’ll need someone with good boots.* | the world knob, until the board is open (`worldOpen`) |

**`explorer` — the first trip.** The first time the world board is open,
until an explorer has been sent. Its lines are beats; the trip is free
([`19-world-map.md`](19-world-map.md) §3.3).

| Says (Wren, unless named) | Points at | Lock | Moves on |
|---|---|---|---|
| *Wren, Royal Scout, at your service! Boots laced, compass oiled — I’m ready the moment you send me.* | — | all | tap |
| **Isolde:** *Sending a scout costs Gold, as a rule… but this first trip is on the crown. I’ve already signed the chit!* | — | all | tap |
| *See the mist next door? Something’s waiting under it. Tap that hex, Your Majesty.* | the misty hex nearest the city (`hex:explore`) | that hex | its card is open |
| *Just say the word — Explore!* | **Explore** | the button | an explorer is sent |
| *I’m off! I’ll walk there, have a good look round, and send word when I’m done. Then come and see what I found.* | — | all | tap |
| **Isolde:** *She always sends word. Usually by shouting it across the valley.* | — | all | tap |

**`explorerReady` — the first find.** The first time an explorer waits at
its hex, in the province or on the board, until a hex has been revealed.

| Says (Wren, unless named) | Points at | Lock | Moves on |
|---|---|---|---|
| *Your Majesty! I’m done at the hex — you’ll want to see this. Tap my message and I’ll take you there.* (passed on the board) | the *Explorer ready* notice | the bubble | the board is open |
| *Here I am! Tap the hex, and I’ll show you everything I found.* | the hex (`hex:ready`) | that hex | it is revealed |
| *Look at all that land — and what I dug up is already in your purse. I’ll head home now; send me out again once I’m back.* | — | all | tap |
| **Isolde:** *Every trip pushes the mist back a little further. I’ll keep the map — and the ledger!* | — | all | tap |

**The world board's introductions** play on the board (`where: world`).

| Scene | Trigger | Speakers | Says | Points at |
|---|---|---|---|---|
| `claim` — beats | the first hex revealed by an explorer; needless once a hex is held | Wren | *Build on a hex beside the city, and it's ours. Its feature says what we'll build.* | a hex to claim → **Build**, until it is claimed |
| `warCamp` | the War Camp stands | the Warden | *From here our armies march out onto the world board — to beat the camps, to take ground, to hold it.* | the world knob |
| `camps` | a monster camp in sight | the Warden | *A camp guards its ground: nobody claims it till it's beaten. Leave it, and it's back in half a day.* | the camp |
| `dungeon` | a dungeon out of the dark | Wren | *Camp an army at its door and delve, room by room. Nobody can hold a dungeon — only empty it.* | the dungeon |
| `portal` | the Dark Portal open | Wren | *Once a week it opens, and every kingdom races down it. Each floor pays more than the last.* | the Portal |

### 4.4 What the fog gives up

| Scene | Trigger | Says (Isolde, unless named) |
|---|---|---|
| `shrineSeen` | the Thorned Shrine is out of the dark | *A shrine in ruins! Repaired, it can hold a relic and lend us its power. Though not while the Orcs squat beside it.* |
| `huntSeen` | the first wild game | **Hob:** *Boar! Not had boar since the fog came. Mind — they bite back. Learn Hunting first.* |
| `ironSeen` | the first iron mountain | *Iron in that rock! The Quarry can't cut it until we learn Mining — and then it's worth five bare peaks.* |
| `goldSeen` | the first gold mountain | **Hob:** *Gold in the rock. That's what the fog likes best — mind it doesn't get ideas. Mining'll get it out.* |
| `fishSeen` | the first shoal | *Fish in the shallows! The Docks will net them, once we learn to build on the water. I can't swim, so… boats.* |
| `harpies` | the Harpies are discovered | **Hob:** *Harpies. Every shiny thing in the valley, gone by morning — the fog with feathers. And our stone with them.* |

Each points at what it is about.

**`shrineRelic` — the first Shrine.** The first Shrine standing plays this.
Its first line **hands over the Staff of Renewal whole** (restored at level 1,
nothing if it already is). Its lines are beats, like the first lair's.

| Says (Isolde, unless named) | Points at | Lock | Moves on |
|---|---|---|---|
| *The shrine stands again! And look what the Orcs left behind — the Staff of Renewal, whole. It wants an altar. Tap the shrine.* | the Shrine | the Shrine | its card is open |
| *A relic set on this altar lends the kingdom its power. Tap the altar.* | the altar | the altar | the relic picker is open |
| *There's the Staff. It renews the land round the shrine: woods, fields and stone hold more and grow back faster. Choose it.* | the Staff's card | the card | the Staff is in the slot |
| *Now Select, and it takes its place.* | Select | Select | a Shrine holds the Staff |
| *It sleeps until we wake it with Mana. Activate it and its power fills the ground round the shrine. It grows longer, wider and stronger.* | Activate | none | tap |

- Activating is pointed at, not required: a player short of Mana is never
  held on a line they cannot finish.

### 4.5 Later systems

| Scene | Trigger | Says (Isolde, unless named) |
|---|---|---|
| `wounded` | the first soldier comes home wounded | **Warden:** *They came home hurt, not lost. The Infirmary patches them up for less than a new recruit.* |
| `workshops` | the first workshop is finished | **Kofi:** *A workshop! Planks from Wood, cut stone from rock — and our grandest levels ask for them. Queue the work on its card.* |
| `harmony` | Gardening is researched | **Priya:** *Past level seven, the big buildings ask for Harmony, and only beauty pays it. Keep more than they ask and the purse fills faster too.* |
| `transplant` | Transplanting is researched | **Priya:** *Hold a tree and it lifts right out of the ground. It sulks for a day while it settles.* — points at a tree |

### 4.6 The unlock splash

A big opening is named full-screen before anyone talks about it.

- **What has one:** the doors Build, Research, Heroes, Relics and the world,
  and the found books Sagas and Atlas. Nothing else.
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
| The breath between two introductions | 6 s | `help.sceneGapSeconds` |
| Where a scene plays, and what makes it needless | per scene | `scenes` › `where`, `doneWhen` · `doneTarget` · `doneAmount` |
| Which openings have a splash, in what order, and what each says and shows | §4.6 | `?dev=data` › Unlock splashes |

## 9. Deliberately not in this design

- A skippable First Morning, or a skip for the whole tutorial.
- A tutorial on a separate map, a sandbox, or a replay of the opening.
- Rewards for watching a scene.
- Choices in dialogue, or branching scenes.
- A pointer that appears without being asked after the First Morning.
- Spoken lines (a speaker's emote is a sound, never words —
  [`24-dialogue.md`](24-dialogue.md) §6.1), and an animated portrait beyond
  entering, leaving and dimming.
- A scene over the battle playback, the reveal or the rewarded video.
- A splash for a building, a building level or a mechanic a technology opens: the tree's card already names it.
- Re-playing a scene from the settings.

**Open questions:** **OQ-117**.
