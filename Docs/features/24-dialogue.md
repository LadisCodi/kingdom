# 24 · Dialogue — the advisor and the cast

> **Scope.** The one system every tutorial, introduction and story beat
> speaks through: a small visual-novel stage — a character on each side, a
> box of text that can sit anywhere on the screen, a pointer and a lock. What
> is said, and when, is [`23-tutorials.md`](23-tutorials.md).
>
> **Status: built** (`src/ui/stage/`).

## 1. The stage

- **Two sides, left and right.** Each holds one character at a time.
- **A character enters on its first line**, sliding in from its own edge, and
  **leaves** when a line on its side names someone else, when a line says
  `exit`, or when the scene ends.
- **The speaker is lit; the other side is dimmed** to 60% and set back a
  step.
- The characters stand on the box's top edge, so they rise and fall with it.
  Where a figure would stand above the header — always with the box at the
  `top` — it is not shown.
- The stage sits above the nav bar and below the battle playback's results,
  the reveal and the rewarded video.

## 2. The box

- **A sheet of parchment on a carved wooden board**, one nine-sliced piece of
  art with organic edges — worn wood, a deckled sheet with one corner curled,
  brass rivets — and a soft shadow that lifts it off the map behind.
- **The name is on a cloth ribbon** with swallowtail ends, on the box's top
  edge on the speaker's side, in the speaker's own colour: Isolde blue, the
  Warden green, Bess red, Tom and Hob brown, Grukk crimson, Wren purple.
- **Places**: `bottom`, `top`, `middle`, or `auto`. Every authored line is
  `auto`.
- **`auto` keeps the speaker and what the line is about both in sight.** It
  tries, in order, and takes the first where neither the box nor anyone
  standing on it covers the target, and the cast fits under the header:
  1. **a little below the middle of the screen** — the default;
  2. the bottom, above the quest scroll;
  3. high, with room above for the cast;
  4. the very top, with no room for the cast — only when nothing else
     clears the target.
- A map target is judged at the middle of the screen, where the camera
  flies it. A target still arriving (a sheet unrolling) is judged again
  until it settles; after that the box moves only to stop covering it, or to
  make room for the cast again.
- **A box already on screen moves** to a new place in 0.32 s with a slight
  overshoot (OutBack), rather than jumping there.
- **One size, always**: three lines of text at the box's type. A line too
  long for it is set smaller until it fits, never let out of the paper, and
  no line is longer than 140 characters (`tests/stage.test.ts`).
- **The text types itself** at 40 characters a second, with a soft wooden
  knock every third letter (`textTick`, never on a space). A tap while it
  types finishes the line and nothing else; the next tap moves on.
- **A line that appears on its own** — a scene starting, a beat met — takes
  no input for its first 0.5 s (`help.inputGraceSeconds`), so a tap meant
  for the game never skips it.
- **A line that waits for a tap takes one anywhere on the screen** — the
  box, the map, a menu — and keeps it: the tap reaches nothing behind it.
  Panning the map is not a tap. A golden **quill** at the box's corner says
  a tap will move on.
- **A line waiting on the game** (a beat, [`23-tutorials.md`](23-tutorials.md)
  §3) shows no quill.

## 3. A line

| Field | What it is |
|---|---|
| `speaker` | who says it — a `speakers` id |
| `side` | `left` or `right` |
| `text` | what is said; `{player}` is the monarch's title. Empty: **the hand alone** — no box, nobody on stage, the hand on `point` until the line's condition holds (never `tap`) |
| `box` | `bottom` · `top` · `middle` · `auto` |
| `point` | what the pointer shows (§4), or nothing |
| `lock` | `none` · `target` · `map` · `all` ([`23-tutorials.md`](23-tutorials.md) §6) |
| `until` · `untilTarget` · `untilAmount` | the condition that moves the line on — `tap` for a tap on the box |
| `exit` | the speaker leaves after this line |
| `expression` | the speaker's face on this line: empty (at rest) · `happy` · `worried` · `surprised` · `idea` — drawn from `<portrait>_<expression>`, the picture swapped in place without a new entrance |
| `gives` | a book the speaker hands the player as the line is read — only a book that opens on a gift; none does today, so no line carries it |
| `stocks` | a building whose price the speaker makes up: the line plays only while the wallet cannot pay for one more of it, and as it is read hands over the missing currencies (never goods). Absent on every other line |

