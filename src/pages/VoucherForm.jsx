import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useI18n, errorText } from '../i18n.js';
import { amountToArabicWords } from '../lib/tafqeet.js';
import { hijriText, todayIso } from '../lib/format.js';

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

export function CustomerSearch({ onPick }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) return setItems([]);
    timer.current = setTimeout(() => api.customers.search(q).then(setItems), 200);
  }, [q]);

  return (
    <div className="search-box">
      <input
        value={q}
        placeholder={t('search_customer')}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && items.length > 0 && (
        <ul className="suggestions">
          {items.map((c) => (
            <li
              key={c.id}
              onMouseDown={() => {
                onPick(c);
                setQ('');
                setOpen(false);
              }}
            >
              <b>{c.name}</b> <span className="muted">{c.id_number}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PartyFields({ prefix, data, set, withSearch = true }) {
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
    <label {...(props.wrap || {})}>
      {label}
      <input value={data[f(name)]} onChange={(e) => set({ [f(name)]: e.target.value })} {...(props.input || {})} />
    </label>
  );
  return (
    <>
      {withSearch && (
        <div className="span-all">
          <CustomerSearch onPick={pick} />
        </div>
      )}
      {input('name', t('name'), { wrap: { className: 'span-2' } })}
      {input('id_number', t('id_number'), { input: { dir: 'ltr' } })}
      {input('id_date', t('id_date'), { input: { placeholder: '1445/01/01', dir: 'ltr' } })}
      {input('id_source', t('id_source'))}
      {input('phone', t('phone'), { input: { dir: 'ltr' } })}
      {input('address', t('address'), { wrap: { className: 'span-2' } })}
    </>
  );
}

export default function VoucherForm({ id, settings, onNew }) {
  const { t } = useI18n();
  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState(null);
  const [next, setNext] = useState(null);
  const [data, setData] = useState(EMPTY);
  const [saved, setSaved] = useState(null); // saved voucher
  const [wordsTouched, setWordsTouched] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const editing = !!(id || saved);

  // initial load
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
    setMsg(null);
    setBusy(true);
    try {
      const v = editing
        ? await api.vouchers.update(saved.id, data)
        : await api.vouchers.create(bookId, data);
      setSaved(v);
      setMsg({ type: 'success', text: `${t('saved')} — ${t('form_number')} ${v.number_label} ${t('form_of')} ${v.book_count}` });
      if (after) {
        const res = await api.vouchers.print(v.id, after);
        if (after === 'print' && res && res.ok === false && res.reason && res.reason !== 'cancelled') {
          setMsg({ type: 'error', text: res.reason });
        }
      }
    } catch (err) {
      setMsg({ type: 'error', text: errorText(t, err.message) });
    } finally {
      setBusy(false);
    }
  };

  const noBook = !editing && books.length === 0;
  const cancelled = saved && saved.status === 'cancelled';

  const field = (name, label, props = {}) => (
    <label className={props.className}>
      {label}
      <input value={data[name]} onChange={(e) => set({ [name]: e.target.value })} {...(props.input || {})} />
      {props.hint ? <small className="muted">{props.hint}</small> : null}
    </label>
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1>{editing ? t('form_edit_title') : t('form_new_title')}</h1>
        <div className="number-chip">
          {editing ? (
            <>
              <span>{saved.book_name}</span>
              <b>
                {saved.number_label} {t('form_of')} {saved.book_count}
              </b>
            </>
          ) : next ? (
            <>
              <span>{next.book.name}</span>
              <b>
                {next.label} {t('form_of')} {next.book.count}
              </b>
            </>
          ) : null}
        </div>
      </div>

      {noBook ? (
        <div className="alert error">{t('form_no_open_book')}</div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(null);
          }}
        >
          <fieldset disabled={cancelled || busy}>
            <div className="card form-grid">
              <h2 className="span-all">{t('sec_main')}</h2>
              {!editing && (
                <label>
                  {t('form_book')}
                  <select value={bookId || ''} onChange={(e) => setBookId(Number(e.target.value))}>
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.used}/{b.count})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {field('issue_date', t('issue_date'), {
                input: { type: 'date' },
                hint: data.issue_date ? `${t('hijri')}: ${hijriText(data.issue_date)}` : '',
              })}
              {field('due_date', t('due_date'), {
                input: { type: 'date' },
                hint: data.due_date ? `${t('hijri')}: ${hijriText(data.due_date)}` : '',
              })}
              {field('city', t('city'))}
              <label>
                {t('amount')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  className="amount-input"
                  value={data.amount}
                  onChange={(e) => onAmount(e.target.value)}
                />
              </label>
              <label className="span-3">
                {t('amount_words')}
                <input
                  value={data.amount_words}
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
              {field('reason', t('reason'), { className: 'span-all', input: { placeholder: t('reason_ph') } })}
            </div>

            <div className="card form-grid">
              <h2 className="span-all">{t('sec_debtor')}</h2>
              <PartyFields prefix="debtor" data={data} set={set} />
            </div>

            <div className="card form-grid">
              <h2 className="span-all">{t('sec_creditor')}</h2>
              {field('creditor_name', t('creditor_name'), { className: 'span-2' })}
            </div>

            <div className="card form-grid">
              <h2 className="span-all">{t('sec_guarantor')}</h2>
              <PartyFields prefix="guarantor" data={data} set={set} />
            </div>

            <div className="card form-grid">
              <h2 className="span-all">{t('sec_witnesses')}</h2>
              {field('witness1', t('witness1'), { className: 'span-2' })}
              {field('witness2', t('witness2'), { className: 'span-2' })}
              {field('notes', t('notes'), { className: 'span-all' })}
            </div>
          </fieldset>

          {msg && <div className={`alert ${msg.type}`}>{msg.text}</div>}

          <div className="sticky-actions">
            {!cancelled && (
              <>
                <button className="btn primary" type="button" disabled={busy} onClick={() => save('print')}>
                  {t('save_print')}
                </button>
                <button className="btn" type="button" disabled={busy} onClick={() => save('preview')}>
                  {t('save_preview')}
                </button>
                <button className="btn" type="submit" disabled={busy}>
                  {t('save')}
                </button>
              </>
            )}
            {editing && (
              <button className="btn ghost" type="button" onClick={onNew}>
                {t('new_voucher')}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
