# Checklist de validación mecánica — layout residencial (JSON)

Reglas verificables mecánicamente sobre el JSON del layout (esquema documentado en SKILL.md, paso 7). Recorrelas TODAS, en orden, antes de entregar cualquier planta. Severidad: **[B] bloqueante** (corregir siempre) · **[A] advertencia** (corregir salvo justificación explícita en el brief).

## Convenciones geométricas para verificar

- **Área de un ambiente**: fórmula del polígono (shoelace) sobre `poligono`, en m².
- **Ancho útil de un ambiente**: lado menor del mayor rectángulo alineado a ejes inscrito en el polígono. En polígonos rectangulares equivale al lado menor del bounding box.
- **Tolerancia geométrica**: ε = 0.02 m salvo indicación distinta.
- **Adyacencia entre dos ambientes**: existen aristas de ambos polígonos paralelas y enfrentadas, con solape proyectado ≥ ancho de la puerta que los conecta y separación perpendicular ≤ 0.30 m (un espesor de muro + holgura).
- **Perímetro (fachada/medianera)**: bordes del rectángulo [0, `frente_m`] × [0, `fondo_m`].
- **Ambiente húmedo**: todo ambiente cuyo nombre empiece por "cocina", "baño" o "lavandería".
- **Ambiente habitable**: dormitorios, sala, comedor, sala-comedor, estudio. No habitables: cocina, baños, lavandería, hall, pasillo, depósito, terraza.

---

## CHK-01 [A] Área techada mínima por tipo de vivienda

- **Enunciado**: departamento para grupo familiar sin capacidad de ampliación: `area_techada` ≥ 40.00 m². Vivienda de uso colectivo: ≥ 16.00 m². Módulo básico ampliable: ≥ 25.00 m².
- **Verificación**: comparar `area_techada` contra el umbral del tipo declarado en el brief. Si el brief pide un compacto de inversión < 40.00 m² (existen en el mercado: 151 unidades ≤ 35 m², tipologias-lima.md §6), emitir advertencia indicando que debe tramitarse como vivienda de uso colectivo u otro formato, no como departamento estándar.
- **Fuente**: RNE A.020 Art. 8.1.a/b/c.

## CHK-02 [B] Envolvente consistente

- **Enunciado**: la planta cabe en su envolvente: `area_techada` ≤ `frente_m` × `fondo_m` × 1.02, y ningún vértice de ningún `poligono` sale del rectángulo [−ε, frente_m+ε] × [−ε, fondo_m+ε].
- **Verificación**: producto directo y barrido de todos los vértices.
- **Fuente**: consistencia interna del formato (tipologias-lima.md, ejemplares T01–T12).

## CHK-03 [B] Suma de áreas ≤ área techada

- **Enunciado**: Σ(áreas de todos los `ambientes`) ≤ `area_techada`. Además [A]: si Σ < 0.75 × `area_techada`, hay demasiada área muerta en muros/ductos (en los ejemplares reales la suma ronda 0.80–0.92 del área techada).
- **Verificación**: shoelace por ambiente, sumar, comparar.
- **Fuente**: definición de área techada; calibración contra tipologias-lima.md T01–T12.

## CHK-04 [B] Sin solapes entre ambientes

- **Enunciado**: los interiores de los polígonos de dos ambientes cualesquiera no se intersectan: área de intersección ≤ 0.01 m² para todo par.
- **Verificación**: intersección de polígonos par a par (clipping tipo Sutherland–Hodgman o test de rectángulos si todos son rectangulares); compartir borde es válido, compartir área no.
- **Fuente**: consistencia geométrica del plano (un punto pertenece a un solo ambiente).

## CHK-05 [B] Áreas y anchos útiles mínimos por ambiente

- **Enunciado**: cada ambiente cumple el mínimo de área y ancho útil de esta tabla (elegir fila por nombre; "óptimo" es meta de diseño, no umbral):

