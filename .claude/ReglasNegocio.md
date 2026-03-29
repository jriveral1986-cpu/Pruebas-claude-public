# Reglas de Negocio — Calculadora Previsional Chile

Documento de referencia de todas las reglas de negocio implementadas en el proyecto, extraídas directamente del código fuente (`js/calculos.js`, `js/mortalidad.js`, `js/comisiones.js`, `data/tablas.json`, `data/afp.json`).

---

## 1. Cotización y Tope Imponible

| Regla | Valor | Fuente |
|---|---|---|
| Cotización obligatoria | 10% de la remuneración imponible | DL 3.500 |
| Factor tope imponible | 87.8 × UF | DL 3.500 |
| Fórmula tope imponible | `round(87.8 × UF_del_día)` | `calculos.js:calcularTopeImponible` |
| SIS (Seguro de Invalidez y Sobrevivencia) | 1.54% — pagado por el empleador | `comisiones.js:calcularSIS` |

**Implementación:**
```js
// calculos.js
export function calcularTopeImponible(uf) {
  return Math.round(87.8 * uf);
}

// comisiones.js
export function calcularSIS(salario) {
  return salario * 0.0154;
}
```

---

## 2. AFPs y Comisiones

Las comisiones son sobre la remuneración imponible (% anual). Se descuentan mensualmente.

| AFP | Comisión anual |
|---|---|
| Uno | 0.49% |
| Modelo | 0.58% |
| Hábitat | 0.95% |
| PlanVital | 1.16% |
| Capital | 1.44% |
| Cuprum | 1.44% |
| Provida | 1.45% |


**Fórmula descuento mensual:**
```
descuento_mensual = salario × (comisión / 100) / 12
```

Fuente: `data/afp.json` + `comisiones.js:calcularDescuentoMensual`

---

## 3. Fondos de Pensión

| Fondo | Perfil |
|---|---|
| A | Más Riesgoso |
| B | Riesgoso |
| C | Intermedio |
| D | Conservador |
| E | Más Conservador |

Fuente: `data/afp.json`

---

## 4. Valor Cuota (Valor Cuota AFP)

- Se obtiene en tiempo real desde **SP Chile** (`spensiones.cl`) a través de un proxy Cloudflare Worker (resuelve CORS).
- **Cadena de fallback:**
  1. Caché en memoria de la sesión actual (`_cache` en `api.js`)
  2. Cloudflare Worker → SP Chile (timeout 6 segundos)
  3. `data/vc_cache.json` (archivo local con valores recientes)
- El valor cuota se usa para convertir número de cuotas a saldo CLP:
  ```
  saldo_total = número_de_cuotas × valor_cuota
  ```

Fuente: `js/api.js`, `data/vc_cache.json`

---

## 5. Indicadores Económicos

| Indicador | Fuente | Fallback |
|---|---|---|
| UF (Unidad de Fomento) | `mindicador.cl/api/uf` | $39.717 CLP |
| UTM (Unidad Tributaria Mensual) | `mindicador.cl/api/utm` | $69.889 CLP |

- Timeout de fetch: 5 segundos.
- Ambos se almacenan en `localStorage` via `Store` al hacer clic en "Actualizar".

Fuente: `js/api.js:getUF`, `js/api.js:getUTM`

---

## 6. Saldo Acumulado

El usuario puede ingresar el saldo de dos formas:

| Método | Fórmula |
|---|---|
| Por número de cuotas | `saldo = num_cuotas × valor_cuota` |
| Por monto total CLP | `saldo = monto ingresado directamente` |

Fuente: `js/calculos.js:calcularSaldoDesdeNumCuotas`, `pages/datos.html`

---

## 7. Pensión Estimada — Retiro Programado (RP)

**Tabla de mortalidad:** B-2020 (Retiro Programado)
**Tasa técnica:** 3,31% real anual (Circular SP N°2407, enero 2026) → `TASA_RP = 0.0331 / 12` mensual simple

**Firma de la función:**
```js
calcularPensionRP(saldo, edad, sexo, uf, comisionAfpDecimal = 0, familia = null)
```

**Fórmula base (sin grupo familiar):**
```
cnuAfiliado = getCRU(sexo, edad)           // tabla B-2020 pre-calculada
pensión_RP_bruta = saldo_total / cnuAfiliado
```

**Fórmula con grupo familiar:**
```
cnuTotal = calcularCNUFamiliar(edad, sexo, familia, factorTabla = 1.0).cnuTotal
pensión_RP_bruta = saldo_total / cnuTotal
pensionSinFamilia = saldo_total / cnuAfiliado   // referencia comparativa
```

Donde `CRU` (Capital Requerido Unitario) es el valor presente de una renta vitalicia de $1/mes a la edad dada, calculado con la tabla B-2020 a tasa 3,31% real anual.

**Años estimados del fondo:**
```
r = (1 + TASA_RP × 12)^(1/12) - 1             // tasa mensual compuesta
n = -ln(1 - saldo × r / pensionSinFamilia) / ln(1 + r)   [en meses → dividir por 12]
```
Se usa `pensionSinFamilia` para evitar que el CNU familiar provoque `saldo × r / pension ≥ 1`.
Si el argumento del logaritmo ≤ 0 → se retorna 35 años.

