# Reglas de Negocio — Calculadora / Motor Previsional Chile

**Versión:** ampliada, revisada y normalizada  
**Fecha de actualización:** 31-03-2026  
**Objetivo del documento:** consolidar, corregir y ampliar las reglas funcionales, normativas, paramétricas y técnicas de un sistema previsional chileno, separando explícitamente lo legalmente exigible de lo meramente estimativo.

---

## 0. Alcance del documento

Este documento está pensado para ser usado como:

- referencia funcional;
- base para desarrollo;
- insumo para QA;
- checklist de auditoría interna;
- guía de parametrización;
- documento de control de deuda técnica normativa.

No reemplaza:

- la validación jurídica final;
- la validación actuarial formal;
- la información oficial emitida por AFP, IPS, CMF, SCOMP o Superintendencia de Pensiones.

---

## 1. Convenciones obligatorias de documentación

Toda regla del sistema debe clasificarse en una de estas categorías:

| Tipo | Definición |
|---|---|
| **Normativa** | Regla legal o regulatoria que debe implementarse sin alteración conceptual. |
| **Paramétrica** | Valor vigente por fecha o período, que debe mantenerse versionado. |
| **Heurística** | Simplificación interna del sistema para simulación o UX. |
| **Técnica** | Regla de implementación, persistencia, trazabilidad, auditoría o integración. |

## 1.1 Regla maestra

> Ninguna heurística, factor comparativo, proxy familiar, extrapolación de tablas o aproximación comercial debe presentarse como si fuera una regla legal obligatoria del sistema previsional chileno.

---

## 2. Glosario funcional mínimo

| Sigla / concepto | Definición funcional |
|---|---|
| AFP | Administradora de Fondos de Pensiones |
| IPS | Instituto de Previsión Social |
| SP | Superintendencia de Pensiones |
| CMF | Comisión para el Mercado Financiero |
| SCOMP | Sistema de Consultas y Ofertas de Montos de Pensión |
| CCICO | Cuenta de Capitalización Individual de Cotizaciones Obligatorias |
| APV | Ahorro Previsional Voluntario |
| APVC | Ahorro Previsional Voluntario Colectivo |
| BR | Bono de Reconocimiento |
| RP | Retiro Programado |
| RV | Renta Vitalicia |
| RT | Renta Temporal |
| PGU | Pensión Garantizada Universal |
| PAFE | Pensión Autofinanciada de Referencia |
| BAC | Beneficio por Años Cotizados |
| CEV | Compensación por Diferencias de Expectativa de Vida |
| SIS | Seguro de Invalidez y Sobrevivencia |
| CNU / CRU | Capital necesario unitario o divisor funcional equivalente del motor |
| AAx,t | Factor de mejoramiento bidimensional por edad y año de proyección |

## 2.1 Normalización terminológica

Si en el proyecto aparecen nombres como:

- “bono por años de servicio”;
- “bono por años trabajados”;

deben normalizarse a:

- **Beneficio por Años Cotizados (BAC)**

porque ése es el nombre regulatorio correcto.

Si aparece una etiqueta como:

- “bono expectativa de vida mujer”;
- “bono expectativa mujer”;

debe normalizarse a:

- **Compensación por Diferencias de Expectativa de Vida (CEV)**

porque ésa es la denominación normativa correcta.

---

## 3. Datos mínimos de entrada del motor previsional

Toda simulación seria debe tener, como mínimo, los siguientes datos:

### 3.1 Identificación previsional del afiliado

- sexo;
- fecha de nacimiento;
- edad calculada;
- tipo de afiliación;
- AFP actual;
- estado pensionado / no pensionado;
- fecha de solicitud o fecha de cálculo;
- tipo de pensión solicitada;
- condición de afiliado activo, cesante o pensionado.

### 3.2 Datos económicos

- saldo obligatorio;
- saldo APV;
- depósitos convenidos, si corresponde;
- Bono de Reconocimiento, si existe;
- valor cuota y fecha;
- UF y fecha;
- UTM y fecha;
- renta imponible actual;
- histórico de remuneraciones si se evaluará anticipada;
- cotizaciones válidas por períodos;
- tipo de comisión AFP aplicable según módulo.

### 3.3 Grupo familiar

- cónyuge / conviviente civil;
- edad y sexo del cónyuge cuando aplique;
- hijas/os con derecho;
- hijas/os estudiantes;
- hijas/os inválidos;
- madre o padre de hijas/os de filiación no matrimonial;
- padres cargas familiares, cuando proceda.

### 3.4 Trazabilidad obligatoria

Todo cálculo debe dejar registrado:

```txt
fecha_calculo
fecha_uf
fecha_utm
fecha_valor_cuota
origen_uf
origen_utm
origen_valor_cuota
afp
tabla_mortalidad
version_tabla
anio_calculo
tasa_usada
version_parametros
modo_calculo
```

---

## 4. Parámetros base del sistema AFP

## 4.1 Cotización obligatoria

