# Calculadora Previsional Chile

Calculadora de pensiones estática desplegada en GitHub Pages. Usa datos en tiempo real de SP Chile (vía proxy Cloudflare Worker) y mindicador.cl.

## Características

- **Valor cuota automático**: Se descarga desde SP Chile al seleccionar AFP + Fondo
- **Fix CORS**: Cloudflare Worker proxy resuelve el bloqueo de `spensiones.cl` en el browser
- **UF y UTM**: Obtenidos directamente de `mindicador.cl` (sin proxy, sin CORS)
- **Fallback offline**: `data/vc_cache.json` con valores recientes cuando no hay red
- **Informe con datos del cliente**: Nombre, RUT, edad y datos AFP en todos los informes PDF/CSV
- **Exportar PDF**: Diseño optimizado para impresión vía `print.css`
- **Exportar CSV**: Con encabezado de datos del cliente

## Configuración: Cloudflare Worker

1. Crear cuenta gratuita en [cloudflare.com](https://cloudflare.com)
2. Instalar Wrangler:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
3. Desplegar el worker:
   ```bash
   wrangler deploy worker-sp-proxy.js --name sp-proxy --compatibility-date 2026-01-01
   ```
4. Copiar la URL resultante: `https://sp-proxy.TU_SUBDOMAIN.workers.dev`
5. Editar `js/api.js` línea 1:
   ```javascript
   const PROXY_URL = 'https://sp-proxy.TU_SUBDOMAIN.workers.dev';
   ```
6. Hacer push a `main` para redesplegar GitHub Pages.

## GitHub Pages

1. Ir a Settings → Pages
2. Source: **GitHub Actions**
3. El workflow `.github/workflows/deploy.yml` se ejecuta automáticamente en cada push a `main`.

## Estructura

```
pension-chile/
├── worker-sp-proxy.js     ← Cloudflare Worker (CORS fix)
├── index.html
├── 404.html
├── pages/
│   ├── datos.html         ← Entrada de datos + auto-fetch valor cuota
│   ├── proyeccion.html    ← Pensión estimada + proyección de saldo
│   ├── modalidades.html   ← Comparativa RP vs RV
│   └── brechas.html       ← Análisis de brecha + aportes necesarios
├── js/
│   ├── store.js           ← localStorage (estado compartido entre páginas)
│   ├── api.js             ← Proxy CORS + mindicador.cl
│   ├── calculos.js        ← Fórmulas previsionales (puras)
│   ├── mortalidad.js      ← Tablas RV-2020 / B-2020
│   ├── comisiones.js      ← Comisiones AFP
│   ├── ui.js              ← Helpers DOM + botón Actualizar
│   └── exportar.js        ← PDF / CSV / JSON
├── css/
│   ├── main.css
│   └── print.css
└── data/
    ├── afp.json           ← AFPs y comisiones
    ├── tablas.json        ← Tablas de mortalidad + CRU
    └── vc_cache.json      ← Caché fallback valor cuota
```

## Flujo de datos

```
Seleccionar AFP + Fondo
  → api.js → Cloudflare Worker → SP Chile CSV → valor cuota
           → (si falla) vc_cache.json local

Botón "Actualizar"
  → mindicador.cl → UF del día
  → mindicador.cl → UTM del mes
  → Cloudflare Worker → SP Chile → valor cuota actualizado
  → Store.guardar({ uf, utm, topeImponible, valorCuota })
  → Evento 'datos-actualizados' → páginas recalculan
```

## Datos técnicos

- **Tablas de mortalidad**: RV-2020 (Renta Vitalicia) y B-2020 (Retiro Programado) — SP Chile
- **Tasa técnica**: 3% real anual (regulatoria)
- **Tope imponible 2026**: 90.0 × UF
- **Cotización obligatoria**: 10% remuneración imponible
- **Sin framework, sin bundler**: Vanilla ES modules, funciona en GitHub Pages sin build step

## Advertencia legal

Esta calculadora es de uso informativo. Los valores son estimaciones. Consulta a un asesor previsional certificado (CFP o asesor previsional autorizado por SP Chile) antes de tomar decisiones de jubilación.
