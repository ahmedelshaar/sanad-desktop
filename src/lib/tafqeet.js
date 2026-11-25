// Arabic number-to-words (تفقيط) for Saudi Riyal amounts. No tashkeel.

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const TEENS = [
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = [
  '',
  'مائة',
  'مائتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
];

// Scales: [singular, dual, plural (3-10)]. 11+ uses the singular, as on Saudi documents
// ("خمسة وعشرون ألف ريال").
const SCALES = [
  null,
  ['ألف', 'ألفان', 'آلاف'],
  ['مليون', 'مليونان', 'ملايين'],
  ['مليار', 'ملياران', 'مليارات'],
];

function below100(n) {
  if (n === 0) return '';
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${ONES[o]} و${TENS[t]}` : TENS[t];
}

function below1000(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts = [];
  if (h) parts.push(HUNDREDS[h]);
  if (r) parts.push(below100(r));
  return parts.join(' و');
}

function scaled(count, scale) {
  const [one, two, plural] = SCALES[scale];
  if (count === 1) return one;
  if (count === 2) return two;
  const r = count % 100;
  const words = below1000(count);
  if (r >= 3 && r <= 10) return `${words} ${plural}`;
  return `${words} ${one}`;
}

export function numberToArabicWords(num) {
  let n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'صفر';
  const groups = [];
  let scale = 0;
  while (n > 0 && scale < SCALES.length) {
    const g = n % 1000;
    if (g) groups.unshift(scale === 0 ? below1000(g) : scaled(g, scale));
    n = Math.floor(n / 1000);
    scale++;
  }
  return groups.join(' و');
}

export function amountToArabicWords(amount, { currency = 'ريال سعودي', fraction = 'هللة' } = {}) {
  const value = Math.round((Number(amount) || 0) * 100);
  if (value <= 0) return '';
  const riyals = Math.floor(value / 100);
  const halalas = value % 100;
  const parts = [];
  if (riyals) parts.push(`${numberToArabicWords(riyals)} ${currency}`);
  if (halalas) parts.push(`${numberToArabicWords(halalas)} ${fraction}`);
  return `${parts.join(' و')} فقط لا غير`;
}
