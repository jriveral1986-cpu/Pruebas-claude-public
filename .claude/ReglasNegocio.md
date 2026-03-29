# Reglas de Negocio — Calculadora Previsional Chile (versión corregida)

**Fecha de actualización documental:** 29-03-2026  
**Estado:** corregido para uso funcional/documental  
**Objetivo:** dejar separadas las reglas **normativas**, las reglas **paramétricas** y las reglas **heurísticas** del sistema.

---

## 1. Criterio de uso del documento

Este documento **sí puede usarse como referencia funcional**, pero con la siguiente convención:

- **Normativa:** regla legal o regulatoria que debe modelarse de forma exacta.
- **Paramétrica:** valor vigente que debe mantenerse configurable por fecha de vigencia.
- **Heurística / simulación:** aproximación interna del sistema; **no** debe presentarse como regla legal exacta.

> Regla principal: ninguna aproximación actuarial, visual o comercial debe quedar documentada como si fuera una obligación legal del sistema chileno de pensiones.

---

## 2. Parámetros normativos base del sistema AFP

### 2.1 Cotización obligatoria

| Regla | Valor | Tipo |
|---|---:|---|
| Cotización obligatoria cuenta individual | 10% de la remuneración o renta imponible | Normativa |
| SIS | 1,54% de la remuneración o renta imponible | Paramétrica |
| Edad legal de pensión vejez hombre | 65 años | Normativa |
| Edad legal de pensión vejez mujer | 60 años | Normativa |
| Tope imponible mensual 2026 | 90,0 UF | Paramétrica |

### 2.2 Fórmulas base

```txt
cotizacion_obligatoria = renta_imponible * 0.10
sis = renta_imponible * 0.0154
tope_imponible_clp = round(90.0 * UF)
renta_imponible_efectiva = min(renta_imponible, tope_imponible_clp)
```

### 2.3 Regla de implementación

- El tope imponible debe quedar **parametrizado por vigencia**, no hardcodeado.
- El sistema no debe seguir usando `87.8 × UF` como valor general 2026.
- Si se calcula costo previsional total, debe distinguirse entre:
  - cotización obligatoria a la cuenta individual,
  - SIS,
  - comisión AFP,
  - otros componentes laborales que no son parte de la pensión autofinanciada.

---

## 3. AFP y comisiones

### 3.1 Naturaleza correcta de la comisión

La comisión AFP de la cuenta obligatoria se cobra como **porcentaje mensual sobre la remuneración o renta imponible**, no como tasa anual dividida por 12.

### 3.2 Comisiones vigentes documentadas

| AFP | Comisión mensual sobre remuneración imponible |
|---|---:|
| Uno | 0,46% |
| Modelo | 0,58% |
| Hábitat | 1,27% |
| PlanVital | 1,16% |
| Capital | 1,44% |
| Cuprum | 1,44% |
| Provida | 1,45% |

### 3.3 Fórmula correcta

```txt
comision_mensual = renta_imponible_efectiva * (comision_pct / 100)
```

### 3.4 Corrección obligatoria

**No usar**:

```txt
salario * (comision / 100) / 12
```

porque eso supone erróneamente que la comisión publicada fuera anual.

---

## 4. Fondos de pensión

| Fondo | Perfil |
|---|---|
| A | Más riesgoso |
| B | Riesgoso |
| C | Intermedio |
| D | Conservador |
| E | Más conservador |

> Esta clasificación es informativa y no altera directamente las reglas de cálculo de pensión del sistema, salvo en simulaciones de rentabilidad o perfil de inversión.

---

## 5. Indicadores económicos y fuentes operativas

| Indicador | Fuente operativa | Observación |
|---|---|---|
| UF | API o fuente oficial parametrizable | Debe persistirse con fecha de consulta |
| UTM | API o fuente oficial parametrizable | Debe persistirse con fecha de consulta |
| Valor cuota AFP | SP / caché / respaldo local | Debe quedar trazabilidad de fecha y AFP |

### Regla técnica

Todo cálculo debe registrar:

```txt
- fecha_valor_uf
- fecha_valor_utm
- fecha_valor_cuota
- afp_seleccionada
- fuente_parametro
```

---

## 6. Saldo efectivo canónico

La fuente de verdad del saldo a pensionar debe ser:

```js
const saldoEfectivo = (d.saldoTotal || 0) + (d.saldoAPV || 0) + (d.bonoReconocimiento || 0);
```

