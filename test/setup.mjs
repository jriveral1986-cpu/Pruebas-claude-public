/**
 * test/setup.mjs — Node.js globals patch for ES module tests.
 * Patches `fetch` and `location` so mortalidad.js works in Node without a browser.
 * Import via: node --import ./test/setup.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '..');

// Patch location so mortalidad.js resolves paths correctly
globalThis.location = { pathname: '/' };

// Patch fetch to serve local JSON files
globalThis.fetch = async (url) => {
  const filePath = resolve(ROOT, url.replace(/^\.\//, '').replace(/^\//, ''));
  const text = readFileSync(filePath, 'utf8');
  return {
    ok: true,
    json: async () => JSON.parse(text),
    text: async () => text,
  };
};
