# Trading with friends — the prompts (2026-10-06)

Three directions, one mockup each, to pick from
([`../../../proposals/friend-trading.md`](../../../proposals/friend-trading.md)).
Each is ONE landscape image holding three phone screens side by side — the
flow, step by step.

Attached to every prompt: `m74-refs/game-screens.png` (the shipped Friends
List and Inbox, and the Bag's Relics tab) and
`m74-refs/precious-materials.png` (Heartwood, Moonglass, Starmetal).

## Shared preamble

> GENERA UNA IMAGEN NUEVA. No edites ni exportes los archivos adjuntos: son
> SOLO referencia de estilo y de piezas.
>
> A UI mockup for a cozy medieval mobile city-builder. ONE landscape image,
> 1536×1024, holding THREE portrait phone screens side by side (each about
> 9:19.5, rounded corners, a thin dark gap between them), numbered 1, 2, 3 in
> small brass circles above them. Build every screen from the game's own
> pieces in the first attachment: the wooden window with a carved title and
> the round red close button, warm yellowed parchment inside, wood-plank
> wooden tabs, parchment cards with thin wood borders, painted round green ✓
> and red ✕ knobs, painted green and wood buttons, heraldic shields as
> player avatars (gold rim, coloured field, a gold charge). The precious
> materials are exactly the three icons in the second attachment: Heartwood
> (a glowing log), Moonglass (pale blue crystals), Starmetal (a silver
> star-ore). Relic fragments look like the small broken pieces under each
> relic in the Bag (first attachment, right). All text in English, short,
> legible, spelled exactly as given. Materials, lit from above: wood,
> parchment, brass, wax — no flat fills, no plastic gloss, no drop shadows
> outside the phones. Plain dark background behind the phones.

## M74 — A, the trade table (`m74-trade-table.png`)

> Screen 1 — "Trade" window. Top half, a parchment panel headed by a small
> red-lion shield and "Oakville (you)", subtitle "Choose what you give":
> four square slots in a row — Heartwood ×10, Moonglass ×10, Starmetal ×10,
> and a relic-fragment slot "Fragment ×1"; Starmetal is selected (the slot
> glows gold, raised). Between the halves, a wooden down-arrow labelled "You
> give" on the left and an up-arrow labelled "You get" on the right. Bottom
> half, a warmer parchment panel headed by a green-stag shield and
> "Foxhollow", subtitle "Choose what you get": the same four slots, the
> Fragment slot selected and now showing a green leaf fragment of the
> "Verdant Seal". A green button "Send".
>
> Screen 2 — "Your spare fragments" picker over the dimmed table: groups by
> relic with a wooden name ribbon ("Dowsing Rod", "Gilded Ledger"), each a
> row of fragment cards with a ×2 / ×3 count; two cards greyed with the
> words "They have it". A green "Choose" button.
>
> Screen 3 — the same Trade window after sending: one slot left in each half
> (Starmetal ×10 above, the Verdant Seal fragment below), and under them, in
> italics: "Trade offer sent. Waiting for Foxhollow…" with a small turning
> brass ring.

## M75 — B, the wish board (`m75-wish-board.png`)

> Screen 1 — the Friends window with three wooden tabs "List", "Trade",
> "Inbox"; Trade open (a red wax seal "2" on it). Section "Your wishes 2/3":
> two parchment cards, each "I need" + an item (a missing Dowsing Rod piece
> drawn as an empty dashed fragment outline; "Moonglass ×10") → an arrow →
> "I give" + an item (Starmetal ×10; a Gilded Ledger fragment), a small
> "45h left" ribbon; and an empty dashed card "+ Make a wish". Section
> "Friends need": cards with each friend's shield and name — Foxhollow needs
> a Verdant Seal fragment, gives Heartwood ×10, lit gold with a green "You
> have it" tag and a green "Fill" button; Elderglen needs Starmetal ×10,
> gives a Bailiff's Tally fragment, also with "Fill"; Briarwick needs a
> keystone, greyed "You don't have it".
>
> Screen 2 — "Make a wish" window: step "I need" — a grid of the player's
> missing fragments by relic (empty dashed outlines) and the three materials
> in lots of 10, one selected; step "I give" — the player's spares and
> materials, one selected; a note "Held until someone fills it, or for 48
> hours"; a green "Pin wish" button.
>
> Screen 3 — the moment of filling: a parchment pop-up "Wish filled!" with
> Foxhollow's shield, "You gave" the Verdant Seal fragment, "You got"
> Heartwood ×10 flying out of it with a few sparkles, and a green "Great"
> button.

## M76 — C, the caravan (`m76-caravan.png`)

> Screen 1 — "Caravan to Foxhollow" window: a painted wooden wagon across the
> top with two open wooden crates in it, labelled "Your crate" and "Their
> crate". Under the wagon, "Your crate": three slots — Starmetal ×15 with
> small − and + wooden steppers, a Dowsing Rod fragment, and an empty slot
> "+ Add". "I'd like": two hint slots showing Heartwood ×10 and a Verdant
> Seal fragment, faded. A wooden toggle "Gift" (off). A green "Send caravan"
> button.
>
> Screen 2 — the friend's side: the Inbox tab, a message card "Oakville sent
> you a caravan" opened into a panel: "They offer" (Starmetal ×15, Dowsing
> Rod fragment) and "Your answer" (two slots already filled with Heartwood
> ×10 and a Verdant Seal fragment, one empty "+ Add"); buttons "Send back"
> (wood) and "Answer" (green).
>
> Screen 3 — back to the player: "Foxhollow answered" — both crates side by
> side on the wagon, full, a balance mark between them; buttons "Cancel"
> (wood, returns both) and "Confirm trade" (green), "23h left" ribbon.

