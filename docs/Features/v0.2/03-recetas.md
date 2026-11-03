# Spec 03 · Recetas y «qué puedo cocinar»

**Cubre:** N-17, N-18
**Estado:** **diseño para explorar.** No es una spec lista para implementar: hay dos decisiones de
modelo que hay que tomar antes, y las dos cambian el coste de forma importante.
**Toca la BD:** sí, tablas nuevas.

## Qué pediste

> Me gustaría explorar el poder tener o cargar mis recetas con sus cantidades y que la app me diga
> qué recetas puedo hacer con lo que tengo en el congelador y para cuáles no hay materiales.

Son tres cosas, y la tercera es la difícil:

1. Guardar tus recetas con sus ingredientes y cantidades.
2. Decirte qué puedes cocinar con lo que hay.
3. Decirte qué falta para el resto.

## Los dos problemas de fondo

Esto no es difícil por la pantalla. Es difícil por dos desajustes entre lo que una receta dice y
lo que la aplicación guarda. Conviene verlos antes de elegir nada.

### Problema 1 · Una receta habla de ingredientes, el inventario de productos

El inventario está indexado por **EAN**: no tienes «harina», tienes `8410128750121 · Harina Gallo
1 kg`. Una receta no dice eso, dice «200 g de harina».

Hace falta algo en medio: un **ingrediente** que puede satisfacerse con varios productos. Es
exactamente el *parent product* de Grocy, y existe por este motivo.

| Opción | Cómo | A favor | En contra |
|---|---|---|---|
| **A** | El ingrediente **es** un EAN. La receta apunta al producto concreto que compras | Nada de modelo nuevo. Mucho menos código. Funciona hoy: compráis un conjunto pequeño y repetido de productos | Se rompe en cuanto cambias de marca o Mercadona cambia de proveedor. La receta se queda apuntando a algo que ya no compras, y la aplicación dice que no puedes cocinar algo que sí puedes |
| **B** | El ingrediente es **texto libre**, cruzado por nombre | Nada de modelo nuevo | Falla en silencio, que es el peor fallo posible: te dice que no tienes algo que tienes. «Pechuga de pollo» no cruza con «Pollo pechuga fileteado» |
| **C** | Tabla `ingredients`, y una tabla que la une a **uno o varios EAN** | Es el modelo correcto. Cambiar de marca es añadir un EAN al ingrediente, y las recetas siguen funcionando | Dos tablas más y una pantalla para gestionarlo |

**Mi recomendación: C, con la interfaz de A.** Es decir: el modelo lleva la tabla de ingredientes
desde el principio, pero al montar una receta **eliges productos de tu despensa**, y la aplicación
crea el ingrediente por detrás con ese producto ya vinculado. No tienes que pensar en
«ingredientes» para nada; aparecen solos.

El motivo de no empezar por A: migrar de A a C después obliga a rehacer todas las recetas a mano,
y cambiar de marca es algo que pasa cada pocos meses, no cada años.

### Problema 2 · Las cantidades no son comparables

La receta dice «200 g de harina». El inventario dice «1 unidad» de un paquete. Para saber si te
llega hace falta saber que el paquete trae 1 kg, y eso la aplicación no lo sabe de forma fiable:
`quantity_desc` viene de OpenFoodFacts como texto libre (`"1 kg"`, `"500g"`, `"6 x 125 g"`).

Esto es el problema de conversión de unidades de Grocy, y en la propuesta general lo marqué como
**no recomendado** (N-22): mucha complejidad para una casa.

Salida en dos niveles:

| Nivel | Qué contesta | Coste |
|---|---|---|
| **1 · Presencia** | «¿Tengo harina, sí o no?» Ignora la cantidad | Bajo |
| **2 · Cantidad real** | «¿Tengo 200 g de harina?» Necesita unidad por ingrediente, tamaño de envase y conversiones | Alto, y hay que mantener el tamaño de envase a mano |

