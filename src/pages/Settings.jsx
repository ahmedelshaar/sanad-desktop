import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n, errorText } from '../i18n.js';
import { VoucherSheet, paperSize } from '../print/VoucherPrint.jsx';
import { todayIso } from '../lib/format.js';
import { amountToArabicWords } from '../lib/tafqeet.js';
import { TextField } from './VoucherForm.jsx';
import Select from '../components/Select.jsx';
import Switch from '../components/Switch.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, Field, PageHeader, Section, useToast } from '../components/ui.jsx';
import { LicenseSection } from './License.jsx';

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

const PREVIEW_W = 380; // px
const PX_PER_MM = 96 / 25.4;

export default function Settings({ settings, onSaved, license, onLicense }) {
  const { t } = useI18n();
  const toast = useToast();
  const [s, setS] = useState(settings);
  const [printers, setPrinters] = useState([]);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.printers.list().then(setPrinters).catch(() => setPrinters([]));
  }, []);

  const set = (patch) => {
    setS((x) => ({ ...x, ...patch }));
    setDirty(true);
  };

  const run = async (fn) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorText(t, err.message));
    }
  };

  const save = () =>
    run(async () => {
      const saved = await api.settings.save(s);
      onSaved(saved);
      setDirty(false);
      toast.show(t('settings_saved'));
    });

  const pickLogo = () =>
    run(async () => {
      const logo = await api.settings.pickLogo();
      if (logo) set({ logo });
    });

  const restore = () =>
    run(async () => {
      const res = await api.backup.restore();
      if (res) toast.show(t('backup_restored'));
    });

  const backup = () =>
    run(async () => {
      const file = await api.backup.create();
      if (file) toast.show(`${t('backup_done')} ${file}`);
    });

  const text = (key, label, className = '') => (
    <TextField label={label} className={className} value={s[key]} onChange={(v) => set({ [key]: v })} testId={`set-${key}`} />
  );
  const num = (key, label, step = '1') => (
    <TextField
      label={label}
      type="number"
      step={step}
      dir="ltr"
      value={s[key]}
      onChange={(v) => set({ [key]: v })}
      testId={`set-${key}`}
    />
  );
  const area = (key, label) => (
    <label className="field span-all">
      <span className="field-label">{label}</span>
      <textarea className="field-box" rows="2" value={s[key] || ''} onChange={(e) => set({ [key]: e.target.value })} />
    </label>
  );

  const paper = paperSize(s);
  const k = PREVIEW_W / (paper.w * PX_PER_MM);

  return (
    <div className="page settings-page">
      <PageHeader icon="settings" title={t('settings_title')} subtitle={t('sub_settings')}>
        <button className={`btn primary ${dirty ? 'pulse' : ''}`} onClick={save} data-testid="settings-save">
          <Icon name="save" size={16} />
          {t('save')}
        </button>
      </PageHeader>
      {error && <Alert>{error}</Alert>}

      <div className="settings-layout">
        <div>
          <Section icon="image" title={t('sec_header')}>
            <div className="form-grid">
              {text('header_prefix', t('header_prefix'), 'span-2')}
              {text('header_title', t('header_title'), 'span-2')}
              {area('header_activity', t('header_activity'))}
              {text('header_owner', t('header_owner'), 'span-all')}
              {text('header_license', t('header_license'), 'span-all')}
              {text('header_contacts', t('header_contacts'), 'span-all')}
              <div className="span-all logo-row">
                <span className="field-label">{t('logo')}</span>
                {s.logo ? <img src={s.logo} alt="" className="logo-thumb" /> : null}
                <button className="btn small" type="button" onClick={pickLogo}>
                  <Icon name="upload" size={14} />
                  {t('logo_pick')}
                </button>
                {s.logo ? (
                  <button className="btn small ghost" type="button" onClick={() => set({ logo: '' })}>
                    {t('logo_remove')}
                  </button>
                ) : null}
              </div>
              {text('city', t('default_city'), 'span-2')}
              {text('creditor_name', t('default_creditor'), 'span-2')}
              {area('footer_text', t('footer_text'))}
            </div>
          </Section>

          <Section icon="printer" title={t('sec_print')}>
            <div className="form-grid">
              <Field label={t('paper')} className="span-2">
                <Select
                  label={t('paper')}
                  testId="set-paper"
                  value={s.paper}
                  onChange={(v) => set({ paper: v })}
                  options={[
                    { value: 'A5L', label: t('paper_a5l') },
                    { value: 'A5', label: t('paper_a5') },
                    { value: 'A4', label: 'A4' },
                    { value: 'letter', label: t('paper_letter') },
                    { value: 'custom', label: t('paper_custom') },
                  ]}
                />
              </Field>
              <Field label={t('printer')} className="span-2">
                <Select
                  label={t('printer')}
                  testId="set-printer"
                  value={s.printer_name}
                  onChange={(v) => set({ printer_name: v })}
                  options={[
                    { value: '', label: t('printer_default') },
                    ...printers.map((p) => ({ value: p.name, label: p.displayName, hint: p.isDefault ? '✓' : '' })),
                  ]}
                />
              </Field>
              {s.paper === 'custom' && (
                <>
                  {num('paper_width_mm', t('width_mm'))}
                  {num('paper_height_mm', t('height_mm'))}
                </>
              )}
              {num('offset_x_mm', t('offset_x'), '0.5')}
              {num('offset_y_mm', t('offset_y'), '0.5')}
              {num('scale', t('scale'), '0.01')}
              <Field label={t('print_digits')}>
                <Select
                  label={t('print_digits')}
                  testId="set-digits"
                  value={s.print_digits}
                  onChange={(v) => set({ print_digits: v })}
                  options={[
                    { value: 'arabic', label: t('digits_arabic') },
                    { value: 'latin', label: t('digits_latin') },
                  ]}
                />
              </Field>
              <div className="span-all">
                <Switch
                  label={t('silent_print')}
                  checked={s.silent_print === '1'}
                  onChange={(v) => set({ silent_print: v ? '1' : '0' })}
                  testId="set-silent"
                />
              </div>
            </div>
          </Section>

          <LicenseSection license={license} onState={onLicense} />

          <Section icon="database" title={t('sec_backup')}>
            <div className="actions">
              <button className="btn" onClick={backup}>
                <Icon name="download" size={16} />
                {t('backup_now')}
              </button>
              <button className="btn" onClick={restore}>
                <Icon name="upload" size={16} />
                {t('backup_restore')}
              </button>
            </div>
            <p className="muted small">{t('backup_restore_hint')}</p>
          </Section>
        </div>

        <aside className="preview-side">
          <div className="preview-label">
            <Icon name="eye" size={14} />
            {t('preview')}
          </div>
          <div className="preview-wrap" style={{ width: PREVIEW_W, height: paper.h * PX_PER_MM * k }}>
            <div className="preview-scale" style={{ transform: `scale(${k})` }}>
              <VoucherSheet voucher={{ ...SAMPLE, city: s.city, creditor_name: s.creditor_name }} settings={s} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
