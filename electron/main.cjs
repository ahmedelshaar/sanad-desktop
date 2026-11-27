const { app, BrowserWindow, ipcMain, dialog, Menu, shell, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { openDb, inspectBackup } = require('./db.cjs');
const { createLicensing } = require('./licensing/index.cjs');
const licenseConfigFile = require('./license-config.json');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
let repo;
let dbFile;
let licensing;

// Calls that change data or print are refused while the license is locked (enforced here, not only
// hidden in the UI). Reading, settings and backup stay available.
const LICENSED_CHANNELS = new Set([
  'books:create',
  'books:createInstallments',
  'books:setStatus',
  'books:print',
  'vouchers:create',
  'vouchers:update',
  'vouchers:cancel',
  'vouchers:print',
]);

function licenseConfig() {
  const config = { ...licenseConfigFile };
  if (process.env.SANAD_LICENSE_API !== undefined) config.apiUrl = process.env.SANAD_LICENSE_API;
  if (process.env.SANAD_LICENSE_KEYS) config.publicKeys = JSON.parse(process.env.SANAD_LICENSE_KEYS);
  return config;
}

function startLicensing() {
  const secure = safeStorage.isEncryptionAvailable();
  licensing = createLicensing({
    store: repo.licenseStore,
    config: licenseConfig(),
    appVersion: app.getVersion(),
    protect: (s) => (secure ? `enc:${safeStorage.encryptString(s).toString('base64')}` : s),
    unprotect: (s) => (s.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(s.slice(4), 'base64')) : s),
  });
}

function broadcastLicense(state) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('license:changed', state);
}

async function checkLicense() {
  if (!licensing || !licensing.enabled) return;
  const before = licensing.status();
  const after = await licensing.check();
  if (before.state !== after.state || before.daysLeft !== after.daysLeft || before.validUntil !== after.validUntil) broadcastLicense(after);
}
let mainWindow;

function loadApp(win, hash = '') {
  if (DEV_URL) return win.loadURL(`${DEV_URL}${hash ? '#' + hash : ''}`);
  return win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), hash ? { hash } : undefined);
}

function webPrefs() {
  return {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
  };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1000,
    minHeight: 680,
    title: 'Sanad - سندات',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: webPrefs(),
  });
  // Links (e.g. the Eleva website) open in the default browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (!DEV_URL) Menu.setApplicationMenu(null);
  loadApp(mainWindow);
}

// First run: load the logo cropped from the client's paper form as the default stamp logo.
function seedDefaultLogo() {
  const s = repo.getSettings();
  if (s.logo_seeded === '1') return;
  const file = path.join(__dirname, 'assets', 'default-logo.png');
  const patch = { logo_seeded: '1' };
  if (!s.logo && fs.existsSync(file)) {
    patch.logo = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  }
  repo.saveSettings(patch);
}

// ---------- printing ----------
function pageSizeFromSettings(s) {
  if (s.paper === 'A4' || s.paper === 'A5') return s.paper;
  if (s.paper === 'A5L') return 'A5'; // printed with landscape: true
  const w = Math.round(parseFloat(s.paper_width_mm) * 1000);
  const h = Math.round(parseFloat(s.paper_height_mm) * 1000);
  if (!(w > 0 && h > 0)) return 'A4';
  return { width: w, height: h }; // microns
}

// Renders a print route (#/print/<id> or #/print-book/<id>) in a hidden window and waits
// until React says it is ready.
function renderForPrint(route) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: webPrefs() });
    const timer = setTimeout(() => {
      cleanup();
      win.destroy();
      reject(new Error('PRINT_TIMEOUT'));
    }, 60000);
    const onReady = (event) => {
      if (event.sender !== win.webContents) return;
      cleanup();
      resolve(win);
    };
    function cleanup() {
      clearTimeout(timer);
      ipcMain.removeListener('print:ready', onReady);
    }
    ipcMain.on('print:ready', onReady);
    loadApp(win, route);
  });
}

function printVoucher(voucherId, mode) {
  const v = repo.getVoucher(voucherId);
  if (!v) throw new Error('VOUCHER_NOT_FOUND');
  return printJob({
    route: `/print/${voucherId}`,
    ids: [voucherId],
    fileName: `sanad-${v.book_name}-${v.number_label}.pdf`,
    mode,
  });
}

// All active notes of a book: one PDF / one print job, one page per note.
function printBook(bookId, mode) {
  const book = repo.getBook(bookId);
  if (!book) throw new Error('BOOK_NOT_FOUND');
  const ids = repo
    .listVouchers({ bookId, status: 'active' })
    .map((v) => v.id)
    .reverse();
  if (!ids.length) throw new Error('BOOK_EMPTY');
  return printJob({ route: `/print-book/${bookId}`, ids, fileName: `sanad-${book.name}.pdf`, mode });
}

async function printJob({ route, ids, fileName, mode }) {
  const settings = repo.getSettings();
  const pageSize = pageSizeFromSettings(settings);
  const landscape = settings.paper === 'A5L';
  const win = await renderForPrint(route);
  try {
    if (mode === 'print') {
      const ok = await new Promise((resolve) => {
        win.webContents.print(
          {
            silent: settings.silent_print === '1',
            deviceName: settings.printer_name || undefined,
            printBackground: true,
            margins: { marginType: 'none' },
            pageSize,
            landscape,
          },
          (success, reason) => resolve(success || reason)
        );
      });
      if (ok === true) ids.forEach((id) => repo.markPrinted(id));
      return { ok: ok === true, reason: ok === true ? null : ok };
    }

    const pdf = await win.webContents.printToPDF({
      pageSize,
      landscape,
      printBackground: true,
      margins: { marginType: 'none' },
    });

    if (mode === 'pdf') {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath: fileName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return { ok: false, reason: 'cancelled' };
      fs.writeFileSync(filePath, pdf);
      return { ok: true, file: filePath };
    }

    // preview
    const previewDir = process.env.SANAD_PREVIEW_DIR || os.tmpdir();
    const file = path.join(previewDir, `sanad-preview-${Date.now()}.pdf`);
    fs.writeFileSync(file, pdf);
    const preview = new BrowserWindow({
      width: 900,
      height: 1000,
      title: 'معاينة السند - Preview',
      webPreferences: { plugins: true },
    });
    preview.setMenu(null);
    preview.loadURL('file://' + file);
    return { ok: true };
  } finally {
    win.destroy();
  }
}