| Parámetro | Valor | Tipo |
|---|---:|---|
| Cotización obligatoria a cuenta individual | 10% de la remuneración o renta imponible | Normativa |
| Tope imponible 2026 | 90,0 UF | Paramétrica |
| SIS vigente desde enero 2026 | 1,54% | Paramétrica |
| Edad legal de vejez hombre | 65 años | Normativa |
| Edad legal de vejez mujer | 60 años | Normativa |

## 4.2 Fórmulas base

```txt
tope_imponible_clp = round(90.0 * UF)
renta_imponible_efectiva = min(renta_imponible, tope_imponible_clp)
cotizacion_obligatoria = renta_imponible_efectiva * 0.10
sis = renta_imponible_efectiva * 0.0154
```

## 4.3 Regla de implementación

- El tope imponible debe estar **versionado por vigencia**.
- El sistema no debe usar `87.8 * UF` como valor general 2026.
- El SIS no debe quedar fijo si cambia la tasa oficial.
- La fórmula debe distinguir claramente entre:
  - cotización obligatoria;
  - comisión AFP;
  - SIS;
  - otros aportes o cargos del empleador;
  - beneficios fiscales.

---

## 5. AFP y comisiones

## 5.1 Comisión sobre cotización obligatoria

La comisión de la AFP sobre la cuenta obligatoria se cobra como **porcentaje mensual sobre la remuneración o renta imponible**.

### Comisiones de referencia vigentes documentadas

| AFP | Comisión mensual sobre remuneración o renta imponible |
|---|---:|
| Capital | 1,44% |
| Cuprum | 1,44% |
| Hábitat | 1,27% |
| Modelo | 0,58% |
| PlanVital | 1,16% |
| Provida | 1,45% |
| Uno | 0,46% |

### Fórmula correcta

```txt
comision_afp_cotizacion = renta_imponible_efectiva * (comision_pct / 100)
```

### Fórmula incorrecta a eliminar

```txt
salario * (comision / 100) / 12
```

## 5.2 Comisión sobre pensiones en RP

El motor debe distinguir expresamente entre:

- comisión AFP por **cotización**; y
- comisión que se descuenta del **monto de pensión en RP**, cuando corresponda al contexto de la simulación o certificado.

Estas no deben mezclarse.

## 5.3 Regla técnica

Nunca almacenar una sola variable ambigua llamada `comision`.  
Se recomienda separar:

```txt
comisionCotizacionPct
comisionCotizacionDec
comisionPensionRpPct
comisionPensionRpDec
origenComision
fechaVigenciaComision
```

---

## 6. Fondos de pensiones

| Fondo | Descripción |
|---|---|
| A | Más riesgoso |
| B | Riesgoso |
| C | Intermedio |
| D | Conservador |
| E | Más conservador |

### Regla funcional

La clasificación del fondo afecta principalmente:

- trayectoria de rentabilidad;
- simulaciones de saldo;
- análisis de riesgo;
- valor cuota histórico.

No altera por sí sola la lógica normativa de elegibilidad de una pensión.

---

## 7. Indicadores económicos y fuente operativa

## 7.1 Indicadores mínimos

| Indicador | Uso |
|---|---|
| UF | valorización de saldos, pensiones y umbrales |
| UTM | tributación y topes tributarios |
| valor cuota AFP | conversión entre cuotas y saldo |
| tasa RP vigente | recálculo de anualidades y pensiones |
| tasas de RV de referencia | módulos comparativos o actuariales según corresponda |

## 7.2 Reglas técnicas

Todo cálculo debe registrar:

```txt
valor_uf
valor_utm
valor_cuota
fecha_uf
fecha_utm
fecha_valor_cuota
fecha_tasa
fuente_parametro
```

## 7.3 Fallbacks

Se permiten mecanismos de fallback técnico solo si:

- quedan trazados;
- tienen fecha de vigencia;
- el sistema informa que se trata de respaldo o caché;
- no reemplazan silenciosamente la fuente oficial sin dejar evidencia.

---

## 8. Saldo efectivo canónico

El saldo a pensionar no debe limitarse a una sola variable si existen otras fuentes válidas de financiamiento.

### Fórmula canónica recomendada

```js
const saldoEfectivo =
  (d.saldoTotal || 0) +
  (d.saldoAPV || 0) +
  (d.depositosConvenidos || 0) +
  (d.bonoReconocimiento || 0);
```

### Componentes posibles

| Componente | Campo sugerido |
|---|---|
| saldo obligatorio | `saldoTotal` |
| APV | `saldoAPV` |
| depósitos convenidos | `depositosConvenidos` |
| bono de reconocimiento | `bonoReconocimiento` |

### Regla funcional

No enviar solo `saldoTotal` al motor si existe evidencia de APV, depósitos convenidos o BR disponibles para financiar la pensión.

---

## 9. Tablas de mortalidad y factores de mejoramiento

## 9.1 Regla documental

Las tablas 2020 vigentes son insumo técnico-normativo relevante. Debe distinguirse entre:

- tablas de mortalidad base por edad (`qx`);
- factores de mejoramiento bidimensional `AAx,t`;
- tablas o divisores precalculados internos del sistema.

