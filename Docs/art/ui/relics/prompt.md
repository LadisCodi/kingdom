# Relic illustrations — ChatGPT prompt

Attach `ref-style.png` (a montage of the shipped unlock icons and two heroes).
One prompt per sheet; sheet A then sheet B, each in its own chat.

## Shared block

GENERATE A NEW IMAGE. Do not edit or export the attached file: it is ONLY the style reference. Your output will sit next to these icons in the game; match them exactly: flat cartoon style, one bold uniform dark-brown outline around every shape, flat colours with one shadow tone and one highlight, no textures, no scratches, no painterly rendering, few details, saturated warm colours, lit from the top-left. Draw as if each object will be shown 128 px wide, so nothing thinner than 4 px.

Draw a 2x2 sheet, 1024x1024, of four MAGICAL RELICS from classic medieval fantasy: legendary enchanted objects, not everyday tools. Each one must read as magic at a glance: a glowing gem or rune, a soft coloured aura hugging the object, a few small sparkles touching it. One object per quadrant, centred, filling about 75% of its quadrant, shown at a slight three-quarter angle like the reference icons. These appear inside a card, not on the map.

Nothing may cross the canvas midlines: keep a clear empty band of at least 60 px along both midlines and along the outer edges. Sparkles and glows must stay attached to their own object and inside its quadrant.

[the four objects]

Do not draw grid lines, cell borders, labels, captions, shadows or any background. The background must be alpha 0 everywhere, not white, not a checkerboard. Then apply the true-alpha transparency correction and give me the download link for the corrected PNG.

## Sheet A (city relics)

- Top-left — STAFF OF RENEWAL: a gnarled living-wood staff whose top curls around a glowing green crystal, fresh leaves and a small flower sprouting from the wood; green aura.
- Top-right — SICKLE OF PLENTY: a golden crescent sickle with a wheat-ear engraving on the blade and a wrapped wooden handle, a few golden wheat ears tied to it; warm golden aura.
- Bottom-left — THE WINGED HAMMER: a steel hammer with two small white feathered wings on the sides of its head and a glowing blue rune on the face, leather-wrapped handle; blue aura with tiny lightning sparks.
- Bottom-right — THE TRIBUTE CROWN: an ornate gold crown set with red rubies, three gold coins floating just above it; golden aura.

## Sheet B (world relics)

- Top-left — THE STARGAZER'S ORB: a crystal ball holding a swirling violet starry night, held by a bronze claw stand; violet aura with star sparkles.
- Top-right — THE WISP LANTERN: an iron-and-brass lantern with a small pale-blue spirit wisp with a cute face floating inside instead of a flame; cyan aura.
- Bottom-left — WARHORN OF THE HOST: a curved ivory war horn with gold bands carved with glowing orange runes and a red tassel on a strap; warm orange aura.
- Bottom-right — THE STEWARD'S SIGNET: a heavy gold signet ring seen at an angle, its large emerald face carved with a tiny castle tower; green-gold aura.

## Cutting

Both sheets came back true alpha on the first try (2026-10-06). Cut them by
silhouette, not by an even grid — the old atlas sheet's even grid is what
dragged a neighbour's edge into four of the eight sprites:

    python3 -I cut.py sheet-a-raw.png ../../../../src/render/assets \
      artifact_staff_of_renewal artifact_sickle_of_plenty artifact_winged_hammer artifact_tribute_crown
    python3 -I cut.py sheet-b-raw.png ../../../../src/render/assets \
      artifact_stargazers_orb artifact_wisp_lantern artifact_warhorn artifact_stewards_signet
