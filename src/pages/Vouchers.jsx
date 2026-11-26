import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n, errorText } from '../i18n.js';
import { formatMoney, gregorianText } from '../lib/format.js';

export default function Vouchers({ onEdit, bookId }) {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const [books, setBooks] = useState([]);
  const [filters, setFilters] = useState({ q: '', bookId: bookId ? String(bookId) : '', status: '' });
  const [msg, setMsg] = useState(null);

  const load = () =>
    api.vouchers
      .list({ q: filters.q, bookId: filters.bookId ? Number(filters.bookId) : null, status: filters.status || null })
      .then(setList);

  useEffect(() => {
    api.books.list().then(setBooks);
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const run = async (fn) => {
    setMsg(null);
    try {
      await fn();
      load();
    } catch (err) {
      setMsg(errorText(t, err.message));
    }
  };

  // Electron has no window.prompt, so cancelling uses a small inline dialog.
  const [voiding, setVoiding] = useState(null);
  const [reason, setReason] = useState('');
  const confirmVoid = () =>
    run(async () => {
      await api.vouchers.cancel(voiding.id, reason);
      setVoiding(null);
      setReason('');
    });

  return (
    <div className="page">
      <h1>{t('list_title')}</h1>

      <div className="card filters">
        <input
          className="grow"
          placeholder={t('search')}
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <select value={filters.bookId} onChange={(e) => setFilters({ ...filters, bookId: e.target.value })}>
          <option value="">{t('all_books')}</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">{t('all_status')}</option>
          <option value="active">{t('status_active')}</option>
          <option value="cancelled">{t('status_cancelled')}</option>
        </select>
      </div>

      {filters.bookId && (
        <div className="actions" style={{ marginBottom: 16 }}>
          <button className="btn primary" onClick={() => run(() => api.books.print(Number(filters.bookId), 'print'))}>
            {t('inst_print_all')}
          </button>
          <button className="btn" onClick={() => run(() => api.books.print(Number(filters.bookId), 'pdf'))}>
            {t('inst_pdf_all')}
          </button>
          <button className="btn" onClick={() => run(() => api.books.print(Number(filters.bookId), 'preview'))}>
            {t('preview')}
          </button>
        </div>
      )}

      {msg && <div className="alert error">{msg}</div>}

      {voiding && (
        <div className="modal-backdrop" onClick={() => setVoiding(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h2>
              {t('void')} — {voiding.number_label} / {voiding.book_count}
            </h2>
            <p>{t('void_confirm')}</p>
            <label>
              {t('void_reason')}
              <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div className="actions">
              <button className="btn danger" onClick={confirmVoid}>
                {t('void')}
              </button>
              <button className="btn" onClick={() => setVoiding(null)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {list.length === 0 ? (
          <p className="muted">{t('list_empty')}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('col_number')}</th>
                <th>{t('col_book')}</th>
                <th>{t('col_debtor')}</th>
                <th>{t('col_amount')}</th>
                <th>{t('col_issue')}</th>
                <th>{t('col_due')}</th>
                <th>{t('col_status')}</th>
                <th>{t('col_printed')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id} className={v.status === 'cancelled' ? 'is-cancelled' : ''}>
                  <td>
                    <b>
                      {v.number_label} / {v.book_count}
                    </b>
                  </td>
                  <td>{v.book_name}</td>
                  <td>
                    {v.debtor_name}
                    <div className="muted small">{v.debtor_id_number}</div>
                  </td>
                  <td dir="ltr" className="num">
                    {formatMoney(v.amount)}
                  </td>
                  <td>{gregorianText(v.issue_date)}</td>
                  <td>{gregorianText(v.due_date)}</td>
                  <td>
                    <span className={`badge ${v.status}`}>
                      {t(v.status === 'cancelled' ? 'status_cancelled' : 'status_active')}
                    </span>
                  </td>
                  <td>
                    {v.print_count} {t('times')}
                  </td>
                  <td className="row-actions">
                    <button className="btn small primary" onClick={() => run(() => api.vouchers.print(v.id, 'print'))}>
                      {t('print')}
                    </button>
                    <button className="btn small" onClick={() => run(() => api.vouchers.print(v.id, 'preview'))}>
                      {t('preview')}
                    </button>
                    <button className="btn small" onClick={() => run(() => api.vouchers.print(v.id, 'pdf'))}>
                      {t('pdf')}
                    </button>
                    {v.status !== 'cancelled' && (
                      <>
                        <button className="btn small" onClick={() => onEdit(v.id)}>
                          {t('edit')}
                        </button>
                        <button className="btn small danger" onClick={() => setVoiding(v)}>
                          {t('void')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