## 9.2 Regla de cálculo

Si el motor trabaja con `qx` y `AAx,t`, la probabilidad efectiva para el año de cálculo debe construirse usando ambos componentes.

### Ejemplo de principio de implementación

```txt
q(x,anio_calculo) = qx_2020(x) ajustado por factores AAx,t aplicables
```

## 9.3 Regla de trazabilidad

Se recomienda persistir:

```txt
tablaBase
anioBase
anioCalculo
usaAAx
versionAAx
metodoCNU
```

## 9.4 Heurísticas que deben quedar rotuladas

Los siguientes mecanismos pueden existir en el motor, pero solo como heurística:

- `getCRUExtrapolado()` para edades fuera de rango;
- interpolaciones lineales;
- proxies de edad/sexo para hijos inválidos;
- factores globales como `1.08`;
- CNU familiar armado con plazos fijos universales sin distinguir todos los supuestos;
- **AAx (mejoramiento) solo se aplica para hombres en RP** — para mujeres se usa la tabla pre-computada oficial sin ajuste AAx. Razón técnica: los `qx` raw de `b2020_mujer` tienen ≈6,8% de inconsistencia vs CRU oficial, lo que sesga el ratio AAx y produce CNU incorrecto (~234 en lugar de ~228). Usar la tabla oficial directa da error < 1% vs SCOMP. El campo `usaAAx` en `cnuDetalle` registra este comportamiento para trazabilidad.

---

## 10. Retiro Programado (RP)

## 10.1 Regla normativa base

El RP es la modalidad en que la pensión se recalcula periódicamente dividiendo el saldo real de la cuenta por el capital necesario para pagar una unidad de pensión al afiliado y, fallecido éste, a sus beneficiarios.

## 10.2 Regla funcional general

```txt
pension_rp_uf = saldo_real_uf / CNU
pension_rp_clp = pension_rp_uf * UF
```

## 10.3 Recálculos

El módulo RP debe contemplar:

- recálculo periódico anual;
- recálculo extraordinario por ingreso o reliquidación de BR;
- ingreso de APV / depósitos convenidos / ahorro voluntario;
- egreso por excedente de libre disposición;
- cambio en composición o condición de beneficiarios;
- bonificación por hijo en los casos en que corresponda;
- actualización de tasa vigente al momento del recálculo.

## 10.4 Regla de consistencia obligatoria

Si el sistema usa:

- una tasa RP vigente para el cálculo normativo; y
- un `CRU/CNU` precalculado con otra tasa,

entonces debe:

1. recalcular coherentemente con la misma tasa; o  
2. declarar explícitamente que la salida es una simulación aproximada.

## 10.5 Grupo familiar

La composición del grupo familiar afecta el divisor del RP.  
El motor debe distinguir entre:

- afiliado;
- cónyuge o conviviente;
- hijas/os menores;
- hijas/os estudiantes;
- hijas/os inválidos;
- otros beneficiarios admitidos por la normativa.

## 10.6 Regla técnica de separación de capas

Debe separarse:

```txt
pension_base_actuarial
descuento_comision_pension
descuento_salud
descuento_impuesto
beneficio_pgu
beneficio_bac
beneficio_cev
monto_final_visible
```

---

## 11. Renta Vitalicia (RV)

## 11.1 Regla documental

La RV es una modalidad contractual con compañía de seguros y debe describirse como tal.

## 11.2 Regla de implementación

Si el sistema usa algo como:

```txt
CRU_RV = CRU_B2020 * 1.08
```

o `factorTabla = 1.08`, ello debe quedar marcado como:

- **estimación interna**;
- **aproximación comparativa**;
- **no equivalente a fórmula legal exacta**.

## 11.3 Recomendación funcional

Separar:

- módulo normativo/documental de RV;
- módulo comparativo comercial;
- módulo de simulación con factores simplificados.

---

## 12. Vejez normal

## 12.1 Regla normativa

Tienen derecho a pensión de vejez:

- hombres: desde 65 años;
- mujeres: desde 60 años.

## 12.2 Regla técnica

No basta con calcular edad. Debe existir validación robusta de:

- fecha de nacimiento;
- fecha de solicitud;
- fecha efectiva de devengamiento;
- condición especial de trabajo pesado si aplica.

---

## 13. Vejez anticipada

## 13.1 Regla correcta

Para vejez anticipada deben cumplirse copulativamente los requisitos:

1. pensión >= 70% del promedio de remuneraciones imponibles y rentas declaradas del período normativo;
2. pensión >= 12 UF.

## 13.2 Fórmula funcional

```txt
cumple_70pct = pension_referencia >= promedio_120_meses * 0.70
cumple_12uf = pension_referencia_uf >= 12
acceso_anticipada = cumple_70pct && cumple_12uf
```

## 13.3 Reglas técnicas

- parametrizar el período de cálculo del promedio;
- trazar el origen de remuneraciones y rentas;
- distinguir monto bruto de referencia y monto visible final;
- no reutilizar reglas antiguas tipo “80% y 80%”.

---

## 14. Trabajo pesado

## 14.1 Requisitos

