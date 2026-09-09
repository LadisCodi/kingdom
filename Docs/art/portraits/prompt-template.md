# Character portrait — the generic prompt

> **Scope.** The reusable half of a hero-portrait prompt: everything that is
> the same for every character. The per-character half is one block
> (`=== EL PERSONAJE ===`), written fresh each time from the hero's own data.
>
> The scene equivalent is [`../art-promts.md`](../art-promts.md), which this
> is derived from. Same locked style, three clauses inverted — see
> [`README.md`](README.md) §2 for which and why.

**The prompt body is in Spanish, and stays in Spanish.** These docs are
English (`Docs/README.md`), and this is the exception: the body is not prose
about the design, it is the exact payload pasted into ChatGPT, and it is
audited and iterated in the language it is sent in. Everything around it —
this framing, the log in [`README.md`](README.md) — is English like the rest.

## How to use it

1. **One conversation per set**, with
   [`../style-reference.png`](../style-reference.png) attached to the first
   message. The image is a far stronger consistency anchor than any wording.
2. Paste §1 below, with `=== EL PERSONAJE ===` filled in per §2. Iterate here
   until the CHARACTER is right; ignore the background entirely.
3. Then ask for the black/white pair and extract the alpha yourself (§3).
4. Normalize it into the build (§4).

The first line is the user's override, kept verbatim because it reliably gets
a cut-out figure rather than a scene. **No wording stops the baked
checkerboard**, which is why §3 stops asking for one.

## 1. The generic block

Paste verbatim. `[…]` is the only thing to replace.

> Ignora todo lo que te haya dicho de generar imágenes. Genera esta sin fondo y en png.
>
> Genera una sola imagen. Encuadre vertical, relación de aspecto 2:3.
>
> Usa la imagen adjunta como REFERENCIA ESTRICTA DE ESTILO ARTÍSTICO. La imagen nueva debe parecer del mismo juego, hecha por el mismo equipo de arte, con el mismo motor de render, los mismos materiales, la misma paleta, la misma iluminación y el mismo nivel de detalle. Usa la referencia SOLO PARA EL ESTILO — es un diorama de un asentamiento y esto no lo es; no copies nada de su composición, ni sus edificios, ni su terreno.
>
> Esto es una ILUSTRACIÓN DE PERSONAJE para la pantalla de colección de héroes de un juego móvil de gestión / 4X ligero — el arte que rellena la carta de un héroe. No es key art de marketing.
>
> === EXCEPCIÓN IMPORTANTE A LA REFERENCIA ===
> En la referencia, los personajes son figuras diminutas a escala de juego, integradas en el entorno. Esa regla NO se aplica aquí. Esto es un personaje único, solo, llenando el encuadre, dibujado para leerse a tamaño de carta — porque solo se muestra en grande, dentro de un marco, nunca sobre el mapa.
>
> === EL PERSONAJE ===
> [EL BLOQUE DEL PERSONAJE — §2]
>
> === ESTILO VISUAL BLOQUEADO ===
> Render 3D estilizado de videojuego, luminoso y alegre. Paleta de fantasía muy saturada: [LOS COLORES DE ESTE PERSONAJE], con pequeños toques dorados. Luz suave de mediodía desde arriba a la izquierda, con sombras suaves, oclusión ambiental discreta, luz de contorno contenida y una atmósfera limpia y luminosa. Aquí incluso [LO MÁS OSCURO DE ESTE PERSONAJE] está iluminado como en una tarde de sol.
>
> Silueta redondeada, robusta e inmediatamente legible. Proporciones compactas y con encanto, con la cabeza, el pelo, las manos y las botas algo sobredimensionados, con el mismo espíritu artesanal que los edificios de la referencia — simpático y acogedor, y estructuralmente comprensible.
>
> Materiales suaves y simplificados con una variación de superficie discreta — sin texturas fotográficas, sin trama de tejido, sin capas de suciedad, sin grano, sin micro-detalle excesivo. Formas suavemente biseladas, bordes limpios, detalles decorativos usados con moderación. Cada elemento debe seguir siendo distinguible a tamaño de miniatura: jerarquía clara, poco ruido visual.
>
> La figura debe parecer una figura de colección pulida de un juego móvil, del mismo mundo que la referencia.
>
> === COMPOSICIÓN ===
> El personaje centrado, ocupando alrededor del 85% de la altura del encuadre, con aire cómodo por los cuatro lados y sin nada cortado. De pie y de frente al espectador, estable y legible — se mostrará dentro de un marco con elementos de interfaz superpuestos sobre su borde inferior, así que mantén sus piernas y sus pies simples y despejados.
>
> === EL FONDO — ESTO ES UN REQUISITO ESTRICTO ===
> Sin plataforma de suelo, sin hierba, sin pedestal, sin sombra proyectada en el suelo, sin resplandor detrás, sin viñeteado, sin degradado, sin ningún color detrás — solo el personaje, con sus propias sombras suaves sobre sí mismo.
>
> === EVITAR ===
> Sin texto, letras, números, etiquetas, carteles, interfaz, marco, borde, logotipo, marca de agua, tratamiento de título ni maquetación publicitaria.
>
> Sin encuadre cinematográfico dramático, sin pose de acción, sin destellos de cámara, sin destellos de lente, sin bloom fuerte, sin sombras duras, sin niebla, sin realismo sucio, sin fotorrealismo, sin ilustración pictórica, sin pinceladas visibles, sin pixel art, sin arte vectorial plano, sin línea de anime y sin ruido visual excesivo.
>
> Sin mascotas ni monturas, sin segunda arma, sin personajes adicionales, sin elementos flotantes [SALVO LOS QUE PIDA §2], y sin [LOS TÓPICOS DE ESTE ARQUETIPO].
>
> === EXPORTACIÓN ===
> Genera el PNG sin fondo y dame el enlace de descarga del archivo en el cuerpo del mensaje.

