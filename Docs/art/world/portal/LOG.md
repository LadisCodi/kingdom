# The Dark Portal — provenance (2026-10-07)

ChatGPT, one chat, one generation, true alpha first try.

| Output | Source | Prompt | References |
|---|---|---|---|
| `src/render/assets/whex_portal.png` (shut), `whex_portal_open.png` (open) | `portal-sheet1.png` (1536×1024, left / right) | `portal.prompt.txt` | `ref-whex.png` |

- `norm_hex.py portal-sheet1.png left|right <out> --fill 0.92` — a 512 px canvas,
  foot on the bottom edge.
- The board draws it on grassland's plate (its grass ring meets the
  neighbours) and picks the sprite by whether the Portal is open; the hex
  card's portrait and the notices use the same two.
