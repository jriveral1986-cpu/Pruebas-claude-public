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
**Tasa técnica:** 3% real anual

**Fórmula:**
```
pensión_RP = saldo_total / CRU_B2020(sexo, edad)
```

Donde `CRU` (Capital Requerido Unitario) es el valor presente de una renta vitalicia de $1/mes a la edad dada, calculado con la tabla B-2020 a tasa de descuento 3% real anual.

**Años estimados del fondo** (a cuántos años alcanza el fondo con la pensión RP):
```
n = -ln(1 - saldo × r / pensión) / ln(1 + r)   [en meses → dividir por 12]
r = (1.03)^(1/12) - 1   (tasa mensual equivalente al 3% anual)
```
Si `saldo × r / pensión ≥ 1`, el fondo es efectivamente ilimitado (se retorna 35 años).

**Equivalente en UF:**
```
pensión_UF = pensión_CLP / UF
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

Compara la pensión estimada con la pensión objetivo del usuario.

```
brecha_absoluta = pensión_objetivo - pensión_estimada_RP
brecha_porcentual = (brecha_absoluta / pensión_objetivo) × 100
suficiente = brecha_absoluta ≤ 0
cobertura_pct = min(100, pensión_estimada_RP / pensión_objetivo × 100)
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
| `pensionRP` | Pensión Retiro Programado estimada |
| `pensionRV` | Pensión Renta Vitalicia estimada |
| `pensionObjetivo` | Pensión meta ingresada por el usuario |

Fuente: `js/store.js`

---

## 19. Advertencia Legal

> Esta calculadora es de uso **informativo**. Los valores son estimaciones basadas en tablas de mortalidad RV-2020 / B-2020 y la metodología del **DL 3.500**. Consulta a un asesor previsional certificado (CFP o asesor autorizado por SP Chile) antes de tomar decisiones de jubilación.
