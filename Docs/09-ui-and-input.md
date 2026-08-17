# 09 — UI & Input

This documents the screens' *behavior and data*, platform-agnostically. (The Unity
implementation follows a strict MVP pattern — view / presenter / immutable data DTO —
described at the end for reference.)

## Screen inventory

| Screen | Kind | Contents & behavior |
|---|---|---|
| **Header** | persistent top bar | Currency widgets (Silver, Wood, Food, Gold, Knowledge — which ones show depends on the active screen's currency context), a Gems widget with an add button (currently a no-op), a **Mana bar** (current/max plus a "+1 in Xs" regen countdown), **Population** `current/max` (Filling/Full states), **Builders** `available/max` (available = max − min(queuedItems, max)), and **Free workers**. Also plays a shake feedback on a currency when the player can't afford something. |
| **Main** | base playing state | The map view plus a Spellbook shortcut button. |
| **Nav bar** | persistent bottom bar | Buttons: Army, Spellbook, Build; tab groups: Spells → Spellbook, Research → Research. A per-second driver lights the **Build CTA** when at least one uncapped district type is both affordable and has a legal cell. Overlay menus opened from here close via a close button/back. |
| **Build** | full-screen overlay | One row per buildable district (Housing, Farm, FarmLands, Lumber): icon, name, description, indicative cost & time at distance 0, `count/maxCount`, affordability, and blocked message "Townhall lvl N" when the count cap needs a higher Townhall. Selecting a row enters placement. |
| **Place district** | bottom panel + map mode | Ghost preview on the auto-selected cell (closest legal cell to the Townhall, camera centered), all legal cells marked with projected yield labels; panel shows icon/name/description, exact cost & duration for the selected cell, projected stat rows, terrain/feature tags, and the **Build** button. |
| **Tile / district card** | bottom panel | For a built district: identity, `level/maxLevel`, per-stat rows with green next-level deltas, a Total production row, upgrade cost/duration/affordability/requirement message, and — while a build/upgrade is in progress — progress, remaining time, and the gem finish cost/button. Conditional widgets: **Buy Population** (on districts with population capacity; shows the Food cost and "+5 Silver each"), **Workers +/−** (on worker districts, with per-worker yield text). Opening the card highlights the district's worked tiles on the map (own cell = base yield, nearest `workers−1` worked units = per-unit yield). |
| **Spellbook** | overlay | Spell list with Locked/Unlocked states and template-formatted descriptions; picking one starts targeting. |
| **Cast spell** | overlay + map mode | Targeting mode: valid cells highlighted with per-cell info labels; tap a valid cell to cast. |
| **Army** | overlay | Unit buttons (icon, owned count, selection state), selected-unit info (name, power, tags, description, cost, Train button), header `Power current/max`. |
| **Research** | overlay | Placeholder — close button only. |

Currency context per screen (what the header shows): always Gems + Mana + Silver;
Main adds Food and Wood; Build shows Silver/Wood/Food; Place District adds Builders;
the district card also toggles the Free Workers widget.

## World-space UI

- District view: state-driven visuals (Built / UnderConstruction / Preview, with
  per-state variants), a needs-workers warning icon, a vault fill bar
  (Empty/Filling/Full), an upgrade progress bar while upgrading.
- Queue world view: per-item progress bar + compact countdown (interpolates every
  frame between per-second syncs), states InProgress/Completed/InQueue.
- Fog progress bar over partially-paid Discovered cells.
- Floating feedback: "+N currency" on production/collection, reveal cost on fog taps,
  trees destroyed/grown effects.
- Tile markers: selected tile, worked tiles, valid expand/build targets (with yield
  labels), spell targets, spell cell-info labels.

## Input model

One gesture matters: the **tap** (distinguished from camera drag; taps that start
over UI are ignored). A tap raycasts to the ground plane, resolves to a hex, and is
dispatched to a **priority-ordered chain of cell-tap handlers** — the first handler
that consumes the tap wins:

| Priority | Handler | Consumes when |
|---|---|---|
| 300 | District placement | placement mode is active (selects/moves the preview to any legal cell) |
| 200 | Spell targeting | targeting mode is active (casts on a valid cell; swallows invalid taps) |
| 100 | City-expansion trigger | (helper for entering expansion from map affordances) |
| 50 | Fog reveal | Discovered cell → pay 1 Silver toward reveal; Undiscovered → swallowed. Blocked while a full overlay is open (tile card excepted) |
| 0 | Cell info (default) | tapping the currently inspected district **collects its vault (1/currency)**; tapping another district opens/switches its card *and* collects once; tapping empty ground closes the card |

Camera: pan by drag; the camera auto-centers on auto-selected placement cells (the
inspected cell anchors at viewport (0.5, 0.65)).

## Implementation pattern (Unity reference)

Each menu = three pieces: a **Menu** view (`MonoBehaviour`, serialized references
only, lifecycle hooks), a **Presenter** (all logic; binds/unbinds to the view,
subscribes to services; singleton per menu), and an optional immutable **Data** DTO
pushed to the view. Menus are loaded by class-name-matching prefabs and shown through
a `UIManager` (`ShowMenu<T>()`); overlay menus implement a marker interface so the
nav bar can request their close. Widgets are **state-driven**: a widget holds one
child view per state of a small enum (e.g. the vault widget's Empty/Filling/Full) and
activates the first whose condition matches its data. This whole layer can be
reimplemented with any reactive UI framework; the behavior above is the contract.
