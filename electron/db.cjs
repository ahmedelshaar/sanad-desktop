// Database layer (SQLite via better-sqlite3).
// Kept free of Electron imports so it can be tested with plain Node.

const Database = require('better-sqlite3');

const DEFAULT_SETTINGS = {
  ui_lang: 'ar',
  // Header printed at the top of the voucher
  header_title: 'معرض لبيع وشراء السيارات',
  header_owner: 'لصاحبه / ',
  header_license: '',
  header_contacts: '',
  logo: '', // data URL
  city: '',
  creditor_name: '', // default "الطرف الأول"
  footer_text:
    'هذا السند واجب الدفع بموجب قرار مجلس الوزراء الموقر رقم 693 وتاريخ 26 / 9 / 1383 هـ المتوج بالمرسوم الملكي الكريم رقم 37 وتاريخ 11 / 10 / 1383 هـ ( الخاص بتنظيم الأوراق التجارية )',
  // Printing
  paper: 'A4', // A4 | A5 | custom
  paper_width_mm: '210',
  paper_height_mm: '297',
  offset_x_mm: '0',
  offset_y_mm: '0',
  scale: '1',
  printer_name: '',
  silent_print: '0',
  print_digits: 'arabic', // arabic | latin
};

const VOUCHER_FIELDS = [
  'issue_date',
  'due_date',
  'city',
  'amount',
  'amount_words',
  'reason',
  'debtor_name',
  'debtor_id_number',
  'debtor_id_date',
  'debtor_id_source',
  'debtor_address',
  'debtor_phone',
  'creditor_name',
  'guarantor_name',
  'guarantor_id_number',
  'guarantor_id_date',
  'guarantor_id_source',
  'guarantor_address',
  'guarantor_phone',
  'witness1',
  'witness2',
  'notes',
];

function seqLabel(seq, count) {
  const width = Math.max(2, String(count).length);
  return String(seq).padStart(width, '0');
}

