# Unlock splash — ChatGPT mockup prompts

Attach, in this order: `m15-gacha-reveal.png` (the reveal banner, its rays
and its "Tap to continue"), `m35-upgrade-popup-final.png` (the UI kit).

## A — a new mechanic (Heroes)

GENERATE A NEW IMAGE. Do not edit or export the attached files: they are ONLY style and content references.

Mobile game UI mockup, portrait phone screen 1080x1920, cozy fantasy kingdom builder. Same art style and UI kit as the attached mockups (image 1: the hero reveal, image 2: "Upgrade to Level 3" popup): warm, natural, textured materials — carved wood, yellowed parchment, cloth, brass, gold — lit from above, never flat fills or plastic gloss; chunky rounded serif lettering in cream with a dark outline.

The screen: a FULL-SCREEN UNLOCK SPLASH that appears when the player unlocks a major new part of the game. Here: HEROES.
- The whole game behind is covered by a dark, semi-transparent veil (black at about 75%): the kingdom map, the resource header plank at the top and the wooden nav bar at the bottom are still faintly visible through it, dimmed. No window, no frame, no title plank, no close button — the splash floats directly on the veil.
- Slightly above the centre: one LARGE icon of the unlocked feature, about 40% of the screen width — the steel knight's helmet with a gold trim from the nav bar's "Heroes" button in image 1, painted big and detailed in the same style.
- Behind the icon: a soft golden burst of light rays radiating from its centre, like a slowly rotating sunburst (long thin tapering rays alternating with shorter ones, warm gold fading to transparent at the ends), plus a few tiny sparkles. The rays sit BEHIND the icon and reach about 1.6× the icon's width.
- Under the icon: the feature's name as the headline, "Heroes", big, on a dark-red cloth ribbon banner with folded tails (or as large gold lettering if the ribbon crowds it).
- Under the name: one short paragraph of description in cream, centred, comfortably readable, at most four lines: "Heroes lead your troops into battle. Recruit them, level them up and send them to clear the gates and lairs around your kingdom."
- Near the bottom of the screen, well below the paragraph: a small, quiet "Tap to continue" in light cream, slightly transparent, exactly like image 1's.
Nothing else on the screen: no buttons, no currencies, no extra text.

Legible chunky lettering; if text is unclear, prefer fewer, larger words. No watermark, no logo, no border outside the phone screen. Raw image only — do not resize, verify or save a corrected file.

## B — a new research book (same chat)

Same splash, LOCKED style, for a new research book. Change only the content: the icon is a thick closed leather-bound spell tome, deep violet cover with brass corners and a glowing violet rune on the front; the headline is "Book of Magic"; the paragraph: "A new book of research is open. Its technologies bring Mana, spells and the arcane buildings of your kingdom." Keep the veil, the golden rays behind the icon, the ribbon and "Tap to continue" exactly as before. Raw image only — do not resize, verify or save a corrected file.

## Icons

The icons are drawn in the heroes' flat cartoon (`Docs/art/portraits/hero-illustrations.md`
§3.1), not in the painted look of the mockups above — that look was too
detailed for the game. One new chat; attach, in this order:

1. the STYLE anchor — `magick montage` of `src/render/assets/hero_{warden,wizard,paladin,merchant,scholar,druid}.png`
   and `unit_{warrior,archer,cavalry,lancer}.png` (`-tile 5x2 -geometry 300x360+12+12 -background white`);
2. the SUBJECTS — a montage of the first, painted pass, as "what to draw, simplified".

Sheet 1 opens with:

> CREATE A NEW IMAGE. Do not edit or export the attached files. Image 1 is the STYLE reference — heroes and troops already in this game; match their style exactly, it is LOCKED. Image 2 only says WHAT to draw: its icons are too detailed and too painted for the game — redraw the same objects, simplified, in image 1's style.

Every sheet then carries the style block and the tail:

> === STYLE ===
> Flat 2D cartoon illustration for a cozy medieval-fantasy mobile strategy game, exactly the hand of image 1's heroes and troops — NOT 3D, NOT a render, NOT painted, NOT realistic. Bold, clean dark-brown outlines on every shape, uniform in weight. Flat colour with simple cel shading: one shadow tone and one small highlight per material, no gradients, no textures, no scratches, no wood grain, no ambient occlusion. Big simple readable shapes, slightly chunky friendly proportions, few details — far fewer than image 2. Warm saturated palette, steel grey for metal, gold accents, exactly the colours of image 1. Lit from the top left. Draw as if shown 150 px wide: nothing thinner than the outline.

> Do not draw grid lines, cell borders, labels, captions, text, light rays, glow, sparkles, shadows, ground or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

A 2×2 sheet's composition: *A square 2×2 sheet of game icons, one object per quadrant, centred, each filling about 75% of its quadrant, front three-quarter view; nothing may cross the canvas midlines — keep a clear 40 px band along them.*

### Sheet 1 — the mechanics

- top-left — BUILD: a hammer, wooden handle and steel head, tilted 45°;
- top-right — RESEARCH: a parchment scroll half unrolled, with a quill feather across it;
- bottom-left — HEROES: a steel knight's helmet with gold trim and a gold ridge, like the warrior's helmet in image 1 but grander;
- bottom-right — RELICS: a closed red treasure chest with gold bands and a gold lock.

### Sheet 2 — the books (same chat: "same style as the sheet you just made — LOCKED")

Four research books as one family — the same thick closed leather-bound tome, same shape and angle, brass corners and a bookmark ribbon; only the cover colour and the emblem change.

- top-left — WARFARE: crimson cover, two crossed swords on a round shield;
- top-right — MAGIC: deep violet cover, a glowing violet rune in a circle;
- bottom-left — SAGAS: forest-green cover, a winged helmet in a laurel wreath;
- bottom-right — ATLAS: navy-blue cover, a compass rose.

### Sheet 3 — the world (same chat)

One icon alone, centred on a square canvas, filling about 75% of it — THE WORLD: an antique globe on a wooden stand with a gold meridian ring, cream oceans and green-and-ochre lands.

## Cutting

`Docs/art/ui/unlock/cut.sh` cuts the three sheets in `Docs/art/ui/unlock/`
into `src/render/assets/unlock_<id>.png`, 512×512.