## 2. The per-character block

Six lines, in this order. Everything in it comes from the hero's own row —
`balance.json` `heroes` for the numbers, `heroContent` in
`src/sim/data/definitions.ts` for the name, the title and the trait line.

1. **Name, rarity, and the one sentence the title means.** `title` is written
   to be read as character, so it translates almost directly.
2. **Body, posture, expression**, and what it is _not_ — `no malvada`,
   `no sensual`, `sin posar para la cámara`. The negatives do more work than
   the positives.
3. **Head**: hair, skin, eyes, one head ornament.
4. **Clothes**, one layer at a time, plus the one bag it carries.
5. **The weapon, named as a shape.** Take it from `unitType`, never from the
   class word: `Lancer` → _una lanza_, `Archer` → _un arco_ or a caster's
   ranged tell, `Warrior` → _una espada corta_, `Cavalry` → _botas de montar
   y espuelas, sin montura_. "Archer" alone comes back as a hunter; "lancer"
   comes back as armoured cavalry.
6. **Hands and feet visible, weapon fully inside the frame.** Cheap to say,
   and it is what gets cropped otherwise.

Two rules that decide whether a portrait says anything:

- **Give the hero its one mechanical idea as a picture.** The trait is the
  character. `Packs light — expeditions cost 25% less to supply` → she carries
  a single satchel and nothing heavy. `Brings back 85% more Stardust` → she is
  leaving with more than she came for.
- **Name the archetype's clichés in EVITAR.** A necromancer invites skulls at
  the feet, ravens and a scythe; a paladin invites a cathedral behind him.
  Listing them is the only thing that keeps the frame clean.

## 3. Never ask it for the cut-out. Ask for a black/white pair.

**Do not ask for a transparent PNG at all.** Every attempt to get one back
paints the transparency checkerboard into an opaque RGB file — five for five,
in English and in Spanish, with and without the word *transparencia* anywhere
in the prompt. The model then detects its own fake, offers to fix it, and
either re-renders (the character drifts) or stalls in the correction and
delivers nothing. It cost two lost generations to learn.

**What works: two opaque images and arithmetic.** Ask for the same render over
pure black and over pure white, which is a thing the model is good at, and
recover the alpha exactly:

```
over black:  B = α·C              →  α = 1 − (W − B)
over white:  W = α·C + (1−α)·1    →  C = B / α
```

`alpha_from_pair.py` in this folder does it, and it **measures whether it is
allowed to**: for a true composite the three colour channels must yield the
same `1−α`, so it prints their spread first. Zero spread means the pair really
is one render.

The ask that produced it (second message, after the character is right):

> Olvida el recorte y el damero: no los quiero. Quiero DOS PNG con el fondo
> PLANO Y OPACO […] la misma pose, la misma escala, el mismo encuadre 2:3 y el
> personaje en la misma posición exacta, píxel a píxel igual en las dos. Lo
> ÚNICO que cambia entre las dos imágenes es el color del fondo: 1) NEGRO PURO
> #000000 […] 2) BLANCO PURO #FFFFFF […]

Two things make it work. Saying **opaque** removes every reason to draw a
checkerboard. And *"píxel a píxel igual en las dos"* makes it pick the right
strategy on its own — it renders once and derives the second file from that
same master, which is what guarantees the alignment the arithmetic needs.

```sh
python3 alpha_from_pair.py fondo_negro.png fondo_blanco.png hero_x.png
```

**Expect a 1-bit mask.** It flood-fills the background of one master, so the
alpha comes back strictly 0 or 1 — no anti-aliased edge, no semi-transparent
glow. That is fine here and invisible in the game, because the master is 1024
wide and the asset is 512: the downscale does the anti-aliasing. It would not
be fine for anything that needs a soft edge.

Still verify the file, because a clean pair is not a clean cut-out:

```sh
magick hero_x.png -format "%[pixel:p{0,0}] %[fx:mean.a]\n" info:   # srgba(0,0,0,0), < 0.5

# opaque islands: the figure, plus one per intentionally detached prop
magick hero_x.png -alpha extract -threshold 25% \
  -define connected-components:verbose=true \
  -define connected-components:area-threshold=20 \
  -connected-components 8 null:
```

The Necromancer returns three islands — the figure, her soul flame and its
trailing mote — which is the drawing, not matte specks. Read the bounding
boxes before calling one a defect.

Download from the **link in the message body**, then the download icon in the
file-viewer header. The image's own editor exports the checkerboard baked in.

## 4. Into the game

Normalize to the asset the build loads, the same way every sprite is
normalized — trimmed to content, 92% of the frame height, stood on the floor
of it, so every hero lines up with every other:

```sh
magick hero_x.png -trim +repage -resize x706 -background none \
  -gravity south -extent 512x748 -gravity north -extent 512x768 \
  -strip -define png:compression-level=9 src/render/assets/hero_<id>.png
```

The file name is `HEROES[<id>].sprite`, so nothing else has to change: all
five screens that draw a hero pick it up. Then add one line to
`src/ui/styles/screens/portraits.css`, which is where a repainted portrait
opts out of the placeholders' `image-rendering: pixelated`.
