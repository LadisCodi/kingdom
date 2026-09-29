# Menus — UI/UX redesign brief & mockup prompts

> **What this is.** An audit of every menu in the web build as it stands
> (2026-09-01, `src/ui/`), what each one *should* show, and a paste-ready
> prompt pack for generating pixel-art mockups in ChatGPT.
>
> **What it is not.** An implementation plan. Nothing here changes the
> simulation — every number quoted below already exists in `src/sim/`.
> This is the visual and informational contract the menus should honour.
>
> Companion docs: [`../README.md`](../README.md) (the feature index),
> `art-direction.md` (world art),
> `reference.png` (on `archive/pixel-art-era`) (the style anchor).

---

## 0. How to use this

1. Read §1–§3 once. §3 is the **shared UI kit** — it is the thing that makes
   twelve separate mockups look like one game.
2. §5 is the per-screen spec. Design/implement from it directly.
3. §7 is the prompt pack. Run it as **one ChatGPT conversation** with
   `reference.png` attached to the first message, exactly like the sprite
   workflow that produced the v2 art set.

---

## 1. The problem

The simulation is cozy. The chrome is not.

The world is bright saturated pixel art — spring greens, cream cottages,
terracotta roofs, chunky pixels. The interface sitting on top of it is
`#10151c` slate with `#3a4757` hairline borders, 12px grey helper text,
right-aligned numeric metadata, and a dotted-edge node graph. That is the
visual language of a 4X strategy HUD. Three concrete symptoms:

- **The header is a spreadsheet.** Up to nine widgets — Gold, Food, Wood,
  Stone, Iron, Gems, Population, Builders, Free workers — wrap onto two
  rows on a phone, all in the same weight, none of them the thing the
  player is about to spend. *(Since fixed twice over: §5.1 cut it to coins +
  Mana + Gems, and the 2026-09-02 currency pass cut the coins themselves from
  six to four — see questions 3 and 7.)*
- **Menus are full-screen dark scrims.** Opening Build hides the kingdom
  behind `rgba(10,13,18,0.88)`. The player loses the thing they are playing
  with, and the menu is a list of rows, not a place.
- **Everything is a number.** `radius 2→3, worker cap →4`, `Power 6/20`,
  `Slots: 1 busy / 2`. Correct, dense, and unreadable at a glance — 4X
  players parse it, the audience for a cozy tapper does not.

The systems underneath are already approachable: one gesture (tap), one
close affordance, five buildable things at a time, a quest that points at
what to do next. The menus should stop hiding that.

## 2. Design principles

1. **The kingdom stays on screen.** Menus are bottom sheets over a live,
   dimmed-but-visible map — never opaque full-screen pages. The only
   exception is the Research tree, which is its own place.
2. **One primary action per screen.** Every panel has exactly one big
   green button. Everything else is smaller, quieter, or a tap target on
   the map.
3. **Show the outcome, not the stat.** `radius 2→3` becomes a diagram of
   the influence area growing. `+3 Wood every 8s` becomes a sprite of a
   worker with a wood icon and a small clock. Numbers stay, but they ride
   along with a picture.
4. **Nothing is greyed out without a reason attached.** A disabled button
   always sits next to one short sentence saying what unlocks it, in
   plain words: "Needs a bigger Townhall", not "Townhall lvl 3 required".
5. **Everything is a material you could touch.** The UI is made of warm,
   natural things — carved and painted wood, yellowed parchment and paper,
   rope, cloth, wax, brass, glass with something inside it — each drawn with
   its texture and lit from above, never a flat fill.
   - A symbol ON a piece is worked INTO the material: carved, engraved,
     embossed or stamped, never a flat glyph pasted on top (the close
     button's X is a groove in its red wood).
   - A pressed control is the same material pushed in, not a darker copy.
   - Colour comes from the material (red lacquer, green paint, gold cloth),
     not from a coloured shape.
   - No hairlines, no glass-morphism, no neon, no cold grey, no plastic
     gloss. When in doubt, ask "what is this made of?" — and draw that.
6. **Big, few, forgiving targets.** Minimum 44×44 px touch targets, ≥16px
   body text, ≥13px for the smallest helper line. Portrait-first (authored
   at 1125×2436 and scaled with the height, §3.6), one-thumb reachable:
   primary actions in the bottom third.
7. **The world is the menu where possible.** Tapping a building already
   opens its card; keep pushing interactions onto the map instead of into
   lists.

### Anti-goals (the "not a 4X" checklist)

| Avoid | Instead |
|---|---|
| A permanent bar of 9 resource counters | 3 contextual counters + a tap-to-expand purse |
| Tables of stats with `→` deltas | Before/after pictures, one delta line max |
| Dotted node graph on a dark grid | An illustrated map/board with landmarks |
| Grey disabled rows | Rows that stay warm, with a padlock and a reason |
| "Power 6/20", "Slots: 1 busy / 2" | "Your warband: 6 of 20 strong" with pips |
| Full-screen modal takeover | Bottom sheet, map visible above it |
| Tiny 12px muted helper text | 14–16px, warm brown, always a full sentence |

---

## 3. The shared UI kit

Everything in §5 and §7 assumes this kit. Lock it first — ideally as one
"UI style sheet" mockup (§7.1) before any screen mockup.

### 3.1 Palette

Derived from `reference.png` so the chrome and the world are the same game.

| Token | Hex | Use |
|---|---|---|
| `parchment` | `#F4E4C1` | Panel fill, card bodies |
| `parchment-shade` | `#E2CCA0` | Inset rows, alternating list bands |
| `wood` | `#A9713F` | Frame faces, headers, nav bar |
| `wood-dark` | `#5C3A1E` | 2px outlines, frame shadow side |
| `wood-light` | `#C89159` | Frame top bevel, highlights |
| `ink` | `#3B2412` | Primary text on parchment |
| `ink-muted` | `#7A5C3E` | Helper text, secondary rows |
| `leaf` | `#6FBF4A` | Confirm buttons, "affordable", progress fill |
| `leaf-dark` | `#3F8A2E` | Confirm button outline / shadow lip |
| `gold` | `#F2B233` | Highlights, CTA glow, rewards, quest accents |
| `gold-dark` | `#C98A16` | Gold outlines |
| `clay` | `#D4553E` | Can't afford, destructive, danger zone |
| `sky` | `#4FA3C7` | In-progress timers, research, information |
| `locked` | `#CBBA96` | Locked/unavailable fills (warm, never grey) |

Rule: **no pure black, no blue-grey, no #FFFFFF.** Outlines are
`wood-dark`, not black. Disabled is `locked`, not 45% opacity.

### 3.2 Surfaces

- **Panel** — parchment fill, 3px `wood-dark` outline, 8px carved-wood
  frame on all sides, 2px `wood-light` bevel along the top-left edge, 2px
  `wood-dark` along the bottom-right, corner radius ~10px, soft drop
  shadow. Bottom sheets have a small rope-or-notch grab handle at the top.
- **Card / list row** — parchment-shade fill, 2px `wood-dark` outline,
  radius 8px. Left slot always holds a **48×48 sprite or icon**, never a
  bare glyph.
- **Header strip** — carved wood plank across the top of a panel with the
  title in ink on a lighter inlay, optionally a hanging cloth banner.
- **Scrim** — when a sheet is open, the map dims to 35% warm brown
  (`rgba(60,36,18,0.35)`), never to near-black. The kingdom stays legible.

*2026-09-11 — the materials are pictures now.* `src/ui/styles/material.css`,
loaded last, paints the §7.21 sheets over the geometry above and changes
nothing else: parchment (`tex-parchment.jpg`) inside a nine-slice carved
frame (`frame-wood.png`, `border-image-slice: 80` at 16px, corners a little
proud) on every `.k-panel`; wood grain (`tex-wood.jpg`) on planks, the header
and the nav beam, parchment on the tabs; a rope grab handle and a rope
divider; the round knob as a picture (`deco-knob.png`); the district card in
the same frame, open where it meets the nav; the banner as cloth dyed by its
tone (`tex-cloth.jpg`, `background-blend-mode: multiply`); the quest scroll
pinned with a wax seal at its free corner (§5.2); parchment under the
research page and the build cards; every technology a wax medallion whose
colour is its state (`seal-*.png`, §7.22) with the name under it; the build
card laid out as M3 draws it — art at the left, name and promise beside it,
the price under both (`build.css`); the quest scroll with the M1 card's two
ends — a slot with the mark of what the quest is about, and the verb the tap
performs drawn as a slab ("Show me" / "Claim") while the whole scroll stays
the button; the research shelf in wood, its trails dotted sepia; the
Townhall's villagers as M2's row of faces — one round portrait per bed the
houses hold, the one in training under a sand-timer, free beds as empty
sockets, "+N" past eight — with the clock on the Train button; the header's
Mana as an orb resting on a slim gauge; nails at the corners of the nav beam
and the plaque (the two planks with bare corners — on a titled plank they read
as dirt); and the pennant flying from the quest scroll's corner in place of the
seal once the quest is done. The header is M1's: a wooden beam, one recessed
slot per resource (four coins at the left; Mana and Gems at the right, past a
hanging rope), the green `+` knob inside the Gems slot, the Mana slot filled as its own gauge with the pool
over it — while it fills, the pool and the next unit's countdown ("+1 in
4m 12s") take turns in the same place, 3 s each with a fade, and any change
to the pool shows the pool at once — and
the round Settings
knob hanging on a rope under the beam's right end. Every size on it is in
reference pixels (§3.6), budgeted so four four-character coins, the gauge, the
rope and Gems share one line at every width. The nav's
tabs are M1's wood plates on the wood beam — the same grain darkened, a lit
top edge, the word in cream with a shadow, a 26px mark — and the lit tab is a
gold plate that stands proud of the beam's top edge. `border-image` forfeits `border-radius`,
so the frame's rounding lives in the art. Dropping the one `@import` restores
the flat kit.

### 3.3 Buttons

Three materials, one silhouette — a rounded slab with a lip under its face —
nine-sliced so a label of any length fits.

- **Wood** for plain actions: the ones a player does, not the ones they want.
- **Paint** for everyday coloured actions — upgrade, train, build: one matte
  colour, a soft lighter band along the top, a darker lip, little texture.
- **Gemstone** for the premium and magical actions — buy a pack, cast a
  spell, open a pack, gacha calls, claiming a reward: polished stone in a
  thin gold bezel, a clean gradient, one soft highlight band.

Every colour comes in both finishes (`finish: 'paint' | 'gem'`). A colour is
painted by default; the `gem` kind (spends Gems) is a gemstone by default.

| Kit kind | Colour | Used for |
|---|---|---|
| `secondary` (default) | wood | Select, filters, amount picker, Buy with coins |
| `primary` | green · emerald | Build, Train, Upgrade, Start — the one green action |
| `blue` | blue · sapphire | watch a video, a free call |
| `gold` | gold · topaz | an advanced call |
| `destructive` | red · ruby | Reset, Cancel |
| `gem` | purple · amethyst | anything that spends Gems: Finish now, buy a slot |

Every material has four states (`src/ui/assets/btn-<material>[-state].png`,
`btn-paint-<colour>[-state].png` for paint):

- **Normal** and **pressed** — drawn (the pressed one is the same slab pushed
  in: no lip, face lower).
- **Highlight** (pointer over it) and **disabled** — derived from the normal
  art by `npm run art:buttons`: brighter and a touch warmer; drained toward
  a muted blue-grey. Derived, so all four share one outline.
- **Size**: one height (46 px), a floor on width (112 px) and a ceiling
  (144 px; 160 px for a priced button, frame included), so the slab is
  always drawn at its own proportions. A screen that stretches a button gets
  it at the ceiling, centred; a label longer than the ceiling widens its
  button just enough to fit, never cut. Anything taller than a label goes
  outside the slab.
- **Label**: light ink with a 1 px outline and a 2 px drop below, in a
  darker tone of the slab's own colour (dark green on green, dark brown on
  wood, slate on disabled).
- A disabled button keeps its **reason line beside it**.
- **Round** (`knob(glyph, …, { kind, finish })`, `knob-<material>[-state].png`
  and `knob-paint-<colour>[-state].png`): wood and every colour in both
  finishes, with the same four states, as a disc, for a one-glyph action —
  worker `−` / `+`, zoom. Drawn at the header's Gems `+` size (50 rpx) inside
  a hit area of at least 44 px. The glyph is carved into the face in a darker
  tone of the material, never a flat white sign. (The window's close is its
  own red button.)
