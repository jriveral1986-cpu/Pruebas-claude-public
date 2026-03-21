/**
 * store.js — localStorage wrapper (shared state bus)
 * All pages read/write through this module.
 * Key versioned to avoid stale data after schema changes.
 */

const KEY = 'pension_chile_v1';

export const Store = {
  leer() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  },

  guardar(parcial) {
    const actual = this.leer();
    localStorage.setItem(KEY, JSON.stringify({ ...actual, ...parcial }));
  },

  borrar() {
    localStorage.removeItem(KEY);
  },

  /**
   * Returns true when enough data is stored to compute results.
   * Used by ui.js initBtnActualizar to decide whether to fire
   * the 'datos-actualizados' event.
   */
  tieneResultados() {
    const d = this.leer();
    return !!(d.saldoTotal && d.uf && d.utm);
  }
};
