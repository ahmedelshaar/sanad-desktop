import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useI18n, errorText } from '../i18n.js';
import { amountToArabicWords } from '../lib/tafqeet.js';
import { hijriText, todayIso } from '../lib/format.js';
import Select from '../components/Select.jsx';
import DateInput from '../components/DateInput.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, Field, Ltr, PageHeader, Section, useToast } from '../components/ui.jsx';

const EMPTY = {
  issue_date: '',
  due_date: '',
  city: '',
  amount: '',
  amount_words: '',
  reason: '',
  debtor_name: '',
  debtor_id_number: '',
  debtor_id_date: '',
  debtor_id_source: '',
  debtor_address: '',
  debtor_phone: '',
  creditor_name: '',
  guarantor_name: '',
  guarantor_id_number: '',
  guarantor_id_date: '',
  guarantor_id_source: '',
  guarantor_address: '',
  guarantor_phone: '',
  witness1: '',
  witness2: '',
  notes: '',
};

export function HijriHint({ iso }) {
  const { t } = useI18n();
  if (!iso) return null;
  return (
    <>
      {t('hijri')}: <Ltr>{hijriText(iso)}</Ltr>
    </>
  );
}

// Plain text input wrapped in its label.
export function TextField({ label, value, onChange, className = '', required, testId, ...rest }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">
        {label}
        {required ? <i className="req">*</i> : null}
      </span>
      <input
        className="field-box"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        {...rest}
      />
    </label>
  );
}