Para sistema AFP deben verificarse copulativamente:

1. trabajo calificado como pesado por la CEN;
2. sobrecotización de 1% o 2% del trabajador y aporte equivalente del empleador;
3. al menos 20 años de cotizaciones o servicios computables.

## 14.2 Rebaja de edad

| Sobre / tasa total | Rebaja |
|---|---|
| 4% total (2% trabajador + 2% empleador) | 2 años por cada 5, tope 10 |
| 2% total (1% trabajador + 1% empleador) | 1 año por cada 5, tope 5 |

### Fracciones
Las fracciones de períodos de 5 años deben dar derecho a rebaja proporcional.

## 14.3 Regla funcional

```txt
rebaja = calcularRebajaTrabajoPesado(periodos, tasa)
edadAcceso = edadLegal - rebaja
acceso = cumpleTrabajoPesado && cumple20Anios && edad >= edadAcceso
```

## 14.4 Interacciones obligatorias

El módulo debe contemplar interacción con:

- BAC;
- CEV;
- edad de devengamiento del beneficio;
- BR cuando corresponda cobro anticipado o análisis específico.

---

## 15. Invalidez

## 15.1 Regla normativa base

La invalidez se determina con reglas propias del sistema y no debe simplificarse documentalmente como un mero `saldo / CRU`.

## 15.2 Conceptos que el sistema debe manejar

- invalidez parcial transitoria;
- invalidez parcial definitiva;
- invalidez total definitiva;
- único dictamen;
- cobertura / no cobertura SIS;
- ingreso base;
- pensión de referencia;
- aporte adicional.

## 15.3 Regla documental

Si el motor usa una fórmula simplificada basada en saldo y divisor actuarial, debe rotularse como:

- simulación interna;
- estimación orientativa;
- no descripción normativa exacta.

---

## 16. Sobrevivencia

## 16.1 Porcentajes de referencia que el sistema debe conocer

| Beneficiario | Porcentaje |
|---|---:|
| Cónyuge | 60% |
| Cónyuge con hijos con derecho | 50% |
| Hija/o menor de 18 | 15% |
| Hija/o estudiante menor de 24 | 15% |
| Hija/o inválido parcial mayor de 24 | 11% |
| Padre o madre de hija/o de filiación no matrimonial | 36% |
| Padre o madre de hija/o de filiación no matrimonial con hijos con derecho | 30% |
| Padres causantes de asignación familiar, a falta de otros beneficiarios | 50% |

## 16.2 Requisitos a documentar

- condición y acreditación de beneficiarios;
- estudios;
- invalidez;
- matrimonio o convivencia civil según corresponda;
- prioridad y exclusión de beneficiarios incompatibles.

## 16.3 Regla técnica

El prorrateo o tope máximo del sistema no reemplaza la validación de elegibilidad.  
Primero se determina **quién tiene derecho**, luego **cuánto corresponde**.

---

## 17. PGU

## 17.1 Parámetros 2026 documentables

| Parámetro | Valor |
|---|---:|
| PGU menores de 82 años desde 01-02-2026 | $231.732 |
| PGU de 82 años y más desde 01-02-2026 | $250.275 |
| Pensión inferior | $789.139 |
| Pensión superior | $1.252.602 |

## 17.2 Regla de negocio

La PGU no debe modelarse como una suma fija universal sin validar:

- edad;
- residencia;
- tramo socioeconómico;
- pensión base;
- régimen aplicable;
- vigencia de parámetros.

## 17.3 Regla documental importante

No equiparar automáticamente:

```txt
pension_base_pgu = pension_liquida
```

como si fuera regla universal del sistema.  
Si se usa como aproximación interna, debe quedar marcado como simplificación.

## 17.4 Recomendación de implementación

Tener módulo autónomo PGU con:

```txt
determinarElegibilidadPGU()
calcularPensionBasePGU()
calcularMontoPGU()
versionParametrosPGU
```

---

## 18. APV

## 18.1 Régimen A

- bonificación estatal de 15% del ahorro anual;
- tope anual de bonificación: 6 UTM.

## 18.2 Régimen B

- rebaja tributaria según base imponible y régimen aplicable.

## 18.3 Regla funcional

Distinguir:

- efecto tributario;
- efecto en saldo final;
- efecto en pensión proyectada;
- recomendaciones de ahorro que son solo UX o comercial.

---

## 19. Depósitos convenidos

Los depósitos convenidos deben tratarse como fuente diferenciada de financiamiento previsional, especialmente en:

- pensión anticipada;
- excedente de libre disposición;
- saldo efectivo;
- trazabilidad del origen de fondos.

---

## 20. Bono de Reconocimiento (BR)

## 20.1 Regla general

El BR no genera una “comisión AFP especial”.  
Debe tratarse como componente del saldo o como flujo especial del proceso previsional, según el caso.

## 20.2 Efectos funcionales

- puede ingresar por liquidación o reliquidación;
- puede gatillar recálculo extraordinario en RP;
- puede influir en elegibilidad y monto;
- requiere trazabilidad del estado del bono;
- su tratamiento no debe confundirse con una comisión adicional.

