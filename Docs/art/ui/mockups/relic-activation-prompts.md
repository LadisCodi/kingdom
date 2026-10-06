# Relic activation — the prompts (2026-10-06)

Mockups of the flow shipped in PR #182 (`Docs/features/09-relics.md` §2.1): a
city relic hosted in a 1×1 Shrine sleeps until the player pays 20 Mana; the
relic's level is its power and reach, the Shrine's level its window
(5 min · 30 min · 1 h · 4 h · 8 h). Taken as the base on 2026-10-06 and built;
the priced buttons keep the kit's price-over-slab layout rather than M80's
inline chip.

Attached to every prompt (`m80-refs/`):

- `ref-game-screens.png` — the game today (map, Bag, Settings) at 390×844.
- `ref-ui-kit.png` — the shipped UI pieces, labelled.
- `ref-relics.png` — the eight relics, the Shrine and its ruin, the Mana,
  fragment, hourglass, Shrine, compass and Mana-flask icons, labelled.

The example in every screen: **The Tribute Crown, level 3** — tax rate +30%
(→ +40% at level 4), aura 2 cells round the Shrine (25 cells); in **Shrine #1,
level 3** — awake for 1 h (→ 4 h at level 4); the player has **64 Mana**.

## Shared block

GENERA UNA IMAGEN NUEVA. No edites ni exportes los archivos adjuntos: son SOLO referencias de estilo.

This is a mockup for a cozy medieval city-builder for phones. Build it from the game's own pieces in the attached references — the coin plank at the top, the wooden window with the red close knob, parchment panels, painted wood/green/gold/purple buttons, wax seals, rope — so it looks like the same game as ref-game-screens. Warm natural materials lit from above: wood, yellowed parchment, brass, wax, cloth; no flat fills, no plastic gloss. Use the relic, Shrine and icon art from ref-relics exactly as drawn there; do not redesign them. Mana is the blue-violet swirl orb; Gems are purple crystals — never swap them. All text in English, short and legible, spelled exactly as written here. Portrait phone screens at 390×844 proportions, no device bezel, no hands, no captions outside the screens.

[the screen]

## M80 — the Bag's Relics tab (`m80-bag-relics.png`, one screen)

One phone screen. The city map dimmed behind; the coin plank at the top (Gold 12,400 · Food 860 · Wood 3,120 · Stone 940 · Mana 64 · Gems 500). The Bag window with its tabs (Resources, Speed ups, Boosts, Relics — selected —, Other). Under the tabs a slim row: the Shrine icon, "Shrines 2 / 5", and a small purple button "Build a Shrine" with 1,500 Gems. A thin section head "CITY", then a 2-column grid of relic cards, each a parchment card with the relic's art, a blue wax level seal and its name on a ribbon, and one status line that shows its state:
- The Tribute Crown, Lv 3 — AWAKE: the card's frame glows warm gold, soft light rays behind the crown, a gold pill "Awake · 52m" with an hourglass.
- The Winged Hammer, Lv 2 — ASLEEP in its Shrine: art slightly dimmed, a grey pill "Asleep" and a small green chip "Activate" with Mana 20.
- Staff of Renewal, Lv 1 — restored but NOT HOSTED: muted pill "In the Bag".
- Sickle of Plenty — NOT RESTORED: the art as a dark silhouette, six small fragment slots under it with four filled, "4 / 6".
A second section head "WORLD": The Stargazer's Orb, Lv 1, pill "In a Chapel"; The Wisp Lantern as a silhouette, "2 / 6". The bottom nav bar is hidden (a menu is open).

## M81 — one relic, three states (`m81-relic-sheet.png`, three screens side by side)

Three phone screens side by side, each the relic's sheet for The Tribute Crown, over the dimmed map. Common to all three: the wooden window titled "The Tribute Crown" with the red close knob; the crown's art large on parchment with a blue wax seal "Lv 3" on its corner; a row of six fragment slots (five pieces and a larger keystone), all filled; a centred band of two small stat tiles — "Tax rate +30% → +40%" and "Aura 25 cells"; a gold "Level up" button with "6 spares". Then a section "SHRINE" that differs:
1. NOT HOSTED — a muted line "Not hosted — host it in a Shrine, then activate it", and two rows, each a Shrine with a wood "Host" button: "Shrine #1 · empty" and "Shrine #2 · holds The Winged Hammer".
2. HOSTED, ASLEEP — "Hosted in Shrine #1 · Lv 3", a grey wax seal "Asleep", a big green "Activate" button carrying a Mana orb and 20, and under it the small line "Awake for 1h · 25 cells round its Shrine". A small wood "Remove" button.
3. AWAKE — the crown's art glows with warm rays and sparkles, a gold ribbon "AWAKE" across the art's top; instead of the button a brass-framed bar draining from full, an hourglass and "52m left"; a small muted line "Taking it out ends the window".

