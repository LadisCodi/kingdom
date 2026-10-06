# Isolde's voice — a script pass

> **Scope.** A rewrite of the scene lines in `scenes.json` so the opening reads
> as a story, not a manual: every action is asked for by someone who needs it,
> and a second voice argues with Isolde. Mechanics, targets, locks and
> conditions are unchanged; only `speaker`, `side`, `expression` and `text`
> move, plus the tap-only lines marked **new**.
>
> **Status: applied** (2026-10-06). The live lines are in
> [`../features/23-tutorials.md`](../features/23-tutorials.md); this file keeps the reasoning.

## 1. The rules of the pass

- **Every instruction stays plain.** A line that waits on the player still
  ends on the verb the player must do (*Tap it*, *Open it*, *Repair it*).
  Character lives in the first half of the line, the order in the second.
- **Banter fills the waits.** New tap lines go where the player is already
  waiting: a repair under way, a villager on the road, a scene's last word.
- **The First Morning grows by six taps** (about 30 seconds of reading),
  against **OQ-117**. §6 lists what to cut first.
- **Every mechanic gets a reason inside the fiction** (§3), said once, by
  whoever would know it.
- **One line, about 130 characters at most**, as today: three lines of the
  box.

## 2. The cast

| Id | Name | Who | Side | Art |
|---|---|---|---|---|
| `advisor` | **Isolde** | the royal librarian, advising because most of the court fled. Cheerful, nervous, a book for everything | left | as today, five faces |
| `woodcutter` | **Old Hob** — **new** | the woodcutter who never left. Gruff, superstitious, knows the land by hand and distrusts books. Teases Isolde, and is secretly proud of her. Her foil: she reads why, he knows how | right | **needs a figure**; the lettered medallion until then |
| `villager` | **Tom Miller** — renamed | the Millers' son, camped on the south road until the house had a roof. Young, eager, a little too honest | right | `portrait_villager` as today |
| `warden` | **the Warden** | captain of what is left of the guard; came home following the smoke. Dry, practical, impatient with books | right | as today |
| `orcChief` | **Grukk** | the Orcs' warchief | right | as today |
| `cook` | **Bess** | the Tavern | right | as today |

- **Hob's figure**: an old woodcutter, white beard, a patched leather apron,
  a felling axe on his shoulder, a pipe; same style and frame as the cast
  (`../art/ui/mockups/ftue/prompts.md` P1).

## 3. The fiction behind the mechanics

| Mechanic | The reason, as the town tells it | Said by |
|---|---|---|
| Fog costs Gold | **The fog is greedy.** It loves anything that shines; toss it a coin and it gives a little ground back | Hob, at the first line |
| A tap costs Mana | **Every swing asks the land's leave**, drawn from the kingdom's well; ask too often and it wants a night's rest | Hob, at the first tree |
| Research | **The crafts were forgotten** when the people fled; Isolde's books still hold them, and Knowledge is her study | Hob's shaking hands, Isolde's books |
| Villagers | **The people are camped on the roads**, waiting for a roof and bread to come home to | Hob, then Tom |
| Quest rewards | **The few who stayed**, sheltering in the Townhall, give what they can | Isolde |
| Lairs | **Raiders smelled the smoke** of a town coming back to life | Isolde, the Warden |
| Harpies, gold | **Anything that shines** — the Harpies are the fog with feathers | Hob |

- Isolde no longer says *everyone* fled: *most of Oakville* did.

## 4. The First Morning

Marks: **new** — a tap line added; **re** — a rewritten line; **=** — kept.

### `intro` — FirstSteps

| | Speaker | Face | Line |
|---|---|---|---|
| = | Isolde | happy | *Oh! Your Majesty — you came! Welcome home to Oakville. Well… to what the fog has left of it.* |
| re | Isolde | happy | *I’m Isolde. I kept the royal library — but most of the court fled the fog, so… I’m your Royal Advisor now!* |
| new | Hob | | *Advisor. Ha! Last time she advised anyone, it was the old king. To read more.* |
| re | Isolde | worried | *This is Hob, our woodcutter. He’s the only one who never left. He says the fog doesn’t scare him.* |
| new | Hob | | *Scare me? It’s greedy, that’s all. Loves a shine. Toss it a coin and it gives a bit of ground back.* |
| re | Isolde | idea | *Then let’s feed it! Those trees in the fog are ours — tap it, Your Majesty. Five coins, Hob says.* |
| re | Isolde | surprised | *Timber! It worked! And look — right beside it. Something glinting in the fog. Clear that one too!* |
| re | Hob | | *That’s Widow Pell’s purse. Dropped it running, she did. Well — the fog owes us. Tap it.* |
| re | Isolde | | *The fog kept more of what they left, I’m sure of it. Three more stands, and the axes will have work again.* |
| re | Isolde | happy | *The folk sheltering in the Townhall saw it all — they’ve gathered you a gift! Go on, accept it.* |

### `morningBook` — Woodcraft

