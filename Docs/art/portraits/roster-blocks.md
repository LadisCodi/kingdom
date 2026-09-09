# The thirty-two per-character blocks

> **Scope.** One `=== EL PERSONAJE ===` block per hero, ready to drop into
> [`prompt-template.md`](prompt-template.md) §1. Nothing else about a
> generation lives here — the log is [`README.md`](README.md).

Each block is derived from that hero's own row, per
[`prompt-template.md`](prompt-template.md) §2: `rarity` and `unitType` from
`balance.json`, and `name` / `title` / `traitText` from `heroContent` in
`src/sim/data/definitions.ts`. **The weapon comes from `unitType`, never from
the class word**, and **the trait is drawn, not described**:

| `unitType` | The shape to name |
|---|---|
| `Warrior` | una espada corta, y un escudo si su título lo pide |
| `Lancer` | una lanza, o el mango largo del oficio que sea |
| `Archer` | un arco, o el gesto a distancia de quien lanza hechizos |
| `Cavalry` | botas de montar y espuelas, **sin montura** |

| The trait | The picture |
|---|---|
| `+X% defence` | plantado, peso repartido, algo que protege por delante |
| packs light | un solo bulto, y nada más de equipaje |
| more fragments | esquirlas de reliquia a la vista, algo a medio desenterrar |
| more Stardust | motas brillantes que se le pegan |
| more Knowledge | un tomo abierto, notas |
| sees the next depth | mira hacia delante — catalejo, mapa, olfato |

Order is `HERO_ORDER`. ✅ = generated and in the build.

---

## Legendary

### Scout — Legendary · Archer · ve la profundidad siguiente

> El Explorador — héroe legendario, el que se adelanta y vuelve sabiendo qué hay. Tirador a distancia.
>
> Enjuto y ligero, adelantando el cuerpo como si ya estuviera en marcha, una rodilla algo flexionada. Despierto y de buen humor, ni heroico ni sombrío, sin posar para la cámara.
>
> Pelo castaño corto revuelto, piel tostada, ojos avellana, una cinta de cuero en la frente.
>
> Capa corta de viaje verde oliva con capucha caída, jubón de cuero claro, pantalón remangado, botas de caminar gastadas. Una sola cartera cruzada al pecho.
>
> Su arma es un ARCO CORTO que sostiene en la mano izquierda, bajado y en reposo, con el carcaj a la espalda. En la mano derecha, levantado a la altura del pecho, un pequeño CATALEJO de latón por el que acaba de mirar: eso es lo suyo, ir delante y contarlo.
>
> Las dos manos y los dos pies visibles y claramente legibles. El arco entero dentro del encuadre.

### GoldenDragon — Legendary · Cavalry · +45% defensa de todo el grupo ✅ pendiente

> El Dragón Dorado — héroe legendario, más viejo que la ruina y aburrido de ella. Carga en primera línea y aguanta por todos.
>
> Un pequeño dragón dorado bípedo, rechoncho y de hombros anchos, de pie muy erguido con los brazos cruzados y los párpados a medio caer. Señorial y perezoso, simpático antes que temible, sin posar para la cámara.
>
> Escamas doradas pulidas, cuernos cortos color hueso, ojos ámbar de pupila fina, un hocico corto y romo. Alas pequeñas y plegadas, pegadas al lomo, que no se despliegan.
>
> Barda de placas doradas sobre el pecho y los hombros, gola grabada, faldón de escamas metálicas, grebas doradas y espuelas — va equipado para cargar, sin montura ninguna.
>
> Su arma es una LANZA DE CABALLERÍA de asta dorada, apoyada en el suelo junto a él. Plantado con el peso repartido entre las dos patas y un ESCUDO alto grabado clavado en el suelo por delante: es el que aguanta la línea.
>
> Las dos manos y los dos pies visibles y claramente legibles. La lanza entera dentro del encuadre.

### VampireLord — Legendary · Cavalry · +85% fragmentos