## M82 — the Shrine's card on the map (`m82-shrine-card.png`, three screens side by side)

Three phone screens side by side. Each shows the city map with the Shrine (the 1×1 building from ref-relics) selected in the middle, and the district card docked at the bottom over the map: a wooden card titled "Shrine #1" with "Level 3", three stat tiles (Harmony 40 · Awake for 1h · Mana +10) and a gold "Upgrade" button. The card's "RELIC" section differs, and so does the map:
1. EMPTY — "Empty — host a city relic, then activate it", and a short list of restored relics, each a small art thumbnail, its name and level and a wood "Host" button (Staff of Renewal Lv 1, The Tribute Crown Lv 3). On the map, a dashed gold outline of a 5×5 cell area centred on the Shrine.
2. HOLDING, ASLEEP — the crown's thumbnail dimmed on a stone plinth, "The Tribute Crown · Lv 3 · tax +30%", a grey "Asleep" seal and a big green "Activate" button with Mana 20; small line "Awake for 1h". On the map the 5×5 area is outlined in pale gold, untinted, and the crown rests dim on the Shrine's altar.
3. AWAKE — the thumbnail glowing, "Awake — 52m left" with a draining gold bar. On the map the 5×5 area is tinted violet with a glowing border around its outside, small motes of light drifting up from every cell, the crown floating and glowing above the Shrine, and a round countdown wheel with a tiny crown on it above the Shrine.

## M83 — the window and the price (`m83-window-and-mana.png`, two screens side by side)

Two phone screens side by side.
1. THE SHRINE'S UPGRADE POPUP over the dimmed map: a parchment popup titled "Shrine #1 · Level 3 → 4" with the Shrine's art; stat tiles with arrows — "Awake for 1h → 4h" highlighted green, "Harmony 40 → 40", "Mana +10 → +10"; the cost row (Gold 150,000 · Stone 15,000 · Cut stone 20 · Runestone 2); a green "Upgrade" button with "2h 30m" on it.
2. NOT ENOUGH MANA: the relic sheet for The Tribute Crown over the dimmed map — a wooden window titled "The Tribute Crown" with the red close knob, the crown's art large on parchment with a blue wax seal "Lv 3", stat tiles "Tax rate +30% → +40%" and "Aura 25 cells", and a section "SHRINE": "Hosted in Shrine #1 · Lv 3", a grey wax seal "Asleep" and a big green "Activate" button. The header's Mana counter reads 12 and glows red; the Activate button's Mana price "20" is red on a clay patch; under it a line "Mana refills 12 an hour · 20 in 40m" and a small purple-blue button "Use a Mana flask" with the flask icon and "×2".

## M84 — awake and asleep in the world (`m84-world-awake.png`, one screen)

One phone screen of gameplay: the isometric city map from ref-game-screens with the coin plank at the top and the nav bar at the bottom (Store, Bag, Research…). Two Shrines (the 1×1 building from ref-relics) stand among houses:
- On the left, AWAKE: The Tribute Crown floats and glows above the Shrine; a 5×5 cell area round it is tinted soft violet with a glowing border traced around its outside edge and small motes of light drifting up; three houses inside it each show a tiny gold coin badge "+30%"; above the Shrine a round countdown wheel with a tiny crown, "52m".
- On the right, ASLEEP: the Shrine with The Winged Hammer resting dim on its altar, no tint, and a small speech-bubble over it holding a Mana orb and "20" — a prompt to tap and activate.

## M85 — waking and falling asleep (`m85-wake-and-sleep.png`, two screens side by side)

Two phone screens side by side on the same city map.
1. THE MOMENT OF ACTIVATION: a burst of warm light from the Shrine, a bright ring sweeping out over the 5×5 area as its violet tint fills in, the crown rising above the altar, and a floating text "+30% tax · 1h" over the Shrine; the header's Mana reads 44 with a small "−20" falling from it.
2. THE WINDOW HAS CLOSED: the area is untinted again, the crown rests dim on the altar, and on the right edge of the screen a small wooden pill with the crown's art: "The Tribute Crown is asleep" and a green chip "Activate" with Mana 20.

## Closing line (every prompt)

Raw image only — do not resize, verify or save a corrected file.
