# World ranking — the prompts (2026-10-07)

Mockups m100 (the widget on the world board) and m101 (the ranking menu).
The ranking lists the kingdoms of one world map ordered by the hexes each
holds. It pays nothing; it is there to compare.

Two ChatGPT chats in parallel tabs, both right on the first try
(852×1846).

Attached to both messages (`m100-refs/`):

1. `ref-world-board.jpg` — m64, the world board with its HUD.
2. `ref-widget.jpg` — m63, the Survey widget: the shape a left-column widget takes.
3. `ref-friends.jpg` — m73, the friends list: rank ribbons, shields, Townhall pills.
4. `ref-world-menu.jpg` — m89, a world menu: window, title plank, stat tiles.

## The shared block (first in both prompts)

> GENERA UNA IMAGEN NUEVA. The attached images are ONLY references: do not
> edit or export any of them.
>
> Mobile game UI mockup, one portrait phone screen, 1080×2340, no bezel, no
> watermark, no phone frame. A cozy fantasy kingdom builder. Build ONLY from
> the game's own pieces in the references: the slim wooden resource plank at
> the top, the carved wooden window frame around aged parchment, the wooden
> title plank with cream lettering and the round red close knob carved with
> an X, the gold / silver / bronze / plain-wood rank ribbons and the heraldic
> shields of the third reference, the coloured Townhall pills, painted slab
> buttons with a darker bottom lip. Clean rounded sans-serif text, dark brown
> ink, every word in English. No emoji. It must look like it belongs to the
> same game as the references.

## M100 — the widget (`m100-world-ranking-widget.png`)

> [block] The screen is the world board of the first reference, exactly as
> it is: the plank at the top, the spyglass plaque "3/3" at the top left,
> the hexes, the clouds, the round castle button at the bottom right and the
> wooden nav bar. ADD one new widget in the left column, directly under the
> spyglass plaque, built exactly like the Survey widget of the second
> reference (a wooden frame around a warm parchment plate, a round brass
> medallion at its left): the medallion holds a golden laurel wreath around
> a small hex. Beside it the word "Ranking" and, under it, a gold rank
> ribbon-badge "#11" and the text "14 hexes" with a tiny hex icon. Same size
> as the Survey widget, no progress bar, no red dot. Everything else on the
> board is unchanged.

## M101 — the menu (`m101-world-ranking.png`)

> [block] The world board of the first reference fills the background,
> slightly dimmed; the plank at the top. Over it, a tall menu window like the
> friends list of the third reference. Title plank "Ranking" with the red
> close knob. Under it, a centred line "Greenvale · 18 kingdoms" with a small
> globe icon, and a two-segment wooden toggle "World" (pressed) | "Friends".
> A small header row in brown capitals: "KINGDOM" at the left, "HEXES" at the
> right, between thin lines. Then the list, eight rows like the friends list:
> a rank ribbon (1 gold, 2 silver, 3 bronze, 4 onward plain wood with the
> number carved in), a heraldic shield, the kingdom's name with a Townhall
> pill under it, and at the right a big number of hexes with a small hex
> icon. Rows: 1 "Queen Iselde V" Townhall 12, 41 hexes; 2 "Lord Bram"
> Townhall 11, 37; 3 "Mirelle" Townhall 10, 30; 4 "Rowan" Townhall 9, 26,
> with a tiny handshake icon after the name (a friend); 5 "Tobin"
> Townhall 9, 22; 6 "Elderglen" Townhall 8, 19; 7 "Foxhollow" Townhall 8,
> 17; 8 "Sir Aldric" Townhall 7, 16. The list looks scrollable (the eighth
> row is cut by the scroll area's lower edge). Pinned at the foot of the
> window, outside the scroll, the player's own row on warm gold parchment
> with a thin gold border: a plain wood ribbon "11", a red shield with a
> crown, "You" with a Townhall 8 pill, "14" hexes at the right, and under
> the name one small line "2 hexes behind #10". No rewards, no chests, no
> prizes anywhere on the screen.

## The pieces (`../ranking/sheet.png`)

Attached: `../ranking/ref-style.jpg` (the Survey compass, five atlas icons
and the gold rank ribbon) and `../ranking/ref-widget-mockup.png` (m100's
widget). A 2×1 sheet, true alpha first try:

- left, the Survey compass's brass medallion with a laurel wreath round a
  grass hex → `src/ui/assets/ranking-medal.png` (256×256);
- right, the grass hex alone → `../sheets/ui-r1-hex.png` → the atlas's `hex`.
