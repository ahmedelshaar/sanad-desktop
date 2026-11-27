import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  monthGrid,
  parseTypedDate,
  displayDate,
  shiftMonth,
  addDays,
  isValidIso,
  hijriMonthSpan,
} from '../src/lib/calendar.js';

test('month grid starts on Sunday and has 42 days', () => {
  const g = monthGrid(2026, 10, 0); // November 2026, 1 Nov is a Sunday
  assert.equal(g.length, 42);
  assert.equal(g[0].iso, '2026-11-01');
  assert.equal(g[0].inMonth, true);
  assert.equal(g.filter((c) => c.inMonth).length, 30);
  const feb = monthGrid(2027, 1, 0); // 1 Feb 2027 is a Monday
  assert.equal(feb[0].iso, '2027-01-31');
  assert.equal(feb[0].inMonth, false);
  assert.equal(feb[1].iso, '2027-02-01');
});

test('grid cells carry the Hijri day', () => {
  const g = monthGrid(2026, 1, 0);
  const ramadan1 = g.find((c) => c.iso === '2026-02-18');
  assert.equal(ramadan1.hijriDay, 1);
});

test('week can start on Saturday', () => {
  const g = monthGrid(2026, 10, 6);
  assert.equal(g[0].iso, '2026-10-31');
  assert.equal(g[1].iso, '2026-11-01');
});

test('typed dates', () => {
  assert.equal(parseTypedDate('25/11/2026'), '2026-11-25');
  assert.equal(parseTypedDate('5-1-2027'), '2027-01-05');
  assert.equal(parseTypedDate('5.1.27'), '2027-01-05');
  assert.equal(parseTypedDate('2026-11-25'), '2026-11-25');
  assert.equal(parseTypedDate('٢٥/١١/٢٠٢٦'), '2026-11-25');
  assert.equal(parseTypedDate(' 29/02/2028 '), '2028-02-29');
  assert.equal(parseTypedDate('29/02/2027'), null);
  assert.equal(parseTypedDate('31/04/2026'), null);
  assert.equal(parseTypedDate('hello'), null);
  assert.equal(parseTypedDate(''), null);
});

test('display, shifting and validity', () => {
  assert.equal(displayDate('2026-01-05'), '05/01/2026');
  assert.equal(displayDate(''), '');
  assert.equal(shiftMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(shiftMonth('2026-01-15', -1), '2025-12-15');
  assert.equal(shiftMonth('2026-12-10', 13), '2028-01-10');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-03-01', -1), '2027-02-28');
  assert.equal(isValidIso('2026-13-01'), false);
  assert.equal(isValidIso('2026-02-29'), false);
});

test('Hijri month span for a Gregorian month', () => {
  assert.match(hijriMonthSpan(2026, 1), /شعبان - رمضان 1447/);
});