**Equivalente en UF:**
```
pensión_UF = pensión_CLP / UF
```

**Resultado enriquecido** (`calcularPensionRP` retorna):
```js
{
  pension,            // pensión bruta RP (CLP)
  pensionUF,          // ídem en UF
  pensionLiquida,     // después de descuentos legales
  desglose,           // { descuentoComision, descuentoSalud, descuentoImpuesto }
  pgu,                // PGU estimada
  pensionTotal,       // pensionLiquida + pgu
  anosEstimados,      // años proyectados del fondo
  pensionSinFamilia,  // pensión sin beneficiarios (para mostrar impacto)
  impactoFamilia,     // reducción absoluta por grupo familiar (CLP)
  cnuDetalle          // objeto retornado por calcularCNUFamiliar
}
```

Fuente: `js/calculos.js:calcularPensionRP`

---

## 8. Pensión Estimada — Renta Vitalicia (RV)

**Tabla de mortalidad:** RV-2020 (más conservadora que B-2020)
**Factor de tabla:** `1.08` (aproximación RV-2020 vs B-2020)

**Firma de la función:**
```js
calcularPensionRV(saldo, edad, sexo, uf, familia = null)
```

**Fórmula base (sin grupo familiar):**
```
CRU_RV2020 = getCRU(sexo, edad) × 1.08
pensión_RV = saldo_total / CRU_RV2020
```

**Fórmula con grupo familiar:**
```
cnuTotal = calcularCNUFamiliar(edad, sexo, familia, factorTabla = 1.08).cnuTotal
pensión_RV = saldo_total / cnuTotal
pensionSinFamilia = saldo_total / (getCRU(sexo, edad) × 1.08)
```

El factor `1.08` se aplica a **todos los componentes del CNU** (afiliado + cónyuge + hijos), porque la RV usa tablas RV-2020 para cada beneficiario.

**Características de la RV:**
- Pensión fija reajustable en UF.
- El riesgo de longevidad lo asume la aseguradora.
- El saldo ya no es heredable (salvo período garantizado pactado).
- Contrato irrevocable con la compañía de seguros.

**Resultado enriquecido** (`calcularPensionRV` retorna):
```js
{
  pension,            // pensión bruta RV (CLP)
  pensionUF,          // ídem en UF
  pensionLiquida,
  desglose,
  pgu,
  pensionTotal,
  pensionSinFamilia,  // sin beneficiarios
  impactoFamilia,     // reducción por grupo familiar
  cnuDetalle          // objeto de calcularCNUFamiliar
}
```

Fuente: `js/calculos.js:calcularPensionRV`

---

## 9. CRU — Capital Requerido Unitario

### `getCRU(sexo, edad)` — tabla pre-calculada

Pre-calculado en `data/tablas.json` para edades 55–75 (hombres) y 50–75 (mujeres), con tasa técnica **3% anual real**.
Para edades intermedias se aplica **interpolación lineal** entre los valores disponibles.

| Edad | CRU Hombre | CRU Mujer |
|---|---|---|
| 55 | 228.4 | 272.1* |
| 60 | 197.9 | 216.8 |
| 65 | 169.9 | 191.5 |
| 70 | 144.4 | 167.9 |
| 75 | 121.4 | 146.2 |

*La tabla de mujeres comienza en edad 50 (CRU = 272.1).

### `getCRUExtrapolado(sexo, edad)` — extrapolación para edades jóvenes

Para edades **por debajo del mínimo de la tabla** (mujeres < 50, hombres < 55), extrapola linealmente hacia atrás usando la pendiente de las dos entradas más jóvenes de la tabla pre-calculada.

> **¿Por qué no usar los datos raw de `b2020_hombre/mujer`?**
> Los valores `qx` en `data/tablas.json` para las tablas raw B-2020 producen una esperanza de vida de solo ~10.4 años para un hombre de 65, inconsistente con los ~17 años implícitos en la tabla CRU pre-calculada. La tabla CRU pre-calculada es la referencia correcta.

```
Pendiente (mujer): (CRU[50] - CRU[51]) / 1 ≈ +5.7 por año hacia atrás
Pendiente (hombre): (CRU[55] - CRU[56]) / 1 ≈ +6.3 por año hacia atrás

getCRUExtrapolado('F', 40) ≈ 272.1 + 10 × 5.7 = 330
getCRUExtrapolado('F', 25) ≈ 272.1 + 25 × 5.7 = 417  (hijos inválidos)
```

### `getCRUReversional(cruAfiliado, cruConyuge)` — anualidad reversional

Calcula la anualidad que el **cónyuge cobrará solo después de que fallezca el afiliado** (no desde hoy). Evita sobreestimar el CNU familiar.

**Modelo**: Fuerza de mortalidad constante calibrada con los valores del CRU pre-calculado:
```
δ = ln(1.03) / 12   (fuerza de interés mensual consistente con tasa técnica 3%)

μ_afiliado = max(0, 1/CRU_afiliado − δ)   (fuerza de mortalidad implícita)
μ_cónyuge  = max(0, 1/CRU_cónyuge  − δ)

a_conjunta = 1 / (μ_afiliado + μ_cónyuge + δ)   (anualidad vida conjunta)

CRU_reversional = max(0, CRU_cónyuge − a_conjunta)
```

