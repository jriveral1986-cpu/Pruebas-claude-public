@import ReglasNegocio.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Serve locally (no build step needed)
python -m http.server 3000

# Deploy Cloudflare Worker (CORS proxy)
npm install -g wrangler
wrangler login
wrangler deploy worker-sp-proxy.js --name sp-proxy --compatibility-date 2026-01-01
```

## Normativa (NCG)

Scripts en `js/`, datos en `data/`, salida en `pages/normativa.html`.

```bash
# Actualizar normativa desde spensiones.cl (scrape + diff + build)
node js/update.js

# Solo regenerar HTML desde data/ncg.json actual
node js/build.js

# Solo extraer (sin guardar)
node js/scrape.js
```

Setup inicial (una sola vez):
```bash
npm install
npx playwright install chromium
```

Datos: `data/ncg.json` (360 NCGs, fuente de verdad) · `data/ncg_meta.json` (auditoría).

Deploy to production: push to `main` → GitHub Actions auto-deploys to GitHub Pages.

## Architecture

**Zero-build static site** — vanilla ES modules, no bundler, no framework. Works directly in GitHub Pages.

### Cross-page State

All data flows through `js/store.js` (a `localStorage` wrapper under key `pension_chile_v1`). This is the only shared state bus between pages. Key fields stored: `afp`, `fondo`, `saldoTotal`, `valorCuota`, `uf`, `utm`, `edad`, `sexo`, `pensionObjetivo`.

When `Actualizar` is clicked, `ui.js:initBtnActualizar()` fetches fresh data, saves to Store, then fires a `datos-actualizados` CustomEvent — result pages listen for this event to re-render.

### Page Flow

```
index.html → pages/datos.html → pages/proyeccion.html
                                pages/modalidades.html
                                pages/brechas.html
```

`datos.html` is the entry point: user enters AFP/fondo/saldo and the page auto-fetches `valorCuota` from the API. All other pages read from Store and recompute on load.

### API / CORS Architecture

`spensiones.cl` blocks browser requests. Solution: `worker-sp-proxy.js` (Cloudflare Worker) fetches the SP Chile CSV server-side and returns JSON with CORS headers.

**Fallback chain in `js/api.js`:**
1. In-memory session cache (`_cache` object)
2. Cloudflare Worker → SP Chile (live data)
3. `data/vc_cache.json` (bundled, always available offline)

UF and UTM fetch directly from `mindicador.cl` (no proxy needed — they allow CORS).

**To update the proxy URL:** edit `js/api.js` line 1 (`PROXY_URL`).

### Calculation Engine

`js/calculos.js` contains all pension math — pure functions, no side effects, no DOM, no fetch:
- `calcularPensionRP()` — Retiro Programado using B-2020 mortality tables + 3% real discount rate
- `calcularPensionRV()` — Renta Vitalicia using RV-2020 tables (1.08× CRU factor vs B-2020)
- `proyectarSaldo()` — compound growth projection with monthly contributions
- `calcularAportacionNecesaria()` — solves FV annuity equation to find required monthly savings

`js/mortalidad.js` provides `getCRU(sexo, edad)` and `esperanzaVida(sexo, edad)` from the embedded RV-2020/B-2020 tables in `data/tablas.json`.

### Module Responsibilities

| Module | Role |
|---|---|
| `store.js` | localStorage read/write, cross-page state |
| `api.js` | Fetch valor cuota (via proxy), UF, UTM |
| `calculos.js` | Pure pension math (RP, RV, brecha, proyección) |
| `mortalidad.js` | CRU lookups from tablas.json |
| `comisiones.js` | AFP commission rates from afp.json |
| `ui.js` | Shared DOM helpers, AFP/Fondo selects, Actualizar button, nav active state |
| `exportar.js` | PDF (via print dialog), CSV, JSON export |

### Relative Paths

Pages in `pages/` use `../` prefix for assets. `api.js` detects location automatically:
```js
const base = location.pathname.includes('/pages/') ? '../' : './';
```

## Key Data Files

- `data/afp.json` — AFP IDs, names, commission rates
- `data/tablas.json` — Mortality tables RV-2020 (Renta Vitalicia) and B-2020 (Retiro Programado)
- `data/vc_cache.json` — Fallback valor cuota; update manually when deploying with fresh values

## Regulatory Constants

- Tope imponible: `87.8 × UF`
- Mandatory contribution: 10% of remuneración imponible
- Technical rate: 3% real annual
- Retirement age defaults: 65 (men), 60 (women)

## CSS

Single stylesheet `css/main.css` shared across all pages with CSS custom properties (`--color-primary`, `--font-sans`, etc.). `css/print.css` handles PDF export layout. `index.html` has page-specific style overrides in an inline `<style>` block (IBM Plex Sans font, redesigned hero/cards).


## Rules
- cada vez que se realice un cambio lo levante nuevamente
- Para cualquier tarea de UI, aplicar las directrices del skill `ui-ux-pro-max`.
- Touch targets mínimo 44×44px en todos los elementos interactivos.
- Animaciones entre 150–300ms con curva `ease-in-out`.
- Respetar `prefers-reduced-motion` en todas las animaciones CSS.
- Diseño mobile-first con breakpoints estándar: 375 / 768 / 1024 / 1440px.
- Cada regla nueva, agrega la regla de negocio en el MD ReglasNegocio
- **No usar emojis como íconos de UI** — usar SVG (Heroicons, Lucide o íconos inline).
## Validación visual
- Para cambios de UI, validar con Playwright en viewport **1440×860** (desktop) y **375×812** (mobile) antes de reportar la tarea como completa.



