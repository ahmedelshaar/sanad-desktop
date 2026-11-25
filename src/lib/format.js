// Date and digit helpers. Dates are stored as ISO "YYYY-MM-DD" (Gregorian).

function parseIso(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  // Noon UTC avoids any timezone shifting the day.
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Hijri (Umm al-Qura) parts for a Gregorian ISO date.
export function hijriParts(iso) {
  const date = parseIso(iso);
  if (!date) return null;
  const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return { day: Number(parts.day), month: Number(parts.month), year: Number(parseInt(parts.year, 10)) };
}

export function gregorianParts(iso) {
  const date = parseIso(iso);
  if (!date) return null;
  return { day: date.getUTCDate(), month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
}

const pad2 = (n) => String(n).padStart(2, '0');

// "dd / mm / yyyy"
export function formatParts(parts) {
  if (!parts) return '';
  return `${pad2(parts.day)} / ${pad2(parts.month)} / ${parts.year}`;
}

export function hijriText(iso) {
  return formatParts(hijriParts(iso));
}

export function gregorianText(iso) {
  return formatParts(gregorianParts(iso));
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicDigits(value) {
  return String(value ?? '').replace(/[0-9]/g, (d) => ARABIC_DIGITS[d]);
}

export function digits(value, mode) {
  return mode === 'arabic' ? toArabicDigits(value) : String(value ?? '');
}

export function splitAmount(amount) {
  const cents = Math.round((Number(amount) || 0) * 100);
  return { riyals: Math.floor(cents / 100), halalas: cents % 100 };
}

export function formatMoney(amount) {
  return (Number(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
