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
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsH() });
    }

    const url    = new URL(request.url);
    const action = url.searchParams.get('action');

    // ── Chat IA endpoint (POST ?action=chat) ──────────────────────────────────
    if (request.method === 'POST' && action === 'chat') {
      return handleChat(request, env);
    }

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
        // Normalize AFP name: lowercase, strip accents
        const afpKey = afp.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const raw = cols[idx] ? cols[idx].trim().replace(',', '.') : '';
        const val = parseFloat(raw);
        // Include AFP in result even if no value (null = sin dato en SP Chile ese día)
        result[afpKey] = val > 0 ? { valor: val, fecha } : null;
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

// ── Chat IA handler ───────────────────────────────────────────────────────────
// Requires Cloudflare secret: wrangler secret put ANTHROPIC_API_KEY

async function handleChat(request, env) {
  const chatH = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
    'Cache-Control':                'no-store',
  };

  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Chat IA no configurado. Ejecuta: wrangler secret put ANTHROPIC_API_KEY' }),
      { status: 503, headers: chatH }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body JSON inválido' }), { status: 400, headers: chatH });
  }

  const { messages = [], context = {} } = body;

  // Sanitize messages
  const safeMessages = messages
    .slice(-20)
    .filter(m => m.role && m.content)
    .map(m => ({
      role:    m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content).slice(0, 1000),
    }));

  if (!safeMessages.length || safeMessages[safeMessages.length - 1].role !== 'user') {
    return new Response(
      JSON.stringify({ error: 'Se requiere al menos un mensaje del usuario' }),
      { status: 400, headers: chatH }
    );
  }

  let apiResp;
  try {
    apiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system:     buildSystemPrompt(context),
        messages:   safeMessages,
      }),
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Error al conectar con la API de IA', detalle: String(e) }),
      { status: 502, headers: chatH }
    );
  }

  if (!apiResp.ok) {
    return new Response(
      JSON.stringify({ error: 'Error de la API de IA', status: apiResp.status }),
      { status: 502, headers: chatH }
    );
  }

  const data      = await apiResp.json();
  const respuesta = data.content?.[0]?.text ?? '';
  return new Response(JSON.stringify({ respuesta }), { headers: chatH });
}

function buildSystemPrompt(ctx) {
  const fmt = n => n ? `$${Math.round(n).toLocaleString('es-CL')} CLP` : null;
  const lines = [
    `Eres "Previ", un asesor previsional virtual especializado en el sistema de pensiones chileno (DL 3.500 y normativa complementaria). Asesoras directamente a afiliados del sistema AFP de Chile.`,
    ``,
    `DATOS DE LA SIMULACIÓN ACTUAL DEL AFILIADO:`,
    `- AFP: ${ctx.afp || 'No especificada'} | Fondo: ${ctx.fondo || 'No especificado'}`,
    `- Edad: ${ctx.edad ? ctx.edad + ' años' : 'No especificada'} | Sexo: ${ctx.sexo === 'M' ? 'Masculino' : ctx.sexo === 'F' ? 'Femenino' : 'No especificado'}`,
    `- Saldo AFP: ${fmt(ctx.saldoTotal) || 'No especificado'}`,
    ctx.edadJubilacion  ? `- Edad jubilación objetivo: ${ctx.edadJubilacion} años` : null,
    ctx.saldoAPV > 0    ? `- Saldo APV: ${fmt(ctx.saldoAPV)}` : null,
    ctx.saldoDC  > 0    ? `- Depósitos Convenidos: ${fmt(ctx.saldoDC)}` : null,
    ctx.pensionObjetivo > 0 ? `- Pensión objetivo: ${fmt(ctx.pensionObjetivo)}/mes` : null,
    ``,
    `INSTRUCCIONES:`,
    `- Responde en español, con lenguaje claro y accesible para una persona sin formación financiera.`,
    `- Sé conciso: máximo 3-4 párrafos por respuesta.`,
    `- Cuando sea relevante, menciona el artículo del DL 3.500 o la NCG aplicable.`,
    `- No garantices montos exactos ni rentabilidades futuras.`,
    `- Para preguntas médicas, legales o tributarias fuera del ámbito previsional, recomienda un profesional.`,
    `- Temas de tu dominio: AFP, multifondos (A-E), retiro programado, renta vitalicia, modalidad mixta, APV (Régimen A y B), depósitos convenidos, PGU (Ley 21.419), bono por hijo nacido vivo, invalidez, vejez anticipada, trabajo pesado, PMAS, ELD, brecha previsional, bono de reconocimiento.`,
    `- Si el afiliado pregunta por sus datos, usa el contexto de arriba.`,
    `- Cuando menciones leyes o normativa, indica que pueden descargarlas desde BCN o la Superintendencia de Pensiones.`,
  ].filter(l => l !== null).join('\n');
  return lines;
}
