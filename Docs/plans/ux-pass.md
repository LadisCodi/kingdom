# Plan — the UX pass

> **What this is.** Usability fixes found playing v0.3.0 on a phone-sized
> viewport (430×900, touch) as a free player: the First Morning, the return
> after an absence, Townhall 2–3, the Survey and the store. Combat, the world
> board, heroes and the collection were not played.
>
> **Status: planned.** One row is one `bugfix/` or `feature/` branch into
> `develop`, unless a row says it can share one.

## 1. Steps

| # | Fix | Kind | Priority |
|---|---|---|---|
| 1 | A store's bubble is a tap target — **done** | bug | high |
| 2 | The quest scroll stays blank | bug | high |
| 3 | The First Morning does not point at Gems — **done** | design | high |
| 4 | The hand never covers the line | bug | medium |
| 5 | "Show me where" points with the hand | feature | medium |
| 6 | A refused fog tap points at the frontier | feature | medium |
| 7 | One count of revealed cells | design | medium |
| 8 | The level plaque replaces `L3` | art | low |
| 9 | Gems are blue | art | low |
| 10 | The payer profile out of the first screen | design | low |
| 11 | One toast per message | bug | low |

Rows 8 and 9 can share an art branch. Rows 3, 7 and 10 change data or
design: the data goes through `?dev=data`, the doc that owns the behaviour
changes in the same commit.

## 2. The fixes

### 2.1 A store's bubble is a tap target

- **Seen:** on the Millers' house, tapping the coin bubble does nothing; a tap
  a little lower lands on the tree behind it, harvests it and spends 1 Mana.
  The First Morning asks for exactly this tap ("When the purse shows, gather
  it").
- **Rule:** a tap inside a store's bubble collects that store, before the cell
  under it is read. Same as a lair's warning bubble, which already does this
  (`lairBubbleAt` in `Game`'s map tap, `src/game.ts`).
- **Where:** the bubbles are drawn by `src/render/collectBubbles.ts`; the map
  tap picks the cell with `camera.screenToCell`.
- **Done when:** a test taps the bubble's screen rect and the store empties
  into the wallet, with no Mana spent and no harvest.

### 2.2 The quest scroll stays blank

- **Seen:** after the First Morning's last line the scroll shows its
  parchment with no text. The DOM holds the quest (`Explorer`), but
  `.q-content` computes `opacity: 0` with no running animation. It stays blank
  after claims and Townhall levels.
- **Where:** `src/ui/questPill.ts` — `unroll` / `rollUp` / `settle`, and the
  `#quest.is-nudging > *` animation from the stage.
- **Rule:** whatever interrupts a roll, the scroll ends unrolled with its words
  at full opacity whenever a quest is shown.
- **Done when:** a test that hands a quest over while `is-nudging` is on ends
  with `.q-content` opaque; reproduced and checked in a mobile browser.

### 2.3 The First Morning does not point at Gems

- **Seen:** in scene `morningVillager` the line *"…a few Gems would hurry them
  along. Whichever you think best!"* points the hand at
  `ui:card:finish-training`. Following the hand spends 4 Gems.
- **Rule:** in the First Morning the hand never points at something paid for
  with Gems. The line still names the option; the hand points at nothing, or
  at closing the card.
- **Where:** `scenes.json`, edited in `?dev=data`; the beat in
  [`../features/23-tutorials.md`](../features/23-tutorials.md).
- **Done when:** a test fails any First Morning line whose `point` is a Gem
  control.

### 2.4 The hand never covers the line

- **Seen:** with the line box at the top and the target just under it, the
  hand sits on the text ("costs yo👆othing").
- **Rule:** when the hand's rect meets the line box, the box moves to the
  other edge of the screen (`box: "auto"`).
- **Where:** `drawTarget` in `src/ui/stage/stage.ts`, and the box placement.

### 2.5 "Show me where" points with the hand

- **Seen:** tapping the quest scroll glides the camera and outlines a cell in
  thin cyan; on a busy map it is easy to miss.
- **Rule:** `focusQuest` shows the stage's hand and sparks on the hinted cell
  until it is tapped or `pointerSeconds` runs out.
- **Where:** `focusQuest` → `setCellHint` in `src/game.ts`; the hand in
  `src/ui/stage/stage.ts`.

### 2.6 A refused fog tap points at the frontier

- **Seen:** a tap past the frontier says *"Clear a path to it first — the fog
  lifts from the edges"* and nothing shows which edge. A tap on the far sea of
  clouds gives no feedback.
- **Rule:** a `NotReachable` refusal also hints the nearest buyable cell (the
  `buyable` test `focusQuest` already uses), with the same hint as §2.5.
- **Where:** the fog tap handler in `src/game.ts`.

### 2.7 One count of revealed cells

- **Seen:** at Townhall 2 the Survey pill reads **23 / 30** and the Explorer
  quest beside it **23/32** — the same count against two goals, on screen at
  once.
- **Rule:** while both are shown they share the goal, or the quest's goal is
  the Survey's next level.
- **Where:** `quests.json` (`Explorer.goalAmount`) and the Survey's levels,
  in `?dev=data`; [`../features/25-the-survey.md`](../features/25-the-survey.md).

### 2.8 The level plaque replaces `L3`

- **Seen:** a building above level 1 carries a small grey `L3` drawn as text
  at its roof; it reads as debug.
- **Rule:** the level is drawn on the plaque art (`ui-level-plaques.png`).
- **Where:** `src/render/mapRenderer.ts` (`fillText(\`L${district.level}\`…)`).

### 2.9 Gems are blue

- **Rule:** the studio's premium currency is a blue gem. The header, the
  store, the Survey and every Gem price use it.
- **Where:** the Gem icons in `Docs/art/ui/` (`icon_currency_gems`,
  `icon_pack_gems_*`, `ui-a2-currencies`) → `npm run art`.

### 2.10 The payer profile out of the first screen

- **Seen:** the first screen a tester sees asks how much they spend a month,
  before any of the game.
- **Rule:** the profile is chosen after the First Morning, or set by the
  playtest organiser per tester (a URL parameter), and the choice stays final.
- **Where:** `src/ui/payerSheet.ts`, `choosePayerProfile` in
  `src/sim/store.ts`; [`../features/14-monetization.md`](../features/14-monetization.md).

### 2.11 One toast per message

- **Seen:** two identical refusals stack, the first fading under the second.
- **Rule:** a toast with the text of one on screen restarts that one instead
  of adding another.
- **Where:** `game.onToast` in `src/main.ts`.

## 3. Deliberately not in this plan

- Combat, world board, hero and collection screens — not yet played.
- Balance numbers.
- The First Morning's length (**OQ-117**) — a playtest decides it.
