#!/usr/bin/env node
/**
 * Release build only: copies electron/ to .harden/electron/ with the main-process code obfuscated
 * (licensing, data layer, IPC). electron-builder packs .harden/electron instead of electron/.
 * Running from the source (npm start, tests) uses electron/ as is.
 *
 * Obfuscation is one layer; the others are the Electron fuses + asar integrity in package.json
 * (a changed app.asar does not start) and the license checks in three places (IPC gate, data layer,
 * print path). See CLAUDE.md "Licensing".
 */
const fs = require('node:fs');
const path = require('node:path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const root = path.join(__dirname, '..');
const src = path.join(root, 'electron');
const out = path.join(root, '.harden', 'electron');

// Files with the license logic and its enforcement get the heavy settings.
const HEAVY = new Set(['main.cjs', 'db.cjs', 'licensing/index.cjs', 'licensing/crypto.cjs', 'licensing/device.cjs']);

const base = {
  target: 'node',
  compact: true,
  simplify: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  numbersToExpressions: true,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  sourceMap: false,
};
const heavy = {
  ...base,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.6,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  selfDefending: true,
};

function walk(dir, rel = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const from = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    const to = path.join(out, relPath);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      walk(from, relPath);
    } else if (/\.c?js$/.test(entry.name)) {
      const code = fs.readFileSync(from, 'utf8');
      const result = JavaScriptObfuscator.obfuscate(code, HEAVY.has(relPath) ? heavy : base);
      fs.writeFileSync(to, result.getObfuscatedCode());
      console.log(`obfuscated ${relPath}${HEAVY.has(relPath) ? ' (heavy)' : ''}`);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

fs.rmSync(path.join(root, '.harden'), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
walk(src);

// .harden/ is also a runnable app folder (package.json + dist link), so the e2e suite can drive the
// obfuscated code: SANAD_E2E_APP=.harden npm run test:e2e (see test:e2e:hardened).
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(
  path.join(root, '.harden', 'package.json'),
  JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, main: pkg.main }, null, 2)
);
fs.symlinkSync(path.join(root, 'dist'), path.join(root, '.harden', 'dist'), 'junction');