**Impacto real** (afiliado H65 vs fórmula aditiva incorrecta que sumaba CRU completo del cónyuge):

| Caso | Fórmula aditiva (incorrecta) | Fórmula reversional (correcta) |
|---|---|---|
| H65 + cónyuge F60 | −43.4% pensión | −24.6% pensión |
| H65 + cónyuge F50 | −46.1% pensión | −31.7% pensión |
| H65 + cónyuge F40 | −53.7% pensión | −38.2% pensión |

Fuente: `data/tablas.json`, `js/mortalidad.js:getCRU`, `js/mortalidad.js:getCRUExtrapolado`, `js/mortalidad.js:getCRUReversional`

---

## 10. Edades de Jubilación

| Sexo | Edad normal de jubilación |
|---|---|
| Hombre | 65 años |
| Mujer | 60 años |

Fuente: `data/tablas.json → parametros.edadJubilacionHombreNormal/Mujer`

**Validación en datos.html:** se acepta ingreso de datos para personas entre 40 y 100 años.

---

## 11. Proyección de Saldo

Proyecta el crecimiento del fondo a N años con aportes mensuales adicionales opcionales.

**Fórmula (capitalización mensual):**
```
r_mensual = (1 + tasa_anual)^(1/12) - 1
saldo[mes] = saldo[mes-1] × (1 + r_mensual) + aporte_mensual
```

**Tasas disponibles en la interfaz:** 3%, 4%, 5%, 6% anual.
**Períodos:** 5, 10, 15, 20, 30 años.

Fuente: `js/calculos.js:proyectarSaldo`

---

## 12. Análisis de Brecha

Compara la pensión estimada **total (líquida + PGU)** con la pensión objetivo del usuario.

```
brecha_absoluta = pensión_objetivo - pensionTotal_RP
brecha_porcentual = (brecha_absoluta / pensión_objetivo) × 100
suficiente = brecha_absoluta ≤ 0
cobertura_pct = min(100, pensionTotal_RP / pensión_objetivo × 100)
```

**Semáforo visual (barra de progreso):**
- ≥ 80% → verde (success)
- 50%–79% → amarillo (warning)
- < 50% → rojo (danger)

Fuente: `js/calculos.js:calcularBrecha`, `pages/brechas.html`

---

## 13. Aportación Necesaria para Cerrar la Brecha

Calcula el aporte mensual adicional necesario para alcanzar la pensión objetivo en N años.

**Fórmula:**
```
saldo_meta = pensión_objetivo × CRU(sexo, edad_retiro)
edad_retiro = min(edad_actual + años_restantes, 75)

r = (1 + tasa_anual)^(1/12) - 1
n = años_restantes × 12

faltante = saldo_meta - saldo_actual × (1 + r)^n

aporte_mensual = faltante × r / ((1 + r)^n - 1)
```

Si `faltante ≤ 0`, el aporte necesario es $0 (el saldo actual ya es suficiente).

**Escenarios presentados:** Conservador (3%), Moderado (4%), Optimista (5%).

Fuente: `js/calculos.js:calcularAportacionNecesaria`

---

## 14. Comparativa por AFP

Estima cuánto variaría la pensión RP si el usuario estuviera en otra AFP, modelando el impacto acumulado de las diferencias de comisión a 20 años:

```
diferencia_comisión = comisión_AFP_comparada - comisión_AFP_actual
impacto = round(pensión_RP × (-diferencia_comisión / 100) × 0.5)
pensión_AFP_comparada = round(pensión_RP - impacto)
```

El factor `0.5` es una aproximación conservadora del efecto compuesto a largo plazo.

Fuente: `pages/brechas.html`

---

## 15. Simulador de Longevidad (Modalidades)

Estima el total acumulado cobrado según la esperanza de vida elegida:

```
años_vida = edad_esperada_fallecimiento - edad_actual
meses_vida = años_vida × 12

total_RV = pensión_RV × meses_vida
total_RP = pensión_RP × 0.75 × meses_vida   [factor 0.75 modela el decaimiento de la pensión RP]
```

Si `total_RP > total_RV` → conviene Retiro Programado.
Si `total_RV ≥ total_RP` → conviene Renta Vitalicia.

### Evolución del Fondo RP (`generarRPDetalle`)

Muestra año a año cómo decrece el fondo bajo RP. La pensión **se recalcula cada año** (metodología real SP Chile):

```
Para cada año i desde edad_actual hasta agotamiento del fondo:
  pension_i = calcularPensionRP(saldo_i, edad_actual + i, sexo, uf, comisión, familia).pension
  retiro_anual_i = pension_i × 12
  rendimiento_i = saldo_i × tasa_anual_efectiva
  saldo_i+1 = saldo_i + rendimiento_i - retiro_anual_i
```

