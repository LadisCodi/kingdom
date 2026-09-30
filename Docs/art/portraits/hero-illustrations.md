# Hero illustrations

> **Scope.** The prompt and the cast for every hero's illustration
> (`src/render/assets/hero_<id>.png`): the style block, the sheet shape, the
> thirty-two character blocks, and how a sheet lands in the build.
> **Status:** all thirty-two drawn and in the build (2026-09-30), in "style
> 1", the troops' flat cartoon
> (`../originals/hero-style-tests/hero_style1.png`). Supersedes the
> stylized-3D portraits of [`prompt-template.md`](prompt-template.md) and the
> character blocks of [`roster-blocks.md`](roster-blocks.md).

## 1. What a hero illustration is

- A **full-body standing figure**, facing the viewer, a touch of 3/4, in the
  same hand as the troops (`unit_<unit>.png`) and their avatars.
- It fills a hero card; the UI crops and frames it. Nothing is drawn behind
  it: no ground, no pedestal, no shadow, no frame.
- **Its weapon comes from `unitType`**, never from the class word:

| `unitType` | What it holds |
|---|---|
| `Warrior` | a sword, axe, mace or hammer, often a shield |
| `Lancer` | a spear, or the long-handled tool of its trade |
| `Archer` | a bow, crossbow, thrown things, or a caster's gesture at range |
| `Cavalry` | riding boots and spurs, **no mount**, plus a hand weapon |

- **Its trait is drawn, not written:**

| Trait | The picture |
|---|---|
| party defence | planted, weight spread, something protecting the front |
| supply discount | one bag and nothing more |
| more fragments | relic shards in view, something half dug up |
| more Stardust | small golden motes clinging to them |
| more Knowledge | an open book, notes, glyphs |
| fallen reach a bed | bandages, a healer's kit, a hand that steadies |
| sees the next depth | looking ahead — a spyglass, a map, a nose |

## 2. The cast

The roster is mixed on purpose:

- **Gender:** fourteen women, sixteen men, plus Three Mice and the Dragon.
- **Age:** from teenagers to people in their seventies; about a third are
  over fifty.
- **Ethnicity:** Black, East, South and Southeast Asian, Middle Eastern,
  North African, Latino and European humans.
- **Fantasy races:** dwarves, elves, dark elves and tieflings, plus the
  beastkin, the mice and the dragon.
- **Tone:** most are attractive and warm. Some are plain, old or odd-looking.
  About a quarter read as dark, macabre or a bit villainous — never gory.

| Hero | Rarity · unit | Who | Tone |
|---|---|---|---|
| Warden | C · Warrior | dwarf woman, 50s | stern, kind |
| Quartermaster | C · Lancer | Black man, 60s | fussy, dry |
| Scholar | R · Archer | East Asian woman, 20s | bright |
| RelicHunter | R · Cavalry | dwarf man, 60s | greedy grin |
| Scout | L · Archer | wood elf man, young | easy-going |
| Adventurer | C · Lancer | Latino boy, 18 | eager |
| Bard | C · Archer | tiefling woman, 30s | flirty, roguish |
| BeastkinHunter | C · Cavalry | wolf-folk woman, adult | wild, loyal |
| Cleric | C · Warrior | South Asian woman, 40s | calm |
| Cook | C · Lancer | Black woman, 50s | jolly |
| Gardener | C · Warrior | East Asian man, 70s | patient |
| Joker | C · Archer | tiefling man, 20s | sly, a bit wicked |
| Merchant | C · Lancer | Persian man, 50s, portly | shrewd |
| Priest | C · Warrior | European man, 70s, bald | solemn |
| Rogue | C · Cavalry | dark elf woman, 20s | mocking |
| ThreeMice | C · Archer | three mice in a coat | deadpan |
| Sellsword | C · Warrior | European man, 30s | cynical |
| DarkKnight | R · Warrior | Mediterranean woman, 30s | brooding, menacing |
| Paladin | R · Warrior | Black man, 40s | noble, handsome |
| Wizard | R · Archer | European man, 70s, short | pompous |
| Witch | R · Archer | Mediterranean crone, 70s | cackling, macabre |
| Druid | R · Lancer | elf woman, ageless, brown skin | serene |
| IceLancer | R · Lancer | Nordic woman, 20s | cold, aloof |
| HolyWarrior | R · Cavalry | South Asian man, 20s | earnest |
| SavageWarrior | R · Cavalry | Black woman, 30s, huge | fierce |
| Spymaster | R · Archer | East Asian woman, 60s | elegant, sinister |
| ElectricArcher | R · Archer | Southeast Asian man, 20s | cocky |
| GoldenDragon | L · Cavalry | a golden dragon | bored, ancient |
| VampireLord | L · Cavalry | pale aristocrat, 50s-looking | charming, villainous |
| Necromancer | L · Archer | dark elf man, very old | macabre |
| Pharao | L · Warrior | Egyptian man, 40s | proud |
| ElvenPrincess | L · Lancer | elf woman, young, brown skin | graceful |

