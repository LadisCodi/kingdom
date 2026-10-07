# 26 · Notices — the bubbles in the corner

> **Scope.** The one channel for **things the player may not have seen**:
> round bubbles in two columns — the news at the bottom right, the standing
> states larger at the top right — in the province and on the world board, each opening a card that says what happened and takes the
> player to it. It replaces the banner, the right-edge tabs and the toasts
> that carried news. Refusals stay toasts.
>
> **Status: built.**

## 1. Two kinds of notice

| | **News** | **State** |
|---|---|---|
| What it is | something that happened | something that stands |
| Leaves | when its card is opened | when it stops being true |
| Opening it | reads it: the bubble goes, the card keeps what it said | changes nothing |
| Kept in the save | yes | no — derived on every notify |
| Made by | the sim (`advance()` and commands) and the world effects | the game, from the state |

- **A news is identified by its event, never by its moment**: its key names
  what happened (`built:<district>:<level>`, `raid:<lair>:<raidAt>`,
  `world:<effectSeq>`), so the same event never makes two.
- **News of one group share one bubble**, with a count: *3 buildings
  finished*. The card lists them, one row each.

## 2. The catalogue

### 2.1 News

| Group | Made when | Picture | Go | Second button |
|---|---|---|---|---|
| Built | a construction or an upgrade completes | the building at its level | the building, card open | — |
| Trained | a military building's training queue **runs dry** — its last soldier is out and it stands idle; one news per hall, never one per soldier | the building at its level | that building | — |
| Goods | a workshop finishes goods | the good, with how many | the workshop | — |
| Raided | a lair raids the city: what it took | the creature | the lair | — |
| Sighted | a landmark, lair or abandoned building is sighted, unless a scene introduces it | the site | the site | — |
| Explorer home | an explorer comes home: hexes revealed | the compass | the hex it went to, on the board | — |
| World build | a world building finishes | the building | its hex | — |
| Army home | an army comes home: how many came back, how many fell | the army | the home hex | — |
| World report | a world report effect: ground won or lost, a garrison held or fell, a camp raided a hex, a relic lost, a dungeon closed, an exchange returned | the hex's art; good or bad tone | its hex | — |
| Portal | the Dark Portal opens; or it closes with the player ranked where it pays nothing — the place, of how many, the floor | the Portal, open or shut | the Portal nearest the city | — |
| Event | an event window opens ([`13-events.md`](13-events.md)) | the calendar | — | — |
| Chain done | the last quest is claimed | the crown | — | — |

- A **world report** effect carries the hex it happened at; one without a hex
  has no Go.
- A **raid** carries the lair and what it took. Several raids in one absence
  are one bubble.
- **The Portal opening** is news once an opening, on whichever view the
  player is on when the board is next read.

### 2.2 States

| State | Shown while | Picture | Go | Second button |
|---|---|---|---|---|
| Raid coming | a lair's gate is open — the nearest raid, its countdown, a count when several | the creature + the countdown | the lair | — |
| Mana refill | the rewarded-video offer is open ([`08-magic.md`](08-magic.md) §6) | the Mana flask | — | **Watch** |
| Relic asleep | a city relic's window has closed ([`09-relics.md`](09-relics.md) §2.1) | the relic | the relic's sheet, where it is woken | — |
| Tomorrow's part | a bought pack's next-day part is waiting — countdown, then ready | the chest | — | **Claim** when ready: the offer's splash |
| Portal reward | a closed Portal opening placed the player where it pays Gems ([`19-world-map.md`](19-world-map.md) §10.4) — the place, the floor, the Gems | the Portal, shut; it glows | — | **Claim**: the Gems |
| Free call | a free gacha pull is waiting | the key | the store's Heroes | — |
| Army ready | an army of the player's waits at a camp for the word to attack ([`19-world-map.md`](19-world-map.md) §5.4) | the camp; it glows | the camp's sheet | — |
| Hero rested | a hero who came back exhausted is whole again | the hero's bust | the heroes sheet | — |

