# Normativa Pensiones — Claude Code

Sub-proyecto del repositorio principal. Extrae y publica normativa previsional de la SP Chile.

## Comando principal

Para actualizar el sitio con los datos más recientes de la SP:

```bash
node scripts/update.js
```

Esto hace todo automáticamente:
1. Abre Chromium headless y extrae NCGs desde spensiones.cl
2. Detecta NCGs nuevas comparando contra `data/ncg.json`
3. Si hay nuevas: actualiza `data/ncg.json` + `data/ncg_meta.json`
4. Regenera `index.html` con los datos frescos

## Comandos individuales

```bash
node scripts/scrape.js   # Solo extrae y muestra (no guarda nada)
node scripts/build.js    # Solo regenera el HTML desde ncg.json actual
node scripts/update.js   # Flujo completo (scrape + diff + build)
```

## Setup inicial (una sola vez)

```bash
cd normativa-pensiones
npm install
npx playwright install chromium
```

## Si hay errores de red

La SP puede tardar en cargar. Playwright reintenta 3 veces con timeout de 30s.
Si falla consistentemente, el sitio de la SP puede estar caído — verifica en el navegador.

## Despliegue

`index.html` es completamente autocontenido. Para publicar:
- Copiar a cualquier servidor estático (GitHub Pages, Netlify, etc.)
- O abrir directamente en el navegador con `file://` (sin servidor necesario)

## Estructura de datos

`data/ncg.json` — Array principal, fuente de verdad:
```json
[{ "num": 360, "numStr": "0360", "fecha": "2026-03-04", "year": 2026, "mat": "..." }]
```

`data/ncg_meta.json` — Metadatos de auditoría:
```json
{
  "last_updated": "2026-03-24T10:30:00Z",
  "total_records": 360,
  "max_num": 360,
  "new_since_last": ["360"],
  "checksum": "sha256:abc123..."
}
```
