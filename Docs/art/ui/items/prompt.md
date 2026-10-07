# UI-I1 — the Bag's items (Docs/plans/relics-and-bag.md)

One 4×4 sheet for the atlas (`Docs/art/ui/atlas.manifest.json`), sliced by
`npm run art` into 64 px cells like UI-A2…E2. Attach `ref-atlas.png` (a
montage of icons already in the atlas, which these sit beside).

## Prompt

GENERATE A NEW IMAGE. Do not edit or export the attached file: it is ONLY the style reference — sixteen icons already in this game's atlas. Your icons will sit right next to them; match their style exactly: the same chunky cartoon shapes, the same dark-brown outline, the same saturated colours with one soft shade and one highlight, the same gold trims, the same front three-quarter view.

A square sheet of 16 game icons on a strict 4×4 grid, one object per cell, centred, each filling about 80% of its cell, generous empty margins; nothing may cross a cell boundary — keep a clear 40 px band between cells. Draw as if each icon is shown 64 px wide: big simple readable shapes, nothing thinner than the outline. No text or numbers on any icon.

Row 1:
1. a brown leather SATCHEL (adventurer's bag) with a buckled flap and a shoulder strap, slightly bulging;
2. a small wooden treasure chest, lid open, overflowing with GOLD COINS (like the atlas gold coin);
3. the same chest, lid open, overflowing with RED APPLES and a loaf (food);
4. the same chest, lid open, piled with WOODEN LOGS (like the atlas logs).

Row 2:
5. the same chest, lid open, piled with GREY STONE BLOCKS (like the atlas stone);
6. the same chest, closed, with a big golden QUESTION MARK on its front — a chest whose contents you choose;
7. a brass HOURGLASS with small golden WINGS on its sides and blue sand — a speed-up;
8. a dark iron blacksmith's ANVIL;

Row 3:
9. a brown leather travelling BOOT;
10. a fat cloth COIN PURSE with gold coins spilling and a green up-arrow behind it — more rent;
11. a SICKLE crossed with a bundle of golden wheat and a green up-arrow behind it — more harvest;
12. a violet MANA CRYSTAL (like the atlas mana orb's colours) with a green up-arrow behind it — faster mana;

Row 4:
13. a round glass FLASK with a cork, full of glowing violet-blue mana liquid;
14. a thick closed blue leather TOME with brass corners and a glowing gold rune — knowledge;
15. a rolled parchment TREASURE MAP, half open, with a dotted path and a red X;
16. a single jagged ancient STONE SHARD, pale teal stone with a faint gold engraved line — a fragment of a broken relic.

Do not draw grid lines, cell borders, labels, captions, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

## Names (manifest order)

bag, chestGold, chestFood, chestWood, chestStone, choiceChest, speedup,
anvil, boot, boostRent, boostHarvest, boostMana, flask, tome,
dowserMap, shard
