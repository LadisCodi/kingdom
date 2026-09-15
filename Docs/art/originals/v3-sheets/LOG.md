# v3 sheets — generation log

Provenance for the builder-programme art
([`../../builder-30-days-art.md`](../../builder-30-days-art.md)). One row a
file: the sheet it came out of, the quadrant, and the exact `norm_sq.fish`
call, so any single asset can be regenerated without guessing.

- **Conversation:** <https://chatgpt.com/c/WEB:0038fafb-b11e-476c-abfa-b08185808670> ("SPR-E…SPR-Q", Codigames workspace, GPT-5.6 Sol Alta, 2026-09-04). First message carried `reference.png` **and** a montage of the shipped v2 sprites (`existing_sprites.png`) as a second anchor — the montage is what keeps the new tiles at the same chunk and scale as what ships.
- **Style anchor:** `Docs/art/reference.png`, attached to the first message.
- **Verification, every sheet:**
  `magick sheet.png -format "%[pixel:p{0,0}]" info:` → `srgba(0,0,0,0)` and
  `magick sheet.png -alpha extract -format "%[fx:mean]" info:` → below 0.5.

| Sheet | Quad | File | Command |
|---|---|---|---|

## Session notes (2026-09-04)

- **A montage of the shipped sprites is a better anchor than `reference.png`
  alone.** `reference.png` is a *map mockup*; the assets are trimmed,
  normalized tiles. Attaching both — the mockup for palette and world scale,
  `existing_sprites.png` (a `magick montage` of townhall/housing/farm/sawmill/
  quarry/market on flat green) for chunk and trim — is what the later sheets
  are told to match.
- **Round one came back in 3/4 isometric prop style**, exactly the v1 mistake
  `sprite-prompts.md` warns about: 45° camera, wood grain, individual stones,
  muted browns and greys. The style block alone does not carry it. What the
  correction had to say, explicitly, was: *80° camera so the TOP face of
  everything is what you see*, *two or three flat tones and one outline, no
  feature under 4 pixels*, *draw as if it will be shown 128 px wide*, and
  *push saturation back to the montage*. Iterate this on sheet 1 and only
  sheet 1 — every later sheet inherits it.
- **Budget about five minutes a sheet.** The image takes ~2 min; the
  true-alpha correction is a code-interpreter loop that takes another ~3 and
  ends with a *"Download … True Alpha PNG"* link in the message body. That
  link, never the image's own editor download, is the real file
  (`Docs/art/ui/CONVERSATION.md` explains why).

## SPR-E — the workshops, level 1

`spr-e-workshops-l1.png` (1024×1024, true alpha, corner `srgba(0,0,0,0)`,
alpha mean 0.17). Took three rounds: round 1 came back 3/4 isometric and
muted, round 2 fixed camera, chunk and palette, round 3 added the built
lean-to to the two upper vignettes.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-e | tl | `carpenter_l1.png` | `fish norm_sq.fish spr-e-workshops-l1.png tl 0.72 carpenter_l1.png 128` |
| spr-e | tr | `masons_yard_l1.png` | `… tr 0.72 masons_yard_l1.png 128` |
| spr-e | bl | `smelter_l1.png` | `… bl 0.72 smelter_l1.png 128` |
| spr-e | br | `rune_carver_l1.png` | `… br 0.72 rune_carver_l1.png 128` |

## SPR-F — the workshops, level 4

`spr-f-workshops-l4.png` (1024×1024, true alpha, alpha mean 0.16). One
message; the model iterated three times on its own (it caught its own drift
back to a shallow camera, then a prop count) before delivering.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-f | tl | `carpenter_l4.png` | `fish norm_sq.fish spr-f-workshops-l4.png tl 0.82 carpenter_l4.png 128` |
| spr-f | tr | `masons_yard_l4.png` | `… tr 0.82 masons_yard_l4.png 128` |
| spr-f | bl | `smelter_l4.png` | `… bl 0.82 smelter_l4.png 128` |
| spr-f | br | `rune_carver_l4.png` | `… br 0.82 rune_carver_l4.png 128` |