| Ambiente | Área mín (m²) | Ancho útil mín (m) | Óptimo (m²) | Fuente |
|---|---|---|---|---|
| sala-comedor (2D/3D) | 16.0 | 3.00 | 18–22 | Neufert p. 255–256 (comedor 6–8 pers. 3.00×2.40 + estar); tipologias-lima.md §7 |
| sala-comedor con kitchenette (1D) | 10.5 | 2.50 | 12–16 | tipologias-lima.md T01/T12 (11.3–15.9 m² construidos) |
| sala (independiente) | 11.0 | 3.00 | 13–16 | Neufert p. 299 (sala mínima 22 m² accesible → estándar compacto local); tipologias-lima.md T03 |
| comedor (independiente) | 8.0 | 2.70 | 10–12 | Neufert p. 255 (6 pers.: fondo ≥ 1.95 y 3.9 m² solo mesa + circulación) |
| dormitorio principal | 10.5 (9.5 si 1D ≤ 40 m²) | 2.90 (2.70 si 1D) | 12–13 | Neufert p. 257 (cama 2.00 + 0.75 por lado → frente 3.50); tipologias-lima.md §7 y T12 |
| dormitorio secundario | 6.5 | 2.40 | 8–10 | Neufert p. 257 (cama 0.90 + paso 1.00 + clóset 0.60 ≈ 2.50×2.60); tipologias-lima.md T09 |
| estudio | 6.0 | 2.20 | 7–9 | estándar de proyecto (reglas.js AMBIENTE.estudio) |
| cocina cerrada | 4.0 (5.0 si aloja el lavadero) | 1.40 | 8–10 | Neufert p. 254 (kitchenette 5–6 m², normal 8–10; dos frentes ancho 2.40); tipologias-lima.md T04/T06 (4.5 m² construidos) |
| baño completo (ducha+WC+lavatorio) | 2.4 | 1.20 | 3.4 | Neufert p. 263 (2.05×1.65; en fondo angosto 1.45×2.20) |
| baño de visita (WC+lavamanos) | 1.05 | 0.90 | 1.6 | Neufert p. 263 (0.90×1.15 en línea) |
| lavandería | 1.6 | 0.90 | 2.4–3.0 | Neufert p. 305 (lavadora 0.595 + zona de uso 0.33–0.41 al frente) |
| hall | 1.4 | 0.90 | 2–3 | Neufert p. 246 (distribuidor de 2 m² sirve 4 piezas); RNE A.020 Art. 13 |
| pasillo | — | 0.90 | ancho 1.00 | RNE A.020 Art. 13 (Cuadro 07) / A.010 Art. 20.b |
| terraza | — (recomendado ≥ 3.0) | — | 6–7 | Neufert p. 302 (balcones protegidos ≥ 3 m²) |

- **Verificación**: para cada ambiente, calcular área (shoelace) y ancho útil (rectángulo inscrito) y comparar con la fila correspondiente por nombre.
- **Nota**: estos umbrales están calibrados para NO rechazar los ejemplares reales T01–T12; los `aMin/wMin` de reglas.js son metas de dimensionado más holgadas, no umbrales de rechazo.

## CHK-06 [A] Proporción máxima de ambientes

- **Enunciado**: relación lado largo / lado corto del bounding box: dormitorios ≤ 2.0; sala/comedor/sala-comedor ≤ 2.6; cocina y lavandería ≤ 3.2; baños ≤ 2.4. Los pasillos y halls quedan exentos.
- **Verificación**: bounding box del polígono, dividir lados, comparar.
- **Fuente**: estándar de proyecto (reglas.js AMBIENTE.prop, redondeado hacia arriba para no rechazar ejemplares reales).

## CHK-07 [B] Programa y dotación sanitaria mínima

- **Enunciado**: (a) vivienda > 25 m²: existe ≥ 1 baño completo (inodoro + lavatorio + ducha); vivienda ≤ 25 m²: ≥ 1 baño con inodoro + ducha. (b) Existe el lavadero: hay un ambiente "lavandería", o una cocina ≥ 5.0 m² que lo aloja. (c) Existe función de cocinar: hay ambiente "cocina", o una "sala-comedor" ≥ 11.0 m² con kitchenette integrada (solo válido en 1D). (d) Hay ≥ 1 dormitorio y ≥ 1 ambiente social.
- **Verificación**: sobre los nombres de `ambientes` y sus áreas.
- **Fuente**: RNE A.020 Art. 23.1 (Cuadro 08) y Art. 3.1; tipologias-lima.md T01/T08/T12 (lavadero en cocina y kitchenette integrada como práctica real).

## CHK-08 [B] Iluminación natural ≥ 1/8 en habitables

- **Enunciado**: para cada ambiente habitable, Σ(`ancho` × `alto`) de sus `ventanas` ≥ área del ambiente / 8 (12.5%, criterio de proyecto; el piso normativo vigente es 10%).
- **Verificación**: agrupar `ventanas` por `ambiente`, sumar ancho×alto, comparar contra área/8.
- **Fuente**: criterio de proyecto (reglas.js VANO.iluminacion = 1/8), más exigente que el piso normativo RNE A.020 Art. 12.4 (≥ 10%) — ver advertencia en rne.md: el 1/8 proviene de norma derogada; se mantiene como estándar interno porque cumplirlo implica cumplir la norma vigente.

## CHK-09 [B] Ventilación ≥ 1/12 con abertura al exterior ≥ 5%

