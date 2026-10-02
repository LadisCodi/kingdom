# The fog — mockup prompts

> **Scope.** The ChatGPT mockup that fixes the look of the fog
> ([`../../art-direction.md`](../../art-direction.md) §8.1): a sunlit sea of
> clouds in place of the dark fog of war.
>
> **Status: locked 2026-10-02** — `sea-of-clouds.png` is the target;
> `before-dark-fog.jpg` is the fog it replaces, and the screenshot every prompt
> was anchored on.

**References to attach**

- `before-dark-fog.jpg` — the game as it is, UI hidden: the scene to keep.
- `../../style-reference.png` — the locked art style.

**Prompt 1 — the scene**

```
GENERATE A NEW IMAGE. Do not edit or export the attached files: they are
references only. Image 1 (before-dark-fog.jpg) is a screenshot of our game as
it is today. Image 2 (style-reference.png) is the locked art-style reference.

We are replacing the flat black fog of war in image 1 with a new
representation of the fog. Keep the camera, the isometric diamond grid, the
cleared ground, the Townhall, the trees, the rocky hill, the boars and the
berry bush where they are in image 1. Landscape 4:3.

The fiction: a magical fog swallowed the kingdom, and the player pushes it
back cell by cell. The fog is a bright, sunlit SEA OF CLOUDS that has settled
over the province, seen from above at midday. It is not darkness.

[the states, the chest, the wisps, the peak and the watchtower through the
cloud tops, the dotted reach line]

Style: match image 2. Bright, cheerful stylized 3D, soft midday sun,
saturated palette. The clouds are stylized, chunky, softly bevelled and
readable, like the rounded tree canopies: not photographic, not realistic
wispy smoke, not grey, not dark, not gloomy. No text, no UI, no labels, no
characters.
```

**The corrections that got it to the target**, each a follow-up in the same
conversation:

1. **Stylize the clouds** — two or three flat tones (cream top, lilac-blue
   mid, blue-violet shadow), a clean edge; **keep the grid readable**; **zoom
   in** so the island and its mist fill the frame and the bank is a frame.
2. **The mist is not glass** — each fogged cell holds a low, sculpted cushion
   of cloud, dipping between cells; **density is height**: tree crowns rise
   out of the first ring, only tree tips out of the second.
3. **Test it against play** — an irregular island made of whole cells, and a
   cell three taps out of five, its cushion torn open with wisps lifting off.
4. **Exactly three bands** following the outline cell by cell, and the dotted
   reach line back.
5. **Contrast the bands** — the first ring a thin see-through veil, the
   second an almost opaque cloud layer, a soft rounded step between them.

**What the image does not settle**, decided in
[`../../art-direction.md`](../../art-direction.md) §8.1: a sighted thing is a
flat pale shape, not the coloured drawing the mockup shows, and the seams of
the second ring come from one cushion a cell.