## SPR-G — the workshops, level 8

`spr-g-workshops-l8.png` (1024×1024, true alpha, alpha mean 0.16). One
message, one self-correction. The prop-count rule ("do not re-render to fix
the count of a prop — only camera, chunk, palette, margins or
built-versus-resource readability") was added to this message and stopped the
model re-rendering over an ingot.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-g | tl | `carpenter_l8.png` | `fish norm_sq.fish spr-g-workshops-l8.png tl 0.92 carpenter_l8.png 128` |
| spr-g | tr | `masons_yard_l8.png` | `… tr 0.92 masons_yard_l8.png 128` |
| spr-g | bl | `smelter_l8.png` | `… bl 0.92 smelter_l8.png 128` |
| spr-g | br | `rune_carver_l8.png` | `… br 0.92 rune_carver_l8.png 128` |

## SPR-H — the small decorations

`spr-h-decorations.png` (1024×1024, true alpha, alpha mean 0.17). One
message, no correction pass — the style was locked by then.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-h | tl | `garden_l1.png` | `fish norm_sq.fish spr-h-decorations.png tl 0.70 garden_l1.png 128` |
| spr-h | tr | `well_l1.png` | `… tr 0.70 well_l1.png 128` |
| spr-h | bl | `statue_l1.png` | `… bl 0.70 statue_l1.png 128` |
| spr-h | br | `orchard_l1.png` | `… br 0.95 orchard_l1.png 256 128` |

**On the 2×1 fill fraction.** `norm_sq` scales content to fit a square box of
`min(w,h) × frac`, so a 2×1 asset is height-bound: the orchard's content is
1.6:1, and even at `frac` 0.95 it fills the 128 px height and only ~200 of the
256 px width. That is correct — the alternative distorts the aspect — but it
means a 2×1 asset wants `frac` near 0.95, not the 0.70 its 1×1 neighbours use.

## SPR-I — the big decorations, the first Reliquary and the first Tavern

`spr-i-plaza-shrine-reliquary-tavern.png` (1024×1024, true alpha, alpha mean
0.18). One message. Saying *which plot shape each quadrant is for* — "the two
on the left occupy a SQUARE two-by-two plot, the bottom-right a two-by-one" —
is what got the tavern drawn wide and the plaza drawn square.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-i | tl | `plaza_l1.png` (2×2) | `fish norm_sq.fish spr-i-plaza-shrine-reliquary-tavern.png tl 0.90 plaza_l1.png 256` |
| spr-i | tr | `shrine_l1.png` (2×2) | `… tr 0.90 shrine_l1.png 256` |
| spr-i | bl | `reliquary_l1.png` | `… bl 0.72 reliquary_l1.png 128` |
| spr-i | br | `tavern_l1.png` (2×1) | `… br 0.95 tavern_l1.png 256 128` |

## SPR-J — the Reliquary and the Tavern grow

`spr-j-reliquary-tavern-grow.png` (1024×1024, true alpha, alpha mean 0.16).

**A vignette crossed the canvas midline.** In the bottom row the tavern starts
at x=490, so the quadrant split at 512 cut its lantern off and gave the
reliquary's crop a slice of tavern. The alpha column profile finds the real
gap:

```sh
magick sheet.png -crop 1024x512+0+512 +repage -alpha extract \
  -resize '1024x1!' -depth 8 txt:-        # look for the zero run
# bottom row: content 163-393, gap 394-489, content 490-886  → split at 440
```

`norm_box.fish` (added with this sheet) takes that explicit crop box instead
of a quadrant. Check every sheet's two rows this way before cutting — the top
row of this one split cleanly at 512 and needed nothing.

| Sheet | Crop | File | Command |
|---|---|---|---|
| spr-j | tl | `reliquary_l4.png` | `fish norm_sq.fish spr-j-reliquary-tavern-grow.png tl 0.82 reliquary_l4.png 128` |
| spr-j | `440x512+0+512` | `reliquary_l8.png` | `fish norm_box.fish spr-j-reliquary-tavern-grow.png 440x512+0+512 0.92 reliquary_l8.png 128` |
| spr-j | tr | `tavern_l4.png` (2×1) | `fish norm_sq.fish spr-j-reliquary-tavern-grow.png tr 0.95 tavern_l4.png 256 128` |
| spr-j | `584x512+440+512` | `tavern_l8.png` (2×1) | `fish norm_box.fish spr-j-reliquary-tavern-grow.png 584x512+440+512 0.99 tavern_l8.png 256 128` |

## SPR-K — the Watchtower, and the first nest

`spr-k-watchtower-nest.png` (1024×1024, true alpha, alpha mean 0.23). This
message added the slicing constraint — *nothing may cross either midline,
leave a clear 40 px band* — and the model started enforcing an empty 80 px
cross itself. Both rows split cleanly at 512 from here on.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-k | tl | `watchtower_l1.png` (2×2) | `fish norm_sq.fish spr-k-watchtower-nest.png tl 0.72 watchtower_l1.png 256` |
| spr-k | tr | `watchtower_l4.png` (2×2) | `… tr 0.82 watchtower_l4.png 256` |
| spr-k | bl | `watchtower_l8.png` (2×2) | `… bl 0.92 watchtower_l8.png 256` |
| spr-k | br | `dragon_nest_l1.png` (2×2) | `… br 0.80 dragon_nest_l1.png 256` |

## SPR-L — the nest grows, and the Sanctum

`spr-l-nest-sanctum.png` (1024×1024, true alpha, alpha mean 0.26).

**The Sanctum's two tiers came back in the wrong order of grandeur.** Its
shipped `sanctum.png` — which the walk-down uses for levels 1–3 — is already a
domed stone building, so the hexagonal open shrine drawn for level 4 read as a
*step down*, not a step up. So the sheet's **bottom-right** (the blue-domed
observatory) became `sanctum_l4`, and `sanctum_l8` still wants a grander
piece: a great observatory, two towers, a brighter crystal, a full rune
circle. The hexagonal shrine is kept unused as
`spare-hex-shrine.png` — a good tile, but not a tier of this building.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-l | tl | `dragon_nest_l4.png` (2×2) | `fish norm_sq.fish spr-l-nest-sanctum.png tl 0.88 dragon_nest_l4.png 256` |
| spr-l | bl | `dragon_nest_l8.png` (2×2) | `… bl 0.95 dragon_nest_l8.png 256` |
| spr-l | br | `sanctum_l4.png` | `… br 0.92 sanctum_l4.png 128` |
| spr-l | tr | *(unused)* `spare-hex-shrine.png` | `… tr 0.80 … 128` |

