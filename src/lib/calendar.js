// Pure helpers behind the DateInput component (no React, unit tested).
import { hijriParts } from './format.js';

const p2 = (n) => String(n).padStart(2, '0');

export function isoOf(y, m0, d) {
  return `${y}-${p2(m0 + 1)}-${p2(d)}`;
}

export function partsOf(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m0: m - 1, d };
}

export function isValidIso(iso) {
  const p = partsOf(iso);
  if (!p || p.y < 1900 || p.y > 2200 || p.m0 < 0 || p.m0 > 11 || p.d < 1) return false;
  return p.d <= daysInMonth(p.y, p.m0);
}

export function daysInMonth(y, m0) {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

export function addDays(iso, n) {
  const p = partsOf(iso);
  const t = new Date(Date.UTC(p.y, p.m0, p.d + n));
  return isoOf(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

// Same day in another month, clamped to that month's last day.
export function shiftMonth(iso, n) {
  const p = partsOf(iso);
  const total = p.y * 12 + p.m0 + n;
  const y = Math.floor(total / 12);
  const m0 = ((total % 12) + 12) % 12;
  return isoOf(y, m0, Math.min(p.d, daysInMonth(y, m0)));
}

/**
 * 6 x 7 grid for a month. weekStart: 0 = Sunday (Saudi week), 6 = Saturday, 1 = Monday.
 * Each cell: { iso, day, inMonth, hijriDay }.
 */
export function monthGrid(y, m0, weekStart = 0) {
  const firstDow = new Date(Date.UTC(y, m0, 1)).getUTCDay();
  const lead = (firstDow - weekStart + 7) % 7;
  const start = addDays(isoOf(y, m0, 1), -lead);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const iso = addDays(start, i);
    const p = partsOf(iso);
    const h = hijriParts(iso);
    cells.push({ iso, day: p.d, inMonth: p.m0 === m0 && p.y === y, hijriDay: h ? h.day : null });
  }
  return cells;
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function latinDigits(s) {
  return String(s || '').replace(/[٠-٩۰-۹]/g, (c) => {
    const i = AR_DIGITS.indexOf(c);
    return String(i >= 0 ? i : FA_DIGITS.indexOf(c));
  });
}

/**
 * Parses what the user typed. Accepts dd/mm/yyyy, d-m-yyyy, dd.mm.yyyy, yyyy-mm-dd and
 * Arabic digits. Two-digit years mean 20xx. Returns ISO or null.
 */
export function parseTypedDate(text) {
  const s = latinDigits(text).trim();
  if (!s) return null;
  let y;
  let m;
  let d;
  let match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    [, y, m, d] = match;
  } else {
    match = s.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{2}|\d{4})$/);
    if (!match) return null;
    [, d, m, y] = match;
    if (y.length === 2) y = `20${y}`;
  }
  const iso = isoOf(Number(y), Number(m) - 1, Number(d));
  return isValidIso(iso) ? iso : null;
}

export function displayDate(iso) {
  const p = partsOf(iso);
  return p ? `${p2(p.d)}/${p2(p.m0 + 1)}/${p.y}` : '';
}

export const MONTHS = {
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

export const WEEKDAYS = {
  // index = JS getDay() (0 = Sunday)
  ar: ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

export const HIJRI_MONTHS = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

// Hijri month range shown under a Gregorian month title, e.g. "جمادى الأولى - جمادى الآخرة 1448".
export function hijriMonthSpan(y, m0) {
  const a = hijriParts(isoOf(y, m0, 1));
  const b = hijriParts(isoOf(y, m0, daysInMonth(y, m0)));
  if (!a || !b) return '';
  const na = HIJRI_MONTHS[a.month - 1];
  const nb = HIJRI_MONTHS[b.month - 1];
  if (a.month === b.month) return `${na} ${a.year}`;
  return a.year === b.year ? `${na} - ${nb} ${b.year}` : `${na} ${a.year} - ${nb} ${b.year}`;
}