| Componente | Campo | Tipo |
|---|---|---|
| Saldo obligatorio AFP | `saldoTotal` | Paramétrico |
| APV acumulado | `saldoAPV` | Paramétrico |
| Bono de reconocimiento | `bonoReconocimiento` | Paramétrico |

### Regla funcional

Nunca debe enviarse solo `saldoTotal` al motor si existe saldo APV y/o bono de reconocimiento disponible para financiar la pensión.

---

## 7. Retiro Programado (RP)

### 7.1 Regla normativa base

El retiro programado es la modalidad en que la pensión se recalcula periódicamente dividiendo el saldo real por el capital necesario para pagar una unidad de pensión al afiliado y, al fallecimiento de éste, a sus beneficiarios.

### 7.2 Tasa de interés 2026

Para los cálculos y recálculos que corresponden a partir de enero de 2026, la tasa informada por la SP para nuevos retiros programados y rentas temporales es **3,31%**.

### 7.3 Fórmula funcional esperada

```txt
pension_rp_uf = saldo_real_uf / capital_necesario_unitario
pension_rp_clp = pension_rp_uf * UF
```

### 7.4 Regla de consistencia obligatoria

Si el sistema usa:

- tasa RP vigente = **3,31%**, pero
- tablas CRU pre-calculadas con **3,00%**,

entonces el cálculo queda internamente inconsistente.

**Acción requerida:** elegir una sola de estas estrategias:

1. recalcular CRU/CNU con la tasa vigente; o
2. documentar expresamente que las tablas son una aproximación y no un cálculo normativo exacto.

### 7.5 Con grupo familiar

La existencia de beneficiarios sí afecta el divisor del retiro programado. Sin embargo, la construcción del CNU familiar debe distinguir entre:

- parte normativa,
- supuestos actuariales del motor,
- simplificaciones de interfaz.

---

## 8. Renta Vitalicia (RV)

### 8.1 Regla documental correcta

La renta vitalicia es una modalidad contractual con una compañía de seguros y debe documentarse como tal.

### 8.2 Corrección importante

El uso de:

```txt
CRU_RV = CRU_B2020 * 1.08
```

o de `factorTabla = 1.08` es una **aproximación interna**, útil para simulación, pero **no debe presentarse como fórmula legal exacta** de renta vitalicia.

### 8.3 Cómo debe quedar documentado

- **Normativa:** la RV usa tablas y metodología propias del régimen aplicable.
- **Motor actual:** si se utiliza un factor 1,08 sobre B-2020, debe rotularse como **estimación comparativa**.

---

## 9. CRU / CNU / tablas de mortalidad

### 9.1 Regla documental

- Las tablas B-2020 y RV-2020 son insumo normativo/técnico.
- Las tablas pre-calculadas de `CRU` y la interpolación/extrapolación son una **implementación propia del sistema**.

### 9.2 Corrección obligatoria de rotulado

Los siguientes elementos deben quedar marcados como **heurística actuarial** y no como regla legal:

- `getCRUExtrapolado()` para edades fuera de rango,
- uso de pendientes lineales para edades jóvenes,
- uso de un sexo/edad proxy fijo para hijos inválidos,
- anualidad reversional construida desde CRU implícito,
- cualquier simplificación de tipo `factorTabla = 1.08`.

### 9.3 Regla recomendada

El documento debe distinguir siempre:

```txt
CRU legal/técnico de referencia != implementación pre-calculada del motor
```

---

## 10. Pensión de vejez anticipada

### 10.1 Regla correcta

La pensión anticipada requiere cumplir **simultáneamente**:

1. una pensión igual o superior al **70%** del promedio de las remuneraciones imponibles y rentas declaradas, según artículo 63 del DL 3.500; y
2. una pensión igual o superior a **12 UF**.

### 10.2 Requisito adicional de afiliación

Debe existir además el requisito de antigüedad/afiliación que corresponda según normativa del sistema.

### 10.3 Fórmula funcional esperada

```txt
cumple_70pct = pension_referencia >= promedio_120_meses * 0.70
cumple_12uf  = pension_referencia_uf >= 12
acceso_anticipada = cumple_70pct && cumple_12uf
```

### 10.4 Corrección obligatoria

Eliminar del documento la regla anterior basada en “80% y 80%”, porque **no corresponde a la regla vigente**.

---

## 11. Trabajo pesado

### 11.1 Requisitos correctos

Para acceder a rebaja de edad por trabajo pesado deben verificarse copulativamente:

1. trabajo calificado como pesado por la CEN,
2. cotización adicional de **1% o 2%** según corresponda,
3. al menos **20 años de cotizaciones** en cualquier sistema previsional.

### 11.2 Rebaja de edad

| Cotización adicional | Rebaja |
|---|---|
| 1% | 1 año por cada 5 años, tope 5 años |
| 2% | 2 años por cada 5 años, tope 10 años |

### 11.3 Regla funcional esperada

```txt
años_tp = mesesTrabajoPesado / 12
rebaja = segun_tasa_adicional(años_tp)
edad_acceso = edad_legal - rebaja
acceso = cumple_requisitos_tp && edad >= edad_acceso
```

### 11.4 Corrección obligatoria

No basta con calcular solo la rebaja de edad. El motor debe validar además:

- existencia de trabajo pesado reconocido,
- tasa adicional correcta,
- total de años cotizados.

---

## 12. Pensión de invalidez

### 12.1 Regla normativa base

La invalidez se define por pérdida permanente de capacidad de trabajo y utiliza como base el **ingreso base** y la cobertura del SIS, no simplemente `saldo / CRU` como regla legal general.

### 12.2 Pensiones de referencia

| Tipo | Referencia normativa |
|---|---:|
| Invalidez total | 70% del ingreso base |
| Invalidez parcial | 50% del ingreso base |

### 12.3 Corrección obligatoria

La documentación **no debe afirmar** como regla legal que:

```txt
invalidez total = 100% de saldo / CRU
invalidez parcial = 50% de saldo / CRU
```

Eso puede usarse como **simulación interna**, pero no como descripción normativa del sistema.

### 12.4 Regla documental correcta

- **Normativa:** el beneficio depende de ingreso base, dictamen y cobertura del SIS.
- **Motor interno:** si se usa saldo/CRU como aproximación base, debe quedar expresamente rotulado como **estimación simplificada**.

---

## 13. Pensión de sobrevivencia

### 13.1 Porcentajes correctos a documentar

| Beneficiario/a | Porcentaje |
|---|---:|
| Cónyuge | 60% |
| Cónyuge con hijos con derecho | 50% |
| Hijo/a menor de 18 años | 15% |
| Hijo/a estudiante menor de 24 años | 15% |
| Hijo/a inválido parcial mayor de 24 años | 11% |
| Padre o madre de hijo/a de filiación no matrimonial | 36% |
| Padre o madre de hijo/a de filiación no matrimonial con hijos con derecho | 30% |
| Padres reconocidos como cargas familiares | 50% |

### 13.2 Requisitos que deben quedar documentados

- Cónyuge: plazos mínimos de matrimonio según si el causante estaba activo o pensionado, salvo excepciones legales.
- Hijos/as: requisitos etarios, de estudios o invalidez.
- Padres del causante: solo a falta de otros beneficiarios y si eran cargas reconocidas.

### 13.3 Corrección obligatoria

La documentación anterior estaba **incompleta**. No debe limitarse solo a:

- cónyuge 60/50,
- hijos 15%,
- tope 100%.

Debe incluir también:

- 36% / 30% para padre o madre de hijo/a de filiación no matrimonial,
- 11% para hijos inválidos parciales mayores de 24,
- 50% para padres reconocidos como carga, a falta de otros beneficiarios.

### 13.4 Regla de implementación

Si el motor realiza prorrateo cuando la suma supera 100%, debe documentarse como **mecánica de distribución del sistema/modelo**, no como sustituto de los requisitos de elegibilidad.

---

## 14. PGU — Pensión Garantizada Universal

### 14.1 Parámetros 2026 documentados

| Parámetro | Valor |
|---|---:|
| PGU personas menores de 82 años | $231.732 |
| PGU personas de 82 años o más | $250.275 |
| Pensión inferior | $789.139 |
| Pensión superior | $1.252.602 |

### 14.2 Regla documental correcta

La PGU debe modelarse con parámetros vigentes y con la base normativa que corresponda según la regulación aplicable.

### 14.3 Corrección obligatoria

No dejar documentado de forma categórica que:

```txt
pension_base_pgu = pension_liquida
```

como si fuera la regla universal del beneficio. Si el motor usa ese valor como simplificación, debe quedar rotulado como **aproximación funcional** y no como exactitud normativa.

### 14.4 Regla de implementación recomendada

- parametrizar montos por fecha de vigencia,
- aislar el cálculo de PGU en un módulo propio,
- documentar explícitamente cuándo se usa cálculo simplificado versus cálculo normativo completo.

---

## 15. Impuesto Único de Segunda Categoría