- **A price's icon is the plank's coin size** (76 reference pixels, the
  header's `--slot-icon`) everywhere a price is written — above a slab, in a
  cost chip, on a button's face — and stands proud of its line rather than
  making it taller.
- **Priced**: the cost sits **above** the slab, outside it — icon + amount
  per term, any term the player cannot pay in `clay` — and the two are
  grouped on a small **section**; the whole is one press.
- **Sections** (`.k-section`): a flat panel a shade darker than the paper
  (`--section-fill`) in a flat 2-px outline (`--section-line`), rounded 10
  px — no bevel, no texture. It marks off a group of things inside a menu:
  a priced button, a stat tile, the district card's portrait.

### 3.4 Type & numbers

*Revised 2026-09-11. The pixel faces (BoldPixels for titles, m6x11plus for
everything else) forced 24px body copy and coarse size rungs that no phone
layout could fit; both are gone, and so is the PT Sans + Germania One pair
that replaced them.*

- **One family: Nunito**, self-hosted (`src/ui/fonts/`) — the face the mockups
  are drawn in. A title and a caption out of one family read as one voice;
  what separates them is the **weight**, not the family, so `--font-display`
  and `--font-body` name the same face.
- **Four weights are four roles**, and a rule names the role rather than the
  number:

| Token | Weight | Used for |
|---|---|---|
| `--weight-title` | **800** ExtraBold | headings — *Store*, *Heroes*, *Timber!* |
| `--weight-strong` | **700** Bold | buttons, amounts, names |
| `--weight-body` | **600** SemiBold | ordinary prose — the default on `<body>` |
| `--weight-small` | **400** Regular | the small description under it |

- **600 for prose is the point of the change.** On parchment at body size, Nunito
  Regular reads thin and SemiBold reads like the mockups; 400 is left to the
  helper line, where the *contrast* against the 600 above it does the work.
- **Text roles** — a menu names the role, never a size, so every window
  reads the same (`tokens.css`, held in order by `tests/fonts.test.ts`,
  which also refuses any literal under 11px and any bare weight outside the
  four faces):

| Token | Size | Used for |
|---|---|---|
| `--text-title` | 28px | a window's title, on its header band |
| `--text-body` | 17px | what the window is about: names, values, copy |
| `--text-desc` | 13px | the line that describes it: a description, a rate, a note |
| `--text-heading` | 13px | a section heading (small uppercase) |
| `--text-helper` | 13px | a caption or fine print: a tag, a badge, a timer |
| `--text-button` | 16px | a button's label |

- Tiny tags (a count on a slot, a timer on a portrait) may go to 11–12px;
  a sentence never does.
- Nunito is **a third wider than PT Sans** (~9.4px a character at 600 against
  ~7), so a line that used to fit takes more room. The one place it shows is
  a description clamped to two lines, which ellipsises — by design.
- Every number is set in the text face; Nunito's digits are one width at every
  weight, so counters do not jitter.
- Counters are always paired with an icon on the left.
- Big numbers get thousands separators; never show more than one decimal.
- Durations read as words at small values: `instant`, `8s`, `2m 30s`,
  `1h 05m`. Never raw seconds above 90.

### 3.5 Icons

*Revised 2026-09-10.* Every `IconName` is drawn on the five smooth sheets of
§7.18, sliced into a **64px-cell atlas** (`src/ui/assets/ui-atlas.png`,
`atlas.manifest.json` `cell: 64, smooth: true`). The atlas cell is a
**source**, not a display size: an icon is shown at whatever the layout asks
(`--icon-size`: 20 on the header coins, 24 in the nav and by default, 28 in a
list row, 16 inline) and is resampled smooth (`image-rendering: auto`). The
locked variant (desaturated toward `locked`) and the inline `-sm` cell are
still derived by the script, never drawn. No emoji anywhere —
`tests/icons.test.ts` holds the atlas to the kit's names.

### 3.6 Layout

- Full-bleed at any aspect ratio (`viewport-fit=cover`): a phone, a 3:4
  tablet, a desktop window. No pillarbox — a wider screen shows more map.
- **Reference resolution: 1125×2436** (the iPhone X, portrait). The UI scales
  like a Unity CanvasScaler **matching height**: one reference pixel
  (`--rpx`) is 1/2436 of the frame's height, so every piece keeps its share
  of the screen's height. The width is a ceiling: on a screen narrower than
  the reference (9:20, 9:21) the scale follows the width instead, so the
  1125-wide header always fits (Unity's "Expand"). Sizes are measured on the
  mockup scaled to 1125 wide.
- **Everything scales together.** Every size in the UI styles is either in
  `--rpx` or in `--px` — one CSS pixel of the reference phone (the iPhone X
  shown 402 CSS px wide, `--rpx × 1125/402`) — so text, buttons, tiles and
  gaps shrink and grow with the frame as one picture, and every device shows
  the same composition. A number written `calc(var(--px) * 17)` still reads
  as "17 px on the reference phone". Kept in real pixels: 1 px hairlines,
  the 44 px minimum tap area, the measured metrics (`--hud-h`, `--nav-h`) and
  `@media` / `@container` queries. The research page is not converted yet:
  its tree is laid out in pixels by code.
- Safe zones: the header is a 107-rpx beam (62-rpx slots, 30-rpx figures,
  76-rpx icon cells) plus the top inset
  (`env(safe-area-inset-top)`, reserved once, in `hud.css`); the nav is a
  beam of 57px painted plates (28px icons, 14px labels) with 4px above and
  below, plus the bottom inset (reserved once, in `nav.css`). Both are
  measured at runtime into `--hud-h` / `--nav-h`.
- Bottom sheets fit their content, capped at **70%** of the frame (decided on
  the board, 2026-09-11); only the research page, the heroes roster, the
  reliquary and the battle board are `tall`. **A card about something on the
  map frames it**: when the district or site card mounts, the camera centres
  the building in the band between the header and the card's top edge, once
  (`Camera.centerFootprintWithin`). A sheet sits `hud-h + 24px` below the top
  and `nav-h + 8px` above the bottom, with `--gutter` (12px) at the sides.
  Panel frame 9px (the P1 nine-slice) + 8px padding; plank 38px with the
  title centred and the close knob at its right end; rope grab handle 72×20
  riding the frame's top edge.
- Sizes are the mockups' at 402px (2026-09-11, measured on a 50px grid over
  M12, M5, M2, M6 and scaled ×0.472): slabs 40px (the mockups' ~38; 48 with a
  price), knobs 36–44, list rows 60px, store cards ~110px with a 100×88
  vignette, the daily pill 127×47, the builder plaque 30px, the quest scroll
  226 wide, the Townhall's portrait 104px and its villagers 40px, hero tiles
  3 across at 6px gaps with 13px ribbons and 20px feet. Where a mockup
  measures under 44px the mockup wins; a slab under a thumb still has 40.

### 3.7 Motion (spec only, no mockup needed)

Sheets slide up 180ms ease-out. Counters roll rather than snap.

**The window** (`.k-frame`, material.css; `k-window-*`, kit.css): every menu
that leaves the map in sight — each kit sheet, the district card — is one
simple panel of warm wood with rounded corners, a drop shadow all round to
lift it off the map, and warm cream paper with a very soft texture inside,
with a margin (52 rpx from the frame's outer edge) before the
contents start. Three pieces, each cut to slice
(`sheets/ui-window5-pieces.png`): the wood ring (nine-sliced, centre empty),
the paper (under the ring), and the header band. It is as wide as it is on
the iPhone X (1053 rpx: the reference width less the overlay's gutter),
centred — edge to edge on the reference phone, with the map showing either
side on anything wider. A centred modal keeps its own narrower cap. The
district card is the full reference width (1125 rpx): on the iPhone X the
wood of its sides touches the screen's edges.

- **In**: the contents hidden; the frame fades in and grows from its least
  height (its top and bottom slices, nothing between) to its full height in
  160 ms — from the foot for a bottom sheet, from the middle for a centred
  one; the contents fade in from 80% of the way (about 0.2 s in all).
- **Out** (closing back to the map): the contents fade out (60 ms), then the
  frame shrinks back to its least height and fades (140 ms); the window stays
  in the DOM, untappable, until it has. Switching straight to another menu
  is immediate.
- **The header**: every titled window has one — a wooden band seated on
  the top of the frame: standing 26 rpx proud of it and 22 rpx in from each
  side, so the frame's wood shows round it; fixed height (120 rpx),
  three-sliced in width (its
  rounded ends kept, the plain middle stretched). The title is centred on
  it, in a soft vertical gradient (pale cream to warm cream, lit from above)
  with a dark-wood outline; the buttons are anchored to its
  right, the close always last and any `actions` before it
  (`sheet({ actions })`). A window without a title (`bare`) has the frame
  and no band, and carries its own way out.
- **The close**: a round button of red lacquered wood with the X carved
  into it (kit `closeKnob`), the last button on the header. Its pressed twin
  is the same wood pushed in.
- **The district card's header**: the building's name and its level a size
  down (*Housing #3* *Lv 2*, `windowHead`'s `sub`), then Move (when the
  building can move) and Close. **Move** is the close's twin in
  wood — a round wood button with four-way arrows carved into it (kit
  `moveKnob`).
- **Spacing, the same in every menu** (`tokens.css`): the blocks of a
  window's content — the top row, the stats, each section — stand
  `--space-section` (14 px) apart; a section's heading sits
  `--space-heading` (6 px) above what it heads, and takes the place of the
  gap before its section rather than adding its own. The window's header
  band is a heading too: its content starts one heading gap under it.
- **Progress bar** (kit `progress(tone)`), one for the whole UI: a glass
  tube with coloured liquid in it, three painted layers drawn bottom to top
  — the **base** (the tube's dark inside), the **fill** (the colour, the
  tube's whole length, uncovered from the left so its level is a straight
  edge), and the **border** (the glass: outline and shine) — each sliced at
  its rounded ends (fixed height, stretched middle; `--bar-h` sets it). Its reading — a count, a time left —
  always sits INSIDE it, centred, never under or beside it. A timer's bar
  (`run`) moves smoothly, frame by frame, to full over the time left — the
  browser animates it, no script per frame. In light ink over a
  warm dark shadow (a drop and a soft halo), neutral on any fill. Four tones,
  one per meaning: **gold** a goal (quests, collections), **green** something
  being made (training, construction), **blue** a resource filling or a timer
  (Mana, research), **red** a danger or a countdown to one.
- **Tooltip** (kit `withTooltip`, any element): a tap opens a parchment
  bubble under its anchor, arrow up, with a soft pop (*Pop 02*); a second
  tap or a tap anywhere else closes it; one open at a time in the whole UI.
  It fades and scales in from the arrow (0.14–0.18 s) and out again (0.12 s).
- **Section headings** (kit `sectionHead`): a short rule, the label in small
  uppercase wood, then a rule to the edge — the settings menu's *Sound*. The
  district card heads each of its sections with one, shown only when the
  section is: what the building does — the unit it trains (*Warrior*,
  *Villager*), *Ward*, *Workshop*, *Residents*, *Workers*, *Crops*,
  *Harmony* — and *Neighbours* when an adjacency is in effect. The stat
  tiles have no heading.
- **The district card's head**: one row — the portrait, the description
  (bold, lighter ink), and Upgrade (the kit's default button, its fixed size)
  — each anchored to the top and growing down. The card lists no
  requirements: the upgrade popup shows each one and whether it is met.
  Upgrade wears the call to action when every requirement and every cost is
  met and a builder is free — the sim's `upgradeRefusal`, the same check the
  command runs. The portrait is a section with a small leafy ornament pressed
  into each corner, and the building drawn larger than the tile, clipped to
  it by a mask.
- **The training widget** (`trainingSection.ts`; reference
  `mockups/m28-training-widget.png`), one block for every building that
  turns something out — the Townhall's villagers, a hall's soldiers. Each
  building trains ONE thing, so there is no picker:
  - **Unit portrait** (kit `unitPortrait`, reused wherever a unit is shown
    round): three layers — a round paper base in a flat outline, a circular
    mask inside it, and the unit's bust drawn a little larger than the mask,
    so a bust that carries a medallion of its own has that ring cut away.
  - **Panel** (a section), headed by the unit's name on the section's
    rule: the round portrait with how many the player owns on a pill centred
    over its foot (*x17*: soldiers in the army, or the city's villagers), the tags,
    one line of flavour, and the priced
    Train button — its costs above it. The training time is the building's
    own stat tile (*Training*), one trainee per building.
    A soldier adds its three numbers — Attack, Defence, Health — as small
    tiles (the mark and the number, the name under them) under the portrait
    and the flavour, beside the Train button, which runs down past them; the
    bust rises out of the panel through its top edge, so the tiles' feet
    line up with Train's whenever the flavour is no taller than the bust. Any
    further stat takes a row of its own under both, the same tiles, four to
    the row. A gate keeps the button, disabled, and puts a padlock and a
    short reason where its price would be: *No house to live in*, *Max army
    reached*, *Needs Archery*.
  - **Tags:** a chip for the unit's type (blue: Melee, Ranged, Mounted;
    Worker for a villager). Tapping it opens the kit's tooltip with the type
    chart's word on it: *Strong vs Lancers, weak vs Archers*. One
    open at a time; paper chips are kept for special traits.
  - **Batch**, at the foot of the same panel: one building trains one
    unit, so its whole line is one batch — the unit's portrait with its
    count (*x5*); beside it *Training* over the bar (the time left inside
    it) and *Total time: 1m 20s* under it; and the gem Finish button,
    under a rule and with no heading of its own. Nothing in the line:
    *Nothing in training*, centred, and no Finish — at the same height as
    a batch, so the card does not jump when training starts or ends.
- **The workers block** (worker buildings; reference
  `mockups/m29-workers-stepper.png`, proposal B), a stepper:
  - the red − knob, the villager's round portrait, *2 / 3* — the crew in
    title type, the most it can hold smaller and muted — and the green + knob;
  - nothing else: the card's stat band leads with what the crew MAKES
    (*Food +45 /min*, the resource as the tile's word) and what there is to
    work, a tile per source in a short word (*Fields 3*, *Trees*, *Rocks*,
    *Iron*, *Gold*, *Shoals*). The crew size, haul and swing are the
    upgrade popup's only — the stepper already shows the crew, and haul and
    swing are counted in that output;
  - no tip: how many villagers a building's fields keep busy is the
    player's to see by watching them work;
  - the villagers still free to assign are the header's counter while the
    card is open — a plain count, not a share.
- **Stat tiles** (the district card's figures): one tile per figure — a big
  icon, then the SHORT name (bold, in ink; eight letters at most — *Range*,
  *Fields*, *Training* — so three fit a phone's width; the full name is the tile's
  tooltip and the upgrade popup's) over the value (lighter ink), at the
  building's CURRENT level only (the next level's value is the upgrade
  popup's). Each is a `.k-section` of darker paper, 112 × 58 px (narrower
  only where three would not fit), 14 px apart; three to a row, centred, a
  fourth wrapping to a centred row of its own.
- **Under construction** (a building being built or upgraded; reference
  `mockups/m36-construction-ab.png`, proposal A):
  - the head's Upgrade slot holds the gem Finish button with its price;
  - under the portrait: a slim blue bar with the time left inside it, laid
    over the tile's bottom edge;
  - under the description, centred at the foot of the head: what is being
    done, in one word (*Upgrading*, *Building*, or *Waiting* for a
    builder), breathing slowly between 75% and full opacity;
  - the painted hammer floats over the portrait, with no base, and works it
    in a loop, like a magic hammer: one blow at the right corner, a flight
    round in a loop over the picture and across to the left corner — keeping
    its bearing, never turning over — two small taps there, and an arc back. Each blow
    throws a few sparks where it lands. Still with reduced motion;
  - nothing else on the card changes, and there is nothing at its foot.
- **The upgrade popup** (the card's Upgrade opens it; reference
  `mockups/m35-upgrade-popup-final.png`), a centred window titled
  *Upgrade to Level 3*:
  - two portraits, the building at its current level and at the next, a
    yellow arrow between them, each with its level on a badge under it
    (*Level 2* blue, *Level 3* green) — painted enamel plaques, flat, no lip
    (`src/ui/assets/plaque-blue.png`, `plaque-green.png`);
  - *Improvements*: one row per stat that improves — its icon, its full
    name, its CURRENT value, and what the level adds as green text on the
    right (*x1.25* … *+0.25*, *ring 5* … *+2 rings*). A stat the level does
    not change is not listed;
  - *Requirements*, shown only when the level has any: one row each — its
    icon, what it asks, and a green tick or a red cross; an unmet row is red
    text on a light red row. Nothing links to where it is met;
  - the price and the build time over the Upgrade button. An unmet
    requirement locks the button (grey, a padlock) with *Complete all
    requirements to upgrade* under it. A short purse turns its price red and
    the button off with no line; with no builder free the line reads *Every
    builder is busy*.
- The nav bar steps aside while any window is open, the district card's
  included (§6.5).

**One call to action** (`kit/cta.ts`, `.k-cta`): every "there is something
for you here" in the game wears the same badge — a small scrying orb on its
host's corner, a red halo pulsing slowly behind it, a glint stirring inside
in stepped frames, and the count on it past one ("2" … "9", then "9+").

- Where: the nav tabs (Build, Research), a startable technology's seal, the
  daily and season pills, a hero tile with something to do, a claimable
  daily or season-pass cell and the pass's Claim, the vault, an affordable
  chest, a relic page ready to close, and the quest scroll when done. It
  replaces the glows, pulses, dots, ticks and "+" each used to have.
- No two orbs stir in step: each takes its phase from the page clock plus an
  offset of its own, keyed on what it marks, so a screen that rebuilds each
  tick does not restart it either. It pops in only when
  it appears on a host that persists (the nav, the pills, the quest scroll).

**A claimed reward flies into the header** (`ui/rewardFly.ts`): the quest
claim, the daily / season chests, and what the player's own TAP gathers — a
resource cell, a building's worked cells, a house's rent (crews' deliveries
and the rent tick land as numbers on the map only):

- It bursts from where it was claimed — the tapped cell, the tap that
  claimed it, or the centre of the screen — with a flash and, for a claimed
  reward (not a tap, which has its own sound), a powerup chime.
- Each resource in it leaves as N fragments of its icon: one per minute of
  the city's own production the reward is worth, at least 3, at most 12, and
  5 for a coin the city does not produce (Gems) or produces none of yet. A
  tap that gathered fewer than 5 flies one fragment a unit instead.
- Each fragment bursts out to a spot of its own, hangs, then flies in an arc
  into that resource's slot, 70 ms after the one before; a second resource
  leaves 180 ms after the first. Burst 260 ms, flight 620 ms, speeding up.
- The header counts the reward in as fragments land: each adds its share,
  the icon swells, sparks fly off it, and a tick plays — a coin for Gold and
  Gems, a pop for goods — each a shade higher than the last.
- Only what the plank shows flies; the wallet holds the reward from the
  instant of the claim either way. Reduced motion: no flight, the new totals
  just show.
Insufficient funds shakes **the counter**, not the button (already true).
Claim/complete pops a small burst of gold sparks. Nothing pulses forever
except the single lit CTA.

---

## 4. Screen inventory

| # | Screen | File | Kind today | Kind proposed |
|---|---|---|---|---|
| 1 | Resource HUD | `ui/header.ts` | Top bar, 9 widgets | Top bar, 3 coins + purse + 1 contextual plaque |
| 2 | Quest tracker | `ui/questPill.ts` | Card under HUD | Scroll card, unchanged shape |
| 3 | Banner / toast | `ui/banner.ts`, `#toast` | Top card, 5s queue | Cloth banner, 5s queue |
| 4 | Bottom nav | `ui/navbar.ts` | 4 buttons ⇄ Close | 3 carved tabs — **Build, Artifacts, Research**; Settings floats by the header |
| 5 | Build | `ui/buildMenu.ts` | Full-screen list | Bottom sheet, card grid |
| 6 | Placement | `ui/placementPanel.ts` | Bottom panel | Bottom sheet + map-first |
| 7 | District card | `ui/districtCard.ts` | Bottom panel, 5 variants | Bottom sheet, same 5 variants |
| 8 | Market | `ui/marketMenu.ts` | Full-screen list | Bottom sheet, stall scene |
| 9 | Research | `ui/researchMenu.ts` | Full-screen node graph | Illustrated board, own place |
| 10 | Army | `ui/armyMenu.ts` | Full-screen list | **Retired as a destination** — folded into the expedition sheet (§5.13) |
| 11 | Settings | `ui/settingsMenu.ts` | Full-screen list | Bottom sheet |
| 12 | **Welcome back** | *(missing)* | — | Modal on load, offline report |
| 13 | **Expedition** | *(new)* | — | Bottom sheet from a ruin: party, supplies, safe depth |
| 14 | **Checkpoint** | *(new)* | — | The delve's one recurring decision |
| 15 | **Reliquary** | *(new)* | — | Bottom sheet: attunement slots, relics, heroes |
| 16 | **Banner** | *(new)* | — | The gacha, reached from the reliquary — not the nav |

> **Amended 2026-09-02.** Rows 4, 10 and 13–16 come from the design pass in
> `Docs/features/` (`magic.md`, `expeditions.md`, `heroes-and-gacha.md`). The
> principles in §2 and the kit in §3 are unchanged and govern the new screens
> too.

---

## 5. Screen specs

### 5.1 Resource HUD

**Purpose.** Tell the player what they have, right now, without making
them read.

**Today** (`src/ui/header.ts`). Every currency flagged `primary` in the
balance workbook gets a widget: **Gold, Food, Wood, Stone, Iron, Gems**.
Then `👥 population current/max`, `👷 builders available/max`,
`🧑‍🌾 free workers`, and a cloud/local save badge pushed right. Food and
other currencies with equivalents show an *effective* total (Berries ×1,
Meat ×3, Fish ×1 all fold into Food) with a hover/tap tooltip breaking it
down. Currencies shake red when unaffordable.

**Problems.** Nine widgets wrap to two rows on a phone. All nine have the
same weight, so none of them reads. Stone and Iron are on screen from
minute one even though nothing costs them until Masonry/Mining. The save
badge is developer information occupying prime real estate.

*(Fixed twice. This section cut the widgets; the 2026-09-02 currency pass then
cut the currencies, so the equivalence tooltip described above no longer
exists — see questions 3 and 7, and
[`../features/03-economy.md`](../features/03-economy.md).)*

**Show this.**

- *Primary, always:* **Gold**, **Food**, **Wood** — the three that gate
  the early game. Icon + tabular value, large.
- *Primary, right side:* **Mana**, then **Gems** past the rope, and the
  `+` affordance on Gems kept as-is. *(Amended 2026-09-02.)* Mana was a
  contextual gauge on the row under the plank, shown only once the player had
  met magic — right when it only paid for relics. It now pays for **every
  tap**, so it is unconditional and it is pinned: the coins scroll inside
  their own share of the row, while Mana and Gems never leave the screen.
  A player whose tap just refused must be able to read why without scrolling
  the header, and Gems is what refills it.
- *Knowledge, always — a tab of its own under the plank (M33).* The bar
  paces the whole game, so it is prominent and never contextual
  ([`../features/07-research.md`](../features/07-research.md) §3):
  - A painted wooden tab with a gold-inlaid rim (`assets/hud-know-tab.png`,
    nine-sliced), **centred under the plank** as if it came out from behind
    it: straight bottom edge, rounded bottom corners, no point or decoration.
  - **Straight on the wood, with no dark slot round them**: the Knowledge book
    at the plank's icon size with nothing behind it, the number held, and
    **ten narrow tall segments** packed tight, one per point of the cap.
  - Under the segments, a small caption that **takes turns
    with a crossfade**, the way the Mana readout does: *+1 in 42m* (the next
    point) and *Full in 3h* (the whole bar).
  - **Full**: every segment lit with a soft glow, a glint on the book, and the
    caption reads *Full*. Over the cap (a lump, a purchase) the number reads
    what is held — *23* — and the segments stay all lit.
  - A **+** knob inside the tab, the same as the Gems', opens the Knowledge
    sheet; tapping the tab opens it too. The sheet is the bar and **three
    offers side by side**, each on a tile of darker paper — the building
    card's stat tile (`.k-section`) — set straight on the sheet, with no box or
    title round them, and the sheet a little wider than a centred sheet's
    default so the buttons can run nearly edge to edge: the amount on top as the book
    and a number, and the price on the button's face — 1 Knowledge for Gold
    (dearer every time), 1 for Gems, 10 for Gems. A till the player cannot pay
    goes dark.
  - About 100px wide at 375px, the segments ~3px each. A centred tab still
    leaves only 36px either side, so **the Daily chest pill starts below the
    tab** rather than beside it.
  - It **slides up behind the plank while any menu is open**, and back down
    when the menu closes (260 ms in, 220 ms out; none under reduced motion):
    it would hang over the top of every sheet. The Research book carries Knowledge on
    the plank instead, beside Gold.
- *Contextual:* **Stone** appears once its gating tech is complete (Masonry)
  or once the balance is above zero. The tech clause is what makes it sticky —
  a counter must not vanish when the player spends back to zero; the balance
  clause covers a quest reward arriving early. It slides in with a one-off
  banner ("Your quarry is bringing Stone home"). *(Amended 2026-09-02: Iron
  was the other contextual coin. It is no longer a currency — a vein is a rich
  Stone node — so the worst case here is one contextual coin, not two.)*
- *Purse (tap to expand):* the full wallet — four coins, Gems, and Knowledge
  once the player has met it. *(Amended 2026-09-02: this sheet existed largely
  to explain the Food equivalence, `🫐 12 × 1 = 12 🍎`. Bushes, game and
  shoals pay Food directly now, so there is no breakdown left to show and the
  sheet is a plain list.)*
- *City status — **one contextual slot**, not three permanent widgets.*
  A single small wooden plaque under the coins, showing whichever of the
  three numbers the player can currently act on:

  | When | Shows |
  |---|---|
  | ~~Default~~ | ~~**Population `n/max`**~~ — **moved to the world, 2026-09-02** |
  | A screen that can reassign workers is open (a worker building's card) | **Workers `working/free`** |
  | A screen that needs builders is open (Build, placement) | **Free builders `n`** |

  **Population left the HUD entirely (2026-09-02)** and is drawn on the map as
  a pill over the **Townhall**: `👥 current/max`, no portrait and no pips.
  The Townhall is where villagers are trained, so the number and the control
  that changes it are the same object — wanting more people and knowing how
  many you have became one glance instead of two. It also bought the header
  back the width the widget cost, which is what let Mana in. The plaque is
  therefore empty by default and hidden.

  Three permanent counters is exactly the spreadsheet problem this document
  opens with: builders only matter while you are queueing something, and
  free workers only matter while you are staffing something. Showing the
  one that is live turns three pieces of trivia into one piece of advice.
- *Move out:* the save-mode badge belongs in Settings.

**States to mock.** Default (3 coins + Mana + Gems, no plaque), expanded
purse, a counter mid-shake in `clay`, Stone appearing for the first time, the
plaque in its two remaining states, and the population pill over the Townhall.

**Narrow screens.** Eight widgets do not fit a 390px row, which is the problem
§5.1 opened with — so the row never wraps. The coins scroll horizontally
inside their own box and everything from Mana rightwards is pinned, and below
560px the Mana gauge drops its `+N/h` rate: "how full is my pool" is the
number a refused tap sends you to read, and the rate is not it.

---

### 5.2 Quest tracker

**Purpose.** The single answer to "what do I do now?" — the most important
UI element in the game for a new player.

**Today** (`src/ui/questPill.ts`). An always-open card under the HUD:
`📜 <name>`, description, a progress bar with `value/goal`, a reward line
(`Reward: 30 🪙 · 2 💎`), and one button — **Claim** (green CTA) when
complete, otherwise **🔍**, which navigates to wherever the quest is
progressed (opens the right menu, or closes menus, centres the camera and
drops a bouncing 👇 hint on the exact element). It hides whenever any
sheet, panel or placement mode is open, and retires when the chain ends.

**Problems.** It is the best-designed thing in the build and it looks like
a debug readout. `🔍` is not a word. The reward is text where it should be
loot. There is no sense of a chain — the player cannot see that this is
quest 3 of 12, so completing one has no arc.

**Show this.**

- Quest name, as a title on a small unrolled scroll / hanging cloth.
- One-sentence description (already good — keep the voice).
- Progress: bar **plus** `4/10` **plus**, where the goal is countable and
  small (≤10), a row of pips/stamps that fill in.
  *(Revised 2026-09-02: one read-out for every goal — the bar, with the count
  written inside it. The pips meant the widget changed SHAPE from quest to
  quest, so the player had to re-find the number each time, on the one element
  whose whole job is to be scannable at a glance.)*
- Chain position: `Quest 3 of 12` or twelve small notches — `questInfo()`
  already returns `index` and `total`, and it is currently unused by the UI.
- Reward as **icons with counts**, not a sentence: the coin sprite, the
  gem sprite, sized to feel like a prize.
- The `🔍` button becomes a labelled secondary button: **"Show me"** with a
  small pointing-hand icon.
- When complete: the whole card gets a gold rim and a gentle bob; **Claim**
  is the only green thing on screen.

**States to mock.** In progress, complete (gold rim + Claim), and the
final claim ("The chain is done" — today the tracker simply vanishes,
which deserves a one-off celebratory card instead).

#### Revised 2026-09-02 — the card IS the button

The two controls above are gone, and so is the wax seal. At any moment
exactly one of "Show me" and "Claim" was live, so the other was furniture,
and both competed for taps with the card that was already the biggest target
on screen. **Tapping the card does the only thing there is to do**: point you
at the goal while the quest is running, take the reward when it is done. The
finished state styles the whole widget as the claim button, so what to press
needs no label.

The **reward only appears once the quest is complete**. It is not a decision
the player makes beforehand, so showing it early spends space on something
they cannot act on — and its arrival is what makes finishing feel like a
payout.

It also **moved to the bottom left**. The top of the screen belongs to the
resource bar and to the fog the player is tapping; the thumb lives at the
bottom, and the widget is now a button that wants to be reachable.

#### The scroll (M1)

- Sized in reference pixels (§3.6): 520 × 200 rpx while a quest runs (it
  grows with the words),
  25 rpx from the left edge, 20 rpx above the nav. The dials sit on `#quest`
  in `quest.css`.
- The parchment between two rollers is one nine-sliced piece, so both width
  and height stretch; the trough and its gold fill are painted and sliced at
  their rounded ends.
- **Running**: the title and description; under them, the goal's mark resting
  on the start of the trough, which runs to the right roller. There is no
  control on it: a tap anywhere on the scroll points at the goal.
- **Done**: the scroll shows only the reward — each prize an icon and its
  count, no label, no chip — and a green **Claim** slab under it, shrunk to fit; no title, mark, description, trough or magnifier.
- **The wood button** is one painted slab and its pressed twin, worn by every
  wood-coloured button in the game. A slab recoloured to another tone, and a
  locked one, keep the kit's flat fill.
- **A new quest unrolls**: the parchment fades in and widens rightwards from
  its left roller (520 ms), and the words fade in from 360 ms, just before it is
  fully open — with the scroll-open sound.
- **A claimed quest rolls up**: the words fade out (160 ms), then the
  parchment narrows back to its left roller and fades (420 ms) — with the
  scroll-close sound. A claim that hands over the next quest plays both,
  **0.5 s** apart. Nothing on the scroll can be tapped while it moves.
- A quest that arrives while a sheet covers the map unrolls when the map
  comes back.
- Done also glows gold round the parchment and bobs gently.

---

### 5.3 Banner & toast

**Purpose.** Two channels: *good news you should enjoy* (banner) and
*why that didn't work* (toast).

**Today.** `ui/banner.ts` shows one card at a time for 5s, queued, with a
chime: an icon, an uppercase gold `TITLE`, a bold name and a description —
used for first-time discoveries, construction/upgrade complete, research
complete, new building/upgrade/unit unlocked. Tap anywhere to dismiss.
`#toast` shows plain grey text for 2.6s for failures: "Build queue is
full", "No free workers — buy population", "All research slots are busy",
"Research Masonry to explore this terrain".

**Problems.** Both are the same slate rectangle. Good news and bad news
should not look alike. Toasts appear at `top: 64px` where the quest card
also lives.

**Show this.**

- **Banner** = a hanging cloth/pennant that drops from the top edge, gold
  rope, the subject's **sprite** (not its emoji) at 64px, `TITLE` on a wax
  seal, name in display type, one-line description. Variants by kind:
  discovery (gold), construction complete (leaf), research complete (sky),
  unlock (gold + sparkle).
- **Toast** = a small parchment slip low on the screen (above the nav bar,
  clear of the quest card), `clay` left border, one sentence, no icon,
  fades in 2.6s. Failures must never overlap the celebratory channel.
- Both keep the existing queueing and tap-to-dismiss.

---

#### The banner (M1)

- A painted cloth hanging from a wooden rod under the header, ending in a
  point; gold for something new, green for something built, blue for
  something learned. Fixed width (420 rpx: the point cannot stretch
  sideways), nine-sliced vertically, so it is as tall as its words. The dials
  sit on `.b-pennant` in `banner.css`.
- Top to bottom: the subject's art, what happened, its name, a line about it.
- **In**: the words hidden, the cloth fades in and grows from its rolled
  height (the rod and the point, nothing between) to its full height in
  520 ms; the words fade in from 80% of the way.
- **Out** (after 5 s, or a tap): the words fade out (160 ms), then the cloth
  shrinks back to its rolled height and fades (420 ms). Banners queue, one at
  a time.

### 5.4 Bottom nav

> **2026-09-10.** The bar carries **five** tabs — Store · Relics · Heroes ·
> Research · Build — at **52px**: a 24px icon over a 12px label, the bottom
> inset added underneath. Store and Heroes arrived after the three-tab
> argument below was written and each passed the "visited on its own
> schedule" test of `ui-long-game.md` §1; what the argument still buys is the
> size — five tabs fit a 402px frame only at this density. The rest of this
> section is the history of the bar and stays as it was written.

**Purpose.** Reach the three places; leave any of them.

**Today** (`src/ui/navbar.ts`). `🔨 Build`, `🛡️ Army`, `🔬 Research`, `⚙️`.
The Build button lights green and pulses when at least one uncapped
district is affordable *and* has a legal cell. **When anything dismissible
is open, the entire bar is replaced by one wide `✕ Close` button.**

**Problems.** The single-Close pattern is elegant and should stay in
spirit, but it means the player cannot go Build → Research without two
taps through the map, and the nav disappearing is disorienting the first
few times. Also `⚙️` is an unlabelled fourth item at the same weight as
the three real destinations, and Market — a real destination — is only
reachable by finding and tapping the Market building on the map.

**Show this.**

- **Three** carved wooden tabs with pixel icons **and labels**: **Build,
  Artifacts, Research**. Active tab is raised and lit.

  > **Changed 2026-09-02.** The third tab was Army. An army only matters at the
  > moment it is sent somewhere, so it is configured inside the expedition sheet
  > (§5.13) and loses its standing destination — the same reasoning that moved
  > Settings off the bar. **Artifacts** takes the freed tab: it is opened every
  > session to weigh a relic's Mana upkeep against its passive, which is exactly
  > the test a tab has to pass. See `Docs/features/08-magic.md`.
- **Settings leaves the bar.** It is not a destination with the weight of
  the other three, and giving it an equal tab flattens the hierarchy — it
  is a drawer you open twice a month, sitting next to the thing you tap
  every session. It becomes a **floating icon-only wooden knob just below
  the header, outside it**, at the top right. Three tabs also widen each
  remaining one, which is the right direction for thumb reach.
- Top right is the free corner: the quest scroll owns the top left. The
  banner is centred and can reach across on a narrow screen — let the
  banner win, it is transient and tap-to-dismiss.
- Keep the lit-CTA behaviour on Build (gold glow + a small sparkle, not a
  brightness pulse).
- **Replace the swap-to-Close with a persistent nav plus a close affordance
  on the sheet itself** — a wooden `✕` knob at the sheet's top-right, plus
  tap-the-scrim-to-close, plus swipe-down. Tapping another tab switches
  sheets directly. (This is a behaviour change; it is the single biggest
  navigation improvement available and costs one small refactor of
  `dismissible()`/`dismiss()`.)
- Consider surfacing **Market** as a fourth tab once it is built, rather
  than making it the only building-only entry point. *(2026-09-02: with
  Artifacts taking the third tab and expeditions opening from ruins on the
  map, the bar is full. Market staying a building-only entry point is now the
  consistent answer, not a compromise — the map is the menu, §2.7.)*

---

### 5.5 Build menu

**Purpose.** Choose what to add to the kingdom.

**Today** (`src/ui/buildMenu.ts`). Full-screen list, title "Build", one row
per district in `CITY_DEF.buildMenuOrder`, **hiding** anything whose
`requiredTech` is unresearched (deliberate — the tech tree is where you
discover buildings). Each row: emoji glyph, name, description, cost +
`⏱ duration` at distance 0, a `Select` button, and `count/maxCount` — or,
when capped, `Townhall lvl N required` / `Maxed out`. Rows dim when capped
or unaffordable. A quest hint can highlight one row.

**Problems.** It reads as a build order table. The most interesting fact
about each building — *what it will do for you* — is a 12px grey line. The
cost is "indicative at distance 0" and then changes in the next screen,
which quietly teaches the player not to trust numbers.

**Show this.**

- **Cards, not rows** — a 2-column grid of building cards, each with the
  building's actual **level-1 sprite** on a small grass plot (art already
  exists in `src/render/assets/`).
- Per card: name; one-line promise in plain language ("Villagers live
  here and pay taxes"); cost as **icon chips** (`🪵 20  🪨 10`), each chip
  turning `clay` when short; build time with a small hourglass;
  `owned 2 / 4` as filled pips rather than a fraction.
- Cap-blocked cards keep full colour, add a padlock ribbon and the plain
  sentence **"Needs Townhall level 3"** with a tiny Townhall icon.
- Optional grouping headers once there are more than six: **Homes ·
  Harvest · Trade**. Do not add tabs before that.
- Keep hiding tech-locked buildings, but add one **"More to discover"**
  card at the end that opens Research. Right now the menu silently grows
  and the player never learns why.
- Selecting a card goes straight to placement — keep it.

---

### 5.6 Placement

**Purpose.** Put the building somewhere good, and understand why one cell
is better than another.

**Today** (`src/ui/placementPanel.ts` + map markers). A bottom panel:
`🌾 Place Farm`, the description, then rows for **Cost** (exact, for the
selected cell), **Time**, **Cell** `(x, y) — tap the map to move`, and for
harvesting buildings **`Crops cells captured: N`** (red at 0). A green
**Build** button, disabled when unaffordable or when no legal cell exists.
The map shows a ghost preview and marks every legal cell; the camera
auto-centres on the closest legal cell to the Townhall.

**Problems.** `(x, y)` is debug output. "Crops cells captured" is the most
important number on the screen and it is the fourth row. The panel eats
45% of the screen at the exact moment the player needs to look at the map.
And the ghost can only be *tapped* into place — the one gesture every player
will try first, dragging it, pans the camera instead.

**Show this.**

- **Shrink the panel to a single bar** across the bottom: sprite, name,
  cost chips, time, and the Build button. Everything else moves onto the
  map.
- On the map, over the ghost: a **big count of what this spot captures** —
  `🌲 ×4` in a floating parchment tag, changing live as the player moves
  the ghost. That is the placement decision, made visual.
- Draw the **area of influence** as a soft translucent leaf-green overlay
  around the ghost, with captured resource cells highlighted and
  uncaptured ones dimmed.
- Replace `(x, y)` with nothing. Replace "tap the map to move" with a
  one-time coach line the first time only.
- **Make the ghost draggable, and keep the tap.** Both gestures move it:

  | Gesture | Result |
  |---|---|
  | Drag starting **on the ghost** | The ghost follows your finger; the camera stays put |
  | Drag starting **anywhere else** | Pans the camera, exactly as today — you need this to reach distant cells |
  | Tap any legal cell | The ghost jumps there, exactly as today |

  The ghost lifts slightly while held (a little scale and a shadow), snaps
  to legal cells only — if you drag over illegal ground it stays on the
  last legal cell rather than falling off — and **dragging never commits**.
  Build stays an explicit button press, because confirming spends
  resources. On touch the finger covers the ghost, so carry the grab offset
  rather than centring the ghost on the pointer, or it teleports on pickup.
- Quality feedback in words: **"Good spot"** (≥ 3 captured) /
  **"Poor spot — no Crops nearby"** (0 captured), in leaf or clay.
- Keep Build disabled + a reason chip when unaffordable: "Short 12 🪵".

---

### 5.7 District card

**Purpose.** Everything you can do to one building, in one place. This is
the most-used panel in the game and the most overloaded.

**Today** (`src/ui/districtCard.ts`). A bottom panel opened by tapping a
built district; it shows `<glyph> <Name>` + `lvl 2/3`, then a stack of
conditional widgets, then an upgrade or in-progress block. Five variants:

| Variant | Condition | Contents today |
|---|---|---|
| **Townhall** | `definitionId === 'Townhall'` | Training progress bar (`+1 👥 in 42s`, `· 2 more queued`), "Tap the Townhall to add +5s of training per tap", and a **Train** action row: `Train villager — 20 🍎 (60s)` or `Population at max — build more Housing` |
| **Housing** | `districtCapacity > 0` | `👥 residents 3/4`, `💰 taxes 1.5 🪙/min`, `Neighbors +0.3/min` (adjacency, red when negative), plus "Nobody lives here yet — train villagers at the Townhall" or "Tap to fast-forward tax collection — +5s per tap" |
| **Worker building** | has `harvestSource` + worker slots | `Area of influence: radius 2`, `Forest cells in range: 4`, `Per delivery: +3 🪵 every ~11s`, a `Workers 2/3` row with `−`/`+`, and a live activity line `💤 waiting · 🚶 heading out · ⛏ working` |
| **FarmLands** | `definitionId === 'FarmLands'` | One line: "Tap for +2 🍎 — exhausts after 5 taps, recovers in 120s" |
| **Busy** | a queue item targets it | Progress bar (`1m 20s left` or `waiting for a builder`), `Finish now — 8 💎` + **Finish**, and for builds `Cancel construction — full refund` + **Cancel** |

When idle and below max level it instead shows the upgrade block:
`Upgrade to lvl 3 — 40 🪵 + 20 🪨 (2m)`, delta subline
`radius 2→3, worker cap →4` or `residents 4→6`, and blockers
`Townhall lvl 3 required` / `Research Masonry required`.

**Problems.** Five variants share one undifferentiated stack of rows, so
every building looks identical. The panel is a wall of small text at the
exact moment the player wants to feel proud of a thing they built. The
building's own sprite never appears. The upgrade delta — the reason to
spend — is a 12px grey subline.

**Show this.** One shell, five clearly different personalities.

*Shared shell*
- **Portrait slot**: the building's actual sprite at its current level, on
  a small parchment vignette, top-left. Beside it: name, and level as
  **filled stars/pips** `★★☆` rather than `lvl 2/3`.
- **A single "what this does" line** in ink, always present.
- **One primary action** at the bottom right: Upgrade / Train / Finish.
- Everything numeric lives in **stat chips** (icon + number + unit), not
  label/value rows.

*Townhall* — the training queue is the star: a row of villager silhouettes
filling in, the timer on the front one, `+2 queued` as stacked pips. The
tap-boost hint becomes a small animated pointing hand over the building
sprite, not a sentence.

*Housing* — show **residents as little people icons** filling beds
(`3/4`), and taxes as a coin-drip: `1.5 🪙 per minute`. The adjacency
bonus becomes a badge — "Cosy neighbourhood +0.3" (leaf) / "Crowded −0.2"
(clay) — with a one-line explanation on tap.

*Worker building* — a **mini-map thumbnail** of the influence radius with
captured resource cells lit, replacing `Area of influence: radius 2` and
`Forest cells in range: 4`. Workers get a row of worker portraits: filled
= assigned, empty = free slot, with the `−`/`+` knobs at the ends; each
portrait carries its live state as a tiny icon (waiting / walking /
working / carrying) instead of a text list.

*FarmLands* — a plot illustration with a taps-remaining pip row
(`●●●○○`) and a recovery clock when exhausted.

*Busy* — the progress bar becomes a **scaffolding banner** across the
portrait; "waiting for a builder" gets a queued-builders icon so the
player understands the constraint. Gem finish is the `sky`/violet gem
button with the cost on the button itself.

*Upgrade block* — a **before → after strip**: the current sprite, an
arrow, the next-level sprite, and beneath it the one or two things that
actually change, as icon deltas (`radius ●● → ●●●`, `👷 3 → 4`,
`🛏 4 → 6`). Cost chips, time, and the green Upgrade button. Blockers are
a padlock line in plain words: **"Your Townhall must reach level 3"** /
**"Research Masonry first"** — the latter tappable, jumping to that node.

---

### 5.8 Market

**Purpose.** Turn a pile of surplus into Gold.

**Today** (`src/ui/marketMenu.ts`). Opened by tapping the built Market.
Full-screen: title, "Trade surplus goods for Gold — sales are instant."
plus "Market Stall bonus: +15% prices" when the upgrade is bought. An
amount selector — `x1 / x10 / x100 / x1.000 / All` — then one row per
sellable currency: icon, `Wood — 3 🪙 each`, `You have 42 · selling 10
pays 30 🪙`, and a **Sell** button (disabled at 0).

**Problems.** It works and it is legible; it is just a table. `x1.000`
uses a European separator inconsistent with the rest of the UI. The
Market Stall bonus — a thing the player *bought* — is a parenthetical.

**Show this.**

- Frame the sheet as a **market stall**: awning header, goods on a
  counter. Each sellable resource is a **crate/basket card** in a
  2-column grid with the goods sprite, `you have 42`, and the unit price
  on a little wooden price tag.
- Amount selector as chunky wooden toggles; fix `x1.000` → `x1,000`.
- The payout is the loud part: on each card, `→ 30 🪙` in gold display
  type, updating live with the selected amount.
- **Market Stall bonus** gets its own ribbon across the header:
  "Market Stall: +15% prices" with the upgrade's icon — it should feel
  like a reward that is still paying out.
- Sell animation: goods fly off the counter, coins fly to the HUD.
- Add a quiet **"Sell all surplus"** affordance only if playtests show
  the per-row flow is tedious; do not add it pre-emptively.

---

### 5.9 Research

**Purpose.** The long-term "what's next" — and the only place buildings
and units are discovered.

**Today** (`src/ui/researchMenu.ts`). A full-screen dark canvas holding
one unified tree, drag-pannable in both axes:

- **Technologies** — 56px square nodes on a hand-authored grid, joined by
  dotted orthogonal connectors. **Both the grid and the hand-authoring are
  going** — see the reshape note below. States: `done` (green rim), `active` (blue
  rim + a thin progress bar inside the node), `available` (gold rim), and
  **`silhouette`** — a dashed, 40%-opacity `?` for a tech exactly one step
  beyond something researched or researching. Anything deeper is not drawn.
- **Upgrades** — 36px circles fanned below their *completed* parent tech,
  with a level badge; instant Gold purchases.
- **Top bar** — "Research" and `Slots: 1 busy / 2`, plus
  `extra slot — 25 💎` + **Buy** when below `maxSlots`. *(Going: research has
  no slots and no time any more — [`../features/07-research.md`](../features/07-research.md)
  §1. The sheet is M30, upper: Invest, Buy the rest, Research.)*
- **Info panel** (`.tech-info`) — floats above the nav bar only while a node is
  selected. **Being replaced by a centred sheet** — see the reshape note.
  Tech: glyph, name, description, `Requires Forestry ✓ / Masonry ✗`, then
  either `Researched ✓`, a countdown bar, or a cost line
  `40 📜 · ⏱ 2m — all slots busy` with **Start**.
  Upgrade: `Tap Power — Lv 2/5`, description, level pips, and
  `120 🪙 · instant` with **Upgrade**.

**Problems.** This is the screen that most says "4X". A dotted node graph
on a dark grid *is* the Civilization tech tree. It is also the screen with
the best content — the silhouette fog and the upgrade fans are genuinely
good ideas that just need a different costume.

> **RESHAPED 2026-09-03.** The screen stops being one pannable canvas and
> becomes **six vertical tomes behind tabs**, three columns wide, with branch
> and join nodes — the structure is
> [`../features/07-research.md`](../features/07-research.md) §2.2 and it is
> **design, not presentation**: the layout is derived rather than authored, so
> nothing below may reintroduce a free 2D canvas. Everything else in this
> section still describes the right costume.

**The layout, which is now fixed:**

- **Three tabs across the top, one per tome** — **Civics · Warfare · Magic**.
  Three is what fits a phone, which is why the reference uses three and why the
  shelf was cut to three: **the tab strip needs no scrolling and no second row**,
  so nothing on this screen moves sideways at all.
- **The page scrolls vertically and only vertically.** Drop horizontal pan.
  Keep the hint auto-scroll and selection-clears-on-empty-tap.
- **At most three parallel columns**, with **spine nodes** at full width where
  the columns fan out (branch) and converge (join).
- **A tier is a band, not a page.** You scroll from *Civics I* through its
  columns to *Civics II*. **The next era is visible above the fold before it is
  reachable** — draw it dimmed rather than hiding it, because the scroll is the
  pull.
- **Connectors are V–H–V**: down out of the parent, a rail in the gap between
  rows, down into each child. Sibling edges from one parent **share the rail and
  read as a single bar** — that is the reference's look and it falls out of the
  geometry.

**Tapping a node opens a centred sheet over the tree** — the content is the
feature doc's §5.2, and it replaces `.tech-info`, the floating card pinned above
the nav today. **The primitive already exists**: `sheet({ centred: true })` in
`kit/surface.ts`, whose own docblock sanctions exactly this case, plus `scrim`,
`panel`, `plank`, `card`, `meter` and `costTerms`. So the whole sheet is
assembled from the kit with **one addition** — see below.

- **Header plank**: title on the left-to-centre, the sheet's own `✕` knob on the
  right. Drop the reference's second `(!)` button beside the meter: if the bar
  carries the Knowledge icon it needs no explainer, and requirements are already
  tappable medallions.
- **The dim is already there and must not be doubled.** `#overlay` carries
  `background: var(--scrim)` for the research screen itself, so a second scrim at
  full strength over the tree reads as mud. **Blur the tree behind the sheet
  rather than darkening it twice** — the reference does exactly that, and it
  keeps the shape of the page legible underneath, which is what tells the player
  they are still on the same page.
- **The header and nav bar stay above the sheet**, which is the stack's standing
  rule and names this screen as the reason it exists (`src/style.css`). The
  reference agrees: its currency HUD sits above the dim while the modal sits
  under it.
- **Actions are one row of slabs at the bottom**: `Pour ▸ 18 📜` beside
  `Finish ▸ 💎 4`, becoming a single `Research ▸ 500 🪙 · 2m` once the pour is
  full. `costTerms` already turns an unpayable term clay, **which is the reason
  the button is disabled and means no separate reason line is needed.**
- **No `Intentos:` row and no cooldown line.** The reference meters pouring with
  attempts that refill on a timer; the feature doc §5.3 rules it out.

**One new kit primitive, and it is the most valuable block on the sheet:**

```
delta(label, from, to) →   Tap Power        +40%  →  +60%
```

A label, the current value, an arrow, and the value after this purchase in the
**leaf** tone. Nothing in `kit/stats.ts` does this — it has `stat`, `pips`,
`meter`, `chip`, `costTerms`, `costChips` and `progress`, all of which say *what
is*, and none of which says *what changes*. **Every levelled thing in the game
wants it**, not just upgrades: a district card's level-up, a relic level, a
collection tier. It should be born in the kit rather than in this screen.

**Two state axes that are easy to conflate, and both are needed:**

| Axis | What it says | Drawn as |
|---|---|---|
| **Tree fog** (§1.3 of the feature) | *does the player know this exists* | the silhouette — a fold in the parchment with a `?` |
| **Reachability** | *can the player pour into it yet* | **desaturated** — inked but colourless, the way a locked node greys out in the reference |

A node can be known and unreachable, which is the common case and the one the
current screen cannot express.

**The node itself carries its pour**, which is where the reference's `1/5` badge
maps onto Kingdom: a technology shows **`12 / 40`** on the medallion — the
Knowledge committed against what it needs (§3.4). That badge is the single most
important thing on the screen, because it is the only place the clock is
legible.

**Show this.** Keep every mechanic. Change the metaphor from *graph* to
*a map / an illuminated manuscript*.

- Background: an aged parchment map with a faint drawn landscape, not a
  dark grid. Connectors become **inked paths / dotted trails** in sepia;
  completed paths are gold-inked.
- Tech nodes become **wax-sealed medallions** with the tech's pixel icon:
  gold seal = available, green wax = researched, blue with a sand-timer =
  in progress, and the silhouette becomes a **fold in the parchment /
  scorched corner with a `?`** — mysterious, not disabled.
- Upgrade circles become small **badges pinned below** their medallion,
  with a pip row for level instead of a numeric badge. **They live in the row
  gap, centred under the parent, at most two across and wrapping to a second
  rank** — three across overflows a column, and Forestry already has three
  (feature §6.6).
- Slots: draw them as **desks/lecterns** — `🕯 1 of 2 scholars busy` with
  an empty stool for the free slot and a "hire another scholar" gem
  button for the purchase. That single change turns an abstract concurrency
  limit into a thing the player can picture.
- Info panel: same content, on parchment, with the reward made explicit —
  **"Unlocks: 🏪 Market"** with the building's sprite, which the code
  already knows (`requiredTech` on districts, units and upgrades) but the
  panel never says. This is the single most valuable missing piece of
  information in the whole UI: today the player cannot tell what a tech
  gives them until it finishes and a banner announces it.
- Requirements: `Requires Forestry ✓` becomes a small medallion thumbnail
  with a tick, tappable to pan there.
- Keep the hint auto-scroll and selection-clears-on-empty-tap. **Drag-pan
  becomes vertical-only** — see the reshape note.

---

### 5.10 Army

> **RETIRED as a destination, 2026-09-02.** Everything below still describes the
> right *presentation* — portrait cards, aspirational locked units, shield pips,
> "Recruit" not "Train" — but it stops being its own screen. Recruiting moves to
> the four military training buildings' district cards (Barracks, Spear Hall,
> Shooting Grounds, Stables), and party composition happens in the expedition
> sheet (§5.13) where it is actually a decision. Two notes that now bind:
> **unit portraits stop being optional** (units gain ATK/DEF/HP and a matchup
> chart, so the player must tell them apart at a glance), and the header line
> "Your Townhall can't support more" is wrong — the cap comes from the military
> buildings. See `Docs/features/11-expeditions.md`.

**Purpose.** Spend surplus on power; a long-term goal placeholder today.

**Today** (`src/ui/armyMenu.ts`). Full-screen list. Title
`Army — Power 6/20`. One row per unit in `UNIT_ORDER`: glyph, `Spearman
×2`, `Power 3 · melee, cheap — <description>`, then either
`🔒 Bronze Working research`, the recruit cost, or `At power cap`, and a
**Train** button (instant recruit).

**Problems.** `Power 6/20` in a title is a stat, not a fantasy. Tech-locked
units are dimmed rows with a padlock and no picture, so the aspirational
content — the cool units you don't have yet — is the least visible thing
on screen. Tags are a comma list.

**Show this.**

- Header: **"Your warband"** with a strength meter — 20 small shield pips,
  6 filled — and the numeric `6/20` small beneath it. At cap, the meter
  glows and reads "Your Townhall can't support more".
- Units as **portrait cards** in a 2-column grid: unit sprite (needs art —
  currently emoji only), name, `×2 owned` as small tally marks, power as
  sword pips, tags as small wooden keyword chips.
- Locked units stay **visible and colourful behind a padlock scrim**, with
  "Research Bronze Working" as a tappable line that jumps to the tech.
  Aspiration is the point.
- Cost chips + a green **Recruit** button (rename from "Train" so it does
  not collide with the Townhall's villager training, which is a different
  thing).
- Since recruiting is instant, give it a payoff: the new unit's portrait
  pops onto the roster with a small banner and a sound.

---

### 5.11 Settings

**Purpose.** Sound, save, and the escape hatch.

**Today** (`src/ui/settingsMenu.ts`). Full-screen: `Save: ☁️ cloud save`,
`Version: 0.1.0 · save v2`, a Music iOS-style switch, then a **Danger
zone** with a two-step Reset ("Tap again to confirm", armed for 4s).

**Problems.** Almost fine. "Danger zone" is developer language. Music is
the only audio control although the game has a full SFX layer and an
ambience bed. There is no way to see the offline cap, no credits, no link
back to the quest chain.

**Show this.**

- Sound section: **Music**, **Sound effects**, **Ambience** — three
  switches (the sfx/ambience mutes need wiring; `syncAmbience` is already
  gated on `musicMuted()`, which is a bug in disguise).
- Save section: cloud/local status in plain words ("Your kingdom is saved
  to this device" / "…to the cloud"), last-saved time, and the version
  line as small print at the very bottom.
- Rename **Danger zone** → **Start over**, keep the two-step confirm,
  and state the consequence in the first step, not the second.
- Room for: Credits, a "How to play" recap, and the offline-progress
  explainer ("Your kingdom keeps working for up to 8 hours while you're
  away").

---

### 5.12 Welcome back *(new — currently missing)*

**Purpose.** Pay off the idle half of the design.

**Today.** Nothing. On load, `runTick()` replays the whole absence
(capped at `OFFLINE_CAP_HOURS`), workers deliver, taxes accrue, the queue
cascades, research completes — and the player sees none of it. Completed
items may fire banners in a burst; everything else is silent. The game's
single strongest retention beat is invisible.

**Show this.** A modal on load, only when the gap exceeded ~2 minutes:

- "Welcome back — your kingdom worked for **6h 20m**" (and, at the cap,
  "…your stores filled up after 8h" as a gentle nudge, not a scold).
- Earnings as a short list of **icon + amount** rows: Gold from taxes,
  each resource delivered by workers, Food from the Market, villagers
  trained.
- What finished while away: buildings completed, upgrades, research —
  each with its sprite.
- One green button: **Collect**. Coins fly to the HUD.
- If the quest advanced, hand off directly to the quest card.

---

### 5.13 Expedition *(new — `Docs/features/11-expeditions.md`)*

**Purpose.** Commit a party to a ruin. The only place army composition matters.

**Show this.**

- Opens as a bottom sheet from a **ruin on the map**, so the world stays visible
  behind it (§2.1) and the destination you are committing to is the thing you
  tapped.
- **The hero slot first, and it is mandatory** — an empty hero slot disables
  Launch, with the reason attached (§2.4): "A hero must lead the party."
- Party slots as a row of carved sockets, filled from the units you own. Locked
  sockets say what unlocks them — research, or Gems.
- **The one number that matters: "Safe to depth 4."** Not a power total. It is
  the outcome, not the stat (§2.3) — party power against the ruin's depth
  difficulties, computed and shown before launch.
- The **matchup read** against the ruin's affinity, as advantage/disadvantage
  arrows on each unit, never as a multiplier.
- Supply cost as cost chips, and the **standing orders** control — "delve to
  depth N, then return" — as a plain choice, not an advanced option.
- One big green **Launch**.

**States to mock.** No hero (disabled, reason shown) · a good composition
(advantage arrows) · a bad one · standing orders set · locked party slot.

---

### 5.14 Checkpoint *(new — the delve's one recurring moment)*

**Purpose.** Ask one question: go deeper, or come back with what you're carrying?

This is the most important new screen in the game and the easiest to get wrong.

**Show this.**

- **Party HP as a bar that does not refill between depths.** This is the risk
  meter — the whole push-your-luck tension is legible here or nowhere.
- **The haul so far**, shown as objects in a pouch rather than a table of
  numbers, and labelled so it is obvious it is **not banked yet**.
- Whatever is known about the next depth. If a Scout is in the party, its threat
  type; otherwise an honest question mark.
- **Two choices of equal visual weight**: *Go deeper* and *Take the haul*. This
  breaks §2.2's one-primary-action rule **deliberately and only here** — the
  whole design is that neither is the default, so styling one as primary would
  answer the question for the player.
- **No battle screen.** The depth resolves instantly and reports what it cost.

**Tone, which is the hard part.** It must read as an **offer, never a threat**.
A failed push costs half the haul, and the design only survives that because the
haul was never the player's to begin with — so this screen has to sell "not
banked yet" from the very first depth. Red, warning triangles and countdowns are
all wrong. There is **no decision timer**: the party waits indefinitely.

**States to mock.** Depth 1 (small haul, safe next) · deep and worn (low HP,
large haul, unknown next) · scouted next depth · the failure report.

---

### 5.15 Reliquary *(new — `Docs/features/08-magic.md`)*

**Purpose.** Decide what magic you can afford to keep switched on.

**Show this.**

- Bottom sheet, relics only. *(Superseded 2026-09-08: this was two tabs,
  Relics and Heroes; heroes left for a nav tab and a roster grid —
  [`../features/10-heroes.md`](../features/10-heroes.md) §8.)*
- **Attunement slots at the top**, as physical sockets. A locked slot says
  whether research or Gems opens it. A slot in its **5-minute swap lock** shows
  the time remaining on the socket itself.
- Each relic card carries its passive in plain words. **Upkeep is gone**
  (2026-09-02): nothing draws against the pool any more, so the number the
  decision used to turn on is now *attune-or-arm* — a relic is worn by the
  kingdom or carried by a hero, never both.
- **This is where the Mana pool lives**: the gauge, the ceiling and the one
  production figure the header shows (§5.1). Never three numbers in the HUD.
- **Knowledge and Fragments live here, not in the header** — and Knowledge is
  now permanently here, since it buys relic and hero levels and nothing else
  ([`../features/10-heroes.md`](../features/10-heroes.md)). It reads as its own
  parchment panel under the Mana pool, captioned with where it comes from.

**States to mock.** One slot, empty · one filled · a slot mid-lock · a relic
you cannot afford to Study · the heroes tab.

---

### 5.16 Banner *(new — `Docs/`Docs/features/10-heroes.md`)*

**Purpose.** Spend Gems on a pull.

**Show this.**

- Reached **from the reliquary, never from the nav bar**. It is not somewhere the
  player should be led every session.
- **Rates shown plainly and the pity counter always visible** — "guaranteed
  within N". In a cozy game this is not a legal footnote, it is the thing that
  makes the screen acceptable at all.
- **No dead pulls**: a duplicate is shown converting into Fragments as part of
  the reveal, not as a consolation line afterwards.
- The reveal is the one place in this document where a bit of spectacle is
  correct — but it stays inside the warm material language of §3.5. No neon, no
  slot-machine chrome.

**States to mock.** Standard banner · pity near-guaranteed · a duplicate
converting · a limited event banner.

---

## 6. Cross-cutting fixes

Small, high-leverage, mostly independent of the visual redesign.

1. **Emoji → pixel icons.** One sprite sheet (§7.2) replaces ~35 glyphs.
   Biggest single credibility win available.
2. **Warm the scrim.** `rgba(10,13,18,0.88)` → `rgba(60,36,18,0.35)`, and
   convert the three full-screen overlays to bottom sheets.
3. **Every disabled control gets a reason** rendered next to it, in plain
   words, always a full sentence.
4. **Say what a tech unlocks** before it is researched (§5.9).
5. **Use `questInfo().index/total`** — the chain position is computed and
   thrown away.
6. **Split the header** into currencies (contextual) and city status
   (plaque), and move the save badge to Settings.
7. **Persistent nav + per-sheet close** instead of swapping the whole bar
   for one Close button.
8. **Toasts move to the bottom**, away from the quest card and banner.
9. **`x1.000` → `x1,000`** in the market amount selector.
10. **"Train" means two things** — keep it for villagers, use "Recruit"
    for army units.
11. **Offline report** (§5.12).
12. **Minimum type size 13px**; the current 11–12px helper text fails on
    a phone in daylight.
13. **A price lives inside the button that spends it** (§6.4 below).
14. **The header outranks every menu; the nav bar steps aside** (§6.5 below).
15. **A lit tab never lies** (§6.7 below).

### 6.4 A price lives inside the button that spends it

*Added 2026-09-02, and it supersedes the cost-beside-the-button layout every
screen used before it.*

**The rule.** When an action has a cost, that cost is rendered **inside the
button**, under its label: one icon-and-amount term per currency. **Any term
the player cannot pay is drawn in `clay`.**

Three reasons it is worth changing every screen for:

- **A price beside a button is a caption; a price on a button is part of the
  thing you press.** The player reads the verb and what it costs in one glance
  instead of pairing up two elements and hoping they belong together.
- **It fixes a real bug in the old layout.** `action()` renders one slot that
  holds *either* the cost *or* the blocked reason — so the moment a player
  could not afford something, the price was **replaced** by the words "Short 28
  Wood". The number vanished exactly when it mattered most, and the player was
  told they were short without being told short *of what total*.
- **The red is the reason.** §6.3 says nothing is greyed out without a reason
  beside it. A clay number satisfies that rule by itself, so an action blocked
  *only* by its price now needs no sentence at all — and a screen that prints
  "Short 28 Wood" beside a button already showing a red 40 is nagging.

**Therefore:** `disabledReason` is for obstacles that are **not** money — a
Townhall level, a missing technology, a busy hero, nowhere legal to build.
Affordability is not a reason any more; it is a colour. Passing `cost` and
`have` to `btn()`/`action()` gets the price, the red and the disabled state
together, so no screen can show one without the others.

**What stays outside the button:** consequences, not prices — a build
duration, "instant", "takes 2m 30s". Those are what you get, not what you pay.

**Non-wallet prices count too.** Fragments are a per-collectible counter rather
than a currency, and they go in the button like everything else, reading
`have / needed` so the gap is the thing you see.

### 6.5 The header outranks every menu; the nav bar steps aside

- A menu is opened **over** the game. The resource header stays above it,
  undimmed and tappable, full-screen menus included: what you can afford is
  the reason you opened the menu.
- **The nav bar leaves while a menu is open** — a sheet, or the district
  card: it slides down out of the frame (200 ms) and slides back up when the
  map returns. Every menu brings
  its own way out, and the space the bar held goes to the menu — `--nav-h`
  is only the bottom inset while it is away.
- The stack, bottom to top: map · the right-edge column (4) · district card
  (6) · **menus and sheets (7)** · header (8) · nav bar (10) · the battle
  playback (90) · the gacha reveal (100) · the rewarded video (200). One
  z-index for every menu, so a new screen gets the right behaviour without
  being enumerated.
- **A full-screen menu reserves the header itself.** An absolutely positioned
  child resolves `inset` against `#overlay`'s padding box, which includes the
  padding, so `.research-screen` sets its own `top` and `bottom`.
- **The settings knob hides while any menu is open**, like the nav bar: it is
  the affordance for the map. Both are keyed on
  `#ui:has(> #overlay:not(:empty))`, so they cannot drift from what is on
  screen.

The one thing above everything is the rewarded-video surface, which is not in
`#overlay` at all — see `Docs/features/08-magic.md` §6.

### 6.6 A centred sheet, for a question

Bottom-anchoring is the default because most sheets are drawers over a screen
you are still using. A short, modal, one-decision sheet — an offer, a
confirmation — takes `centred: true` and sits in the middle of the play area
instead, because a drawer is the wrong metaphor for something that wants an
answer before you carry on.

### 6.7 A lit tab never lies

*Added 2026-09-02.*

A nav tab wears the CTA when the screen behind it has something the player can
press **this second** — not when it merely contains content. Build already
worked this way (affordable *and* placeable); **Research** now does too: some
tech startable, or some upgrade buyable.

Inside the tech tree, the same question is asked per node and answered with a
**red dot, top-right**. It is needed because `available` styling only means the
prerequisites are met — a node can be available and still unaffordable, or
blocked because every research slot is busy. The tree shows a lot of nodes at
once and most of them are not actionable; the dot is the difference between
"exists" and "go".

The predicates behind both — `canStartTech`, `canBuyUpgrade` — mirror every
gate the commands themselves check, and are the *same* functions the buttons
use. That is the point: a light that drifts from its button is worse than no
light, because it sends the player to a screen where nothing is pressable.

Note the two are deliberately not the same question. Upgrades do not consume
research slots, so with every slot busy the tech dots go dark while the upgrade
dots stay — and the tab stays lit, honestly, because the upgrades really are
pressable.

---

### 6.8 A screen is built once

*2026-09-10.* The tick calls `notify()` once a second and every command
calls it too; a screen that rebuilt itself on every call blinked its images,
lost its scroll and replayed its slide-in on the phone. The contract now:

- **Sprites are pooled.** `spriteImg()` (`src/render/spritePool.ts`) hands
  out one `<img>` per URL and `legacy().refresh()` returns every pooled image
  in the discarded subtree before it replaces it, so a decoded bitmap moves
  from the old tree to the new and never re-decodes. Nothing is inlined as a
  `data:` URI (`assetsInlineLimit: 0`).
- **Scroll is kept by name.** A scroller carries `data-keep-scroll="<name>"`
  and its position is written back only when it differs. The district card's
  body, the training queue, the research page and the tech card all carry one.
- **The slide-in plays once.** `data-fresh` marks the first build's content;
  the animation keys on it, not on the container.
- **A screen with nothing ticking is signed.** `OVERLAY_SIGNATURES`
  (`src/main.ts`) holds a coarse stringify of what each such screen reads;
  same string, no rebuild. A screen that shows a countdown or the wallet
  keeps rebuilding — the rebuild is invisible once images and scroll survive.
- **The district card is the template for the next step**: built once per
  building and mutated in place, like the header and the pills.

## 7. Mockup prompt pack (ChatGPT)

### 7.0 How to run the session

This section produces two different things, and it matters which you are
asking for. **§7.1–§7.14 are mockups** — full screens over the map, generated
so I can build from them; nothing is sliced out of them. **§7.16 is export
sheets** — the flat transparent grids that become the icons the game actually
loads. Same conversation, same style block, different output rules.

Same workflow that produced the v2 sprite set — it is proven here:

1. **One conversation.** Attach `reference.png` (on `archive/pixel-art-era`) to the
   first message and say: *"This is the in-game world art. Every UI mockup
   I ask for must look like it belongs on top of this."*
2. **Generate §7.1 (the style sheet) first** and iterate on it until the
   materials are right. Everything after that says *"same UI kit as the
   style sheet"* — the image is a far stronger anchor than any wording.
3. **Portrait 1080×1920** for full screens; square sheets for components.
4. **Image models cannot render small text reliably.** Expect labels to
   come back misspelled. That is fine: these are *layout and material*
   mockups, not specs. The real text is in §5. Ask for
   *"legible chunky lettering; if text is unclear, prefer fewer, larger
   words"*, and never judge a mockup on its typos.
5. **Ask for real alpha only when generating icon sheets** — full-screen
   mockups want the map behind them. For the icon sheets, use the same
   correction request that worked for sprites: *"apply the true-alpha
   transparency correction and give me the download link for the corrected
   PNG"*, then verify locally:
   `magick sheet.png -format "%[pixel:p{0,0}]" info:` → `srgba(0,0,0,0)`.
6. Keep everything under `Docs/art/ui/` alongside the source conversation
   exports.

### The shared UI style block

Paste this **verbatim at the top of every prompt** (with `reference.png`
attached):

> Mobile game UI mockup for a cozy fantasy pixel-art kingdom builder,
> portrait phone screen, 1080×1920. The game world behind the interface is
> the bright top-down pixel art in the attached reference: saturated spring
> greens, chunky pixels, tiny cream-walled cottages with terracotta roofs,
> soft round tree canopies, tan dirt paths. The interface is made of warm
> physical materials — aged parchment panels (#F4E4C1) inside carved wooden
> frames (#A9713F face, #5C3A1E 2–3px outline, #C89159 top bevel), rope,
> cloth banners and wax seals. Text is dark brown ink (#3B2412) in a chunky
> readable pixel font. Buttons are thick rounded slabs with a 3px darker
> bottom lip: leaf green (#6FBF4A) for the main action, wood brown for
> secondary, clay red (#D4553E) for destructive. Accents in warm gold
> (#F2B233). All icons are small chunky pixel-art icons, never emoji. Crisp
> nearest-neighbour pixels, flat two-tone shading, no gradients, no
> anti-aliasing, no glow. Cheerful, tactile, storybook — NOT a strategy
> game HUD: no grey or blue-grey panels, no thin hairlines, no dense data
> tables, no glass, no neon, no sci-fi. Big generous touch targets. No
> watermark, no logo, no border outside the phone screen.

---

### 7.1 UI style sheet — generate this first

> [style block] …but instead of a screen: a single flat style sheet on a
> plain parchment background showing the UI kit's pieces laid out in a
> grid, evenly spaced, none touching: (1) an empty parchment panel inside a
> carved wooden frame with a rope grab-handle at the top; (2) the same
> panel's wooden header plank with a hanging cloth banner over it; (3) four
> buttons side by side — a big green "BUILD" slab, a brown "Select" slab, a
> red "Reset" slab, and a locked grey-parchment slab with a small padlock;
> (4) a round wooden knob button with a "+" and another with a "−"; (5) a
> horizontal progress bar as a carved wooden trough with a gold fill; (6) a
> row of five small pips, three filled gold and two empty; (7) a small
> parchment list row with a 48px empty square art slot on its left; (8) a
> resource counter: a wooden plaque holding a coin icon and the number
> 1,240. Everything at the same scale, chunky pixel art, no screen frame.

### 7.2 Icon sheets

Two square transparent sheets. Run each twice — once normal, once locked.

**Sheet A — resources & city status (4×3 grid)**

> [style block] …but instead of a screen: a 4×3 grid of twelve separate
> pixel-art icons on a fully transparent background, evenly spaced, none
> touching, all the same chunky 32×32 scale, each readable at half size:
> (1) a gold coin, (2) a red apple, (3) a stack of cut logs, (4) a grey
> stone block, (5) an iron ingot, (6) a cut violet gem, (7) a rolled
> parchment scroll, (8) three tiny villager heads together, (9) a builder's
> hammer and hard hat, (10) a farmer with a hoe, (11) a bunch of blue
> berries, (12) a silver fish. Flat two-tone shading, dark brown outline on
> every icon, warm saturated palette matching the attached reference. Then
> apply the true-alpha transparency correction and give me the download
> link for the corrected PNG.

**Sheet B — buildings & menus (3×3 grid)**

> [style block] …but instead of a screen: a 3×3 grid of nine separate
> pixel-art icons on a fully transparent background, evenly spaced, none
> touching, all the same chunky 32×32 scale: (1) a small townhall with a
> banner, (2) a cottage, (3) a wheat sheaf, (4) a green crop plot, (5) a
> log saw, (6) a market awning stall, (7) a pickaxe over rocks, (8) a
> ship's anchor, (9) a miner's lantern and hammer. Same style as the
> previous sheet. Then apply the true-alpha transparency correction and
> give me the download link for the corrected PNG.

### 7.3 Resource HUD

> [style block] Same UI kit as the style sheet. Show only the TOP THIRD of
> the phone screen over the bright pixel-art kingdom map. Along the top
> edge, a carved wooden plank bar holding three large resource counters
> side by side — a gold coin with "1,240", a red apple with "86", a stack
> of logs with "312" — each icon in a small parchment inset, numbers in
> chunky dark-brown pixel lettering. At the far right of the plank, set
> slightly apart with a thin rope divider, a violet gem icon with "10" and
> a small round green "+" knob. Hanging just below the plank on two short
> ropes, a smaller wooden plaque with three city-status readouts: a group
> of villager heads "12/16", a builder's hammer "1/2", a farmer "3". The
> map is fully visible below and behind. Nothing else on screen.

### 7.4 Quest card

> [style block] Same UI kit. Show the top half of the phone screen over the
> kingdom map, with the wooden resource plank along the very top. Just
> under it, on the left, a partly unrolled parchment scroll card about 70%
> of the screen width, pinned with a small wax seal: a title line "Timber!",
> one line of smaller brown text beneath it, then a carved wooden progress
> trough filled two-thirds with gold and reading "6/10", then a row of ten
> tiny stamp marks with six inked in. Along the bottom of the scroll, on the
> left three reward icons with counts — a coin "30" and a gem "2" — and on
> the right a brown wooden button reading "Show me" with a small pointing
> hand icon. Above the scroll's top edge, small burnt-in lettering "Quest 3
> of 12". Make a second version of the same card in its completed state:
> the scroll edged with a glowing gold rim and the button replaced by a big
> green "Claim" slab.

### 7.5 Banner & toast

> [style block] Same UI kit. One image, two elements on the same phone
> screen over the kingdom map. At the top, hanging from two gold ropes just
> below the wooden resource plank, a cloth pennant banner with a wax seal
> at its left holding a small pixel-art sawmill building; on the banner,
> tiny uppercase gold lettering "CONSTRUCTION COMPLETE" above a larger
> cream title "Sawmill" and one line of small text. The banner has a
> notched swallowtail bottom edge. Near the bottom of the screen, just
> above where a nav bar would be, a small narrow parchment slip with a
> thick clay-red stripe down its left edge, reading "No free workers —
> train villagers first" in one line of dark brown text. Nothing else.

### 7.6 Bottom navigation

> [style block] Same UI kit. Show only the BOTTOM THIRD of the phone screen
> over the kingdom map. A thick carved wooden beam runs across the bottom
> edge, divided into four raised tab plates, each with a chunky pixel icon
> above a short word: a hammer "Build", a shield "Army", a scroll and
> candle "Research", a cog "Settings". The "Build" tab is raised higher
> than the others, warm-lit with a gold glow and two small sparkles, as the
> highlighted call to action. The other three sit flush and unlit. Above
> the beam, at the right edge, a separate small round wooden knob with a
> dark "✕" carved into it, as if attached to a panel that is off-screen
> above. Big, chunky, tactile.

### 7.7 Build sheet

> [style block] Same UI kit. Full phone screen. The kingdom map fills the
> top third, dimmed with a warm brown tint but clearly visible. A bottom
> sheet covers the lower two-thirds: a parchment panel in a carved wooden
> frame with a rope grab-handle and a round wooden "✕" knob at the top
> right, a wooden header plank reading "Build". Below it a 2-column grid of
> four building cards. Each card is a small parchment tile with a thick
> wood border showing, at the top, a tiny pixel-art building sitting on a
> patch of grass — a cottage, a wheat farm, a log sawmill, a market stall —
> then its name in dark brown, then one short line of smaller text, then a
> row of small cost chips (a log icon with "20", a stone icon with "10"),
> then a tiny hourglass with "45s" and a row of four small pips with two
> filled. The market-stall card is dimmed to warm parchment and wears a
> diagonal padlock ribbon with the line "Needs Townhall level 3". At the
> bottom of the grid, a fifth wider card with a "?" wax seal reading "More
> to discover".

### 7.8 Placement

> [style block] Same UI kit. Full phone screen, and the MAP IS THE HERO:
> the bright pixel-art kingdom fills almost the whole screen, undimmed. In
> the middle, a semi-transparent ghost preview of a small sawmill building
> sits on one grid cell, ringed by a soft translucent leaf-green circular
> area-of-influence overlay about five cells across; inside that overlay,
> four pine-tree cells are lit and slightly raised while trees outside it
> are dimmed. A small parchment tag floats just above the ghost building
> showing a pine tree icon and "×4" in large gold lettering, with the words
> "Good spot" beneath it in green. The ghost is being **held**: it sits
> slightly larger than a cell with a soft dark shadow cast on the ground
> beneath it, as if lifted a few millimetres off the map. Legal neighbouring
> cells are marked with small unobtrusive wooden corner brackets. Along the
> very bottom, a single
> slim wooden bar — not a tall panel — holding, left to right: a tiny
> sawmill icon, the word "Sawmill", cost chips (a log "20", a coin "40"),
> a small hourglass "45s", and a big green "Build" slab at the right end.
> The wooden nav beam is not visible; the bar sits at the screen edge.

### 7.9 District card

Run this one **twice**: once as the hero (worker building), once as a 2×2
variant sheet.

**Hero — worker building**

> [style block] Same UI kit. Full phone screen. The top 40% shows the
> kingdom map, warm-dimmed, with one sawmill building highlighted by a soft
> gold ring. The bottom 60% is a parchment bottom sheet in a carved wooden
> frame with a rope handle and a round "✕" knob. Inside, at the top left, a
> square parchment vignette holding a pixel-art sawmill building; to its
> right, the name "Sawmill" in large dark-brown pixel lettering with three
> small stars beneath it, two filled gold and one empty, and one short line
> of text. Below that, a small square mini-map thumbnail — a 5×5 grid of
> tiny green cells with a translucent green circle over them and four pine
> trees lit inside it — sitting beside two stat chips: a log icon with "+3"
> and a small clock with "11s". Below that, a row of four small circular
> worker portraits: two show villagers (one with a tiny pickaxe, one with a
> backpack), two are empty rope-rimmed sockets; a round wooden "−" knob sits
> at the left end of the row and a "+" knob at the right. At the bottom, an
> upgrade strip: a small sawmill sprite, a gold arrow, a slightly bigger
> sawmill sprite, with two tiny delta lines beside them, then cost chips
> and a big green "Upgrade" slab at the right.

**Variant sheet — 2×2**

> [style block] Same UI kit. One image divided into a 2×2 grid of four
> separate bottom-sheet panels on a plain dark-parchment backdrop, evenly
> spaced, none touching, all the same size and scale — no phone screen, no
> map. TOP-LEFT: a "Townhall" panel with a townhall vignette, and a row of
> five villager silhouettes of which two are filled in, the front one
> overlaid with a small sand-timer reading "42s", plus an apple cost chip
> "20" and a green "Train" button. TOP-RIGHT: a "Cottage" panel with a
> cottage vignette, a row of four little beds of which three hold sleeping
> villagers, a coin-drip stat chip reading "1.5 per minute", and a small
> green leaf badge reading "Cosy neighbourhood +0.3". BOTTOM-LEFT: a
> "Crop plot" panel with a green field vignette and a row of five pips with
> three filled, plus a small clock badge. BOTTOM-RIGHT: a "Quarry" panel
> mid-construction — the vignette is wrapped in tiny wooden scaffolding, a
> carved progress trough is one-third filled and reads "1m 20s left", and
> at the bottom a violet gem button reading "Finish · 8" beside a small red
> "Cancel" slab.

### 7.10 Market

> [style block] Same UI kit. Full phone screen. The top third shows the
> kingdom map, warm-dimmed. The bottom two-thirds is a bottom sheet built
> like a market stall: a striped red-and-cream cloth awning across the top
> instead of a plain header plank, with "Market" on a hanging wooden sign,
> and a small gold ribbon beneath the awning reading "Market Stall: +15%
> prices" with a tiny cart icon. Under the awning, a row of chunky wooden
> toggle buttons reading "x1", "x10", "x100", "x1,000", "All", with "x10"
> pressed down and lit green. Below them, a 2-column grid of four goods
> cards; each is a wooden crate or wicker basket on a plank counter holding
> a pile of one good — logs, stone blocks, iron ingots, blue berries — with
> a small hanging price tag reading e.g. "3 per unit", the line "you have
> 42" in small brown text, a large gold "→ 30" with a coin icon, and a
> small green "Sell" slab. Warm, busy, tactile — a stall, not a list.

### 7.11 Research

> [style block] Same UI kit, but this screen is its own place, not a sheet:
> full phone screen filled edge to edge with an aged parchment map, faintly
> drawn hills, forests and coastline in sepia ink, slightly creased and
> stained. Across the top, a carved wooden plank header reading "Research";
> on its right, two small lecterns with candles — one has a hooded scholar
> working at it, the other is an empty stool with a violet gem button
> beside it reading "Hire · 25". On the parchment, six large round wax-seal
> medallions are connected by dotted sepia ink trails; two connected
> trails are inked in gold. Each medallion carries a chunky pixel-art
> symbol: an axe, a wheat sheaf, a market awning, a pickaxe, a fishing
> hook, a sword. The axe medallion is green wax with a gold tick; the wheat
> medallion is blue with a small sand-timer and a thin progress ring; the
> market medallion is bright gold and unsealed, looking clickable; two more
> are plain; the last is hidden under a scorched, folded corner of the
> parchment showing only a "?". Beneath the two completed medallions hang
> three tiny pinned badges on short strings, each with a row of small level
> pips. Floating above the bottom edge, a parchment info card: a market
> medallion thumbnail, the title "Trade", one line of text, a line reading
> "Unlocks:" followed by a small pixel-art market building, a scroll cost
> chip "40" with an hourglass "2m", and a big green "Start" slab.

### 7.12 Army

> [style block] Same UI kit. Full phone screen. Top third: the kingdom map,
> warm-dimmed. Bottom two-thirds: a parchment bottom sheet in a carved
> wooden frame. Header plank reads "Your warband"; directly beneath it a
> long row of twenty tiny shield pips of which six are filled bronze, with
> a small "6/20" beneath in brown text. Below that, a 2-column grid of four
> unit portrait cards. Each card is a parchment tile with a wooden border
> holding a chunky pixel-art unit portrait from the chest up — a spearman,
> a swordsman, an archer, a horseman — with the unit's name below, a row of
> tally marks reading "×2", a row of small sword pips for power, one or two
> tiny wooden keyword chips, cost chips, and a small green "Recruit" slab.
> The horseman card is covered by a translucent warm scrim with a big
> padlock and the line "Research Horsemanship", but the portrait underneath
> stays colourful and clearly visible. Aspirational, not greyed out.

### 7.13 Settings

> [style block] Same UI kit. Full phone screen. Top third: the kingdom map,
> warm-dimmed. Bottom two-thirds: a parchment bottom sheet in a carved
> wooden frame, header plank "Settings". Inside, a "Sound" section with
> three rows, each an icon, a label and a chunky wooden toggle switch made
> of a carved slot with a sliding round knob: a lute icon "Music" (on,
> knob right, slot glowing green), a bell icon "Sound effects" (on), a
> leaf-and-wind icon "Ambience" (off, knob left, slot dark). Below, a
> "Your kingdom" section: a small cloud icon with the line "Saved to the
> cloud" and smaller text "last saved a moment ago". Below that, separated
> by a rope divider, a "Start over" section with one line of clay-red text
> and a red wooden "Reset" slab. At the very bottom, tiny burnt-in small
> print reading "v0.1.0". Calm and uncluttered.

### 7.14 Welcome back

> [style block] Same UI kit. Full phone screen. The kingdom map fills the
> background, warm-dimmed, with the sun low and a few tiny lit windows in
> the cottages. Centred, a parchment card about 80% of the screen width in
> a carved wooden frame, topped by a small cloth banner reading "Welcome
> back". Inside: one line reading "Your kingdom worked for 6h 20m", then a
> short list of four earnings rows, each a chunky pixel icon, a label and a
> gold "+" amount — a coin "+420", a log "+96", an apple "+58", a group of
> villager heads "+2". Below a rope divider, a smaller section headed
> "While you were away" with two little building sprites — a finished
> cottage and a sawmill — each with a tiny gold tick. At the bottom, one
> wide green "Collect" slab. A few gold sparkles drift around the card.
> Warm, generous, celebratory.

### 7.15 Iteration phrases that work

When a result is off, fix it on the **style sheet** first, then regenerate
the screens. Phrases that reliably move the output:

- *"Warmer — remove all grey and blue-grey; panels must read as parchment
  and wood."*
- *"Chunkier pixels, fewer details; this should look readable at half
  size on a phone."*
- *"Less text, larger text."* (the most effective single fix)
- *"Thicker outlines — every panel and button needs a dark brown 2–3px
  outline."*
- *"Make the buttons look pressable: add a darker lip under each one."*
- *"Keep the game map visible behind the panel; dim it warm brown, not
  black."*
- *"This looks like a strategy game HUD. Make it storybook and tactile."*
- *"Same UI kit and scale as the style sheet."* (append to every retry)

---

### 7.16 Export sheets — the art that actually ships

Everything above produces **mockups**: full screens, over the map, for me to
build from. They are references, not assets. This section produces **export
sheets** — flat, evenly spaced, transparent grids that a script slices into
the atlas the game loads. Different output, different rules.

**Only generate what cannot be geometry.** Panel frames, card frames, button
slabs, progress troughs, pips and the scrim are specified numerically in §3.2
and §3.3, so CSS reproduces them exactly — recolourable, crisp at any DPR,
zero bytes. Asking an image model for 9-slice frames is a trap: the four
corners will not register with each other, the edges will not tile, the slice
insets will not land on integers, and `border-image` throws away the
`border-radius` §3.2 mandates. So the ask shrinks to **icons, seamless
textures and loose decorations**.

| Sheet | Grid | Contents |
|---|---|---|
| **UI-A** resources | 4×3 | Gold, Food, Wood, Stone, Iron, Gems, Knowledge, Population, Builders, Workers, Berries, Fish *(Iron/Berries/Fish are cell icons now, not coins — the art is unchanged)* |
| **UI-B** buildings | 3×3 | Townhall, Housing, Farm, FarmLands, Sawmill, Market, Quarry, Docks, Mine |
| **UI-C** actions | 4×3 | quest scroll, pointing hand, padlock, hourglass, clock, tick, ✕, +, −, pip, sparkle, `?` |
| **UI-D** textures | 2×2 | wood grain, dark wood, parchment fibre, cloth — **tiling, not trimmed** |
| **UI-E** decorations | 2×3 | wax seal, rope handle, pennant, sparkle burst, corner bracket, padlock ribbon |
| **UI-F** unit portraits | 2×2 | spearman, swordsman, archer, horseman (later — §8.2) |

**Do not generate three things** that are cheaper and better derived locally:
the **locked variant** of each icon (desaturating toward `locked` also
guarantees an identical silhouette, so a row never shifts when it locks), a
**padlock on every icon** (one padlock, composited in CSS), and the **16px
inline variants** (point-decimated). That is 35 generations saved.

**Generate UI-A first and run it all the way through the slicing tool before
generating anything else.** One sheet validates the grid wording, the trim,
the scale normalisation and the palette remap at once. A prompt fix found
there is free; found after five sheets it is five regenerations.

#### Append to every icon sheet (UI-A, UI-B, UI-C)

Paste after the §7.2 body, before the alpha sentence, substituting the real
row and column counts:

> Output one square image, 1024×1024. Treat the canvas as a strict grid of R
> rows × C columns of equal cells and place exactly one icon, centred, in each
> cell, in reading order left-to-right then top-to-bottom. Every icon must fit
> inside the middle 70% of its own cell: leave a wide empty transparent margin
> around each one, and no icon may touch, overlap or cross a cell boundary.
> All icons on this sheet must be the same visual size as each other — roughly
> 160 pixels across — so they can be used interchangeably at one size. Do not
> draw grid lines, cell borders, labels, numbers, captions, frames, drop
> shadows or any background. The background must be fully transparent (alpha
> 0) everywhere, not white and not a grey checkerboard pattern. If you cannot
> fit every icon, leave the surplus cells completely empty rather than
> shrinking or crowding the others.

Then keep the proven closing line verbatim: *"Then apply the true-alpha
transparency correction and give me the download link for the corrected PNG."*

Coarse cells are the whole tolerance story. At 1024×1024 a 4×3 grid gives
256px cells, so an icon drawn at ~160px can wander ±45px and still sit safely
inside its own cell — which is the difference between a sheet that slices
cleanly and one that clips. Do not ask for a grid finer than 4×4.

#### UI-D — seamless textures

> [style block] …but instead of a screen: one square image, 1024×1024, divided
> into a strict 2×2 grid of four equal 512×512 tiles that touch edge to edge
> with no gap and no separator. Each tile is a seamless, self-tiling texture:
> its left edge must continue perfectly into its right edge, and its top edge
> into its bottom edge, so it can be repeated as wallpaper without a visible
> seam. TOP-LEFT: carved wooden plank grain in #A9713F with #5C3A1E grooves and
> #C89159 highlights. TOP-RIGHT: the same, darker, in #5C3A1E. BOTTOM-LEFT:
> aged parchment fibre in #F4E4C1 with faint #E2CCA0 mottling, very low
> contrast. BOTTOM-RIGHT: plain cream cloth weave. Low contrast throughout —
> these sit *behind* dark brown text and must never compete with it. Fully
> opaque, no transparency, no objects, no text, no borders.

#### UI-E — decorations

> [style block] …but instead of a screen: one square image, 1024×1024, as a 2
> rows × 3 columns grid of six separate objects on a fully transparent
> background, evenly spaced, none touching, each centred in its own cell: (1) a
> red wax seal stamped with a crown, (2) a short length of rope lying
> horizontally, as a drawer handle, (3) a cloth pennant banner with a notched
> swallowtail bottom edge, (4) a burst of gold sparkles, (5) a small wooden
> corner bracket, (6) a diagonal ribbon bearing a padlock. These are NOT all
> the same size — draw each at its natural relative size, filling most of its
> cell. Then apply the true-alpha transparency correction and give me the
> download link for the corrected PNG.

---


### 7.17 The smooth chrome — style block v2 (2026-09-10)

The chrome stopped being pixel art on 2026-09-10 (the world did not). The
pixel faces forced 24px body copy and coarse size rungs that no phone layout
could fit, and 32px icons drawn to be shown at 32px cannot be scaled. So the
UI is redrawn **smooth**: Nunito for every word and number, and icons that
scale to whatever the layout asks (24px in the nav, 20px on the header
coins, 28px in a list row). The map underneath keeps its chunky pixels; the
contrast is deliberate — parchment and wood sitting on a pixel world.

§7.1–§7.16 are the pixel-era pack and stay as provenance for the atlas the
game shipped with. Everything generated from here on uses this block.

Paste **verbatim at the top of every prompt** (with `reference.png`
attached to the first message of the conversation):

> Mobile game UI for a cozy fantasy kingdom builder, portrait phone screen.
> The game world behind the interface is the bright top-down PIXEL art in
> the attached reference — saturated spring greens, tiny cream cottages with
> terracotta roofs, round tree canopies — and it stays pixel art. The
> interface on top of it is NOT pixel art: it is clean, smooth, softly
> shaded, like a polished modern mobile game (Township, Hay Day, Clash of
> Clans menus), made of warm physical materials — aged parchment panels
> (#F4E4C1) inside carved wooden frames (#A9713F face, #5C3A1E outline,
> #C89159 top bevel), rope, cloth banners, wax seals. Text is dark brown ink
> (#3B2412) in a clean rounded humanist sans-serif, medium weight, never
> pixelated, never blackletter. Buttons are thick rounded slabs with a
> darker bottom lip: leaf green (#6FBF4A) for the main action, wood brown
> for secondary, clay red (#D4553E) for destructive; accents in warm gold
> (#F2B233). Icons are chunky, simple, readable silhouettes with a thin dark
> brown outline, soft two-tone shading and a small highlight — smooth
> anti-aliased edges, no pixel grid, no emoji, no glow, no gradients heavier
> than a gentle bevel. Cheerful, tactile, storybook — NOT a strategy HUD: no
> grey or blue-grey panels, no hairlines, no dense tables, no glass, no
> neon. Compact: the interface must leave most of the world visible.
> Portrait 1080×2340 for full screens. No watermark, no logo, no phone bezel.

### 7.18 Icon sheets, smooth — the atlas the phone loads

Five square sheets, **4×4 cells at 1024×1024** (256px cells, icons ~180px),
true alpha, sliced by `scripts/ui-atlas.mjs` into a **64px-cell** atlas
(`atlas.manifest.json` `cell: 64`) and downscaled smooth, not point-sampled.
Names are the `IconName` union in `src/ui/kit/icon.ts`; `tests/icons.test.ts`
holds the manifest to it. Reading order, left to right, top to bottom.

| Sheet | Cells | Contents (in order) |
|---|---|---|
| **UI-A2 currencies & goods** | 16 | Gold coin · Food (red apple) · Wood (cut logs) · Stone (grey block) · Mana (glowing violet-blue orb) · Gems (cut violet gem) · Knowledge (open book with a quill) · Stardust (pinch of glittering blue dust) · HeroXp (rising golden chevron) · SilverKey (ornate silver key) · GoldKey (ornate gold key) · Planks (bundle of sawn planks) · CutStone (dressed stone block with chisel marks) · Iron (iron ingot) · Runestone (blue-grey stone with a glowing rune) · Meat (roast leg on the bone) |
| **UI-B2 buildings I** | 16 | Townhall (hall with a banner) · Housing (cottage) · Farm (wheat sheaf) · FarmLands (green crop plot) · Sawmill (log saw) · Quarry (pickaxe over rocks) · Docks (anchor) · Sanctum (crystal on a stone plinth) · Barracks (shield with crossed swords) · SpearHall (two crossed spears) · ShootingGrounds (bow and arrow) · Stables (horseshoe) · Infirmary (red cross on a bandage roll) · Carpenter (saw over a sawhorse) · MasonsYard (mallet and chisel) · Smelter (small furnace with flame) |
| **UI-C2 buildings II, cells, units, people** | 16 | RuneCarver (rune chisel) · Garden (flower bed) · Well (stone well with bucket) · Orchard (fruit tree) · Statue (stone figure on a plinth) · Plaza (paved square with a fountain) · Shrine (small stone shrine with a candle) · Berries (bunch of blue berries) · Fish (silver fish) · Warrior (swordsman helmet) · Lancer (spearman helmet) · Archer (hooded archer) · Cavalry (horse head with plume) · population (three villager heads) · builders (hammer and hard hat) · workers (farmer with a hoe) |
| **UI-D2 symbols** | 16 | harmony (two leaves in a circle) · build (hammer) · army (shield) · research (scroll with a candle) · settings (cog) · quest (rolled parchment scroll) · showme (pointing hand) · padlock · hourglass · clock · tick · close (✕) · plus · minus · sparkle (four-point star burst) · unknown (?) |
| **UI-E2 marks** | 12 of 16 | star (five-point gold star) · video (film clapper) · ascension (rising star with a trail) · fragment (glowing shard) · atk (sword) · def (round shield) · hp (heart) · relics (reliquary chest with a glowing lid) · dungeon (dark ruin mouth) · chest (closed treasure chest) · daily (calendar page) · skull — then four EMPTY cells |

Prompt, per sheet (substitute the contents list):

> [style block v2] …but instead of a screen: one square image, 1024×1024,
> fully transparent background. Treat the canvas as a strict grid of 4 rows
> × 4 columns of equal cells and place exactly one icon, centred, in each
> cell, in reading order left-to-right then top-to-bottom: [contents]. Every
> icon must fit inside the middle 70% of its own cell, with a wide empty
> transparent margin around it; no icon may touch or cross a cell boundary.
> All icons the same visual size, roughly 180 pixels across, drawn to read
> clearly at 24 pixels: bold simple silhouettes, thin dark brown outline,
> soft two-tone shading, one small highlight, smooth edges. Do not draw grid
> lines, cell borders, labels, numbers, captions, shadows or any background.
> The background must be alpha 0 everywhere — not white, not a checkerboard.
> Leave any surplus cells completely empty. Then apply the true-alpha
> transparency correction and give me the download link for the corrected
> PNG.

Locked variants and the 16px `-sm` cells are still **derived**, not drawn
(§7.16); the derivation resamples smooth instead of point-decimating.

### 7.19 Screen mockups, phone-exact

Full screens at **1080×2340** (the iPhone 17's 9:19.5; the frame in the
game is pillarboxed to 9:16 on desktop but full-bleed on the phone). Each
one shows the chrome at the density the pass targets: header 44px, nav 52px,
sheets no taller than 70% of the screen, 44px targets, 16px body, 22px
titles. Image models misspell; judge layout and material, never the words.

**M1 — map and chrome**

> [style block v2] Full phone screen over the bright pixel-art kingdom map.
> Along the very top, under a thin dark safe-area strip, a slim carved
> wooden plank bar, about 5% of the screen height, holding four compact
> resource counters — a gold coin "1,240", an apple "86", logs "312", a
> stone block "40" — each a small icon and a number, then, set apart by a
> thin rope divider, a small violet mana orb with a slim gauge, and at the
> far right a violet gem "10" with a tiny green "+" knob. Hanging just below
> the plank on the right, a small round wooden knob with a cog. Bottom-left,
> just above the nav, a small parchment quest scroll card about 55% of the
> screen width: title "Timber!", one short line, a slim gold-filled trough
> "6/10", and a small brown "Show me" slab. Along the bottom edge a slim
> carved wooden beam, about 6% of the screen height, with FIVE small raised
> tab plates, each a 24px-style icon above a tiny word: a gem "Store", a
> glowing chest "Relics", a helmet "Heroes", a scroll "Research", a hammer
> "Build"; "Build" is lit gold as the call to action. Below the beam a thin
> dark strip for the home indicator. The map fills everything else and is
> the hero of the image: the chrome is small and out of its way.

**M2 — the Townhall card**

> [style block v2] Full phone screen. The top 45% shows the kingdom map,
> warm-dimmed, with the slim resource plank at the top and a townhall
> building ringed in soft gold. The bottom 55%, sitting just above a slim
> five-tab wooden nav beam, is a parchment panel in a thin carved wooden
> frame with a small rope grab-handle. Inside, top-left, a square parchment
> vignette with the townhall; to its right, "Townhall" in clean dark-brown
> lettering with a small numeral "3 / 10" beside a gold star, and one short
> line "The heart of the realm." Below, a row of five small round villager
> portraits, two filled, one wearing a tiny sand-timer "42s", with a small
> apple chip "20" and a compact green "Train" slab at the right. Below that,
> a "Level up" block: two small townhall sprites with a gold arrow between
> them, three compact stat tiles in a row — a coin "×1.5 → ×1.75", a
> townhall "ring 8 → ring 10", villager heads "12 → 20" — and under them a
> single line with a small padlock reading "Needs 12 villagers · you have
> 9" where a button would be. Everything compact and evenly spaced; the
> panel does not need to scroll.

**M3 — the Build sheet**

> [style block v2] Full phone screen. The kingdom map fills the top 35%,
> warm-dimmed but visible, with the slim resource plank at the top. A bottom
> sheet covers the lower 65%, above a slim five-tab wooden nav beam: a
> parchment panel in a thin carved wooden frame, a small rope grab-handle,
> and a narrow wooden header strip reading "Build" with a small round "✕"
> knob at its right end. Below, a 2-column grid of six compact building
> cards, each a parchment tile with a thin wood border: a small building
> picture at the left — cottage, wheat farm, log sawmill, quarry, docks,
> sanctum — its name, one short line, and a row of small cost chips (logs
> "20", stone "10"). The docks card is dimmed and wears a small padlock
> reading "Needs Sailing". All six cards fit without scrolling with room to
> spare. Small type, tight spacing, big enough to tap.

**M4 — the Research page**

> [style block v2] Full phone screen, this one edge to edge: an aged
> parchment page, faintly creased, between the slim resource plank at the
> top and the slim five-tab nav beam at the bottom. A narrow wooden header
> strip reads "Civics" with three small tome tabs beside it — "Civics" lit,
> "Warfare" and "Magic" plain. On the page, a three-column grid of round
> wax-seal medallions, five rows, connected by dotted sepia trails; two
> trails inked gold. Each medallion carries a simple smooth symbol: an axe,
> a wheat sheaf, a scroll, a pickaxe, a sail, a sword, a cog, a crown… The
> top row is green wax with gold ticks; one in row two is blue with a thin
> progress ring; one is bright gold and unsealed; the rest plain; a
> horizontal gold "era bar" between rows three and four reads "100 cells
> revealed". Floating over the bottom of the page, a compact parchment card:
> a medallion thumbnail, "Bureaucracy", one line, a small book chip "12"
> and an hourglass "2m", and a compact green "Start" slab.

**M5 — the Store sheet**

> [style block v2] Full phone screen. The kingdom map fills the top 28%, warm-dimmed but visible, with the slim resource plank at the top. A bottom sheet covers the lower 72%, above the slim five-tab wooden nav beam where the gem "Store" tab is lit gold: a parchment panel in a thin carved wooden frame, a small rope grab-handle, and a narrow wooden header strip reading "Store" with a small round "✕" knob at its right end. Inside, a tiny sepia caps label "HEROES", then a parchment card with a thin wood border: a silver key icon at the left, "The common call" in bold, one short line "Every miss still pays fragments.", two tiny stat lines "Chance of a hero right now · 6%" and "A hero guaranteed within · 60 calls", and a row of two slabs — a blue "Free" slab and a wood-brown "Call ×10" slab with a small silver key chip "9". Below it a second, shorter card with a gold key: "The golden call", one line, and a gold "Call" slab with a violet gem chip "300". Then a caps label "BUILDERS" and a single row card: a hammer icon, "Another builder — build two things at once", and a wood slab with a gem chip "2500". Then a caps label "GEMS" and a 3-column grid of gem pack tiles: each a small parchment tile with a pile of violet gems (a small pouch, a chest) drawn smooth, a title "500 gems", and a leaf-green price slab "$0.99", "$4.99", "$9.99". Tight, evenly spaced, tappable; small type; everything smooth and tactile.

**M6 — the Heroes sheet**

> Same style, same materials and chrome as the mockups above. M6 — the Heroes sheet. Full phone screen. The kingdom map fills the top 22%, warm-dimmed, with the slim resource plank at the top. A tall bottom sheet covers the lower 78%, above the slim five-tab wooden nav beam where the helmet "Heroes" tab is lit gold: a parchment panel in a thin carved wooden frame, a small rope grab-handle, a narrow wooden header strip reading "Heroes" with a small round "✕" knob at its right end. Under the header a slim parchment strip reads "3 of 32 found". Below, a 3-column grid of hero cards, four rows visible: each card is a parchment tile with a thin wood border, a small ribbon at its top-left corner naming the class ("Warrior", "Lancer", "Archer", "Cavalry"), a smooth painted bust of the hero filling most of the tile, and a footer strip: for found heroes "Lv 3" with a row of five tiny gold stars (some lit); for unfound heroes the bust is a dim sepia silhouette and the footer shows a small blue stardust chip "4 / 10". One card wears a small gold "NEW" wax seal. Compact, even spacing, everything smooth and tactile, no pixel art in the interface.

**M7 — the Reliquary sheet**

> Same style, same materials and chrome as the mockups above. M7 — the Reliquary sheet. Full phone screen. The kingdom map fills the top 22%, warm-dimmed, with the slim resource plank at the top. A tall bottom sheet covers the lower 78%, above the slim five-tab wooden nav beam where the glowing chest "Relics" tab is lit gold: a parchment panel in a thin carved wooden frame, a small rope grab-handle, a narrow wooden header strip reading "Reliquary" with a small round "✕" knob at its right end. Inside, top: a slim parchment row with a pinch of glittering blue dust icon, "Stardust" in bold, one tiny line "Won from dungeons and the banner", and the number "50" at the right. Then a section title "Attuned" with a small right-aligned note "1 of 5 sockets" and a row of five round sockets like carved wooden rings: one holds a glowing relic, one is an empty dashed ring labelled "Empty", three are dim locked rings each with a tiny violet gem chip "1000". One short helper line. Then a section title "Relics" with a note "2 of 5 found" and a 3-column grid of relic cards: parchment tiles with a thin wood border, a smooth painted relic object in each — a forked dowsing rod, a green verdant seal, a foreman's iron sigil, a gilded ledger book, a brass wanderer's compass — the name under it in bold and a tiny line with a ruin icon naming where it is won ("Hollow Barrow", "Sunken Chapel"). Unfound relics are drawn as dim sepia silhouettes. Compact, tactile, smooth, no pixel art in the interface.

**M8 — the Daily chest sheet**

> Same style, same materials and chrome as the mockups above. M8 — the Daily chest sheet. Full phone screen. The kingdom map fills the top 25%, warm-dimmed, with the slim resource plank at the top. A bottom sheet covers the lower 75%, above the slim five-tab wooden nav beam (no tab lit): a parchment panel in a thin carved wooden frame, a small rope grab-handle, a narrow wooden header strip reading "Daily chest" with a small round "✕" knob at its right end. Inside, a top line with a small sand-timer "Season ends in 13d" at the left and "3 of 14" at the right, then one short helper sentence. Then two column headers side by side: a wood-brown slab "Free" and a gold slab with a tiny crown "Royal chest €9.99". Below them a ladder of rungs, one per day, numbered 1 to 7 visible on small round wooden day-badges down the middle: each rung is a row with a small parchment reward chip on the left (a violet gem icon "34", or "50" with a gold coin "200") and a wider parchment reward chip on the right (gold "500", a stardust pinch "1", a hero fragment). Days 1–3 are stamped taken with a small green wax tick; day 4 is lit gold and slightly raised as today's; days 5–7 are plain. At the bottom of the sheet a small centred line "Tap day 4 to take it." Compact, tactile, smooth, no pixel art in the interface.

**M9 — Settings and the Mana sheet, stacked**

> Same style, same materials and chrome as the mockups above. M9 — two small sheets on one phone screen, stacked to show both. Full phone screen over the kingdom map, warm-dimmed, slim resource plank at the top, slim five-tab wooden nav beam at the bottom. UPPER HALF: the "Settings" sheet — a parchment panel in a thin carved wooden frame with a narrow wooden header strip reading "Settings" and a small round "✕" knob; inside, a tiny sepia caps label "SOUND" over three rows — "Music / The harp loop", "Sound effects / Taps, coins, construction", "Ambience / Wind, waves, birdsong" — each with a chunky wooden toggle switch at the right, a rounded wood trough with a round brass knob, the first two switched on (leaf-green trough) and the third off; then a caps label "YOUR KINGDOM" and one row "Saved to this device"; then a caps label "START OVER" with a clay-red slab "Start over". LOWER HALF: the "Mana" sheet — the same parchment panel and header strip reading "Mana"; inside, a big violet mana orb at the left, "Mana" in bold and "Full in about 8h" at the right, a slim violet-blue gauge trough reading "64 / 100" filled two thirds, a line "Drawn from the land · +12/h", one tiny helper line, then a parchment card: "Refill now — a whole pool, on top of what you have", a large violet orb chip "+100", and two slabs side by side — a blue slab "Refill" with a violet gem chip "400" and a leaf-green slab "Watch a short ad". Compact, tactile, smooth, no pixel art in the interface.

**M10 — the battle board**

> Same style, same materials and chrome as the mockups above. M10 — the battle board, before a fight. Full phone screen. The kingdom map fills the top 15%, warm-dimmed, with the slim resource plank at the top. A tall bottom sheet covers the lower 85%, above the slim five-tab wooden nav beam: a parchment panel in a thin carved wooden frame, a small rope grab-handle, a narrow wooden header strip reading "Boars at the gate" with a small round "✕" knob at its right end. Inside, top: a square parchment vignette at the left with a small painted ruin (a mossy stone barrow with a dark doorway), and beside it "Hollow Barrow · tier 1" in bold and two short lines with a sand-timer "They come for the city in 2h 10m" and "Cleared, every unit of what they took comes home." Then a parchment card titled "Enemy army" with a bold power number "48" at the right and a row of three round wooden slots holding small painted boar-warrior busts with tiny "×4" "×2" "×1" count tags. Then a parchment card titled "Your army" with a power number "36" in clay red at the right, a row of four round slots — two holding painted soldier busts (a swordsman, an archer) with a tiny "×" corner mark, two empty slots with a "+" — a small sub-label "Heroes" and a second row of three round slots: one holding a hero portrait, one empty with a "+", one shut with a padlock and a tiny violet gem chip "300". Then a parchment card titled "Rewards" with a row of reward chips — a gold coin "699", logs "40", a rising golden chevron "+1" — and one small line. At the bottom a wide leaf-green slab "Clear the gate" with a small wheat chip "12" inside it, and one tiny line of small print under it. Compact, tactile, smooth, no pixel art in the interface.

**M11 — the map's bottom panels (the ruin card, the placement bar)**

> Same style, same materials and chrome as the mockups above. M11 — the map's bottom panels. Full phone screen over the bright pixel kingdom map (NOT dimmed, no sheet), slim resource plank at the top, slim five-tab wooden nav beam at the bottom with the hammer "Build" tab lit gold. Sitting just above the nav, a ruin card about 45% of the screen tall: a parchment panel in a carved wooden frame that is open at the bottom where it meets the nav (frame on three sides only), no header strip. Inside, top-left a square parchment vignette with a painted mossy stone barrow with a dark doorway; to its right "Hollow Barrow" in bold, a small line "Tier 1 ruin", and one short sentence. Below, a row of three compact stat tiles: a dungeon door "2 / 6 rooms", a sparkle "1·3 frontier", an archer helmet "Archers answer best". Then a small band with a boar-shield mark reading "Boars hold the way in" and "They raid the city in 2h 10m" with a sand-timer, and a wide leaf-green slab "Clear the gate" with a small wheat chip "12" inside. Floating above the card's top edge, a second, slimmer bar to show the other panel: a narrow parchment strip in a thin wood frame, a small cottage picture at the left, "Housing" in bold with one tiny line "Drag it, or tap where it should go" and a sand-timer "20s", and at the right two small slabs — wood "Cancel" and leaf-green "Build" with a logs chip "10" inside. On the map above, one cell is outlined gold with a faint cottage ghost on it. Compact, tactile, smooth; the interface is not pixel art.

**M12 — the things that float over the map**

> Same style, same materials and chrome as the mockups above. M12 — the small things that float over the map. Full phone screen over the bright pixel kingdom map (NOT dimmed, no sheet), slim resource plank at the top, slim five-tab wooden nav beam at the bottom. Show all of these at once, each where it lives: (1) top-left just under the plank, a small parchment pill with a gold border holding a painted treasure chest icon and two lines "Daily chest" / "Day 4 of 14"; (2) top-right under the plank, the round wooden knob with a cog; (3) hanging from the plank in the middle, a small gold cloth pennant with a rope along its top and a swallowtail bottom, holding a tiny cottage picture and three lines "NEW BUILDING" in small caps, "Housing" in bold, "Villagers live here and pay taxes"; (4) on the right edge, half-way down, two tabs sticking in from the edge, stacked: a dark clay-red wooden tab with a shield icon and two lines "Boar raid in 2h 10m" / "Hollow Barrow", and under it a small violet slab with a mana orb, "+100" and a little play triangle; (5) bottom-left above the nav, the parchment quest scroll from M1 ("Timber!", a slim gold trough "6/10", a wood "Show me" slab) with a red wax seal on its top-right corner; (6) just above the quest scroll, a small parchment slip with a thick clay-red left edge reading "Builders are at the ceiling"; (7) top-left under the daily pill, a tiny parchment chip with a hammer icon reading "1/1". Compact, tactile, smooth; the interface is not pixel art.

**M13 — Welcome back**

> Same style, same materials and chrome as the mockups above. M13 — the Welcome back sheet, the one a player sees on returning. Full phone screen. The kingdom map fills the top 35%, warm-dimmed, with the slim resource plank at the top. A bottom sheet covers the lower 65%, above the slim five-tab wooden nav beam: a parchment panel in a thin carved wooden frame, a small rope grab-handle, a narrow wooden header strip reading "Welcome back" (no close knob). Inside, a lede in bold "Your kingdom worked for 3h 20m." and a small line with a sand-timer "Your stores filled up before you got back." Then a parchment ledger card with one row per resource, each a painted icon, the name and a bold green "+" amount at the right: a gold coin "Gold +1,240", an apple "Food +86", logs "Wood +312", a stone "Stone +40", three villager heads "Villagers +2". Then a small brown caps label "WHILE YOU WERE AWAY" with a rule, and three parchment rows each with a small picture and a green wax tick at the right: a cottage "Housing #3 finished", a scroll with a candle "Forestry researched", a sparkle "A festival came and went". At the bottom a wide leaf-green slab "Collect". Compact, tactile, smooth, no pixel art in the interface.

**M14 — the payer profile and the purchase confirmation, stacked**

> Same style, same materials and chrome as the mockups above. M14 — two centred dialogs on one phone screen, stacked to show both, over the kingdom map warm-dimmed, slim resource plank at the top, slim five-tab wooden nav beam at the bottom. UPPER: "Who are you playing as?" — a parchment panel in a thin carved wooden frame with a narrow wooden header strip reading "Who are you playing as?" and NO close knob; inside, a large violet gem at the left of two short lines of copy, then four parchment option rows each with a bold name and a budget line at the left and a slab at the right: "F2P — No purchases" with a wood slab "Play as this", "Minnow — $10 a month", "Dolphin — $50 a month", "Whale — $200 a month" each with a violet slab "Play as this"; a tiny padlock line of fine print at the bottom. LOWER: "Confirm purchase" — the same parchment panel and header strip reading "Confirm purchase" with a small round "✕" knob; inside, a pile of violet gems at the left, "Purse of Gems" in bold and "2500 Gems" under it; then a small parchment ledger of three rows "Price · $4.99", "Left this month · $50.00", "After · $45.01" in green; two slabs side by side — wood "Not now" and leaf-green "Buy for $4.99"; and under them a small dashed clay-red stamp reading "SIMULADO — no real money changes hands". Compact, tactile, smooth, no pixel art in the interface.

**M15 — the hero call's reveal and the curtain**

> Same style, same materials and chrome as the mockups above. M15 — the hero call's reveal, full screen. Full phone screen: the kingdom map and the store sheet are dimmed to near-dark behind a warm translucent veil, the slim resource plank still visible at the top, the slim nav beam at the bottom. Centred at the top of the veil, a small wooden plaque with a gold rim reading "Rewards". Under it, a 3×2 grid of small parchment tiles in thin wood borders dealt onto the veil: a pinch of blue stardust "50", a gold coin "300", a hero fragment tile showing a dim portrait with a small blue shard badge "3", a violet gem "20", and one tile bigger than the others with a gold border and a painted hero bust with a small name tag "Warden" under it. Under the grid a small parchment caption "One call" and, faint, "Tap anywhere to finish". Also show, drawn at the right half of the screen as an inset to compare, the curtain a new hero gets: a full dark veil with gold rays, a small caps kicker "A NEW HERO ANSWERS", a large painted hero bust, the name "Warden" in bold, a line "Keeper of the gate", the word "Common" in a small parchment chip, and "Tap to continue". Compact, tactile, smooth; the interface is not pixel art.

**M16 — the battle playback**

> Same style, same materials and chrome as the mockups above. M16 — the battle playback, full screen. Full phone screen on a dark-earth cloth backdrop with faint parchment grain (no map visible), the slim resource plank at the top and the slim nav beam at the bottom. Across the top, a wooden power bar: a slim trough split by a fill, our number "36" at the left in leaf green, theirs "48" at the right in clay red, crossed swords at the split point. Under it a small parchment caption "Hollow Barrow · the gate" and a tiny line "Boars at the gate". The board fills the middle: two facing formations of round wooden slots. Theirs at the top: a hero row (one slot, a boar chieftain bust), a back row (two slots, boar archers), a front row (three slots, boar warriors), each with a small parchment count tag "×4" "×2" "×1". A gap with a faint dotted line and crossed swords. Ours at the bottom: a front row (three slots, swordsmen), a back row (two slots, archers), a hero row (one slot, a crowned hero). One slot in each front row is hit — ringed clay red with a small burst — and one enemy slot is knocked out, dimmed with a small skull badge. Over the middle, a wooden plaque with a gold rim reading "Victory" and under it a wood slab "Leave the field". Compact, tactile, smooth; the interface is not pixel art.

**M17 — the hero's and the relic's cards, stacked**

> Same style, same materials and chrome as the mockups above. M17 — two centred detail cards on one phone screen, stacked to show both, over the kingdom map warm-dimmed, slim resource plank at the top, slim five-tab wooden nav beam at the bottom. UPPER: a hero's card — a parchment panel in a thin carved wooden frame with no header strip; inside, a stage: a wide parchment vignette with a soft blue wash for a common hero, a small ribbon "Warrior" at its top-left, a round "✕" knob top-right, "Common" in a small parchment chip, two round wooden arrow knobs "‹" "›" at the sides of a large painted hero bust, and riding the vignette's bottom edge a row of five big gold stars (three lit) beside a leaf-green slab "Ascend" with a stardust chip "20" and a shard chip "10 / 10"; under the stage "Warden" in bold with the line "Keeper of the gate", three small parchment stat tiles (a sword "atk 12", a shield "def 8", a heart "hp 40"), a sparkle line "Warriors beside them hit 10% harder", and a bottom row "Level 3 of 10" with a leaf-green slab "Level Up" carrying a golden chevron chip "120". LOWER: a relic's card — the same panel; a stage with a small "Attuned" green wax tick badge, two round arrow knobs around a painted forked dowsing rod, and five small pips under it (two lit); "Dowsing Rod" in bold with "Level 2 of 5", a sparkle line "reveal costs −15%", a small block "Divination — reveal a cell for Mana, not Gold", two slabs side by side — wood "Remove" and a violet slab "Cast Divination" with a mana orb chip "25" — and under them a wood slab "Study" with a stardust chip "30". Compact, tactile, smooth; the interface is not pixel art.

**M18 — the tech card, the builder offer and the purse**

> Same style, same materials and chrome as the mockups above. M18 — three small surfaces on one phone screen over the kingdom map warm-dimmed, slim resource plank at the top, slim five-tab wooden nav beam at the bottom, arranged top to bottom. TOP: the research card that floats over the parchment tome page (as in M4): a small parchment card in a thin carved wooden frame, a round wax medallion with a golden axe at the left, "Forestry" in bold, one line "Unlocks the forests and the berry bushes", a small line with a sand-timer "Duration 3s", and two slabs side by side — a violet slab "Instant" with a violet gem chip "1441" and a leaf-green slab "Start" with a book chip "2"; a tiny line under them "Enough Knowledge in about 2h". MIDDLE: a "Builders" dialog — a parchment panel with a narrow wooden header strip reading "Builders" and a round "✕" knob; inside, a hammer in a small parchment vignette beside "Your builder is busy" in bold and one small line, a row of four round wooden rings — one holding a hammer on gold, three empty — and two slabs side by side: wood "Not now" and violet "Hire a builder" with a violet gem chip "2500". BOTTOM: a "Your purse" drawer — a parchment panel with a header strip "Your purse" and a round "✕" knob; inside one parchment ledger card with rows "Gold 1,240", "Gems 500", "Silver key 2", "Stardust 50", each a painted icon, the name and a bold number at the right, ruled between. Compact, tactile, smooth; the interface is not pixel art.

**M19 — a relic's card**

> Same style, same materials and chrome as the mockups above. M19 — a relic's card, centred on one phone screen over the kingdom map warm-dimmed, slim resource plank at the top, slim five-tab wooden nav beam at the bottom. A parchment panel in a thin carved wooden frame with no header strip, only a small round "✕" knob at its top-right. Inside, a stage: a wide parchment vignette with a warm amber wash, and centred on it a large smooth painted forked wooden dowsing rod with a faint golden glow behind it; riding the vignette's bottom edge a small wooden plaque with a gold rim reading "Level 3". Under the stage "Dowsing Rod" in bold, and beneath it a small sepia line with a sand-timer "+1 level when its album closes". Then a parchment ledger card of two ruled rows, each with a sparkle at the left: the first in dark ink, "Now — forests, crops and stone recover 30% faster", the second in faint muted ink, "At level 4 — 40% faster". Under it one slim parchment strip with a small round album medallion at the left, "First Furrow" in bold, and a gold-filled trough "7/9" at the right. NO buttons of any kind anywhere on the card except the "✕" knob. Compact, tactile, smooth; the interface is not pixel art.

M19 **replaces the lower half of M17**, which drew the relic card of the
previous model — attunement, a level cap, a cast button and a Stardust study
toll, every one of which the collection rework removed
([`../features/09-relics.md`](../features/09-relics.md) §13). Keep M17 for its
hero card.

**M20 — the season pill on the map**

> Same style, same materials and chrome as the mockups above. M20 — the season pill where it lives on the map. Full phone screen over the bright pixel kingdom map (NOT dimmed, no sheet), slim resource plank at the top, slim five-tab wooden nav beam at the bottom. Down the left edge under the plank, three things stacked in a column with small gaps, left-aligned: (1) at the top, the daily chest pill — a small parchment pill with a gold border, a painted treasure chest icon and two lines "Daily chest" / "Day 4 of 14"; (2) directly under it and slightly wider, THE SUBJECT OF THE IMAGE: the season pill — a parchment pill with a gold border and a soft golden glow around it, holding at its left a small round wax-and-gold season crest with a wheat sheaf on it, then three lines, "Sowing Season" in bold, a slim gold-filled trough with "12/45" on it, and a small sepia line with a sand-timer "9d left"; (3) under it, a tiny parchment chip with a hammer icon reading "1/1". Bottom-left above the nav, the parchment quest scroll ("Timber!", a slim gold trough "6/10", a wood "Show me" slab). The map is the hero of the image and the two pills read as a pair. Compact, tactile, smooth; the interface is not pixel art.

**M21 — the Collection sheet**

> Same style, same materials and chrome as the mockups above. M21 — the Collection sheet, the season's albums. Full phone screen. The kingdom map fills the top 20%, warm-dimmed, with the slim resource plank at the top. A tall bottom sheet covers the lower 80%, above the slim five-tab wooden nav beam where a "Collection" tab showing a small stack of cards is lit gold: a parchment panel in a thin carved wooden frame, a small rope grab-handle, a narrow wooden header strip reading "Sowing Season" with a small round "✕" knob at its right end. Inside, top: a wide banner card in a thin wood frame on a warm amber ground — a small caps line "COMPLETE ALL FIVE TO WIN", and under it two big reward chips side by side, a golden hero call (an ornate gold key with a painted hero bust behind it) and a heap of violet gems with "25,000" on it. Under the banner one slim line: a sand-timer "9d left" at the left and "12/45" at the right on a thin gold-filled trough. Then the five albums as ROUND MEDALLIONS, three across the first row and two centred on the second: each a circular painted vignette inside a carved wooden ring, its name in bold small caps under it and a small dark parchment pill under that with a count — first row "FIRST FURROW" with a painted dowsing rod over a ploughed field and "7/9", "THE WILD WOOD" with berries and a stag and "4/9", "HANDS AT WORK" with a hammer and a hard hat and "2/9"; second row "THE KING'S COIN" with a gilded ledger and coins and "0/9", "THE STAR ROAD" with a brass compass under stars and "0/9". Each ring carries a small badge at its lower-right, a tiny relic object on wax with a gold rim reading "Lv 3", "Lv 1", and the last three dim and padlocked. The "FIRST FURROW" medallion's ring is gold and slightly raised. At the bottom-right of the sheet, floating over its edge, a round wooden knob holding a small painted iron safe with a tiny gold star chip reading "38". Compact, tactile, smooth; the interface is not pixel art.

**M22 — an album's page**

> Same style, same materials and chrome as the mockups above. M22 — one album's page, the nine cards. Full phone screen. The kingdom map fills the top 12%, warm-dimmed, with the slim resource plank at the top. A tall bottom sheet covers the lower 88%, above the slim five-tab wooden nav beam: a parchment panel in a thin carved wooden frame, a small rope grab-handle, a narrow wooden header strip reading "The King's Coin" with a small round "✕" knob at its right end. Inside, top: a wide reward band in a thin wood frame on a warm amber ground — at its left a square framed vignette with a smooth painted gilded ledger book and a small plaque "Lv 2" on it, and to its right a small caps line "COMPLETE THE ALBUM TO WIN" over a row of three reward chips: a parchment chip with the same ledger and a bold gold "+1 LEVEL", a chip with a sand-timer and "8h of everything", and a chip with an ornate gold key and a violet gem "2,000". Below, a 3×3 grid of tall rounded cards filling most of the sheet, each card with a row of small stars ABOVE it and its name on a dark green ribbon along its bottom: row 1 — "Market Day" held, three gold stars, a painted market stall with coins; "Tax Ledger" missing, four grey stars, an empty grey card with a faint pattern and the name in grey; "The Mint" held, four gold stars, a painted coin press, a small white "+1" tag at its lower-left corner; row 2 — "Toll Bridge" held, three gold stars, a painted stone bridge with a gate; "Tithe Barn" missing, three grey stars; "Merchant's Seal" missing, four grey stars; row 3 — "Counting House" missing, five grey stars; "The Royal Purse" HELD AND GOLD, five gold stars, the whole card framed in ornate gold with a faint shine and a "+2" tag; "The Treasury" missing, five grey stars. Under the grid a small centred line "Album 4 of 5" and, in the two bottom corners, a round wooden "‹" knob and a round wooden "›" knob. Compact, tactile, smooth; the interface is not pixel art.

**M23 — the store's Cards shelf**

> Same style, same materials and chrome as the mockups above. M23 — the Store sheet, scrolled to its CARDS shelf. Full phone screen. The kingdom map fills the top 20%, warm-dimmed, with the slim resource plank at the top. A tall bottom sheet covers the lower 80%, above the slim five-tab wooden nav beam where the gem "Store" tab is lit gold: a parchment panel in a thin carved wooden frame, a small rope grab-handle, a narrow wooden header strip reading "Store" with a small round "X" knob at its right end. Inside, from the top: a tiny sepia caps label "CARDS" at the left with a small violet gem chip "1,155" at the right of the same line; then TWO parchment row cards, each in a thin wood border, and each laid out the same way — a square framed vignette at the left holding a painted sealed pack of cards, then a column of text, then a slab at the right. FIRST ROW: the vignette holds a warm cream pack with a gold wax seal; the text is "A gold pack" in bold, a small line "Five cards, and a chance of a gold edition", and a tiny sepia odds line "2★ 40% · 3★ 38% · 4★ 22%"; the slab is wood-brown reading "Buy" with a small violet gem chip "500" inside it. SECOND ROW: the vignette holds a deep violet pack with a gold star seal and three sparkles; the text is "A star pack" in bold, a small line "Six cards, one gold edition guaranteed", and a tiny sepia odds line "3★ 55% · 4★ 33% · 5★ 12%"; the slab is GOLD reading "Buy" with a violet gem chip "1,500" inside it. Under the two rows one small sepia line of fine print: "Bronze and silver packs come from the ruins." Below that, a tiny caps label "KEYS" and the top edge of the next row card, cut off by the bottom of the sheet to show the shelf continues. Compact, tactile, smooth; the interface is not pixel art.

**M24 — the wildcard, aimed and armed**

Two surfaces of ONE mechanic on one screen: the aimed offer that sells a
wildcard, and the album page with it armed. One generation keeps the two
halves consistent with each other, which two prompts would not guarantee.

> Same style, same materials and chrome as the mockups above. M24 - the wildcard, on two surfaces stacked on one phone screen to show both, over the kingdom map warm-dimmed, slim resource plank at the top, slim five-tab wooden nav beam at the bottom. UPPER HALF - the Store sheet scrolled to its CARDS shelf, the same shelf as the mockup above but with an AIMED OFFER at the top of it: a tiny sepia caps label CARDS with a small violet gem chip 655 at the right; then a wider offer card in a thin wood frame on a warm amber ground, slightly raised, with a tiny clay-red ribbon in its top-left corner reading FOR YOU - inside it a round carved wooden medallion at the left holding a small painted ploughed field at dawn, then a column of text, First Furrow in bold, a small line Two cards short, and a tiny sepia line A 3 star wildcard fills any of them, and at the right a violet slab reading Buy with a small violet gem chip 400 inside it; under the offer the two ordinary pack rows from before, cut off by the half. LOWER HALF - an album page, the 3 by 3 grid of the album First Furrow, where a wildcard is ARMED: across the top of the grid a slim clay-red strip with a small painted blank card at its left reading Tap a card to use your 3 star wildcard and a small wood knob at its right end reading Cancel; in the grid, four cards are held and painted, and the three MISSING cards that the wildcard could fill are outlined in bright gold with a soft glow and a small gold plus mark in the middle of each, while two other missing cards stay plain grey and dashed. Compact, tactile, smooth; the interface is not pixel art.

**A prompt this long loses itself on the way into the composer.** M23 and M24
both arrived as a stub on the first send. Type them with **no quotation marks
and no ★ glyphs** — spell the stars out, "3 star 55 percent" — and
**screenshot the composer before pressing send**; if it holds a stub, `ctrl+a`
`Delete` and retype.

The M5–M14 prompts open with "Same style, same materials and chrome as the
mockups above" instead of the style block because they were sent into the
conversation that already held it and M0; sent cold, paste the block first.

**M29 — where the Knowledge bar lives (OQ-104)**

Three candidate placements for one new gauge, stacked on one image so they
compare at a glance. The bar is 1 an hour up to 10, and stops earning while
full ([`../features/07-research.md`](../features/07-research.md) §3), so it
has to be readable from the map; the plank is already full.

> Same style, same materials and chrome as the mockups above. M29 - one tall image showing THREE alternative versions of the same phone screen top and bottom, stacked vertically and separated by a thin plain parchment gap, each with a small sepia caps label at its left edge: A, B, C. Each version is a horizontal strip cropped from the bright pixel kingdom map, with the slim carved wooden resource plank of M1 at its top and the slim five-tab wooden nav beam of M1 at its bottom (Store, Relics, Heroes, Research, Build). The plank holds, as in M1, a gold coin 1,240, an apple 86, logs 312, a stone block 40, a rope divider, the violet mana orb with its slim gauge, and a violet gem 10 with a small green plus knob. VERSION A - the knowledge gauge joins the plank: right after the mana gauge, a small open book icon in warm blue-teal ink with a slim trough beside it filled seven tenths, reading 7/10; the four resource counters are a touch narrower to make room, nothing else moves. VERSION B - the plank is exactly as in M1; the Research tab on the nav beam carries a small round parchment badge on its top-right corner with a tiny open book and 7/10, and a thin arc around the badge filled seven tenths. VERSION C - the plank and nav are exactly as in M1; on the right edge of the map, half-way down, one tab sticks in from the edge like the raid tab of M12: a warm teal cloth tab with a small open book icon and two short lines, Knowledge full and 10 of 10, with a tiny gold glint, shown as it appears only when the bar is full. Compact, tactile, smooth; the interface is not pixel art. Legible chunky lettering; if text is unclear, prefer fewer, larger words.

**M30 — a technology filling up, and buying Knowledge**

The research sheet once research has no time and no slots: Knowledge is
poured in over visits, then Gold completes it on the spot; and the sheet
that buys Knowledge with Gold (dearer every point, for ever) or Gems.

> Same style, same materials and chrome as the mockups above. M30 - two centred sheets on one phone screen, stacked to show both, over the parchment tome page of M4 warm-dimmed, slim resource plank at the top, slim five-tab wooden nav beam at the bottom with the scroll Research tab lit gold. UPPER - a technology sheet: a parchment panel in a thin carved wooden frame with a narrow wooden header strip reading Bureaucracy and a small round close knob; inside, a round wax medallion with a small crown at the left and one line Townhall level 3; a small row of two prerequisite medallions with green ticks; then a wide slim trough in warm blue-teal with a small open book icon at its left, filled a little over half, reading 14 / 25 Knowledge; under it a small sepia line with a sand-timer, 11 more, about 2 days of study; then a row of three slabs: a leaf-green slab Invest with a small book chip 7, and beside it a smaller wood slab Buy the rest with two chips stacked in it, a gold coin 6,600 and a violet gem 110; under the row a wide dimmed slab Research with a gold coin chip 1,200, shown disabled. LOWER - a Knowledge sheet: the same panel with a header strip reading Knowledge and a close knob; inside, a large open book icon in blue-teal at the left, Knowledge in bold, and at the right Full in 3h; a slim blue-teal gauge trough reading 7 / 10; one small line, One an hour while under ten; then a parchment card titled Buy Knowledge with a small minus and plus stepper around the number 5, and two slabs side by side: a wood slab Gold with a coin chip 3,000 and a tiny line under it, dearer every point, and a violet slab Gems with a gem chip 50. Compact, tactile, smooth; the interface is not pixel art. Legible chunky lettering; if text is unclear, prefer fewer, larger words.

**M31 — the Knowledge bar under the plank, centred**

The Knowledge bar paces the whole game, so it gets a piece of its own: a
base centred under the plank, as if it came out from behind the wooden bar
(Elvenar's placement), with a **+** like the Gems' that opens the purchase
sheet (M30, lower). Two material proposals, each in two states.

> Same style, same materials and chrome as the mockups above. M31 - one tall image showing TWO alternative designs for one new piece of chrome, each in two states, as FOUR horizontal strips stacked vertically and separated by a thin plain parchment gap, each with a small sepia caps label at its left edge: A1, A2, B1, B2 (1 while filling, 2 when full). Each strip is cropped from the top of the phone screen over the bright pixel kingdom map: the slim carved wooden resource plank of M1 across the very top, exactly as in M1 (a gold coin 128k, an apple 24k, logs 31k, a stone block 18k, a rope divider, the violet mana orb with its slim gauge, a violet gem 12k with a small green plus knob), the small Daily chest parchment pill at the top-left under the plank and the round wooden cog knob at the top-right under the plank. The new piece hangs CENTRED under the plank, between the pill and the cog, as if it comes out from behind the wooden bar, its top edge tucked under the plank's bottom edge. It is about a third of the screen wide. DESIGN A - a carved wooden base shaped like a shallow shield or a hanging sign, darker walnut than the plank, with a gold rim: at its left a small open book icon in warm blue-teal ink on a round brass boss, then a bold number 7, then a row of ten small rounded pips set into the wood like inlaid tiles, seven lit warm blue-teal and three dark, and under the pips a hair-thin brass line partly filled for the next point; at its right end a small round green plus knob exactly like the Gems plus knob. In A2, the full state, it shows 10, all ten pips lit and glowing softly, a tiny gold glint on the book, and the word Full in small caps under the pips. DESIGN B - a cloth-and-parchment tab, like a bookmark ribbon hanging from behind the plank: a deep blue-teal cloth band whose bottom edge is cut into a swallowtail, a large round parchment medallion with an open book bulging out at its left over the edge of the band, a bold 7 / 10 on the cloth in cream lettering, a slim cream trough filled seven tenths, a tiny sand-timer and 3h under it, and at its right end the same small round green plus knob as the Gems. In B2, the full state, it shows 10 / 10, the trough full with a warm gold sheen, and a small wax seal on the ribbon reading Full. Compact, tactile, smooth; the interface is not pixel art. Legible chunky lettering; if text is unclear, prefer fewer, larger words.

**M32 — M31's design A, tightened**

Design A kept, and brought into the plank's own language: the Knowledge coin
at the size of the coins above it, no boss behind it, and the icon, the
number and the pips in the same darkened frame a coin sits in. The progress
line becomes text that takes turns with a second line, the way the Mana
readout already alternates with its next unit's countdown.

> Same style, same materials and chrome as the mockups above. M32 - a refinement of design A from M31. One tall image of THREE horizontal strips stacked vertically, separated by a thin plain parchment gap, each with a small sepia caps label at its left edge: 1, 2, 3. Each strip is cropped from the top of the phone screen over the bright pixel kingdom map, with the slim carved wooden resource plank of M1 across the very top exactly as in M31 (gold coin 128k, apple 24k, logs 31k, stone block 18k, a rope divider, the violet mana orb with its slim gauge, violet gem 12k with a small green plus knob), the Daily chest parchment pill at the top-left under the plank WITH its two lines of text, Daily chest and Day 1 of 14, and the round wooden cog knob at the top-right under the plank. Centred under the plank, as in M31 design A, hangs the walnut wooden base with a gold rim, tucked behind the plank's bottom edge, but NARROWER than in M31 - about a quarter of the screen wide, so it fits between the pill and the cog without touching either. Inside the base, ONE darkened inset frame exactly like the dark rounded frames that hold each resource on the plank above, and inside that frame, from left to right: the knowledge icon, an open book with a white quill and a small red ribbon bookmark, drawn at the SAME size as the coin, apple and logs icons on the plank and with NO round boss or circle behind it; the bold number 7; and a row of ten small rounded pips, seven lit warm blue-teal and three dark. Under the pips, still inside the same dark frame, one small line of cream text instead of any progress line. To the right of the frame, on the wooden base, the small round green plus knob exactly like the Gems plus knob. STRIP 1: the small line reads +1 in 42m. STRIP 2: the same moment, the small line reads Full in 3h. STRIP 3: the full state, the number reads 10, all ten pips lit and glowing softly, a tiny gold glint on the book, and the small line reads Full. Compact, tactile, smooth; the interface is not pixel art. Legible chunky lettering; if text is unclear, prefer fewer, larger words.

**M33 — M32 simplified and narrowed**

The base loses its point and becomes a plain rounded tab; the ten pips become
narrow vertical segments packed tight, as in Elvenar's bar, so the whole
piece is narrow enough to clear the Daily chest pill at its real size.

> Same style, same materials and chrome as the mockups above. M33 - a refinement of M32. One tall image of THREE horizontal strips stacked vertically, separated by a thin plain parchment gap, each with a small sepia caps label at its left edge: 1, 2, 3. Each strip is cropped from the top of the phone screen over the bright pixel kingdom map, with the slim carved wooden resource plank across the very top exactly as in M32 (gold coin 128k, apple 24k, logs 31k, stone block 18k, a rope divider, the violet mana orb with its slim gauge, violet gem 12k with a small green plus knob), the Daily chest parchment pill at the top-left under the plank at its FULL real size as in M1 and M12, with its two lines of text Daily chest and Day 1 of 14, and the round wooden cog knob at the top-right under the plank. Centred under the plank hangs the Knowledge piece, tucked behind the plank's bottom edge, and it must leave a clear gap of open map on both sides between it and the pill and between it and the cog. Two changes from M32. FIRST, the base is SIMPLER: a plain walnut tab with a thin gold rim, a perfectly straight bottom edge and gently rounded bottom corners, no point, no notch, no scroll or curl at the bottom centre, no decoration. SECOND, it is NARROWER - about 28 percent of the screen wide: the ten pips are replaced by a compact segmented gauge of ten NARROW TALL vertical segments packed tightly side by side with hairline gaps, like the segments of a battery meter, each segment much taller than it is wide; lit segments warm blue-teal, unlit segments dark. Inside the base, one darkened inset frame like the frames of the resources on the plank, holding from left to right: the open book with a white quill and a small red ribbon bookmark at the same size as the plank's icons with no circle behind it, the bold number 7, and the segmented gauge with seven segments lit; under the gauge, inside the same frame, one small line of cream text. To the right of the frame, the small round green plus knob exactly like the Gems plus knob. STRIP 1: the small line reads +1 in 42m. STRIP 2: the same moment, it reads Full in 3h. STRIP 3: full, the number reads 10, all ten segments lit and glowing softly, a tiny gold glint on the book, and the line reads Full. Compact, tactile, smooth; the interface is not pixel art. Legible chunky lettering; if text is unclear, prefer fewer, larger words.

**M37–M39 — the research book, three proposals** ([`../plans/research-book.md`](../plans/research-book.md))

Each is one image of two phone screens: the book page, and a technology's
sheet over it. They differ in where the bookmarks sit, what a card is and
what the sheet is made of: M37 top ribbons, plate cards and a framed sheet;
M38 bottom ribbons, round medallions with ring gauges and a pinned leaf; M39
a two-page spread, ledger tabs, Elvenar-style label cards and a drawer.

> Same style, same materials and chrome as the mockups above. M37 - the research screen redesigned as a page of a magic book, for research with no time: Knowledge is poured into a technology until its bar is full, then Gold is paid and it is researched at once. ONE wide image with TWO portrait phone screens side by side, each a full phone screen with the slim carved wooden resource plank of M1 at the top (a gold coin 1,240 and the open book with a quill 7 for Knowledge, a rope divider, the violet mana orb gauge, a violet gem 500 with a green plus knob) and the slim five-tab wooden nav beam at the bottom with the scroll Research tab lit gold. LEFT SCREEN, the book: an open magic book seen from above filling the screen between plank and nav, one page of aged yellowed parchment inside a tooled dark red leather cover whose edge shows around the page. Along the TOP edge of the page, three cloth bookmark ribbons hang down into the page, each with a small embroidered emblem: a cream ribbon with a scroll for Civics, pulled out longer and lit, a red ribbon with crossed swords for Warfare and a blue ribbon with an orb for Magic, both flush and plain. On the page, an illuminated chapter heading in red and gold ink reads Civics, Chapter I. Below it a three-column flow of technology cards joined by inked lines, gold ink where a card is researched and sepia elsewhere: each card is a small parchment plate with a thin wood border, a title band with the name, a painted emblem, and along its foot a slim blue-teal Knowledge bar with the numbers. Show the four states: two cards Researched with a gold wax seal and no bar (Forestry, Agriculture); one Ready card glowing warm gold with its bar full, 8 / 8 and a green tick (Farming); two Pouring cards with part-filled bars, 5 / 8 and 0 / 5; and one dim dashed card with a question mark. Further down, a second chapter heading, Civics, Chapter II, with a small line under it, Reveal 14 more cells, and the cards under it drained of colour. RIGHT SCREEN, the technology sheet: the same book page blurred behind a centred parchment sheet in a carved wooden frame with a wooden header strip reading Saws and a round red close knob. Inside: the emblem at the left with one line, Unlocks the Sawmill, and a small picture of the sawmill; a row of two small requirement medallions with green ticks; a wide blue-teal Knowledge bar reading 5 / 8; under it three buttons side by side, a wooden button +1 with the book icon, a wooden button +2 with the book icon, and a small caption Buy the other 1 over two buttons, a wooden one with a gold coin 100 and a violet gem one with 10; then a label Cost to research over a single price tile with a gold coin 500; and at the bottom one wide green button Research, dimmed because the bar is not full. Compact, tactile, smooth; the interface is not pixel art. Legible chunky lettering; if text is unclear, prefer fewer, larger words.

> Same style, same materials and chrome as the mockups above. M38 - the research screen redesigned as a page of a magic book, for research with no time: Knowledge is poured into a technology until its bar is full, then Gold is paid and it is researched at once. ONE wide image with TWO portrait phone screens side by side, each a full phone screen with the slim carved wooden resource plank of M1 at the top (a gold coin 1,240 and the open book with a quill 7 for Knowledge, a rope divider, the violet mana orb gauge, a violet gem 500 with a green plus knob) and the slim five-tab wooden nav beam at the bottom with the scroll Research tab lit gold. LEFT SCREEN, the book: an open magic book filling the screen, one page of aged parchment with an ornate inked border, inside a brown tooled leather cover. The bookmarks hang from the BOTTOM edge of the page, just above the nav beam, like the ribbon tabs of an old spellbook: three swallowtailed cloth ribbons side by side, cream with a scroll emblem for Civics lit and longer, red with crossed swords for Warfare, blue with an orb for Magic. At the top of the page an illuminated drop-capital chapter heading reads Chapter I, with Civics in small caps under it. Below, a three-column flow of ROUND wax-seal medallions joined by dotted inked trails, each medallion ringed by a thin circular Knowledge gauge that fills clockwise in blue-teal, with the name in small ink under it and the numbers under the name. States: two green-wax medallions with a gold tick, researched, their trails inked gold; one medallion with a full glowing gold ring and a small green tick badge, Ready, 8 / 8; two with part-filled rings, 5 / 8 and 0 / 5; and one faint fold in the parchment with a question mark. Lower, an illuminated heading Chapter II with Reveal 14 more cells, and grey unwaxed medallions under it. RIGHT SCREEN, the sheet: the book page blurred behind, and over it a sheet that looks like a loose parchment leaf with torn deckled edges pinned into the book by a red wax seal at its top, no wooden frame. Inside: a large wax medallion at the top with the name Saws in bold under it and one line, Unlocks the Sawmill, with a small picture of the sawmill; two requirement medallions with ticks; a round Knowledge gauge with 5 / 8 in its middle, and beside it a column of pour buttons: +1 and +2 with the book icon on wooden slabs, then Buy the other 1 with a gold coin 100 and a violet gem 10 slab; under all of it a price tile with a gold coin 500 and a wide green Research slab, dimmed. Compact, tactile, smooth; the interface is not pixel art. Legible chunky lettering; if text is unclear, prefer fewer, larger words.

> Same style, same materials and chrome as the mockups above. M39 - the research screen redesigned as a page of a magic book, for research with no time: Knowledge is poured into a technology until its bar is full, then Gold is paid and it is researched at once. ONE wide image with TWO portrait phone screens side by side, each a full phone screen with the slim carved wooden resource plank of M1 at the top (a gold coin 1,240 and the open book with a quill 7 for Knowledge, a rope divider, the violet mana orb gauge, a violet gem 500 with a green plus knob) and the slim five-tab wooden nav beam at the bottom with the scroll Research tab lit gold. LEFT SCREEN, the book: an open magic book with BOTH pages visible in portrait, the left and right pages meeting at a stitched spine down the middle of the screen, parchment inside a dark green tooled leather cover with brass corners. Along the TOP edge, leather tabs stick up from behind the pages like index tabs of a ledger, each with a stamped emblem: Civics with a scroll lit and raised, Warfare with crossed swords, Magic with an orb, and a fourth locked tab with a padlock for a found book. The chapter heading, Civics, Chapter I, is lettered across both pages. The technology cards are elongated labels in the style of Elvenar's research cards: a narrow wooden title plate with the name, and under it a parchment strip holding the emblem at the left and a long blue-teal Knowledge bar with the numbers at the right; three columns flow down across the two pages joined by inked arrows, gold where researched. States: researched cards with the bar full green and a green tick; one Ready card whose bar is full and glowing gold with a small gold coin badge at its end meaning pay to finish; Pouring cards at 5 / 8 and 0 / 5; a question mark card. Lower, Chapter II with Reveal 14 more cells, drained cards. RIGHT SCREEN, the sheet: the book blurred behind, a wide sheet sliding up from the bottom like a drawer, parchment in a carved wooden frame with a wooden header strip reading Saws and a red close knob. Inside, two columns: at the left a tall picture of what it unlocks, the sawmill, over the line Unlocks the Sawmill and the requirement medallions; at the right the Knowledge bar 5 / 8, three pour buttons stacked, +1, +2 and Buy 1 with its two prices, gold coin 100 and violet gem 10, then Cost to research with a gold coin 500 tile, and a wide green Research slab, dimmed. Compact, tactile, smooth; the interface is not pixel art. Legible chunky lettering; if text is unclear, prefer fewer, larger words.

**M40–M42 — the research book, second round** ([`../plans/research-book.md`](../plans/research-book.md))

One page, never a spread, on a stack of papers; the nav bar gone and the
bookmarks in its place; every technology visible in one of three states;
the sheet in three areas with the last locked until the Knowledge is in; and
simpler than M37–M39. M40 ribbons and Elvenar-like cards; M41 a scroll,
square tiles and a stepped sheet; M42 a pinned stack, index tabs and pill
cards.

> M40 - a NEW round of proposals for the research screen, research with no time: Knowledge is poured into a technology until its bar is full, then Gold is paid and it is researched at once. KEEP IT SIMPLE, much simpler than your last three images: flat warm colours, soft two-tone shading, a thin dark brown outline, very few ornaments, no filigree, no torn or burnt edges, no heavy texture or grain, big clear shapes, friendly and readable, exactly the level of detail of the chrome in the attached reference. ONE wide image with TWO portrait phone screens side by side. Both have the slim wooden resource plank at the top (a gold coin 1,240, the open book with a quill 7 for Knowledge, a rope divider, the violet mana orb gauge, a violet gem 500 with a green plus knob) and NO nav bar at the bottom: the nav bar is hidden while this screen is open. The screen is ONE single sheet of parchment centred on the screen, never an open book and never two pages, lying on a small stack of two or three other sheets offset behind it, over the dimmed map. Every technology is always visible, there are no question marks and nothing hidden, and each is in one of three states: UNDISCOVERED, drawn in greyscale with a small padlock at the end of its bar; IN PROGRESS, in full colour with a blue-teal Knowledge bar showing poured over needed, and when the bar is full it glows gold as the one card asking to be finished; COMPLETED, a full green bar with a green tick. LEFT SCREEN: the sheet fills the screen between the plank and the bottom. From the sheet's BOTTOM edge four cloth bookmark ribbons of the SAME shape hang down into the space the nav bar left, differing only in colour and emblem: cream with a scroll (Civics, pulled out longer, selected), red with crossed swords (Warfare), blue with a sun orb (Magic), and a grey one with a padlock (a book not found yet). At the top of the sheet a simple chapter heading, Chapter I, between two thin ink lines. Cards in three columns, joined by plain ink lines, gold where completed: each card is Elvenar-like, a wooden title plate with the name over a parchment strip holding the emblem at the left and the bar at the right with its numbers. Show Forestry and Agriculture completed, Farming in progress full and glowing 8 / 8, Saws in progress 5 / 8, Irrigation in progress 0 / 5, and a row of three undiscovered greyscale cards with padlocks (Masonry 0 / 10, Mining 0 / 12, Fishing 0 / 8). Lower, a chapter heading Chapter II with Reveal 14 more cells under it, and greyscale cards below. RIGHT SCREEN: the same sheet dimmed behind a centred parchment panel in a carved wooden frame with a wooden header strip reading Saws and a round red close knob. The panel is split into THREE clearly separate stacked areas, each a slightly darker paper tile with a small numbered circle at its top-left: 1 ABOUT, the emblem, one line Unlocks the Sawmill with a small picture of the sawmill, and two requirement chips with green ticks; 2 KNOWLEDGE, a wide blue-teal bar 5 / 8, and a row of wooden buttons +1 and +2 with the book icon, then Buy the other 1 over a wooden gold coin 100 button and a violet gem 10 button; 3 RESEARCH, a gold coin 500 price and a wide green Research button, the WHOLE third area dimmed and greyed with a padlock and the line Fill the Knowledge first. Legible chunky lettering; if text is unclear, prefer fewer, larger words.

> M41 - a NEW round of proposals for the research screen, research with no time: Knowledge is poured into a technology until its bar is full, then Gold is paid and it is researched at once. KEEP IT SIMPLE, much simpler than your last three images: flat warm colours, soft two-tone shading, a thin dark brown outline, very few ornaments, no filigree, no torn or burnt edges, no heavy texture or grain, big clear shapes, friendly and readable, exactly the level of detail of the chrome in the attached reference. ONE wide image with TWO portrait phone screens side by side. Both have the slim wooden resource plank at the top (a gold coin 1,240, the open book with a quill 7 for Knowledge, a rope divider, the violet mana orb gauge, a violet gem 500 with a green plus knob) and NO nav bar at the bottom: the nav bar is hidden while this screen is open. The screen is ONE single sheet of parchment centred on the screen, never an open book and never two pages, lying on a small stack of two or three other sheets offset behind it, over the dimmed map. Every technology is always visible, there are no question marks and nothing hidden, and each is in one of three states: UNDISCOVERED, drawn in greyscale with a small padlock at the end of its bar; IN PROGRESS, in full colour with a blue-teal Knowledge bar showing poured over needed, and when the bar is full it glows gold as the one card asking to be finished; COMPLETED, a full green bar with a green tick. A different proposal. LEFT SCREEN: the sheet is a plain parchment scroll unrolled on the screen, with a simple wooden roller along its top edge only, the bottom edge flat. From that bottom edge hang four identical flat bookmark tabs with straight cut ends in the space the nav bar left, each a coloured cloth band with a round emblem medallion: cream scroll for Civics selected and longer, red crossed swords for Warfare, blue orb for Magic, grey padlock for a book not found. Chapter headings are a simple parchment banner ribbon across the page, Chapter I, and lower Chapter II with Reveal 14 more cells. Cards in three columns are SQUARE tiles: the emblem big in the middle, the name under it, and a slim bar across the bottom with its numbers; connectors are simple ink lines, gold where completed. Show Forestry and Agriculture completed, Farming in progress full and glowing 8 / 8, Saws 5 / 8, Irrigation 0 / 5, and three greyscale undiscovered tiles with padlocks. RIGHT SCREEN: the scroll dimmed behind a centred sheet with a wooden header strip reading Saws and a red close knob. Inside, the THREE areas are three STEPS joined by a short vertical dotted line at the left, each step a numbered round badge beside its tile: step 1 About, a larger picture of the sawmill with Unlocks the Sawmill and the two requirement chips ticked; step 2 Knowledge, the bar 5 / 8 with +1 and +2 buttons and Buy the other 1 with a gold coin 100 and a violet gem 10 button; step 3 Research, the gold coin 500 price and a green Research button, the whole step greyed out with a padlock badge and Fill the Knowledge first, its numbered badge grey while steps 1 and 2 are gold. Legible chunky lettering; if text is unclear, prefer fewer, larger words.

> M42 - a NEW round of proposals for the research screen, research with no time: Knowledge is poured into a technology until its bar is full, then Gold is paid and it is researched at once. KEEP IT SIMPLE, much simpler than your last three images: flat warm colours, soft two-tone shading, a thin dark brown outline, very few ornaments, no filigree, no torn or burnt edges, no heavy texture or grain, big clear shapes, friendly and readable, exactly the level of detail of the chrome in the attached reference. ONE wide image with TWO portrait phone screens side by side. Both have the slim wooden resource plank at the top (a gold coin 1,240, the open book with a quill 7 for Knowledge, a rope divider, the violet mana orb gauge, a violet gem 500 with a green plus knob) and NO nav bar at the bottom: the nav bar is hidden while this screen is open. The screen is ONE single sheet of parchment centred on the screen, never an open book and never two pages, lying on a small stack of two or three other sheets offset behind it, over the dimmed map. Every technology is always visible, there are no question marks and nothing hidden, and each is in one of three states: UNDISCOVERED, drawn in greyscale with a small padlock at the end of its bar; IN PROGRESS, in full colour with a blue-teal Knowledge bar showing poured over needed, and when the bar is full it glows gold as the one card asking to be finished; COMPLETED, a full green bar with a green tick. A third, different proposal. LEFT SCREEN: the sheet is a stack of loose parchment sheets fanned slightly, the top one straight, held at its top corners by two small brass pins. The bookmarks are four identical leather tabs sticking out from under the BOTTOM of the stack into the space the nav bar left, rounded tabs like index tabs, each tinted and stamped with an emblem: Civics scroll (selected, raised higher), Warfare crossed swords, Magic orb, and one grey with a padlock. Chapter headings are just bold ink lettering with a short line under it, Chapter I, and lower Chapter II with Reveal 14 more cells. Cards in three columns are PILL cards: a round emblem medallion at the left overlapping a horizontal rounded plate that holds the name on top and the bar under it; connectors are simple ink lines, gold where completed. Show Forestry and Agriculture completed, Farming in progress full and glowing 8 / 8, Saws 5 / 8, Irrigation 0 / 5, and three greyscale undiscovered pills with padlocks. RIGHT SCREEN: the stack dimmed behind a centred parchment sheet in a thin wooden frame, header strip reading Saws, red close knob. Inside, THREE areas stacked like three index cards, each with a small tab label on its top edge: ABOUT with the emblem, Unlocks the Sawmill, a picture of the sawmill and two ticked requirement chips; KNOWLEDGE with the bar 5 / 8, +1 and +2 buttons and Buy the other 1 with gold coin 100 and violet gem 10 buttons; RESEARCH with the gold coin 500 price and a green Research button, this last card greyed out with a padlock and Fill the Knowledge first. Legible chunky lettering; if text is unclear, prefer fewer, larger words.

### 7.26 The collection's pieces (C1, C2, C3)

The four screens of [`../features/09-relics.md`](../features/09-relics.md) §11
need three sheets. **C1 is the art the screens are built on** — the five album
medallions M21 draws as round vignettes, and the four packs the reveal deals —
and **C2 is four atlas marks**, which append to `ui-e2-marks`'s empty fourth
row rather than redrawing the twelve that sheet already holds.

The 45 card faces are NOT here and are a content job, not a sheet: a card is
drawn as its album's medallion behind its name and its rarity stars, which is
what makes a nine-card page read as one album.

**C1 — the medallions and the packs**

> Same style as the interface objects in the mockups above (smooth, chunky, thin dark-brown outline, soft two-tone shading, small highlight, NO pixel art). One square sprite sheet, 1024x1024, a strict 3x3 grid of equal 341px cells with a fully TRANSPARENT background, one subject centred in each cell filling about 80% of it and NOTHING crossing the lines between cells (leave a clear 40px band). Cells 1 to 5 are ROUND painted vignettes, a circular scene inside a thin carved wooden ring: 1 a ploughed field at dawn with a forked wooden dowsing rod standing in the furrow; 2 a mossy woodland with a stag, red berries and a beehive; 3 a timber scaffold with a hammer, a hard hat and a stone block; 4 a market counter with a gilded ledger book, stacked gold coins and a purse; 5 a night road under stars with a brass compass and a lantern post. Cells 6 to 9 are OBJECTS, not vignettes — four card packs seen at a slight angle, each a small sealed paper wallet of cards with a wax seal and two or three card corners fanning out of the top: 6 a plain brown one with a bronze seal; 7 a pale grey-blue one with a silver seal; 8 a warm cream one with a gold seal and one tiny sparkle; 9 a deep violet one with a gold star seal, a gold rim and three sparkles. No text, no labels, no numbers, no frame lines between cells. Do not run any code to check or correct the alpha channel.

**C3 — the five relics, repainted**

The relic card (M19) draws its subject at 170px on parchment, and the shipped
sprites were 128px MAP pixel art borrowed by a UI screen. Same grid and same
reading order as `spr-c-relics`'s manifest entry, so it replaces that sheet
rather than adding one — and the entry gains `evenGrid` (the rod lies
diagonally over its cell's edge) and `spriteSize: 256` (128 is a map sprite's
size, and these are never on the map).

> Same style as the interface objects in the mockups above (smooth, chunky, thin dark-brown outline, soft two-tone shading, small highlight, NO pixel art). These are the five RELICS, each drawn as a single object on its own, the way the card in the mockup above draws the dowsing rod — they sit on a parchment card at about 170px tall, never on the map. One square sprite sheet, 1024x1024, a strict 3x2 grid of six equal cells with a fully TRANSPARENT background, one object centred in each cell filling about 80% of it and NOTHING crossing the lines between cells (leave a clear 40px band), seen from slightly above at a three-quarter angle, in this exact reading order: 1 a forked wooden dowsing rod, a Y of two peeled branches with a leather-wrapped grip and a small blue crystal bound at the fork; 2 a round green wax seal on a short oak handle, a curling leaf pressed into the wax and two ivy leaves growing from the handle; 3 an iron foreman's sigil, a heavy square medallion stamped with a crossed hammer and set-square, hanging from a short leather strap; 4 a thick ledger book bound in deep red leather with gilded page edges, a gold clasp and a small gold crown on the cover; 5 a brass pocket compass, open, its lid at an angle, a star engraved on the dial; 6 leave this cell EMPTY, nothing drawn in it. No text, no labels, no numbers, no frame lines between cells. Do not run any code to check or correct the alpha channel.

**C2 — the collection's marks**

> Same style as the icon sheets above: these must be SYMBOLS, not little characters — no faces, no bodies, no people. THICK and CHUNKY, at least 20 pixels of stroke at this canvas size, so they survive being shrunk to 64px. One square sprite sheet, 1024x1024, a strict 2x2 grid of equal 512px cells with a fully TRANSPARENT background, one symbol centred in each cell filling about 86% of it and nothing crossing the lines between cells, in this exact reading order: 1 a sealed pack of cards with two card corners fanning out of the top; 2 a fan of three playing cards, face down, as a stack; 3 a small iron safe with a round brass dial and two hinges; 4 a round wax seal with a gold rim and a wheat sheaf pressed into it. No text, no labels, no numbers. Do not run any code to check or correct the alpha channel.

### 7.20 Export and where it lands

- Sheets: 1024×1024, true alpha — use the **"Download the corrected PNG"**
  link in the message body, never the image editor's download
  (`ui/CONVERSATION.md`); verify with
  `magick sheet.png -format "%[pixel:p{0,0}]" info:` → `srgba(0,0,0,0)` and
  `magick identify sheet.png` → `1024x1024`. Files go to
  `Docs/art/ui/sheets/ui-{a2,b2,c2,d2,e2}-*.png`; then
  `node scripts/ui-atlas.mjs build` (cell 64, smooth resample) and
  `npm run art:check`.
- Mockups: 1080×2340 PNG, opaque, to `Docs/art/ui/mockups/m{1..22}-*.png`.
  They are references for the board and the CSS, never assets.
- Every generation is logged in `ui/CONVERSATION.md`: date, conversation
  link, model, file, which prompt and which iteration phrases.


### 7.21 Surfaces and decorations, smooth — the material the chrome is made of

The mockups (§7.19) draw the panels as real parchment in real carved wood;
the kit drew them as flat colour with bevels. These sheets close that gap.
Textures are TILES the CSS repeats under the existing geometry (the frame
stays a border with a radius, §3.2); decorations are loose objects placed
by the kit; the frame sheet is an experiment — image models struggle with
nine-slices, so it ships only if its corners register.

**T1 — textures (opaque, 2×2 tiles of 512)**

> [style block v2] …but instead of a screen: one square image, 1024×1024,
> divided into a strict 2×2 grid of four equal 512×512 tiles that touch edge
> to edge with no gap and no separator. Each tile is a seamless, self-tiling
> texture: its left edge continues perfectly into its right edge and its top
> into its bottom, so it repeats as wallpaper with no visible seam. TOP-LEFT:
> aged parchment, #F4E4C1 with faint #E2CCA0 mottling and fibre, very low
> contrast. TOP-RIGHT: carved light wood plank grain, #A9713F with #5C3A1E
> grooves and #C89159 highlights, soft and smooth, not pixelated. BOTTOM-LEFT:
> the same wood, darker, in #5C3A1E with #3B2412 grooves. BOTTOM-RIGHT: plain
> cream cloth weave, #FFF6E0, very low contrast. Smooth shading, no objects, no
> text, no borders, fully opaque.

**D1 — decorations (transparent, 2×3)**

> [style block v2] …but instead of a screen: one square image, 1024×1024,
> fully transparent background, a strict 2 rows × 3 columns grid of six
> separate objects, one centred in each cell, none touching a boundary,
> reading order: (1) a short horizontal rope grab handle, two loops of tan
> rope with a knot at each end, wide; (2) a short vertical rope divider, one
> strand; (3) a round red wax seal with a small crown pressed into it; (4) a
> round carved wooden knob, blank face, with a dark rim and a soft highlight;
> (5) an iron nail head, small; (6) a cloth pennant, cream with a red
> swallowtail edge, hanging from a short rope. Smooth shading, thin dark
> outline, alpha 0 everywhere else. Then apply the true-alpha transparency
> correction and give me the download link for the corrected PNG.

**F1 — the frame, as a nine-slice (experiment)**

> [style block v2] …but instead of a screen: one square image, 1024×1024. A
> carved wooden picture frame, #A9713F face with a #5C3A1E outline and a
> #C89159 top bevel, 96 pixels thick on every side, with softly rounded outer
> corners, drawn around a completely transparent centre. The four corners
> must be identical to each other (rotated), and every edge must be a
> straight, uniform run of the same grain so it can be stretched, so that the
> image can be cut into nine slices and used as a resizable border. No
> objects, no text, no background, alpha 0 in the centre and outside the
> frame. Then apply the true-alpha transparency correction and give me the
> download link for the corrected PNG.

Where they land: textures to `src/ui/assets/tex-*.png` (512 tiles, ≤ 60 KB
each after `magick -strip -quality 85` to JPEG if opaque), decorations
sliced by the atlas script as a smooth sheet (`ui-f2-decor.png`, 2×3), the
frame — if it passes — to `src/ui/assets/frame-wood.png` for
`border-image-slice: 96`.


### 7.22 Research medallions (R1)

M4 draws every technology as a wax-seal medallion; the page today draws a
parchment card with a glyph and a name. One sheet gives the medallion its
four states; the glyph stays the kit's icon on top, the name stays under it.

> [style block v2] …but instead of a screen: one square image, 1024×1024,
> fully transparent background, a strict 2×2 grid of four separate round wax
> seal medallions, one centred in each cell, none touching a boundary, all the
> same size (~380 px): a wax disc with a softly scalloped, slightly irregular
> rim, a raised flat centre with NO emblem, and one soft highlight. TOP-LEFT:
> pale parchment-tan wax (#E2CCA0) — a technology not yet earned. TOP-RIGHT:
> leaf green wax (#6FBF4A) — done. BOTTOM-LEFT: warm gold wax (#F2B233) —
> ready to start. BOTTOM-RIGHT: sky blue wax (#4FA3C7) — in progress. Smooth
> shading, thin dark brown outline, alpha 0 everywhere else. Then apply the
> true-alpha transparency correction and give me the download link for the
> corrected PNG.

Lands in `src/ui/assets/seal-{plain,done,available,active}.png`, ≤ 160px,
behind `.tech-card-glyph`.

## 8. Open questions

1. ~~**Bottom sheets vs. the single-Close nav.**~~ — **decided**: replace the
   swap-to-Close bar with a persistent three-tab nav plus a per-sheet close
   knob (§5.4). It remains the biggest behavioural change here, so it lands
   as its own commit and is revertible on its own if it feels worse in the
   hand than it reads on paper.
2. **Unit art.** ~~The Army screen assumes unit portraits that do not exist.~~
   **Escalated 2026-09-02, and no longer optional.** Units gain ATK/DEF/HP and a
   matchup chart, so the player must distinguish four unit types at a glance;
   heroes and artifacts add five portraits and five relic icons on top. That is a
   **new class of art** — the world set is deliberately zoomed-out and
   impersonal, and a face is the opposite of that. The style question has to be
   answered before a set is generated. See `Docs/art/art-direction.md`.
3. ~~**How many currencies should ever be visible?**~~ — **answered
   2026-09-02**, not by a UI rule but by cutting the currencies. The wallet
   went from eleven rows to seven: berry bushes, game and shoals pay Food and
   iron veins pay Stone, so the plank's worst case is **four coins** (Gold,
   Food, Wood, Stone) and its opening case is three. Knowledge left the header
   entirely — it buys relic and hero levels and nothing else, so it reads in
   the Reliquary beside what it pays for. The hide-an-unused-coin rule this
   question floated is not needed. See
   [`../features/03-economy.md`](../features/03-economy.md).
4. **Research metaphor cost.** Re-skinning the tree as a parchment map is
   the most expensive item in this document. The mechanics stay identical,
   so it can ship last.
6. **The checkpoint breaks the one-primary-action rule** (§2.2) on purpose, and
   it is the only screen that does. If two equal-weight choices read as
   indecision rather than as a genuine fork in playtest, the fix is more contrast
   between the two paths — not promoting one of them to primary, which would
   answer the question for the player.
7. ~~**Does the header survive a sixth number?**~~ — **answered 2026-09-02**:
   there is no sixth number. Four coins at the worst, Mana's gauge (permanent,
   it is the visit clock) and Gems past the rope. The currency cut in question
   3 removed the pressure this question was about.
5. ~~**Pixel font licensing**~~ — **decided**, then **revised 2026-09-02.**
   Originally: self-hosted OFL faces, **Pixelify Sans** (400/700) for display
   *and numbers*, **Nunito** (400/700) for body.

   That pairing shipped and the pixel face was not readable enough. The fault
   was in the brief rather than the choice: making one decorative face carry
   both titles and every number in the game meant it had to work at the 13px
   floor §6.12 sets, and no pixel face does. **Germania One** (400) then took
   titles alone at 15px and up, and **PT Sans** (400/700) body copy and every
   number.

   **Revised again 2026-09-11, and it landed where it started: Nunito.** One
   family in four weights — 800 titles, 700 buttons and amounts and names, 600
   prose, 400 the small description — replaces both. Two families were one
   more than the job needed: a title and a caption out of one face read as one
   voice, and what makes a title a title is the weight. It is also the face
   the mockups were drawn in all along, which is the answer to why the built
   chrome never quite matched them.

   The tabular property survives the change: Nunito has no `tnum`, and needs
   none — its figures are 600 units wide at every weight. What does not
   survive is the width. Nunito runs about a third wider than PT Sans (~9.4px
   a character at 600 against ~7), so a two-line clamp truncates sooner; it
   ellipsises, which is the behaviour the clamp was for. Still self-hosted
   OFL, still vendored as subset woff2 with the licence, now **60 KB** for
   four faces against 32 for three. See §3.4 and `src/ui/fonts/README.md`.

### 7.23 The store's painted pieces (S1)

Keys, the hammer and the six gem packs, drawn as objects rather than atlas
coins so the store's vignettes and pack cards (M5) hold at 76–96px. Sent into
the M0 conversation after the style block:

> Same style as the interface objects in the mockups above (smooth, chunky, thin dark-brown outline, soft two-tone shading, small highlight, NO pixel art). One square sprite sheet, 1024×1024, a strict 3×3 grid of equal 341px cells with a fully TRANSPARENT background (true alpha, no checkerboard, no card, no shadow on the ground), one object centred in each cell filling about 75% of it, in this exact reading order: 1 an ornate silver key seen at an angle; 2 an ornate gold key with two tiny sparkles; 3 a builder's hammer with a wooden handle and steel head; 4 a small pile of three violet cut gems; 5 a heap of six violet gems; 6 a small brown leather pouch spilling violet gems; 7 a large heap of violet gems with a coin-purse behind; 8 an open wooden chest with brass fittings full of violet gems; 9 a big iron-bound treasure chest overflowing with violet gems and a gold crown on top. No text, no labels, no frame lines between cells.

The sheet comes back 1254×1254; cut it on an even 3×3 grid, `-trim` each
cell, square it with `-extent` and resample to 256px (`Docs/art/ui/
CONVERSATION.md`). Reading order is the file order: `art-key-silver`,
`art-key-gold`, `art-hammer`, then `gems_pouch`, `gems_purse`, `gems_chest`,
`gems_vault`, `gems_hoard`, `gems_treasury` — the pack files keep the names
`definitions.ts` already gives the SKUs, so nothing but the picture changed.

### 7.24 The plates the chrome is nailed together from (P1)

The header's plank, the nav's beam and its tabs, and the parchment cards on
the map (the daily pill, the builder plaque, the quest scroll) are painted
pieces nine-sliced by CSS `border-image` — the bevel, the rim, the grain and
the corner nails are in the art, so the flat kit's lips and highlights come
off. Sent into the M0 conversation with `mockups/m12-map-floaters.png`
attached as the anchor:

> Same materials as the attached mockup's chrome, drawn as UI pieces to be sliced. One sheet, 1024×1024, fully TRANSPARENT background (true alpha, no checkerboard), a strict 2×2 grid of equal 512px cells, each piece centred in its cell with 40px of clear margin, straight uniform edges and identical corner blocks so each can be nine-sliced: 1 (top-left) the raised wooden PLATE the nav tabs are made of — a rounded rectangle 432×220, warm mid wood grain face, a lighter bevel along the top edge, a darker lip along the bottom, a thin dark-brown rim; 2 (top-right) the wooden HEADER PLANK segment — a rounded rectangle 432×160, the same wood a shade darker with the same bevel and rim; 3 (bottom-left) the PARCHMENT CARD the daily pill and quest scroll are made of — a rounded rectangle 432×220, aged cream parchment face inside a 12px dark wood frame with a lit inner bevel, a small iron nail head in each corner; 4 (bottom-right) the dark wood BEAM the nav sits on — a rectangle 432×200 of dark wood grain with a lit top edge and a shadowed bottom edge, seamless left to right. No text, no icons, no drop shadow on the ground, nothing outside the cells.

The sheet comes back 1254×1254; cut it on an even 2×2 grid and `-fuzz 6%
-trim` each cell (the painted shadow leaves a faint halo). Files:
`src/ui/assets/plate-wood.png` (nav tabs, slice 44 at 12px),
`plate-plank.png` (the header's two plates, slice 44 at 8px),
`plate-parchment.png` (the cards, slice 64 at 16px so the nails land in the
corners), `beam-wood.png` (the header's and the nav's beam, repeated along
x at full height). `fill` keeps the painted face as the element's
background.

### 7.25 The Settings marks (I1)

Five row marks for the Settings dialog (M9) — music, sound effects,
ambience, the save, the payer profile — plus a start-over mark held in
reserve. They are not `IconName`s: nothing but the Settings rows shows
them, so they ship as `src/ui/assets/set-{music,sfx,ambience,save,payer,
restart}.png` (128px, squared) and are drawn as CSS backgrounds in the
row's parchment vignette. Sent into the M0 conversation with
`mockups/m9-settings-mana.png` attached:

> Same icon style as the settings rows in the attached mockup: chunky, simple, smooth silhouettes with a thin dark-brown outline, soft two-tone shading and a small highlight, NO pixel art. One sheet, 1024×1024, fully TRANSPARENT background (true alpha, no checkerboard, no card, no shadow on the ground), a strict 3×2 grid of equal cells (341×512), one object centred in each cell filling about 70% of it, in this exact reading order: 1 a golden music note; 2 a wooden loudspeaker horn with two sound waves; 3 a round green tree with a small bird; 4 a rolled parchment scroll tied with a red ribbon and a wax seal (saving the kingdom); 5 a small leather coin purse with a gold coin peeking out (who is playing); 6 two curved golden arrows chasing each other in a circle (start over). No text, no labels, no frame lines between cells.

The sheet comes back 1254×1254; cut it 3×2, `-fuzz 4% -trim`, square
with `-extent` and resample to 128px.