- **Enunciado**: para cada ambiente habitable, (a) Σ(`ancho` × `alto`) de sus ventanas ≥ área/12 (8.3%, vano de ventilación — queda implícito si pasa CHK-08, pero se verifica aparte porque una corrección de CHK-08 puede tocar solo una ventana); y (b) al menos una ventana individual cuya superficie OPERABLE ≥ 5% del área del ambiente (abertura al exterior).
- **Verificación**: (a) misma suma de CHK-08 comparada contra área/12. (b) Si el JSON no distingue hoja fija de operable, asumir corredera estándar al 50%: max(ancho×alto por ventana) × 0.5 ≥ 0.05 × área. Calibrado: los ejemplares T01–T12 pasan ambas.
- **Fuente**: criterio de proyecto (reglas.js VANO.ventilacion = 1/12, medido sobre el vano); piso normativo RNE A.010 Art. 38.2 / A.020 Art. 12.4 (abertura al exterior ≥ 5% de la superficie que se ventila).

## CHK-10 [B] Todo habitable tiene luz y ventana; los de servicio pueden no tenerla

- **Enunciado**: todo ambiente habitable tiene `luz: true` y ≥ 1 entrada en `ventanas`. Baños, lavandería, depósito, hall y pasillos pueden tener `luz: false` (ventilan por ducto u otros ambientes); la cocina puede tener `luz: false` (ilumina a través de otros ambientes) pero entonces debe ser adyacente (≤ 0.30 m) a un ambiente con `luz: true` o al perímetro.
- **Verificación**: cruce nombre-tipo contra `luz` y contra la lista de `ventanas`.
- **Fuente**: RNE A.020 Art. 11.1 y 11.3; RNE A.010 Art. 36.2 (cocinas y sanitarios pueden iluminar a través de otros ambientes); Neufert p. 133 (recintos sin ventana restringidos a cocinas, lavaderos, vestidores, duchas o baños).

## CHK-11 [B] Ventanas solo en fachada

- **Enunciado**: todo ambiente que aparezca en `ventanas` debe tener al menos una arista de su polígono a ≤ 0.30 m del perímetro del rectángulo frente×fondo (o de un pozo de luz declarado), con longitud ≥ el ancho de la ventana.
- **Verificación**: para cada ventana, buscar en el polígono del ambiente servido una arista casi coincidente con x≈0, x≈frente_m, y≈0 o y≈fondo_m (distancia ≤ 0.30) y longitud ≥ `ancho`.
- **Fuente**: física del edificio (no hay ventana a un ambiente interior); RNE A.020 Art. 11.1 (perforación en la envolvente).

## CHK-12 [B] Alféizares

- **Enunciado**: toda ventana tiene `alfeizar` ≥ 1.00 m; se admite `alfeizar` < 1.00 solo si el ambiente servido conecta por puerta a una terraza propia (mampara de piso a techo, tramo bajo con vidrio fijo templado o baranda) o si es primer nivel con jardín.
- **Verificación**: `alfeizar` ≥ 1.00 − ε; si no, verificar en `puertas` que exista conexión ambiente→terraza.
- **Fuente**: RNE A.020 Art. 12.5.c; tipologias-lima.md T06 (mampara alfeizar 0.0 a terraza como caso legítimo).

## CHK-13 [B] Accesibilidad total desde el ingreso (grafo de puertas)

- **Enunciado**: construyendo un grafo cuyos nodos son "exterior" + todos los `ambientes.nombre` y cuyas aristas son las `puertas`, TODO ambiente es alcanzable desde "exterior". Además: existe exactamente una puerta con `de: "exterior"` (salvo brief con ingreso de servicio), y todo `de`/`a` referencia un nombre existente.
- **Verificación**: validar referencias, BFS/DFS desde "exterior", ningún nodo sin visitar.
- **Fuente**: RNE A.010 Art. 17 (circulación y evacuación); consistencia del formato.

## CHK-14 [B] Las puertas conectan ambientes físicamente adyacentes

- **Enunciado**: para cada puerta interior, los polígonos de `de` y `a` son adyacentes (aristas paralelas enfrentadas, separación ≤ 0.30 m, solape ≥ `ancho` de la puerta). La puerta de "exterior" exige que el ambiente `a` toque el perímetro.
- **Verificación**: test de adyacencia de la sección de convenciones, por puerta.
- **Fuente**: consistencia geométrica del plano (una puerta vive en un muro compartido).

## CHK-15 [B] Anchos mínimos de puertas

- **Enunciado**: `ancho` ≥ 0.90 m si `de: "exterior"` (acceso principal a la unidad); ≥ 0.80 m si `a` es dormitorio, sala, comedor, sala-comedor, estudio, cocina, lavandería, hall, pasillo o terraza; ≥ 0.70 m si `a` es baño. Altura de vano: 2.10 m (implícita, no está en el JSON).
- **Verificación**: clasificar `a` por nombre y comparar `ancho` contra el umbral.
- **Fuente**: RNE A.020 Art. 12.2.a-b (Cuadro 06): 0.90 acceso / 0.80 descanso-reunión-alimentación / 0.70 aseo y servicios; altura 2.10.