- **Tasa aplicada:** `(1 + TASA_RP × 12)^(1) - 1` (tasa anual efectiva con TASA_RP = 0.0331/12)
- La pensión decrece a medida que el afiliado envejece porque el CRU disminuye con la edad (menor esperanza de vida restante).
- Si hay grupo familiar, se muestra `(sin familia: $X)` en gris para comparar.

Fuente: `pages/modalidades.html:generarRPDetalle`

---

## 16. Tablas de Mortalidad

| Tabla | Uso | Sexo disponible |
|---|---|---|
| RV-2020 | Renta Vitalicia | Hombre / Mujer |
| B-2020 | Retiro Programado | Hombre / Mujer |

- `qx` = probabilidad de muerte a edad exacta `x`
- Edad máxima en tablas: 110 años
- Probabilidad de sobrevivir `t` años desde edad `x`:
  ```
  tPx = ∏(i=0..t-1) (1 - qx[x+i])
  ```
- Esperanza de vida curtada: `e_x = Σ(t=1..110-x) tPx`

Fuente: `data/tablas.json`, `js/mortalidad.js`

---

## 17. Pensión Mínima Garantizada

Valor de referencia definido en `tablas.json`:

```
pensión_mínima_garantizada = $214.000 CLP
```

> Valor referencial. No se aplica automáticamente en los cálculos de estimación — es un piso informativo establecido por la regulación.

Fuente: `data/tablas.json → parametros.pensionMinimaGarantizada`

---

## 18. Estado compartido entre páginas

Todos los datos del usuario se persisten en `localStorage` bajo la clave `pension_chile_v1`.

**Campos relevantes al negocio:**

| Campo | Descripción |
|---|---|
| `afp` | ID de la AFP seleccionada |
| `fondo` | Letra del fondo (A–E) |
| `valorCuota` | Valor cuota al momento del cálculo (CLP) |
| `numCuotas` | Número de cuotas del fondo |
| `montoTotal` | Saldo ingresado directamente (CLP) |
| `saldoTotal` | Saldo calculado final (CLP) |
| `sexo` | M / F |
| `edad` | Calculada desde fechaNacimiento |
| `uf` | UF al momento del cálculo |
| `utm` | UTM al momento del cálculo |
| `topeImponible` | 87.8 × UF |
| `pensionRP` | Pensión RP bruta estimada |
| `pensionRPLiquida` | Pensión RP líquida (después de descuentos) |
| `pensionRPTotal` | Pensión RP total (líquida + PGU) |
| `pguRP` | Monto PGU sobre pensión RP |
| `pensionRV` | Pensión RV bruta estimada |
| `pensionRVLiquida` | Pensión RV líquida |
| `pensionRVTotal` | Pensión RV total (líquida + PGU) |
| `pguRV` | Monto PGU sobre pensión RV |
| `comisionDec` | Comisión AFP en decimal (ej: 0.0058) |
| `pensionObjetivo` | Pensión meta ingresada por el usuario |
| `rentaImponible` | Renta imponible mensual del afiliado |
| `lagunas` | % meses sin cotización |
| `apvMensual` | Aporte APV mensual |
| `regimenAPV` | Régimen APV (A/B) |
| `saldoAPV` | Saldo APV acumulado |
| `tienePareja` | Tiene cónyuge o conviviente civil |
| `numHijos` | Número de hijos beneficiarios |
| `numHijosInvalidos` | Número de hijos con invalidez permanente |

Fuente: `js/store.js`

---

## 19. Descuentos Legales sobre la Pensión

La pensión bruta se convierte en pensión líquida aplicando tres descuentos en cascada:

```
1. Descuento comisión AFP = pensión_bruta × comisión_AFP_decimal   [solo RP; RV = 0]
2. Base imp. = pensión_bruta - descuento_comisión
3. Descuento salud = round(base_imp × 0.07)                        [7% cotización salud obligatoria]
4. Descuento impuesto = calcularImpuesto(base_imp)                 [Impuesto 2ª categoría]
5. Total descuentos = descuento_comisión + descuento_salud + descuento_impuesto
6. Pensión líquida = pensión_bruta - total_descuentos
```

Fuente: `js/calculos.js:calcularPensionLiquida`

---

## 20. Impuesto de Segunda Categoría (2026)

Calculado sobre la base imponible mensual (pensión bruta menos comisión AFP).
UTM vigente marzo 2026: **$69.889 CLP** (`calculos.js:UTM`).

| Tramo (UTM/mes) | Tasa | Rebaja (en UTM/12) |
|---|---|---|
| ≤ 13,5 UTM | 0% | $0 |
| ≤ 30 UTM | 4% | $0 |
| ≤ 50 UTM | 8% | 2.772 |
| ≤ 70 UTM | 13,5% | 5.126 |
| ≤ 90 UTM | 23% | 11.771 |
| ≤ 120 UTM | 30,4% | 18.427 |
| ≤ 150 UTM | 35,5% | 24.537 |
| > 150 UTM | 40% | 31.287 |

**Fórmula:** `impuesto = base_imp × tasa - (rebaja × UTM / 12)`, mínimo $0.

Fuente: `js/calculos.js:calcularImpuesto`, `TRAMOS_IMP`