## 20.3 Trabajo pesado y BR

Si el sistema modela casos de trabajo pesado con BR, debe separar claramente:

- rebaja de edad por trabajo pesado en AFP;
- reglas de eventual cobro anticipado del BR cuando la normativa lo permita;
- ausencia de comisión AFP adicional por el solo hecho de existir BR.

---

## 21. Bonificación por hijo nacido vivo

## 21.1 Regla documental

Debe existir como módulo o al menos como componente funcional del sistema, no como nota marginal.

## 21.2 Efectos en negocio

- puede ingresar como recurso que afecta saldo o recálculo;
- puede modificar anualidad y monto de pensión en escenarios específicos;
- requiere fecha, elegibilidad y trazabilidad del ingreso del beneficio.

---

## 22. Beneficio por Años Cotizados (BAC)

## 22.1 Nombre correcto

La denominación normativa correcta es **Beneficio por Años Cotizados (BAC)**.  
No se recomienda dejarlo documentado como “bono por años de servicio”.

## 22.2 Requisitos base

Las personas beneficiarias deben cumplir copulativamente, al menos, con:

- estar pensionadas por vejez o invalidez en el sistema del D.L. N° 3.500, o caer en la categoría normativa equivalente;
- no ser titulares de pensión de retiro en Capredena o Dipreca, salvo excepciones de montepío;
- tener 65 años o más, sin perjuicio de reglas especiales por trabajos pesados;
- contar con el mínimo de cotizaciones exigidas en el Fondo Autónomo de Protección Previsional.

## 22.3 Requisito de cotizaciones mínimas

### 2026
- mujeres: **120 meses**
- hombres: **240 meses**

### Escalamiento para mujeres
El mínimo aumenta gradualmente hasta completar 180 meses en las fechas definidas por la normativa.

## 22.4 Fórmula general documentable

```txt
BAC = años_cotizados * 0,1 UF
```

con estas advertencias:

- tope mensual de **2,5 UF**;
- existen reglas diferenciadas para stock y flujo;
- puede existir **anualidad BAC** en ciertos casos de flujo;
- el cálculo no es idéntico en todos los escenarios.

## 22.5 Reglas que debe soportar el sistema

- stock pensionado al 01-01-2026;
- pensionados menores de 65 al 31-07-2025;
- no pensionados stock con 65 o más;
- flujo desde 01-08-2025 en adelante;
- consideración de licencias médicas;
- cotizaciones como afiliado voluntario;
- cotizaciones incluidas en BR;
- trabajo pesado para edad de devengamiento;
- cálculo proporcional por fracciones de año.

## 22.6 Implementación recomendada

Separar al menos:

```txt
determinarElegibilidadBAC()
contarCotizacionesBAC()
calcularBACStock()
calcularBACFlujo()
calcularAnualidadBAC()
fechaDevengamientoBAC
montoBACUF
montoBACCLP
```

---

## 23. Compensación por Diferencias de Expectativa de Vida (CEV)

## 23.1 Nombre correcto

La denominación normativa correcta es **Compensación por Diferencias de Expectativa de Vida (CEV)**.  
No se recomienda documentarla como “bono expectativa de vida mujer”.

## 23.2 Requisitos base

Acceden las mujeres que cumplan copulativamente, al menos, con:

- 65 años o más, con reglas especiales por trabajo pesado;
- pensionadas por vejez desde los 60 años o por invalidez no cubierta por SIS, según corresponda;
- incorporación al Seguro Social Previsional y cotización mínima al FAPP antes de los 50 años, sin perjuicio de reglas especiales de incorporación por transición.

## 23.3 Regla de exclusión relevante

Las mujeres pensionadas anticipadamente conforme al artículo 68 del D.L. N° 3.500 no tienen derecho a CEV.

## 23.4 Porcentaje según edad

La normativa distingue porcentajes por edad para stock y flujo. La lógica general 2026 considera tramos crecientes desde 60 años hasta llegar a 100% a los 65 o más, e invalidez con 100% cuando corresponda.

## 23.5 Fórmula general documentable

### Caso stock
```txt
CEV = [PAFE * factor_correccion] * porcentaje_según_edad
```

### Reglas relevantes
- PAFE máxima considerada: **18 UF**
- monto mínimo del beneficio: **0,25 UF**
- la edad y el grupo familiar pueden requerir ajustes especiales;
- para trabajo pesado se considera edad reajustada con rebaja reconocida;
- no corresponde recálculo futuro por simplemente cumplir más años en flujo, salvo lo que disponga la norma.

## 23.6 Regla funcional

El sistema debe modelar, al menos:

```txt
determinarElegibilidadCEV()
determinarPorcentajeCEV()
calcularFactorCorreccionCEV()
calcularPAFEBaseCEV()
calcularMontoCEV()
```

## 23.7 Integración con PGU

La definición de pensión base para PGU considera beneficios del Seguro Social Previsional, entre ellos BAC y CEV, por lo que estos módulos no deben tratarse como accesorios desconectados.

---