## SPR-M — the existing producers, level 8

`spr-m-producers-l8.png` (1024×1024, true alpha, alpha mean 0.42 — these are
the fullest vignettes in the set).

**The model skipped the export step on this one**, delivering the render with
no alpha correction and no link. Asking for it alone works and is cheap:
*"that sheet is approved, but you skipped the export step — apply the
true-alpha correction, verify the 80-pixel centre cross, give me the link, do
not re-render"* took 46 s against the ~3 min a fresh render costs.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-m | tl | `townhall_l8.png` | `fish norm_sq.fish spr-m-producers-l8.png tl 0.94 townhall_l8.png 128` |
| spr-m | tr | `housing_l8.png` | `… tr 0.94 housing_l8.png 128` |
| spr-m | bl | `farm_l8.png` | `… bl 0.94 farm_l8.png 128` |
| spr-m | br | `sawmill_l8.png` | `… br 0.94 sawmill_l8.png 128` |

## SPR-N — the quarry, the market, the harbour, and a drake

`spr-n-quarry-market-harbour-drake.png` (1024×1024, true alpha, alpha mean
0.32). The model caught and removed a detached harbour fragment that had
spilled into the dragon's quadrant during export — the midline rule now runs
as its own check.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-n | tl | `quarry_l8.png` | `fish norm_sq.fish spr-n-quarry-market-harbour-drake.png tl 0.94 quarry_l8.png 128` |
| spr-n | tr | `market_l8.png` | `… tr 0.94 market_l8.png 128` |
| spr-n | bl | `docks_l8.png` (2×1) | `… bl 0.97 docks_l8.png 256 128` |
| spr-n | br | `creature_drake.png` | `… br 0.92 creature_drake.png 128` |