---

## 21. PGU — Pensión Garantizada Universal

Ley 21.419 + Reforma 21.735 (febrero 2026). Se suma a la pensión líquida autofinanciada.

| Parámetro | Valor |
|---|---|
| Monto base (< 82 años) | $231.732 CLP/mes |
| Monto máximo (≥ 82 años) | $250.275 CLP/mes |
| Umbral pensión completa | pensión base ≤ $789.139 → PGU completa |
| Umbral sin PGU | pensión base ≥ $1.252.602 → PGU = $0 |

**Fórmula de PGU proporcional** (entre ambos umbrales):
```
proporción = (umbralTope - pensión_base) / (umbralTope - umbralCompleto)
PGU = round(montoMax × proporción)
```

La pensión base para calcular PGU es la **pensión líquida** (después de descuentos).

Fuente: `js/calculos.js:calcularPGU`, `PGU` constant

---

## 22. Pensión de Sobrevivencia (DL 3.500, art. 58)

Al fallecer el pensionado, los beneficiarios tienen derecho a una pensión de sobrevivencia calculada como porcentaje de la **pensión de referencia** (pensión bruta RP o RV).

| Beneficiario | Porcentaje | Condición |
|---|---|---|
| Cónyuge / conviviente civil **sin hijos comunes** | **60%** | DL 3.500 art. 58 |
| Cónyuge / conviviente civil **con hijos comunes** | **50%** | DL 3.500 art. 58 |
| Cada hijo < 18 años | 15% | temporal |
| Cada hijo 18–24 años si estudia | 15% | temporal hasta los 24 |
| Cada hijo con invalidez permanente (cualquier edad) | 15% | de por vida |

> **Regla clave:** El porcentaje del cónyuge depende de si existen hijos comunes con el afiliado.
> - Sin hijos comunes → **60%**
> - Con hijos comunes → **50%**

**Tipos de hijos diferenciados en la interfaz:**
- `numHijosMenores` — hijos menores de 18 años
- `numHijosEstudiantes` — hijos entre 18 y 24 años que estudian
- `numHijosInvalidos` — hijos con invalidez permanente (cualquier edad)

**Tope:** La suma total no puede superar el 100% de la pensión de referencia. Si se supera, se aplica **prorrateo proporcional**:
```
factor_prorrateo = 1.0 / pct_total   (cuando pct_total > 1)
```

**Fórmula:**
```
tieneHijosComunes = (numHijosMenores + numHijosEstudiantes + numHijosInvalidos) > 0
pctConyuge = tieneHijosComunes ? 0.50 : 0.60

montoCónyuge          = round(pensión_ref × pctConyuge × factor_prorrateo)
montoHijoTemporal     = round(pensión_ref × 0.15 × factor_prorrateo)   [por hijo menor/estudiante]
montoHijoInvalido     = round(pensión_ref × 0.15 × factor_prorrateo)   [por hijo inválido]
totalSobrevivencia    = round(pensión_ref × min(pct_total, 1.0))
```

Fuente: `js/calculos.js:calcularPensionSobrevivencia`

---

## 23. Recomendación de Modalidad según Situación Familiar

| Situación | Recomendación |
|---|---|
| Hijos con invalidez permanente | **RV fuertemente recomendada** (pensión de sobrevivencia de por vida) |
| Cónyuge + hijos sin invalidez | **RV recomendada** (protege a beneficiarios) |
| Soltero/a sin hijos ni conviviente | **RP puede convenir** (saldo heredable, pensión inicial mayor) |
| Resto (cónyuge sin hijos, etc.) | **Mixta / SCOMP** — evaluar Renta Temporal + RV Diferida |

Fuente: `js/calculos.js:recomendarModalidadFamiliar`, `pages/modalidades.html:renderSobrevivencia`

---

## 24. Score Previsional (0–100)

Puntaje que resume la situación previsional del usuario. Se calcula en `calculos.js:calcularScore`.

| Factor | Puntos máx | Criterio |
|---|---|---|
| Tasa de reemplazo | 40 | `min(40, (TR/70) × 40)` donde TR = pensión_RP / renta_imponible × 100 |
| APV activo | 20 | 20 pts si apvMensual > 0; 10 pts si solo tiene saldo APV |
| Sin lagunas | 20 | `(1 - min(1, lagunas)) × 20` donde lagunas es fracción (0–1) |
| Saldo vs edad | 20 | `min(20, (saldoActual / saldoIdeal) × 20)` |

```
saldo_ideal = renta_imponible × 12 × max(1, edad - 22) × 0.5
```

**Interpretación:**
- 0–39: Alerta (rojo)
- 40–69: En progreso (amarillo)
- 70–100: Buen camino (verde)

Fuente: `js/calculos.js:calcularScore`, `pages/brechas.html:renderScore`

---

## 25. APV — Ahorro Previsional Voluntario

| Régimen | Beneficio | Máximo |
|---|---|---|
| A | Estado bonifica **15%** del aporte | hasta 6 UTM/año (~$419.334 CLP/año en 2026) |
| B | Deduce el aporte de la **base imponible** del impuesto | según tramo de impuesto del afiliado |

