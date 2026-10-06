# Store background prompt

ChatGPT, 2026-10-06. Attached as style references: `Docs/art/ui/mockups/m96-store-heroes.png`, `Docs/art/ui/mockups/m86b-offer-first-purchase.png`, `src/render/assets/offer_novice_art.png`.

GENERATE A NEW IMAGE — the attachments are only style references, do not edit or export them. Match their flat cartoon game-art style: bold dark-brown outlines, warm natural materials (wood, brass, parchment, cloth), lit from above.

Make an OPAQUE full-bleed PORTRAIT background, aspect ratio 9:19.5 (a phone screen), for a fantasy game's STORE menu: the warm interior of a magical merchant's emporium, seen straight on. Wooden shelves of glowing potion bottles, open treasure chests with gold coins and purple gems, rolled scrolls, hanging cloth banners, brass lanterns and candles, a big arched window letting in golden light, maybe a crystal ball on a counter. Warm amber and golden palette, soft light, cosy.

Composition: this will sit BEHIND the store's panels, blurred and dimmed, so keep LOW detail and a calm, simple, softly lit wall/floor in the middle band and centre; put the interest (shelves, chests, banners, lanterns, window) at the edges, top and bottom corners.

NO characters, NO people, NO text, NO letters, NO UI, NO frame, NO border, NO transparency. Raw image only — do not resize, verify or save a corrected file.

## Local processing

`magick store-bg-raw.png -resize 900x -blur 0x6 -modulate 85,90 -brightness-contrast -6x-12 -quality 82 src/ui/assets/store-bg.jpg`