## SPR-O — the Barracks and the Spear Hall

`spr-o-barracks-spearhall.png` (1024×1024, true alpha, alpha mean 0.34). Left
column the barracks, right column the spear hall, top row level 4 and bottom
row level 8 — the columns-are-buildings, rows-are-tiers layout the model now
follows without being told.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-o | tl | `barracks_l4.png` | `fish norm_sq.fish spr-o-barracks-spearhall.png tl 0.80 barracks_l4.png 128` |
| spr-o | bl | `barracks_l8.png` | `… bl 0.92 barracks_l8.png 128` |
| spr-o | tr | `spear_hall_l4.png` | `… tr 0.80 spear_hall_l4.png 128` |
| spr-o | br | `spear_hall_l8.png` | `… br 0.92 spear_hall_l8.png 128` |

## SPR-P — the Shooting Grounds and the Stables

`spr-p-range-stables.png` (1024×1024, true alpha, alpha mean 0.33).

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-p | tl | `shooting_grounds_l4.png` | `fish norm_sq.fish spr-p-range-stables.png tl 0.80 shooting_grounds_l4.png 128` |
| spr-p | bl | `shooting_grounds_l8.png` | `… bl 0.92 shooting_grounds_l8.png 128` |
| spr-p | tr | `stables_l4.png` | `… tr 0.80 stables_l4.png 128` |
| spr-p | br | `stables_l8.png` | `… br 0.92 stables_l8.png 128` |

## SPR-Q — the eggs and the wyrmling

`spr-q-eggs-wyrmling.png` (1024×1024, true alpha, alpha mean 0.32). The one
sheet of **card objects rather than map tiles**: single subjects, no ground, no
shadow plate, a slightly lower camera than the buildings. Saying *"these appear
inside a card in my interface, not on the map"* is what switched the framing.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-q | tl | `egg_stone.png` | `fish norm_sq.fish spr-q-eggs-wyrmling.png tl 0.86 egg_stone.png 128` |
| spr-q | tr | `egg_ember.png` | `… tr 0.86 egg_ember.png 128` |
| spr-q | bl | `egg_storm.png` | `… bl 0.86 egg_storm.png 128` |
| spr-q | br | `creature_wyrmling.png` | `… br 0.90 creature_wyrmling.png 128` |

## SPR-R — the Sanctum's top tier

`spr-r-sanctum-l8.png` (1024×1024, true alpha, alpha mean 0.29). The debt
SPR-L left. Asked as a **single subject, not a sheet** — one building centred
on the canvas — which is the cheaper shape when only one asset is owed: same
one generation, no wasted quadrants. Cut with a plain trim rather than
`norm_sq` (there is no quadrant to pick):

```sh
magick spr-r-sanctum-l8.png -alpha extract -threshold 10% -format "%@" info:   # 748x749+144+111
magick -size 128x128 xc:none \( spr-r-sanctum-l8.png -crop 748x749+144+111 +repage \
  -filter point -resize 118x118 \) -gravity center -composite sanctum_l8.png
```

The Sanctum now reads base → `_l4` → `_l8` as one building growing: a domed
stone shrine, then a blue-domed observatory, then a great observatory with a
second dome and a full rune ring.

## SPR-S — the Infirmary, three tiers

`spr-s-infirmary.png` (1254×1254, alpha repaired locally — see below).
**Conversation:** <https://chatgpt.com/c/6aa15675-1314-83ed-80ce-37abeeba1a39>
("Generar PNG de enfermería", Codigames workspace, GPT-5.6 Sol Alta,
2026-09-09). First message carried `reference.png` and a fresh
`existing_sprites.png` montage (barracks, sanctum, market_l3, quarry_l3,
carpenter_l4, housing_l3).

