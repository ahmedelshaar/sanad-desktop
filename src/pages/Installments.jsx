import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { useI18n, errorText } from '../i18n.js';
import { PartyFields } from './VoucherForm.jsx';
import { buildSchedule, addMonths } from '../lib/schedule.js';
import { amountToArabicWords } from '../lib/tafqeet.js';
import { formatMoney, gregorianText, hijriText, todayIso } from '../lib/format.js';

const PERIODS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function Installments({ settings, onOpenBook }) {
  const { t } = useI18n();
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
  const [msg, setMsg] = useState(null);
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
    setMsg(null);
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
      setMsg({ type: 'success', text: `${t('inst_created')} — ${book.name} (${book.count})` });
    } catch (err) {
      setMsg({ type: 'error', text: errorText(t, err.message) });
    } finally {
      setBusy(false);
    }
  };

  const print = async (mode) => {
    setMsg(null);
    try {
      await api.books.print(created.id, mode);
    } catch (err) {
      setMsg({ type: 'error', text: errorText(t, err.message) });
    }
  };

  const num = (key, label, props = {}) => (
    <label className={props.className}>
      {label}
      <input
        type="number"
        dir="ltr"
        min={props.min ?? 0}
        max={props.max}
        step={props.step || '1'}
        value={plan[key]}
        onChange={(e) => setP({ [key]: e.target.value })}
      />
    </label>
  );

  const field = (name, label, className) => (
    <label className={className}>
      {label}
      <input value={data[name]} onChange={(e) => set({ [name]: e.target.value })} />
    </label>
  );

  if (created) {
    return (
      <div className="page">
        <h1>{t('inst_title')}</h1>
        {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}
        <div className="card">
          <h2>
            {created.name} — {created.count} {t('inst_notes')}
          </h2>
          <p className="muted">{t('inst_print_hint')}</p>
          <div className="actions">
            <button className="btn primary" onClick={() => print('print')}>
              {t('inst_print_all')}
            </button>
            <button className="btn" onClick={() => print('pdf')}>
              {t('inst_pdf_all')}
            </button>
            <button className="btn" onClick={() => print('preview')}>
              {t('preview')}
            </button>
            <button className="btn" onClick={() => onOpenBook(created.id)}>
              {t('inst_one_by_one')}
            </button>
            <button className="btn ghost" onClick={() => setCreated(null)}>
              {t('inst_new')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>{t('inst_title')}</h1>

      <div className="card form-grid">
        <h2 className="span-all">{t('inst_plan')}</h2>
        <label className="span-2">
          {t('book_name')}
          <input
            value={plan.name}
            placeholder={t('inst_name_ph')}
            onChange={(e) => setP({ name: e.target.value })}
          />
        </label>
        <label className="span-2">
          {t('amount_total')}
          <input
            type="number"
            dir="ltr"
            min="0"
            step="0.01"
            className="amount-input"
            value={plan.total}
            onChange={(e) => setP({ total: e.target.value })}
          />
        </label>
        {num('years', t('inst_years'), { max: 30 })}
        {num('months', t('inst_months'), { max: 11 })}
        <label>
          {t('inst_period')}
          <select value={plan.period} onChange={(e) => setP({ period: Number(e.target.value) })}>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {t('inst_every')} {p} {p === 1 ? t('inst_month') : t('inst_months_word')}
              </option>
            ))}
          </select>
        </label>
        <label className="check" style={{ alignSelf: 'end', paddingBottom: 10 }}>
          <input type="checkbox" checked={plan.round_whole} onChange={(e) => setP({ round_whole: e.target.checked })} />
          {t('inst_round')}
        </label>
        <label>
          {t('issue_date')}
          <input type="date" value={plan.issue_date} onChange={(e) => setP({ issue_date: e.target.value })} />
          <small className="muted">
            {t('hijri')}: {hijriText(plan.issue_date)}
          </small>
        </label>
        <label>
          {t('inst_first_due')}
          <input type="date" value={plan.first_due} onChange={(e) => setP({ first_due: e.target.value })} />
        </label>
        {field('city', t('city'))}
        {field('creditor_name', t('creditor_name'))}
        {field('reason', t('reason'), 'span-all')}

        <div className="span-all summary">
          <div>
            <span>{t('inst_total_months')}</span>
            <b>{schedule.totalMonths}</b>
          </div>
          <div>
            <span>{t('inst_count')}</span>
            <b>{schedule.count}</b>
          </div>
          <div>
            <span>{t('inst_value')}</span>
            <b dir="ltr">{formatMoney(schedule.installment)}</b>
          </div>
          <div>
            <span>{t('amount_total')}</span>
            <b dir="ltr">{formatMoney(plan.total)}</b>
          </div>
        </div>
        {!schedule.exact && schedule.count > 0 && <div className="span-all alert error">{t('inst_not_exact')}</div>}
      </div>

      <div className="card form-grid">
        <h2 className="span-all">{t('sec_debtor')}</h2>
        <PartyFields prefix="debtor" data={data} set={set} />
      </div>

      <div className="card form-grid">
        <h2 className="span-all">{t('sec_guarantor')}</h2>
        <PartyFields prefix="guarantor" data={data} set={set} />
      </div>

      <div className="card form-grid">
        <h2 className="span-all">{t('sec_witnesses')}</h2>
        {field('witness1', t('witness1'), 'span-2')}
        {field('witness2', t('witness2'), 'span-2')}
      </div>

      {schedule.items.length > 0 && (
        <div className="card">
          <h2>{t('inst_schedule')}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>{t('col_number')}</th>
                <th>{t('due_date')}</th>
                <th>{t('hijri')}</th>
                <th>{t('col_amount')}</th>
                <th>{t('amount_words')}</th>
              </tr>
            </thead>
            <tbody>
              {schedule.items.map((i) => (
                <tr key={i.seq}>
                  <td>
                    <b>
                      {String(i.seq).padStart(Math.max(2, String(schedule.count).length), '0')} / {schedule.count}
                    </b>
                  </td>
                  <td>{gregorianText(i.due_date)}</td>
                  <td className="muted">{hijriText(i.due_date)}</td>
                  <td dir="ltr" className="num">
                    {formatMoney(i.amount)}
                  </td>
                  <td className="small">{amountToArabicWords(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

      <div className="sticky-actions">
        <button className="btn primary" disabled={busy || !schedule.items.length} onClick={create}>
          {t('inst_create')}
        </button>
      </div>
    </div>
  );
}
