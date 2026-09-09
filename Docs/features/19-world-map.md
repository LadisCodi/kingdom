# World Map

Mapa multijugador compartido por todos los jugadores, donde se desarrolla el aspecto competitivo PvP del juego. Está dividido en hexágonos ocultos por niebla que cada jugador debe explorar para revelar.

Usa de referencia la imagen en `Docs/art/world-map-layout.png`.

![[../art/world-map-layout.png]]

**Tamaño**. 5 hexágonos de radio desde el centro.
**Jugadores**. 6 jugadores con casillas equidistantes entre ellos
**Centro**. Reservado para el Portal Oscuro, no jugable

## Estructura del mapa

El mapa se organiza en anillos concéntricos desde el centro, cada uno con un papel distinto:

| Anillo       | Casillas | Papel                                                                   |
| ------------ | -------- | ----------------------------------------------------------------------- |
| 0 (centro)   | 1        | Portal Oscuro. Vacío permanente, no conquistable                        |
| 1 (interior) | 6        | Zona caliente. Bonus de adyacencia al portal (+200% producción)         |
| 2            | 12       | Corredores. Terreno de paso entre ciudad y anillo interior              |
| 3            | 18       | Ciudades de los jugadores (6 posiciones equidistantes) + terreno propio |
| 4 (exterior) | 24       | Mazmorras, Santuarios y recursos raros                                  |

Desde su ciudad en el anillo 3, un jugador está a 3 casillas del centro: necesita reclamar dos casillas de corredor en el anillo 2 para poder reclamar una del anillo 1. El anillo interior es rico pero exige un corredor expuesto; el exterior es pobre en producción pero tiene lo que la producción no compra.

## Asignación de jugadores

El mapa tiene hueco para 6 jugadores. Si entraran más jugadores hay que crear otra instancia del mapa y asignar al jugador a esa otra instancia. Para el prototipo actual esto es suficiente.

La posición asignada es aleatoria, siempre que esté libre en esa instancia del mapa.

## Niebla y exploración

Las casillas del mapa están ocultas por niebla de guerra; solo la casilla donde está su ciudad y la casilla del Portal Oscuro están reveladas inicialmente.

El jugador puede revelar más casillas alrededor suya invirtiendo oro y tiempo. El proceso es el siguiente:

1. Pulsa sobre una casilla cubierta por niebla. Un menú de información de casilla se abre.
2. Como la casilla no está descubierta, el menú solo muestra la opción de explorarla a cambio de oro y tiempo (escalan con la distancia a la ciudad del jugador).
3. Al pulsar el botón de explorar se pagan los costes y empieza el contador de exploración.
4. El menú de la casilla da la opción de terminar la exploración al instante con gemas.
5. Cuando termina la exploración se avisa al jugador usando uno de los banners de notificaciones.

El escalado del coste con la distancia es lo que hace caro el anillo exterior. No hace falta ningún otro freno.

## Anatomía de la casilla

Cada casilla del mundo está definida por lo siguiente, siguiendo el diseño del mapa de la provincia:

- **Tipo de terreno**: pradera, llanura, desierto, etc.
- **Lista de Features**: al contrario que las casillas de la provincia, una casilla del mundo puede tener 0...N features a la vez, ya que son más grandes.
- **Control**: neutral o de un jugador concreto.
- **Estado de conexión**: activa o inactiva (solo aplica a casillas controladas).

## Control de casillas

Cada casilla del mundo puede estar bajo el control de un jugador o ser neutral. Por defecto las casillas son neutrales. La casilla de la ciudad de un jugador es siempre suya, siempre está activa y no puede ser atacada.

**La adyacencia siempre es obligatoria.** Un jugador solo puede tomar el control de una casilla que sea adyacente a otra casilla suya activa.

### Reclamar una casilla neutral

- **Casilla neutral sin construcciones**: se reclama construyendo un Puesto de Avanzada, pagando su coste y su tiempo.
- **Casilla neutral con construcciones** (perteneció a alguien y quedó libre): el Puesto de Avanzada ya está construido, así que basta con llevar el ejército para reclamarla. Se toma el control de las construcciones que hubiera.

### Atacar una casilla enemiga

