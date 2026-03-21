/**
 * worker-sp-proxy.js — Cloudflare Worker CORS Proxy
 *
 * PURPOSE:
 *   spensiones.cl blocks browser fetch requests with CORS errors.
 *   This worker runs on Cloudflare's edge, fetches the CSV on the
 *   server side, parses it, and returns JSON with CORS headers.
 *
 * DEPLOY:
 *   npm install -g wrangler
 *   wrangler login
 *   wrangler deploy worker-sp-proxy.js --name sp-proxy --compatibility-date 2026-01-01
 *
 * After deploy, copy the URL (https://sp-proxy.YOUR_SUBDOMAIN.workers.dev)
 * and replace TU_USUARIO in js/api.js.
 *
 * ENDPOINT:
 *   GET /?fondo=A   →  { fondo: "A", datos: { habitat: { valor, fecha }, ... } }
 *   GET /?fondo=B   →  same structure for fund B
 *   Valid fondos: A, B, C, D, E
 *
 * CACHING:
 *   Response is cached at Cloudflare edge for 1 hour (max-age=3600).
 *   Share values are updated daily by SP Chile, so 1h is appropriate.
 */

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsH() });
    }

    const url   = new URL(request.url);
    const fondo = url.searchParams.get('fondo') || 'A';

    if (!['A', 'B', 'C', 'D', 'E'].includes(fondo)) {
      return new Response(
        JSON.stringify({ error: 'Fondo inválido. Use A, B, C, D o E.' }),
        { status: 400, headers: corsH('application/json') }
      );
    }

    const spUrl = `https://www.spensiones.cl/apps/valoresCuotaFondo/vcfAFP.php?tf=${fondo}&csv=si`;

    let resp;
    try {
      resp = await fetch(spUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PensionChileBot/1.0)',
          'Accept':     'text/csv,text/plain,*/*',
        }
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'No se pudo conectar con SP Chile', detalle: String(e) }),
        { status: 502, headers: corsH('application/json') }
      );
    }

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: 'SP Chile respondió con error', status: resp.status }),
        { status: 502, headers: corsH('application/json') }
      );
    }

    const csv     = await resp.text();
    const rows    = csv.split('\n').filter(r => r.trim());
    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ error: 'CSV vacío o formato inesperado' }),
        { status: 502, headers: corsH('application/json') }
      );
    }

    // First row = headers: fecha;Capital;Cuprum;Habitat;Modelo;PlanVital;Provida;Uno
    const headers = rows[0].split(';').map(h => h.trim());
    const result  = {};

    // Find the last row with valid data (walk backwards)
    for (let i = rows.length - 1; i > 0; i--) {
      const cols = rows[i].split(';');
      if (cols.length < 2 || !cols[0] || !cols[1]) continue;

      const fecha = cols[0].trim();

      headers.forEach((afp, idx) => {
        if (idx === 0) return; // skip fecha column
        const raw = cols[idx] ? cols[idx].trim().replace(',', '.') : '0';
        const val = parseFloat(raw);
        if (val > 0) {
          // Normalize AFP name: lowercase, strip accents
          const afpKey = afp.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          result[afpKey] = { valor: val, fecha };
        }
      });
      break; // only the last valid row
    }

    return new Response(
      JSON.stringify({ fondo, datos: result }),
      { headers: corsH('application/json') }
    );
  }
};

function corsH(contentType = null) {
  const h = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control':                'public, max-age=3600',
  };
  if (contentType) h['Content-Type'] = contentType;
  return h;
}
