# Gacha reveal — ChatGPT mockup prompts (m99)

The hero call's reveal, redone as a Clash Royale-style chest opening: the
container lands at the bottom, rewards come out one at a time as face-down
cards, a tap flips each, a summary closes it. Replaces `m15-gacha-reveal.png`.

Refs, in this order: `m95-refs/ref-m96-anchor.png` (the store's Heroes tab,
style anchor), `m95-refs/ref-kit.png`, `m95-refs/ref-heroes-bodies.png`,
`m99-refs/ref-icons.png` (silver/gold key, chest, stardust, gems, hero
fragment, ascension star), `m15-gacha-reveal.png` (the old reveal: content
only). Round 2 attaches `m99c-reveal-legend.png` (as ref-legend),
`m99a-reveal-chest.png` at 1400 px wide (as ref-storyboard) and
`m99-refs/ref-style-art.png` (hero bodies + chest icons montage).

Results: `m99a` chest storyboard, `m99b` card-box storyboard (rejected),
`m99c` legendary flip, `m99d` cards settling into the summary. Final art in
`Docs/art/ui/chests/` (true alpha first try; cut by even 4×2 cells, open row
nudged 3 px down to sit on the closed row's base) → `src/ui/assets/chest/`.
Sounds from `~/Sonidos/Coleccion`, loudness-normalised → `src/audio/sounds/chest_*.ogg`
(sources listed in `src/audio/sfx.ts`).

## Shared preamble

GENERATE A NEW IMAGE. The attached files are only references, do not edit or export them.

Image 1 is our approved store screen: copy its style exactly (flat cartoon, bold dark-brown outline, lit from above, warm wood, yellowed parchment, brass nails, red cloth, red wax, gold). Image 2 is the kit of pieces (ribbon, nailed frame, plaque, tiles). Image 3 holds our hero full-bodies. Image 4 holds our icons: silver key, gold key, chest, Stardust (blue sparkling pile), Gems, hero fragment (pale blue crystal), ascension star. Image 5 is our OLD reveal screen: take its CONTENT only, it is the design being replaced.

Everything is made of MATERIALS (wood, parchment, rope, cloth, brass, wax, gold), never plastic gloss, never blue glassy UI, never neon. All text in English, legible chunky lettering; if text is unclear prefer fewer, larger words. No watermark, no logo. Raw image only: do not resize, verify or save a corrected file.

## A — the chest (storyboard, 4 phones side by side)

Draw a STORYBOARD: four portrait phone screens (iPhone X proportions) side by side in one wide landscape image, numbered 1 to 4 under each, showing the reward reveal after the player made a hero call in the store of a medieval kingdom city-builder. The flow is like Clash Royale's chest opening (layout and rhythm only, never its style). The whole game is dimmed behind a dark warm vignette with soft god-rays from above; the resource header plank stays visible at the top.

1. "The chest lands": at the bottom third, a big wooden chest bound in SILVER/steel straps with a silver keyhole (the common call; a silver key from image 4 hovering in front of the lock, about to turn). Dust puffs where it landed. A small wooden counter tag beside it shows "5" (rewards inside). Text above: "Tap to open".
2. "Opened": the lid thrown open, warm light and sparkles pouring out, and ONE card risen out of the chest, floating in the centre of the screen, FACE DOWN: a card back of carved dark wood with a brass corner fittings and a red wax seal with a crown. The counter tag now reads "4". Small text "Tap to reveal".
3. "Flipped": the same card face up (mid-screen, big, portrait 2:3), parchment face in a gilt frame: a big Stardust pile, the label "Stardust" and a big count "x500". A short burst of blue sparkles around it. The chest below still glows, counter "4".
4. "Summary": the chest gone; a wooden plaque "Rewards" over a parchment panel holding a neat grid of SMALL tiles of everything collected: Stardust 500, Gems 20, a hero fragment stack of the scout x3, a hero fragment stack of the paladin x2, and one larger gold-framed hero tile "The Warden" with a "NEW" ribbon. A wide green slab button "Collect" at the bottom.

## B — the deck (storyboard, same four beats, a different container)

Same as A, but the container is NOT a chest: a carved wooden CARD BOX standing on a tavern table at the bottom of the screen, its lid a brass-hinged flap with a gold keyhole (the golden call: the gold key from image 4 turns in it). In 2 the flap flips open and the top card SLIDES UP out of the box and spins to the centre, face down (card back: deep red cloth over wood, gold filigree, a gold crown). Counter as a brass number on the box. 3 and 4 as in A.

## Hero — the flip that interrupts (one portrait screen)

Draw ONE portrait phone screen (iPhone X proportions): the moment a card in the reveal flips and turns out to be a NEW LEGENDARY HERO. Dark warm stage, the open GOLD chest (gold straps, gold keyhole) glowing at the bottom. Centre: a big 2:3 hero card, just flipped, gold-framed, with golden radial rays behind it and gold confetti/sparkles bursting outward. On the card: the golden dragon hero from image 3, full body, on a gold background; a ribbon across the bottom of the card with "The Golden Dragon", five ascension stars from image 4 under it (one lit). Above the card a carved-wood plaque with a gold crown: "A LEGEND ANSWERS". A small rarity tag "Legendary". At the bottom "Tap to continue". This screen is the biggest event in the reveal: make it feel like a celebration.

## Decisions after round 1 (2026-10-07)

- Chests (A), not a card box: silver for the common call, gold for the golden call, and the same flow for every reveal of RANDOM rewards (relic fragment pack, random spoils) with its own chest.
- A full-screen stage of its own (C), not the store dimmed behind.
- Each flipped card flies to its final slot as the next one comes out — it shrinks, settles and dims slightly. When the last one lands, all un-dim: the cards on the stage ARE the summary. No wooden summary panel.

## Round 2 — the flow (refs: ref-legend, ref-storyboard)

GENERATE A NEW IMAGE. The attached files are only references, do not edit or export them. Image 1 is our approved style and STAGE for the reward reveal (a dark warm treasure hall, torches, banners, a red round carpet, the chest standing on it). Image 2 is an earlier storyboard of the flow: keep its chest, card back and card faces.

Draw a STORYBOARD of two portrait phone screens (iPhone X proportions) side by side, numbered 1 and 2 underneath, both on image 1's full-screen stage (no resource header, no store behind: the reveal covers the whole screen).
1. "Mid-reveal": the SILVER-bound chest stands open on the carpet at the bottom, glowing, a small wooden counter tag "2" beside it. Centre: a big just-flipped card (parchment face in a gilt frame): the scout's face with a pale blue crystal fragment, "Scout fragments", "x3". In the UPPER part of the screen, laid directly on the stage (NO panel, NO frame, NO wooden board behind them), two SMALL cards already sit in their final slots of a neat centred grid, slightly darkened: "Stardust x500" and "Gems x20". The empty slots still to fill are not drawn.
2. "All revealed": the chest has sunk away; five small cards in their final grid on the stage, now at full brightness with a soft glow: Stardust x500, Gems x20, Scout fragments x3, Paladin fragments x2, and a larger gold-framed hero card "The Warden" with a red "NEW" ribbon. Above the grid a carved-wood plaque "Rewards"; below it one wide green slab button "Collect".
Everything is made of MATERIALS (wood, parchment, brass, wax, gold), flat cartoon, bold dark-brown outline, lit from above, never plastic gloss, never blue glassy UI. All text in English, legible chunky lettering. No watermark. Raw image only: do not resize, verify or save a corrected file.

## Round 2 — the chests (refs: ref-style-art, ref-legend)

GENERATE A NEW IMAGE. The attached files are only references, do not edit or export them. Image 1 shows our game art style (heroes and a treasure chest icon): bold uniform dark-brown outline, flat colours with one shadow tone and one highlight, no textures, no scratches, few details, lit from above. Image 2 shows the chest designs we approved in a mockup.

Draw a SPRITE SHEET of treasure chests for a mobile game, 4 columns x 2 rows, each chest in the centre of its cell, all the same size and the same 3/4 front view seen slightly from above, exactly image 1's style. Columns, left to right:
1. COMMON: a wooden chest bound in SILVER / steel straps, a silver lock plate with a keyhole.
2. GOLDEN: a red-lacquered wooden chest bound in GOLD, a gold lock plate, a small gold crown on the front.
3. RELIC: a dark violet-stained wooden chest bound in brass, a lock plate with a softly glowing blue rune.
4. SPOILS: a rough plank war chest with iron bands and a rope knotted around it.
Row 1: each chest CLOSED. Row 2: the SAME chest, same position, same size, same body, with the lid thrown OPEN backwards, empty inside, a warm golden light filling the inside of the box only (no beams leaving it, no items).
Leave a clear 40 px empty band between cells; nothing may cross a cell border. Do not draw grid lines, cell borders, labels, captions, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

## Round 2 — the stage and the card back (refs: ref-legend, ref-style-art)

GENERATE A NEW IMAGE. The attached files are only references, do not edit or export them. Image 1 is our approved reward-reveal screen; image 2 our art style (bold dark-brown outline, flat colours, one shadow tone, one highlight, no textures).

Draw ONLY THE BACKGROUND of image 1, as an opaque full-bleed portrait painting, 1080x1920: the interior of a castle treasure hall at night, dark and warm, torches burning on stone pillars at both sides, two blue banners with a gold fleur-de-lis hanging high at the sides, a round red carpet with a gold emblem on the floor in the lower third, a soft pool of warm light falling from above onto the centre. NO chest, NO card, NO plaque, NO text, NO confetti, NO UI at all. Keep the middle and the upper half dark and quiet so cards read over it; detail only at the edges. Same flat cartoon style as image 2. Raw image only: do not resize, verify or save a corrected file.

(Second message, same chat:) GENERATE A NEW IMAGE. Now the BACK of a playing card for the same game, alone, portrait 2:3, filling the image: carved dark wood planks in a gold frame with brass corner fittings, a red wax seal with a gold crown in the centre, same flat cartoon style. Do not draw shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

## Round 3 — painted card fronts and ribbons (refs: m99-refs/ref-card-back, m99c)

After playing it the user asked for textured, material cards like the back,
more party for a whole hero, the chest to open on its own (the key never
lined up with the lock), and a fragments bar that recruits.

- Fronts: a 4×1 sheet, "EXACTLY the same gold frame … only the centre panel
  changes … EMPTY": reward (parchment), common (blue cloth + rays), rare
  (violet), legendary (gold, red gem on the frame). True alpha first try;
  cut by even quarters → `card-front-*.png` 400×600.
- Ribbons: three rows — an empty red name ribbon with swallow tails, a "NEW"
  pennant on a gold pole, an empty wooden count plate. True alpha; cut by row
  bands → `card-ribbon.png`, `card-new.png`, `card-plate.png`.