## 3. The prompt

One conversation for the whole set, continuing the style-1 test chat: its
troop montage and its own test sheet are the anchor. A prompt is §3.1 + three
blocks from §4 + §3.2. The prompt is in **English**.

### 3.1 The head (every sheet)

> CREATE A NEW IMAGE. Same style as the hero sheet you generated first in
> this conversation, which matches the attached troops — that style is
> LOCKED; do not drift.
>
> === STYLE ===
> Flat 2D cartoon illustration for a cozy medieval-fantasy mobile strategy
> game, NOT 3D, NOT Pixar, NOT a render, NOT anime. Bold, clean dark-brown
> outlines on every shape, uniform in weight. Flat colour with simple cel
> shading: one shadow tone and one small highlight per material, no
> gradients, no textures, no ambient occlusion. Big simple readable shapes,
> friendly slightly chunky proportions — large head, big hands and boots.
> Small simple eyes, expressive faces. Warm saturated palette, steel grey for
> metal, gold accents. Lit from the top left. Draw as if shown 200 px tall:
> nothing thinner than the outline.
>
> === COMPOSITION ===
> One landscape image, 3:2, three heroes side by side, each in its own third
> of the canvas, the same height (about 80% of the canvas height), full body,
> standing, facing the viewer with a touch of 3/4. Both hands and both feet
> visible; every weapon entirely inside its third. Nothing crosses into a
> neighbouring third: keep a clear 40 px empty band between figures. Each
> hero is a different person — vary body type, height, face shape and skin
> tone as described; do not give them the same face.

In a **new conversation**, attach `../originals/hero-style-tests/anchor.png`
(sheet 1 over the style-1 test) and replace the first paragraph with:

> CREATE A NEW IMAGE. Do not edit or export the attached file: it is ONLY the
> style reference — hero sheets already made for this game. Match that style
> exactly: it is LOCKED; do not drift.

### 3.2 The tail (every sheet)

> Do not draw grid lines, cell borders, labels, captions, names, text,
> shadows, ground, pedestal or any background. The background must be alpha
> 0 everywhere, not white, not a checkerboard. Then apply the true-alpha
> transparency correction and give me the download link for the corrected
> PNG.

## 4. The character blocks

Paste three, numbered 1-3 left to right, under `=== THE THREE HEROES ===`.

**Warden** — Dwarf woman in her fifties, short and broad as a barrel, planted
with both feet apart. Stern but kind, a veteran. Ruddy fair skin, laugh lines,
thick grey-streaked copper hair in two heavy braids, no beard. Scale-mail
shirt over a moss-green tunic, wide leather belt, iron-shod boots. A big round
wooden shield with an iron rim held in front, a short sword in the other hand.

**Quartermaster** — Black man in his sixties, lean and upright, a fussy dry
look over small round spectacles. Close grey beard, short grey hair. Neat
buttoned mustard waistcoat over a white shirt, sleeves gartered, brown
trousers, polished boots. A spear held upright like a staff, a tally board
hanging from it, and ONE well-packed satchel on his back — nothing else.

