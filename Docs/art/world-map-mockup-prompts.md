# World map mockup prompts (ChatGPT / GPT-4o images)

Prompts for mocking up the shared world map described in
[`../features/02-map-scopes.md`](../features/02-map-scopes.md) §3.4–§5.

**Updated 2026-09-04** against two rounds of real renders. Prompt 1 now asks for
what actually worked — **three hexagons across, not four** — and both prompts
carry the finding that changed the design: **the hex is a unit of measure, so
most of the map is empty and places are sparse.**

The style anchor is the same `reference.png` the v2 sprite set used, so that the
world map reads as the same game as the province. See **OQ-66** in
[`../open-questions.md`](../open-questions.md) — the renders drifted darker and
glossier than the reference, and whether that is a bug or a deliberate tonal
contrast is not yet decided.

## What the first two rounds settled

Recorded here so the next generation starts from evidence:

| | Round 1 (4 across) | Round 2 (3 across) |
|---|---|---|
| Hex width on a 390 pt phone | ~97 pt | **~130 pt** |
| A hex reads as | a tile with props on it | **a place you would go** |
| Content elements legible | 2 | **3–4** |
| Content icon size | ~22 pt | ~25–40 pt |

**Both rounds put content icons under the 44 pt tap minimum**, which settled a
design question rather than an art one: icons are **read**, the hexagon is
**tapped**, and actions live in a dispatch sheet (prompt 3).

Round 1 also produced **three fog states** rather than the two asked for —
revealed, half-veiled with silhouettes showing through, and opaque — which is
better than the spec and is now the spec
([`02-map-scopes.md`](../features/02-map-scopes.md) §4.4).

## Workflow — the same one that worked for the v2 sprites

Carried over from [`sprite-prompts.md`](sprite-prompts.md), because the same
traps apply:

1. **One conversation, with `reference.png` attached to the first message.** The
   image is a far stronger consistency anchor than any wording.
2. **Fix prompt 1 before running prompt 2**, then add *"same style, same palette
   and same hexagon geometry as the previous image"*.
3. **Forbid isometric explicitly, every time.** The v2 notes record that fields
   came out isometric unless the prompt said *"no rotation, no diamond shape, no
   3D thickness"*. Hex maps are worse: image models default to isometric hex
   tiles with 3D sides and drop shadows, which is exactly the wrong read — this
   is a flat top-down campaign map, not a diorama.
4. **Expect garbled text.** Asking for "no readable text" gives a cleaner mockup
   than asking for labels. Round 1 rendered currency counts as `•••`
   placeholders, which worked well.
5. Image models fake pixel art at high resolution. Fine for a mockup; downscale
   nearest-neighbour if a crisp version is wanted
   (`magick in.png -filter point -resize ... out.png`).
6. For the **place composition library** (`02-map-scopes.md` §3.4 — ~15–20
   reusable compositions), generate in **2×2 sheets, four compositions per
   image**, which is what gave the v2 sprite set its style and scale consistency.

## Shared style block

Paste this at the start of every prompt, with `reference.png` attached:

> Pixel-art mobile game screenshot, portrait orientation (9:19.5), matching the
> attached reference image's art style exactly: bright cheerful saturated
> palette, spring greens, cream-walled cottages with terracotta roofs, soft
> rounded blob tree canopies built from clustered leaves, mossy white-grey
> rocks, tan dirt paths. Chunky readable pixels. **Strictly flat top-down view —
> NO isometric projection, NO 3D tile thickness or sides, NO diamond-shaped
> tiles, no bevels, no drop shadows beneath the tiles.** No readable text
> anywhere.

---

## Prompt 1 — Tactical register: a place, and a reveal