// ---------- IPC ----------
function handle(channel, fn) {
  ipcMain.handle(channel, async (_e, ...args) => {
    try {
      if (LICENSED_CHANNELS.has(channel) && licensing && !licensing.usable()) throw new Error('LICENSE_LOCKED');
      return { ok: true, data: await fn(...args) };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  });
}

function registerIpc() {
  handle('app:info', () => ({ version: app.getVersion() }));
  handle('license:status', () => ({ ...licensing.status(), support: licenseConfig().support || {} }));
  handle('license:register', async (data) => {
    const email = String((data && data.email) || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('EMAIL_INVALID');
    const state = await licensing.register({ ...data, email });
    broadcastLicense(state);
    return state;
  });
  handle('license:check', async () => {
    const state = await licensing.check();
    broadcastLicense(state);
    return state;
  });
  handle('app:openSite', () => shell.openExternal('https://eleva-protech.com'));
  handle('settings:get', () => repo.getSettings());
  handle('settings:save', (values) => repo.saveSettings(values));
  handle('settings:pickLogo', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return null;
    const ext = path.extname(filePaths[0]).slice(1).toLowerCase();
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    return `data:${mime};base64,${fs.readFileSync(filePaths[0]).toString('base64')}`;
  });
  handle('printers:list', async () => {
    const list = await mainWindow.webContents.getPrintersAsync();
    return list.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: p.isDefault }));
  });
  handle('backup:create', async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `sanad-backup-${stamp}.db`,
      filters: [{ name: 'SQLite', extensions: ['db'] }],
    });
    if (canceled || !filePath) return null;
    await repo.backup(filePath);
    return filePath;
  });
  handle('backup:restore', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'SQLite', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return null;
    const source = filePaths[0];
    const info = inspectBackup(source); // throws BACKUP_INVALID

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['استرجاع - Restore', 'إلغاء - Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'استرجاع نسخة احتياطية - Restore backup',
      message: `النسخة فيها ${info.books} دفتر و ${info.vouchers} سند.\nالبيانات الحالية هتتستبدل بالنسخة دي.`,
      detail: `This backup has ${info.books} books and ${info.vouchers} notes. Current data will be replaced.\nA copy of the current data is saved first in the app data folder.`,
    });
    if (response !== 0) return null;

    // Keep a copy of the current data before replacing it.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safety = path.join(path.dirname(dbFile), `sanad-before-restore-${stamp}.db`);
    repo.backup(safety);

    // The license belongs to this machine, not to the data: keep it across the restore.
    const keep = ['device_id', 'device_secret', 'document', 'high_water', 'last_check_at'];
    const licenseRows = Object.fromEntries(keep.map((k) => [k, repo.licenseStore.get(k)]).filter(([, v]) => v !== null));

    repo.close();
    for (const ext of ['-wal', '-shm']) {
      try {
        fs.unlinkSync(dbFile + ext);
      } catch {
        /* not there */
      }
    }
    fs.copyFileSync(source, dbFile);
    repo = openDb(dbFile);
    repo.licenseStore.clear(keep);
    if (Object.keys(licenseRows).length) repo.licenseStore.set(licenseRows);
    startLicensing();
    setTimeout(() => mainWindow && mainWindow.reload(), 300);
    return { ...info, safety };
  });

  handle('books:list', () => repo.listBooks());
  handle('books:create', (data) => repo.createBook(data));
  handle('books:setStatus', (id, status) => repo.setBookStatus(id, status));
  handle('books:next', (id) => repo.nextNumber(id));

  handle('customers:search', (q) => repo.searchCustomers(q));

  handle('vouchers:list', (filters) => repo.listVouchers(filters));
  handle('vouchers:get', (id) => repo.getVoucher(id));
  handle('vouchers:create', (bookId, data) => repo.createVoucher(bookId, data));
  handle('vouchers:update', (id, data) => repo.updateVoucher(id, data));
  handle('vouchers:cancel', (id, reason) => repo.cancelVoucher(id, reason));
  handle('vouchers:print', (id, mode) => printVoucher(id, mode || 'print'));
  handle('books:print', (id, mode) => printBook(id, mode || 'print'));
  handle('books:createInstallments', (data) => repo.createInstallmentBook(data));
}

// Tests run the app against a throw-away data folder.
if (process.env.SANAD_USER_DATA) app.setPath('userData', process.env.SANAD_USER_DATA);

app.whenReady().then(() => {
  dbFile = path.join(app.getPath('userData'), 'sanad.db');
  repo = openDb(dbFile);
  seedDefaultLogo();
  startLicensing();
  registerIpc();
  createMainWindow();
  // Check with the server now and every 6 hours (silently; offline keeps the last signed answer).
  mainWindow.webContents.once('did-finish-load', () => checkLicense().catch(() => {}));
  setInterval(() => checkLicense().catch(() => {}), 6 * 3600_000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  try {
    repo && repo.close();
  } catch {
    /* ignore */
  }
});