## 24. Impuesto único de segunda categoría

## 24.1 Regla documental

El impuesto debe calcularse con la tabla mensual vigente del SII para el mes de cálculo.

## 24.2 Regla técnica

No usar tablas aproximadas si el sistema pretende entregar líquido estimado con pretensión de exactitud.

## 24.3 Fórmula general

```txt
impuesto = max(0, base_imponible * factor - rebaja)
```

## 24.4 Parámetros

- UTM vigente del mes;
- tramo mensual;
- factor;
- rebaja;
- fecha de vigencia.

---

## 25. Pensión líquida y descuentos

## 25.1 Orden recomendado

```txt
pension_bruta
- descuento_comision
= pension_post_comision

- descuento_salud
= pension_post_salud

- descuento_impuesto
= pension_liquida
```

## 25.2 Beneficios posteriores

Luego, si el producto lo muestra así, pueden sumarse:

- PGU;
- BAC;
- CEV;
- otros beneficios externos trazados.

## 25.3 Regla técnica

Nunca sumar un beneficio fiscal o contributivo adicional sin dejar evidencia de:

- módulo que lo calculó;
- elegibilidad;
- fecha de vigencia;
- monto;
- si fue cálculo normativo o simulación.

---

## 26. Persistencia y almacenamiento

## 26.1 Datos que pueden mantenerse en store

Pueden persistirse datos de sesión, pero con clasificación clara:

- identificadores;
- entradas del usuario;
- parámetros usados;
- salidas brutas;
- salidas netas;
- trazas de debug;
- marcas de simplificación.

## 26.2 Campos recomendados adicionales

```txt
fechaVigenciaParametros
tablaMortalidadUsada
usaAAx
origenTasaRP
origenComisionCotizacion
origenComisionPension
usaModeloSimplificadoPGU
usaModeloSimplificadoRV
usaCruPrecalculado
versionCruPrecalculado
fechaCalculoBAC
fechaCalculoCEV
```

---

## 27. Integraciones externas recomendadas

El sistema debería contemplar integración o al menos preparación para:

- SP;
- SII;
- IPS;
- valores cuota AFP;
- certificación o consulta de cotizaciones;
- archivos de intercambio;
- SCOMP o procesos asociados;
- servicios internos de negocio.

---

## 28. Separación obligatoria entre cálculo normativo y simulación

## 28.1 Modo normativo

Debe usar:

- parámetros vigentes;
- reglas legales correctas;
- tablas y tasas coherentes;
- trazabilidad completa;
- validación de elegibilidad.

## 28.2 Modo simulación

Puede usar:

- factores comparativos;
- scoring;
- semáforos;
- recomendaciones UX;
- aproximaciones de RV;
- proxies familiares.

## 28.3 Regla de UI

Toda salida heurística debe aparecer etiquetada como:

- `Estimación interna`; o
- `Simulación orientativa`

Nunca como:

- `monto oficial`;
- `resultado normativo exacto`;
- `equivalente a certificado oficial`.

---

## 29. Heurísticas permitidas, pero rotuladas

Se pueden mantener, siempre que no se oculten como norma:

| Regla | Clasificación |
|---|---|
| factor fijo comparativo para RV | Heurística |
| score previsional | Heurística UX |
| semáforo verde/amarillo/rojo | Heurística UX |
| simulador de longevidad | Heurística visual |
| recomendación automática de modalidad | Heurística comercial/UX |
| proxy de edad/sexo de hijo inválido | Heurística actuarial |
| anualidades limitadas planas para menores/estudiantes | Simplificación |

---

## 30. Reglas de QA y auditoría

## 30.1 Pruebas mínimas por módulo

### AFP / cotización
- comisión mensual correcta;
- sin división por 12;
- tope imponible por vigencia.

### RP
- separación entre CNU y descuentos posteriores;
- recálculo por cambio de beneficiarios;
- ingreso de BR/APV;
- consistencia de tasa.

### RV
- distinguir estimación vs cálculo contractual real.

### anticipada
- validar 70% + 12 UF;
- promedio 120 meses;
- trazabilidad de base utilizada.

### trabajo pesado
- validar CEN;
- validar sobrecotización;
- validar 20 años;
- rebaja proporcional.

### invalidez
- distinguir cobertura SIS;
- tipo de dictamen;
- ingreso base.

### sobrevivencia
- reglas de elegibilidad;
- porcentajes correctos;
- transición de porcentajes cuando hijos pierden derecho.

### PGU
- pensión base correcta;
- vigencia de parámetros;
- elegibilidad.

### BAC / CEV
- stock vs flujo;
- trabajo pesado;
- edad de devengamiento;
- trazabilidad.

## 30.2 Salidas de debug recomendadas

```json
{
  "modo": "normativo|simulacion",
  "tabla": "RV-M-2020|B-M-2020|...",
  "usaAAx": true,
  "tasa": 0.0,
  "saldoEfectivo": 0.0,
  "cnu": 0.0,
  "pensionBruta": 0.0,
  "descuentoComision": 0.0,
  "descuentoSalud": 0.0,
  "descuentoImpuesto": 0.0,
  "pensionLiquida": 0.0,
  "pgu": 0.0,
  "bac": 0.0,
  "cev": 0.0,
  "montoFinal": 0.0
}
```

