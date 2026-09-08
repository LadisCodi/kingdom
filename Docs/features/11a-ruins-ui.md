# 11a · Ruins — screens

> **Spec.** Systems: [`11-expeditions.md`](11-expeditions.md). Fight screen:
> [`combat.md`](combat.md). Map marker and fog:
> [`01-map-and-fog.md`](01-map-and-fog.md). Guild and reservoir are owned
> elsewhere; this document specifies only what ruins add to them.

## 1. Flow

```
World map ──▶ Discovery card (one-off)
     │
     └──▶ Ruin sheet ──▶ Room ladder ──▶ Room sheet ──▶ Battle ──▶ Result (cleared / failed)
                                              │                         │
                                       Party composition                └─▶ Room ladder

Guild screen ──▶ Next-level unlock preview
City HUD ─────▶ Reservoir meter
```

## 2. Screens

### 2.1 Map marker

| | |
|---|---|
| Data | Ruin name, tier, affinity, rooms cleared / total, `has_available_room`, `has_new_unlock` |
| Elements | Marker art per tier, progress ring or `12/30`, badge |
| Rules | Tap opens the ruin sheet with no confirmation. Badge shows when a room is enterable and unattempted since last visit |

### 2.2 Discovery card

| | |
|---|---|
| Data | Ruin name, tier, affinity, flavour line, Depth 1 room count |
| Elements | Full-bleed art, `Enter`, `Later` |
| Rules | Fires once on fog lift. Queues behind other reveals. Never blocks input |

### 2.3 Ruin sheet — depth stack

