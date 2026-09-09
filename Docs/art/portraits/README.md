# Hero portraits — generation log

> **Scope.** Provenance for the character illustrations in this folder, and the
> prompt shape that produced them. The style question these answer is still
> open in [`../sprite-prompts.md`](../sprite-prompts.md) ("Portraits — a new
> class of art"): this is **one probe of the pipeline**, not a locked set.

The world set is pixel art anchored on [`../reference.png`](../reference.png).
These portraits are anchored on the newer
[`../style-reference.png`](../style-reference.png) and the prompt template in
[`../art-promts.md`](../art-promts.md) — bright stylized 3D, chunky rounded
forms, saturated palette.

## 1. Files

| File | What |
|---|---|
| [`prompt-template.md`](prompt-template.md) | **the reusable prompt** — the generic block, the per-character block, how to get the alpha, how to land it in the build |
| [`alpha_from_pair.py`](alpha_from_pair.py) | **the tool that solved the background** — alpha from a black/white pair, and the check that says whether it may |
| `hero_elven_princess.png` | 1024×1536 master, true alpha |
| `hero_necromancer.png` | 1024×1536 master, alpha from the pair |
| `*.prompt.txt` | each one's exact prompt, verbatim |

Both are wired into the build as `src/render/assets/hero_<id>.png`, normalized
to 512×768. The other thirty are still the 42×74 placeholder cards.

## 2. What a portrait prompt has to say that a tile prompt does not

The prompt that carries all of this is [`prompt-template.md`](prompt-template.md);
this section is the reasoning behind its shape.

The template in [`../art-promts.md`](../art-promts.md) is written for a
settlement diorama. Three of its clauses have to be overridden by name, or the
model inherits them:

- **"Characters stay small gameplay-scale figures, never posed for the
  camera"** — the opposite of a card portrait. Say the exception out loud, and
  say *why*: the figure is only ever shown large, inside a frame, never on the
  map. The same correction the pixel set needed for `spr-d` and `ui-f`.
- **"Do not copy the reference's layout"** — the reference is a place, the
  output is a person; without it, terrain leaks in.
- **The diorama's raised ground edges and contact shadows** — a card portrait
  wants no ground plate, no pedestal and no cast shadow, because interface
  chrome overlaps its lower edge ([`../../features/10-heroes.md`](../../features/10-heroes.md) §8.2).

Everything else in the template — palette, lighting, materials, silhouette,
the AVOID list — carries over unchanged.

Two more clauses earned their place:

- **Name the weapon and the silhouette**, not the class. The unit type is a
  balance fact (`Lancer` → a spear), and "lancer" alone comes back as
  cavalry-adjacent armour.
- **State the character's one idea.** The Elven Princess discounts supply, so
  the prompt says she carries nothing heavy and gives her exactly one satchel.
  A trait that has a picture is worth writing into the art.

## 3. ELV-A — The Elven Princess

- **Date:** 2026-09-09
- **Conversation:** <https://chatgpt.com/c/6aa1426d-6d14-83eb-a336-b9dd131fd31a>
  ("Generate Elven Princess Image", Codigames workspace)
- **Model:** GPT-5.6 Sol, effort Alta
- **Attached:** [`../style-reference.png`](../style-reference.png), first message
- **Wall clock:** 7 min 49 s for one delivered file
- **Verification:** `1024x1536`, corner `srgba(0,0,0,0)`, `alphaMean 0.219`,
  content `606×1300+209+118`, **one** opaque connected component — no stray
  matte specks, no halo on a magenta matte.

### The alpha ask now self-corrects, twice, and costs two re-renders

Asking for *"the true-alpha transparency correction, verify the alpha channel
yourself, and give me the download link"* worked without being called out — but
not on the first try:

1. First render: checkerboard **drawn into an opaque PNG**. It inspected the
   file, said so, and re-rendered "correcting only the background".
2. Second render: the same fake checkerboard. It said a misleading preview was
   not good enough and moved to a **deterministic chroma-key + morphological
   edge clean in the code interpreter**.
3. That pass produced the real file, and it reported the dimensions and the
   alpha state in the message body.

**The character drifts between passes.** "Correct only the background" is still
a re-render, and the circlet of golden leaves became leaf hairclips plus
blossoms between pass 1 and pass 2. If a specific render must survive, ask for
the deterministic alpha pass **on that file** up front rather than a background
fix.

Download from the link in the message body → the file viewer → its own
download icon, top right. The image's own editor still bakes the checkerboard
in.

**Superseded.** Do not repeat this. Nothing in a prompt prevents the baked
checkerboard, and the correction is where generations get lost — see NEC-A.

## 4. NEC-A — The Necromancer, and the end of asking for transparency

- **Date:** 2026-09-09
- **Conversation:** <https://chatgpt.com/c/6aa14d78-7b64-83eb-88c4-62c6b4b46a31>
  ("Generar nigromante PNG", Codigames workspace)
- **Model:** GPT-5.6 Sol, effort Alta
- **Prompt:** [`prompt-template.md`](prompt-template.md) §1 in Spanish, with
  every mention of transparency removed from it
- **Verification:** master `1024x1536`; the pair's channel spread of `1−α` is
  **0.0000** and no pixel out of range, so the two files are one render; alpha
  `66.52% / 33.48%` split with **zero** intermediate values; three opaque
  islands — the figure `823×1449`, the soul flame `123×236`, its mote `25×27`

### Four ways of asking, four checkerboards

The word *transparencia* was the suspect, so it was removed everywhere: from
the background block, from the export block, from the whole prompt. **The
checkerboard came back anyway** — and the model volunteered the word itself,
unprompted, in its very first line of reasoning. It is not in the wording.

Worse, the *correction* is where the work dies. Twice the turn ended inside it
and delivered no file at all: once at `Procesando`, once after
`Analizados los metadatos`. A good render was lost each time.

### What actually worked

Stop asking for a cut-out. Ask for the **same figure over pure black and over
pure white**, both opaque, and do the compositing arithmetic locally
(§3 of [`prompt-template.md`](prompt-template.md)).

The clause that made it exact was *"píxel a píxel igual en las dos"*: the model
chose, on its own, to render once and derive the second file from that same
master — *"Crearé una única versión sobre blanco y, a partir de ese mismo
archivo, derivaré la negra"*. That is precisely the condition the arithmetic
needs, and the channel-spread check confirms it held.

**The cost is a 1-bit mask.** It flood-fills the master's background, so there
is no anti-aliased edge and no semi-transparent glow. Invisible here — the
master is 1024 wide and the asset is 512, so the downscale anti-aliases it —
and unacceptable for anything that needs a genuinely soft edge.

**One render, ~5 min, nothing lost.** Against seven-plus minutes and two dead
generations for the Elven Princess.
