# The Shrine's chapel — ChatGPT prompt (2026-10-06)

The relic slot of a Shrine's card, as a full painting of the chapel's interior in the lair
cards' format (16:9 opaque, `Docs/art/originals/lairs/LOG.md`):
`src/ui/assets/shrine-interior-empty.jpg` (the altar's cradle carved with a glowing +) and
`shrine-interior.jpg` (the cradle empty, for the relic to be set in). It replaces the altar
icon (`../altar/`), which read as an icon rather than an illustration.

Attached: `ref-lair-paintings.jpg` (two lair paintings — the style to match),
`ref-shrine.png` (the Shrine, the old altar, a relic), and the user's four altar pictures for
the idea only (kept out of the repo: one carries a copyright mark).

Turn 1 — the interior seen from the doorway: cream marble columns and arches, gold trims,
blue tiles and banners, ivy and white flowers, rows of lit candles, light from a round window;
dead centre, the altar on two steps with a gold sunburst and a round golden cradle, empty and
glowing, a little above the middle; the bottom fifth calm. → `interior-raw.png` (1672×941).

Turn 2 — "exactly the same image … ONE change: a big gold + engraved in the cradle". RMSE
against turn 1: 0.049, only the +. → `interior-plus-raw.png`.

Both: `-resize 960x540^ -gravity center -extent 960x540 -quality 88`. The cradle's centre is
(50%, 36%) and a relic 15% of the width fills it — `.dc-chapel-relic`.
