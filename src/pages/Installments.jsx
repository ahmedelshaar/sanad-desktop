import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { useI18n, errorText } from '../i18n.js';
import { HijriHint, PartyFields, TextField } from './VoucherForm.jsx';
import { buildSchedule, addMonths } from '../lib/schedule.js';
import { amountToArabicWords } from '../lib/tafqeet.js';
import { formatMoney, gregorianText, hijriText, todayIso } from '../lib/format.js';
import Select from '../components/Select.jsx';
import DateInput from '../components/DateInput.jsx';
import Switch from '../components/Switch.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, Field, Ltr, PageHeader, Section, useToast } from '../components/ui.jsx';

const PERIODS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function Installments({ settings, onOpenBook }) {
  const { t } = useI18n();
  const toast = useToast();
  const today = todayIso();
  const [plan, setPlan] = useState({
    name: '',
    years: 1,
    months: 0,
    period: 1,
    total: '',
    issue_date: today,
    first_due: addMonths(today, 1),
    round_whole: true,
  });
  const [data, setData] = useState({
    city: settings.city || '',
    creditor_name: settings.creditor_name || '',
    reason: '',
    debtor_name: '',
    debtor_id_number: '',
    debtor_id_date: '',
    debtor_id_source: '',
    debtor_address: '',
    debtor_phone: '',
    guarantor_name: '',
    guarantor_id_number: '',
    guarantor_id_date: '',
    guarantor_id_source: '',
    guarantor_address: '',
    guarantor_phone: '',
    witness1: '',
    witness2: '',
  });
  const [created, setCreated] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const setP = (patch) => setPlan((p) => ({ ...p, ...patch }));
  const set = (patch) => setData((d) => ({ ...d, ...patch }));

  const schedule = useMemo(
    () =>
      buildSchedule({
        years: plan.years,
        months: plan.months,
        period: plan.period,
        total: plan.total,
        firstDue: plan.first_due,
        roundWhole: plan.round_whole,
      }),
    [plan]
  );

  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      const book = await api.books.createInstallments({
        name: plan.name,
        plan: {
          years: Number(plan.years) || 0,
          months: Number(plan.months) || 0,
          period: schedule.period,
          total: Number(plan.total),
          first_due: plan.first_due,
        },
        common: { ...data, issue_date: plan.issue_date },
        items: schedule.items.map((i) => ({
          due_date: i.due_date,
          amount: i.amount,
          amount_words: amountToArabicWords(i.amount),
        })),
      });
      setCreated(book);
      toast.show(`${t('inst_created')} — ${book.name} (${book.count})`);
    } catch (err) {
      setError(errorText(t, err.message));
    } finally {
      setBusy(false);
    }
  };

  const print = async (mode) => {
    setError(null);
    try {
      await api.books.print(created.id, mode);
    } catch (err) {
      setError(errorText(t, err.message));
    }
  };

  if (created) {
    return (
      <div className="page">
        <PageHeader icon="layers" title={t('inst_title')} />
        <Section className="done-card">
          <div className="done">
            <span className="done-icon">
              <Icon name="check" size={28} />
            </span>
            <div>
              <h2 data-testid="inst-done-title">
                {created.name} — {created.count} {t('inst_notes')}
              </h2>
              <p className="muted">{t('inst_print_hint')}</p>
            </div>
          </div>
          {error && <Alert>{error}</Alert>}
          <div className="actions wrap">
            <button className="btn primary" onClick={() => print('print')} data-testid="inst-print-all">
              <Icon name="print" size={16} />
              {t('inst_print_all')}
            </button>
            <button className="btn" onClick={() => print('pdf')} data-testid="inst-pdf-all">
              <Icon name="pdf" size={16} />
              {t('inst_pdf_all')}
            </button>
            <button className="btn" onClick={() => print('preview')} data-testid="inst-preview">
              <Icon name="eye" size={16} />
              {t('preview')}
            </button>
            <button className="btn" onClick={() => onOpenBook(created.id)} data-testid="inst-one-by-one">
              <Icon name="list" size={16} />
              {t('inst_one_by_one')}
            </button>
            <button className="btn ghost" onClick={() => setCreated(null)}>
              <Icon name="plus" size={16} />
              {t('inst_new')}
            </button>
          </div>
        </Section>
      </div>
    );
  }

  const num = (key, label, props = {}) => (
    <TextField
      label={label}
      type="number"
      dir="ltr"
      min={props.min ?? 0}
      max={props.max}
      step={props.step || '1'}
      value={plan[key]}
      onChange={(v) => setP({ [key]: v })}
      testId={`inst-${key}`}
      className={props.className}
    />
  );

  return (
    <div className="page">
      <PageHeader icon="layers" title={t('inst_title')} subtitle={t('sub_installments')} />

      <Section icon="money" title={t('inst_plan')}>
        <div className="form-grid">
          <TextField
            label={t('book_name')}
            required
            className="span-2"
            placeholder={t('inst_name_ph')}
            value={plan.name}
            onChange={(v) => setP({ name: v })}
            testId="inst-name"
          />
          {num('total', t('amount_total'), { step: '0.01', className: 'span-2 amount' })}
          {num('years', t('inst_years'), { max: 30 })}
          {num('months', t('inst_months'), { max: 11 })}
          <Field label={t('inst_period')}>
            <Select
              label={t('inst_period')}
              testId="inst-period"
              value={plan.period}
              onChange={(v) => setP({ period: Number(v) })}
              options={PERIODS.map((p) => ({
                value: p,
                label: `${t('inst_every')} ${p} ${p === 1 ? t('inst_month') : t('inst_months_word')}`,
              }))}
            />
          </Field>
          <Field label=" " className="switch-field">
            <Switch
              label={t('inst_round')}
              checked={plan.round_whole}
              onChange={(v) => setP({ round_whole: v })}
              testId="inst-round"
            />
          </Field>
          <Field label={t('issue_date')} hint={<HijriHint iso={plan.issue_date} />}>
            <DateInput
              label={t('issue_date')}
              testId="inst-issue"
              value={plan.issue_date}
              onChange={(v) => setP({ issue_date: v })}
            />
          </Field>
          <Field label={t('inst_first_due')} hint={<HijriHint iso={plan.first_due} />}>
            <DateInput
              label={t('inst_first_due')}
              testId="inst-first-due"
              value={plan.first_due}
              onChange={(v) => setP({ first_due: v })}
            />
          </Field>
          <TextField label={t('city')} value={data.city} onChange={(v) => set({ city: v })} />
          <TextField
            label={t('creditor_name')}
            value={data.creditor_name}
            onChange={(v) => set({ creditor_name: v })}
          />
          <TextField
            label={t('reason')}
            className="span-all"
            placeholder={t('reason_ph')}
            value={data.reason}
            onChange={(v) => set({ reason: v })}
            testId="inst-reason"
          />
        </div>

        <div className="summary" data-testid="inst-summary">
          <div>
            <span>{t('inst_total_months')}</span>
            <b data-testid="sum-months">{schedule.totalMonths}</b>
          </div>
          <div>
            <span>{t('inst_count')}</span>
            <b data-testid="sum-count">{schedule.count}</b>
          </div>
          <div>
            <span>{t('inst_value')}</span>
            <b dir="ltr" data-testid="sum-installment">
              {formatMoney(schedule.installment)}
            </b>
          </div>
          <div>
            <span>{t('amount_total')}</span>
            <b dir="ltr">{formatMoney(plan.total)}</b>
          </div>
        </div>
        {!schedule.exact && schedule.count > 0 && <Alert type="info">{t('inst_not_exact')}</Alert>}
      </Section>

      <Section icon="user" title={t('sec_debtor')}>
        <PartyFields prefix="debtor" data={data} set={set} requiredName />
      </Section>

      <Section icon="users" title={t('sec_guarantor')}>
        <PartyFields prefix="guarantor" data={data} set={set} />
      </Section>

      <Section icon="edit" title={t('sec_witnesses')}>
        <div className="form-grid">
          <TextField label={t('witness1')} className="span-2" value={data.witness1} onChange={(v) => set({ witness1: v })} />
          <TextField label={t('witness2')} className="span-2" value={data.witness2} onChange={(v) => set({ witness2: v })} />
        </div>
      </Section>

      {schedule.items.length > 0 && (
        <Section icon="calendar" title={t('inst_schedule')}>
          <div className="table-wrap">
            <table className="table" data-testid="inst-table">
              <thead>
                <tr>
                  <th>{t('col_number')}</th>
                  <th>{t('due_date')}</th>
                  <th>{t('hijri')}</th>
                  <th className="num">{t('col_amount')}</th>
                  <th>{t('amount_words')}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.items.map((i) => (
                  <tr key={i.seq}>
                    <td>
                      <span className="num-pill">
                        <Ltr>
                          {String(i.seq).padStart(Math.max(2, String(schedule.count).length), '0')} / {schedule.count}
                        </Ltr>
                      </span>
                    </td>
                    <td>
                      <Ltr>{gregorianText(i.due_date)}</Ltr>
                    </td>
                    <td className="muted">
                      <Ltr>{hijriText(i.due_date)}</Ltr>
                    </td>
                    <td dir="ltr" className="num">
                      <b>{formatMoney(i.amount)}</b>
                    </td>
                    <td className="small">{amountToArabicWords(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {error && <Alert>{error}</Alert>}

      <div className="sticky-actions">
        <button className="btn primary" disabled={busy || !schedule.items.length} onClick={create} data-testid="inst-create">
          <Icon name="check" size={16} />
          {t('inst_create')}
        </button>
      </div>
    </div>
  );
}
