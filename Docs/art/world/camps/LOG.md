# Camps and precious materials — provenance (2026-10-05)

ChatGPT, three parallel chats, one generation each, true alpha first try.

| Output | Source | Prompt | References |
|---|---|---|---|
| `src/render/assets/whex_camp_{orcs,goblins,harpies,wolfriders}.png` | `camps/camps-sheet1.png` (1536×1024, 2×2) | `camps/camps.prompt.txt` | `camps/ref-whex.png`, `camps/ref-lairs.png` |
| `src/render/assets/whex_camp_drake.png` | `camps/camp-drake.png` (1536×1024) | `camps/drake.prompt.txt` | the same |
| `precious/{Starmetal,Heartwood,Moonglass}.png`, `../ui/sheets/ui-o1-precious.png` | `precious/precious-sheet1.png` (1254×1254, 2×2, BR empty) | `precious/precious.prompt.txt` | `precious/ref-currencies.png`, `precious/ref-heroes.png` |

- Camps: `norm_hex.py <sheet> <quadrant> <out> --width 256 --fill 0.94` — a
  256 px canvas (half a hex at 2×), foot on the bottom edge; the drake the
  same by hand (whole canvas). One stray speck under the goblin camp removed.
- Precious icons are NOT in the atlas yet: an atlas cell must be an
  `IconName` (`tests/icons.test.ts`). To ship them, add a manifest sheet
  `sheets/ui-o1-precious.png`, grid 2×2, `evenGrid`, names
  `["Starmetal","Heartwood","Moonglass",null]`, plus the names in
  `src/ui/kit/icon.ts`, then `npm run art`.
