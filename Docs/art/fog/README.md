# The cloud bank's texture

> **Scope.** The one tileable texture the cloud bank is drawn from
> ([`../art-direction.md`](../art-direction.md) §8.1). Shipped as
> `src/render/fog/cloud_tile.webp`.
>
> **Status: shipped 2026-10-02.**

- `cloud-tile.original.png` — ChatGPT's output, 1254 × 1254.
- The shipped file: its top/bottom and left/right seams blended over a
  ~14 px band, tiled 3 × 3, resized to 3072 and the centre 1024 × 1024 cut
  out (so the resize wraps), WebP quality 90.

**References attached:** a montage of the shipped `fog_cloud*` / `fog_wall*`
sprites on blue, and a game screenshot.

**Prompt**

```
GENERATE A NEW IMAGE. Do not edit or export the attached files: they are ONLY style references.

Attachment 1 is the cloud art my game ships today (shown on a blue backdrop only so you can see it). Attachment 2 is the game: an isometric city-builder whose unexplored land is hidden under a sunlit sea of clouds.

I need ONE SEAMLESSLY TILEABLE TEXTURE of that sea of clouds, to be repeated across the whole screen by a shader.

- Square, 1024 x 1024, fully OPAQUE (no transparency needed: it is a fill, not a sprite).
- Seen from above, the same camera as the game: we look down on the top of a thick, puffy cloud bank, like flying over it. Soft rounded cumulus puffs packed edge to edge, so there are NO gaps, no sky and no ground showing anywhere.
- Same style, palette and lighting as attachment 1: warm sunlit cream-white tops lit from above, soft lavender / periwinkle-blue shading in the creases between puffs. Cartoon, clean, soft painterly gradients, no hard outlines, no noise or grain.
- It MUST tile perfectly: the left edge continues exactly into the right edge and the top edge into the bottom edge, with no seam. Do not put any puff on a border that is not continued on the opposite side.
- Even and uniform: puffs of similar size (about 8 to 12 across the image), evenly distributed, no single puff or feature that stands out, so the repetition is not noticeable. No vignette, no lighter or darker corner, no overall gradient across the image.
- Do not draw any objects, birds, mountains, text, labels, frame or border.

Raw image only — do not resize, verify or post-process it in code.
```