**Scholar** — East Asian woman in her twenties, slim, bright curious smile.
Black hair in a loose bun with a pencil through it, round glasses. Long plum
scholar's coat with ink-stained cuffs, a scarf, soft boots. An open glowing
tome held in one hand; the other hand raised, casting a small floating golden
glyph forward.

**RelicHunter** — Dwarf man in his sixties, stocky, a greedy delighted grin.
Weathered tan skin, bald crown, huge white beard braided and tucked into his
belt, bushy brows. Leather coat with many pockets, miner's lamp on a hat,
tall riding boots with spurs. A short pick in one hand and a glowing relic
shard held up in the other; more shards peeking from a sack.

**Scout** — Wood elf man, looks young, lithe and light on his feet, leaning
forward as if already walking, easy smile. Fair skin, long auburn hair tied
back, long pointed ears. Green-and-brown hooded tunic, leaf-shaped cloak
clasp, soft boots. A longbow in one hand, a brass spyglass raised to one eye
with the other.

**Adventurer** — Latino boy of eighteen, gangly, wide eager grin, freckles.
Warm brown skin, messy black curls, a feather in his cap. Too-big patched
blue coat, rolled trousers, scuffed boots. A spear resting on his shoulder
with a bundle tied to its end, a rolled map sticking out of his belt, a relic
shard on a string round his neck.

**Bard** — Tiefling woman in her thirties, confident hip-shot stance, a flirty
roguish wink. Lavender skin, curling dark horns, long wavy black hair, a thin
tail with a ribbon, golden eyes. Teal doublet with puffed sleeves, a feathered
hat, tall boots. Playing a lute; a few golden stardust motes and musical notes
drift from its strings.

**BeastkinHunter** — Wolf-folk woman, adult, lean and muscular, crouched a
little, nose up sniffing the air. Grey-and-white fur, wolf head with a long
muzzle, amber eyes, one torn ear, a bone bead necklace. Leather vest and
wraps, fur-trimmed riding boots with spurs. A hunting knife in one hand, a
coil of rope at her hip.

**Cleric** — South Asian woman in her forties, sturdy, calm reassuring
expression. Brown skin, long black hair in a single braid, a thin silver
circlet. White-and-sky-blue tabard over
chainmail, bandage rolls on her belt. A flanged mace in one hand, a small
round shield with a white cross-star, a first-aid satchel.

**Cook** — Black woman in her fifties, round and jolly, laughing out loud.
Dark skin, grey-flecked hair wrapped in a bright orange headscarf. Rolled
sleeves, stained white apron over a red dress, clogs. A huge long-handled
ladle held like a spear, one cooking pot slung on her back — nothing else.

**Gardener** — East Asian man in his seventies, small and slightly stooped,
serene patient smile, eyes crinkled shut. Wispy white goatee, bald with a
white topknot, wide straw hat. Faded indigo work jacket and trousers, straw
sandals. A curved pruning blade in one hand, a round wicker shield with a
sprout painted on it in the other.

**Joker** — Tiefling man in his twenties, wiry, a sly wicked grin with one
fang showing. Brick-red skin, small backswept horns, a jester's cap with bells
between the horns, yellow eyes, a tail. Red-and-black diamond motley, pointed
shoes. Fanning three playing cards ready to throw, a relic shard half hidden
up his sleeve.

**Merchant** — Persian man in his fifties, portly, a shrewd smile and one
raised eyebrow. Olive-brown skin, trimmed black beard with grey, a green silk
turban with a jewel. Rich green-and-gold kaftan, sash, curled slippers. A
long walking staff with a small brass balance scale hanging from its top, and
ONE money bag — nothing else.

**Priest** — European man in his seventies, tall and thin, solemn, eyes
closed mid-prayer. Pale wrinkled skin, bald, long white eyebrows, clean
shaven. Plain grey habit with a rope belt, a white stole. A heavy prayer book
open in one hand, a candle-topped iron mace in the other, a small lit candle
flame.

**Rogue** — Dark elf woman in her twenties, petite, balanced on the ball of
one foot, looking back over her shoulder with a mocking half smile. Grey-violet
skin, short choppy white hair, red eyes, long pointed ears, a small silver
hoop earring. Tight dark-leather jerkin, short black hooded cape, crossed
belts, riding boots with small spurs. A dagger in each hand, a glowing relic
shard half out of her pouch.