---

## 31. Advertencia legal sugerida

> Esta calculadora y/o motor es de uso informativo, técnico o de simulación. Algunos resultados pueden depender de parámetros vigentes, trazas internas, reglas de elegibilidad y modelos simplificados. Los montos oficiales de pensión y beneficios deben validarse con la documentación oficial emitida por AFP, IPS, compañías de seguros, SCOMP y la normativa vigente de la Superintendencia de Pensiones.

---

## 32. Resumen ejecutivo de correcciones críticas

1. Comisión AFP sobre cotización: **mensual sobre imponible**, no anual/12.  
2. Tope imponible 2026: **90,0 UF**.  
3. SIS desde enero 2026: **1,54%**.  
4. Vejez anticipada: **70% + 12 UF**.  
5. Trabajo pesado: validar **CEN + sobrecotización + 20 años**.  
6. Invalidez: no describirla legalmente como simple `saldo / CRU`.  
7. Sobrevivencia: incluir porcentajes completos y reglas de elegibilidad.  
8. PGU: no reducirla a una resta o suma simplista sobre “pensión líquida”.  
9. BAC: incorporarlo como módulo real, no como nota marginal.  
10. CEV: incorporarlo como módulo real para mujeres, no como “bono” genérico.  
11. Separar cálculos normativos de simulaciones.  
12. Versionar todos los parámetros por vigencia.

---

## 33. Fuentes oficiales sugeridas

### Superintendencia de Pensiones
- https://www.spensiones.cl
- Compendio de Normas del Sistema de Pensiones
- BAC: Libro III, Título XIX, Letra B
- CEV: Libro III, Título XIX, Letra C
- PGU
- trabajo pesado
- vejez anticipada
- pensión de sobrevivencia
- Seguro de Invalidez y Sobrevivencia
- topes imponibles 2026
- comisiones AFP

### SII
- impuesto único de segunda categoría
- UTM
- criterios tributarios vigentes

### CMF
- rentas vitalicias
- documentos técnicos y regulatorios de seguros previsionales

### BCN
- texto actualizado de leyes base

### IPS / ChileAtiende
- operación y pago de beneficios

---

## 34. Estado final del documento

Este documento queda apto como base de:

- documentación funcional;
- backlog de correcciones;
- diseño técnico del motor;
- plan de QA;
- revisión de deuda normativa;
- auditoría de separación entre cálculo legal y simulación.

No debe ser usado como sustituto automático de una resolución oficial de pensión o de un certificado de oferta formal.

---

## 35. Pensión de invalidez — porcentajes normativos

**Tipo:** Normativa — DL N° 3.500 art. 54 y siguientes.

### 35.1 Invalidez parcial
- Porcentaje base: **50%** del ingreso base (promedio de remuneraciones imponibles del afiliado).
- Aplica: grado de invalidez ≥ 50% y < 66,6% según dictamen de COMPIN/COMUN.
- Transitoria: hasta segundo dictamen. Definitiva: tras segundo dictamen o único dictamen con porcentaje de pérdida ≥ 50%.

### 35.2 Invalidez total
- Porcentaje base: **70%** del ingreso base.
- Aplica: grado de invalidez ≥ 66,6% según dictamen.

### 35.3 Ingreso base
- Promedio de remuneraciones imponibles de los últimos 120 meses anteriores al siniestro (o período menor si corresponde).
- Se indexa a UF para normalizar.

### 35.4 Aporte adicional (SIS)
- El Seguro de Invalidez y Sobrevivencia (SIS) financia el complemento entre el saldo acumulado del afiliado y el capital necesario para financiar la pensión de referencia (50% o 70% del ingreso base).
- Tasa SIS vigente 2026: **1,54%** de la remuneración imponible (pagada por el empleador).

### 35.5 Regla de simulación recomendada
- En modo simulación: usar promedio de rentabilidad imponible ingresada por el usuario como proxy del ingreso base.
- Rotular como **heurística** cuando el ingreso base se aproxima desde el campo de renta imponible actual.

**Fuente:** DL N° 3.500 art. 54-58; Compendio SP, Libro I, Título IV; SP www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9923.html

---

## 36. Descuento de salud — tasa de simulación

**Tipo:** Paramétrica — obligación legal art. 85 DL N° 3.500 / Ley ISAPRE / Ley FONASA.

### 36.1 Tasa Fonasa (default de simulación)
- Los pensionados cotizantes de FONASA descuentan el **7%** de su pensión bruta (con tope de 7% × 80,8 UF).
- En simulaciones sin contrato ISAPRE, usar **7%** como tasa de descuento de salud.

### 36.2 Isapre
- La tasa varía según el plan contratado (puede ser superior al 7%).
- No parametrizable automáticamente sin datos del contrato.
- Para simulaciones con ISAPRE: informar al usuario que la tasa real puede diferir.

