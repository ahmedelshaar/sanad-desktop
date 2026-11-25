import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberToArabicWords, amountToArabicWords } from '../src/lib/tafqeet.js';
import { hijriText, gregorianText, toArabicDigits, splitAmount } from '../src/lib/format.js';

test('numbers to Arabic words', () => {
  const cases = {
    1: 'واحد',
    10: 'عشرة',
    11: 'أحد عشر',
    12: 'اثنا عشر',
    21: 'واحد وعشرون',
    100: 'مائة',
    200: 'مائتان',
    305: 'ثلاثمائة وخمسة',
    1000: 'ألف',
    2000: 'ألفان',
    3000: 'ثلاثة آلاف',
    10000: 'عشرة آلاف',
    11000: 'أحد عشر ألف',
    25000: 'خمسة وعشرون ألف',
    25500: 'خمسة وعشرون ألف وخمسمائة',
    100000: 'مائة ألف',
    150000: 'مائة وخمسون ألف',
    103000: 'مائة وثلاثة آلاف',
    1000000: 'مليون',
    2500000: 'مليونان وخمسمائة ألف',
  };
  for (const [n, words] of Object.entries(cases)) {
    assert.equal(numberToArabicWords(Number(n)), words, `n=${n}`);
  }
});

test('amount with halalas', () => {
  assert.equal(amountToArabicWords(25000), 'خمسة وعشرون ألف ريال سعودي فقط لا غير');
  assert.equal(amountToArabicWords(150.5), 'مائة وخمسون ريال سعودي وخمسون هللة فقط لا غير');
  assert.equal(amountToArabicWords(0), '');
});

test('no tashkeel in output', () => {
  const s = amountToArabicWords(987654321.99);
  assert.ok(!/[ً-ْ]/.test(s), s);
});

test('dates', () => {
  assert.equal(gregorianText('2026-11-25'), '25 / 11 / 2026');
  // 1 Ramadan 1447 = 18 Feb 2026 (Umm al-Qura)
  assert.equal(hijriText('2026-02-18'), '01 / 09 / 1447');
  assert.equal(hijriText(''), '');
});

test('digits and amount split', () => {
  assert.equal(toArabicDigits('2026/11'), '٢٠٢٦/١١');
  assert.deepEqual(splitAmount(1234.56), { riyals: 1234, halalas: 56 });
  assert.deepEqual(splitAmount(0.1 + 0.2), { riyals: 0, halalas: 30 });
});