**ThreeMice** — One figure the height of a short person, made of THREE grey
mice stacked inside a long olive-green coat: the top one peeks out of the
collar wearing a tiny top hat and a monocle, the middle one's paws come out
of the sleeves. Dead serious about the disguise. Tiny boots at the bottom. A
little shortbow held low; a few golden stardust motes. It must read as one
character.

**Sellsword** — European man in his thirties, wiry, weight on one leg, a
tired half smile. Tanned skin, brown hair in a low ponytail, stubble, a thin
scar on the lip. Riveted leather breastplate over a rolled-up grey shirt, ONE
dented steel pauldron, canvas trousers, worn boots, a coin purse tied to the
belt. A broadsword on his shoulder, a dented shield with a blue fleur-de-lis.

**DarkKnight** — Mediterranean woman in her thirties, tall, brooding, a cold
stare, menacing. Olive skin, black hair cropped short, a scar across one
eyebrow. Blackened steel plate armour with dull red trim, a tattered dark
cape. A long dark greatsword planted point-down in front of her, both hands on
the pommel. Faint purple wisps at the blade.

**Paladin** — Black man in his forties, broad and tall, noble and handsome,
a warm confident smile. Dark skin, short beard, close-cropped hair. Shining
steel plate with gold trim, white-and-gold surcoat with a sun. A war hammer in
one hand, a large kite shield with a sun emblem on the other arm.

**Wizard** — European man in his seventies, short and pot-bellied, one foot
forward, index finger raised mid-speech, mouth open. Rosy skin, long fluffy
white beard, huge eyebrows, wide blue eyes, a crooked midnight-blue pointed
hat with gold stars. Star-embroidered blue robe, belt with two flasks, curled
slippers. A gnarled staff crowned with an amber crystal, an open little book
on his belt.

**Witch** — Mediterranean crone in her seventies, hunched, cackling with a
gap-toothed grin, a bit macabre. Wrinkled olive skin, a hooked warty nose,
wild grey hair, one milky eye. Patched purple dress, a black pointed hat with
a bent tip, striped stockings. A crooked wand spitting a green spark in one
hand, a wicker basket of odd mushrooms and a tiny skull on the other arm; a
few golden stardust motes.

**Druid** — Elf woman, ageless and mature, tall and serene, eyes half closed.
Warm brown skin, long silver hair, pointed ears, a circlet of small antlers
and leaves. Layered robe of moss green and bark brown, bare feet wrapped in
vines. A tall spear of living wood with leaves sprouting at the head; a
pouch of healing leaves at her hip.

**IceLancer** — Nordic woman in her twenties, tall and still, cold aloof
look. Very pale skin with a blue tinge, white-blonde hair in a tight braid,
ice-blue eyes, frost on her lashes. Silver-blue scale armour with a white fur
mantle. A long lance of blue ice-crystal steel held upright, frost crystals at
her feet only on the boots, not on the ground.

**HolyWarrior** — South Asian man in his twenties, earnest and bright-eyed,
a determined smile. Brown skin, neat black beard, a white-and-gold turban.
Gold-trimmed white coat over mail, a sun medallion, tall riding boots with
spurs. A curved sword glowing faintly at the edge in one hand, a small
shovel on his back, a relic shard in a sunlit pouch.

**SavageWarrior** — Black woman in her thirties, huge and muscular, roaring a
battle cry, fierce. Dark skin, long thick braids tied back, white war-paint
stripes on her face. Fur and hide armour, bare strong arms with iron bracers,
riding boots with spurs. A huge two-handed axe raised, a splintered door
plank still stuck on the blade.

**Spymaster** — East Asian woman in her sixties, slim and elegant, a thin
knowing smile, sinister. Pale skin, silver hair in a severe bun with a hairpin
dagger, sharp eyes, thin eyebrows. A dark high-collared coat with a
crimson lining, gloves. A small hand crossbow held low; a folded map with a
wax seal in the other hand, a half mask hanging from her belt.