- **Hero rested** goes when that hero next fights, or when its card is opened.
- A state with a countdown shows it on the bubble; one that is ready glows.

## 3. The columns

- **Two columns**, both shown in the province and on the world board. A
  notice whose subject is in the other view carries a small seal: the castle
  or the globe.
- **The standing states** (§2.2) — true until they stop being true: **top
  right, under the settings knob**, growing downward, **larger** than the
  news (68 against 52). The raid first, then the rest in the order of §2.2.
  Never folded under a +N, never gone on their own.
- **The news**: **bottom right, above the world knob**, growing upward,
  newest first.
  - **At most 4 bubbles.** With more than 4, 3 show and the fourth is
    **+N**, at the top, whose card lists every news.
  - **A news unread goes on its own**: after **10 seconds on screen** it
    blinks for its last 3 and is read, as opening it would. Only the time it
    is on screen counts — not while a sheet hides it, nor while it waits
    under the +N — and a news that gains an item starts again.
- **Hidden** while a sheet, a card or a mode is open. The full-screen
  layers (battle, scene, splash, gacha, ad) sit above them.
- Z-order: the right-edge column's slot (4) — over the map, under the
  district card and the menus.

## 4. The bubble

- **A round wooden medallion with a brass rim**; the picture sits inside it,
  embossed.
- **Red wax seal** with the count on a news group of 2 or more.
- **A small wooden plaque** under a state with a countdown, showing the time.
- **A new bubble pops in** with a chime. Nothing opens by itself.
- **A tap opens its card** — except the Mana refill's, which opens the Mana
  sheet, where the video already sits beside the Gem refills.
- **Every event leaves a bubble**, seen or not.

## 5. The card

- **A parchment card** in `#overlay`, the header still readable:
  - title;
  - one paragraph;
  - the picture, wide;
  - **Go** and the second button, if any;
  - the close X.
- **A group** lists its rows, each with its line and its own Go.
- **+N** lists every news as a row; a row opens that news's card.
- Opening a news's card reads its group: the bubble goes at once, and the
  card keeps what it said. Go closes the card first.

## 6. Go

- **A building or cell in the province**: leave the world board if out on it,
  glide the camera there, open its card.
- **A hex**: enter the world board if at home, glide to the hex, open its card.
- **A sheet**: open it.

## 7. The inbox

- News live in the save: newest first, **capped at 30**. When the cap is
  reached, the oldest news is dropped.
- **The sim writes news the same way live and in replay**: an absence leaves
  its bubbles. The world effects add theirs when the snapshot is applied.
- **The welcome sheet stays**: it summarises the absence, and the news it
  summarises stay in the column.

## 8. What it replaces

- **Gone:**
  - the banner (`#notice`);
  - the three right-edge tabs (Mana refill, relic asleep, tomorrow's part);
  - the toasts for raids, world reports, explorers home and world builds.
- **The raid widget** of [`18-garrisons-and-raids.md`](18-garrisons-and-raids.md) §7 is the
  *Raid coming* state and the *Raided* news.
- **Stays as it is:**
  - refusal toasts;
  - the unlock splash;
  - the quest pill;
  - the Survey and offer widgets;
  - the bubbles over buildings and hexes on the map.

## 9. Dials, in the order to reach for them

| Dial | Value | Key |
|---|---|---|
| News bubbles shown before +N | 4 | `notices.shown` (`economy`) |
| How long an unread news stays, and blinks before it goes | 10 s · 3 s | `NEWS_LIFE_MS`, `NEWS_WARN_MS` (`ui/notices/column.ts`) |
| News kept | 30 | `notices.kept` (`economy`) |

## 10. Deliberately not in this design

- Device push notifications.
- A card that opens by itself.
- A history of read news.
- Muting a kind of notice.
- A bubble for a refusal.

**Open questions:** OQ-133 in [`../open-questions.md`](../open-questions.md).
