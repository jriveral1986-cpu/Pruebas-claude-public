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
**Tasa técnica:** 3,31% real anual (Circular SP N°2407, enero 2026) → `TASA_RP = 0.0331 / 12` mensual

**Fórmula:**
```
pensión_RP_bruta = saldo_total / CRU_B2020(sexo, edad)
```

Donde `CRU` (Capital Requerido Unitario) es el valor presente de una renta vitalicia de $1/mes a la edad dada, calculado con la tabla B-2020 a tasa 3,31% real anual.

**Años estimados del fondo:**
```
n = -ln(1 - saldo × r / pensión) / ln(1 + r)   [en meses → dividir por 12]
r = (1.0331)^(1/12) - 1
```
Si `saldo × r / pensión ≥ 1` → se retorna 35 años.

**Equivalente en UF:**
```
pensión_UF = pensión_CLP / UF
```

**Resultado enriquecido** (`calcularPensionRP` retorna):
```
{ pension, pensionUF, pensionLiquida, desglose, pgu, pensionTotal, anosEstimados }
```

Fuente: `js/calculos.js:calcularPensionRP`

---

## 8. Pensión Estimada — Renta Vitalicia (RV)

**Tabla de mortalidad:** RV-2020 (más conservadora que B-2020)
**Tasa técnica:** 3% real anual

**Fórmula:**
```
pensión_RV = saldo_total / CRU_RV2020(sexo, edad)
CRU_RV2020 = CRU_B2020 × 1.08
```

El factor `1.08` modela la diferencia entre la tabla B-2020 (Retiro Programado) y RV-2020 (Renta Vitalicia). La RV usa un CRU mayor (más conservador) porque asume mayor esperanza de vida.

**Características de la RV:**
- Pensión fija reajustable en UF.
- El riesgo de longevidad lo asume la aseguradora.
- El saldo ya no es heredable (salvo período garantizado pactado).
- Contrato irrevocable con la compañía de seguros.

Fuente: `js/calculos.js:calcularPensionRV`

---

## 9. CRU — Capital Requerido Unitario

Pre-calculado en `data/tablas.json` para edades 55–75 (hombres) y 50–75 (mujeres).
Para edades intermedias se aplica **interpolación lineal** entre los valores disponibles.

| Edad | CRU Hombre | CRU Mujer |
|---|---|---|
| 55 | 228.4 | 243.6 |
| 60 | 197.9 | 216.8 |
| 65 | 169.9 | 191.5 |
| 70 | 144.4 | 167.9 |
| 75 | 121.4 | 146.2 |

Fuente: `data/tablas.json`, `js/mortalidad.js:getCRU`

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

Fuente: `pages/modalidades.html`

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

| Beneficiario | Porcentaje |
|---|---|
| Cónyuge / conviviente civil | 60% |
| Cada hijo < 18 años (o < 24 si estudia) | 15% |
| Cada hijo con invalidez permanente (sin límite de edad) | 15% de por vida |

**Tope:** La suma total no puede superar el 100% de la pensión de referencia. Si se supera, se aplica **prorrateo proporcional**:
```
factor_prorrateo = 1.0 / pct_total   (cuando pct_total > 1)
```

**Fórmula:**
```
montoCónyuge = round(pensión_ref × 0.60 × factor_prorrateo)
montoHijo    = round(pensión_ref × 0.15 × factor_prorrateo)   [por hijo]
totalSobrevivencia = round(pensión_ref × min(pct_total, 1.0))
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
| `numHijos` | Número de hijos menores de edad o estudiantes |
| `numHijosInvalidos` | Número de hijos con invalidez permanente |

Fuente: `pages/datos.html`, `js/store.js`

---

## 28. Advertencia Legal

> Esta calculadora es de uso **informativo**. Los valores son estimaciones basadas en tablas de mortalidad RV-2020 / B-2020 y la metodología del **DL 3.500**. Consulta a un asesor previsional certificado (CFP o asesor autorizado por SP Chile) antes de tomar decisiones de jubilación.