### 15.1 Regla documental correcta

El impuesto debe calcularse usando la **tabla mensual vigente del SII** para el mes de cálculo, sobre la renta líquida imponible que corresponda.

### 15.2 UTM marzo 2026

```txt
UTM marzo 2026 = $69.889
```

### 15.3 Tabla mensual marzo 2026 (SII)

| Tramo mensual | Factor | Rebaja |
|---|---:|---:|
| Hasta $943.501,50 | Exento | - |
| $943.501,51 a $2.096.670,00 | 0,04 | $37.740,06 |
| $2.096.670,01 a $3.494.450,00 | 0,08 | $121.606,86 |
| $3.494.450,01 a $4.892.230,00 | 0,135 | $313.801,61 |
| $4.892.230,01 a $6.290.010,00 | 0,23 | $778.563,46 |
| $6.290.010,01 a $8.386.680,00 | 0,304 | $1.244.024,20 |
| $8.386.680,01 a $21.665.590,00 | 0,35 | $1.629.811,48 |
| Desde $21.665.590,01 | 0,40 | $2.713.090,98 |

### 15.4 Fórmula

```txt
impuesto = max(0, renta_liquida_imponible * factor - rebaja)
```

### 15.5 Corrección obligatoria

No usar una tabla simplificada basada solo en UTM si no coincide exactamente con la tabla mensual vigente del SII.

---

## 16. Pensión mínima garantizada / referencias mínimas

### Corrección obligatoria

Eliminar o dejar como **obsoleto/no aplicable** el texto:

```txt
pension_minima_garantizada = $214.000
```

si se presenta como piso general vigente del sistema.

### Regla documental correcta

- No usar ese valor como regla general de cálculo previsional 2026.
- Si se necesita mantener un campo histórico en `tablas.json`, debe quedar marcado como:
  - `deprecated`,
  - `no usar en cálculos vigentes`,
  - `solo referencia histórica`.

---

## 17. APV

### 17.1 Régimen A

| Regla | Valor |
|---|---:|
| Bonificación estatal | 15% del ahorro anual |
| Tope anual de bonificación | 6 UTM |

### 17.2 Régimen B

- El ahorro se rebaja de la base imponible tributaria según corresponda.

### 17.3 Regla documental

El APV sí puede mantenerse como se encontraba documentado, pero distinguiendo correctamente entre:

- efecto tributario,
- efecto en saldo final para pensión,
- sugerencias de interfaz (que no son norma).

---

## 18. Beneficios de la reforma 2026 que faltaba documentar

### 18.1 Beneficio por Años Cotizados (BAC)

Debe incorporarse como módulo/documentación vigente 2026.

Regla general documentable:

```txt
BAC = años_cotizados * 0,1 UF
```

con tope de **2,5 UF** y reglas especiales según stock/flujo, fecha de pensión y anualidad BAC cuando corresponda.

### 18.2 Compensación por Diferencias de Expectativa de Vida (CEV)

Debe incorporarse como beneficio vigente 2026 para mujeres que cumplan los requisitos legales. No debe omitirse si la calculadora se presenta como actualizada a 2026.

---

## 19. Heurísticas y simulaciones del sistema (permitidas, pero no normativas)

Las siguientes reglas **pueden mantenerse en el producto**, pero deben rotularse como estimaciones o ayudas de decisión:

| Regla | Clasificación |
|---|---|
| `factorTabla = 1.08` para RV | Heurística actuarial |
| Comparativa por AFP con factor `0.5` | Heurística comparativa |
| Simulador de longevidad con factor `0.75` para RP | Heurística visual |
| Score previsional 0–100 | Heurística UX |
| Semáforo verde/amarillo/rojo | Heurística UX |
| Recomendación automática de modalidad familiar | Heurística comercial/UX |
| Proxy fijo para hijos inválidos | Heurística actuarial |
| Rentas temporales de hijos como 108/36 meses planas | Simplificación actuarial |

### Regla de rotulado obligatorio

Cada una de estas piezas debe aparecer en documentación y UI como una de estas dos etiquetas:

- `Estimación interna`
- `Simulación orientativa`

Nunca como:

- `regla legal`,
- `resultado oficial`,
- `cálculo normativo exacto`.

---

## 20. Dispatcher por tipo de jubilación

### 20.1 Estructura recomendada

```txt
vejez_normal
anticipada
trabajo_pesado
invalidez
```

### 20.2 Corrección funcional mínima