- El APV se descuenta antes del cálculo de impuesto 2ª categoría (Régimen B).
- El bono Régimen A se deposita en la cuenta al momento del retiro (no durante la acumulación).
- Aporte sugerido en la interfaz: 5% de la renta imponible.

Fuente: `pages/datos.html` (campos `apvMensual`, `regimenAPV`, `saldoAPV`), `pages/brechas.html:renderPlanAccion`

---

## 26. Lagunas Previsionales

Porcentaje de meses en que el afiliado no cotizó. Reduce el score y activa advertencias en el plan de acción.

| Nivel | Alerta |
|---|---|
| 0% | Sin advertencia |
| 1%–19% | Informativo |
| ≥ 20% | Advertencia de impacto significativo en pensión |

Fuente: `pages/datos.html` (campo `lagunas`), `js/calculos.js:calcularScore`, `pages/brechas.html:renderPlanAccion`

---

## 27. Campos Adicionales de Datos del Afiliado

Incorporados en `pages/datos.html` para cálculos de score, plan de acción y pensión de sobrevivencia:

| Campo | Descripción |
|---|---|
| `estadoLaboral` | Dependiente / Independiente / Jubilado |
| `edadJubilacion` | Edad objetivo de jubilación (default: 65 hombres / 60 mujeres) |
| `rentaImponible` | Renta imponible mensual (CLP) — validada contra tope 87.8×UF |
| `rentaBruta` | Renta bruta referencial |
| `lagunas` | % de meses sin cotización (0–100) |
| `apvMensual` | Aporte APV mensual (CLP) |
| `regimenAPV` | Régimen APV: A o B |
| `saldoAPV` | Saldo APV acumulado (CLP) |
| `estadoCivil` | soltero / casado / conviviente / divorciado / viudo |
| `tienePareja` | true si casado o conviviente civil |
| `edadConyuge` | Edad del cónyuge (visible solo si tienePareja) |
| `sexoConyuge` | Sexo del cónyuge (M/F) |
| `numHijosMenores` | Número de hijos menores de 18 años |
| `numHijosEstudiantes` | Número de hijos entre 18 y 24 años que estudian |
| `numHijosInvalidos` | Número de hijos con invalidez permanente (cualquier edad) |

> **Compat.:** el campo `numHijos = numHijosMenores + numHijosEstudiantes` también se guarda en Store para compatibilidad con funciones que no distinguen tipo.

Fuente: `pages/datos.html`, `js/store.js`

---

## 28. Advertencia Legal

> Esta calculadora es de uso **informativo**. Los valores son estimaciones basadas en tablas de mortalidad RV-2020 / B-2020 y la metodología del **DL 3.500**. Consulta a un asesor previsional certificado (CFP o asesor autorizado por SP Chile) antes de tomar decisiones de jubilación.

---

## 29. CNU Familiar — `calcularCNUFamiliar`

Calcula el **Capital Necesario Unitario total** del grupo familiar del afiliado. Un CNU mayor implica una pensión mensual menor, dado que el mismo saldo debe financiar a más beneficiarios.

**Firma:**
```js
calcularCNUFamiliar(edad, sexo, familia, factorTabla = 1.0)
```

- `factorTabla = 1.0` para RP (tablas B-2020)
- `factorTabla = 1.08` para RV (aproximación tablas RV-2020)

**Objeto `familia` esperado:**
```js
{
  tienePareja: boolean,
  edadConyuge: number,
  sexoConyuge: 'M' | 'F',
  numHijosMenores: number,       // < 18 años
  numHijosEstudiantes: number,   // 18–24 años estudiando
  numHijosInvalidos: number      // cualquier edad, permanente
}
```

**Fórmula:**
```
cnuAfiliado = getCRU(sexo, edad) × factorTabla

// Cónyuge — RENTA REVERSIONAL (el cónyuge cobra solo tras fallecimiento del afiliado):
tieneHijosComunes = (numHijosMenores + numHijosEstudiantes + numHijosInvalidos) > 0
pctConyuge = tieneHijosComunes ? 0.50 : 0.60
cruConyuge = getCRUExtrapolado(sexoConyuge, edadConyuge)   // extrapola para edades jóvenes
cruReversional = getCRUReversional(getCRU(sexo, edad), cruConyuge)
cnuConyuge = pctConyuge × cruReversional × factorTabla

// Hijos menores (< 18 años): renta temporal de 108 meses
cnuMenor = calcularAnualidadLimitada(108) × factorTabla × 0.15   [por hijo]

// Hijos estudiantes (18–24): renta temporal de 36 meses
cnuEstudiante = calcularAnualidadLimitada(36) × factorTabla × 0.15   [por hijo]

// Hijos inválidos: vitalicio desde edad proxy = 25
cnuInvalido = getCRUExtrapolado('F', 25) × factorTabla × 0.15   [por hijo]

cnuHijos = Σ cnuMenor + Σ cnuEstudiante + Σ cnuInvalido
cnuTotal = cnuAfiliado + cnuConyuge + cnuHijos
```