- A **scene** is an ordered list of lines, a **trigger** (a condition), and:
  - `skippable` — an introduction, which waits a breath after the last
    scene, rather than a beat of the First Morning;
  - `anywhere` — may it start over a sheet the player has open;
  - `where` — the province, the world board or either: where it starts, and
    where it plays (it pauses elsewhere);
  - `doneWhen` · `doneTarget` · `doneAmount` — a condition that makes it
    needless: holding when the scene is due, it is marked played without
    playing ([`23-tutorials.md`](23-tutorials.md) §1).
- Scenes are considered **in list order**, one at a time; one that cannot
  start where the player is lets the next one that can go first.
- **A `sighted` scene waits for the First Morning to end**: what stands in
  view past the fog never interrupts the morning's beats.

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
| `lair:` | the first lair found that still stands |
| `abandoned:<id>` | an abandoned building, wherever the fog has it — silhouette, ruin or revealed |
| `abandoned:<id>Fog` | the way to it: the ruin once its fog can be paid for; until then the cell the player can pay for that is nearest it |
| `reach:<building>` | where that building would work the most — its crew's cells in reach — of the ground it could stand on, cleared or still fogged; clear ground first, then the nearest the Townhall. The building being moved counts its own cell as free |
| `treasure` | the nearest treasure still on the ground |
| `hex:explore` | on the world board: the misty hex nearest the city that an explorer can reach and nobody is out to — one with a promise first |
| `hex:ready` | on the world board: the hex an explorer waits at for the player's tap |
| `quest` | the quest pill |
| `back` | the close of whatever is open on top — a menu or sheet before a card or the placement bar |

- **Read, then act.** A line that asks for an action plays in two turns:
  - **Reading**: the box and the cast are on screen and the line types; no
    hand. The target may glow, so the player sees what the line is about. A
    tap anywhere finishes the line, then moves to acting; nothing behind the
    box takes it.
  - **Acting**: the box and the cast fade out, the hand comes, and only now
    does the lock let the target take a tap. The next line brings the box
    back, its speaker walking on again.
- A line that waits for a tap is read only: it never shows the hand.
- **A gloved hand** (white glove, brass cuff) bobbing over the target,
  pointing down at it — or up from below, at the top of the screen.
- **A blue magic glow** marks it: a control's own silhouette lit blue
  (`--magic-glow-*`, the one cold light in a warm palette); a map plot as its
  own diamond in the same glow. Small motes of that light drift slowly off
  the target. Nothing else on the screen is darkened.
- The quest pill's hint wears the same hand and glow, so a player never learns
  two signs for one thing.
- **The camera glides to a map target** (0.2 s, easing out, no overshoot)
  before the line appears; `auto` judges the target where the glide ends. A
  hex target centres the world board's camera on it.
- A target that moves (a scrolling list, a card rebuilt) is re-found every
  frame.
- **A line that points at the nav bar is always preceded by one that walks
  the player back to the map** — `back`, locked to it, until `mainScreen`
  (`tests/stage.test.ts`). The nav bar steps aside for every sheet, card and
  placement bar; on the map already, that line is passed at once.

## 5. Conditions

A condition is a **kind**, a **target** and an **amount**. The kinds are code;
which one a line waits on is data.

| Kind | True when |
|---|---|
| `questReached` · `questComplete` · `questClaimed` · `questProgress` | that quest is active or past · done · claimed · its counter at `amount` |
| `techDone` · `techFilled` | that technology is researched · holds all its Knowledge |
| `placing` · `placed` · `built` | placing one · one is placed · `amount` finished (`AnyWorkshop` for any) |
| `moving` · `ghostReaches` | that building is picked up to be moved · its ghost (moved or placed) stands, legal, where its crew works `amount` cells |
| `reachCleared` | cleared ground stands where that building would work `amount` cells — the fog over the `reach:` spot is paid |
| `revealed` · `population` · `heroes` | `amount` cells revealed · villagers · heroes |
| `training` | a villager is in training, or `amount` villagers live |
| `sighted` | a silhouette stands past the fog: anything, a `mountain` · `landmark` · `lair`, a kind of landmark, or one lair |
| `overlay` · `noOverlay` · `ui` | that sheet is open · none is · that control (`data-coach`) is on screen — drawn, not merely in the page |
| `mainScreen` | back on the map: no sheet, no card, no placing |
| `taps` | `amount` taps on the ground since the line began |
| `lairFound` · `lairDefeated` · `lairCleared` | that lair (or any) found · beaten · claimed |
| `landmarkClaimed` · `landmarkSeen` | that landmark, kind or any claimed · that one out of the dark |
| `bookOpen` · `doorOpen` | that book · that door is open |
| `featureSeen` | a cell with that feature is out of the dark |
| `treasureRevealed` · `treasurePicked` | a treasure stands on revealed ground · `amount` picked up |
| `abandonedRevealed` · `siteOpen` · `repairing` | that abandoned building's ground is revealed · its card is open · its repair has started |
| `explorerSent` · `explorerReady` · `explorerRevealed` | `amount` explorers sent, ever · one waits at its hex for the tap · `amount` hexes revealed by that tap, ever |
| `holdsItem` · `itemUsed` | the Bag holds `amount` (at least one) of that item or kind of item · holds none of it any more |
| `manaEmpty` · `buildersBusy` · `raided` · `wounded` | the pool is dry · every builder is busy · a lair holds a hoard · someone is in the Infirmary |
| `always` | at once |

