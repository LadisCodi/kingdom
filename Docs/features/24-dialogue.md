# 24 · Dialogue — the advisor and the cast

> **Scope.** The one system every tutorial, introduction and story beat
> speaks through: a small visual-novel stage — a character on each side, a
> box of text that can sit anywhere on the screen, a pointer and a lock. What
> is said, and when, is [`23-tutorials.md`](23-tutorials.md).
>
> **Status: built 2026-10-01** on `feat/ftue` (`src/ui/stage/`).

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

- **A sheet of parchment on a carved wooden board**, one nine-sliced piece of
  art with organic edges — worn wood, a deckled sheet with one corner curled,
  brass rivets — and a soft shadow that lifts it off the map behind.
- **The name is on a cloth ribbon** with swallowtail ends, on the box's top
  edge on the speaker's side, in the speaker's own colour: Isolde blue, the
  Warden green, Bess red, the villager brown, Grukk crimson.
- **Three places**: `bottom` (the default), `top`, `middle`. A line may set
  its own.
- **`auto`**: when a line points at something, the box takes the half of the
  screen the target is not in.
- **The text types itself** at 40 characters a second, with a soft wooden
  knock every third letter (`textTick`, never on a space). A tap finishes the
  line; the next tap moves on.
- **A line that waits for a tap takes one anywhere on the screen** — the
  box, the map, a menu — and keeps it: the tap reaches nothing behind it.
  Panning the map is not a tap. A golden **quill** at the box's corner says
  a tap will move on.
- **A line waiting on the game** (a beat, [`23-tutorials.md`](23-tutorials.md)
  §3) shows no quill; the box shrinks to its text and stays out of the way.

## 3. A line

| Field | What it is |
|---|---|
| `speaker` | who says it — a `speakers` id |
| `side` | `left` or `right` |
| `text` | what is said; `{player}` is the monarch's title |
| `box` | `bottom` · `top` · `middle` · `auto` |
| `point` | what the pointer shows (§4), or nothing |
| `lock` | `none` · `target` · `map` · `all` ([`23-tutorials.md`](23-tutorials.md) §6) |
| `until` · `untilTarget` · `untilAmount` | the condition that moves the line on — `tap` for a tap on the box |
| `exit` | the speaker leaves after this line |
| `expression` | the speaker's face on this line: empty (at rest) · `happy` · `worried` · `surprised` · `idea` — drawn from `<portrait>_<expression>`, the picture swapped in place without a new entrance |

- A **scene** is an ordered list of lines, a **trigger** (a condition), and
  two flags: `skippable` — an introduction, which waits a breath after the
  last scene, rather than a beat of the First Morning — and `anywhere` — may
  it start over a sheet the player has open.
- Scenes are considered **in list order**, one at a time.

## 4. The pointer

| `point` | Shows |
|---|---|
| `ui:<key>` | a control on screen — a nav tab, a card, a button (the keys are listed in `src/ui/stage/targets.ts`) |
| `cell:<x>,<y>` | one map cell |
| `feature:<id>` | the nearest cell with that feature out of the dark |
| `feature:<id>Fog` | the nearest fogged one the player can pay for — to be bought; with none payable, the frontier cell that leads towards the nearest one |
| `feature:<id>Revealed` | the nearest revealed one that is not spent — to be tapped |
| `district:<id>` | the nearest building of that kind |
| `lair:<id>` · `landmark:<id>` | that site |
| `quest` | the quest pill |

- **A gloved hand** (white glove, brass cuff) bobbing over the target,
  pointing down at it — or up from below, at the top of the screen.
- **A blue magic glow** marks it: a control's own silhouette lit blue
  (`--magic-glow-*`, the one cold light in a warm palette); a map plot as its
  own diamond in the same glow. Small motes of that light drift slowly off
  the target, and a dimmed screen's hole round a control is feathered, so the
  glow fades into the dark.
