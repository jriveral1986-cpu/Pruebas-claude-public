# Perfil Técnico — Programador Experto en Sistema de Pensiones de Chile

**Versión:** ampliada y actualizada  
**Fecha:** 31-03-2026  
**Propósito:** servir como perfil de referencia para selección, auditoría técnica, diseño de software, revisión de arquitectura y definición de competencias en proyectos previsionales chilenos.

---

## 1. Propósito del perfil

Este perfil describe las capacidades esperadas en una persona desarrolladora, arquitecta o analista senior que trabaje en software previsional chileno. No se trata de un perfil genérico de backend o full stack. Se espera dominio simultáneo de:

- **normativa previsional chilena**;
- **reglas de negocio complejas**;
- **cálculo actuarial y previsional**;
- **integración con organismos externos**;
- **trazabilidad, auditoría y validación funcional**;
- **traducción de normativa a código mantenible**.

Este perfil es especialmente útil para:

- AFP;
- IPS;
- compañías de seguros de vida;
- asesoría previsional;
- sistemas de simulación y orientación previsional;
- motores de cálculo de pensiones;
- plataformas de atención ciudadana;
- integración con SCOMP y procesos asociados;
- proyectos de migración o modernización de sistemas legados previsionales.

---

## 2. Qué distingue a este perfil de un desarrollador común

Una persona técnica especializada en pensiones en Chile debe entender que el problema no es solo programar pantallas o APIs. Debe ser capaz de responder, diseñar e implementar correctamente preguntas como:

- ¿qué diferencia existe entre una regla legal, una parametrización vigente y una heurística del sistema?
- ¿qué parte del cálculo debe ser exacta por norma y qué parte puede tratarse como simulación?
- ¿cómo cambia una pensión si cambia la composición del grupo familiar?
- ¿qué efectos tienen el Bono de Reconocimiento, el APV, los Depósitos Convenidos, el BAC y la CEV?
- ¿cómo se recalcula un retiro programado cuando cambia un beneficiario, entra un bono, se acredita una bonificación por hijo o cambia una tasa vigente?
- ¿qué información debe quedar trazada para auditoría ex post?
- ¿cómo se evita confundir salida visible de SCOMP con lógica actuarial interna?

---

## 3. Dominio funcional que debe manejar

## 3.1 Afiliación y cuentas previsionales

Debe comprender, al menos:

- afiliación al sistema del D.L. N° 3.500;
- administración de cuentas de capitalización individual obligatoria;
- APV, APVC, depósitos convenidos y ahorro voluntario;
- rezagos, cotizaciones impagas, deudas previsionales y regularizaciones;
- saldos en cuotas y valorización por valor cuota;
- exención de cotizar por edad o condición de pensionado;
- funcionamiento del Bono de Reconocimiento;
- bonificación por hijo nacido vivo;
- efectos de cotizaciones efectuadas con posterioridad a la fecha de pensión;
- tratamiento de trabajo pesado y sobrecotización del artículo 17 bis.

## 3.2 Beneficios y prestaciones

Debe distinguir correctamente entre:

- pensión de vejez edad;
- pensión de vejez anticipada;
- pensión por trabajos pesados;
- pensión de invalidez parcial o total;
- pensión de sobrevivencia;
- retiro programado;
- renta vitalicia inmediata;
- renta temporal con renta vitalicia diferida;
- renta vitalicia inmediata con retiro programado;
- PGU;
- APS/PBS de invalidez y beneficios históricos o de transición;
- Beneficio por Años Cotizados (BAC);
- Compensación por Diferencias de Expectativa de Vida (CEV);
- garantía estatal y beneficios fiscales complementarios cuando corresponda.

## 3.3 Cálculo previsional y actuarial

Debe manejar con seguridad:

- saldo efectivo a pensionar;
- capital necesario unitario o equivalentes funcionales;
- anualidades;
- promedio de remuneraciones imponibles de 120 meses;
- pensión autofinanciada de referencia;
- diferencia entre monto bruto, neto y monto final con beneficios fiscales;
- efectos del grupo familiar en capital necesario y pensión de sobrevivencia;
- tablas de mortalidad vigentes;
- factores de mejoramiento por edad y año;
- tasas de interés técnicas o tasas vigentes aplicables por módulo;
- topes imponibles, UF, UTM, tramos tributarios e indicadores oficiales;
- descuentos por comisión, salud e impuesto cuando correspondan.

