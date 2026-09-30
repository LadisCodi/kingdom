# 24 · Dialogue — the advisor and the cast

> **Scope.** The one system every tutorial, introduction and story beat
> speaks through: a small visual-novel stage — a character on each side, a
> box of text that can sit anywhere on the screen, a pointer and a lock. What
> is said, and when, is [`23-tutorials.md`](23-tutorials.md).
>
> **Status: designed 2026-10-01; built on `feat/ftue`** (`src/ui/stage/`).

## 1. The stage

- **Two sides, left and right.** Each holds one character at a time.
- **A character enters on its first line**, sliding in from its own edge, and
  **leaves** when a line on its side names someone else, when a line says
  `exit`, or when the scene ends.
- **The speaker is lit; the other side is dimmed** to 60% and set back a
  step.
- The characters stand on the box's top edge, so they rise and fall with it.
- The stage sits above the nav bar and below the battle playback's results,
  the reveal and the rewarded video.

## 2. The box

- Parchment in a carved wooden frame, the name on a wooden plank on its top
  edge on the speaker's side — the same materials as every sheet.
- **Three places**: `bottom` (the default), `top`, `middle`. A line may set
  its own.
- **`auto`**: when a line points at something, the box takes the half of the
  screen the target is not in.
- **The text types itself** at 40 characters a second. A tap finishes the
  line; the next tap moves on. A small arrow at the box's corner says a tap
  will move on.
- **A line waiting on the game** (a beat, [`23-tutorials.md`](23-tutorials.md)
  §3) shows no arrow; the box shrinks to its text and stays out of the way.
- **Skip**, a small knob on the plank, ends the scene — absent on the First
  Morning.

## 3. A line

| Field | What it is |
|---|---|
| `speaker` | who says it — a `speakers` id |
| `side` | `left` or `right` |
| `text` | what is said; `{player}` is the monarch's title |
| `box` | `bottom` · `top` · `middle` · `auto` |
| `point` | what the pointer shows (§4), or nothing |
| `lock` | `none` · `target` · `all` ([`23-tutorials.md`](23-tutorials.md) §6) |
| `until` | the condition that moves the line on, or nothing for a tap |
| `exit` | the speaker leaves after this line |

- A **scene** is an ordered list of lines, a **trigger** and a flag saying
  whether it can be skipped.

## 4. The pointer

| `point` | Shows |
|---|---|
| `ui:<key>` | a control on screen — a nav tab, a card, a button (the keys are listed in `src/ui/stage/targets.ts`) |
| `cell:<x>,<y>` | one map cell |
| `feature:<id>` | the nearest cell with that feature, fogged first |
| `district:<id>` | the nearest building of that kind |
| `lair:<id>` · `landmark:<id>` | that site |
| `quest` | the quest pill |

- A gold arrow bobbing over the target, and a ring round it — the hint's
  own ring, so a player never learns two signs for one thing.
- **The camera flies to a map target** before the line appears.
- A target that moves (a scrolling list, a card rebuilt) is re-found every
  frame.

## 5. Conditions

A condition is a **kind**, a **target** and an **amount**. The kinds are code;
which one a line waits on is data.

| Kind | True when |
|---|---|
| `questReached` · `questComplete` · `questClaimed` | that quest is active or past · done · claimed |
| `techDone` | that technology is researched |
| `placed` · `built` | a building of that kind is placed · finished |
| `revealed` | that cell, or `amount` cells, revealed |
| `overlay` · `noOverlay` | that sheet is open · no sheet is open |
| `taps` | `amount` taps on the ground since the line began |
| `lairFound` · `lairCleared` · `landmarkClaimed` | the first, or that one |
| `bookOpen` | that book is open |
| `manaEmpty` · `buildersBusy` · `raided` · `wounded` | the first time it happens |
| `heroes` | `amount` heroes owned |

## 6. The cast

| Id | Name | Who | Art | Frame |
|---|---|---|---|---|
| `advisor` | **Isolde** | the Royal Advisor — warm, dry, unflappable; she keeps the maps and the ledgers | `portrait_advisor` | full figure |
| `warden` | **the Warden** | captain of the guard; joins at the first lair | `hero_warden` | full figure |
| `cook` | **Bess** | runs the Tavern; joins when it opens | `hero_cook` | full figure |
| `villager` | **a villager** | the first settler | `unit_villager_avatar` | medallion |
| `orcChief` | **Grukk** | the Orcs' warchief | `creature_orc_avatar` | medallion |

- A **full figure** stands on the box, cut at the waist by it. A
  **medallion** is a round avatar in a brass ring on the box's corner.
- A missing picture draws as a **parchment silhouette** of the frame, never an
  emoji.
- **Wanted art:** `portrait_advisor` — Isolde, standing, three-quarter,
  facing right, in the hero illustrations' style
  ([`../art/portraits/prompt-template.md`](../art/portraits/prompt-template.md)):
  a woman in her forties, auburn hair in a practical braid, royal-blue coat
  over a parchment-coloured dress, a ledger under one arm, reading
  spectacles on a chain, a brass key ring at her belt.

## 7. Where it lives

- Scenes and speakers are two collections in `?dev=data` › Progression:
  `scenes` and `speakers`.
- **The sim never reads them.** The stage is UI; the save keeps only which
  scenes have played ([`23-tutorials.md`](23-tutorials.md) §7).

## 8. Deliberately not in this design

- Portrait expressions, lip flaps or voice.
- More than one character per side, or a third slot.
- Choices, branching, or a line that changes the game.
- A dialogue log or a replay.
- Rich text beyond a bold word.

**Open questions:** **OQ-117**.