Two rounds. Round 1 came back **3/4 isometric with fine detail** — the same
drift `sprite-prompts.md` warns about, and it arrives even with the camera
line already in the first message. Round 2 fixed it in 2m17s with the four
corrections spelled out again on their own: *80° camera, the TOP face of the
roof is what you see*, *two or three flat tones and one outline*, *nothing
under 4 px, drawn for 128 px wide*, *saturation up to the montage*, plus
smaller buildings inside each quadrant.

**The model's own alpha loop is a trap.** Round 1 spent **eleven minutes** in
a code-interpreter loop diagnosing its own baked checkerboard and never
delivered a file. Round 2 was told *not* to check or post-process the channel
in code, and delivered the sheet with its download link in 2m17s — with the
checkerboard baked, as always. Repairing it locally takes seconds and is
deterministic: the two greys are ~130 and ~191 with antialiased values
between them, so the mask is *any near-grey between 115 and 208* and then only
the component **connected to the border**, which is what keeps a pale blanket
or a grey cistern from being punched out. Corner ends `srgba(0,0,0,0)`, alpha
mean 0.14.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-s | tl | `infirmary_l1.png` | `fish norm_sq.fish spr-s-infirmary.png tl 0.72 infirmary_l1.png 128` |
| spr-s | tr | `infirmary_l4.png` | `… tr 0.82 infirmary_l4.png 128` |
| spr-s | bl | `infirmary_l8.png` | `… bl 0.92 infirmary_l8.png 128` |
| spr-s | br | — | left empty on purpose; only three tiers were wanted |

## spr-t — the three new relics

("Confirmación de archivo", Codigames workspace, GPT-5.6 Sol Alta,
2026-09-15). First message carried `anchor-relics.png`, a 5×1 `magick montage`
of the five relic sprites that already ship — **not** `reference.png` alone.

**Anchoring on an upload is read as "edit this file".** Twice. The first
prompt came back as *"dime qué modificación o exportación necesitas"*, and the
second as the same question again; only a message opening with **GENERA UNA
IMAGEN NUEVA. No edites ni exportes anchor-relics.png: ese archivo es SOLO la
referencia de estilo** got a generation. Say what the upload is FOR before
saying what to draw.

One round, 2m19s, and the style landed first try — the camera drift the older
sheets fought never appeared, which is what an anchor montage of shipped
sprites buys over a style sheet.

**The download does not fire from the extension.** Neither the message's
export menu (*Esta imagen*) nor the viewer panel's *Descargar* registers
anything in Chromium's download list. What works is to have the page do it
itself: fetch the `<img>`'s own `src` to a blob, hang it off an
`<a download>` and click it. It lands in `~/Descargas` like any other.

**Two enclosed patches survived the unbake** — the panes of the lantern's
glass and the bell of the horn — because the flood fill only takes the
checkerboard **connected to the border**, and those are islands. The script
grew a second pass for them: a patch is the pattern, rather than a grey
object, when it holds **both** of the checkerboard's greys. A third pass drops
stray specks under 40 px, which `norm_sq.fish` would otherwise take for
content and size the whole sprite against. Corner `srgba(0,0,0,0)`, alpha mean
0.18.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-t | tl | `artifact_delvers_lantern.png` | `fish norm_sq.fish spr-t-relics.png tl 0.90 artifact_delvers_lantern.png 256` |
| spr-t | tr | `artifact_muster_horn.png` | `… tr 0.90 artifact_muster_horn.png 256` |
| spr-t | bl | `artifact_bailiffs_tally.png` | `… bl 0.90 artifact_bailiffs_tally.png 256` |
| spr-t | br | — | left empty on purpose; only three relics were missing |

`0.90` rather than the buildings' `0.72`–`0.92` because a relic is a **card
object**: the five that ship fill 230 of their 256 px.

## spr-u — the three new album medallions

("Confirmación de archivo", same chat as spr-t, 2026-09-15). Anchored on
`anchor-albums.png`, a 5×1 montage of the medallions already on disk. Two
rounds, the second one the model's own: it delivered, then said the rings had
come out larger than asked and were crowding the centre cross, and redrew at
the right scale without being told. The midline rule earns its place in the
prompt.

