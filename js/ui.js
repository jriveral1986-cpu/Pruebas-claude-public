/**
 * ui.js — Shared UI helpers and the global "Actualizar" button.
 * Imported by all pages.
 */

import { actualizarTodo, getValorCuota } from './api.js';
import { Store }                          from './store.js';
import { cargarAFP, getAfps, getFondos }  from './comisiones.js?v=3';

/* ── Formatting helpers ─────────────────────────────── */

export function formatCLP(numero) {
  return '$' + Math.round(numero).toLocaleString('es-CL');
}

export function formatUF(numero) {
  return numero.toFixed(4) + ' UF';
}

export function formatPct(decimal) {
  return (decimal * 100).toFixed(1) + '%';
}

/* ── Fuente badge ───────────────────────────────────── */

/**
 * Renders a colored badge showing data provenance.
 * @param {HTMLElement} container - element to render into
 * @param {string} fuente - 'sp-chile' | 'cache-local' | 'sesion'
 */
export function mostrarFuenteBadge(container, fuente) {
  if (!container) return;
  const labels = {
    'sp-chile':    { text: 'SP Chile (oficial)', cls: 'badge--sp-chile' },
    'cache-local': { text: 'Caché local',        cls: 'badge--cache-local' },
    'sesion':      { text: 'Sesión',             cls: 'badge--sesion' },
  };
  const info = labels[fuente] || { text: fuente, cls: 'badge--info' };
  container.innerHTML = `<span class="badge ${info.cls}">${info.text}</span>`;
}

/* ── Loading indicator ──────────────────────────────── */

export function mostrarCargando(container) {
  if (container) container.innerHTML = '<span class="spinner"></span>';
}
export function ocultarCargando(container) {
  if (container) container.innerHTML = '';
}

/* ── AFP / Fondo selects ────────────────────────────── */

/**
 * Populates an AFP <select> from afp.json and restores stored selection.
 * Also attaches a 'change' listener that auto-fetches valor cuota
 * when both AFP and Fondo have values.
 */
export async function initSelectAFP(selectEl) {
  if (!selectEl) return;
  await cargarAFP();
  const afps = getAfps();
  selectEl.innerHTML = '<option value="">Selecciona AFP…</option>';
  afps.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.nombre;
    selectEl.appendChild(opt);
  });
  const stored = Store.leer().afp;
  if (stored) selectEl.value = stored;
}

/**
 * Populates a Fondo <select> (A-E) and restores stored selection.
 */
export async function initSelectFondo(selectEl) {
  if (!selectEl) return;
  await cargarAFP();
  const fondos = getFondos();
  selectEl.innerHTML = '<option value="">Selecciona Fondo…</option>';
  fondos.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = `Fondo ${f.id} — ${f.descripcion}`;
    selectEl.appendChild(opt);
  });
  const stored = Store.leer().fondo;
  if (stored) selectEl.value = stored;
}

/* ── Datos del cliente ──────────────────────────────── */

/**
 * Fills the .informe-header data cells from Store on result pages.
 */
export function mostrarDatosCliente() {
  const d = Store.leer();
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  };
  set('infoNombre',    d.nombreCliente);
  set('infoRUT',       d.rutCliente);
  // Compute age from stored fechaNacimiento if edad not directly stored
  let edad = d.edad;
  if (!edad && d.fechaNacimiento) {
    const hoy   = new Date();
    const nac   = new Date(d.fechaNacimiento);
    edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  }
  set('infoEdad',      edad ? `${edad} años` : '—');
  set('infoSexo',      d.sexo === 'M' ? 'Hombre' : d.sexo === 'F' ? 'Mujer' : '—');
  set('infoAFP',       d.afp ? d.afp.charAt(0).toUpperCase() + d.afp.slice(1) : '—');
  set('infoFondo',     d.fondo ? `Fondo ${d.fondo}` : '—');
  set('infoSaldo',     d.saldoTotal ? formatCLP(d.saldoTotal) : '—');
  set('infoFechaEval', d.fechaEvaluacion
    ? new Date(d.fechaEvaluacion).toLocaleDateString('es-CL')
    : new Date().toLocaleDateString('es-CL'));
}

/* ── "Actualizar" button ────────────────────────────── */

/**
 * Initializes the global refresh button present in all pages.
 * Fetches live UF, UTM, and updates valor cuota if AFP/Fondo are known.
 * Fires 'datos-actualizados' custom event on success so pages can re-render.
 */
export function initBtnActualizar() {
  const btn  = document.getElementById('btnActualizar');
  const info = document.getElementById('infoAct');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.textContent = 'Actualizando...';
    btn.className   = 'btn-actualizar cargando';
    try {
      const res  = await actualizarTodo();
      // Update tope imponible (90.0 × UF — tope imponible 2026, Regla 4.1)
      const tope = Math.round(90.0 * res.uf.valor);
      Store.guardar({ uf: res.uf.valor, ufFecha: res.uf.fecha, utm: res.utm.valor, utmFecha: res.utm.fecha, topeImponible: tope, _ultimaAct: res.timestamp });

      // If AFP + Fondo are known, update valor cuota too
      const d = Store.leer();
      if (d.afp && d.fondo) {
        const vc = await getValorCuota(d.afp, d.fondo);
        if (vc?.valor) {
          Store.guardar({ valorCuota: vc.valor, fechaVC: vc.fecha });
          const el = document.getElementById('valorCuota');
          if (el) el.value = vc.valor;
        }
      }

      btn.textContent = 'Actualizado';
      btn.className   = 'btn-actualizar exito';
      const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      if (info) info.textContent = `${hora} · UF ${formatCLP(res.uf.valor)}`;

      // Notify all pages that indicators updated (always), plus pages with results
      window.dispatchEvent(new CustomEvent('datos-actualizados'));

      setTimeout(() => {
        btn.textContent = 'Actualizar';
        btn.className   = 'btn-actualizar';
      }, 4000);
    } catch {
      btn.textContent = 'Sin conexión';
      btn.className   = 'btn-actualizar error';
      if (info) info.textContent = '';
      setTimeout(() => {
        btn.textContent = 'Actualizar';
        btn.className   = 'btn-actualizar';
      }, 4000);
    }
  });

  // Show timestamp from last saved refresh
  const d = Store.leer();
  if (d._ultimaAct && info) {
    const hora = new Date(d._ultimaAct).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    info.textContent = `Últ. ${hora}`;
  }
}

/* ── Active nav link ────────────────────────────────── */

/**
 * Marks the current page's nav link as active.
 * Called automatically when module loads.
 */
export function marcarNavActiva() {
  const path = location.pathname;
  document.querySelectorAll('.nav__link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (path.endsWith(href) || (href !== '/' && href !== '' && path.includes(href))) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

// Auto-run on import
marcarNavActiva();