**Anualidad limitada a N meses:**
```
calcularAnualidadLimitada(n) = Σ(k=1..n) (1 + TASA_RP)^(-k)
                              = (1 - (1 + TASA_RP)^(-n)) / TASA_RP
```

**Retorno:**
```js
{
  cnuTotal,       // CNU del grupo completo (divisor para pensión)
  cnuAfiliado,    // CNU solo del afiliado
  cnuConyuge,     // contribución del cónyuge al CNU
  cnuHijos,       // contribución total de todos los hijos
  factorFamilia,  // cnuTotal / cnuAfiliado (cuántas veces más capital se necesita)
  tieneImpacto    // true si hay al menos un beneficiario
}
```

Fuente: `js/calculos.js:calcularCNUFamiliar`, `js/mortalidad.js:getCRUReversional`, `js/mortalidad.js:getCRUExtrapolado`

---

## 30. Impacto del Grupo Familiar en la Pensión

Cuando el afiliado tiene beneficiarios (cónyuge, hijos), tanto RP como RV calculan **dos pensiones**:

| Campo | Descripción |
|---|---|
| `pension` | Pensión real considerando grupo familiar (más baja) |
| `pensionSinFamilia` | Pensión hipotética si estuviera solo (referencia) |
| `impactoFamilia` | `pensionSinFamilia - pension` (reducción en CLP) |
| `cnuDetalle` | Desglose completo de `calcularCNUFamiliar` |

**Presentación en la interfaz:**
- `proyeccion.html` — avisos `rpImpactoFamilia` / `rvImpactoFamilia`: "sin beneficiarios serías $X; tu grupo familiar reduce la pensión en $Y (Z% menos)"
- `modalidades.html` — hint bajo cada pensión: `↓ $X por grupo familiar (Y%)`; tabla RP año a año muestra `(sin familia: $X)` en gris
- `brechas.html` — ítem del plan de acción informando la reducción por CNU familiar

**La reducción es permanente:** el afiliado no puede optar entre incluir o excluir beneficiarios — la ley obliga a cubrir al grupo familiar en la modalidad elegida.

Fuente: `pages/proyeccion.html`, `pages/modalidades.html`, `pages/brechas.html`

---

## 31. Saldo Efectivo Canónico

**Todas las páginas** (`proyeccion.html`, `modalidades.html`, `brechas.html`, `informe.html`) deben usar la misma fórmula de saldo efectivo:

```js
const saldoEfectivo = (d.saldoTotal || 0) + (d.saldoAPV || 0) + (d.bonoReconocimiento || 0);
```

| Componente | Campo store | Descripción |
|---|---|---|
| `saldoTotal` | obligatorio | Saldo AFP (obligatorio + voluntario AFP) |
| `saldoAPV` | opcional | Saldo APV acumulado en institución APV |
| `bonoReconocimiento` | opcional | Bono de reconocimiento IPS (valor actualizado) |

> **Regla de consistencia:** nunca pasar `d.saldoTotal` directamente a `calcularPensionRP` / `calcularPensionRV`. Siempre computar `saldoEfectivo` primero. Esta es la fuente de verdad para el saldo a la fecha de jubilación.

---

## 32. Procesadores por Tipo de Jubilación

`js/calculos.js` expone un **dispatcher** y cuatro procesadores especializados. Cada procesador retorna un objeto con la misma forma base `{ acceso, rp, rv }` (excepto invalidez que retorna `{ invalidez }`).

### Dispatcher principal

```js
procesarPension(d, uf, comisionDec, familia)
```

Lee `d.tipoJubilacion` y delega al procesador correspondiente. Calcula `saldoEfectivo` internamente.

| `tipoJubilacion` | Procesador |
|---|---|
| `'vejez_normal'` | `procesarVejezNormal` |
| `'anticipada'` | `procesarAnticipada` |
| `'trabajo_pesado'` | `procesarTrabajoPesado` |
| `'invalidez'` | `procesarInvalidez` |

### `procesarVejezNormal({ saldo, edad, sexo, uf, comisionDec, familia, anioJubilacion })`

```
edadLegal = sexo === 'F' ? 60 : 65
acceso.cumple = edad >= edadLegal
```
Retorna `{ acceso, rp, rv }` con RP y RV calculados normalmente.

### `procesarAnticipada({ ..., rentaPromedioDecenio, rentaImponible })`

Requiere que la pensión RP sea ≥ 80% del promedio de renta imponible del decenio **y** ≥ 80% de la pensión media imponible (Art. 68 DL 3.500). Solo se permite si el afiliado no ha alcanzado la edad legal.

```
pctDecenio = rp.pension / rentaPromedioDecenio
pctMedio   = rp.pension / (rentaImponible × 0.80)
acceso.cumple = pctDecenio >= 0.80 && pctMedio >= 0.80
```

### `procesarTrabajoPesado({ ..., tipoTrabajoPesado, mesesTrabajoPesado })`

Ley 19.404. El afiliado acumula rebaja de edad de jubilación.

| Tipo | Rebaja por año cotizado | Máximo |
|---|---|---|
| Tipo 2 — Pesado | 0,2 años | 5 años |
| Tipo 1 — Muy pesado | 0,4 años | 10 años |

