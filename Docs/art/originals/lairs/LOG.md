# Lairs — art provenance

Generated with ChatGPT on 2026-09-30 for `Docs/proposals/lairs.md`.

| Game file | Source | How |
|---|---|---|
| `src/render/assets/lair_{orcs,harpies,goblins,wolfriders,drake}.png` | `Docs/art/features/lair_*.master.png` | One sprite per chat turn from `Docs/art/features/lair_*.prompt.txt` (props.json → `make-prompt.mjs`), style anchored on `style-reference.png` plus a montage of shipped map sprites, then the first two lairs. True alpha asked for in the prompt. `-resize 50%` → `norm_prop.sh <master> <out> <scale> 2 1` (scale 1.15, drake 1.3). |
| `src/render/assets/creature_{orc,goblin,harpy,wolfrider}_avatar.png` | `creature-avatars-sheet.png` | A 2x2 sheet of round medallion busts, anchored on the soldiers' `unit_*_avatar.png` and figures. `cut_avatars.py` cuts each at its RING (not its ink), so a spear or a wolf poking out never shrinks the medallion. |
| `src/render/assets/creature_drake_avatar.png` | `creature_drake_raw.png` | Same chat, one medallion; `cut_avatars.py <raw> <out>`. |
| `src/render/assets/lair_art_{orcs,harpies,goblins,wolfriders,drake}.png` | `illustration_*_raw.png` | The lair card's illustration, 16:9 opaque, anchored on the orc painting in `Docs/art/mockups/lairs/card.png`, each with a calmer bottom fifth for the flavour line. `-resize 960x540^ -extent 960x540`. |

Creature per troop type (the board and roster portraits): Warrior → orc,
Lancer → goblin, Archer → harpy, Cavalry → wolf rider; the drake is the Drake
lair's own face on its bubble and card.