> El Señor Vampiro — héroe legendario, coleccionista desde hace siglos. Carga a distancia corta y vuelve con más de lo que fue a buscar.
>
> Alto y delgadísimo, de pie muy recto, una mano en la cadera y la barbilla algo alzada, media sonrisa cortés con un colmillo asomando. Elegante y divertido, ni sanguinario ni sensual, sin posar para la cámara.
>
> Pelo negro peinado hacia atrás, piel muy pálida, ojos granate, una ceja arqueada.
>
> Levita de terciopelo burdeos con forro negro, chorrera de encaje crema, guantes negros, pantalón oscuro, botas de montar altas con espuelas — va vestido para cabalgar, sin montura ninguna.
>
> Su arma es un ESTOQUE fino que sostiene en la mano derecha, con la punta apoyada en el suelo como un bastón. En el brazo izquierdo, una BANDEJA DE TERCIOPELO con seis o siete esquirlas de reliquia brillantes, ordenadas como una colección: eso es lo que se lleva de cada ruina.
>
> Las dos manos y los dos pies visibles y claramente legibles. El estoque entero dentro del encuadre.

### Pharao — Legendary · Warrior · +45% defensa de todo el grupo

> El Faraón — héroe legendario, enterrado con hombres mejores que él y con ganas de discutirlo. Aguanta la primera línea.
>
> Corpulento y de hombros cuadrados, plantado de frente con el peso repartido, el mentón alto y una expresión de paciencia infinita. Solemne y algo cómico, ni terrorífico ni siniestro, sin posar para la cámara.
>
> Tocado nemes a rayas azules y doradas, piel morena, ojos delineados en negro, una barba postiza corta y trenzada.
>
> Pectoral ancho de oro y lapislázuli sobre el pecho desnudo, shendyt plisado blanco, brazaletes de oro anchos, sandalias doradas. Sin vendas, sin polvo, sin nada momificado.
>
> Su arma es un KHOPESH dorado que sostiene en la mano derecha, bajado. En la mano izquierda, un ESCUDO alto de juncos dorados apoyado en el suelo por delante de él: nadie pasa mientras siga de pie.
>
> Las dos manos y los dos pies visibles y claramente legibles. El khopesh entero dentro del encuadre.

## Rare

### Scholar — Rare · Archer · +50% Conocimiento

> El Erudito — héroe raro, el que lee lo que dicen las paredes. Tirador a distancia y el que vuelve sabiendo más.
>
> Delgado y algo encorvado sobre lo que lee, la cabeza baja y los ojos levantados hacia el espectador, sorprendido de que le hablen. Amable y distraído, sin posar para la cámara.
>
> Pelo castaño claro alborotado, piel pálida, gafas redondas de montura fina, una pluma sujeta detrás de la oreja.
>
> Túnica larga azul índigo con vueltas crema, chaleco de cuero con presillas para plumas, pantalón oscuro, zapatos de hebilla. Un solo cartapacio de cuero colgado del hombro.
>
> Su arma es una BALLESTA LIGERA colgada del hombro, a la espalda y sin tocar. En las dos manos, abierto y a la altura del pecho, un TOMO grueso con notas asomando entre las páginas: es lo que de verdad trae de las ruinas.
>
> Las dos manos y los dos pies visibles y claramente legibles. La ballesta entera dentro del encuadre.

### RelicHunter — Rare · Cavalry · +50% fragmentos

> La Cazadora de Reliquias — héroe raro, reconoce una buena ruina por el olor. Explora a caballo y vuelve cargada.
>
> Atlética y de piernas largas, un pie adelantado sobre una piedra imaginaria, una mano en la cadera. Resuelta y con guasa, sin posar para la cámara.
>
> Trenza castaña gruesa sobre el hombro, piel tostada, ojos verdes, un pañuelo polvoriento al cuello y un sombrero de ala ancha a la espalda por el barbuquejo.
>
> Camisa caqui remangada, chaleco de cuero con muchas hebillas, pantalón de montar, botas altas con espuelas — va vestida para cabalgar, sin montura ninguna.
>
> Su arma es un SABLE DE CABALLERÍA en la vaina, a la cadera, sin desenvainar. En la mano derecha, una BOLSA de lona abierta de la que asoman cinco o seis esquirlas de reliquia brillantes, y en la izquierda una de ellas que está mirando al trasluz.
>
> Las dos manos y los dos pies visibles y claramente legibles. El sable entero dentro del encuadre.

### DarkKnight — Rare · Warrior · +30% defensa de todo el grupo

