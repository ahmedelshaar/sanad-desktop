import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, buildSchedule } from '../src/lib/schedule.js';

test('addMonths clamps to month end', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
  assert.equal(addMonths('2026-12-01', 12), '2027-12-01');
});

test('2 years, every 3 months, 60000', () => {
  const s = buildSchedule({ years: 2, months: 0, period: 3, total: 60000, firstDue: '2026-12-01' });
  assert.equal(s.totalMonths, 24);
  assert.equal(s.count, 8);
  assert.equal(s.exact, true);
  assert.ok(s.items.every((i) => i.amount === 7500));
  assert.equal(s.items[1].due_date, '2027-03-01');
  assert.equal(s.items[7].due_date, '2028-09-01');
});

test('uneven total: last installment takes the difference, sum is exact', () => {
  const s = buildSchedule({ years: 1, months: 0, period: 1, total: 25500.5, firstDue: '2026-12-25' });
  assert.equal(s.count, 12);
  assert.equal(s.installment, 2125);
  assert.equal(s.items[11].amount, 25500.5 - 2125 * 11);
  const sum = s.items.reduce((a, i) => a + Math.round(i.amount * 100), 0);
  assert.equal(sum, 2550050);
});

test('months not divisible by period rounds count up', () => {
  const s = buildSchedule({ years: 1, months: 2, period: 4, total: 1000, firstDue: '2026-12-01' });
  assert.equal(s.totalMonths, 14);
  assert.equal(s.count, 4);
  assert.equal(s.exact, false);
});

test('decimal installments when rounding is off', () => {
  const s = buildSchedule({ years: 0, months: 3, period: 1, total: 100, firstDue: '2026-12-01', roundWhole: false });
  assert.deepEqual(s.items.map((i) => i.amount), [33.33, 33.33, 33.34]);
});

test('empty input gives no items', () => {
  assert.equal(buildSchedule({ years: 0, months: 0, period: 1, total: 100, firstDue: '2026-12-01' }).items.length, 0);
  assert.equal(buildSchedule({ years: 1, period: 1, total: 0, firstDue: '2026-12-01' }).items.length, 0);
});