function openDb(file) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return createRepo(db);
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      count INTEGER NOT NULL CHECK (count > 0),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      id_number TEXT UNIQUE,
      id_date TEXT,
      id_source TEXT,
      address TEXT,
      phone TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id),
      seq INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
      issue_date TEXT,
      due_date TEXT,
      city TEXT,
      amount REAL NOT NULL DEFAULT 0,
      amount_words TEXT,
      reason TEXT,
      debtor_name TEXT,
      debtor_id_number TEXT,
      debtor_id_date TEXT,
      debtor_id_source TEXT,
      debtor_address TEXT,
      debtor_phone TEXT,
      creditor_name TEXT,
      guarantor_name TEXT,
      guarantor_id_number TEXT,
      guarantor_id_date TEXT,
      guarantor_id_source TEXT,
      guarantor_address TEXT,
      guarantor_phone TEXT,
      witness1 TEXT,
      witness2 TEXT,
      notes TEXT,
      cancel_reason TEXT,
      print_count INTEGER NOT NULL DEFAULT 0,
      last_printed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE (book_id, seq)
    );

    CREATE INDEX IF NOT EXISTS idx_vouchers_debtor ON vouchers(debtor_name);
    CREATE INDEX IF NOT EXISTS idx_vouchers_debtor_id ON vouchers(debtor_id_number);
  `);

  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insert.run(k, v);
}

function createRepo(db) {
  // ---------- settings ----------
  function getSettings() {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const out = { ...DEFAULT_SETTINGS };
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  function saveSettings(values) {
    const stmt = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    db.transaction(() => {
      for (const [k, v] of Object.entries(values || {})) {
        if (!(k in DEFAULT_SETTINGS)) continue;
        stmt.run(k, v == null ? '' : String(v));
      }
    })();
    return getSettings();
  }

  // ---------- books ----------
  const bookSelect = `
    SELECT b.*,
      (SELECT COUNT(*) FROM vouchers v WHERE v.book_id = b.id) AS used,
      (SELECT COUNT(*) FROM vouchers v WHERE v.book_id = b.id AND v.status = 'cancelled') AS cancelled
    FROM books b`;

  function listBooks() {
    return db.prepare(`${bookSelect} ORDER BY b.id DESC`).all();
  }

  function getBook(id) {
    return db.prepare(`${bookSelect} WHERE b.id = ?`).get(id);
  }

  function createBook({ name, count, notes }) {
    const n = parseInt(count, 10);
    if (!name || !String(name).trim()) throw new Error('BOOK_NAME_REQUIRED');
    if (!Number.isInteger(n) || n < 1 || n > 10000) throw new Error('BOOK_COUNT_INVALID');
    const info = db
      .prepare('INSERT INTO books (name, count, notes) VALUES (?, ?, ?)')
      .run(String(name).trim(), n, notes || null);
    return getBook(info.lastInsertRowid);
  }

  function setBookStatus(id, status) {
    if (!['open', 'closed'].includes(status)) throw new Error('BAD_STATUS');
    const book = getBook(id);
    if (!book) throw new Error('BOOK_NOT_FOUND');
    if (status === 'open' && book.used >= book.count) throw new Error('BOOK_FULL');
    db.prepare('UPDATE books SET status = ? WHERE id = ?').run(status, id);
    return getBook(id);
  }

  function nextNumber(bookId) {
    const book = getBook(bookId);
    if (!book) throw new Error('BOOK_NOT_FOUND');
    const seq = book.used + 1;
    return {
      book,
      seq,
      label: seqLabel(Math.min(seq, book.count), book.count),
      full: seq > book.count,
    };
  }

  // ---------- customers ----------
  function upsertCustomer(c) {
    if (!c || !c.name || !String(c.name).trim()) return;
    const idNumber = c.id_number ? String(c.id_number).trim() : null;
    if (idNumber) {
      db.prepare(
        `INSERT INTO customers (name, id_number, id_date, id_source, address, phone)
         VALUES (@name, @id_number, @id_date, @id_source, @address, @phone)
         ON CONFLICT(id_number) DO UPDATE SET
           name = excluded.name, id_date = excluded.id_date, id_source = excluded.id_source,
           address = excluded.address, phone = excluded.phone,
           updated_at = datetime('now','localtime')`
      ).run({
        name: String(c.name).trim(),
        id_number: idNumber,
        id_date: c.id_date || null,
        id_source: c.id_source || null,
        address: c.address || null,
        phone: c.phone || null,
      });
    }
  }

  function searchCustomers(q) {
    const like = `%${(q || '').trim()}%`;
    return db
      .prepare(
        `SELECT * FROM customers WHERE name LIKE ? OR id_number LIKE ? OR phone LIKE ?
         ORDER BY updated_at DESC LIMIT 15`
      )
      .all(like, like, like);
  }

  // ---------- vouchers ----------
  const voucherSelect = `
    SELECT v.*, b.name AS book_name, b.count AS book_count
    FROM vouchers v JOIN books b ON b.id = v.book_id`;

  function decorate(v) {
    if (!v) return v;
    return { ...v, number_label: seqLabel(v.seq, v.book_count) };
  }

  function pick(data) {
    const out = {};
    for (const f of VOUCHER_FIELDS) out[f] = data[f] == null || data[f] === '' ? null : data[f];
    out.amount = Number(data.amount) || 0;
    return out;
  }

  function saveParties(data) {
    upsertCustomer({
      name: data.debtor_name,
      id_number: data.debtor_id_number,
      id_date: data.debtor_id_date,
      id_source: data.debtor_id_source,
      address: data.debtor_address,
      phone: data.debtor_phone,
    });
    upsertCustomer({
      name: data.guarantor_name,
      id_number: data.guarantor_id_number,
      id_date: data.guarantor_id_date,
      id_source: data.guarantor_id_source,
      address: data.guarantor_address,
      phone: data.guarantor_phone,
    });
  }

  function validate(data) {
    if (!data.debtor_name || !String(data.debtor_name).trim()) throw new Error('DEBTOR_REQUIRED');
    if (!(Number(data.amount) > 0)) throw new Error('AMOUNT_REQUIRED');
  }

  // The number is reserved inside one transaction, so two saves can never get the same number.
  const createVoucherTx = db.transaction((bookId, data) => {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    if (!book) throw new Error('BOOK_NOT_FOUND');
    if (book.status !== 'open') throw new Error('BOOK_CLOSED');
    const { maxSeq } = db
      .prepare('SELECT COALESCE(MAX(seq), 0) AS maxSeq FROM vouchers WHERE book_id = ?')
      .get(bookId);
    const seq = maxSeq + 1;
    if (seq > book.count) throw new Error('BOOK_FULL');

    const row = pick(data);
    const cols = Object.keys(row);
    const info = db
      .prepare(
        `INSERT INTO vouchers (book_id, seq, ${cols.join(', ')})
         VALUES (@book_id, @seq, ${cols.map((c) => '@' + c).join(', ')})`
      )
      .run({ ...row, book_id: bookId, seq });

    if (seq === book.count) db.prepare("UPDATE books SET status = 'closed' WHERE id = ?").run(bookId);
    saveParties(data);
    return info.lastInsertRowid;
  });

  function createVoucher(bookId, data) {
    validate(data);
    return getVoucher(createVoucherTx(bookId, data));
  }

  function updateVoucher(id, data) {
    validate(data);
    const existing = getVoucher(id);
    if (!existing) throw new Error('VOUCHER_NOT_FOUND');
    if (existing.status === 'cancelled') throw new Error('VOUCHER_CANCELLED');
    const row = pick(data);
    const cols = Object.keys(row);
    db.transaction(() => {
      db.prepare(
        `UPDATE vouchers SET ${cols.map((c) => `${c} = @${c}`).join(', ')},
         updated_at = datetime('now','localtime') WHERE id = @id`
      ).run({ ...row, id });
      saveParties(data);
    })();
    return getVoucher(id);
  }

  function cancelVoucher(id, reason) {
    const v = getVoucher(id);
    if (!v) throw new Error('VOUCHER_NOT_FOUND');
    db.prepare(
      "UPDATE vouchers SET status = 'cancelled', cancel_reason = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    ).run(reason || null, id);
    return getVoucher(id);
  }

  function markPrinted(id) {
    db.prepare(
      "UPDATE vouchers SET print_count = print_count + 1, last_printed_at = datetime('now','localtime') WHERE id = ?"
    ).run(id);
    return getVoucher(id);
  }

  function getVoucher(id) {
    return decorate(db.prepare(`${voucherSelect} WHERE v.id = ?`).get(id));
  }

  function listVouchers({ q, bookId, status } = {}) {
    const where = [];
    const params = {};
    if (bookId) {
      where.push('v.book_id = @bookId');
      params.bookId = bookId;
    }
    if (status) {
      where.push('v.status = @status');
      params.status = status;
    }
    if (q && String(q).trim()) {
      where.push(
        '(v.debtor_name LIKE @q OR v.debtor_id_number LIKE @q OR v.guarantor_name LIKE @q OR b.name LIKE @q OR CAST(v.seq AS TEXT) = @exact)'
      );
      params.q = `%${String(q).trim()}%`;
      params.exact = String(q).trim().replace(/^0+/, '');
    }
    const sql = `${voucherSelect} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY v.id DESC LIMIT 500`;
    return db.prepare(sql).all(params).map(decorate);
  }

  function backup(file) {
    return db.backup(file);
  }

  return {
    raw: db,
    getSettings,
    saveSettings,
    listBooks,
    getBook,
    createBook,
    setBookStatus,
    nextNumber,
    searchCustomers,
    createVoucher,
    updateVoucher,
    cancelVoucher,
    markPrinted,
    getVoucher,
    listVouchers,
    backup,
    close: () => db.close(),
  };
}

module.exports = { openDb, seqLabel, DEFAULT_SETTINGS, VOUCHER_FIELDS };
