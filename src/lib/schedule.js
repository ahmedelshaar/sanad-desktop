// Installment schedule: how many notes, their due dates and amounts.

// Adds months to an ISO date, clamping to the month's last day (31 Jan + 1 month = 28/29 Feb).
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12; // 0-based
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  const p = (x) => String(x).padStart(2, '0');
  return `${ny}-${p(nm + 1)}-${p(day)}`;
}

/**
 * @param {object} o
 * @param {number} o.years
 * @param {number} o.months      extra months on top of the years (0-11)
 * @param {number} o.period      months between installments (1-12)
 * @param {number} o.total       total amount
 * @param {string} o.firstDue    ISO date of the first installment
 * @param {boolean} o.roundWhole round each installment to whole riyals (the last one takes the difference)
 */
export function buildSchedule({ years = 0, months = 0, period = 1, total = 0, firstDue, roundWhole = true }) {
  const totalMonths = (Number(years) || 0) * 12 + (Number(months) || 0);
  const per = Math.min(12, Math.max(1, Number(period) || 1));
  const count = totalMonths > 0 ? Math.ceil(totalMonths / per) : 0;
  const totalCents = Math.round((Number(total) || 0) * 100);
  const exact = count > 0 && totalMonths % per === 0;

  if (!count || totalCents <= 0 || !firstDue) {
    return { totalMonths, period: per, count, exact, items: [], installment: 0 };
  }

  const unit = roundWhole ? 100 : 1;
  const base = Math.floor(totalCents / count / unit) * unit;
  const items = [];
  for (let i = 0; i < count; i++) {
    const cents = i === count - 1 ? totalCents - base * (count - 1) : base;
    items.push({ seq: i + 1, due_date: addMonths(firstDue, i * per), amount: cents / 100 });
  }
  return { totalMonths, period: per, count, exact, items, installment: base / 100 };
}
