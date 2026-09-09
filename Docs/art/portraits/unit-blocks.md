# The four troops and the villager — blocks, and the two sizes each one needs

> **Scope.** The `=== LA TROPA ===` block per unit type, the villager's block
> beside them (§4), and why each one ships **two** files where a hero ships
> one. Heroes are [`roster-blocks.md`](roster-blocks.md); the shared prompt is
> [`prompt-template.md`](prompt-template.md).

## 1. A troop is a uniform, a hero is an individual

The one line that has to be in the prompt, because everything else follows
from it: **these four wear the same livery** — royal blue, cream and steel
with small gold — carry no personal props, and have plain friendly faces.
They read as four soldiers of the army the heroes travel with, and they are
told apart **by weapon and silhouette only**.

Without that, four separate prompts produce four protagonists, and the roster
stops being able to say "hero" and "troop" at a glance.

## 2. Each one ships two files

`iconEl(unitId, { size: 'lg' })` draws a unit at **48px** in the squad slots
(`.bt-face`, `battleSheet.ts`) and inside a 64px card in the picker
(`.bt-card-art`, `battlePicker.ts`). A whole standing figure at 48px is a
smudge — which is exactly why an avatar is wanted.

| File | Size | Where |
|---|---|---|
| `unit_<id>.png` | 512×768, 2:3 | the picker card, anywhere the troop is shown big |
| `unit_<id>_avatar.png` | 256×256, square | the 48px squad slots and any small widget |

**The avatar is CROPPED from the full body's master, not generated.** A second
generation would drift — a different face on the same soldier is worse than a
small figure — and the crop is free. So the prompt carries one extra demand
the hero prompts do not: *"la cabeza y los hombros amplios y despejados, sin
nada cruzándolos"*, and no weapon in front of the face. Without it the
Warrior's shield sits under his chin and there is nothing to crop.

```sh
python3 Docs/art/portraits/bust.py master.png unit_<id>_avatar.png
```

`bust.py` measures the square against the figure's **height** and centres it on
the **head**, and both of those are corrections to the obvious version. Cropping
the top half and filling a square gives every unit a different zoom, because the
crop inherits the figure's aspect ratio — the narrow Warrior came back tight on
the face and the wide mounted Cavalry came back far away, and four zooms in a row
of slots read as four mistakes. Centring on the canvas instead of the head crops
the Cavalry's rider out of his own portrait, because he sits well left of his
horse.

**The Cavalry then takes the one deliberate exception.** A consistent bust drops
the horse's head, and at 48px the horse is the whole point: a rider bust with a
lance is a Lancer. So its avatar is a wider square (`840px` of a `901×1449`
master, from `+110+10`) that holds rider, lance and horse head, and its head
therefore reads a little smaller than the other three. Distinguishability beats
consistency at that size — the avatar exists to tell four units apart, not to
frame a face.

## 3. The blocks

Weapon and silhouette come from `unitType`'s own row: `balance.units` for the
numbers, `UNIT_CONTENT` in `definitions.ts` for the description and tags, and
`BEATS` in `combat.ts` for what each one is *for*.

| Unit | atk / def / hp | squad | Reads as | Beats |
|---|---|---|---|---|
| Warrior | 3 / 3 / 12 | 100 | the wall | Lancer |
| Lancer | 5 / 2 / 8 | 100 | the reach | Cavalry |
| Archer | 6 / 1 / 6 | 80 | the glass cannon | Warrior |
| Cavalry | 7 / 2 / 10 | 60 | the hammer | Archer |

**Cavalry is the one that keeps its mount.** `tags: ['Mounted', 'Melee']` and
its glyph is a horse; the heroes were told *sin montura* precisely because
they are not this. Its avatar keeps the horse's head — see §2.

### Warrior — la primera línea

> El Guerrero — la primera línea. El que más armadura y salud tiene por su precio, y el que menos daño hace. Cierra distancias detrás del escudo.
>
> Hombre joven y macizo, de hombros anchos y piernas cortas y firmes, plantado de frente con el peso repartido y los pies separados. Serio y tranquilo, un soldado cumpliendo, ni heroico ni feroz, sin posar para la cámara.
>
> Pelo castaño corto, cara ancha y amable, ojos marrones, sin barba. Sin yelmo: la cabeza y los hombros despejados.
>
> Librea del reino: cota de malla clara bajo un tabardo AZUL REAL con ribete crema, hombreras de placa de acero redondeadas, cinturón ancho de cuero, faldón acolchado, grebas de acero y botas gruesas. Nada de capa.
>
> Su arma es una ESPADA CORTA de acero en la mano derecha, bajada a un lado. En el brazo izquierdo, un ESCUDO redondo de madera reforzada con acero, con el emblema del reino en azul y dorado, sostenido por delante del cuerpo a la altura de la cintura — nunca por delante de la cara.
>
> Las dos manos y los dos pies visibles y claramente legibles. La espada y el escudo enteros dentro del encuadre.
>
> EVITAR: sin yelmo cerrado ni casco que tape la cara, sin capa, sin cuernos, sin calaveras, sin sangre, sin pose de ataque, sin armadura negra ni de villano, sin adornos personales, sin montura.

