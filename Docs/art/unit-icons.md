# Unit icons

> The round portrait every unit wears in the UI — the training panel, the
> batch, squads, the ward. **Status:** Warrior, Lancer, Archer, Cavalry and
> Villager drawn to this style (`src/render/assets/unit_<unit>_avatar.png`).

## 1. What an icon is

- A **bust** — head and shoulders — seen straight on, a touch of 3/4.
- Inside a **round medallion**: a warm gold ring and a light paper disc.
- The UI draws its own base and mask over it (`unitPortrait`, kit): the bust
  is drawn a little larger than the mask, so the painted ring is trimmed
  away in the game. The medallion is still drawn, so a set reads as one.
- One thing that says **what the unit is** beside the face: the Lancer's
  spear, the Archer's quiver, the Cavalry's horse, the Villager's straw hat.

## 2. The style block (paste into every unit-icon prompt)

> Flat 2D illustration for a mobile strategy game UI, NOT 3D, NOT Pixar,
> NOT a render. A character bust — head and shoulders — facing the viewer,
> slightly turned, inside a round medallion: a warm gold ring with a thin
> dark brown outline, and a light warm paper disc behind the figure.
> Bold, clean dark-brown outlines on every shape, uniform in weight.
> Flat colour with simple cel shading: one shadow tone and one small
> highlight per material, no gradients, no textures, no ambient occlusion,
> no subsurface glow. Big simple readable shapes, friendly and slightly
> chunky proportions, a calm expression with small simple eyes. Warm
> saturated palette: blues, greens and earthy browns for cloth, steel grey
> for metal, gold accents. Lit from the top left. The figure fills about
> 80% of the disc, the shoulders cut by the ring at the bottom. One prop
> that says what the unit is sits beside the head, inside the ring.
> No text, no background outside the medallion, no drop shadow.

## 3. Per unit

| Unit | Face and dress | Its prop |
|---|---|---|
| Warrior | bearded man, round steel helmet with nasal, blue tunic | round shield edge at the shoulder |
| Lancer | bearded man, steel helmet, green tunic, mail | a spear tip rising behind the shoulder |
| Archer | young woman, green hood | feathered arrows in a quiver behind the shoulder |
| Cavalry | young knight, visored steel helmet raised, blue and gold surcoat | the horse's head in a steel chamfron beside him |
| Villager | young man in a straw hat, cream shirt, brown vest, blue neckerchief | a hoe over his shoulder |

## 4. Generation notes

- The source sheet of the Villager and Cavalry is
  `Docs/art/originals/unit-icons-villager-cavalry.png`.
- Attach the existing icons as the anchor and say they are the style to
  match; ask for the new ones side by side on one canvas with clear
  transparent gaps.
- End with the true-alpha request (Docs/art memory: "background alpha 0,
  then apply the true-alpha transparency correction").
- Cut each to a square around its ring, 256 px (the existing icons' size).

## Deliberately not in this design

- No full-body figure here: the whole figure is a different asset
  (`unit_<unit>.png`), for the map.
- No rank or level marks on the icon — levels are the UI's to show.
