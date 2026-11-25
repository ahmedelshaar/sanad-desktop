import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n, errorText } from '../i18n.js';
import { VoucherSheet } from '../print/VoucherPrint.jsx';
import { todayIso } from '../lib/format.js';
import { amountToArabicWords } from '../lib/tafqeet.js';

const SAMPLE = {
  number_label: '01',
  book_name: 'دفتر 1',
  book_count: 60,
  status: 'active',
  issue_date: todayIso(),
  due_date: todayIso(),
  amount: 25000,
  amount_words: amountToArabicWords(25000),
  reason: 'سيارة',
  debtor_name: 'اسم المدين',
  debtor_id_number: '1000000000',
  debtor_id_date: '1445/01/01',
  debtor_id_source: 'الرياض',
  debtor_address: 'العنوان',
  guarantor_name: 'اسم الكفيل',
  guarantor_id_number: '1000000001',
  guarantor_id_date: '1445/01/01',
  guarantor_id_source: 'الرياض',
  guarantor_address: 'العنوان',
  witness1: 'الشاهد الأول',
  witness2: 'الشاهد الثاني',
};

export default function Settings({ settings, onSaved }) {
  const { t } = useI18n();
  const [s, setS] = useState(settings);
  const [printers, setPrinters] = useState([]);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.printers.list().then(setPrinters).catch(() => setPrinters([]));
  }, []);

  const set = (patch) => setS((x) => ({ ...x, ...patch }));

  const save = async () => {
    setMsg(null);
    try {
      const saved = await api.settings.save(s);
      onSaved(saved);
      setMsg({ type: 'success', text: t('settings_saved') });
    } catch (err) {
      setMsg({ type: 'error', text: errorText(t, err.message) });
    }
  };

  const pickLogo = async () => {
    const logo = await api.settings.pickLogo();
    if (logo) set({ logo });
  };

  const backup = async () => {
    try {
      const file = await api.backup.create();
      if (file) setMsg({ type: 'success', text: `${t('backup_done')} ${file}` });
    } catch (err) {
      setMsg({ type: 'error', text: errorText(t, err.message) });
    }
  };

  const text = (key, label, className = '') => (
    <label className={className}>
      {label}
      <input value={s[key] || ''} onChange={(e) => set({ [key]: e.target.value })} />
    </label>
  );
  const num = (key, label, step = '1') => (
    <label>
      {label}
      <input type="number" step={step} dir="ltr" value={s[key]} onChange={(e) => set({ [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="page settings-page">
      <div className="page-head">
        <h1>{t('settings_title')}</h1>
        <button className="btn primary" onClick={save}>
          {t('save')}
        </button>
      </div>
      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

      <div className="settings-layout">
        <div>
          <div className="card form-grid">
            <h2 className="span-all">{t('sec_header')}</h2>
            {text('header_title', t('header_title'), 'span-all')}
            {text('header_owner', t('header_owner'), 'span-all')}
            {text('header_license', t('header_license'), 'span-all')}
            {text('header_contacts', t('header_contacts'), 'span-all')}
            <div className="span-all logo-row">
              <span>{t('logo')}</span>
              {s.logo ? <img src={s.logo} alt="" className="logo-thumb" /> : null}
              <button className="btn small" type="button" onClick={pickLogo}>
                {t('logo_pick')}
              </button>
              {s.logo ? (
                <button className="btn small" type="button" onClick={() => set({ logo: '' })}>
                  {t('logo_remove')}
                </button>
              ) : null}
            </div>
            {text('city', t('default_city'), 'span-2')}
            {text('creditor_name', t('default_creditor'), 'span-2')}
            <label className="span-all">
              {t('footer_text')}
              <textarea rows="3" value={s.footer_text || ''} onChange={(e) => set({ footer_text: e.target.value })} />
            </label>
          </div>

          <div className="card form-grid">
            <h2 className="span-all">{t('sec_print')}</h2>
            <label>
              {t('paper')}
              <select value={s.paper} onChange={(e) => set({ paper: e.target.value })}>
                <option value="A4">A4</option>
                <option value="A5">A5</option>
                <option value="custom">{t('paper_custom')}</option>
              </select>
            </label>
            {s.paper === 'custom' && (
              <>
                {num('paper_width_mm', t('width_mm'))}
                {num('paper_height_mm', t('height_mm'))}
              </>
            )}
            <label className={s.paper === 'custom' ? '' : 'span-3'}>
              {t('printer')}
              <select value={s.printer_name} onChange={(e) => set({ printer_name: e.target.value })}>
                <option value="">{t('printer_default')}</option>
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
            {num('offset_x_mm', t('offset_x'), '0.5')}
            {num('offset_y_mm', t('offset_y'), '0.5')}
            {num('scale', t('scale'), '0.01')}
            <label>
              {t('print_digits')}
              <select value={s.print_digits} onChange={(e) => set({ print_digits: e.target.value })}>
                <option value="arabic">{t('digits_arabic')}</option>
                <option value="latin">{t('digits_latin')}</option>
              </select>
            </label>
            <label className="span-all check">
              <input
                type="checkbox"
                checked={s.silent_print === '1'}
                onChange={(e) => set({ silent_print: e.target.checked ? '1' : '0' })}
              />
              {t('silent_print')}
            </label>
          </div>

          <div className="card">
            <h2>{t('sec_backup')}</h2>
            <button className="btn" onClick={backup}>
              {t('backup_now')}
            </button>
          </div>
        </div>

        <div className="preview-wrap">
          <div className="preview-scale">
            <VoucherSheet voucher={{ ...SAMPLE, city: s.city, creditor_name: s.creditor_name }} settings={s} />
          </div>
        </div>
      </div>
    </div>
  );
}