---

## 4. Marco normativo y regulatorio mínimo

Quien ocupe este rol debe poder trabajar con el marco siguiente sin depender totalmente de una búsqueda superficial:

- **D.L. N° 3.500 de 1980**, como norma base del sistema de capitalización individual.
- **Ley N° 20.255**, por su impacto estructural en pilar solidario, bonificación por hijo y arquitectura de beneficios.
- **Ley N° 21.419**, por PGU y su lógica de pensión base.
- **Ley N° 21.735**, por la reforma previsional que incorpora nuevas prestaciones del Seguro Social Previsional.
- **Compendio de Normas del Sistema de Pensiones** de la Superintendencia de Pensiones.
- Normas y circulares de la **Superintendencia de Pensiones**.
- Normativa de la **CMF** aplicable a rentas vitalicias y seguros previsionales.
- Normativa del **SII** para impuesto único de segunda categoría y tratamiento tributario relacionado.
- Reglamentos, instrucciones y definiciones de **IPS**, cuando el flujo de cálculo o pago lo requiera.

## 4.1 Cambios normativos que hoy ya no se pueden ignorar

Un perfil actualizado ya no debería seguir documentando el sistema como si estuviera congelado en años anteriores. Debe conocer, al menos, que:

- la **PGU** es el beneficio fiscal vigente de referencia para vejez;
- desde **2026** ya existen prestaciones nuevas del Seguro Social Previsional, entre ellas:
  - **Beneficio por Años Cotizados (BAC)**;
  - **Compensación por Diferencias de Expectativa de Vida (CEV)**;
- las tablas de mortalidad 2020 incorporan factores de mejoramiento bidimensionales por edad y año;
- las reglas de cálculo y validación deben separar claramente:
  - lo **normativo**;
  - lo **paramétrico**;
  - lo **heurístico**.

---

## 5. Conocimiento normativo específico esperado

## 5.1 Vejez anticipada

Debe saber que la vejez anticipada no se resume en “tener harto saldo”, sino en cumplir requisitos normativos simultáneos y correctamente parametrizados.

## 5.2 Trabajo pesado

Debe conocer:

- rol de la Comisión Ergonómica Nacional;
- sobrecotización 1%/2% del trabajador y aporte espejo del empleador;
- rebaja de edad legal;
- interacción entre trabajo pesado y BAC;
- interacción entre trabajo pesado y CEV;
- diferencias entre AFP y antiguo sistema.

## 5.3 Invalidez y SIS

Debe manejar:

- invalidez parcial, total, transitoria, definitiva y único dictamen;
- cobertura y no cobertura del SIS;
- ingreso base;
- aporte adicional;
- pensiones de referencia;
- tratamiento de enfermedad terminal cuando corresponda.

## 5.4 Sobrevivencia

Debe entender:

- porcentajes por beneficiario;
- reglas de cónyuge, conviviente civil, hijas/os, madre o padre de hijos de filiación no matrimonial y padres carga;
- cambios de porcentaje cuando los hijos dejan de tener derecho;
- requisitos de edad, estudios e invalidez;
- cómo afecta esto el capital necesario en RP y otras modalidades.

## 5.5 PGU, BAC y CEV

Debe saber que estos beneficios no son “adornos” del sistema, sino componentes reales de cálculo, elegibilidad y monto final. Además, debe poder diferenciar:

- beneficio fiscal universal;
- beneficio contributivo nuevo por años cotizados;
- compensación asociada a expectativa de vida de mujeres;
- reglas de stock y flujo;
- efectos de edad, grupo familiar y fecha de devengamiento.

---

## 6. Competencias técnicas esperadas

## 6.1 Desarrollo backend

Debe dominar uno o más de estos lenguajes o ecosistemas:

- C#
- Java
- Kotlin
- Python
- eventualmente stacks legados según contexto institucional

Y ser capaz de implementar:

- servicios de cálculo previsional;
- motores de reglas;
- módulos de validación;
- procesos batch;
- integraciones asincrónicas y síncronas;
- adaptadores para servicios externos;
- persistencia auditable.