> El Caballero Oscuro — héroe raro, le debe algo a alguien y no dice a quién. Aguanta la primera línea.
>
> Ancho de espaldas y plantado de frente, el peso repartido, la cabeza algo ladeada como si escuchara algo lejano. Melancólico y buen compañero, ni malvado ni terrorífico, sin posar para la cámara.
>
> Pelo negro hasta la barbilla, piel pálida, ojos gris claro, una cicatriz vieja y fina en la mejilla. Sin yelmo: la cara se ve entera.
>
> Armadura de placas azul-negra de formas redondeadas, hombreras grandes, sobreveste violeta oscuro raído, guanteletes, grebas. Un cordón al cuello con un anillo partido — lo que debe.
>
> Su arma es una ESPADA ANCHA que sostiene en la mano derecha con la punta clavada en el suelo, las dos manos sobre el pomo. Plantado por delante del grupo: mientras siga ahí, aguantan todos.
>
> Las dos manos y los dos pies visibles y claramente legibles. La espada entera dentro del encuadre.

### Paladin — Rare · Warrior · +30% defensa de todo el grupo

> La Paladín — héroe raro, no ha llegado tarde ni una sola vez. Aguanta la primera línea.
>
> Erguida y simétrica, plantada de frente con el peso repartido, hombros atrás, una sonrisa breve y formal. Cumplidora y cálida, ni severa ni sensual, sin posar para la cámara.
>
> Melena rubia recogida en un moño bajo, piel clara, ojos azules, una diadema fina de acero pulido. Sin yelmo.
>
> Armadura de placas blanca y dorada de formas redondeadas, tabardo azul con un sol bordado, guanteletes, grebas. Un RELOJ DE SOL de bolsillo colgado del cinturón, bien a la vista — nunca llega tarde.
>
> Su arma es una ESPADA CORTA en la mano derecha, bajada. En el brazo izquierdo, un ESCUDO alto redondeado por delante del cuerpo, plantado y firme.
>
> Las dos manos y los dos pies visibles y claramente legibles. El escudo entero dentro del encuadre.

### Wizard — Rare · Archer · +50% Polvo de Estrellas

> El Mago — héroe raro, está segurísimo de cosas equivocadas y lo dice muy alto. Lanza a distancia.
>
> Bajito y barrigudo, plantado con un pie adelantado y el índice de la mano libre levantado en pleno discurso, la boca abierta a media palabra. Presumido y entrañable, sin posar para la cámara.
>
> Barba blanca larga y esponjosa, piel rosada, cejas enormes, ojos azules muy abiertos, un sombrero cónico azul noche algo torcido.
>
> Túnica azul noche con estrellas doradas bordadas, cinturón de cuero con dos frascos, zapatillas puntiagudas. Una sola bolsa de tela colgada.
>
> Su arma es un BÁCULO de madera nudosa en la mano izquierda, vertical y apoyado en el suelo, coronado por un cristal ámbar. Alrededor del cristal y de su hombro, un puñado de MOTAS DORADAS de polvo de estrellas flotando y pegadas a él: vuelve cubierto de eso.
>
> Las dos manos y los dos pies visibles y claramente legibles. El báculo entero dentro del encuadre.

### Witch — Rare · Archer · +50% Polvo de Estrellas

> La Bruja — héroe raro, sabe qué setas se comen y qué setas no. Lanza a distancia.
>
> Menuda, de pie con las rodillas juntas y un hombro algo más alto, la cabeza inclinada y una sonrisa de medio lado. Traviesa y campechana, ni malvada ni sensual, sin posar para la cámara.
>
> Melena pelirroja larga y ondulada, piel muy clara con pecas, ojos verdes, un sombrero de bruja violeta de punta doblada.
>
> Vestido violeta oscuro de manga larga con cuello crema, delantal de lino con manchas de tinte, medias a rayas, botines abotonados. Un solo cesto de mimbre en el brazo con tres setas dentro.
>
> Su arma es una VARA corta y retorcida en la mano derecha, apuntando al suelo, con la punta encendida en un chispazo verde. Del cesto y de la vara escapan unas pocas MOTAS DORADAS de polvo de estrellas.
>
> Las dos manos y los dos pies visibles y claramente legibles. La vara entera dentro del encuadre.

### Druid — Rare · Lancer · el suministro cuesta un 25% menos

