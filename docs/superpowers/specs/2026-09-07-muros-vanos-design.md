# Muros y vanos derivados — diseño

_2026-09-07_

## 1. Problema

El modelo de datos del plano tiene **ambientes** (polígonos) y **objetos** (muebles). No tiene
muros ni vanos. Tres síntomas, una sola causa:

1. **Muros superpuestos.** Un muro es el contorno de un polígono. Dos ambientes vecinos comparten
   una arista y cada uno la dibuja por su cuenta: dos trazos sobre el mismo eje.
2. **Espacios inaccesibles.** Todo polígono es cerrado y no existe la noción de vano. El plano es
   un conjunto de celdas selladas. **Tweedledum no puede evitarlo**: el prompt le exige un
   `poligono` por ambiente y ese es todo su vocabulario. El software lo obliga a cerrar los muros.
3. **Las puertas no se acomodan al muro.** Una puerta es un item del catálogo con `x`, `y`, `rot`,
   igual que un sofá. Nada la ata a una arista.

Diagnóstico del dueño del producto, que es arquitecto. Es correcto y es de raíz.

## 2. Objetivo

Que el motor **derive** los muros de la geometría de los ambientes y **abra los vanos donde la
circulación y la iluminación los exigen**, sin cambiar el contrato con Tweedledum.

Misma filosofía que ya funcionó con el parti: **el agente decide, el motor materializa.**
Tweedledum dice qué ambientes hay y cómo se tocan; el motor deduce los muros y abre las puertas.

## 3. Alcance

**Entra:** el grafo de muros de la planta típica completa (unidades + núcleo + corredores),
su clasificación, y la colocación automática de puertas y ventanas. El dibujo de todo eso.

**No entra:** muros de primera clase (que el ambiente se defina *por* sus muros, como un CAD).
Eso reescribe el editor, el validador y el materializador; es otra conversación. Tampoco entran
espesores reales de muro portante ni estructura.

## 4. El modelo

Dos colecciones **derivadas** — no se editan a mano, se recalculan:

    muro = { id, a: {x,y}, b: {x,y}, clase, lados: [roomId] , largo }
    vano = { id, muroId, t, ancho, tipo, entre: [roomId, roomId|null] }

`t` es la distancia en metros desde `a`. Un vano vive **sobre** un muro: no puede existir fuera
de uno, y ahí muere el síntoma 3.

## 5. Fusión de aristas

No alcanza con comparar extremos: el caso común es el **solape parcial** — un muro largo de
corredor contra tres muros de unidad.

1. Recoger toda arista de todo ambiente, con el ambiente al que pertenece.
2. Agrupar por **recta infinita**: dirección normalizada + distancia al origen, cuantizadas a 1 cm.
3. Dentro del grupo, proyectar cada arista a la coordenada 1-D de la recta y **partir por todos
   los extremos**. Cada tramo elemental queda con la lista de ambientes que lo cubren.
4. Un tramo cubierto por dos ambientes es un muro compartido; por uno, un muro de borde.

**Tolerancias:** 1 cm de desvío lateral para considerar dos aristas colineales; un solape menor a
**0.30 m** no es muro compartido sino un toque de esquina.

## 6. Clasificación

Por número de ambientes que cubren el tramo:

**Dos ambientes** — según a qué pertenecen:
- misma unidad → `interior`
- unidad ↔ corredor o núcleo → `a_corredor`
- unidad ↔ otra unidad → `entre_unidades` (medianera acústica, **nunca se abre**)

**Un ambiente** — según dónde cae contra la huella:
- sobre el borde de la huella y es fachada a calle → `fachada`
- sobre el borde de la huella y es límite de propiedad → `medianera` (**nunca se abre**)
- contra un `void` llamado `patio` → `fachada_patio`

`fachada_patio` importa: el patio existe justamente para dar luz a los ambientes interiores.
A efectos de ventanas cuenta como fachada.

## 7. Puertas — la regla de conectividad

Es la parte que mata el síntoma 2, y lo mata **por construcción**, no detectándolo.

1. Cada unidad recibe **una entrada**: un vano sobre el muro `a_corredor` más largo.
2. Dentro de la unidad se arma el grafo de adyacencia sobre los muros `interior`.
3. Desde el ambiente de entrada se calcula un **árbol de recubrimiento**. Cada arista del árbol
   recibe una puerta.
4. Ancho por destino: baño 0.80, dormitorio 0.80, cocina 0.90, social 1.00.
5. Posición: centrada en el muro, respetando **0.15 m mínimo** contra cada extremo. Si el muro no
   admite el ancho, se prueba el siguiente muro compartido entre esos dos ambientes; si ninguno
   sirve, es un **hallazgo**, no un silencio.

Un ambiente que el árbol no alcanza —porque no toca nada— es un hallazgo explícito.

## 8. Ventanas

- Piden luz: dormitorio, sala, comedor, cocina, estudio. No piden: baño, clóset, pasillo, depósito.
- Van sobre el muro `fachada` o `fachada_patio` más largo de ese ambiente.
- Nunca sobre `medianera` ni `entre_unidades`.
- **Ancho:** se elige del catálogo existente por área del ambiente. Esto es una **aproximación
  declarada, no una afirmación normativa**: se registra como `assumption`, nunca como cumplimiento
  de RNE. Ninguna parte del sistema puede declarar conformidad sin evidencia verificada.
- Un ambiente que pide luz y no tiene ningún muro de fachada es un **hallazgo**. Es el mismo error
  que los espacios inaccesibles, pero de iluminación, y hoy pasa callado.

## 9. Dibujo

El lienzo deja de dibujar el contorno de cada ambiente y pasa a dibujar **la colección de muros**.
Ahí muere el síntoma 1: un tramo compartido es un solo muro y se dibuja una sola vez.

Los vanos se dibujan como interrupción del trazo más el símbolo que ya existe en `simbolos.jsx`.

## 10. Migración

Los items existentes de categoría `abertura` quedan obsoletos: los vanos ahora son derivados. Al
construir el grafo se descartan y **se reporta cuántos**. El mobiliario no se toca.

## 11. Pruebas

- Dos ambientes que comparten una arista completa producen **un** muro, no dos.
- Solape parcial: un muro de 9 m contra tres de 3 m produce tres tramos compartidos.
- Un toque de esquina de 0.10 m **no** es muro compartido.
- Una planta de cuatro ambientes en fila queda toda alcanzable desde la entrada.
- Un ambiente sin adyacencia produce hallazgo, no un plano mudo.
- Un baño nunca recibe ventana a medianera.
- La suma de largos de muro no crece al fundir: fundir quita trazo, no lo agrega.

## 12. Riesgo conocido

La fusión por recta infinita es sensible a la tolerancia. Con 1 cm, dos muros a 1.5 cm quedan sin
fundir y se ven dobles; con 5 cm, dos muros realmente distintos se funden y se pierde un ambiente.
Se empieza en 1 cm y se mide contra plantas reales antes de moverlo.
