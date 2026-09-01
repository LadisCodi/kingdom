# Menus — UI/UX redesign brief & mockup prompts

> **What this is.** An audit of every menu in the web build as it stands
> (2026-09-01, `src/ui/`), what each one *should* show, and a paste-ready
> prompt pack for generating pixel-art mockups in ChatGPT.
>
> **What it is not.** An implementation plan. Nothing here changes the
> simulation — every number quoted below already exists in `src/sim/`.
> This is the visual and informational contract the menus should honour.
>
> Companion docs: [`09-ui-and-input.md`](../09-ui-and-input.md) (as-built
> behaviour), [`sprite-prompts.md`](sprite-prompts.md) (world art),
> [`reference.png`](reference.png) (the style anchor).

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
  player is about to spend.
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
5. **Warm materials, chunky shapes.** Parchment, carved wood, rope, wax
   seals, cloth banners. No hairlines, no glass, no neon, no grey.
6. **Big, few, forgiving targets.** Minimum 44×44 px touch targets, ≥16px
   body text, ≥13px for the smallest helper line. Portrait-first (the app
   is capped to 9:16), one-thumb reachable: primary actions in the bottom
   third.
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

### 3.3 Buttons

| Kind | Look | Used for |
|---|---|---|
| Primary | `leaf` slab, `leaf-dark` 3px bottom lip, ink-cream label, min 56px tall | Build, Claim, Train, Sell, Start, Upgrade |
| Secondary | `wood` slab, `wood-dark` lip | Select, filters, amount picker |
| Icon/stepper | 48×48 round wooden knob | Worker `−`/`+`, close, zoom |
| Destructive | `clay` slab, dark-clay lip | Reset, Cancel construction |
| Gem action | `sky`-to-violet slab with a gem icon | Finish now, buy research slot |
| Disabled | `locked` fill, ink-muted label, small padlock, **reason line beside it** | any gated action |

Pressed state: the slab drops onto its lip (3px down, lip hidden).

### 3.4 Type & numbers

- One chunky pixel display face for titles/numbers, one rounded readable
  face for body copy. Titles 20–24px, body 15–16px, helper 13–14px.
- Counters are **tabular** (already true in CSS) and always paired with an
  icon on the left.
- Big numbers get thousands separators; never show more than one decimal
  (taxes currently print `1.5 Gold/min` — keep that shape).
- Durations read as words at small values: `instant`, `8s`, `2m 30s`,
  `1h 05m`. Never raw seconds above 90.

### 3.5 Icons

Replace **every emoji** with a hand-made 32×32 (or 16×16 upscaled) pixel
icon in the reference palette. The current emoji set is the placeholder
map, and it is the single loudest reason the UI reads as a prototype:

`🪙 Gold · 🍎 Food · 🪵 Wood · 🪨 Stone · ⚙️ Iron · 💎 Gems · 📜 Knowledge`
`👥 Population · 👷 Builders · 🧑‍🌾 Free workers · 📜 Quest · 🔍 Show me`
`🏛️ Townhall · 🏠 Housing · 🌾 Farm · 🟩 FarmLands · 🪚 Sawmill ·`
`🏪 Market · ⛏️ Quarry · ⚓ Docks · ⚒️ Mine`

Each needs: a normal state, a "greyed"/locked state (desaturated toward
`locked`, plus a padlock overlay), and — for currencies — a tiny version
for inline use in sentences.

### 3.6 Layout

- Portrait 9:16 (the app frame is `max-width: calc(100vh * 9 / 16)`).
  Mockups: **1080×1920**.
- Safe zones: 64px top (HUD), 96px bottom (nav + home indicator).
- Bottom sheets: 40–70% of screen height, scroll inside, grab handle,
  never cover the HUD.
- Content gutters: 24px. Row height: 88–104px.

### 3.7 Motion (spec only, no mockup needed)

Sheets slide up 180ms ease-out. Coins/resources fly from the source cell
to the matching HUD counter on gain. Counters roll rather than snap.
Insufficient funds shakes **the counter**, not the button (already true).
Claim/complete pops a small burst of gold sparks. Nothing pulses forever
except the single lit CTA.

---

## 4. Screen inventory

| # | Screen | File | Kind today | Kind proposed |
|---|---|---|---|---|
| 1 | Resource HUD | `ui/header.ts` | Top bar, 9 widgets | Top bar, 3 + purse |
| 2 | Quest tracker | `ui/questPill.ts` | Card under HUD | Scroll card, unchanged shape |
| 3 | Banner / toast | `ui/banner.ts`, `#toast` | Top card, 5s queue | Cloth banner, 5s queue |
| 4 | Bottom nav | `ui/navbar.ts` | 4 buttons ⇄ Close | 4 carved tabs + corner Close |
| 5 | Build | `ui/buildMenu.ts` | Full-screen list | Bottom sheet, card grid |
| 6 | Placement | `ui/placementPanel.ts` | Bottom panel | Bottom sheet + map-first |
| 7 | District card | `ui/districtCard.ts` | Bottom panel, 5 variants | Bottom sheet, same 5 variants |
| 8 | Market | `ui/marketMenu.ts` | Full-screen list | Bottom sheet, stall scene |
| 9 | Research | `ui/researchMenu.ts` | Full-screen node graph | Illustrated board, own place |
| 10 | Army | `ui/armyMenu.ts` | Full-screen list | Bottom sheet, muster roster |
| 11 | Settings | `ui/settingsMenu.ts` | Full-screen list | Bottom sheet |
| 12 | **Welcome back** | *(missing)* | — | Modal on load, offline report |

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