**Mi recomendación: nivel 1, guardando la cantidad.** O sea: escribes «200 g de harina», la
aplicación **lo guarda y te lo muestra** al cocinar y en lo que falta, pero la pregunta «¿puedo
cocinar esto?» se responde solo por presencia.

Es el 80 % del valor por el 20 % del trabajo: a las nueve de la noche quieres saber si tienes
pollo, no si tienes 450 g exactos. Y guardar la cantidad desde el principio deja la puerta
abierta al nivel 2 sin rehacer nada.

**Pero hay que decirlo claro en la pantalla**, o la aplicación miente: si dice «puedes hacer esto»
porque te queda un dedo de harina, deja de ser fiable, y una aplicación de inventario vive de que
te la creas. Propuesta: las recetas posibles se presentan como **«Tienes los ingredientes»**, no
como «Puedes cocinar esto».

## Modelo propuesto

Tres tablas nuevas, migración `0003`:

```text
recipes 1 ──── n recipe_ingredients n ──── 1 ingredients 1 ──── n ingredient_products
                                                                      │
                                                            products.ean (ya existe)
```

| Tabla | Columnas |
|---|---|
| `recipes` | `id`, `name`, `servings?`, `notes?`, `created_at`, `updated_at` |
| `ingredients` | `id`, `name` (único, normalizado en minúsculas para no duplicar) |
| `ingredient_products` | `ingredient_id`, `ean` → `products.ean`. Clave primaria compuesta |
| `recipe_ingredients` | `id`, `recipe_id`, `ingredient_id`, `amount?`, `unit?`, `optional`, `deducts` |

Dos banderas de `recipe_ingredients` que merecen explicación, porque resuelven casos reales:

- **`optional`**: el perejil no debe impedir que la receta salga como posible. Sin esto, cualquier
  receta con una especia aparece siempre como imposible y la pantalla no sirve.
- **`deducts`**: si marcas una receta como cocinada, de la sal y del aceite **no** se descuenta
  nada. Descontar «1 unidad» de todo es lo que haría una implementación ingenua, y dejaría el
  inventario peor que antes. Por defecto: `false` para lo que no se gasta por unidades.

## Comportamiento

### Pantalla «Recetas»

- Lista de tus recetas, con un **semáforo** por receta: cuántos ingredientes tienes de cuántos.
- Dos grupos, y este orden importa: **«Tienes los ingredientes»** primero, **«Te falta algo»**
  después, ordenado por lo poco que falta. La receta a la que le falta una cosa es la interesante.
- Filtro **«Solo con lo del congelador»**, que es lo que pediste: solo cuenta como disponible lo
  que está en `location = "freezer"` con cantidad por encima de 0.

### Detalle de una receta

- Nombre, raciones, notas.
- Lista de ingredientes. Por cada uno:
  - La cantidad tal como la escribiste: `200 g`.
  - **Si lo tienes: dónde está.** `Congelador · Cajón 2` o `Despensa`. Esto sale gratis del
    inventario y es la mitad de la utilidad real: saber que lo tienes y no encontrarlo es casi
    igual que no tenerlo.
  - Si no lo tienes: marcado como que falta.
  - Los opcionales, señalados como tales.
- Botón **«Lo he cocinado»**: descuenta los ingredientes con `deducts = true`.
  - Con el nivel 1 descuenta **1 unidad** de cada uno. Por eso `deducts` existe y por eso viene
    apagado por defecto en lo que no se gasta por unidades.
- Botón **«Añadir lo que falta a la lista»**: aquí choca con que la lista de la compra es
  **derivada** del stock y no admite ítems sueltos. Depende de **D3** (Spec 01). Mientras D3 no se
  resuelva, este botón no se puede hacer bien, y es mejor no ponerlo que ponerlo a medias.

### Crear una receta

