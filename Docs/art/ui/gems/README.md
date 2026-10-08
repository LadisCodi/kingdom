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

## The packs

| File | What it is |
|---|---|
| `packs-a.master.png` | pouch, purse, chest, vault — asked in the same chat, the gem above attached as THE gem |
| `packs-b.master.png` | hoard, treasury, and the offer splash's sack (the fourth cell left empty) |

Cut by the sheet's real gutters (the sack spills past the midline), specks
under 2% of the largest blob dropped, fitted to 256×256:
`src/render/assets/gems_{pouch,purse,chest,vault,hoard,treasury}.png` and
`src/ui/assets/offer-gem-sack.png`.