> [shared style block]
>
> The screen shows a **hexagonal world map**, pointy-top hexagons (a vertex at
> top and bottom, flat edges left and right) tiled in a honeycomb. The hexagons
> are **large: about three of them span the screen width.**
>
> **Most hexagons hold nothing but terrain** — forest, grassland, rocky ground —
> because the empty ground is the distance a traveller pays to cross. Only a few
> hexagons are **places**, and each place is a small composed scene with three or
> four distinguishable elements:
>
> - a river valley with a stone bridge crossing the water, a ruined stone arch,
>   and a small field
> - a circle of standing stones around a glowing blue rune
> - a rocky hollow with a cave mouth in the hillside
> - a camp of two hide tents around a campfire, with crossed swords planted
>   beside it
> - a wooden chest half hidden among boulders
>
> In the **lower left**, one hexagon is the player's home province: a small
> walled town of terracotta-roofed cottages with a blue banner, a field and a
> windmill. It is the most detailed thing on screen.
>
> **Thin bright blue outlines** trace the hexagon edges of the player's claimed
> hexes around the home. **Thin red outlines** trace a rival's claimed hexes in
> the upper right. Outlines only — the terrain stays visible through them.
>
> In the **middle of the screen a ring of seven hexagons has just been revealed**
> — one centre hexagon plus its six neighbours — rendered brighter and crisper
> than everything else, outlined in pale lime, with faint dust motes in the air.
> A **tiny pixel scout figure** in a green travelling cloak with a walking staff
> stands in the centre hexagon.
>
> The rest of the map uses **three levels of fog**: hexagons at the frontier are
> dimmed and half-veiled, with faint silhouettes of what they hold showing
> through the haze; beyond them, thick rolling dark blue-grey mist hides whole
> hexagons completely.
>
> Minimal UI chrome: a slim top bar with three small pixel currency icons, and a
> slim bottom bar with four square pixel navigation buttons.

**What this image is for:** confirming that a place reads as a place at ~130 pt,
that three or four elements fit without crowding, and that sparse placement
still feels like a world rather than an empty field.

---

## Prompt 2 — Strategic register: measuring distance

This is the register where the lattice does its job, so the image has to show
**distance being counted**, not just territory being coloured.

> [shared style block]
>
> Same hexagonal world map as the previous image, same palette and same
> pointy-top hexagon geometry, but **zoomed out: about eight or nine hexagons
> span the screen width**, so each one is small.
>
> At this zoom the hexagons show **no contents and no scene detail** — only
> terrain colour and ownership. Terrain reads as flat colour fields: spring
> greens for grassland, darker green for forest, tan for dry ground, grey for
> highland, blue for water.
>
> **A dotted route is drawn across the map**, hexagon centre to hexagon centre,
> from the player's home hexagon in the lower left to a distant marked hexagon
> in the upper right. The route steps through **five hexagons**, and a small pale
> pip sits on each step of it. A tiny pixel scout figure stands at the start of
> the route.
>
> **Claimed territory is filled with translucent colour**: a cluster of blue
> around the home in the lower left, a cluster of red in the upper right, a
> smaller cluster of yellow on the right edge. Where two colours meet the shared
> border is drawn thicker. Unclaimed but explored hexagons show plain terrain
> with no fill.
>
> The player's home hexagon in the blue cluster carries a small walled town and
> a blue banner, slightly more detailed than anything else on screen.
>
> **More than half the map is covered by rolling dark blue-grey mist**, forming
> one large irregular unexplored field wrapping around the explored region, with
> a ragged edge that follows hexagon boundaries. A band of half-veiled hexagons
> sits between the explored ground and the deep mist.
>
> Three or four tiny icons appear on major landmarks: small glowing shrine
> markers.
>
> Same minimal UI chrome as before.

**What this image is for:** checking that the player can count hexes and read
"five hexes away, so five times the travel time" at a glance — and that
ownership and frontiers still resolve with no scene detail drawn.

---

## Prompt 3 — The dispatch sheet

Now dimensioned against the settled tactical size rather than in the abstract:
the hexagons behind it are ~130 pt, so roughly two and a half fit across the
visible strip above the sheet.

> [shared style block]
>
> The same hexagonal world map at tactical zoom — **about three hexagons across
> the screen width** — dimmed behind a **bottom sheet panel** that covers the
> lower 55% of the screen. The sheet is a pixel-art panel with a rounded
> stone-and-wood frame.
>
> The sheet shows one place. At the top, a small pixel illustration of a river
> valley with a stone bridge and a ruined arch. Below it, a **vertical list of
> three rows**, each row a small pixel icon on the left with an empty flat plate
> beside it where a label would go: a ruined arch, crossed swords, a chest. Each
> row has a small square button at its right end.
>
> At the bottom of the sheet, two large pixel buttons side by side — the left one
> bright blue with a small scout figure on it, the right one plain wood with a
> banner on it. No readable text anywhere; leave flat empty plates where labels
> belong.
>
> Above the sheet, the top of the screen still shows two or three large hexagons
> with their scenes, the pale lime outline of a revealed ring, and mist at the
> edge. The slim top bar with three currency icons is still visible.

**What this image is for:** proving that a place's contents can be listed and
acted on from a sheet, so a hexagon never needs a screen of its own —
`02-map-scopes.md` §3.5, and the reason icons on the map can stay read-only.