- The quest pill's hint wears the same hand and glow, so a player never learns
  two signs for one thing.
- **The camera flies to a map target** before the line appears.
- A target that moves (a scrolling list, a card rebuilt) is re-found every
  frame.

## 5. Conditions

A condition is a **kind**, a **target** and an **amount**. The kinds are code;
which one a line waits on is data.

| Kind | True when |
|---|---|
| `questReached` · `questComplete` · `questClaimed` · `questProgress` | that quest is active or past · done · claimed · its counter at `amount` |
| `techDone` · `techFilled` | that technology is researched · holds all its Knowledge |
| `placing` · `placed` · `built` | placing one · one is placed · `amount` finished (`AnyWorkshop` for any) |
| `revealed` · `population` · `heroes` | `amount` cells revealed · villagers · heroes |
| `overlay` · `noOverlay` · `ui` | that sheet is open · none is · that control (`data-coach`) is on screen — drawn, not merely in the page |
| `taps` | `amount` taps on the ground since the line began |
| `lairFound` · `lairDefeated` · `lairCleared` | that lair (or any) found · beaten · claimed |
| `landmarkClaimed` · `landmarkSeen` | that landmark, kind or any claimed · that one out of the dark |
| `bookOpen` · `doorOpen` | that book · that door is open |
| `featureSeen` | a cell with that feature is out of the dark |
| `manaEmpty` · `buildersBusy` · `raided` · `wounded` | the pool is dry · every builder is busy · a lair holds a hoard · someone is in the Infirmary |
| `always` | at once |

## 6. The cast

| Id | Name | Who | Art | Frame |
|---|---|---|---|---|
| `advisor` | **Isolde** | the Royal Advisor — warm, dry, unflappable; she keeps the maps and the ledgers. Dark hair in a scholar's bun, round thin-framed glasses, a royal-blue coat, a ledger and a brass key ring | `portrait_advisor` | full figure |
| `warden` | **the Warden** | captain of the guard; joins at the first lair | `hero_warden` | full figure |
| `cook` | **Bess** | runs the Tavern; joins when it opens | `hero_cook` | full figure |
| `villager` | **a villager** | the first settler | `portrait_villager` | full figure |
| `orcChief` | **Grukk** | the Orcs' warchief | `portrait_grukk` | full figure |

- **Isolde has five faces** — at rest, happy (eyes closed, a wide smile, the
  ledger hugged), worried (a hand at her chin), surprised (leaning back, a
  hand raised), an idea (index finger up, a knowing smile) — each its own pose, aligned on her feet so a change of face
  never moves her. Claims and praise are happy; threats and shortfalls
  worried; what the fog gives up surprised; a new building or book to try,
  an idea.
- **Every speaker is a full figure**: it stands on the box, cut at the waist
  by it. The figures share the heroes' style and frame (512×768); the
  tutorial's own three are cut from one sheet
  ([`../art/ui/mockups/ftue/prompts.md`](../art/ui/mockups/ftue/prompts.md) P1).
- A **medallion** — a round avatar in a brass ring — is still drawn for a
  speaker whose `frame` says so, and a missing picture draws as a parchment
  medallion with the speaker's initial pressed into it, never an emoji.

## 7. Where it lives

- Scenes, speakers and the help's timings are three collections in
  `?dev=data` › Progression: **Scenes**, **Speakers** and **Tutorial help**;
  a data rule checks every condition's target exists.
- **The sim never reads them.** The stage is UI; the save keeps only which
  scenes have played ([`23-tutorials.md`](23-tutorials.md) §7).

## 8. Deliberately not in this design

- Lip flaps, voice, or an expression for a speaker who has no art for it.
- More than one character per side, or a third slot.
- Choices, branching, or a line that changes the game.
- A Skip button: a tap anywhere moves a line on, so a scene is over in a few taps.
- A dialogue log or a replay.
- Rich text beyond a bold word.

**Open questions:** **OQ-117**.
