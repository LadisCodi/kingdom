# Battle art — grounds and villains

> **Scope.** The art of the battle playback that is not the troops' or the
> heroes': the **ground** each kind of fight is drawn on, and the five
> **villains** who hold the dungeons' boss rooms. The screen is
> [`../../features/11a-ruins-ui.md`](../../features/11a-ruins-ui.md) §2.7.
> **Status:** all four grounds and all five villains drawn and in the build
> (2026-10-07), generated with ChatGPT.

## 1. The grounds

- One image per kind of fight, picked by `BattlePlayback.backdrop`:

| Backdrop | Where | File |
|---|---|---|
| `field` | a lair in the province | `src/ui/assets/battle-ground-field.jpg` |
| `dungeon` | a world dungeon's room | `…-dungeon.jpg` |
| `boss` | a depth's boss room | `…-boss.jpg` |
| `portal` | the Dark Portal's floors | `…-portal.jpg` |

- **Seen from directly above**, portrait 2:3, drawn to `cover` behind the
  board.
- **Quiet in the middle**, mid-to-dark and a little muted, so the cream and
  gold rings read on top; every prop at the left and right edges and the
  corners.
- Masters in `../originals/battle-grounds/` (1024×1536 PNG); shipped as
  768×1152 JPEG, quality 82.

**The prompt.** `bg-<backdrop>.prompt.txt`, with `style-reference.png`
(heroes, a lair, the grass tile) and `layout-reference.png` (the battle
screen) attached. `field` came first; the other three also attach the
`field` master as the treatment to match, so the four read as one set.

## 2. The villains

- Same frame, style and pipeline as the heroes
  ([`../portraits/hero-illustrations.md`](../portraits/hero-illustrations.md)
  §3, §6): a full figure, true alpha, cut with `cut_heroes.py` into a
  512×768 frame. `VILLAINS[<id>].sprite` names the file.
- What makes them villains: scowls and sinister grins, a darker palette,
  glowing eyes or an eerie light — in the heroes' storybook hand, never
  horror. No gore, no mounts.
- Each wears its dungeon (`../../features/11-expeditions.md` §4) and holds
  what its `unitType` and skill say:

| Villain | Dungeon | Holds |
|---|---|---|
| Barrow Thane | Hollow Barrow | sword and barrow-mound shield; green soul-smoke (Mend) |
| Drowned Choir | Sunken Chapel | a whalebone baton, notes of water (Volley) |
| Slag Warden | Drowned Ironworks | a spear-tipped foundry poker, an iron plate across his front (Bulwark) |
| The Ledger Keeper | The Counting House | a quill-hilted rapier, a chained ledger, riding boots and spurs; a spiral in the monocle (Daze) |
| The Star Seer | Star Observatory | an astrolabe staff, a falling star in her palm (Crush) |

- Two passes. `villains-sheet-<n>.prompt.txt` (with
  `../originals/hero-style-tests/anchor.png` attached) set the designs but
  came back more detailed than the heroes — scales, rivets, texture strokes
  (`../originals/villain-sheets/sheet-<n>-detailed.png`).
  `villains-flatten.prompt.txt`, with the anchor and the detailed sheet
  attached, redrew the same designs in the heroes' flat hand: these are the
  shipped `sheet-<n>.png`.
- Sheet 1's first two figures touch (the soul-smoke, the notes), so it is
  cut after clearing a 13 px seam of least alpha between each pair of
  figures; `cut_heroes.py` then finds three blobs.

## Deliberately not in this design

- No ground per dungeon theme: the world's dungeons are not typed, so a room
  is a room and a boss hall a boss hall.
- No animated ground: the effects layer is what moves.
