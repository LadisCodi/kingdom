# Gems — the blue gem

The premium currency's art, redrawn blue from scratch (2026-10-08) in the
resource sheet's style, replacing the old purple gem that had been tinted blue.

| File | What it is |
|---|---|
| `gem-proposals.prompt.txt` | the prompt, sent with `sheets/ui-a2-currencies.png` (flattened on white) attached as the style reference |
| `gem-proposals.master.png` | what came back: four designs, 2×2, true alpha |
| `gem.master.png` | the chosen one — the brilliant cut, top left — trimmed |

The chosen gem is pasted into `sheets/ui-a2-currencies.png` (row 2, column 2,
268 px inside its 314 px cell, like its neighbours); `npm run art` slices
`Gems`, `Gems-sm` and `Gems-locked` from there.

Next: the Gem packs and everything else that shows Gems, built from this gem.