> El Druida — héroe raro, come lo que le da el camino. Pelea con asta y no carga con nada.
>
> Alto y desgarbado, de pie muy tranquilo con los pies descalzos algo separados, un puñado de bayas en la mano abierta. Sereno y risueño, sin posar para la cámara.
>
> Pelo castaño largo con hojas enredadas, barba corta, piel curtida, ojos verde musgo, una corona sencilla de ramas.
>
> Túnica corta de lino verde salvia sin mangas, esclavina de piel de oveja en un hombro, cinturón de cuerda, pies descalzos. NADA de equipaje: ni bolsa, ni mochila, ni petate — eso es su personaje.
>
> Su arma es una LANZA de madera clara con la punta de piedra atada con tiras de cuero, en la mano derecha y apoyada en el suelo. En la izquierda, abierta, tres o cuatro bayas y una nuez: eso es todo lo que lleva de comer.
>
> Las dos manos y los dos pies visibles y claramente legibles. La lanza entera dentro del encuadre.

### IceLancer — Rare · Lancer · +30% defensa de todo el grupo

> La Lancera de Hielo — héroe raro, más fría que la profundidad en la que está. Aguanta la línea con el asta.
>
> Erguida y quieta, plantada de frente con el peso repartido, hombros atrás, la expresión serena y distante. Impasible y noble, ni severa ni sensual, sin posar para la cámara.
>
> Melena blanco azulada recogida en una coleta alta, piel muy clara con un rubor frío, ojos azul hielo, una diadema de escarcha.
>
> Coraza de placas azul claro con filos plateados, capa corta blanca en un hombro, mallas azul oscuro, botas altas plateadas. Una escarcha finísima en los bordes de la armadura, sin nieve suelta.
>
> Su arma es una LANZA larga de asta plateada con la punta de hielo translúcido, sostenida en vertical en la mano derecha y apoyada en el suelo. Plantada delante del grupo, con la lanza cruzada como una barrera.
>
> Las dos manos y los dos pies visibles y claramente legibles. La lanza entera dentro del encuadre.

### HolyWarrior — Rare · Cavalry · +50% fragmentos

> El Guerrero Sagrado — héroe raro, cava donde cae la luz. Carga a caballo y vuelve con las manos llenas.
>
> Robusto y de brazos gruesos, un pie adelantado y el cuerpo algo inclinado hacia el trabajo, sonriendo de oreja a oreja. Bonachón y trabajador, ni fanático ni severo, sin posar para la cámara.
>
> Pelo rubio corto al rape, piel tostada, ojos miel, una aureola finísima de latón sujeta al casquete.
>
> Cota de malla clara bajo un tabardo blanco con un sol dorado, guantes de trabajo, pantalón de montar, botas altas con espuelas — va vestido para cabalgar, sin montura ninguna.
>
> Su arma es una PALA de hoja ancha con el mango largo, sostenida con las dos manos como si fuera un asta, la hoja clavada en el suelo. Del bolsillo del tabardo y de un morral asoman cuatro o cinco esquirlas de reliquia brillantes, recién sacadas.
>
> Las dos manos y los dos pies visibles y claramente legibles. La pala entera dentro del encuadre.

### SavageWarrior — Rare · Cavalry · +50% fragmentos

> El Salvaje — héroe raro, se lleva la puerta entera con él. Carga sin frenar y vuelve cargado.
>
> Enorme, de espaldas anchísimas y piernas cortas, inclinado hacia delante por el peso que lleva a la espalda, riéndose con la boca abierta. Bruto y bonachón, ni sanguinario ni terrorífico, sin posar para la cámara.
>
> Melena castaña enmarañada con dos trenzas pequeñas, barba espesa, piel curtida, ojos marrones diminutos y alegres, la nariz ancha.
>
> Torso desnudo con un arnés de cuero cruzado, faldón de pieles, brazaletes de hierro anchos, botas de montar con espuelas — va equipado para cargar, sin montura ninguna.
>
> Su arma es un HACHA de una mano en la mano derecha, bajada. A la espalda, atada con una cuerda, una PUERTA DE MADERA arrancada entera con sus goznes torcidos, y metidas en el cinturón cuatro o cinco esquirlas de reliquia brillantes.
>
> Las dos manos y los dos pies visibles y claramente legibles. El hacha y la puerta enteras dentro del encuadre.

### Spymaster — Rare · Archer · ve la profundidad siguiente