export function CustomerSearch({ onPick, testId }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) {
      setItems([]);
      return undefined;
    }
    timer.current = setTimeout(() => api.customers.search(q).then(setItems), 200);
    return () => clearTimeout(timer.current);
  }, [q]);

  return (
    <div className="search-box">
      <div className="field-box search-input">
        <Icon name="search" size={16} />
        <input
          value={q}
          placeholder={t('search_customer')}
          aria-label={t('search_customer')}
          data-testid={testId}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && items.length > 0 && (
        <ul className="popover suggestions" role="listbox">
          {items.map((c) => (
            <li
              key={c.id}
              role="option"
              aria-selected="false"
              onMouseDown={() => {
                onPick(c);
                setQ('');
                setOpen(false);
              }}
            >
              <Icon name="user" size={16} />
              <b>{c.name}</b> <span className="muted">{c.id_number}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PartyFields({ prefix, data, set, withSearch = true, requiredName = false }) {
  const { t } = useI18n();
  const f = (name) => `${prefix}_${name}`;
  const pick = (c) =>
    set({
      [f('name')]: c.name || '',
      [f('id_number')]: c.id_number || '',
      [f('id_date')]: c.id_date || '',
      [f('id_source')]: c.id_source || '',
      [f('address')]: c.address || '',
      [f('phone')]: c.phone || '',
    });
  const input = (name, label, props = {}) => (
    <TextField
      label={label}
      value={data[f(name)]}
      onChange={(v) => set({ [f(name)]: v })}
      testId={`${prefix}-${name}`}
      {...props}
    />
  );
  return (
    <div className="form-grid">
      {withSearch && (
        <div className="span-all">
          <CustomerSearch onPick={pick} testId={`${prefix}-search`} />
        </div>
      )}
      {input('name', t('name'), { className: 'span-2', required: requiredName })}
      {input('id_number', t('id_number'), { dir: 'ltr' })}
      {input('id_date', t('id_date'), { placeholder: '1445/01/01', dir: 'ltr' })}
      {input('id_source', t('id_source'))}
      {input('phone', t('phone'), { dir: 'ltr' })}
      {input('address', t('address'), { className: 'span-2' })}
    </div>
  );
}

export default function VoucherForm({ id, settings, onNew }) {
  const { t } = useI18n();
  const toast = useToast();
  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState(null);
  const [next, setNext] = useState(null);
  const [data, setData] = useState(EMPTY);
  const [saved, setSaved] = useState(null); // saved voucher
  const [wordsTouched, setWordsTouched] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const editing = !!(id || saved);

  useEffect(() => {
    if (id) {
      api.vouchers.get(id).then((v) => {
        setSaved(v);
        setData(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, v[k] ?? ''])));
        setWordsTouched(true);
      });
      return;
    }
    setData({
      ...EMPTY,
      issue_date: todayIso(),
      city: settings.city || '',
      creditor_name: settings.creditor_name || '',
    });
    api.books.list().then((list) => {
      const open = list.filter((b) => b.status === 'open');
      setBooks(open);
      if (open.length) setBookId(open[open.length - 1].id); // oldest open book first
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!bookId || editing) return;
    api.books.next(bookId).then(setNext);
  }, [bookId, editing]);

  const set = (patch) => setData((d) => ({ ...d, ...patch }));

  const onAmount = (value) => {
    const patch = { amount: value };
    if (!wordsTouched) patch.amount_words = amountToArabicWords(value);
    set(patch);
  };

  const save = async (after) => {
    setError(null);
    setBusy(true);
    try {
      const v = editing ? await api.vouchers.update(saved.id, data) : await api.vouchers.create(bookId, data);
      setSaved(v);
      toast.show(`${t('saved')} — ${t('form_number')} ${v.number_label} ${t('form_of')} ${v.book_count}`);
      if (after) {
        const res = await api.vouchers.print(v.id, after);
        if (after === 'print' && res && res.ok === false && res.reason && res.reason !== 'cancelled') {
          setError(res.reason);
        }
      }
    } catch (err) {
      setError(errorText(t, err.message));
    } finally {
      setBusy(false);
    }
  };

  const noBook = !editing && books.length === 0;
  const cancelled = saved && saved.status === 'cancelled';
  const chip = editing ? saved : next && { book_name: next.book.name, number_label: next.label, book_count: next.book.count };

  return (
    <div className="page">
      <PageHeader
        icon="note"
        title={editing ? t('form_edit_title') : t('form_new_title')}
        subtitle={editing ? null : t('sub_new')}
      >
        {chip ? (
          <div className="number-chip" data-testid="number-chip">
            <span>{chip.book_name}</span>
            <b>
              {chip.number_label} {t('form_of')} {chip.book_count}
            </b>
          </div>
        ) : null}
      </PageHeader>

      {noBook ? (
        <Alert>{t('form_no_open_book')}</Alert>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(null);
          }}
        >
          <fieldset disabled={cancelled || busy}>
            {cancelled ? <Alert>{t('status_cancelled')}</Alert> : null}

            <Section icon="money" title={t('sec_main')}>
              <div className="form-grid">
                {!editing && (
                  <Field label={t('form_book')}>
                    <Select
                      label={t('form_book')}
                      testId="book-select"
                      value={bookId}
                      onChange={(v) => setBookId(Number(v))}
                      options={books.map((b) => ({
                        value: b.id,
                        label: b.name,
                        hint: `${b.used} / ${b.count}`,
                      }))}
                    />
                  </Field>
                )}
                <Field label={t('issue_date')} hint={<HijriHint iso={data.issue_date} />}>
                  <DateInput
                    label={t('issue_date')}
                    testId="issue-date"
                    value={data.issue_date}
                    onChange={(v) => set({ issue_date: v })}
                  />
                </Field>
                <Field label={t('due_date')} hint={<HijriHint iso={data.due_date} />}>
                  <DateInput
                    label={t('due_date')}
                    testId="due-date"
                    allowClear
                    value={data.due_date}
                    onChange={(v) => set({ due_date: v })}
                  />
                </Field>
                <TextField label={t('city')} value={data.city} onChange={(v) => set({ city: v })} testId="city" />
                <TextField
                  label={t('amount')}
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  className="amount"
                  value={data.amount}
                  onChange={onAmount}
                  testId="amount"
                />
                <label className="field span-3">
                  <span className="field-label">{t('amount_words')}</span>
                  <input
                    className="field-box"
                    data-testid="amount-words"
                    value={data.amount_words}
                    title={t('words_hint')}
                    onChange={(e) => {
                      setWordsTouched(true);
                      set({ amount_words: e.target.value });
                    }}
                    onDoubleClick={() => {
                      setWordsTouched(false);
                      set({ amount_words: amountToArabicWords(data.amount) });
                    }}
                  />
                </label>
                <TextField
                  label={t('reason')}
                  className="span-all"
                  placeholder={t('reason_ph')}
                  value={data.reason}
                  onChange={(v) => set({ reason: v })}
                  testId="reason"
                />
              </div>
            </Section>

            <Section icon="user" title={t('sec_debtor')}>
              <PartyFields prefix="debtor" data={data} set={set} requiredName />
            </Section>

            <Section icon="shield" title={t('sec_creditor')}>
              <div className="form-grid">
                <TextField
                  label={t('creditor_name')}
                  className="span-2"
                  value={data.creditor_name}
                  onChange={(v) => set({ creditor_name: v })}
                  testId="creditor"
                />
              </div>
            </Section>

            <Section icon="users" title={t('sec_guarantor')}>
              <PartyFields prefix="guarantor" data={data} set={set} />
            </Section>

            <Section icon="edit" title={t('sec_witnesses')}>
              <div className="form-grid">
                <TextField
                  label={t('witness1')}
                  className="span-2"
                  value={data.witness1}
                  onChange={(v) => set({ witness1: v })}
                />
                <TextField
                  label={t('witness2')}
                  className="span-2"
                  value={data.witness2}
                  onChange={(v) => set({ witness2: v })}
                />
                <TextField
                  label={t('notes')}
                  className="span-all"
                  value={data.notes}
                  onChange={(v) => set({ notes: v })}
                />
              </div>
            </Section>
          </fieldset>

          {error && <Alert>{error}</Alert>}

          <div className="sticky-actions">
            {!cancelled && (
              <>
                <button className="btn primary" type="button" disabled={busy} onClick={() => save('print')} data-testid="save-print">
                  <Icon name="print" size={16} />
                  {t('save_print')}
                </button>
                <button className="btn" type="button" disabled={busy} onClick={() => save('preview')} data-testid="save-preview">
                  <Icon name="eye" size={16} />
                  {t('save_preview')}
                </button>
                <button className="btn" type="submit" disabled={busy} data-testid="save">
                  <Icon name="save" size={16} />
                  {t('save')}
                </button>
              </>
            )}
            {editing && (
              <button className="btn ghost" type="button" onClick={onNew} data-testid="new-voucher">
                <Icon name="plus" size={16} />
                {t('new_voucher')}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
