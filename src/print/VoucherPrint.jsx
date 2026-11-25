import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { digits, hijriText, gregorianText, splitAmount } from '../lib/format.js';
import './print.css';

function paperSize(s) {
  if (s.paper === 'A5') return { w: 148, h: 210 };
  if (s.paper === 'custom') {
    const w = parseFloat(s.paper_width_mm);
    const h = parseFloat(s.paper_height_mm);
    if (w > 0 && h > 0) return { w, h };
  }
  return { w: 210, h: 297 };
}

// One dotted fill-in field. Empty fields stay as dotted lines so they can be filled by hand.
function Fill({ children, grow = 1, min }) {
  return (
    <span className="fill" style={{ flexGrow: grow, minWidth: min ? `${min}mm` : undefined }}>
      {children}
    </span>
  );
}

function Row({ children, className = '' }) {
  return <div className={`row ${className}`}>{children}</div>;
}

export function VoucherSheet({ voucher: v, settings: s }) {
  const { w, h } = paperSize(s);
  const d = (x) => digits(x ?? '', s.print_digits);
  const { riyals, halalas } = splitAmount(v.amount);
  const ox = parseFloat(s.offset_x_mm) || 0;
  const oy = parseFloat(s.offset_y_mm) || 0;
  const scale = parseFloat(s.scale) || 1;
  // Narrow paper (A5) gets a smaller base font.
  const baseFont = w < 180 ? 9 : 12;

  return (
    <div className="sheet" style={{ width: `${w}mm`, height: `${h}mm` }}>
      <style>{`@page { size: ${w}mm ${h}mm; margin: 0; }`}</style>
      <div
        className="voucher"
        style={{
          transform: `translate(${ox}mm, ${oy}mm) scale(${scale})`,
          fontSize: `${baseFont}pt`,
        }}
      >
        <header className="v-header">
          {s.logo ? <img className="v-logo" src={s.logo} alt="" /> : null}
          <div className="v-header-text">
            {s.header_title ? <div className="v-h-title">{s.header_title}</div> : null}
            {s.header_owner ? <div className="v-h-owner">{s.header_owner}</div> : null}
            {s.header_license ? <div className="v-h-line">{d(s.header_license)}</div> : null}
            {s.header_contacts ? <div className="v-h-line">{d(s.header_contacts)}</div> : null}
          </div>
        </header>

        <div className="v-city">
          حرر في مدينة <span className="v-city-name">{v.city || ''}</span>
        </div>

        <div className="v-titlebar">
          <div className="v-amount">
            <div className="v-amount-cell">
              <div className="v-amount-label">ريال</div>
              <div className="v-amount-value">{d(riyals.toLocaleString('en-US'))}</div>
            </div>
            <div className="v-amount-cell small">
              <div className="v-amount-label">هللة</div>
              <div className="v-amount-value">{d(String(halalas).padStart(2, '0'))}</div>
            </div>
          </div>

          <h1 className="v-title">سند لأمر</h1>

          <div className="v-meta">
            <div>
              رقم <b className="v-number">{d(v.number_label)}</b> من {d(v.book_count)}
            </div>
            <div className="v-book">{v.book_name}</div>
            <div>
              في <b>{d(hijriText(v.issue_date))}</b> هـ
            </div>
            <div className="v-greg">الموافق {d(gregorianText(v.issue_date))} م</div>
          </div>
        </div>

        <section className="v-body">
          <Row>
            أقر أنا الموقع اسمي أدناه <Fill>{v.debtor_name}</Fill> الطرف الثاني
          </Row>
          <Row>
            حامل حفيظة رقم <Fill min={28}>{d(v.debtor_id_number)}</Fill> تاريخ{' '}
            <Fill min={22}>{d(v.debtor_id_date)}</Fill> المصدر <Fill min={20}>{v.debtor_id_source}</Fill>
          </Row>
          <Row>
            العنوان <Fill>{v.debtor_address}</Fill>
          </Row>
          <Row>
            بأن أدفع لأمر السيد / <Fill>{v.creditor_name}</Fill> الطرف الأول
          </Row>
          <Row>
            المبلغ المرقوم أعلاه وقدره <span className="words">{v.amount_words}</span>
          </Row>
          <Row>
            في موعد استحقاق هذا السند بتاريخ <Fill grow={0} min={34}>{d(gregorianText(v.due_date))}</Fill> م المبلغ
            المشروح أعلاه أو لوكيله
          </Row>
          <Row>
            وذلك من قيمة <Fill>{v.reason}</Fill> وإن تأخرت عن دفع المبلغ فإن للطرف الأول
          </Row>
          <p className="para">
            الحق في استيفاء حقوقه بالطريقة التي يراها تضمن حقوقه وكفيلي ملزم بسداد المبلغ بموجب تاريخ السند الموضح
            أعلاه وأذنت لمن يشهد والله خير الشاهدين .
          </p>

          <div className="v-sep" />

          <Row>
            أقر أنا <Fill>{v.guarantor_name}</Fill> بأنني أكفل <Fill>{v.guarantor_name ? v.debtor_name : ''}</Fill>
          </Row>
          <Row>
            حامل حفيظة رقم <Fill min={28}>{d(v.guarantor_id_number)}</Fill> تاريخ{' '}
            <Fill min={22}>{d(v.guarantor_id_date)}</Fill> المصدر <Fill min={20}>{v.guarantor_id_source}</Fill>
          </Row>
          <Row>
            العنوان <Fill>{v.guarantor_address}</Fill>
          </Row>
          <Row>في سداد قيمة السند أو السندات اللاحقة كفالة غرم وأداء وعليه أوقع</Row>
        </section>

        <section className="v-signs">
          {[
            ['توقيع المدين', v.debtor_name],
            ['شاهد', v.witness1],
            ['شاهد', v.witness2],
            ['توقيع الكفيل', v.guarantor_name],
          ].map(([label, name], i) => (
            <div className="v-sign" key={i}>
              <div className="v-sign-label">{label}</div>
              <div className="v-sign-name">{name || ''}</div>
              <div className="v-sign-line" />
            </div>
          ))}
        </section>

        {s.footer_text ? <footer className="v-footer">{d(s.footer_text)}</footer> : null}

        {v.status === 'cancelled' ? <div className="v-void">ملغي</div> : null}
      </div>
    </div>
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
    if (!data) return;
    // Wait for fonts and images so the print is never captured half-drawn.
    const imgs = Array.from(document.images).map((img) =>
      img.complete ? Promise.resolve() : new Promise((r) => (img.onload = img.onerror = r))
    );
    Promise.all([document.fonts.ready, ...imgs]).then(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => api.printReady()))
    );
  }, [data]);

  if (error) return <div style={{ padding: 20 }}>{error}</div>;
  if (!data || !data.voucher) return null;
  return <VoucherSheet voucher={data.voucher} settings={data.settings} />;
}
