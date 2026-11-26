const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDb, seqLabel } = require('../electron/db.cjs');

const voucher = (extra = {}) => ({ debtor_name: 'محمد', amount: 1000, ...extra });

test('seq label padding', () => {
  assert.equal(seqLabel(1, 60), '01');
  assert.equal(seqLabel(7, 100), '007');
  assert.equal(seqLabel(42, 9), '42');
});

test('books number vouchers 01..N and close when full', () => {
  const repo = openDb(':memory:');
  const book = repo.createBook({ name: 'دفتر 1', count: 3 });
  assert.equal(repo.nextNumber(book.id).label, '01');

  const a = repo.createVoucher(book.id, voucher());
  const b = repo.createVoucher(book.id, voucher());
  assert.equal(a.number_label, '01');
  assert.equal(b.number_label, '02');
  assert.equal(repo.nextNumber(book.id).label, '03');

  const c = repo.createVoucher(book.id, voucher());
  assert.equal(c.seq, 3);
  assert.equal(repo.getBook(book.id).status, 'closed');
  assert.throws(() => repo.createVoucher(book.id, voucher()), /BOOK_CLOSED/);
  assert.throws(() => repo.setBookStatus(book.id, 'open'), /BOOK_FULL/);
});

test('cancelled numbers are never reused', () => {
  const repo = openDb(':memory:');
  const book = repo.createBook({ name: 'B', count: 60 });
  const a = repo.createVoucher(book.id, voucher());
  repo.cancelVoucher(a.id, 'خطأ');
  const b = repo.createVoucher(book.id, voucher());
  assert.equal(b.number_label, '02');
  assert.equal(repo.getBook(book.id).cancelled, 1);
  assert.throws(() => repo.updateVoucher(a.id, voucher()), /VOUCHER_CANCELLED/);
});

test('validation and customers', () => {
  const repo = openDb(':memory:');
  const book = repo.createBook({ name: 'B', count: 10 });
  assert.throws(() => repo.createVoucher(book.id, { amount: 10 }), /DEBTOR_REQUIRED/);
  assert.throws(() => repo.createVoucher(book.id, { debtor_name: 'x', amount: 0 }), /AMOUNT_REQUIRED/);
  assert.equal(repo.nextNumber(book.id).label, '01', 'failed saves must not burn a number');

  repo.createVoucher(book.id, voucher({ debtor_id_number: '1012345678', debtor_address: 'الرياض' }));
  repo.createVoucher(book.id, voucher({ debtor_id_number: '1012345678', debtor_address: 'جدة' }));
  const found = repo.searchCustomers('1012');
  assert.equal(found.length, 1);
  assert.equal(found[0].address, 'جدة');

  assert.equal(repo.listVouchers({ q: '02' }).length, 1);
  assert.equal(repo.listVouchers({ q: 'محمد' }).length, 2);
});

test('settings and print counter', () => {
  const repo = openDb(':memory:');
  assert.equal(repo.getSettings().paper, 'A5L');
  repo.saveSettings({ city: 'المخواة', unknown_key: 'x' });
  const s = repo.getSettings();
  assert.equal(s.city, 'المخواة');
  assert.equal(s.unknown_key, undefined);

  const book = repo.createBook({ name: 'B', count: 5 });
  const v = repo.createVoucher(book.id, voucher());
  assert.equal(repo.markPrinted(v.id).print_count, 1);
});

test('backup can be inspected and restored', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { inspectBackup } = require('../electron/db.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sanad-'));
  const live = path.join(dir, 'sanad.db');
  const bak = path.join(dir, 'backup.db');

  let repo = openDb(live);
  const book = repo.createBook({ name: 'B', count: 60 });
  repo.createVoucher(book.id, voucher());
  repo.backup(bak);
  repo.createVoucher(book.id, voucher()); // newer data, not in the backup

  assert.deepEqual(inspectBackup(bak), { books: 1, vouchers: 1 });
  const junk = path.join(dir, 'junk.db');
  fs.writeFileSync(junk, 'not a database');
  assert.throws(() => inspectBackup(junk), /BACKUP_INVALID/);

  // same steps as the restore handler in main.cjs
  repo.close();
  for (const ext of ['-wal', '-shm']) fs.rmSync(live + ext, { force: true });
  fs.copyFileSync(bak, live);
  repo = openDb(live);
  assert.equal(repo.listVouchers().length, 1);
  assert.equal(repo.nextNumber(book.id).label, '02');
  repo.close();
});

test('installment book creates all notes in one go', () => {
  const repo = openDb(':memory:');
  const items = [1, 2, 3].map((n) => ({ due_date: `2027-0${n}-01`, amount: n === 3 ? 3334 : 3333, amount_words: 'x' }));
  const book = repo.createInstallmentBook({
    name: 'أقساط محمد',
    plan: { years: 0, months: 3, period: 1, total: 10000, first_due: '2027-01-01' },
    common: { debtor_name: 'محمد', debtor_id_number: '1012345678', guarantor_name: 'سعيد', issue_date: '2026-12-01' },
    items,
  });
  assert.equal(book.kind, 'installments');
  assert.equal(book.count, 3);
  assert.equal(book.used, 3);
  assert.equal(book.status, 'closed');
  const list = repo.listVouchers({ bookId: book.id }).reverse();
  assert.deepEqual(list.map((v) => v.number_label), ['01', '02', '03']);
  assert.equal(list[2].amount, 3334);
  assert.equal(list[0].guarantor_name, 'سعيد');
  assert.equal(list[1].due_date, '2027-02-01');
  assert.equal(repo.searchCustomers('1012').length, 1);

  // sum must match the total, otherwise nothing is saved
  assert.throws(
    () => repo.createInstallmentBook({ name: 'x', plan: { total: 999 }, common: { debtor_name: 'a' }, items }),
    /PLAN_INVALID/
  );
  assert.equal(repo.listBooks().length, 1);
});
