# The delve screen's art — provenance (2026-10-05)

ChatGPT, three parallel chats, one generation each; true alpha first try on
both transparent sheets. References attached to every chat: `ref-kit.png`
(a montage of `src/ui/assets` — frame, panel, plates, buttons, knob, nail,
seal) and `ref-m65.png` (the M65 delve mockup, resized).

| Output (`src/ui/assets/`) | Size | Source | Prompt |
|---|---|---|---|
| `delve-rock.png` (opaque tile) | 1024×1024 | `rock-raw.png` (1254²) | `rock.prompt.txt` |
| `delve-node.png`, `delve-node-lit.png` | 256×229 each | `nodes-sheet1.png` (1254², 2×2) TL, TR | `nodes.prompt.txt` |
| `delve-node-boss.png` | 320×288 | `nodes-sheet1.png` BL | `nodes.prompt.txt` |
| `delve-torch.png` | 113×256 | `nodes-sheet1.png` BR | `nodes.prompt.txt` |
| `delve-stair.png` | 256×228 | `stair-raw.png` (1254²) | `stair.prompt.txt` |

- **Rock tile**: raw seams 4.7 (left/right) and 5.2 (top/bottom) against
  3.0 inside. Healed as in `Docs/art/fog/README.md`: rolled by half, a 14 px
  band blended with a 4 px blur across each seam, rolled back. Lifted ×1.12
  + 6 so cream text reads over it (mean 58/255). Resized on a 3×3 tiling and
  the centre cut, so the resize wraps. Final seams 0.5 and 0.7, below the
  interior's own 3.7; checked tiled 2×2.
- **Nodes sheet**: the boss's horns cross the sheet's midlines, so pieces
  were cut by connected blob, not by quadrant. The plain and lit nodes share
  one crop box (same centre, same size), so they swap in place.
- Every transparent final: corner `srgba(0,0,0,0)`, alpha below 4 zeroed,
  no checkerboard.
