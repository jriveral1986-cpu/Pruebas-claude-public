/**
 * api.js — Economic indicator fetching with CORS proxy
 *
 * CORS problem: spensiones.cl blocks browser requests.
 * Solution: Cloudflare Worker proxy that fetches the CSV server-side
 * and returns JSON with Access-Control-Allow-Origin: *.
 *
 * IMPORTANT: Replace TU_USUARIO with your actual Cloudflare subdomain
 * after deploying worker-sp-proxy.js to Cloudflare Workers.
 *
 * Fallback chain for getValorCuota:
 *   1. In-memory session cache (_cache)
 *   2. Cloudflare Worker proxy (PROXY_URL)
 *   3. /data/vc_cache.json (ships with site, always available)
 */

const PROXY_URL  = 'https://sp-proxy.TU_USUARIO.workers.dev';
const MINDICADOR = 'https://mindicador.cl/api';
const _cache     = {};

/**
 * Get the latest share value (valor cuota) for an AFP in a given fund.
 *
 * @param {string} afp   - AFP id, e.g. 'habitat'
 * @param {string} fondo - Fund letter: 'A'|'B'|'C'|'D'|'E'
 * @returns {Promise<{valor: number, fecha: string, fuente: string} | null>}
 */
export async function getValorCuota(afp, fondo) {
  const key    = `vc_${fondo}`;
  const afpKey = afp.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. Session cache
  if (_cache[key]) {
    const dato = _cache[key][afpKey];
    return dato ? { ...dato, fuente: 'sesion' } : null;
  }

  // 2. Cloudflare Worker proxy → spensiones.cl
  try {
    const res  = await fetch(`${PROXY_URL}/?fondo=${fondo}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error('proxy-error');
    const json = await res.json();
    _cache[key] = json.datos;
    const dato  = json.datos[afpKey];
    if (!dato) throw new Error('afp-not-found');
    return { ...dato, fuente: 'sp-chile' };
  } catch (err) {
    console.warn('[api] getValorCuota: proxy falló, usando cache local.', err?.message ?? err);
    // 3. Local JSON fallback (always bundled with site)
    try {
      const base = location.pathname.includes('/pages/') ? '../' : './';
      const res  = await fetch(`${base}data/vc_cache.json`);
      const json = await res.json();
      const dato = json[fondo]?.[afpKey];
      if (dato) return { ...dato, fuente: 'cache-local' };
    } catch (err2) {
      console.warn('[api] getValorCuota: cache local también falló.', err2?.message ?? err2);
    }
    return null;
  }
}

/**
 * Get current UF value from mindicador.cl.
 * Fallback: hardcoded approximate value.
 *
 * @returns {Promise<{valor: number, fecha: string}>}
 */
export async function getUF() {
  if (_cache.uf) return _cache.uf;
  try {
    const res  = await fetch(`${MINDICADOR}/uf`, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    if (!json.serie?.length) throw new Error('serie vacía');
    _cache.uf  = { valor: json.serie[0].valor, fecha: json.serie[0].fecha };
    return _cache.uf;
  } catch (err) {
    console.warn('[api] getUF: usando fallback.', err?.message ?? err);
    return { valor: 39717, fecha: 'fallback' };
  }
}

/**
 * Get UF value for a specific date from mindicador.cl.
 * @param {string} fecha - ISO date 'YYYY-MM-DD'
 * @returns {Promise<{valor: number, fecha: string}>}
 */
export async function getUFFecha(fecha) {
  const cacheKey = `uf_${fecha}`;
  if (_cache[cacheKey]) return _cache[cacheKey];
  try {
    const [y, m, d] = fecha.split('-');
    const res  = await fetch(`${MINDICADOR}/uf/${d}-${m}-${y}`, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    if (json.serie?.[0]) {
      _cache[cacheKey] = { valor: json.serie[0].valor, fecha };
      return _cache[cacheKey];
    }
  } catch { /* fall through */ }
  return getUF(); // fallback to current
}

/**
 * Get current UTM value from mindicador.cl.
 * Fallback: hardcoded approximate value.
 *
 * @returns {Promise<{valor: number, fecha: string}>}
 */
export async function getUTM() {
  if (_cache.utm) return _cache.utm;
  try {
    const res  = await fetch(`${MINDICADOR}/utm`, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    if (!json.serie?.length) throw new Error('serie vacía');
    _cache.utm = { valor: json.serie[0].valor, fecha: json.serie[0].fecha };
    return _cache.utm;
  } catch (err) {
    console.warn('[api] getUTM: usando fallback.', err?.message ?? err);
    return { valor: 69889, fecha: 'fallback' };
  }
}

/**
 * Get UTM value for the month of a specific date from mindicador.cl.
 * @param {string} fecha - ISO date 'YYYY-MM-DD'
 * @returns {Promise<{valor: number, fecha: string}>}
 */
export async function getUTMFecha(fecha) {
  const [y, m] = fecha.split('-');
  const cacheKey = `utm_${y}_${m}`;
  if (_cache[cacheKey]) return _cache[cacheKey];
  try {
    const res  = await fetch(`${MINDICADOR}/utm/${y}`, { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    // Find the entry matching the month
    const entry = json.serie?.find(s => {
      const d = new Date(s.fecha);
      return d.getFullYear() === +y && (d.getMonth() + 1) === +m;
    });
    if (entry) {
      _cache[cacheKey] = { valor: entry.valor, fecha: entry.fecha };
      return _cache[cacheKey];
    }
  } catch { /* fall through */ }
  return getUTM(); // fallback to current
}

/**
 * Get valor cuota for a specific past date from the local historical cache.
 * Returns null if the date is not available.
 *
 * @param {string} afp   - AFP id, e.g. 'habitat'
 * @param {string} fondo - Fund letter: 'A'|'B'|'C'|'D'|'E'
 * @param {string} fecha - ISO date string 'YYYY-MM-DD'
 * @returns {Promise<{valor: number, fecha: string, fuente: string} | null>}
 */
export async function getValorCuotaFecha(afp, fondo, fecha) {
  const afpKey = afp.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  try {
    const base = location.pathname.includes('/pages/') ? '../' : './';
    const res  = await fetch(`${base}data/vc_historico.json`);
    const json = await res.json();
    // Exact date
    const valor = json[fondo]?.[fecha]?.[afpKey];
    if (valor !== undefined) return { valor, fecha, fuente: 'historico-local' };
    // Fallback: fecha anterior más cercana con datos para esta AFP
    const fechas = Object.keys(json[fondo] ?? {})
      .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && k <= fecha && json[fondo][k][afpKey] !== undefined)
      .sort((a, b) => b.localeCompare(a));
    if (fechas.length) {
      const nearest = fechas[0];
      return { valor: json[fondo][nearest][afpKey], fecha: nearest, fuente: 'historico-local-aprox' };
    }
  } catch { /* silent */ }
  return null;
}

/**
 * Returns sorted list of available dates in the historical cache for a given fund.
 * @param {string} fondo - 'A'|'B'|'C'|'D'|'E'
 * @returns {Promise<string[]>} sorted ISO date strings descending (newest first)
 */
export async function getFechasDisponibles(fondo) {
  try {
    const base = location.pathname.includes('/pages/') ? '../' : './';
    const res  = await fetch(`${base}data/vc_historico.json`);
    const json = await res.json();
    const fechas = Object.keys(json[fondo] ?? {}).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
    return fechas.sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

/**
 * Refresh all indicators at once (clears session cache first).
 * Called by the "Actualizar" button.
 *
 * @returns {Promise<{uf: {valor, fecha}, utm: {valor, fecha}, timestamp: string}>}
 */
export async function actualizarTodo() {
  // Clear session cache so fresh data is fetched
  Object.keys(_cache).forEach(k => delete _cache[k]);

  const [uf, utm] = await Promise.allSettled([getUF(), getUTM()]);
  return {
    uf:        uf.status  === 'fulfilled' ? uf.value  : { valor: 39717, fecha: 'fallback' },
    utm:       utm.status === 'fulfilled' ? utm.value : { valor: 69889, fecha: 'fallback' },
    timestamp: new Date().toISOString(),
  };
}