## 6.2 Modelado de datos

Debe saber modelar entidades como:

- afiliado;
- beneficiarios;
- solicitud de pensión;
- certificado de saldo;
- cotizaciones;
- fondos;
- valores cuota;
- parámetros por vigencia;
- trazas de cálculo;
- recalculaciones;
- eventos extraordinarios;
- ofertas de pensión;
- beneficios complementarios;
- estado del expediente previsional.

## 6.3 Bases de datos

Debe poder trabajar con:

- SQL Server;
- Oracle;
- PostgreSQL;

y resolver:

- consultas complejas;
- historización de parámetros;
- consistencia temporal;
- auditoría por vigencia;
- control de versiones de parámetros;
- performance en procesos masivos de cálculo;
- conciliación de datos previsionales.

## 6.4 Integraciones

Debe tener experiencia o al menos criterio sólido para integrar con:

- SP;
- SII;
- IPS;
- PreviRed;
- Registro Civil;
- servicios internos AFP/CSV;
- procesos relacionados con SCOMP;
- archivos y servicios SOAP/REST;
- carga y validación de XML, JSON, TXT delimitado y estructuras normadas.

## 6.5 Calidad, seguridad y trazabilidad

Debe comprender:

- protección de datos personales;
- manejo de datos sensibles;
- control de acceso a información previsional;
- trazabilidad de parámetros usados en cada cálculo;
- logging funcional, no solo técnico;
- auditoría de eventos previsionales;
- diferencia entre error técnico, error funcional y cambio normativo.

---

## 7. Conocimientos actuariales y matemáticos esperados

No se exige necesariamente ser actuario, pero sí saber trabajar correctamente con conceptos actuariales aplicados al negocio:

- anualidades;
- descuento financiero;
- probabilidades de fallecimiento por edad;
- tablas de mortalidad;
- factores de mejoramiento `AAx,t`;
- capital necesario unitario;
- pensión de referencia;
- relación entre saldo, tasa, expectativa de vida y monto pensionable;
- impacto del grupo familiar en anualidades;
- diferencia entre un valor bruto actuarial y un monto visible comercial o documental.

Debe ser capaz de explicar, implementar o revisar:

- por qué un error pequeño en una tabla o en una tasa cambia el monto final;
- por qué una comisión no debe confundirse con el divisor actuarial;
- por qué una salida visible de certificado no siempre permite auditar toda la lógica intermedia;
- cómo validar un motor con pruebas de caja negra y también con trazas internas.

---

## 8. Capacidad de diseño funcional

Un perfil senior no solo codifica. También puede redactar y revisar documentación funcional. Debe ser capaz de producir documentos donde se separen:

- reglas **normativas**;
- reglas **paramétricas**;
- reglas **heurísticas o de simulación**;
- reglas de **UI/UX**;
- reglas de **persistencia**;
- reglas de **trazabilidad**;
- reglas de **QA y validación**.

Debe evitar errores típicos como:

- documentar una aproximación interna como si fuera ley;
- congelar un parámetro anual como hardcode permanente;
- usar nombres de negocio ambiguos;
- mezclar comisión de cotización con comisión sobre pensión;
- mezclar cálculo base con descuento posterior;
- mezclar salida oficial visible con lógica actuarial interna.

---

## 9. Señales concretas de un experto genuino

Una persona realmente competente en este dominio suele:

- hablar con precisión de la diferencia entre **pensión autofinanciada**, **PGU**, **BAC** y **CEV**;
- distinguir entre **AFP**, **IPS**, **CMF**, **SII**, **SP** y el rol de cada uno;
- saber cuándo una regla depende de fecha de vigencia;
- reconocer rápidamente cuándo un cálculo está mezclando una tasa o una tabla incorrecta;
- entender el efecto del grupo familiar sin reducirlo a una suma superficial;
- tener criterio para separar un módulo normativo de uno de simulación;
- saber que la documentación previsional debe poder defenderse en auditoría;
- poder traducir una circular o capítulo del Compendio a historias de usuario, validaciones y código.

---

## 10. Señales de alerta

Debe considerarse señal de alerta cuando alguien:

- sigue describiendo el sistema actual solo con PBS/APS vejez, ignorando PGU;
- no conoce BAC y CEV como prestaciones ya vigentes desde 2026;
- sigue hablando solo de tablas RV-2014 / MI-2014 sin conocer tablas 2020 y factores de mejoramiento;
- no diferencia saldo obligatorio, APV, depósitos convenidos y bono de reconocimiento;
- no sabe cómo funciona trabajo pesado ni sus requisitos de sobrecotización;
- confunde rentas vitalicias con retiro programado;
- cree que basta dividir saldo por un número sin revisar tasa, grupo familiar, modalidad y vigencia;
- no modela trazabilidad de parámetros;
- no entiende que las comisiones pueden depender del contexto de cálculo;
- trata el sistema previsional chileno como si fuera intercambiable con otros países.

---

## 11. Preguntas técnicas recomendadas para evaluación

## 11.1 Preguntas de negocio

1. ¿Cómo separarías en un documento funcional una regla legal, una regla paramétrica y una heurística?
2. ¿Cómo validarías una pensión anticipada sin confundir el promedio de remuneraciones con la pensión base visible?
3. ¿Qué eventos obligan a recalcular un retiro programado?
4. ¿Qué cambia en el cálculo si aparece un nuevo beneficiario?
5. ¿Cómo tratarías el Bono de Reconocimiento en un motor de pensión?
6. ¿Cómo modelarías BAC y CEV sin romper compatibilidad con cálculos previos?

## 11.2 Preguntas técnicas

1. ¿Qué estructura de datos usarías para parámetros por vigencia?
2. ¿Cómo versionarías tablas de mortalidad y factores de mejoramiento?
3. ¿Cómo diseñarías un `debugTrace` de cálculo previsional?
4. ¿Qué pruebas automatizadas harías para validar consistencia entre JSON, reglas de negocio y resultado visible?
5. ¿Cómo impedirías que una comisión quede aplicada dos veces?
6. ¿Cómo desacoplarías el cálculo actuarial del rendering de UI?

## 11.3 Ejercicios prácticos sugeridos

- construir un simulador de RP con trazabilidad;
- revisar un caso donde la salida visible coincide, pero el CNU interno está mal;
- modelar un flujo de pensión con BAC y CEV;
- auditar inconsistencias entre tablas precalculadas y reglas documentales;
- diseñar un esquema de persistencia temporal de parámetros.

---

## 12. Responsabilidades típicas del cargo

Una persona con este perfil debería poder asumir responsabilidades como:

- revisar reglas de negocio previsionales;
- convertir normativa a historias de usuario y criterios de aceptación;
- implementar motores de cálculo;
- revisar certificados y salidas oficiales versus cálculo del sistema;
- auditar coherencia entre código, JSON, UI y documentación;
- preparar trazas y evidencia para QA, auditoría interna o regulatoria;
- proponer estrategias de parametrización por vigencia;
- detectar deuda técnica normativa;
- diseñar pruebas regresivas para cambios regulatorios.

---

## 13. Entregables que debería poder producir

- documento funcional de reglas de negocio;
- matriz de parámetros por vigencia;
- diseño técnico de motor de cálculo;
- APIs o contratos de integración;
- especificación de eventos de recálculo;
- catálogo de errores funcionales;
- plan de pruebas;
- checklist de auditoría de cálculo;
- bitácora de trazabilidad del cálculo;
- documento de limitaciones y heurísticas del sistema.

---

## 14. Perfil ideal resumido

El perfil ideal no es solo “alguien que sabe programar”. Es alguien que puede sentarse con normativa, entenderla, traducirla, parametrizarla, implementarla, probarla y defenderla técnicamente. Debe combinar:

- criterio regulatorio;
- rigor matemático;
- capacidad de documentación;
- experiencia de integración;
- disciplina de trazabilidad;
- y sentido práctico para diferenciar cálculo oficial de simulación útil.

---

## 15. Fuentes oficiales sugeridas para profundización

## Superintendencia de Pensiones
- Sitio principal: https://www.spensiones.cl
- Compendio de Normas del Sistema de Pensiones
- Educación previsional y sistema AFP
- BAC y CEV del Seguro Social Previsional
- PGU
- Trabajo pesado
- Retiro programado
- Pensión de sobrevivencia
- Pensión de vejez anticipada

