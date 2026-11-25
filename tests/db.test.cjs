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
  assert.equal(repo.getSettings().paper, 'A5');
  repo.saveSettings({ city: 'المخواة', unknown_key: 'x' });
  const s = repo.getSettings();
  assert.equal(s.city, 'المخواة');
  assert.equal(s.unknown_key, undefined);

  const book = repo.createBook({ name: 'B', count: 5 });
  const v = repo.createVoucher(book.id, voucher());
  assert.equal(repo.markPrinted(v.id).print_count, 1);
});