- Nombre, raciones, notas.
- Añadir ingredientes **buscando en tu despensa** (reutiliza `useSearchProducts`, que ya existe).
  Eliges el producto, y la aplicación crea o reutiliza el ingrediente por detrás.
- Para algo que no tienes nunca en stock (una especia), se puede crear el ingrediente por nombre
  sin producto asociado.
- Cantidad y unidad como texto, con `parseDecimal` para la cantidad, igual que el resto de la
  aplicación.

### «Cargar» recetas

Dijiste «tener o cargar». Tres niveles, de menos a más:

| Opción | Coste | Juicio |
|---|---|---|
| Escribirlas en la aplicación | incluido arriba | Para 20 platos habituales es una tarde y ya está |
| **Pegar texto** y que separe las líneas en ingredientes para que los revises | **M** | Buen punto medio: pegas la receta del móvil y solo corriges |
| Importar de una URL | **L** | Es lo que hacen KitchenOwl, Mealie y Tandoor. Scraping frágil, se rompe por sitio. **No lo recomiendo de entrada** |

Mi recomendación: empezar escribiéndolas, y añadir el pegado de texto si escribirlas resulta pesado.

## Lo que esto cuesta

| Parte | Coste |
|---|---|
| Migración y modelo (3 tablas) | **M** |
| Endpoints de recetas (CRUD) y el cálculo de disponibilidad | **M** |
| Pantalla de lista con los dos grupos y el filtro de congelador | **M** |
| Pantalla de detalle con ubicaciones y «lo he cocinado» | **M** |
| Pantalla de crear y editar | **M** |
| **Total** | **L.** Es la iteración entera, no un añadido |

El cálculo de disponibilidad va en un servicio nuevo, `RecipeAvailabilityService`, no en el router
ni en el repositorio: es una regla de negocio, como `ShoppingListService`.

## Decisiones antes de implementar

| # | Pregunta | Mi propuesta |
|---|---|---|
| **D9** | ¿Ingrediente como EAN (A), texto (B) o tabla propia (C)? | **C con la interfaz de A.** Eliges productos de tu despensa y los ingredientes se crean solos |
| **D10** | ¿Disponibilidad por presencia (nivel 1) o por cantidad real (nivel 2)? | **Nivel 1**, guardando la cantidad para mostrarla. Y decir «tienes los ingredientes», no «puedes cocinar esto» |
| **D11** | ¿Antes o después de las recetas, resolvemos D3 (ítems sueltos en la lista)? | **Antes.** «Añadir lo que falta a la lista» es la mitad del valor de las recetas, y sin D3 no se puede hacer |
| D12 | ¿Pegado de texto en la primera versión? | No. Escribe tres recetas a mano primero; si resulta pesado, lo añadimos sabiendo ya qué formato pegas |

## Fuera de alcance

| Qué | Por qué |
|---|---|
| Importar recetas de una URL | Frágil, un scraper por sitio |
| Menú semanal | Es N-19, y solo sirve si planificáis |
| Escalar cantidades por raciones | Depende del nivel 2 |
| Conversión de unidades (g ↔ unidad ↔ paquete) | Es N-22, no recomendado |
| Nutrición por receta | Los macros están por 100 g: sin el nivel 2 no se puede calcular |
| Fotos de las recetas | Almacenamiento de ficheros, que la aplicación no tiene |

## Mi recomendación sobre el orden

Las recetas son la iteración más grande de las propuestas, y **su mejor parte depende de D3**.
Sugiero este orden:

1. Spec 01 y Spec 02, que ya están decididas y son baratas.
2. Resolver **D3** y añadir los ítems sueltos a la lista de la compra.
3. Entonces las recetas, con «añadir lo que falta a la lista» funcionando desde el primer día.

Si se hacen antes de D3, las recetas te dirán lo que falta y no podrás hacer nada con esa
información sin apuntarlo a mano, que es justo el trabajo que la aplicación debería quitarte.