> La Maestra de Espías — héroe raro, ya estuvo ahí abajo ayer. Tira a distancia y siempre sabe qué viene.
>
> Delgada y de pie muy quieta, el peso en una pierna, una mano sujetando el borde de la capucha para taparse media cara. Aguda y divertida, ni siniestra ni sensual, sin posar para la cámara.
>
> Pelo negro liso cortado a la altura de la mandíbula, piel morena, ojos oscuros y despiertos, un antifaz fino de tela sobre el puente de la nariz.
>
> Capa corta gris pizarra con capucha subida, jubón negro ajustado con cierres discretos, guantes cortos, mallas oscuras, botas silenciosas de suela blanda. Una sola cartera plana cruzada.
>
> Su arma es un ARCO CORTO desmontado en dos piezas colgado del cinturón, sin usar. En la mano libre, un MAPA doblado con marcas y un CATALEJO diminuto: lo suyo es haber ido antes que tú.
>
> Las dos manos y los dos pies visibles y claramente legibles. El mapa entero dentro del encuadre.

### ElectricArcher — Rare · Archer · +50% Polvo de Estrellas

> La Arquera de la Tormenta — héroe raro, cuenta los segundos entre el rayo y el trueno. Tira a distancia.
>
> Ágil y estirada hacia arriba, un pie adelantado, la cabeza levantada mirando al cielo y contando con los dedos de la mano libre. Concentrada y con chispa, ni heroica ni sensual, sin posar para la cámara.
>
> Pelo azul eléctrico corto y de punta, piel morena, ojos cian claro, dos mechones levantados por la electricidad estática.
>
> Peto de cuero azul marino con placas plateadas, manga corta en un brazo y guardabrazo largo en el otro, falda corta con paneles, mallas oscuras, botas ligeras. Una sola aljaba a la cadera.
>
> Su arma es un ARCO alto en la mano izquierda, con la cuerda tensada a medias y una FLECHA cuya punta chisporrotea con un pequeño rayo azul. Alrededor de la flecha, unas pocas MOTAS DORADAS de polvo de estrellas.
>
> Las dos manos y los dos pies visibles y claramente legibles. El arco entero dentro del encuadre.

## Common

### Warden — Common · Warrior · +20% defensa de todo el grupo

> El Guardián — héroe común, el escudo de la muralla vieja. Aguanta la primera línea y no se mueve.
>
> Mayor y macizo, plantado de frente con el peso repartido y los pies bien separados, la barbilla algo baja y una mirada tranquila. Firme y afable, ni severo ni heroico, sin posar para la cámara.
>
> Pelo canoso corto, barba gris recortada, piel curtida, ojos grises, una cicatriz vieja en la ceja. Sin yelmo.
>
> Cota de malla clara bajo un sobreveste azul desgastado, hombreras de cuero remachado, cinturón ancho, grebas de placas, botas gruesas.
>
> Su arma es una ESPADA CORTA en la vaina, a la cadera, sin desenvainar. En el brazo izquierdo, un ESCUDO grande y redondeado con el emblema de la muralla, plantado por delante del cuerpo con las dos manos: es literalmente el escudo del grupo.
>
> Las dos manos y los dos pies visibles y claramente legibles. El escudo entero dentro del encuadre.

### Quartermaster — Common · Lancer · el suministro cuesta un 25% menos

> El Intendente — héroe común, cuenta hasta la última galleta. Pelea con asta y estira los víveres.
>
> Bajo y rechoncho, de pie con los talones juntos, un dedo en el aire llevando la cuenta y las cejas levantadas. Meticuloso y simpático, sin posar para la cámara.
>
> Pelo castaño ralo peinado con raya, bigote fino, piel clara, ojos marrones, unas gafas de media luna en la punta de la nariz.
>
> Casaca de lana marrón con botones de latón, chaleco a rayas, pantalón corto, medias y zapatos de hebilla. Un solo morral pequeñísimo — todo lo demás lo ha racionado.
>
> Su arma es una LANZA sencilla de asta larga en la mano izquierda, apoyada en el suelo. En la derecha, un CUADERNO de cuentas abierto, y del cinturón cuelga una lata de galletas diminuta: nadie hace durar tanto tan poco.
>
> Las dos manos y los dos pies visibles y claramente legibles. La lanza entera dentro del encuadre.

### Adventurer — Common · Lancer · +25% fragmentos