### Lancer — el alcance

> El Lancero — el alcance que mantiene la línea a salvo. Pega más que el guerrero y aguanta menos. Es el que para una carga de caballería.
>
> Hombre delgado y alto, de pie muy erguido con los pies juntos y un hombro algo adelantado, como en formación. Atento y sereno, un soldado en su puesto, sin posar para la cámara.
>
> Pelo negro corto, cara estrecha y amable, ojos oscuros, sin barba. Sin yelmo: la cabeza y los hombros despejados.
>
> La misma librea del reino: gambesón acolchado AZUL REAL con ribete crema sobre camisa de lino, peto de acero ligero, hombrera de placa en un solo hombro, cinturón de cuero, mallas oscuras, grebas de acero y botas de caña media. Nada de capa.
>
> Su arma es una LANZA LARGA de asta de madera clara con la punta de acero, sostenida en vertical en la mano derecha, apoyada en el suelo y bien pegada a su costado — la punta arriba, muy por encima de la cabeza, sin cruzarle la cara. En el brazo izquierdo, un escudo pequeño y redondo sujeto al antebrazo, bajado.
>
> Las dos manos y los dos pies visibles y claramente legibles. La lanza entera dentro del encuadre, punta y extremo incluidos.
>
> EVITAR: sin yelmo cerrado ni casco que tape la cara, sin capa, sin pose de ataque, sin lanza en horizontal, sin bandera ni estandarte en el asta, sin adornos personales, sin montura.

### Archer — el cañón de cristal

> El Arquero — apoyo a distancia. El que más daño hace por su precio y el que menos tiene de todo lo demás: si le llegan, cae.
>
> Mujer joven y menuda, ligera de constitución, de pie con un pie algo adelantado y el peso atrás, como quien puede salir corriendo. Despierta y de buen humor, una soldado atenta, sin posar para la cámara.
>
> Pelo rubio oscuro recogido en una coleta corta y práctica, cara pequeña y amable, ojos verdes. Sin capucha y sin yelmo: la cabeza y los hombros despejados.
>
> La misma librea del reino: jubón de cuero claro sobre una casaca corta AZUL REAL con ribete crema, guardabrazo de cuero en el antebrazo izquierdo, cinturón cruzado, pantalón corto ceñido, medias oscuras y botines ligeros. Sin armadura de placas: es la tropa más ligera del ejército.
>
> Su arma es un ARCO alto de madera clara que sostiene en la mano izquierda, en vertical y bajado a un lado, sin tensar y sin flecha puesta. La ALJABA cuelga de la cadera derecha, no de la espalda, para no taparle los hombros.
>
> Las dos manos y los dos pies visibles y claramente legibles. El arco entero dentro del encuadre.
>
> EVITAR: sin capucha, sin yelmo, sin arco tensado, sin flecha en la cuerda, sin carcaj a la espalda, sin capa, sin pose de disparo, sin adornos personales, sin montura.

### Cavalry — el martillo

> La Caballería — rápida y de golpe duro, la que más daño hace del ejército y la que menos soldados trae. Arrolla a los arqueros.
>
> Un jinete MONTADO a caballo, los dos dentro del encuadre y de frente al espectador, en tres cuartos, el caballo parado y firme con las cuatro patas en el suelo y la cabeza algo baja. El jinete erguido en la silla, tranquilo, un soldado en su montura, sin posar para la cámara.
>
> El jinete: hombre joven de pelo castaño corto, cara amable, ojos marrones, sin yelmo y con la cabeza y los hombros despejados.
>
> La misma librea del reino: peto de acero sobre casaca AZUL REAL con ribete crema, hombreras redondeadas, guantes de cuero, pantalón de montar, botas altas con espuelas. El caballo es bayo de crin oscura, con gualdrapa AZUL REAL con ribete crema y testera de cuero sencilla — sin barda completa de placas.
>
> Su arma es una LANZA DE CABALLERÍA de asta clara sostenida en vertical en la mano derecha, apoyada en el estribo y bien pegada a su costado, sin cruzarle la cara. Un escudo pequeño colgado de la silla.
>
> La cara del jinete, sus dos manos y las cuatro patas del caballo visibles y legibles. La lanza entera dentro del encuadre.
>
> EVITAR: sin caballo encabritado, sin galope, sin polvo ni tierra levantada, sin pose de carga, sin barda completa que tape al caballo, sin cuernos ni penachos altos, sin capa, sin adornos personales.

