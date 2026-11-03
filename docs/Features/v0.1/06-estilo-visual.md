# Spec 06 · Estilo visual

**Cubre:** S-01 a S-06
**Estado:** implementada, salvo el bloque claro de Inicio (ver README).
**Depende de:** implementarla la última, porque las Specs 02 a 05 cambian los componentes

## Objetivo

Terminar de ajustar la app a `.claude/style.md`, sin cambiar lógica. **Queda menos trabajo del que indica `version0.1.md`:** los cambios sin confirmar del repositorio ya hacen buena parte. Esta spec recoge solo lo que falta.

## S-01 · Radios

Hay 24 usos de `rounded-*` y todos usan tokens. Falta fijar el significado de cada uno y eliminar los alias.

| Token | Valor | Uso permitido |
|---|---|---|
| `rounded-pill` | 56 px | Botones, pestañas y navegación |
| `rounded-xl` | 60 px | Bloque claro grande (ver S-05) |
| `rounded-lg` | 20 px | Tarjetas |
| `rounded-sm` | 10 px | Campos, miniaturas y elementos pequeños |
| `rounded-full` | círculo | Solo formas circulares o barras: stepper, punto de estado, barra de nivel y botón de tema |

**Cambio:**

- Eliminar `md` y `DEFAULT` de `tailwind.config.ts`, porque repiten 10 px.
- Sustituir los usos de `rounded` sin sufijo, si aparecen.
- Documentar la tabla en un comentario junto a los tokens.

**Criterio:** todos los `rounded-*` responden a esta tabla, y no hay valores sueltos como `rounded-[…]`.

## S-02 · Tipografía

**Tu decisión:** usar el sustituto, Inter.

**Estado actual:** ya está casi hecho, y el documento original está desactualizado en este punto.

- `index.html` carga Inter con el eje óptico `opsz 14..32` y los pesos 400 y 500. En tamaños grandes, el navegador aplica el corte de display por sí solo, así que **no hace falta cargar Inter Display aparte**.
- `tailwind.config.ts` ya define la escala y los 16 px con tracking de -0.08 px.
- No hay ningún `font-bold` ni `font-semibold`.

**Cambio:**

- Quitar las 3 clases `font-normal`, que son redundantes.
- Añadir `font-optical-sizing: auto` en `body`, para dejarlo explícito.

No se activan `ss01` ni `cv11`: esos ajustes describen a Aeonik, y en Inter cambiarían la forma de algunos caracteres.

**Criterio:** ningún peso supera 500 y el texto de cuerpo es 400.

## S-03 · Botones

| Tipo | Estilo | Estado |
|---|---|---|
| Primario | `bg-primary text-on-primary`, sin borde | Hecho en `Button` |
| Secundario | Transparente, borde de 1,5 px, texto claro | Hecho en `Button` |
| Terciario | Sin fondo ni borde | **Falta la variante** |

**Cambio:** añadir `variant="tertiary"` y sustituir los botones sueltos:

| Lugar | Hoy | Pasa a |
|---|---|---|
| `Scan.tsx:116` "Escanear" | Botón con clases propias | `Button` primario |
| `Scan.tsx:127` "Añadir sin código" | Enlace verde subrayado | `Button` terciario |
| `Scan.tsx:246` "Buscar" | Fondo `primary-container` | `Button` secundario. La guía prohíbe usar Mint Whisper como acción principal |
| `ErrorState.tsx:19` "Reintentar" | Enlace verde subrayado | `Button` terciario |

**Criterio:** ningún `<button>` de acción lleva clases de color propias. Quedan fuera los de icono y el stepper.

## S-04 · Uso del verde

La guía permite el verde en **acciones principales, estados activos y datos destacados**. Por eso `version0.1.md` necesita una corrección: el `StatTile` en verde **cumple** la guía, que define sus números en `#3ddc91`.

| Elemento | Veredicto |
|---|---|
| `Button` primario, pestaña activa, navegación activa | Se mantiene |
| Número de `StatTile`, punto de estado, `LevelBar` | Se mantiene: dato destacado |
| Eyebrow sobre fondo oscuro (`Dashboard.tsx:98`) | Se mantiene: lo pide la guía |
| Marco de enfoque del escáner, foco de los campos, radio seleccionado | Se mantiene: estado activo |
| **Botón + del stepper en cada fila de la lista** | **Cambia a neutro.** Con una lista larga es la principal fuente de verde. En el detalle se mantiene |
| **`BACK_LINK_CLASS` (`styles.ts:8`)** | **Cambia a `on-surface`.** Es una acción terciaria |

**Cambio:** `QuantityStepper` recibe `tone: "accent" | "neutral"`, y `PantryItem` usa `neutral`.