> El Aventurero — héroe común, está aquí por la historia que va a contar. Pelea con asta y vuelve con recuerdos.
>
> Joven y espigado, un pie adelantado y el pecho fuera, la mirada al horizonte y una sonrisa enorme. Entusiasta y algo iluso, sin posar para la cámara.
>
> Pelo castaño alborotado, piel clara, ojos marrones brillantes, una venda pequeña en la ceja de la que está muy orgulloso.
>
> Camisa blanca remangada, chaleco de cuero marrón, faja roja, pantalón de lona, botas de caña baja. Un solo petate al hombro.
>
> Su arma es una LANZA de asta de madera en la mano derecha, apoyada en el suelo. En la izquierda, un DIARIO de viaje abierto con un lápiz encajado, y del petate asoman dos o tres esquirlas de reliquia brillantes que se ha traído de recuerdo.
>
> Las dos manos y los dos pies visibles y claramente legibles. La lanza entera dentro del encuadre.

### Bard — Common · Archer · +25% Polvo de Estrellas

> El Bardo — héroe común, canta y el camino se hace más corto. Tira a distancia cuando hace falta.
>
> Esbelto y en contrapposto suave, un pie cruzado por delante del otro, la cabeza ladeada sobre el instrumento y la boca abierta cantando. Encantador y bromista, ni heroico ni sensual, sin posar para la cámara.
>
> Rizos rubio miel a la altura del hombro, piel clara, ojos verdes, un sombrero de fieltro verde con una pluma larga.
>
> Jubón acuchillado en burdeos y crema, capa corta a un hombro, calzas ajustadas, botines con vuelta. Una sola bolsa pequeña al cinto.
>
> Su arma es un ARCO CORTO colgado a la espalda, sin tocar. En las dos manos, un LAÚD de caja redonda que está rasgando; de las cuerdas escapan unas pocas MOTAS DORADAS de polvo de estrellas.
>
> Las dos manos y los dos pies visibles y claramente legibles. El laúd entero dentro del encuadre.

### BeastkinHunter — Common · Cavalry · ve la profundidad siguiente

> La Cazadora Bestezuela — héroe común, lee un rastro que nadie más ve. Carga a caballo y va oliendo el camino.
>
> Ágil y algo agachada hacia delante, el peso adelantado, la nariz levantada oliendo el aire y las orejas tiesas. Salvaje y cariñosa, ni feroz ni sensual, sin posar para la cámara.
>
> Bestezuela felina: pelaje corto leonado con manchas, orejas puntiagudas de gato en lo alto de la cabeza, ojos ámbar de pupila vertical, melena castaña recogida en una trenza, una cola larga y anillada.
>
> Peto de cuero curtido sobre una camisa corta de lino, hombrera de piel, pantalón de montar corto, envolturas de cuero en las pantorrillas, botas cortas con espuelas — va equipada para cabalgar, sin montura ninguna.
>
> Su arma es un SABLE DE CAZA curvo en la mano derecha, bajado. En la izquierda, agachada a la altura de la cadera, sostiene una PLUMA y una huella de barro en un trozo de corteza: sabe qué viene antes de llegar.
>
> Las dos manos y los dos pies visibles y claramente legibles. El sable entero dentro del encuadre. Que sea una persona con rasgos felinos, nunca un animal a cuatro patas.

### Cleric — Common · Warrior · +20% defensa de todo el grupo

> La Clériga — héroe común, mantiene de pie a los heridos. Aguanta la primera línea.
>
> Compacta y plantada de frente, el peso repartido, los hombros cuadrados y una expresión de calma profesional. Cálida y firme, ni severa ni sensual, sin posar para la cámara.
>
> Pelo castaño oscuro recogido en un pañuelo blanco, piel morena, ojos marrones, una cofia de lino.
>
> Hábito gris paloma hasta la rodilla con una sobreveste blanca, peto de cuero sencillo encima, mangas remangadas, medias gruesas, zuecos de cuero. VENDAS limpias enrolladas en el cinturón y en el antebrazo.
>
> Su arma es una MAZA corta de cabeza redonda en la mano derecha, bajada. En el brazo izquierdo, un ESCUDO redondo pequeño plantado por delante: se pone entre el grupo y el golpe.
>
> Las dos manos y los dos pies visibles y claramente legibles. La maza entera dentro del encuadre.

### Cook — Common · Lancer · el suministro cuesta un 15% menos