```
añosCotizadosTP = mesesTrabajoPesado / 12
rebaja = min(cotizado × tasaRebaja, máxRebaja)
edadAcceso = edadLegal - rebaja
acceso.cumple = edad >= edadAcceso
```

### `procesarInvalidez({ saldo, edad, sexo, uf, comisionDec, anioJubilacion, tipoInvalidez, rentaPromedioInvalidez })`

Ver regla 33 para detalle.

Fuente: `js/calculos.js`

---

## 33. Pensión de Invalidez (Art. 54 DL 3.500)

**Tipos de invalidez:**

| Tipo | Criterio médico | Monto base |
|---|---|---|
| Total | Pérdida capacidad laboral ≥ 2/3 | 100% de `saldo / CRU` |
| Parcial | Pérdida ≥ 50% y < 2/3 | 50% de `saldo / CRU` |

**Cálculo base:**
```
cruBase = calcularCRU_RP(sexo, edad, TASA_RP, anioJubilacion)
brutaBase = saldo / cruBase
pensionBruta = tipo === 'parcial' ? brutaBase × 0.5 : brutaBase
```

**Complemento SIS (Seguro de Invalidez y Sobrevivencia):**

El SIS complementa la pensión hasta el 70% de la renta promedio del decenio (con tope en el 70% del tope imponible = 87.8 UF).

```
topeImponible = 87.8 × uf
rentaRef = rentaPromedioInvalidez || 0
limSIS = min(rentaRef × 0.70, 0.70 × topeImponible)
complementoSIS = max(0, limSIS - pensionBruta)
pensionTotal = pensionLiquida + complementoSIS
```

> El SIS es pagado por el empleador (1,54% del salario imponible). El complemento aplica solo si la pensión autofinanciada es menor que el 70% de la renta de referencia.

**UI en `datos.html`:** nuevo panel `#panelInvalidez` visible solo cuando `tipoJubilacion === 'invalidez'`. Incluye radio `total/parcial` y campo `rentaPromedioInvalidez`.

**UI en `proyeccion.html`:** cuando `tipoJubilacion === 'invalidez'`, se oculta la grilla RP/RV y se muestra `#panelInvalidezResultado` con los campos `pensionBruta`, `pensionNeta`, `complementoSIS`, `pensionTotal`.

Fuente: `js/calculos.js:procesarInvalidez`, `pages/datos.html`, `pages/proyeccion.html`

---

## 34. Mejoramiento CRU — NCG N°306 (Tablas Generacionales AAx)

La Superintendencia de Pensiones aplica factores de mejoramiento de mortalidad (mejoramiento generacional) desde el año base 2020.

**Regla de implementación:**

| Sexo | Función | Razón |
|---|---|---|
| Hombre | `calcularCNUConMejoramiento(edad, anioJubilacion, TASA_RP)` | Tabla AAx consistente ✓ |
| Mujer | `getCRU('F', edad)` (valor raw tablas.json) | Tabla b2020_mujer inconsistente (~6.8% error) — se usa valor pre-calculado directamente |

```js
// calcularCRU_RP (función interna de calculos.js)
function calcularCRU_RP(sexo, edad, tasa, anioJubilacion) {
  if (sexo === 'M') return calcularCNUConMejoramiento(edad, anioJubilacion, tasa);
  return getCRU('F', edad);   // raw pre-calculado (mujer)
}
```

**Factor de mejoramiento:**
```
deltaAnios = anioJubilacion - 2020
factorAAx  = 1 + (deltaAnios × tasaMejoraAnual)   // estimación lineal
cnuMejorado = cnuBase × factorAAx
```

> **Validación SCOMP:** para hombre 62 años, AFP Capital, saldo $160.866.522, la diferencia entre el cálculo con mejoramiento y el SCOMP oficial fue de **0,13%** ($946.241 vs $947.436).

Fuente: `js/calculos.js:calcularCRU_RP`, `js/calculos.js:calcularCNUConMejoramiento`, NCG N°306

---

## 35. Campos Store para Tipos de Jubilación Especiales

Campos adicionales guardados en `localStorage` (`pension_chile_v1`) según el tipo de jubilación:

| Campo | Tipo jubilación | Descripción |
|---|---|---|
| `tipoJubilacion` | todos | `'vejez_normal'` \| `'anticipada'` \| `'trabajo_pesado'` \| `'invalidez'` |
| `edadJubilacion` | todos | Edad de acceso calculada (puede diferir de la legal) |
| `tipoTrabajoPesado` | trabajo_pesado | `'tipo1'` (0.4/año, máx 10) o `'tipo2'` (0.2/año, máx 5) |
| `mesesTrabajoPesado` | trabajo_pesado | Meses cotizados bajo régimen pesado |
| `rentaPromedioDecenio` | anticipada | Promedio renta imponible últimos 10 años (CLP) |
| `tipoInvalidez` | invalidez | `'total'` o `'parcial'` |
| `rentaPromedioInvalidez` | invalidez | Renta promedio del decenio para cálculo complemento SIS (CLP) |

Fuente: `pages/datos.html`, `js/store.js`
