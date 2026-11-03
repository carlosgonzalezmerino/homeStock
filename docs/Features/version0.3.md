# homeStock v0.3 — Usabilidad y fricción

Catálogo de la tercera iteración. A diferencia de la [v0.2](version0.2.md), que preguntaba *qué
le falta a la aplicación*, esta pregunta **por qué se deja de usar**.

**Estado:** catálogo. El orden está decidido (ver [Decisiones](#decisiones)); las specs de lo
elegido están en [`v0.3/`](v0.3/README.md).

## Contexto

- **Qué se revisó en el código** (no supuesto): `frontend/src/screens/Scan.tsx`,
  `ProductDetail.tsx`, `detail/AddStockCard.tsx`, `detail/ManageStockCards.tsx`, `Pantry.tsx`,
  `ShoppingList.tsx`, `components/BottomNav.tsx`, `AppRoutes.tsx`, `app/models.py`,
  `app/api/inventory.py`, `app/services/shopping_list.py`.
- **Qué se buscó fuera:** Grocy y su registro de cambios, los proyectos españoles de ticket de
  Mercadona, las guías de UX de escaneo de Scandit, los comparativos de aplicaciones de despensa
  de 2026 y los proyectos de hardware (ESP32, NFC, células de carga). Fuentes al final.
- **Punto de partida honesto:** la aplicación funciona y está bien hecha. El riesgo no es técnico,
  es de abandono.

**Ya hecho desde la v0.2, y que esta iteración da por supuesto:** la pantalla de lista de la
compra (N-01) y la antigüedad en el congelador (N-02). La lista ya es la quinta pestaña, marca
mientras compras y registra la compra entera al volver a casa.

---

## Diagnóstico

### Son dos problemas, no uno

Las dos fricciones tienen naturaleza opuesta y **no se arreglan con la misma solución**:

| | Entrada (la compra) | Salida (el consumo) |
|---|---|---|
| Cuándo | 1 vez cada 7-10 días | 5-15 veces al día |
| Volumen | 25-40 artículos de golpe | 1 artículo |
| Lo que duele | El **coste total**, por repetición | El **coste de arranque**: abrir el móvil |
| Lo que lo arregla | Modo ráfaga: coste por artículo ≈ 0 | Capturarlo en el momento físico, o inferirlo |

Hoy la aplicación trata los dos casos con el mismo flujo: escanear → navegar al detalle →
formulario → guardar → volver. Es razonable para un producto y letal para treinta.

### Lo que cuesta hoy, medido sobre el código

**Por producto en la compra:** pulsar «Activar cámara» → apuntar → navegar a `/scan/:ean` →
`ProductDetail` bloquea con `Spinner` hasta que resuelven **las dos** consultas (`useResolve` y
`useInventory` entero) → stepper → «Añadir a despensa» → `returnToScanner` deja `/scan` con el
escáner en `idle`, o sea **la cámara apagada otra vez**.

Son ~3 toques + 2 navegaciones + 1 arranque de cámara por artículo. Una compra de 25 productos son
**75 toques y 25 arranques de cámara**.

**Por consumo:** desbloquear → abrir la PWA → pestaña Despensa → buscar o bajar → tocar «−».
Cinco acciones para registrar algo que físicamente dura dos segundos. El stepper en línea de
`Pantry.tsx`, con guardado optimista y vuelta atrás si falla, está bien resuelto; el problema es
todo lo que hay **antes** de llegar a él.

No es falta de disciplina. Es que el coste supera al beneficio percibido, y el cerebro lo descarta.

### El problema estructural debajo de todo

`InventoryItem` guarda **estado actual, no eventos**. `PATCH /api/inventory/{ean}` sobreescribe
`quantity` y no queda rastro de por qué.

Esto es lo mismo que ya decía la v0.2 en N-04, y sigue sin hacerse. Bloquea, hoy:

- **Deshacer.** Es la condición previa de cualquier acción de un solo toque: sin vuelta atrás, el
  usuario duda, y la duda es fricción.
- Predecir consumo, y con ello el repaso dirigido (U-04) y el umbral automático.
- «Última vez que lo consumiste», desperdicio, gasto.
- Cualquier dato que **justifique** el esfuerzo de mantener la despensa al día.

**Cada día que pasa sin esa tabla es historial perdido para siempre.**

### Lo que dice la literatura

Los comparativos de 2026 coinciden en un diagnóstico duro: *«el cementerio de aplicaciones de
despensa tiene una causa de muerte común: la entrada manual. La gente la hace con entusiasmo una
semana, luego una vez, luego nunca»* (Fango). Y el segundo golpe, la deriva: *«cocinas la cena y
olvidas registrar que usaste el pollo. Al día siguiente el inventario ya está mal. En dos semanas
diverge lo bastante como para no ser fiable»* (Expireless).

El caso de Grocy es el más instructivo porque es el más parecido a esto. Tiene *quick consume*:
defines una cantidad por defecto por producto y un toque la descuenta. Una reseña lo describe como
«rápido y fácil, y Grocy sabe exactamente cuándo el paquete está vacío»… y el mismo autor
**abandonó a la semana**, porque «era demasiado esfuerzo, incluso para mí».

**Lección:** optimizar el toque no basta si hay que acordarse de abrir la aplicación. Por eso esta
iteración incluye hardware, y por eso incluye un plan B que **acepta la deriva** en vez de pelearse
con ella.

---

## Catálogo

Coste: **S** = un rato · **M** = una sesión · **L** = varias sesiones.
La columna «v0.2» dice si la idea ya estaba catalogada allí.

### A · La base

| ID | Propuesta | Por qué | Coste | v0.2 |
|---|---|---|---|---|
| **U-01** | **Registro de movimientos.** Tabla nueva, solo de inserción: `ean`, `delta`, `quantity_after`, `motivo`, `origen`, `precio?`, `fecha`. La escribe `InventoryService` en cada cambio. | La llave de casi todo lo demás, y **la condición previa de deshacer**, que a su vez es la condición previa de las acciones de un toque. Barata y sin romper nada. | **M** | N-04 |

### B · Entrada: la compra

| ID | Propuesta | Por qué | Coste | v0.2 |
|---|---|---|---|---|
| **U-02** | **Modo compra (ráfaga).** La cámara no se para entre lecturas. Producto conocido → `+1` optimista sin navegar, hoja inferior de 2 s con nombre, miniatura y «Deshacer». Desconocidos y nuevos se **encolan sin interrumpir**. Al final, pantalla de revisión en bloque. | Lleva 25 productos de ~75 toques a ~5. Es el cambio que decide si la compra semanal se registra o no. | **M** | nueva |
| **U-07** | **Importar el ticket de Mercadona** por correo: PDF → líneas → alias aprendidos nombre→EAN → pantalla de confirmación. | El que más fricción quita en bruto: confirmar una lista prerrellenada en vez de escanear 25 cosas. Y la única vía realista a los precios. | **L** | N-07 |

### C · Salida: el consumo

| ID | Propuesta | Por qué | Coste | v0.2 |
|---|---|---|---|---|
| **U-03** | **Modo consumir en el escáner.** Mismo motor de cámara, signo invertido. Si queda 0, ofrece añadir a la lista en la misma hoja. | El momento en que algo se acaba es el momento en que **tiras el envase**: un gesto que ya existe, diario y fiable. Engancharse a él es más barato que pedir un gesto nuevo. | **M** | N-06 |
| **U-04** | **Repaso semanal de 60 segundos.** Solo los artículos cuyo consumo estimado dice que deberían haberse agotado. Tarjetas grandes: «¿Queda leche?» → Sí / No / Queda poco. | Acepta la deriva en vez de aspirar a precisión en tiempo real. Ocho tarjetas, un minuto, y el inventario vuelve a ser verdad. Necesita U-01. | **M** | nueva |

### D · Detalles que cuestan poco y se notan

| ID | Propuesta | Por qué | Coste |
|---|---|---|---|
| **U-05** | **Deshacer global**, 5 s, en toda acción destructiva o de un toque. | Sin esto, las acciones de un toque dan miedo y la fricción vuelve por la puerta de atrás. Trivial una vez existe U-01. | **S** |
| **U-06** | **No bloquear el detalle** esperando al inventario entero. Pintar el producto en cuanto llega y rellenar el stock después. | En ráfaga se nota muchísimo. Hoy `ProductDetail` espera a las dos consultas. | **S** |
| **U-08** | **Umbral por defecto aprendido** en vez del `DEFAULT_THRESHOLD = 2` fijo. | Hoy el umbral es un número inventado producto a producto. | **M** |
| **U-09** | **Abierto vs. cerrado.** Grocy separó *consumir* de *abrir* en su changelog por algo. | «0,5 yogures» no significa nada; «1 abierto + 3 cerrados» sí. | **M** |
| **U-10** | **Caducidad** en despensa, no solo `frozen_at`. | Ya estaba en N-05. Sin fecha, el valor de la despensa es la mitad. | **M** |

### E · Hardware

Ordenado por valor/esfuerzo, con veredicto honesto. Ninguno sustituye al software; todos atacan el
**coste de arranque**, que es lo que el software solo no puede bajar a cero.

| ID | Cacharro | Veredicto | Coste |
|---|---|---|---|
| **H-01** | **Escáner fijo de pared junto al cubo de basura.** ESP32 + módulo lector 2D (GM65 / GM805) + conmutador físico de modo + zumbador. Un `POST /api/scan {ean, mode}`. | **El mejor de la lista.** Elimina *todo* el coste de arranque: no desbloqueas, no abres nada, no buscas. Coges el envase vacío, lo pasas, pita, lo tiras. Y como está en el camino a la basura, **el entorno te recuerda hacerlo**. ~25-40 €. Precedente directo: `UnknownHero99/Pantry`. | **M** |
| **H-02** | **Tablet fija en la cocina.** | Sí, **pero con interfaz propia**: montar la PWA móvil en un soporte no sirve de nada. Necesita vista de quiosco: rejilla grande de los 20-30 productos más consumidos, tocar = −1. Y a menos de un brazo del fregadero o la basura; un iPad en la otra punta es un iPad que no se usa. Fully Kiosk (Android) o Modo Guiado (iPad). | **M** |
| **H-03** | **Etiquetas NFC** en el borde de las baldas o la tapa del cubo. ~10 € las 50. | Buen complemento, mal sustituto: una etiqueta por producto no escala a 150. **Aviso iOS:** las automatizaciones solo corren con el teléfono **desbloqueado** y por defecto piden confirmación; hay que activar «Ejecutar inmediatamente». En Android va mejor. Que el Shortcut apunte a la IP local, no al nombre de host. | **S** |
| **H-04** | **Botones Zigbee / Flic** en la nevera. | Un botón = un producto. Útil para «se acabó la leche», no es una solución de inventario. Aqara Mini ~12 € (necesita coordinador); Flic 2 35 € pero depende de que el móvil esté cerca, y su hub no habla Zigbee. | **S** |
| **H-05** | **Voz** («apunta que se ha acabado el aceite»). | Encaja con el caso real: manos ocupadas cocinando. El problema duro es emparejar nombre→producto, que es **exactamente** el mismo que U-07. Si se hace el ticket, la voz sale casi gratis después. | **M** |
| **H-06** | **Pantalla e-ink de pared** con lista y alertas. | No reduce fricción: aumenta la **visibilidad del beneficio**, que es lo que mantiene el hábito. ESP32 + e-paper, meses de batería refrescando cada 15 min. Va después de todo lo demás. | **M** |
| **H-07** | **Baldas con célula de carga** (HX711 + ESP32). | **No.** Hay que calibrar peso por unidad de cada producto, hay deriva de tara y la superficie de apoyo falsea la lectura. Inviable para una despensa heterogénea. **Única excepción:** 2-3 productos fijos de envase constante (bombona, pienso del perro, café), donde sí mide consumo parcial continuo, que el escaneo no puede. | **L** |

---

## Decisiones

### Tomadas (2026-11-03)

| # | Pregunta | Resolución |
|---|---|---|
| **E1** | ¿Por dónde empezamos? | **U-01 → U-02 → U-03 → U-04**, en ese orden. Specs en [`v0.3/`](v0.3/README.md) |
| **E2** | ¿Y el ticket de Mercadona (U-07)? | Interesa, pero **se diseña después**, cuando los cuatro primeros estén. Se le darán vueltas antes de comprometerse |
| **E3** | ¿Hardware ahora? | No en esta iteración. H-01 queda como la apuesta recomendada para la siguiente, y U-01 y U-03 se diseñan **sabiendo que llegará** (de ahí el campo `origen` y un endpoint de escaneo que no asume navegador) |

### Pendientes

| # | Pregunta | Mi propuesta |
|---|---|---|
| **E4** | ¿La cantidad de `inventory_items` sigue siendo la verdad, o pasa a derivarse de los movimientos? | **Que siga siendo la verdad**, con los movimientos como diario paralelo. Derivarla es más puro y mucho más caro; se puede hacer luego. Lo que sí hace falta es un script de comprobación de coherencia |
| **E5** | ¿El modo de la hoja de ráfaga se recuerda entre sesiones? | Sí, en `localStorage`, como `activeLocation`. Pero **nunca** arrancar en modo consumir sin decirlo muy claro: restar por error es peor que sumar por error |
| **E6** | ¿El repaso semanal (U-04) avisa solo, o espera a que abras? | Espera, por ahora. Los avisos automáticos son N-15/D2 de la v0.2 y ya dijiste que no |
| E7 | ¿Precios en U-01 desde el principio? | Sí, campo nulo. Es gratis ahora y carísimo después (es D5 de la v0.2) |
| E8 | ¿Lotes (N-21)? | Sigue aplazado. Pero U-09 y U-10 se diseñan sabiendo que algún día puede pasar |

---

## Relación con la v0.2

Esta iteración **no sustituye** al catálogo de la v0.2, lo reordena por criterio de abandono.

| v0.3 | v0.2 | Qué cambia |
|---|---|---|
| U-01 | N-04 | Mismo cambio. Aquí sube a primero y se le añade `quantity_after` y `origen` |
| U-03 | N-06 | Mismo cambio, pero diseñado alrededor del gesto físico de tirar el envase, no de una ruta `/consumir/:ean` |
| U-07 | N-07 | Igual |
| U-10 | N-05 | Igual |
| U-05 | N-14 | Igual, pero aquí es requisito de U-02 y U-03, no un extra |
| U-02, U-04 | — | Nuevas. Salen de medir el flujo real sobre el código |
| H-01…H-07 | — | Nuevas |
| — | N-01, N-02 | **Ya implementadas** |

Sigue aplicando todo lo que avisaba la v0.2: la regla de stock bajo está escrita **tres veces**
(propiedad, SQL y `computeStockStatus`) y se tocan juntas, y después de cambiar cualquier endpoint
o esquema, `uv run python -m scripts.export_openapi`.

---

## Fuentes

| Qué | Dónde |
|---|---|
| Por qué se abandonan estas aplicaciones | [Fango](https://fango.fi/en/blog/best-pantry-inventory-app/), [Expireless](https://expireless.app/pantry-inventory-app/), [Pantry Persona](https://www.pantrypersona.com/blog/best-pantry-inventory-apps-2026) |
| UX de escaneo: modo continuo, feedback, retardo de 150 ms antes de cerrar la cámara | [Scandit — Scanning at Scale](https://www.scandit.com/blog/scanning-at-scale-ux-insights/), [Scandit — Performant scanner](https://www.scandit.com/blog/make-barcode-scanner-app-performant/) |
| Grocy: *quick consume*, separar consumir de abrir, y un abandono documentado | [grocy.info](https://www.grocy.info), [Galaxus](https://www.galaxus.de/en/page/how-i-want-to-digitise-the-contents-of-my-fridge-and-fail-to-do-so-39565) |
| Ticket de Mercadona: parsers reales, en español | [dserrada/ticket-digital](https://github.com/dserrada/ticket-digital), [Darkrai500/mercastatsv2](https://github.com/Darkrai500/mercastatsv2), [no hay API oficial](https://www.octoparse.es/blog/guia-de-mercadona-scraper) |
| Ticket por OCR + LLM, uno de ellos en local | [megradhikan/pantryai](https://github.com/megradhikan/pantryai), [pbairoliya/grocery-receipts](https://github.com/pbairoliya/grocery-receipts) |
| Escáner ESP32 de pared para despensa | [UnknownHero99/Pantry](https://github.com/UnknownHero99/Pantry) |
| Células de carga: por qué no | [wnurr/smart-shelf-inventory-system](https://github.com/wnurr/smart-shelf-inventory-system), [paper IJRAMT](https://journals.ijramt.com/index.php/ijramt/article/download/2721/2713/3528) |
| NFC: consumir desde Home Assistant, y el límite de iOS | [grocy-pro wiki](https://github.com/DonTranQuiL/grocy-pro/wiki/advanced-workflows), [Tags — Home Assistant](https://www.home-assistant.io/integrations/tag/), [statusq.org](https://statusq.org/?p=9955) |
| E-ink de pared con ESP32 | [Zbotic](https://zbotic.in/e-paper-display-with-esp32-low-power-iot-dashboard-project/) |
| Botones | [Flic — Best Smart Buttons](https://flic.io/blog/the-best-smart-buttons-on-the-market) |

Los comparativos de 2026 son material promocional de aplicaciones que se venden a sí mismas:
describen lo que venden, no lo que la gente usa. Las cifras de abandono que dan no están
cuantificadas y hay que leerlas como opinión. Lo de Scandit es marketing de proveedor, pero sus
detalles de UX (modo continuo, feedback triple, el retardo de 150 ms) son concretos y verificables
al implementarlos. Lo de Grocy viene de su documentación y su registro de cambios.