**Show this.**

- *Primary, always:* **Gold**, **Food**, **Wood** — the three that gate
  the early game. Icon + tabular value, large.
- *Primary, right side:* **Gems**, visually separated (premium), with the
  `+` affordance kept as-is.
- *Contextual:* Stone and Iron **appear only once the player owns any, or
  once a visible cost requires them.** They slide in with a one-off
  banner ("Your quarry is bringing Stone home").
- *Purse (tap to expand):* the full wallet including Berries / Meat /
  Fish / Knowledge, each with its Food-equivalent value shown as
  `🫐 12 × 1 = 12 🍎`. This is today's tooltip, promoted to a proper
  sheet, and it is where the Food breakdown lives.
- *City strip (second, thinner row or a single pill):* **Population
  `n/max`**, **Builders `free/max`**, **Free workers `n`**. These are
  city status, not currency — group them and mark them visually distinct
  (a small wooden plaque under the coins). Tapping the strip should jump
  to the Townhall.
- *Move out:* the save-mode badge belongs in Settings.

**States to mock.** Default (3 coins), expanded purse, a counter mid-shake
in `clay`, Stone appearing for the first time.

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

### 5.4 Bottom nav

**Purpose.** Reach the four places; leave any of them.

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

- Four carved wooden tabs with pixel icons **and labels**: Build, Army,
  Research, Settings. Active tab is raised and lit.
- Keep the lit-CTA behaviour on Build (gold glow + a small sparkle, not a
  brightness pulse).
- **Replace the swap-to-Close with a persistent nav plus a close affordance
  on the sheet itself** — a wooden `✕` knob at the sheet's top-right, plus
  tap-the-scrim-to-close, plus swipe-down. Tapping another tab switches
  sheets directly. (This is a behaviour change; it is the single biggest
  navigation improvement available and costs one small refactor of
  `dismissible()`/`dismiss()`.)
- Consider surfacing **Market** as a fifth tab once it is built, rather
  than making it the only building-only entry point.

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
  dotted orthogonal connectors. States: `done` (green rim), `active` (blue
  rim + a thin progress bar inside the node), `available` (gold rim), and
  **`silhouette`** — a dashed, 40%-opacity `?` for a tech exactly one step
  beyond something researched or researching. Anything deeper is not drawn.
- **Upgrades** — 36px circles fanned below their *completed* parent tech,
  with a level badge; instant Gold purchases.
- **Top bar** — "Research" and `Slots: 1 busy / 2`, plus
  `extra slot — 25 💎` + **Buy** when below `maxSlots`.
- **Info panel** — floats above the nav bar only while a node is selected.
  Tech: glyph, name, description, `Requires Forestry ✓ / Masonry ✗`, then
  either `Researched ✓`, a countdown bar, or a cost line
  `40 📜 · ⏱ 2m — all slots busy` with **Start**.
  Upgrade: `Tap Power — Lv 2/5`, description, level pips, and
  `120 🪙 · instant` with **Upgrade**.

**Problems.** This is the screen that most says "4X". A dotted node graph
on a dark grid *is* the Civilization tech tree. It is also the screen with
the best content — the silhouette fog and the upgrade fans are genuinely
good ideas that just need a different costume.

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
  with a pip row for level instead of a numeric badge.
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
- Keep drag-pan, keep the hint auto-pan, keep selection-clears-on-empty-tap.

---

### 5.10 Army

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

---

## 7. Mockup prompt pack (ChatGPT)

### 7.0 How to run the session

Same workflow that produced the v2 sprite set — it is proven here:

1. **One conversation.** Attach [`reference.png`](reference.png) to the
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
> "Good spot" beneath it in green. Legal neighbouring cells are marked with
> small unobtrusive wooden corner brackets. Along the very bottom, a single
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

## 8. Open questions

1. **Bottom sheets vs. the single-Close nav.** §5.4 proposes replacing the
   swap-to-Close bar. It is the biggest behavioural change here and the
   current pattern was a deliberate choice — worth a playtest before
   committing.
2. **Unit art.** The Army screen assumes unit portraits that do not exist.
   Four portraits is a small sprite job, but it is a job.
3. **How many currencies should ever be visible?** §5.1 proposes three
   plus a purse. If Stone and Iron turn out to be constantly relevant
   mid-game, the contextual rule needs a different cut.
4. **Research metaphor cost.** Re-skinning the tree as a parchment map is
   the most expensive item in this document. The mechanics stay identical,
   so it can ship last.
5. **Pixel font licensing** — pick one before any of this is implemented;
   the whole kit hangs off it.