## 6. The cast

| Id | Name | Who | Art | Frame |
|---|---|---|---|---|
| `advisor` | **Isolde** | the Royal Advisor — the royal librarian, advising because everyone else fled the fog: cheerful, a little nervous, unsure of herself, with a book for most things. Dark hair in a scholar's bun, round thin-framed glasses, a royal-blue coat, a ledger and a brass key ring | `portrait_advisor` | full figure |
| `warden` | **the Warden** | captain of the guard; speaks at the first lair | `hero_warden` | full figure |
| `cook` | **Bess** | runs the Tavern; speaks when it opens | `hero_cook` | full figure |
| `woodcutter` | **Old Hob** | the woodcutter who never left the fog: gruff, superstitious, distrusts books, secretly proud of Isolde. Her foil | `portrait_hob` | full figure |
| `villager` | **Tom Miller** | the Millers' son, the first villager home | `portrait_villager` | full figure |
| `orcChief` | **Grukk** | the Orcs' warchief | `portrait_grukk` | full figure |
| `scout` | **Wren** | the Royal Scout, the kingdom's explorer on the world board: eager, quick, always first out of the gate. Speaks when she is sent out and when she has found something | `hero_scout` (until she has her own) | full figure |

- **Isolde has five faces** — at rest, happy (eyes closed, a wide smile, the
  ledger hugged), worried (a hand at her chin), surprised (leaning back, a
  hand raised), an idea (index finger up, a knowing smile) — each its own pose, aligned on her feet so a change of face
  never moves her. Claims and praise are happy; threats and shortfalls
  worried; what the fog gives up surprised; a new building or book to try,
  an idea.
- **Hob and Tom have four faces** — at rest, happy, worried, surprised.
  Hob's worried is a grumpy scowl, arms crossed.
- **Every speaker is a full figure**: it stands on the box, cut at the waist
  by it. The figures share the heroes' style and frame (512×768); the
  tutorial's own three are cut from one sheet
  ([`../art/ui/mockups/ftue/prompts.md`](../art/ui/mockups/ftue/prompts.md) P1).
- A **medallion** — a round avatar in a brass ring — is still drawn for a
  speaker whose `frame` says so, and a missing picture draws as a parchment
  medallion with the speaker's initial pressed into it, never an emoji.

### 6.1 The voices

- **A speaker taking their turn makes one short vocal emote** — a clear of
  the throat, a giggle, a gasp, a grunt — as their line appears; never on
  the next line they speak in a row. No words.
- **The emote follows the face**: `<speaker>_<expression>` where the mood has
  its own, the speaker's own otherwise; a speaker with none stays silent.
- The files are `src/audio/sounds/voice/`, a second at most; the sound
  toggle mutes them with every other effect.

| Speaker | At rest | Happy | Worried | Surprised | Idea |
|---|---|---|---|---|---|
| Isolde | clears her throat | a giggle | — | a gasp | a soft cheer |
| Hob | a smoker's cough | a smirking laugh | a sigh | "uhh?" | — |
| Tom | "yah!" | "yehey!" | — | "ooh!" | — |
| the Warden | a short shout | — | — | — | — |
| Grukk | an orc grunt | — | — | — | — |
| Bess | "yahoo!" | — | — | — | — |

## 7. Where it lives

- Scenes, speakers and the help's timings are three collections in
  `?dev=data` › Progression: **Scenes**, **Speakers** and **Tutorial help**;
  a data rule checks every condition's target exists.
- **The sim never reads them.** The stage is UI; the save keeps only which
  scenes have played ([`23-tutorials.md`](23-tutorials.md) §7).

## 8. Deliberately not in this design

- Lip flaps, spoken words, or an expression for a speaker who has no art for it.
- More than one character per side, or a third slot.
- Choices, branching, or a line that changes the game.
- A Skip button: a tap anywhere moves a line on, so a scene is over in a few taps.
- A dialogue log or a replay.
- Rich text beyond a bold word.

**Open questions:** **OQ-117**.