- Cada casilla se ataca de forma individual. No hay cascada: derrotar al defensor de una casilla no afecta al control de las demás casillas de ese jugador.
- Si el atacante gana y la casilla es adyacente a una casilla suya activa, toma el control de la casilla y de sus construcciones. Las construcciones no se destruyen, cambian de manos.
- Si el atacante gana y la casilla **no** es adyacente a territorio suyo, el defensor pierde la casilla, que pasa a neutral con sus construcciones en pie, pero el atacante no la reclama. Sus tropas regresan a su ciudad al terminar el ataque.

Esto da dos jugadas distintas con el mismo botón: el **ataque de conquista**, que exige haberse expandido hasta el objetivo y da botín, y el **ataque de negación**, que solo cuesta un ejército y un viaje y sirve para dejar terreno libre. El terreno que queda neutral está al alcance de cualquiera que tenga una casilla al lado, así que negar puede beneficiar a un tercero.

El freno al conflicto continuo no es una regla que lo prohíba, es el coste en tropas. Ver _Balanceo_.

## Conexión

Toda casilla controlada necesita una cadena de casillas propias y activas, adyacentes entre sí, que llegue hasta la casilla de su ciudad.

- La ciudad es la raíz y nunca se desconecta.
- La casilla del Portal Oscuro es un vacío: es transitable para el movimiento de tropas, pero **no conduce conexión** y no cuenta como casilla propia para ningún efecto.
- Una casilla inactiva no conduce conexión: no se puede reconectar una rama a través de otra rama caída.

### Casillas inactivas

Cuando una casilla pierde la cadena hasta la ciudad, **no se pierde: queda inactiva**. Mientras esté inactiva:

- Sus mejoras no producen nada.
- No otorga el bonus del anillo interior ni el efecto pasivo de sus features (Santuario incluido).
- No sirve para reclamar casillas adyacentes ni para conducir conexión.
- Sigue siendo del jugador. Sus construcciones permanecen intactas.
- Puede ser atacada con normalidad, y el jugador que la ataque sigue necesitando adyacencia para tomarla.

El recálculo es inmediato y en un solo paso: al cambiar el control de cualquier casilla se recalcula la conexión de todo el territorio afectado de una vez, no casilla por casilla ni por tick. Reconectar una casilla la reactiva al instante, sin coste ni tiempo.

Cortar un corredor apaga la economía de todo lo que hay detrás, pero no regala el terreno: para quedárselo hay que ir tomando las casillas una a una. En una cuadrícula hexagonal cada casilla tiene 6 vecinas, así que un corredor con una sola casilla de redundancia no se corta con un solo ataque. Cortar es una operación deliberada de varias casillas, no un accidente.

## Construir mejoras

Se pueden construir mejoras en las casillas que ya controla el jugador. Antes de poder construir mejoras es necesario construir primero un Puesto de Avanzada para reclamar la casilla, y a partir de ese punto se pueden construir mejoras (si se cumplen los requisitos).

### Listado de mejoras

- **Puesto de Avanzada**. Toma el control de la casilla y permite construir el resto de mejoras.
- **Aserradero**. Otorga Wood a la ciudad principal cada hora. Debe construirse en una casilla con Bosque.
- **Granja**. Otorga Food a la ciudad principal cada hora. Debe construirse en una casilla sin ninguna feature.
- **Cantera**. Otorga Stone a la ciudad principal cada hora. Debe construirse en una casilla con Montaña.
- **Fortaleza**. Permite estacionar tropas en la casilla, que defienden la casilla y las adyacentes. Un enemigo no puede tomar control de esa casilla ni de las adyacentes mientras haya tropas aquí. La Fortaleza puede ser atacada directamente, con sus tropas como defensoras: es la forma de romper el bloqueo.

## Bonus del anillo interior

Las 6 casillas adyacentes al Portal Oscuro otorgan **+200% de producción** a las mejoras construidas sobre ellas.

- El bonus es permanente, no depende de que el portal esté abierto.
- Solo se aplica si la casilla está activa.

Es el mejor terreno del mapa y el más caro de sostener: está a dos casillas de corredor de cualquier ciudad y a una casilla de las cinco rivales.

## Features

Una casilla puede tener 0...N features. Algunas permiten construir mejoras de un tipo en la casilla, otras otorgan un efecto pasivo al controlar la casilla y otras son mazmorras que permiten enviar expediciones para conseguir recursos únicos.