**THE TWO GREYS ARE NOT ALWAYS THE SAME TWO.** This sheet's checkerboard came
back at **209 and 253** against the building sheets' 130 and 191, and the
fixed 115–208 band cut **1.1%** of the canvas instead of 66%. The script now
MEASURES the pair off the canvas border — the one place a sheet is certainly
background, since a medallion never reaches the edge — and builds the band
around it, keeping the constants only as the fallback for a border that is not
a checkerboard at all. spr-t re-cuts identically under the new code.

| Sheet | Quad | File | Command |
|---|---|---|---|
| spr-u | tl | `album_marketday.png` | `fish norm_sq.fish spr-u-albums.png tl 0.96 album_marketday.png 256` |
| spr-u | tr | `album_underthehill.png` | `… tr 0.96 album_underthehill.png 256` |
| spr-u | bl | `album_thelongmarch.png` | `… bl 0.96 album_thelongmarch.png 256` |
| spr-u | br | — | left empty on purpose; five of the eight already shipped |

`0.96`, not the relics' `0.90`: a medallion is a disc that fills its frame —
the five on disk sit at 248–251 of their 256 px.

## spr-v — the nine packs

("Crear hoja de iconos UI", the UI-icon conversation rather than the sprite
one, 2026-09-15). Three things this sheet settled, all of them corrections to
what LOG.md said before.

**ASK FOR THE ALPHA CORRECTION.** Every sheet above came back with the
checkerboard baked because the prompt ended *"do not check or post-process the
channel in code"*, and the repair moved into `unbake_checkerboard.py`. The UI
icon sheets never had that problem, and the difference is one sentence. Ending
a prompt with *"Do not draw grid lines, cell borders, labels, captions,
shadows or any background. The background must be alpha 0 everywhere, not
white, not a checkerboard. Then apply the true-alpha transparency correction
and give me the download link for the corrected PNG."* returns a real `srgba`
PNG, corner `(0,0,0,0)`, **no unbake at all**. The eleven-minute code loop
SPR-S warns about did not happen in either conversation that used this wording.

**SAY "NO DROP SHADOWS".** The first attempt drew a soft shadow under each
pack, which is painted onto the background: it survives the unbake as grey
smudge and is dead weight even with true alpha, because the game draws its own.

**A 3×3 GRID WORKS AS WELL AS A 2×2**, so nine sprites landed in one sheet
instead of three. `norm_box.fish` takes the explicit crops, `418x418` a cell.

The concept changed once on the way. Round one drew **letter envelopes with a
wax seal** — anchored on the four packs already on disk — and they read as
mail rather than as something you rip open. The four on disk were the
**retired** tiers, so there was nothing to match: dropping the anchor and
asking for *"a collectible sticker pack, the kind Monopoly Go uses — a glossy
foil pouch with a zig-zag tear strip"* is what landed it.

**THE CARD COUNT IS THE ART.** The number of cards fanning out of each pack is
the number that pack actually deals — 2 · 3 · 3 · 4 · 6 · 1, and 7 · 9 · 3 for
the vault's chests — so the store shelf's *"6 cards, 1× 5★ guaranteed"* and
its sprite say the same thing. It is the one detail that makes the row
readable without the text.

| Sheet | Cell | File | Command |
|---|---|---|---|
| spr-v | 1 | `pack_green.png` | `fish norm_box.fish spr-v-packs.png 418x418+0+0 0.92 pack_green.png 256` |
| spr-v | 2 | `pack_yellow.png` | `… 418x418+418+0 …` |
| spr-v | 3 | `pack_rose.png` | `… 418x418+836+0 …` |
| spr-v | 4 | `pack_blue.png` | `… 418x418+0+418 …` |
| spr-v | 5 | `pack_purple.png` | `… 418x418+418+418 …` |
| spr-v | 6 | `pack_golden.png` | `… 418x418+836+418 …` |
| spr-v | 7 | `pack_bronzechest.png` | `… 418x418+0+836 …` |
| spr-v | 8 | `pack_silverchest.png` | `… 418x418+418+836 …` |
| spr-v | 9 | `pack_goldchest.png` | `… 418x418+836+836 …` |