**Criterio:** en la lista de la despensa, el verde solo aparece en la pestaña activa, en la navegación y en los indicadores de estado.

## S-05 · Superficies (decisión D5)

**El problema:** la guía describe una web de escritorio. Sus tarjetas claras de 60 px de radio y 48 px de relleno no caben en un móvil de 380 px: quitarían un cuarto del ancho. Y una lista de productos incumpliría a la fuerza "nunca dos tarjetas claras juntas".

**Propuesta:** aplicar la intención de la guía, que es el ritmo por luminosidad, adaptada al móvil.

| Superficie | Uso | Radio |
|---|---|---|
| `obsidian-shell` | Fondo | — |
| `deep-abyss` | Tarjetas y filas de lista | 20 px |
| `mint-frost` | **Como mucho, un bloque por pantalla**, separado por fondo oscuro. Solo en Inicio (resumen) y en la cabecera del detalle | 20 px en móvil, 60 px desde 768 px, con relleno 24 y 48 px |

**Cambio:**

- `Card` añade `surface="light"` y quita el borde en modo oscuro, porque la guía confía en la luminosidad. En el tema claro lo conserva, porque blanco sobre menta apenas contrasta.
- `SummarySection` y `ProductHeader` usan el bloque claro.

**Se mantiene:** sin gradientes (0 usos) y sombras solo con `shadow-md`.

**Criterios:**

- [ ] Ninguna pantalla tiene dos bloques claros seguidos.
- [ ] No hay desbordamiento horizontal a 380 px.
- [ ] El tema claro sigue siendo legible. La guía solo define el oscuro, así que los criterios de color se comprueban en oscuro.

## S-06 · Componentes

| Componente | Estado | Cambio |
|---|---|---|
| Pestañas (`SegmentedControl`) | Radio y colores correctos | Quitar el fondo del contenedor: la guía las coloca directamente sobre el fondo |
| Eyebrow | Correcto (`text-eyebrow`: 9 px, 0,45 px) | Ninguno |
| `StatTile` | Número correcto a 48 px y peso 500 | La etiqueta pasa a `text-on-surface/50`, como pide la guía |

Los 9 px de las etiquetas son los que marca la guía, pero son pequeños en un móvil. Se aplican como están. Si te cuesta leerlos en la app real, se suben.

**Criterio:** Despensa, Congelador, Inicio y Detalle usan estos componentes.

## Tests

No se prueba el estilo píxel a píxel, como ya decidía la spec de la PWA. Se cubre lo que tiene comportamiento:

- `Button`: la variante terciaria se renderiza.
- `QuantityStepper`: `tone` cambia la clase del +.
- `Card`: `surface="light"`.
- Los tests existentes siguen pasando.

La comprobación final es visual: Inicio, Despensa, Congelador, Detalle, Escanear y Ajustes, en el iPhone y a 380 px.

## Fuera de alcance

- Servir la fuente desde la propia app. Hoy se carga de Google Fonts, y sin internet se usa la fuente del sistema.
- Rediseñar pantallas.
- Ilustraciones de la guía.
- Eliminar el tema claro.

## Verificación (2026-11-02)

| Criterio | Estado | Cómo se demuestra |
|---|---|---|
| S-01: radios con tokens de la guía, sin alias | ✔ | Revisión del código y de `tailwind.config.ts` |
| S-02: Inter, pesos 400 y 500 | ✔ | `index.html`, `tailwind.config.ts`; auditoría sin pesos mayores |
| S-03: botones primario, secundario y terciario | ✔ | `styleVariants.test.tsx`. Todos los botones de texto usan `Button`. Conservan clases propias, a propósito, el botón de icono del tema, el stepper, las pestañas y las filas pulsables |
| S-04: el verde solo en acciones y estados | ✔ | El «＋» de cada fila es neutro (`QuantityStepper.test.tsx`); el enlace «Volver» no es verde |
| S-05: bloque claro de la cabecera, no hay dos seguidos | ✔ | `styleVariants.test.tsx` (`surface="light"`); solo hay un bloque claro en la app |
| S-06: pestañas, etiquetas y stat tiles | ✔ | Revisión del código |
| **Sin desbordamiento horizontal a 380 px** | ⚠ | Requiere un navegador, y no había ninguno conectado |
| **Tema claro legible** | ⚠ | Igual |

≠ **Bloque claro en Inicio (D5): no aplicado.** Los números verdes del resumen quedarían sobre blanco con poco contraste. Hay que decidirlo viéndolo.

**Corregido durante la verificación:** los iconos de la PWA no existían (la carpeta solo tenía un `.gitkeep`) y el
manifiesto usaba los colores de la paleta antigua. Se añadieron iconos generados (`scripts/make_pwa_icons.py`, con
tests) y el manifiesto usa `#132322`.