> La Cocinera — héroe común, saca una semana de tres días de rancho. Pelea con el mango largo del oficio.
>
> Baja y ancha de caderas, una mano en la cadera y la otra en alto con el cazo, la barbilla alzada como quien no admite discusión. Mandona y campechana, sin posar para la cámara.
>
> Moño castaño alto algo deshecho, piel rosada, mejillas coloradas, ojos marrones, un pañuelo rojo a la cabeza.
>
> Blusa blanca remangada, delantal de lona con manchas, falda parda hasta la pantorrilla, zuecos. Una sola OLLA pequeña colgada del cinturón — nada más de equipaje.
>
> Su arma es un CAZO de mango largo de hierro, sostenido en vertical en la mano derecha con el mango apoyado en el suelo como si fuera una lanza. En la izquierda, una cebolla y una zanahoria: con eso da de comer a todos.
>
> Las dos manos y los dos pies visibles y claramente legibles. El cazo entero dentro del encuadre.

### Gardener — Common · Warrior · +20% defensa de todo el grupo

> El Jardinero — héroe común, paciente con todo lo que crece. Aguanta la primera línea sin alterarse.
>
> Mayor y enjuto pero de manos enormes, plantado de frente con el peso repartido, algo encorvado y sonriendo con los ojos cerrados. Tranquilísimo y bonachón, sin posar para la cámara.
>
> Coronilla calva con pelo blanco a los lados, barba blanca corta, piel curtida y pecosa, un sombrero de paja de ala ancha en la espalda.
>
> Camisa de lino verde salvia remangada, peto de trabajo marrón con bolsillos, guantes de jardinero, pantalón de pana, botas de goma bajas. Un macetero pequeño en el bolsillo del peto.
>
> Su arma es una AZADA de mango largo, sostenida con las dos manos en vertical, la hoja clavada en el suelo. Apoyada delante de él, la TAPA de mimbre redonda de un cesto, ancha como un escudo: se planta detrás y no hay quien lo mueva.
>
> Las dos manos y los dos pies visibles y claramente legibles. La azada entera dentro del encuadre.

### Joker — Common · Archer · +25% fragmentos

> El Bufón — héroe común, se guarda lo que nadie estaba mirando. Tira a distancia.
>
> Delgadísimo y flexible, en una postura torcida y juguetona con una rodilla girada hacia dentro, mirando de reojo al espectador con una sonrisa culpable. Travieso y simpático, nunca siniestro, sin posar para la cámara.
>
> Pelo negro corto asomando bajo un gorro de bufón de tres puntas en violeta y amarillo con cascabeles, piel clara, ojos oscuros muy vivos, una peca en el pómulo.
>
> Jubón a cuadros violeta y amarillo con cuello de picos, calzas bicolores, cinturón con cascabeles, zapatos puntiagudos con campanilla. Una sola faltriquera, sospechosamente abultada.
>
> Su arma es una HONDA de cuero en la mano derecha, colgando. En la izquierda, sostenidas en abanico como cartas, tres o cuatro ESQUIRLAS DE RELIQUIA brillantes que claramente no eran suyas.
>
> Las dos manos y los dos pies visibles y claramente legibles. La honda entera dentro del encuadre.

### Merchant — Common · Lancer · el suministro cuesta un 15% menos

> El Mercader — héroe común, nunca paga lo que le piden. Pelea con asta y regatea el suministro.
>
> Rechoncho y de pie muy cómodo, una mano abierta hacia el espectador en pleno regateo, la otra sujetando la vara, las cejas levantadas. Zalamero y simpático, sin posar para la cámara.
>
> Pelo negro con raya al medio y entradas, bigote poblado, piel olivácea, ojos oscuros, un fez granate pequeño.
>
> Casaca acolchada verde botella con ribete dorado, fajín ancho a rayas, pantalón bombacho, babuchas de cuero. Una sola CAJA fuerte pequeña bajo el brazo, con candado.
>
> Su arma es una VARA DE MEDIR de asta larga con marcas de latón, en la mano izquierda y apoyada en el suelo como una lanza. Del fajín cuelga una balanza de mano diminuta.
>
> Las dos manos y los dos pies visibles y claramente legibles. La vara entera dentro del encuadre.

### Priest — Common · Warrior · +20% defensa de todo el grupo

