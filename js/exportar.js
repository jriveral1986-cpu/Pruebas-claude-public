/**
 * exportar.js — Export utilities
 * PDF via window.print() + print.css
 * CSV and JSON via Blob download
 */

import { Store }    from './store.js';
import { formatCLP } from './ui.js';

/* ── PDF (print) ────────────────────────────────────── */

/**
 * Triggers the browser print dialog.
 * print.css handles the layout for PDF/paper output.
 * Injects a temporary date attribute on the last .section for the footer.
 */
export function exportarPDF() {
  const fecha = new Date().toLocaleDateString('es-CL', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  // Set data-fecha on last section so print.css footer can read it
  const secciones = document.querySelectorAll('.section');
  if (secciones.length) secciones[secciones.length - 1].setAttribute('data-fecha', fecha);

  window.print();
}

/* ── CSV ────────────────────────────────────────────── */

/**
 * Builds a CSV string from rows (Array<Array<any>>) and triggers download.
 * Automatically prepends client info header rows from Store.
 *
 * @param {Array<Array<string|number>>} filas - data rows (first row = headers)
 * @param {string} nombreArchivo - filename without extension
 */
export function exportarCSV(filas, nombreArchivo = 'informe-previsional') {
  const d = Store.leer();
  const fecha = d.fechaEvaluacion
    ? new Date(d.fechaEvaluacion).toLocaleDateString('es-CL')
    : new Date().toLocaleDateString('es-CL');

  const metaRows = [
    ['Informe Previsional — Calculadora Previsional Chile'],
    [''],
    ['Nombre',           d.nombreCliente || ''],
    ['RUT',              d.rutCliente    || ''],
    ['Fecha evaluación', fecha],
    ['AFP',              d.afp   ? d.afp.charAt(0).toUpperCase() + d.afp.slice(1) : ''],
    ['Fondo',            d.fondo ? `Fondo ${d.fondo}` : ''],
    ['Saldo total',      d.saldoTotal ? Math.round(d.saldoTotal) : ''],
    ['UF utilizada',     d.uf    || ''],
    ['UTM utilizada',    d.utm   || ''],
    [''],
    ...filas
  ];

  const csvContent = metaRows.map(row =>
    row.map(cell => {
      const str = String(cell ?? '');
      // Quote cells that contain commas, quotes or newlines
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  ).join('\n');

  _descargar(
    new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' }),
    `${nombreArchivo}-${_fechaArchivo()}.csv`
  );
}

/* ── JSON ───────────────────────────────────────────── */

/**
 * Exports the full Store data plus any extra data as JSON.
 * @param {object} datosExtra - additional computed results to include
 * @param {string} nombreArchivo
 */
export function exportarJSON(datosExtra = {}, nombreArchivo = 'datos-previsionales') {
  const payload = {
    _generado: new Date().toISOString(),
    _fuente:   'Calculadora Previsional Chile',
    ...Store.leer(),
    ...datosExtra
  };
  _descargar(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    `${nombreArchivo}-${_fechaArchivo()}.json`
  );
}

/* ── Internal helpers ───────────────────────────────── */

function _descargar(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = nombreArchivo;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function _fechaArchivo() {
  return new Date().toISOString().slice(0, 10);
}