## CMF
- Normativa y antecedentes para rentas vitalicias
- regulación de seguros previsionales
- tablas y documentos técnicos aplicables cuando corresponda

## SII
- Impuesto único de segunda categoría
- UTM
- tratamiento tributario aplicable a APV y otras materias

## IPS / ChileAtiende
- beneficios fiscales y operativa de pago
- consulta y tramitación de PGU y beneficios relacionados

## BCN
- texto actualizado de leyes y normas base

---

## 16. Nota final de uso

Este documento describe el **perfil técnico deseable** para trabajar con sistemas previsionales en Chile. No sustituye la revisión jurídica ni actuarial final de un producto, pero sí establece el estándar mínimo que debería tener cualquier persona que diseñe, documente o implemente software en este dominio.

---

## 14. Fuentes oficiales y rutas de consulta

> **Nota de uso:** este perfil debe mantenerse alineado con fuentes oficiales vigentes. Cuando exista diferencia entre este documento y una fuente oficial posterior, prevalece la fuente oficial por fecha de publicación, vigencia o instrucción expresa.

### 14.1 Fuentes oficiales externas prioritarias

#### Marco legal base

1. **D.L. N° 3.500, de 1980 — Sistema de Capitalización Individual**
   - Ruta: `https://nuevo.leychile.cl/servicios/Consulta/Exportar?exportar_con_notas_al_pie=True&exportar_con_notas_bcn=True&exportar_con_notas_originales=True&exportar_formato=pdf&hddResultadoExportar=7147.2025-06-01.0.0%23&nombrearchivo=DL-3500_13-NOV-1980&radioExportar=Normas`

2. **Ley N° 20.255 — Reforma Previsional**
   - Ruta: `https://nuevo.leychile.cl/servicios/Consulta/Exportar?exportar_con_notas_al_pie=True&exportar_con_notas_bcn=True&exportar_con_notas_originales=True&exportar_formato=pdf&hddResultadoExportar=269892.2027-04-01.0.0%23&nombrearchivo=LEY-20255_17-MAR-2008&radioExportar=Normas`

3. **Ley N° 21.419 — Crea la PGU**
   - Ruta: `https://nuevo.leychile.cl/servicios/Consulta/Exportar?exportar_con_notas_al_pie=True&exportar_con_notas_bcn=True&exportar_con_notas_originales=True&exportar_formato=pdf&hddResultadoExportar=1171923.2023-04-01.0.0%23&nombrearchivo=Ley-21419_29-ENE-2022&radioExportar=Normas`

4. **Ley N° 21.735 — Reforma Previsional / Seguro Social Previsional**
   - Ruta: `https://www.leychile.cl/navegar?idNorma=1212060`

5. **Decreto N° 27 de 2025 — Reglamento de beneficios del Seguro Social Previsional**
   - Ruta: `https://nuevo.leychile.cl/servicios/Consulta/Exportar?exportar_con_notas_al_pie=True&exportar_con_notas_bcn=True&exportar_con_notas_originales=True&exportar_formato=pdf&hddResultadoExportar=1216921..0.0%23&nombrearchivo=Decreto-27_26-SEP-2025&radioExportar=Normas`

#### Superintendencia de Pensiones — consulta funcional y regulatoria

6. **Portal principal SP**
   - Ruta: `https://www71.spensiones.cl/portal/institucional/594/w3-channel.html`

7. **Compendio de Normas del Sistema de Pensiones**
   - Ruta principal: `https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-3483.html`

8. **Pensión de vejez / vejez anticipada**
   - Ruta: `https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9921.html`

9. **Pensión de sobrevivencia**
   - Ruta: `https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9922.html`

10. **Pensión de invalidez**
    - Ruta: `https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9923.html`

11. **Trabajo pesado — cotización adicional y rebaja de edad**
    - Ruta: `https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9918.html`
    - Ruta complementaria (requisitos AFP / IPS): `https://www.spensiones.cl/portal/institucional/594/w3-article-3575.html`
    - Ruta complementaria (rebaja 1% / 2%): `https://www.spensiones.cl/portal/institucional/594/w3-article-2903.html`

12. **Cotización previsional obligatoria**
    - Ruta: `https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9908.html`

