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
   first buildings that work for the player; the first chest, used from the
   Bag; and Stone, when the House's second story first asks for it. They are the only places
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
- **She walks the player through accepting a gift twice** — `FirstSteps`
  and `Timber` — and never again: from the third request on, the pill is
  the player's to claim.
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
| 3.4 | `Timber` | *Wood for Oakville! The Townhall folk sent their thanks — accept it, and the well gets a little magic back.* | the quest pill | the pill | claimed |
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
| 7.3 | `TaxDay` | *Lost? Look at their request and I'll point the way. Come back tomorrow — the barns and the purse fill up overnight.* | the quest pill | all | tap — **the First Morning ends** |

- **A beat checks its condition when it starts**, so a beat already met is
  skipped.
- **The Townhall's own Gold stays quiet through the First Morning**: no
  bubble, and a tap opens it rather than collecting. Its Gold piles up and
  shows once `TaxDay` is claimed.
- **A scene resumes where the kingdom is**: after a reload it picks up after
  the last line whose PROGRESS condition already holds (a quest, a research,
  a building) — never on a moment like a sheet being shut.
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

Beats, as the First Morning's, each on its quest.

| Scene | Quest | Says (Isolde, unless named) | Points at | Lock | Moves on |
|---|---|---|---|---|---|
| `farm` | `Farmhand` | *Reaping every plot by hand will wear us out — and drain the well. A Farm sends villagers to do it, day and night.* | the crop plots | all | tap |
| | | **Tom:** *Dad ran the old farm, right by the fields. Clear its fog and open it, Your Majesty — I'll show you.* | the old Farm, its ruin or its silhouette | none | its card is open |
| | | *A Farm works the plots one step around it, corners too — and this one stands right beside ours. Repair it!* | **Repair** | the button | repairing |
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
| `townhall2` | the Townhall reaches level 2 (quest `ProperCapital` complete) | Isolde | *A grander Townhall! Its bell carries further now — the dotted line marks how far we can push the fog.* | the Townhall |
| `survey` | the Survey opens, after `townhall2` | Isolde | *And the Royal Survey! The crown pays for every page we win back. Well — you're the crown. But it's tradition!* | the Survey pill |
| `builders` | the builder offer opens — a build refused because every builder is busy | Isolde | *Every builder is busy — I counted. Wait for one to finish, or hire another pair of hands, and two things rise at once.* | — |
| `manaEmpty` | the Mana pool reaches 0, for the first time | Isolde | *The well has run dry, Your Majesty. It fills again by itself, about a pool a night — or our patrons could refill it now.* | the Mana gauge |
| `eras` | 100 cells revealed — chapter 3's bar | Isolde | *You've seen more of the land than any monarch in years — and look, the tree has noticed! A new chapter can open.* | Research |

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
| `relics` | Relics opens | Isolde | *Cards! Collect a whole page and the kingdom earns a relic — a gift that grows every season. I do love collecting things.* | Relics |

### 4.3 Magic, heroes, the world

| Scene | Trigger | Speakers | Says | Then points at |
|---|---|---|---|---|
| `magic` | the first landmark is claimed | Isolde | *Do you feel that? The old stones hum — the well runs deeper already. I've waited years for this.* | Research |
| `tavern` | the first Tavern is finished | **Bess** (right), Isolde | **Bess:** *Doors open, fire lit, soup on! Heroes will come from every road for a bowl of this.* · **Isolde:** *The Tavern flies the banner — your first hero is on the house! And a new book, the Sagas! Heroes, legends… my favourite shelf.* | Heroes |
| `towerSighted` | the Watchtower's ruin is sighted (01-map-and-fog.md §4.1) — in view from the start, so it plays as the First Morning ends | Isolde | *Do you see that shape on the northern hills? Something tall, past the fog. Clear the way towards it and we'll know. I hope it's friendly.* | the Watchtower |
| `watchtowerSeen` | the Watchtower's ruin is revealed | Isolde | *An old watchtower! Its great lens is gone — torn out. From its top you could see past the mountains. Oh, I'd love to sketch it.* | the Watchtower |
| `watchtowerRepair` — **locked** | the Watchtower can be repaired (`canRepair`): its ruin revealed, the lens in the Bag, the price and a builder in hand — on the main screen | Isolde | *The lens the Orcs carried off — it belongs to the old watchtower! Let's put it back. Tap the tower.* · *Set the lens and mend the stair. One minute, and we'll see past the mountains. Repair it!* | the tower, then **Repair** — nothing else can be pressed |
| `world` — **locked** | the world door opens — the Watchtower stands — on the main screen | Isolde | *The tower stands, and the lens is clear! Look, Your Majesty — come and see what lies past the hills.* · on the board: *Other kingdoms. Other banners! Our scouts are mapping the roads — and the Atlas will help us read them.* | the world knob, until the board is open (`worldOpen`) |

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
| *There's the Staff. Its power trains soldiers and villagers faster in the buildings round the shrine. Choose it.* | the Staff's card | the card | the Staff is in the slot |
| *Now Select, and it takes its place.* | Select | Select | a Shrine holds the Staff |
| *It sleeps until we wake it with Mana. Activate it and its power fills the ground round the shrine. It grows longer, wider and stronger.* | Activate | none | tap |

- Activating is pointed at, not required: a player short of Mana is never
  held on a line they cannot finish.

### 4.5 Later systems

| Scene | Trigger | Says (Isolde, unless named) |
|---|---|---|
| `wounded` | the first soldier comes home wounded | **Warden:** *They came home hurt, not lost. The Infirmary patches them up for less than a new recruit.* |
| `workshops` | the first workshop is finished | *A workshop! It turns raw goods into fine ones — and our grandest buildings will ask for them.* |
| `harmony` | the first decoration is unlocked | *A beautiful city is a willing one. Decorations lend Harmony — and our grandest buildings ask for it.* |

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
| The breath between two introductions | 20 s | `help.sceneGapSeconds` |
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