## Results

Three chats in three tabs in parallel, ~2 min each, all 1536×1024, all on
the first try; no fixes asked.

- **M74 — the trade table** (`m74-trade-table.png`): on brief — the two
  halves, the arrows, the spare-fragment picker with *They have it*, the sent
  state. Drift: the player's *Fragment ×1* slot is drawn as a grey stone with
  no label.
- **M75 — the wish board** (`m75-wish-board.png`): on brief — List / Trade /
  Inbox, *Your wishes 2/3*, *Friends need* with *Fill* and *You have it*, the
  *Make a wish* picker, *Wish filled!*. Drift: each of the player's own wishes
  carries ✕ / ✓ knobs, which the brief did not ask for (a ✕ to withdraw would
  do).
- **M76 — the caravan** (`m76-caravan.png`): on brief — the wagon with two
  crates, steppers, *I'd like*, the *Gift* toggle, the friend's answer in the
  Inbox, *Confirm trade* / *Cancel* with *23h left*. Drift: none worth fixing.

None of the three draws phone bezels: each screen is the game's wooden
window on its own, which reads fine.

## M77 — B iterated (`m77-wish-board.png`)

Direction B chosen. Attached: `m75-wish-board.png` (the pass to iterate),
plus the two refs. The same three screens, with the rules settled
(`proposals/friend-trading.md`):