- **Bosque**. Permite construir el Aserradero y obtener madera de la casilla.
- **Tierra fértil**. Si se construye una Granja aquí para obtener comida, da comida adicional.
- **Animales**. Si se construye una Granja aquí para obtener comida, da comida adicional.
- **Mazmorra**. Defendida por unidades enemigas. Una vez despejada de enemigos se pueden enviar expediciones para profundizar en sus misterios. Solo aparece en el anillo exterior.
- **Santuario**. Aumenta tu capacidad de maná máximo mientras controles su casilla y esté activa. Solo aparece en el anillo exterior.

## Generación

El contenido de las casillas se genera de forma aleatoria, con las siguientes reglas:

- Las casillas designadas para la aparición de jugadores serán siempre Pradera sin ninguna feature.
- Al menos una casilla alrededor de la ciudad de cada jugador debe contener Pradera + Bosque.
- Al menos una casilla alrededor de la ciudad de cada jugador debe contener Pradera y ninguna feature.
- Ninguna casilla alrededor de la ciudad del jugador puede contener mazmorras.
- **El anillo interior (6 casillas) no es aleatorio: se autora a mano.** Debe garantizar que las seis casillas valgan algo y que sean distintas entre sí. Reparto propuesto: 2 con Bosque, 2 vacías (una de ellas con Tierra fértil), 2 con Montaña.
- Mazmorras y Santuarios solo en el anillo exterior.

## Portal Oscuro

Evento por tiempo limitado que ocurre en la casilla central del mapa. Rise of Kingdoms no tiene un equivalente directo de mazmorra por profundidad, así que esta parte no sigue su modelo: la referencia es la Endless Tower de Infinity Kingdom.

### La casilla

La casilla central es un accidente permanente del mapa, no un spawn aleatorio:

- Sin tipo de terreno y sin features.
- Nunca controlable ni construible por nadie.
- Revelada siempre para todos, sin niebla.
- Transitable para el movimiento de tropas, pero no conduce conexión ni cuenta como casilla propia.
- Entre eventos muestra el portal apagado y un contador hasta la próxima apertura.

### Cadencia

Ciclo de 7 días: 3 días abierto, 4 días cerrado, arrancando siempre el mismo día de la semana. La cita fija es más valiosa que la sorpresa.

### Mecánica

- Al abrirse, todos los jugadores del mapa reciben una notificación.
- Todos los jugadores pueden participar, con independencia de dónde tengan su territorio.
- La mazmorra tiene **profundidad máxima** (30-50 niveles, ajustar para que nadie la agote en un evento).
- Se avanza nivel a nivel, sin saltos.
- **3 intentos al día**, que se reponen a una hora fija. Un intento solo se consume si el jugador supera el nivel: fallar no cuesta intento.
- Bajar cuesta bajas de tropas, y recuperarlas lleva tiempo. Mientras la expedición está en curso el ejército está ocupado y no defiende el mapa.
- Ranking por la profundidad más honda alcanzada. **Desempate por tiempo**: gana quien llegó antes.

El límite de intentos es lo que evita que el ranking mida horas de sofá en lugar de fuerza y decisiones, y estira el evento sus tres días completos en lugar de resolverse la primera noche. En producción es también el punto de venta natural de gemas (intentos extra), mejor que vender "terminar al instante".

### Premios

- **Por profundidad**: premio inmediato al superar cada nivel. Es la vía principal y hace que participar rente aunque no se compita.
- **Por hito**: premio exclusivo para el primer jugador que alcanza ciertas profundidades. Se resetea cada evento.
- **Por ranking al cerrar**: Top 1 / Top 2-3 / Top 4-6.

## Balanceo

El ejército es el recurso más solicitado del mapa: toma casillas neutrales, ataca al rival, defiende corredores, recoge casillas libres y baja al portal. Todo con las mismas tropas.

Por eso **el número de ejércitos disponibles y el tiempo de recuperación de bajas son la palanca principal de balanceo de todo el mapa**. Cuando algo se sienta mal (demasiado conflicto, demasiado poco, el portal comiéndose la atención), ese es el número que hay que tocar, no el +200% ni los costes de exploración.