**ElectricArcher** — Southeast Asian man in his twenties, athletic, a cocky
grin. Golden-brown skin, black hair shaved at the sides with a spiky top, a
lightning-bolt scar. Sleeveless blue tunic with yellow zigzag trim, leather
bracers, sandals-boots. Drawing a bow whose arrow crackles with a small
yellow lightning bolt; golden motes spark off it.

**GoldenDragon** — A young-looking but ancient golden dragon, standing upright
on its hind legs like a person, the height of the others, wings folded, a
bored half-lidded look, one claw examining its nails. Chunky, friendly
shapes, gold scales with cream belly plates, little horns. No rider, no
treasure pile.

**VampireLord** — Pale aristocrat who looks fifty, tall and slender, a
charming villainous smile showing small fangs. White skin, slicked silver hair
with a widow's peak, red eyes, pointed ears. Long crimson coat with gold
buttons, a white cravat, black riding boots with spurs. A thin rapier in one
hand, a silver tray of glittering relic shards held up in the other.

**Necromancer** — Dark elf man, very old, gaunt and hunched, a creepy
thoughtful smile. Ash-grey skin, sunken cheeks, long thin white hair,
glowing green eyes, long pointed ears. Tattered black-and-purple robes, a
bone necklace. A staff topped with a small horned skull and a green flame;
the other hand raised with a wisp of green spirit smoke. Macabre, never gory.

**Pharao** — Egyptian man in his forties, broad-chested and proud, chin up.
Deep brown skin, kohl-lined eyes, a braided false beard. A blue-and-gold
striped nemes headdress, a gold collar, a white kilt, gold bracers, sandals.
A golden khopesh sword in one hand, a tall golden shield with a sun disc in
the other.

**ElvenPrincess** — Elf woman, young, graceful and gentle, a soft smile.
Warm brown skin, long pale-gold hair, a delicate leaf circlet, pointed ears.
Leaf-green dress with a short cream travelling cape, soft brown boots. A
slender spear with a golden leaf blade, and ONE small satchel — nothing else.

## 5. Sheets

Eleven sheets, three heroes each (the last has two). Sheet 1 is where the
cast's range is tested; say *"style LOCKED"* after it.

| Sheet | Heroes (left to right) |
|---|---|
| 1 | Rogue · Warden · Joker |
| 2 | Sellsword · Wizard · Scholar |
| 3 | Bard · RelicHunter · Cleric |
| 4 | Quartermaster · Cook · Merchant |
| 5 | Gardener · Priest · Adventurer |
| 6 | DarkKnight · Paladin · Witch |
| 7 | Druid · IceLancer · HolyWarrior |
| 8 | SavageWarrior · Spymaster · ElectricArcher |
| 9 | Scout · ElvenPrincess · Pharao |
| 10 | VampireLord · Necromancer · GoldenDragon |
| 11 | BeastkinHunter · ThreeMice |

Raw sheets are `../originals/hero-sheets/sheet-<n>.png`; `roster.png` beside
them is the whole cast at a glance. Two sprites do not follow the id: the
Sellsword is `hero_warrior`, Three Mice is `hero_three_mouses`.

## 6. Into the game

- Check the alpha: corner `srgba(0,0,0,0)`, alpha mean below 0.5.
- Cut and normalize with [`cut_heroes.py`](cut_heroes.py), naming the sprites
  left to right:

```sh
python3 Docs/art/portraits/cut_heroes.py Docs/art/originals/hero-sheets/sheet-1.png \
  hero_rogue hero_warden hero_joker
```

- It finds each figure as a connected blob (weapons overlap in columns, so a
  straight cut on thirds fails), trims it, fits it into 512×706 and stands it
  on the floor of a 512×768 frame, 20 px up — the frame every hero shares.

The file name is `HEROES[<id>].sprite`, so every screen that draws a hero
picks it up.

## Deliberately not in this design

- No mounts: a Cavalry hero wears riding boots and spurs, not a horse.
- No backgrounds, scenes, ground or glow: the card is the frame.
- No gore: macabre stops at skulls, bones and green smoke.
- No sexualised poses or outfits, for any hero.