| | |
|---|---|
| Data per ruin | Name, tier, affinity, total progress |
| Data per depth | `depth_index`, name, `rooms`, rooms cleared, `guild_req`, boss name + art + chest contents, `passive_on_complete` |
| Data for the gate | creature + type, raid countdown, trips left, hoard ([`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §7) — while it stands |
| Elements | Vertical stack, deepest at bottom; the gate band above Depth 1 while it stands; one band per depth showing `7/12`; boss card at the end of each band with reward art |
| States | Gated · locked · open · in progress · complete · bottomed out |
| Rules | While the gate stands every depth reads gated and only the gate band is tappable. Locked depths display `guild_req` and their boss reward. Bottomed out is a distinct visual from locked. Tapping an in-progress band opens the frontier room |

### 2.4 Room ladder

| | |
|---|---|
| Data per room | `room_index`, `power_req`, threat type (Scout only), reward preview, cleared flag, is-boss |
| Elements | One card per room; cleared dimmed + ticked; frontier highlighted; locked rooms flat. Next-carrot banner pinned above the frontier |
| Banner | Two variants — next overridden reward row, next boss. Boss wins when closer. Format: *"5 rooms → the Hollowed Crown, +12 Stardust/h"* |
| Rules | Auto-scroll to frontier on open |

### 2.5 Room sheet

| | |
|---|---|
| Data | Threat type + strength, **villains present** (portrait + type), `power_req`, party power, supply cost, current Food/Gold, reward preview |
| Elements | Power comparison as the headline, supply cost with affordability state, party strip, `Descend` |
| States | Affordable + over power · affordable + under power (warn) · supplies unaffordable (block) |
| Rules | A power shortfall warns and allows entry. Supply cost is labelled as spent win or lose. Without the Scout, threat shows as `?` plus `Adventurers' Guild 3` |

### 2.6 Party composition

Owned by [`combat.md`](combat.md). Entered only from the room sheet.

| | |
|---|---|
| Data | Hero roster, unit counts by type, party slots, assignments, party power, matchup vs. room threat |
| Rules | Persists the last composition **per ruin**; one-tap reuse; power read updates live |

### 2.7 Result — cleared

| | |
|---|---|
| Data | Rewards granted, first-clear flag, boss chest contents, passive generation delta |
| Elements | Chest reveal; on a boss, passive counter animating upward; fragments called out separately from currencies |
| Rules | Exits to the next room or to the ruin sheet — never to the map |

### 2.8 Result — failed

| | |
|---|---|
| Data | Room, supplies spent, party power vs. `power_req`, the losing matchup, remaining Food/Gold |
| Elements | The gap stated explicitly: *"Your 24 against 31. Their cavalry beat your archers."* Actions: `Retry`, `Change party`, `Leave` |
| Rules | No defeat fanfare. The diagnosis is the content of the screen |

### 2.9 Guild screen — unlock preview

Owned by [`buildings.md`](buildings.md).

| | |
|---|---|
| Data | Current level, next level cost, depths the next level opens (ruin + depth + boss name + art), other level rewards |
| Elements | *"Guild 5 → Ironworks D3 · Counting House D2"* with both boss cards |
| Also hosts | Ruins index: every discovered ruin, its progress, what it waits on |

### 2.10 Reservoir meter

Owned by the city economy.

| | |
|---|---|
| Data | Accrued Stardust / XP / Gold, cap (2 h or 8 h), time to cap, capped flag |
| Rules | One meter for the whole idle economy. Distinct full state, visible from the city HUD |

## 3. Cross-cutting

- **Badge priority**, one order across map marker, Guild button and city HUD:
  reservoir full > new unlock > room available.
- **Number formatting** for Stardust and XP in the thousands.
- **Empty states**: no ruin discovered; all open depths cleared with the Guild
  unaffordable.
- **Currency copy**: one line each for XP, Stardust, fragments.
- **Localisation**: 5 ruin names, ~20 depth names, 15 boss names.

## 4. Build order

1. Ruin sheet · room ladder · room sheet · both result screens — one milestone,
   nothing is playable until all five exist.
2. Guild unlock preview.
3. Discovery card, badging, ruins index.

**Prototype cut:** step 1 only, placeholder art, simplified battle view.

**Long-lead art:** 15 boss cards, 5 ruin markers, 5 discovery illustrations,
affinity and threat icons.

## 5. Mockup prompts

For image generation in ChatGPT. Paste the style block first, then one screen
prompt per image. Keep labels short — rendered text will be imperfect and is
placeholder only.

### 5.1 Style block (prepend to every prompt)

```
Mobile game UI mockup, portrait aspect ratio 9:19.5, full screen.
Cozy stylized medieval-fantasy kingdom builder. Hand-painted illustrative
style, soft rim lighting, no photorealism, no 3D renders.
Palette: warm parchment and aged wood panels, brass and gold trim, deep
slate-blue shadows; magic accents in cyan-teal. Rounded panel corners,
generous padding, chunky readable buttons, one clear primary action per
screen in warm gold.
Clean flat UI overlay on top of illustrated art. High contrast, legible at
phone size. No brand logos, no watermarks, no photographic elements.
```

### 5.2 Ruin sheet — depth stack

```
Screen: a dungeon ruin's depth list. Vertical scrolling stack of four wide
horizontal bands, deepest at the bottom, receding into darker stone as they
descend. Top bar with the ruin's name, a small tier badge and a sword-type
affinity icon.
Band 1: complete — dimmed, gold tick, progress "10/10".
Band 2: in progress — brightest band, progress bar "7/12", small glowing
frontier marker.
Band 3: locked — greyed with a padlock, a short requirement label, and a
visible ornate boss portrait card at its right end showing a treasure item.
Band 4: locked and darker, boss card silhouetted.
Each band ends in a taller boss card with painted monster portrait art.
Bottom: a wide gold primary button.
```

### 5.3 Room ladder

```
Screen: a vertical ladder of twelve small square room cards inside one dungeon
depth, ascending path layout on a dark stone background with candlelight.
Cards 1-6: cleared — dimmed with gold ticks.
Card 7: current — bright, glowing outline, larger, showing a monster icon and
a small power number.
Cards 8-11: locked — flat dark cards with faint monster silhouettes.
Card 12: boss room — wide ornate card with a monster portrait and a treasure
chest icon.
Pinned banner above the current card: a slim parchment ribbon with a reward
icon and a short label.
Top bar: back arrow, depth name, progress "7/12".
```

### 5.4 Room sheet — pre-fight

```
Screen: pre-battle preparation panel for a single dungeon room.
Top: enemy preview card — a painted monster portrait with a type icon and a
strength value.
Middle: the hero focus — a large power comparison element showing two numbers
facing each other, the player's on the left in gold, the enemy's on the right
in red, with a subtle warning glow because the player's is lower.
Below: a horizontal party strip of four portrait slots, three filled with
armoured unit portraits and one empty with a plus icon.
Below that: a small cost row with a wheat icon and a coin icon.
Bottom: one large gold primary button.
```

### 5.5 Result — cleared

```
Screen: victory reward panel over a darkened dungeon background.
Center: an open treasure chest with warm light spilling out, painted style.
Below it: a row of four reward tiles — a coin stack, a cyan-teal crystal, a
blue XP orb, and a glowing character shard, each with a small quantity label.
Below: a slim progress row showing a passive-income counter with a small
upward arrow and a cyan crystal icon.
Bottom: two buttons, a large gold primary and a smaller flat secondary.
No confetti, restrained celebration, cozy not explosive.
```

### 5.6 Result — failed

```
Screen: post-defeat information panel, calm and informative rather than harsh.
Muted palette, cool slate-blue, no red alarm styling, no skulls.
Top: a short heading and a small dimmed monster portrait.
Middle: the core element — a clear side-by-side comparison of two numbers,
the player's lower value on the left and the enemy's on the right, with a
small explanatory line beneath and two matchup icons showing a cavalry icon
beating an archer icon.
Below: a spent-cost row with a wheat icon.
Bottom: three buttons stacked — one gold primary, two flat secondary.
```

### 5.7 Discovery card

```
Screen: a full-bleed discovery reveal card. Painted illustration of a sunken
overgrown stone ruin entrance at dusk, mist and fireflies, cozy and
inviting rather than horror.
Overlaid lower third: a parchment panel with a title line, a small tier badge,
an affinity icon, and two short lines of flavour text.
Bottom: one gold primary button and one flat text link.
Vignette edges, soft depth of field.
```

### 5.8 Guild screen — unlock preview

```
Screen: a building upgrade panel for an Adventurers' Guild in a cozy
kingdom builder.
Top: painted illustration of a timber-and-stone guild hall with hanging
banners, plus a level badge.
Middle: an upgrade cost row of three resource icons with quantities and one
large gold upgrade button.
Below: a "unlocks next" section containing two ornate preview cards side by
side, each with a painted monster boss portrait, a short label and a small
treasure icon.
Bottom: a compact list of three rows, each with a small ruin icon and a
progress bar.
```

### 5.9 Map marker

```
Close crop of an illustrated overworld map tile in a cozy kingdom builder,
top-down slightly angled painted style, grass, trees and stone paths.
Center: a ruin entrance marker — a small painted stone archway on a raised
base, with a circular progress ring around it in gold, a tiny affinity icon
on the ring, and a small glowing notification badge at its upper right.
Nearby: two dimmer markers partially covered by soft grey fog at the frame
edges.
No UI panels, no text beyond the badge.
```
