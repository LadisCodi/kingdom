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
2. Paste §1 below, with `=== EL PERSONAJE ===` filled in per §2.
3. Verify the file locally before believing the reply (§3).

The first line is the user's override, kept verbatim because it reliably gets
a cut-out figure rather than a scene. **It does not stop the baked
checkerboard** — nothing in the prompt does; §3 is what handles that.

## 1. The generic block

Paste verbatim. `[…]` is the only thing to replace.

> Ignora todo lo que te haya dicho de generar imágenes. Genera esta sin fondo y en png.
>
> Genera una sola imagen. Encuadre vertical, relación de aspecto 2:3. Fondo completamente transparente — un personaje recortado, sin ningún tipo de telón de fondo.
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
> Fondo completamente transparente. Sin plataforma de suelo, sin hierba, sin pedestal, sin sombra proyectada en el suelo, sin resplandor detrás, sin viñeteado, sin degradado, sin ningún color detrás — solo el personaje, con sus propias sombras suaves sobre sí mismo. Transparente significa canal alfa real: el damero de transparencia NO debe dibujarse como píxeles.
>
> === EVITAR ===
> Sin texto, letras, números, etiquetas, carteles, interfaz, marco, borde, logotipo, marca de agua, tratamiento de título ni maquetación publicitaria.
>
> Sin encuadre cinematográfico dramático, sin pose de acción, sin destellos de cámara, sin destellos de lente, sin bloom fuerte, sin sombras duras, sin niebla, sin realismo sucio, sin fotorrealismo, sin ilustración pictórica, sin pinceladas visibles, sin pixel art, sin arte vectorial plano, sin línea de anime y sin ruido visual excesivo.
>
> Sin mascotas ni monturas, sin segunda arma, sin personajes adicionales, sin elementos flotantes [SALVO LOS QUE PIDA §2], y sin [LOS TÓPICOS DE ESTE ARQUETIPO].
>
> === EXPORTACIÓN ===
> Genera el PNG sin fondo, con transparencia alfa real, y dame el enlace de descarga del archivo en el cuerpo del mensaje.
>
> Antes de dármelo, comprueba el archivo: el píxel de la esquina superior izquierda debe ser totalmente transparente y la media del canal alfa debe estar por debajo de 0,5. Si el resultado trae el damero pintado sobre un PNG opaco, NO vuelvas a generar la imagen: corrige el alfa sobre ese mismo archivo de forma determinista (recorte por croma del fondo del damero más limpieza de bordes) y verifícalo numéricamente. El personaje, su arma y el encuadre deben quedar idénticos.

## 2. The per-character block

Six lines, in this order. Everything in it comes from the hero's own row —
`balance.json` `heroes` for the numbers, `heroContent` in
`src/sim/data/definitions.ts` for the name, the title and the trait line.

1. **Name, rarity, and the one sentence the title means.** `title` is written
   to be read as character, so it translates almost directly.
2. **Body, posture, expression**, and what it is *not* — `no malvada`,
   `no sensual`, `sin posar para la cámara`. The negatives do more work than
   the positives.
3. **Head**: hair, skin, eyes, one head ornament.
4. **Clothes**, one layer at a time, plus the one bag it carries.
5. **The weapon, named as a shape.** Take it from `unitType`, never from the
   class word: `Lancer` → *una lanza*, `Archer` → *un arco* or a caster's
   ranged tell, `Warrior` → *una espada corta*, `Cavalry` → *botas de montar
   y espuelas, sin montura*. "Archer" alone comes back as a hunter; "lancer"
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

## 3. Verification — the part that is not negotiable

The model draws the transparency checkerboard as pixels into an opaque PNG,
announces the file as transparent, and shows a preview that looks correct.
**Check every file**:

```sh
magick out.png -format "%[pixel:p{0,0}]" info:            # srgba(0,0,0,0)
magick out.png -alpha extract -format "%[fx:mean]" info:  # < 0.5
```

A faked checkerboard passes the corner test alone, which is why the mean
matters. Then, for a cut-out figure specifically:

```sh
# exactly one opaque island — anything else is a matte speck
magick out.png -alpha extract -threshold 25% \
  -define connected-components:verbose=true \
  -define connected-components:area-threshold=20 \
  -connected-components 8 null:
```

Download from the **link in the message body**, then the download icon in the
file-viewer header. The image's own editor exports the checkerboard baked in.

**Never accept a re-render as the fix.** Asking it to "correct the background"
regenerates the image, and the character drifts — a circlet became hairclips
between two passes of the same prompt. The export block above says so in
Spanish for that reason.