13. **Comisión que cobra una AFP**
    - Ruta: `https://www.spensiones.cl/portal/institucional/594/w3-article-2810.html`

14. **Sistema AFP / afiliación y comisiones**
    - Ruta: `https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9897.html`

15. **PGU**
    - Ruta general: `https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-10531.html`
    - Ruta compendio: `https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10672.html`

16. **Mínimo y máximo imponibles / indicadores**
    - Ruta operativa: `https://www71.spensiones.cl/inf_estadistica/cotprev/cotprev.html`
    - Ruta compendio: `https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-3629.html`

17. **Promedio de remuneraciones imponibles (120 meses)**
    - Ruta: `https://www.spensiones.cl/portal/institucional/594/w3-article-7249.html`

#### Tablas de mortalidad y técnica actuarial

18. **Título X — Tablas de Mortalidad**
    - Ruta: `https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-3483.html`

19. **Capítulo IX — Tablas CB-H-2020, MI-H-2020, RV-M-2020, B-M-2020 y MI-M-2020**
    - Ruta: `https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10624.html`

20. **Anexo N° 9 — qx y factores de mejoramiento AAx,t**
    - Ruta: `https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10625.html`

21. **NCG CMF N° 495 de 2023 — Tablas de Mortalidad 2020**
    - Ruta PDF: `https://www.cmfchile.cl/normativa/ncg_495_2023.pdf`
    - Ruta portal: `https://www.cmfchile.cl/mascerca/601/w3-propertyvalue-43609.html`

#### Seguro Social Previsional — BAC y CEV

22. **Título XIX — disposiciones del Seguro Social Previsional**
    - Ruta de navegación general: `https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10820.html`

23. **Beneficio por Años Cotizados (BAC)**
    - Ruta de navegación: `https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10820.html`
    - Ruta de cálculo: `https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10829.html`

24. **Compensación por Diferencias de Expectativa de Vida (CEV)**
    - Ruta de navegación: `https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10821.html`
    - Ruta de cálculo: `https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10835.html`

#### Apoyo técnico y validación de ofertas / certificados

25. **SCOMP — Normativa e instrucciones**
    - Ruta referencial SP / compendio y anexos operativos: `https://spensiones.cl/portal/institucional/594/articles-11315_nt_524_compendiado.pdf`

26. **Pensiones de referencia / porcentajes de invalidez y sobrevivencia**
    - Ruta: `https://www.spensiones.cl/portal/institucional/594/w3-article-2959.html`
    - Ruta complementaria: `https://www.spensiones.cl/portal/institucional/594/w3-article-7045.html`

### 14.2 Fuentes internas y rutas de trabajo usadas en esta revisión

#### Archivos base recibidos del usuario

- Ruta interna original del perfil:
  - `/mnt/data/Importante.md`

- Ruta interna original de reglas de negocio:
  - `/mnt/data/ReglasNegocio.md`

#### Archivos técnicos complementarios utilizados en iteraciones previas

- Tablas / parámetros de trabajo:
  - `/mnt/data/tablas.json`

- Certificado SCOMP / oferta oficial de referencia:
  - `/mnt/data/CertOfe_F_Vejez Edad_154624401_20260320124557_ORI_FIRMADO (1).PDF`

### 14.3 Regla documental de mantenimiento

Se recomienda que toda nueva versión del perfil incluya al menos:

```txt
fecha_actualizacion_documento
fecha_revision_normativa
lista_fuentes_oficiales
version_compendio_revisada
version_tablas_mortalidad
version_parametros_operacionales
rutas_archivos_base
```

### 14.4 Criterio de precedencia documental

Cuando exista conflicto entre documentos, el orden de precedencia sugerido es:

1. Ley vigente.
2. Reglamento vigente.
3. Compendio SP y normas SP/CMF aplicables.
4. Certificados oficiales emitidos por sistemas regulatorios u operadores autorizados.
5. Parámetros publicados por SP / IPS / SII / CMF.
6. Documentación funcional interna.
7. Heurísticas, simuladores, comparadores o criterios UX.
---

*Documento generado como referencia técnica para procesos de selección, auditoría de equipos o evaluación de proyectos en el ámbito previsional chileno.*