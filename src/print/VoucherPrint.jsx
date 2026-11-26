import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { digits, hijriParts, gregorianParts, splitAmount } from '../lib/format.js';
import { PaperForm, FORM_W, FORM_H } from './FormLayout.jsx';

import './print.css';

export function paperSize(s) {
  if (s.paper === 'A5') return { w: 148, h: 210 };
  if (s.paper === 'A5L') return { w: 210, h: 148 };
  if (s.paper === 'letter') return { w: FORM_W, h: FORM_H };
  if (s.paper === 'custom') {
    const w = parseFloat(s.paper_width_mm);
    const h = parseFloat(s.paper_height_mm);
    if (w > 0 && h > 0) return { w, h };
  }
  return { w: 210, h: 297 };
}

const pad2 = (n) => String(n).padStart(2, '0');

// Turns a stored voucher into the display strings the paper form needs.
function formValues(v, s) {
  const d = (x) => digits(x ?? '', s.print_digits);
  const { riyals, halalas } = splitAmount(v.amount);
  const ih = hijriParts(v.issue_date);
  const dg = gregorianParts(v.due_date);
  return {
    city: v.city || '',
    riyals: v.amount ? d(riyals.toLocaleString('en-US')) : '',
    halalas: v.amount ? d(pad2(halalas)) : '',
    number: v.number_label ? `${d(v.number_label)} من ${d(v.book_count)}` : '',
    issueH: ih ? { day: d(pad2(ih.day)), month: d(pad2(ih.month)), yy: d(String(ih.year).slice(2)) } : {},
    dueG: dg ? { day: d(pad2(dg.day)), month: d(pad2(dg.month)), yy: d(String(dg.year).slice(2)) } : {},
    amount_words: v.amount_words || '',
    reason: v.reason || '',
    debtor_name: v.debtor_name || '',
    debtor_id_number: d(v.debtor_id_number),
    debtor_id_date: d(v.debtor_id_date),
    debtor_id_source: v.debtor_id_source || '',
    debtor_address: v.debtor_address || '',
    creditor_name: v.creditor_name || '',
    guarantor_name: v.guarantor_name || '',
    guaranteed_name: v.guarantor_name ? v.debtor_name || '' : '',
    guarantor_id_number: d(v.guarantor_id_number),
    guarantor_id_date: d(v.guarantor_id_date),
    guarantor_id_source: v.guarantor_id_source || '',
    guarantor_address: v.guarantor_address || '',
    cancelled: v.status === 'cancelled',
  };
}

// One printed page: the Letter-size form centred on the chosen paper, plus the user's offset/scale.
export function VoucherSheet({ voucher, settings: s }) {
  const { w, h } = paperSize(s);
  const ox = parseFloat(s.offset_x_mm) || 0;
  const oy = parseFloat(s.offset_y_mm) || 0;
  // Printed area of the form (stamp + body) in form mm: x 47.9..178.3, y 23.6..250.5.
  // On Letter paper the form keeps its original position; on other paper the printed area is
  // centred, and shrunk only if the paper is too small for it (e.g. A5).
  let transform;
  if (s.paper === 'A5L') {
    // Landscape: turn the whole form 90deg so the note reads normally (stamp on the left side,
    // as on the paper). Printed area in that view: u 23.6..230, v 37.4..168.3 mm.
    const k = Math.min(1, (w - 4) / 206.4, (h - 4) / 130.9) * (parseFloat(s.scale) || 1);
    const cx = w / 2 - 126.8 * k + ox;
    const cy = h / 2 - 102.85 * k + oy;
    transform = `translate(${cx}mm, ${cy}mm) scale(${k}) translate(0, ${FORM_W}mm) rotate(-90deg)`;
  } else {
    const fitK = Math.min(1, (w - 8) / 130.4, (h - 8) / 226.9);
    const k = fitK * (parseFloat(s.scale) || 1);
    const dx = s.paper === 'letter' ? ox : w / 2 - 113.1 * k + ox;
    const dy = s.paper === 'letter' ? oy : h / 2 - 137.05 * k + oy;
    transform = `translate(${dx}mm, ${dy}mm) scale(${k})`;
  }
  return (
    <div className="sheet" style={{ width: `${w}mm`, height: `${h}mm` }}>
      <style>{`@page { size: ${w}mm ${h}mm; margin: 0; }`}</style>
      <div className="sheet-form" style={{ transform }}>
        <PaperForm s={s} v={formValues(voucher, s)} />
      </div>
    </div>
  );
}

function waitThenSignalReady() {
  // Wait for fonts and images so the print is never captured half-drawn.
  const imgs = Array.from(document.images).map((img) =>
    img.complete ? Promise.resolve() : new Promise((r) => (img.onload = img.onerror = r))
  );
  Promise.all([document.fonts.ready, ...imgs]).then(() =>
    setTimeout(() => requestAnimationFrame(() => api.printReady()), 50)
  );
}

// Every active note of a book, one page each, for one PDF or one print job.
export function BookPrint({ bookId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.body.classList.add('print-mode');
    Promise.all([api.vouchers.list({ bookId: Number(bookId), status: 'active' }), api.settings.get()])
      .then(([list, settings]) => setData({ list: [...list].reverse(), settings }))
      .catch((e) => setError(e.message));
    return () => document.body.classList.remove('print-mode');
  }, [bookId]);

  useEffect(() => {
    if (data) waitThenSignalReady();
  }, [data]);

  if (error) return <div style={{ padding: 20 }}>{error}</div>;
  if (!data) return null;
  return (
    <>
      {data.list.map((v) => (
        <VoucherSheet key={v.id} voucher={v} settings={data.settings} />
      ))}
    </>
  );
}

export default function VoucherPrint({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.body.classList.add('print-mode');
    Promise.all([api.vouchers.get(Number(id)), api.settings.get()])
      .then(([voucher, settings]) => setData({ voucher, settings }))
      .catch((e) => setError(e.message));
    return () => document.body.classList.remove('print-mode');
  }, [id]);

  useEffect(() => {
    if (data) waitThenSignalReady();
  }, [data]);

  if (error) return <div style={{ padding: 20 }}>{error}</div>;
  if (!data || !data.voucher) return null;
  return <VoucherSheet voucher={data.voucher} settings={data.settings} />;
}