- `vejez_normal`: correcto si valida edad legal.
- `anticipada`: debe reemplazarse por regla **70% + 12 UF**.
- `trabajo_pesado`: debe validar requisitos completos, no solo edad rebajada.
- `invalidez`: no debe documentarse como simple derivación de `saldo / CRU`.

---

## 21. Persistencia / store

Los campos del `localStorage` pueden mantenerse, pero con las siguientes correcciones:

### 21.1 Corregir campos dependientes de parámetros vigentes

- `topeImponible` debe pasar a **90.0 × UF** para 2026.
- `comisionDec` debe derivarse desde una comisión **mensual**.
- `pguRP` / `pguRV` no deben depender de una simplificación mal rotulada como normativa.

### 21.2 Nuevos campos sugeridos

```txt
fechaVigenciaParametros
origenComisionAFP
origenTopeImponible
origenPGU
usaModeloSimplificadoPGU
usaModeloSimplificadoRV
```

---

## 22. Advertencia legal recomendada

> Esta calculadora es de uso informativo y de simulación. Algunos resultados corresponden a estimaciones internas basadas en parámetros vigentes y modelos simplificados. Las decisiones de pensión deben validarse con información oficial de AFP, IPS, compañías de seguros, SCOMP y normativa vigente de la Superintendencia de Pensiones.

---

## 23. Resumen ejecutivo de correcciones obligatorias

### Corregir sí o sí

1. Comisión AFP: pasar de “anual/12” a **mensual sobre imponible**.
2. Tope imponible: pasar de **87,8 UF** a **90,0 UF** para 2026.
3. Pensión anticipada: reemplazar por **70% + 12 UF**.
4. Trabajo pesado: validar además **CEN + 1%/2% + 20 años cotizados**.
5. Invalidez: no documentar `saldo/CRU` como regla legal general.
6. Sobrevivencia: incorporar porcentajes faltantes (36%, 30%, 11%, 50%).
7. PGU: no equiparar automáticamente “pensión base” con “pensión líquida” como regla universal.
8. Impuesto: usar tabla mensual oficial SII vigente.
9. Pensión mínima garantizada `$214.000`: eliminar como regla general vigente.
10. Marcar todas las heurísticas como **simulación**.

### Mantener, pero bien rotulado

- score previsional,
- semáforos,
- comparativas AFP,
- simulador de longevidad,
- recomendación de modalidad,
- aproximación RV con factor 1,08.

---

## 24. Fuentes oficiales utilizadas para esta corrección

### Superintendencia de Pensiones

- Comisiones AFP: https://www.spensiones.cl/portal/institucional/594/w3-article-2810.html
- Sistema AFP / parámetros generales: https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9893.html
- Tope imponible 2026: https://www.spensiones.cl/portal/institucional/594/w3-article-16921.html
- Pensión de vejez / anticipada: https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9921.html
- Requisitos anticipada (compendio): https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-3200.html
- Excedente de libre disposición / pensión mínima requerida: https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-3226.html
- Trabajo pesado: https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9918.html
- Rebaja por trabajo pesado: https://www.spensiones.cl/portal/institucional/594/w3-article-2903.html
- Pensión de invalidez: https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9923.html
- Pensiones de referencia invalidez/sobrevivencia: https://www.spensiones.cl/portal/institucional/594/w3-article-2959.html
- Pensión de sobrevivencia: https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9922.html
- Tasa RP 2026: https://www.spensiones.cl/apps/tasas/tasdescto.php
- Circular 2407: https://www.spensiones.cl/apps/GetFile.php?id=001&namefile=CAFP2407.pdf
- PGU 2026: https://www.spensiones.cl/portal/institucional/594/w3-article-16886.html
- PGU general: https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-10531.html
- BAC: https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10829.html
- CEV: https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10834.html
- CEV cálculo: https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10835.html

### Servicio de Impuestos Internos

- Impuesto único segunda categoría 2026: https://www.sii.cl/valores_y_fechas/impuesto_2da_categoria/impuesto2026.htm
- UTM 2026: https://www.sii.cl/valores_y_fechas/utm/utm2026.htm

---

## 25. Estado final del documento

**Conclusión funcional:**

Este documento reemplaza la versión anterior como referencia recomendada para:

- ajuste del motor de cálculo,
- revisión de reglas de negocio,
- documentación técnica/funcional,
- priorización de correcciones.

**No reemplaza** la validación jurídica o actuarial final si el sistema será usado para decisiones reales de pensión, oferta comercial o entrega de montos con pretensión oficial.