| | Speaker | Face | Line |
|---|---|---|---|
| = | Isolde | | *Oh — let’s set this aside first, and step back out to the kingdom.* |
| new | Hob | | *Trees aplenty, and nobody left who knows how to drop one safe. My hands shake too much now.* |
| re | Isolde | idea | *Then a book will teach them! I have a book for that. I have a book for most things.* |
| re | Isolde | idea | *Each page is a craft Oakville forgot. This one’s Forestry — chapter one. My favourite!* |
| re | Isolde | | *Learning takes Knowledge — that’s my studying, bottled up. Pour it in…* |
| re | Isolde | happy | *…then a little Gold for proper axes, and the craft is ours again. Just like that!* |
| re | Isolde | happy | *Hear that? Axes in the woods! I study a point of Knowledge an hour, up to ten. Best spend it before then.* |
| = | Isolde | | *Let’s close the book and go and watch them work. I’ll — I’ll mark the page.* |

### `morningAxe` — Timber

| | Speaker | Face | Line |
|---|---|---|---|
| re | Hob | | *Show ’em how it’s done, Majesty. Tap a tree. Every swing asks the land’s leave — a drop from that blue well.* |
| re | Hob | | *Hold it down and the axe keeps going. When a stand’s bare, move on — it grows back. Trees don’t sulk.* |
| re | Isolde | worried | *Oh — the well is lower! Every swing drew a drop. Don’t fret: it fills again by itself. I checked twice.* |
| new | Hob | | *Three times. I counted.* |
| re | Isolde | happy | *Wood for Oakville! The Townhall folk sent their thanks — accept it, and the well gets a little magic back.* |

### `morningRoof` — ARoof

| | Speaker | Face | Line |
|---|---|---|---|
| re | Isolde | worried | *Wood at last — and nowhere to sleep. But that shape past the trees… the Millers’ house! Clear the fog, Your Majesty!* |
| = | Isolde | happy | *There it is! The roof’s fallen in, but the walls are sound. Open it.* |
| = | Isolde | worried | *Builders want their wood up front — it says so in the guild charter. Repair it!* |
| = | Isolde | happy | *Hear that? Hammers! And builders keep at it while you’re away — they don’t need watching. Unlike me.* |
| new | Hob | | *Young Tom Miller’s camped on the south road. Been waiting a year for a roof to come home to.* |

### `morningFood` — Rations

| | Speaker | Face | Line |
|---|---|---|---|
| re | Isolde | worried | *A roof won’t feed Tom, and our pantry is… a shelf. Berry bushes would do. Clear the fog off one, then pick it.* |

### `morningVillager` — FirstVillager

| | Speaker | Face | Line |
|---|---|---|---|
| re | Isolde | | *The House is still going up. Nobody moves in under scaffolding — I asked.* |
| re | Isolde | idea | *A roof, a pantry… now Tom! The Townhall bell carries to the roads. Open it, Your Majesty.* |
| re | Isolde | | *Ring for him! He’ll need that roof — and a little Food for the walk home.* |
| re | Isolde | idea | *He’s coming! We can wait for him — or a few Gems would hurry him along. Whichever you think best!* |
| re | Tom | | *Is that… our roof? Your Majesty! Tom Miller, home at last. I’ll pay my rent on time, I swear it.* |
| new | Isolde | happy | *Welcome home, Tom! You see, Your Majesty? Mend what the fog broke, and the people come back.* |
| = | Isolde | | *Let’s close the Townhall — Tom’s settling in.* |

### `morningRent` — TaxDay

| | Speaker | Face | Line |
|---|---|---|---|
| re | Isolde | idea | *Tom pays his rent into the House. When the purse shows, gather it — it’s his to give, and it costs you nothing.* |
| re | Isolde | happy | *That’s how a kingdom is kept, I think: clear the fog, gather, build — and they come home, one by one.* |
| = | Isolde | idea | *Lost? Look at their request and I’ll point the way. Come back tomorrow — the barns and the purse fill up overnight.* |

## 5. After the morning

### The lessons