## CHK-16 [B] Ancho de pasillos y halls ≥ 0.90 m

- **Enunciado**: todo ambiente llamado "pasillo" o "hall" tiene ancho útil ≥ 0.90 m entre paramentos.
- **Verificación**: ancho útil (rectángulo inscrito) ≥ 0.90 − ε.
- **Fuente**: RNE A.020 Art. 13 (Cuadro 07) / A.010 Art. 20.b; Neufert p. 245 (pasillo de vivienda 0.90–1.00).

## CHK-17 [A] Circulación ≤ 10% del área techada

- **Enunciado**: Σ(áreas de pasillos + halls) ≤ 0.10 × `area_techada`.
- **Verificación**: sumar áreas de los ambientes de circulación, dividir por `area_techada`.
- **Fuente**: tipologias-lima.md §7 (circulación objetivo < 10%; los ejemplares reales rinden 0–8%).

## CHK-18 [B] Privacidad del baño (viviendas de 2+ dormitorios)

- **Enunciado**: en viviendas con ≥ 2 dormitorios, al menos un baño es alcanzable desde "exterior" en el grafo de puertas SIN atravesar ningún dormitorio. En 1D se admite el baño en suite como único baño.
- **Verificación**: BFS desde "exterior" excluyendo los nodos dormitorio; algún baño debe quedar alcanzable.
- **Fuente**: RNE A.020 Art. 10.2 (privacidad en el uso de los servicios higiénicos); Neufert p. 266 (baño desde el dormitorio solo si existe otro WC accesible desde el corredor).

## CHK-19 [B] Húmedos apilados al muro húmedo

- **Enunciado**: el campo `muro_humedo` es obligatorio, y todo ambiente húmedo (cocina, baños, lavandería) tiene distancia mínima polígono→segmento `muro_humedo` ≤ 0.30 m (en ningún caso > 1.00 m: el WC no puede alejarse más de eso de la montante). Además [A]: cada húmedo debería tener una arista con solape proyectado ≥ 0.60 m sobre el segmento (frente útil para colgar aparatos); tocar solo la esquina/extremo del muro húmedo (cocinas de T05/T07) se admite justificando que el aparato más lejano queda a ≤ 1.00 m de la montante.
- **Verificación**: mínimo de la distancia punto-segmento entre todos los vértices/aristas del polígono y el segmento `muro_humedo` (≤ 0.30 → pasa [B]); proyección del polígono sobre la dirección del segmento para el solape [A]. Calibrado: los 12 ejemplares pasan el [B].
- **Fuente**: Neufert p. 266 y 277 (baño, WC y cocina comparten ductos; todos los servicios en un solo montante vertical); Neufert p. 57 (WC a máx. 1.00 m de la bajante); RNE A.020 Art. 23.3 (montantes en ductos exclusivos o muros divisorios).

## CHK-20 [B] Espesores y coherencia de muros

- **Enunciado**: todo muro tiene `espesor` ∈ {0.15, 0.25}; todo muro de 0.25 tiene `portante: true`. Los polígonos de ambientes retranquean respecto del eje del muro ≥ espesor/2 (la cara interior no cruza el eje).
- **Verificación**: barrido de `muros`; para la coherencia geométrica, verificar que ningún eje de muro atraviese el interior de un polígono en más de ε.
- **Fuente**: convención de proyecto (0.15 tabique interior / 0.25 fachada-portante en albañilería confinada limeña), consistente con los ejemplares de tipologias-lima.md.

## CHK-21 [B] Alturas libres

- **Enunciado**: altura libre piso terminado–cielo raso ≥ 2.30 m en todos los ambientes; en baños se admite ≥ 2.10 m; bajo vigas ≥ 2.10 m. El estándar de proyecto es 2.40 m.
- **Verificación**: si el JSON incluye `altura_libre` (global o por ambiente), comparar contra 2.30 / 2.10; si el campo no existe, se asume la altura de proyecto 2.40 m y la regla se da por cumplida — pero debe declararse en la memoria del diseño.
- **Fuente**: RNE A.020 Art. 9.1 y 9.3 / A.010 Art. 18.1 y 18.3; estándar de proyecto 2.40 (reglas.js ALTURA.libreMin).

---

## Cómo reportar

Al validar, emitir una tabla `CHK-XX | PASA/FALLA | detalle` con el valor medido y el umbral. Todo [B] que falle se corrige y se re-valida el checklist completo (una corrección puede romper otra regla). Los [A] que se dejen pasar se justifican en una línea.