## 4. The villager — the same panel, so the same two files

The Townhall trains villagers on the **same training block** the halls use for
soldiers (`src/ui/trainingSection.ts`), and that block draws a whole figure in
its detail panel and a bust in its queue. So a villager ships the same pair —
`unit_villager.png` at 512×768 and `unit_villager_avatar.png` at 256×256, the
avatar cropped with `bust.py` — and `src/ui/unitArt.ts` picks both up by that
stem. The master is `units/unit_villager.png`, 1024×1536, beside the troops'.

**This one came back with true alpha on the first ask** (2026-09-09): the
generic block's opening line, unchanged, produced a 1024×1536 RGBA with 58% of
its pixels at alpha 0 and no baked checkerboard, so the black/white pair
([`prompt-template.md`](prompt-template.md) §3) was not needed. One
counterexample does not retire §3 — five for five went the other way — but
check the file's own alpha before asking for the pair: a same-origin `fetch` of
the image in the ChatGPT tab and a canvas read is enough to know.

One thing the block has to say that the troops' do not: **this is not a
soldier.** It is the same kingdom in a civilian register — the map's own
worker (`src/render/assets/worker.png`) wears a straw hat, a cream shirt and
brown trousers, and the portrait should be recognisably that person at card
size. The royal blue appears once, small, as a tie-in; no armour, no weapon,
the "weapon shape" is a tool.

### Villager — el que trabaja

> El Aldeano — el que trabaja. Levanta los edificios, los hace funcionar y paga la renta. Todo lo demás depende de él.
>
> Hombre joven de constitución media, ni fuerte ni menudo, plantado de frente con el peso repartido y las botas separadas, relajado. Contento y despierto, con una media sonrisa de quien está a gusto con su jornada, sin posar para la cámara. No es un soldado y no debe parecerlo.
>
> Pelo castaño corto que asoma bajo un SOMBRERO DE PAJA de ala ancha, cara redonda y amable, ojos marrones, sin barba. El sombrero es el rasgo que lo identifica desde lejos; la cara queda despejada y bien visible bajo el ala, y los hombros libres.
>
> Ropa de trabajo sencilla y limpia: camisa de lino CREMA con las mangas remangadas hasta el codo, un pañuelo AZUL REAL anudado al cuello como único guiño al reino, chaleco corto de cuero marrón, cinturón ancho de cuero con una bolsita, pantalón marrón de tela basta y botas gruesas de trabajo. Sin armadura de ninguna clase, sin capa.
>
> Su herramienta es una AZADA de mango largo de madera clara con la pala de hierro, sostenida en vertical en la mano derecha, apoyada en el suelo y bien pegada a su costado, con la pala abajo — sin cruzarle la cara. Bajo el brazo izquierdo, un saco pequeño de arpillera medio lleno, apoyado en la cadera.
>
> Las dos manos y los dos pies visibles y claramente legibles. La azada entera dentro del encuadre, pala y mango incluidos.
>
> EVITAR: sin armas, sin escudo, sin armadura, sin yelmo, sin capa, sin pose heroica ni de ataque, sin cara seria de soldado, sin herramienta al hombro ni en horizontal, sin cesta en la cabeza, sin animales, sin carro, sin adornos personales, sin montura.

Two things the troops' blocks already carry and this one keeps: **the hat
must not shade the face** — the bust is cropped from this master, and a
brim-shadowed face at 48px is a dark blob; and **nothing crosses the head or
shoulders**, for the same crop. Livery colours are the troops' cream and blue
in reverse weight: cream is the garment, blue is the accent.

Into the build exactly as the troops (`prompt-template.md` §4, §2 above):

```sh
magick villager.png -trim +repage -resize x706 -background none \
  -gravity south -extent 512x748 -gravity north -extent 512x768 \
  -strip -define png:compression-level=9 src/render/assets/unit_villager.png
python3 Docs/art/portraits/bust.py villager.png src/render/assets/unit_villager_avatar.png
```

`src/ui/styles/screens/portraits.css` already lists `unit_villager`, so the
smooth render is not pixelated on landing.