| Scene | | Speaker | Face | Line |
|---|---|---|---|---|
| `farm` | = | Isolde | worried | *Reaping every plot by hand will wear us out — and drain the well. A Farm sends villagers to do it, day and night.* |
| | re | Tom | | *Dad ran the old farm, right by the fields. Clear its fog and open it, Your Majesty — I’ll show you.* |
| | = | Isolde | | *A Farm works the plots one step around it, corners too — and this one stands right beside ours. Repair it!* |
| `workers` | re | Tom | | *The Farm stands — and nobody’s working it. Open it, Your Majesty!* |
| | re | Tom | | *Send me! I know every furrow. Each pair of hands walks to a plot, reaps it and carries the crop home.* |
| | = | Isolde | happy | *Look at them go! The harvest piles up in the Farm’s barn — gather it when it’s ready. A full barn stops the work.* |
| `secondHouse` | re | Isolde | idea | *Word’s spreading on the roads, and Tom’s house is full. The fog kept no other… so we’ll raise one of our own!* |
| | re | Hob | | *New house wants more wood than you’ve got. Here — been stacking it all winter. Don’t make a fuss.* |
| | = | Isolde | worried | *Builders want their wood up front — it says so in the guild charter. Choose the House.* |
| | = | Isolde | | *Anywhere on the cleared ground. Drag it wherever feels right, then confirm. I’d pick somewhere sunny.* |
| `sawmill` | re | Hob | | *Farm reaps by itself, and an old man’s still swinging an axe? There was a sawmill in the trees. Find it. Open it.* |
| | re | Hob | | *Mending it wants more wood than you’ve got. That’s the last of my pile, mind.* |
| | = | Isolde | idea | *A Sawmill sends woodcutters into the trees around it — Wood without a single swing from you. Repair it!* |
| `sawmillCrew` | = | Isolde | | *The Sawmill is still going up. When it stands, it’ll need hands.* |
| | re | Hob | | *Sawmill’s up and nobody on the saws. Open it.* |
| | re | Hob | | *Send it woodcutters. Young ones. The townsfolk want three at work — the Farm’s count too.* |
| | = | Isolde | happy | *Food and Wood come in by themselves now, even while you’re away. A real town, Your Majesty! I— I’m a little proud.* |
| | new | Hob | | *Hmph. …Me too.* |
| `picks` | re | Isolde | worried | *Tom wants a second floor, and that wants stone. Nobody here can cut it — but I know a chapter that can!* |
| `rubble` | re | Hob | | *Tap a mountain — clear its fog first, if need be. Every swing brings home Stone. My back’s writing to complain.* |

### The introductions

| Scene | | Speaker | Face | Line |
|---|---|---|---|---|
| `townhall2` | re | Isolde | happy | *A grander Townhall! Its bell carries further now — the dotted line marks how far we can push the fog.* |
| `survey` | re | Isolde | happy | *And the Royal Survey! The crown pays for every page we win back. Well — you’re the crown. But it’s tradition!* |
| `firstLair` | re | Isolde | worried | *Your Majesty — a camp, past the fog! They’ve smelled our smoke. A town coming back to life draws company. Tap it… carefully.* |
| | = | Isolde | worried | *Raiders! See that clock? When it runs out, they rob our stores — and nothing near their camp can be worked while it stands.* |
| | re | Hob | | *Axes won’t do, not against that lot. You want soldiers — and the book knows how. Look for the Warrior.* |
| `orcs` | = | Grukk | | *Grrr. Your town smells of bread and gold. We come for both.* |
| | re | the Warden | | *Warden of the Guard, Your Majesty — what’s left of it. We followed your smoke home. Give me soldiers.* |
| | = | Isolde | | *Oh — let’s set this aside first, and step back out to the kingdom.* |
| | re | Isolde | idea | *Soldiers it is! The research tree knows how to raise a Barracks — let’s read it together.* |
| | new | the Warden | | *Read. With respect, Your Majesty — orcs don’t wait for chapter two.* |
| | new | Isolde | worried | *Then I’ll read very quickly!* |
| `raid` | new | Hob | | *They’ve had my woodpile. MY woodpile.* |
| | re | Isolde | worried | *Never the treasury, at least. Gather often and they find less — clear the camp to win it all back.* |
| `battle` | = | the Warden | | *Pick who goes in: as many soldiers as you can spare. The numbers tell you how it’ll go before we march.* |
| `victory` | = | the Warden | | *They’re scattered! And look what they left behind.* |
| | = | Isolde | happy | *Oakville is safe! Take the camp — whatever they stole comes home, and the ground is ours again.* |
| | new | Hob | | *Woodpile included.* |
| `huntSeen` | re | Hob | | *Boar! Not had boar since the fog came. Mind — they bite back. Learn Hunting first.* |
| `goldSeen` | re | Hob | | *Gold in the rock. That’s what the fog likes best — mind it doesn’t get ideas. Mining’ll get it out.* |
| `harpies` | re | Hob | | *Harpies. Every shiny thing in the valley, gone by morning — the fog with feathers. And our stone with them.* |
| `wounded` | re | the Warden | | *They came home hurt, not lost. The Infirmary patches them up for less than a new recruit.* |

- `towerSighted`, `watchtowerSeen`, `world`, `magic`, `relics`, `tavern`,
  `shrine*`, `ironSeen`, `fishSeen`, `builders`, `manaEmpty`, `eras`,
  `workshops` and `harmony` keep their lines.

## 6. If the morning is too long

Cut in this order, each saving a tap:

1. `morningAxe` — *Three times. I counted.*
2. `intro` — Hob's first jab (*Advisor. Ha!…*); Isolde's introduction of him
   then opens the pair.
3. `morningVillager` — Isolde's *Welcome home, Tom!*
4. `morningRoof` — Hob on Tom camped on the road (Tom's own line then
   introduces him).

**Open questions:** **OQ-117**.