### 36.3 Regla de implementación
- El sistema ya aplica `descSalud = baseImp × 0.07` en `calcularPensionLiquida()`.
- Este valor es correcto como proxy Fonasa. Para ISAPRE, requiere parámetro adicional en el futuro.

**Fuente:** DL N° 3.500 art. 85; Ley N° 18.469 (FONASA); Ley N° 18.933 (ISAPRE).

---

## 37. Bonificación por hijo nacido vivo

**Tipo:** Normativa — Ley N° 20.255 art. 74-75, vigente desde julio 2009.

### 37.1 Descripción
- Las mujeres reciben una **bonificación de 18 UF por cada hijo nacido vivo** al momento de pensionarse.
- También aplica para hijos adoptados, bajo ciertas condiciones normativas.

### 37.2 Requisitos
- Ser mujer afiliada al sistema AFP (DL N° 3.500).
- Tener al menos 1 hijo nacido vivo registrado en el Registro Civil.
- Pensionarse por vejez normal o anticipada (no necesariamente por vejez edad).

### 37.3 Ingreso al saldo
- El bono ingresa a la cuenta de capitalización individual **al momento de la pensión** como aporte adicional al saldo.
- Se valoriza en UF a la fecha de acreditación.
- Incrementa el saldo efectivo antes del cálculo de la pensión.

### 37.4 Regla de implementación recomendada
```txt
saldoConBono = saldoTotal + (numHijosNacidosVivos × 18 × UF)
```
- Rotular como **normativa** (no heurística) ya que el monto es fijo por ley.
- Agregar campo `numHijosNacidosVivos` al formulario de entrada solo para mujeres.

**Fuente:** Ley N° 20.255 art. 74-75; SP www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9921.html

---

## 38. Tabla impuesto único de 2ª categoría — vigencia 2026

**Tipo:** Paramétrica — SII Chile, tabla mensual vigente marzo 2026.

| Desde (CLP) | Hasta (CLP) | Tasa | Rebaja (CLP) |
|---|---|---|---|
| 0 | 943.501 | 0% | 0 |
| 943.501 | 2.096.670 | 4% | 37.740 |
| 2.096.670 | 3.494.450 | 8% | 121.607 |
| 3.494.450 | 4.892.230 | 13,5% | 313.802 |
| 4.892.230 | 6.290.010 | 23% | 778.563 |
| 6.290.010 | 8.386.680 | 30,4% | 1.244.024 |
| 8.386.680 | 21.665.590 | 35% | 1.629.811 |
| 21.665.590 | ∞ | 40% | 2.713.091 |

- **UTM referencia:** $69.889 (marzo 2026, SII Chile).
- **Fórmula:** `max(0, pensionBruta × tasa − rebaja)`.
- Esta tabla ya está implementada en `calculos.js` como `TRAMOS_IMP`.
- Actualizar cada vez que el SII publique nueva tabla mensual.

**Fuente:** SII Chile, tabla impuesto mensual segunda categoría marzo 2026. www.sii.cl

---

## 39. BAC implementado — resumen de reglas operacionales

**Tipo:** Normativa (elegibilidad) + Heurística (simplificación stock/flujo para simulación).

Esta sección complementa la sección 22 con las reglas operacionales ya implementadas en el motor (2026):

### 39.1 Implementación en calculos.js
- Función: `calcularBAC(mesesCotizados, uf, sexo)`
- Fórmula: `BAC = min((mesesCotizados / 12) × 0,1 UF, 2,5 UF)` mensual.
- Mínimo para elegibilidad: 120 meses (mujeres) / 240 meses (hombres).
- Retorna `{ monto, montoUF, anosCotizados, elegible, razonNoElegible }`.

### 39.2 Dato de entrada requerido
- Campo `mesesCotizados` en el formulario de datos del afiliado.

### 39.3 Etiqueta obligatoria en UI
- "Estimado — sujeto a elegibilidad oficial (Seguro Social Previsional)"

**Fuente:** Ley N° 21.735; Compendio SP, Libro III, Título XIX, Letra B.

---

## 40. CEV implementado — resumen de reglas operacionales

**Tipo:** Normativa (elegibilidad) + Heurística (porcentajes por tramo simplificados para simulación).

Esta sección complementa la sección 23 con las reglas operacionales ya implementadas en el motor (2026):

### 40.1 Implementación en calculos.js
- Función: `calcularCEV(sexo, edad, pafeClp, uf, esAnticipada)`
- PAFE aproximada desde la pensión bruta de RP/RV del motor (máx. 18 UF).
- Porcentajes stock simplificados: 65–69 años → 50%; 70–74 → 75%; ≥75 → 100%.
- Monto mínimo: 0,25 UF.
- Mujeres con vejez anticipada (art. 68 DL 3.500) excluidas.
- Retorna `{ monto, montoUF, porcentaje, elegible, razonNoElegible }`.

### 40.2 Etiqueta obligatoria en UI
- "Estimado — sujeto a elegibilidad oficial (Seguro Social Previsional)"

**Fuente:** Ley N° 21.735; Compendio SP, Libro III, Título XIX, Letra C.