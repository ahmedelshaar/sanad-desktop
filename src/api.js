// Thin wrapper over the preload bridge. Every call resolves to data or throws Error(code).
// When opened in a plain browser (no Electron), a small in-memory mock is used for UI work.
import { createMock } from './mockApi.js';

const bridge = typeof window !== 'undefined' && window.sanad ? window.sanad : createMock();

export const isElectron = typeof window !== 'undefined' && !!window.sanad;

function wrap(fn) {
  return async (...args) => {
    const res = await fn(...args);
    if (!res || !res.ok) throw new Error(res ? res.error : 'UNKNOWN');
    return res.data;
  };
}

function wrapAll(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'function' ? wrap(v) : wrapAll(v);
  }
  return out;
}

const { printReady, ...rest } = bridge;
export const api = { ...wrapAll(rest), printReady: printReady || (() => {}) };