> GENERA UNA IMAGEN NUEVA. The first attachment is the previous version of
> this mockup: keep its layout, style, pieces and the three-screen
> landscape format (1536×1024, three screens numbered 1, 2, 3); the other
> two are the same style references as before. Change only this:
>
> - Every material lot is ×5, never ×10.
> - Screen 1: on each of "Your wishes", remove the green ✓ knob — keep only
>   one red ✕ knob (withdraw) under the "45h left" ribbon. The section head
>   "FRIENDS NEED" gets "Fills 3/5" at its right end. The "Trade" tab keeps
>   its red wax seal "2".
> - Screen 2 "Make a wish", step 1 "I need": instead of loose silhouettes,
>   show each relic as a small row: its name on a tiny wooden ribbon
>   ("Dowsing Rod", "Verdant Seal") and its SIX fragment slots in a row —
>   held fragments drawn small and faded (not pickable), missing ones as
>   empty dashed outlines (pickable); one missing slot of the Verdant Seal
>   selected with a gold glow. The sixth slot of each row is the keystone,
>   drawn a little larger with a gold rim. Under the relic rows, the three
>   materials ×5 as cards. Step 2 "I give": the player's spare fragments
>   with ×2/×3 counts and the materials ×5; the two keystones greyed with a
>   small padlock (a keystone only trades for a keystone); one Starmetal ×5
>   selected. Keep the note "Held until a friend fills it, or for 48 hours"
>   and the green "Pin wish" button.
> - Screen 3 "Wish filled!": "You got" shows Heartwood ×5.
>
> All text in English, spelled exactly as given. Raw image only — do not
> resize, verify or save a corrected file.

Result: one fix in the same chat — the first pass added a stray empty "Keystone" row under the relic rows in screen 2; asked to remove it and move the materials up, everything else kept. Small remaining drift: Elderglen's Starmetal tile in screen 1 shows its ×5 twice (on the icon and under the name).

## M78 — the wish made in two steps (`m78-wish-steps.png`)

The user's notes on M77: what you need and what you give are two windows,
not one; and one relic a row, not two columns. Attached: `m77-wish-board.png`
(the pass to iterate), then the two refs.

> GENERA UNA IMAGEN NUEVA. The first attachment is the previous version of
> this mockup: keep its style, its pieces and the three-screen landscape
> format (1536×1024, three screens numbered 1, 2, 3). The other two are the
> same style references as before.
>
> Screen 1 — keep screen 1 of the previous version exactly ("Friends", tabs
> List / Trade / Inbox, "YOUR WISHES 2/3", "+ Make a wish", "FRIENDS NEED"
> with "Fills 3/5"), with one fix: on Elderglen's card the Starmetal tile
> shows "×5" once only, under the word "Starmetal".
>
> Screen 2 — a window titled "What do you need?", under the title a small
> "Step 1 of 2". A list of relics, ONE RELIC PER ROW, each row full width: a
> parchment card with the relic's small picture at the left (Dowsing Rod,
> Gilded Ledger, Foreman's Sigil, Verdant Seal, Bailiff's Tally — the
> relics of the first attachment's Bag reference), its name above, and its
> SIX fragment slots across the rest of the row, big and easy to tap: held
> fragments drawn faded, missing ones as empty dashed outlines; the sixth
> slot is the keystone, a little larger with a gold rim. On the Verdant Seal
> row, one missing slot glows gold (picked). Under the relic rows, a section
> "Materials" with three cards: Heartwood ×5, Moonglass ×5, Starmetal ×5.
>
> Screen 3 — a window titled "What will you give?", "Step 2 of 2". At the
> top a small parchment strip "You need:" with the Verdant Seal piece and a
> small wooden "Change" button. Under it a grid "Your duplicates":
> Dowsing Rod piece ×3, Gilded Ledger piece ×2, Bailiff's Tally piece ×2,
> Verdant Seal piece ×4 — selectable; Foreman's Sigil piece ×1 greyed with
> the words "Only 1"; two keystones greyed with a small padlock and
> "Keystone only". Then "Materials": Heartwood ×5, Moonglass ×5,
> Starmetal ×5, Starmetal selected with a gold glow. At the bottom the note
> "Held until a friend fills it, or for 48 hours" and a green "Pin wish"
> button.
>
> All text in English, spelled exactly as given. Raw image only — do not
> resize, verify or save a corrected file.

Result: first try, no fix asked. One relic a row with six big slots, the
two steps on screens 2 and 3, Foreman's Sigil ×1 greyed "Only 1", both
keystones locked "Keystone only", Elderglen's "×5" shown once. Drift: every
row's keystone slot is drawn filled (held), so no row shows a missing
keystone; and two empty dashed cells pad the duplicates grid.