> El Sacerdote — héroe común, dice las palabras que sostienen una línea. Aguanta la primera fila.
>
> Alto y estirado, plantado de frente con el peso repartido, la barbilla alta y la boca abierta a media plegaria. Solemne y afable, ni severo ni fanático, sin posar para la cámara.
>
> Tonsura con pelo castaño alrededor, piel clara, ojos marrones cerrados a medias, una barba corta y cuidada.
>
> Sotana crema hasta el suelo con estola azul bordada, esclavina corta en los hombros, cordón anudado a la cintura, sandalias de cuero. Sin equipaje.
>
> Su arma es un INCENSARIO de latón de cadena corta en la mano derecha, sostenido como una maza y humeando un hilillo fino. En el brazo izquierdo, un LIBRO grueso abierto sostenido por delante del pecho como un escudo: eso es lo que sostiene la línea.
>
> Las dos manos y los dos pies visibles y claramente legibles. El incensario entero dentro del encuadre.

### Rogue — Common · Cavalry · +25% fragmentos

> La Pícara — héroe común, dedos ligeros y pasos más ligeros todavía. Va y viene rápido y vuelve con más.
>
> Menuda y de pie sobre la punta de un pie, el cuerpo girado y la cabeza mirando atrás por encima del hombro, sonriendo de medio lado. Ágil y burlona, ni siniestra ni sensual, sin posar para la cámara.
>
> Pelo negro corto y desfilado, piel clara, ojos verdes muy vivos, un aro pequeño en una oreja.
>
> Jubón de cuero marrón oscuro ajustado sobre camisa gris, capa corta con capucha caída, cinturón cruzado, mallas negras, botas ligeras de caña alta con espuelas pequeñas — va equipada para cabalgar, sin montura ninguna.
>
> Su arma es una DAGA en cada mano — una bajada y otra girada hacia atrás — y del cinturón, medio salida de la faltriquera, una ESQUIRLA DE RELIQUIA brillante que acaba de birlar.
>
> Las dos manos y los dos pies visibles y claramente legibles. Las dos dagas enteras dentro del encuadre.

### ThreeMice — Common · Archer · +25% Polvo de Estrellas

> Tres Ratones en un Abrigo — héroe común. Nadie ha preguntado nunca, y ellos no piensan aclararlo. Tiran a distancia.
>
> Una sola figura del alto de una persona menuda, hecha de TRES RATONES subidos uno encima de otro dentro de un abrigo largo: el de abajo sostiene, el del medio saca los brazos por las mangas, el de arriba asoma por el cuello. Encantadores y muy serios sobre su tapadera, sin posar para la cámara.
>
> Tres ratones grises de orejas grandes y redondas, hocicos rosados, ojos negros brillantes; el de arriba lleva un sombrero de copa pequeño ladeado y un monóculo.
>
> Un abrigo largo de lana verde oliva abotonado hasta arriba, con las mangas demasiado largas, un pañuelo al cuello y unas botas diminutas asomando por abajo. Una sola bolsita al hombro.
>
> Su arma es un ARCO CORTO diminuto sostenido por las dos manos del ratón del medio, bajado. Alrededor del cuello del abrigo escapan unas pocas MOTAS DORADAS de polvo de estrellas.
>
> Las manos que asoman de las mangas y las botas de abajo, visibles y claramente legibles. El arco entero dentro del encuadre. Que se lea como un personaje único, no como tres animales sueltos.

### Sellsword — Common · Warrior · +20% defensa de todo el grupo

> El Espadachín a Sueldo — héroe común, pagado por días y leal por horas. Aguanta la primera línea mientras le duren las monedas.
>
> Fibroso y de pie relajado, el peso en una pierna y el hombro apoyado en nada, mirando al espectador de reojo con media sonrisa cansada. Cínico y buena gente, ni heroico ni terrorífico, sin posar para la cámara.
>
> Pelo castaño recogido en una coleta baja, barba de tres días, piel tostada, ojos marrones, una cicatriz fina en el labio.
>
> Peto de cuero remachado sobre camisa gris remangada, una sola hombrera de placa abollada, cinturón con hebilla grande, pantalón de lona, botas gastadas. Una BOLSA de monedas bien visible en el cinturón, atada con doble nudo.
>
> Su arma es una ESPADA ANCHA en la mano derecha, apoyada al hombro. En el brazo izquierdo, un ESCUDO cuadrado abollado y repintado varias veces, bajado pero listo.
>
> Las dos manos y los dos pies visibles y claramente legibles. La espada entera dentro del encuadre.
