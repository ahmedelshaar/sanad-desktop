// Starts the real Electron app against a throw-away data folder.
import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function launch({ env: extraEnv = {}, dir: existingDir } = {}) {
  const dir = existingDir || fs.mkdtempSync(path.join(os.tmpdir(), 'sanad-e2e-'));
  const previews = path.join(dir, 'previews');
  fs.mkdirSync(previews, { recursive: true });
  const env = { ...process.env, SANAD_USER_DATA: dir, SANAD_PREVIEW_DIR: previews, ...extraEnv };
  delete env.VITE_DEV_SERVER_URL;
  delete env.ELECTRON_RUN_AS_NODE;

  const app = await electron.launch({
    executablePath: require('electron'),
    args: [ROOT, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    cwd: ROOT,
    env,
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.waitForSelector(extraEnv.SANAD_LICENSE_API ? '.gate, .sidebar' : '.sidebar');

  return {
    app,
    page,
    dir,
    previews,
    async close({ keep = false } = {}) {
      await closeApp(this.app);
      if (!keep) fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

// Closes Electron, killing it if it does not exit in time (e.g. a PDF preview window is open).
export async function closeApp(app) {
  const proc = app.process();
  await Promise.race([app.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
  if (proc && proc.exitCode === null) proc.kill('SIGKILL');
}

// Waits for a new preview PDF and returns { file, pages, landscape }.
export async function waitForPdf(previews, before = new Set(), timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const files = fs.readdirSync(previews).filter((f) => f.endsWith('.pdf') && !before.has(f));
    if (files.length) {
      const file = path.join(previews, files[0]);
      await new Promise((r) => setTimeout(r, 300));
      const raw = fs.readFileSync(file, 'latin1');
      const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
      const box = raw.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
      const w = box ? Number(box[3]) - Number(box[1]) : 0;
      const h = box ? Number(box[4]) - Number(box[2]) : 0;
      return { file, pages, width: w, height: h, landscape: w > h };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('No preview PDF was produced');
}

export function existing(previews) {
  return new Set(fs.readdirSync(previews));
}

export const tid = (id) => `[data-testid="${id}"]`;

// Types into a DateInput and commits with Enter.
export async function typeDate(page, testId, text) {
  const input = page.locator(tid(testId));
  await input.click();
  await input.fill(text);
  await input.press('Enter');
}

// Opens a custom Select and clicks the option with this exact text.
export async function choose(page, testId, optionText) {
  await page.locator(tid(testId)).click();
  await page.getByRole('option', { name: optionText, exact: true }).click();
}

// Waits until a locator matches exactly n elements (lists refresh after a short debounce).
export async function waitForCount(locator, n, timeout = 10000) {
  const end = Date.now() + timeout;
  let last = -1;
  while (Date.now() < end) {
    last = await locator.count();
    if (last === n) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`expected ${n} elements, found ${last}`);
}
