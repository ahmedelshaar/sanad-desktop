import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n, errorText } from '../i18n.js';

export default function Books({ onNewVoucher, onOpenBook }) {
  const { t } = useI18n();
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState({ name: '', count: 60, notes: '' });
  const [msg, setMsg] = useState(null);

  const load = () => api.books.list().then(setBooks);
  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api.books.create(form);
      setForm({ name: '', count: form.count, notes: '' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: errorText(t, err.message) });
    }
  };

  const printAll = async (id) => {
    setMsg(null);
    try {
      await api.books.print(id, 'print');
      load();
    } catch (err) {
      setMsg({ type: 'error', text: errorText(t, err.message) });
    }
  };

  const toggle = async (b) => {
    try {
      await api.books.setStatus(b.id, b.status === 'open' ? 'closed' : 'open');
      load();
    } catch (err) {
      setMsg({ type: 'error', text: errorText(t, err.message) });
    }
  };

  return (
    <div className="page">
      <h1>{t('books_title')}</h1>

      <form className="card form-grid" onSubmit={create}>
        <h2 className="span-all">{t('book_new')}</h2>
        <label>
          {t('book_name')}
          <input
            value={form.name}
            placeholder={t('book_name_ph')}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          {t('book_count')}
          <input
            type="number"
            min="1"
            max="10000"
            value={form.count}
            onChange={(e) => setForm({ ...form, count: e.target.value })}
          />
        </label>
        <label className="span-2">
          {t('book_notes')}
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <div className="span-all actions">
          <button className="btn primary" type="submit">
            {t('book_create')}
          </button>
        </div>
        {msg && <div className={`alert span-all ${msg.type}`}>{msg.text}</div>}
      </form>

      <div className="card">
        {books.length === 0 ? (
          <p className="muted">{t('books_empty')}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t('book_name')}</th>
                <th>{t('book_count')}</th>
                <th>{t('book_used')}</th>
                <th>{t('book_remaining')}</th>
                <th>{t('book_cancelled')}</th>
                <th>{t('book_status')}</th>
                <th>{t('book_created_at')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id}>
                  <td>
                    <b>{b.name}</b>
                    {b.kind === 'installments' && <span className="badge kind">{t('book_kind_installments')}</span>}
                  </td>
                  <td>{b.count}</td>
                  <td>
                    <div className="progress">
                      <div style={{ width: `${(b.used / b.count) * 100}%` }} />
                    </div>
                    {b.used}
                  </td>
                  <td>{b.count - b.used}</td>
                  <td>{b.cancelled}</td>
                  <td>
                    <span className={`badge ${b.status}`}>{t(b.status === 'open' ? 'book_open' : 'book_closed')}</span>
                  </td>
                  <td className="muted">{String(b.created_at).slice(0, 10)}</td>
                  <td className="row-actions">
                    {b.used > 0 && (
                      <>
                        <button className="btn small" onClick={() => onOpenBook(b.id)}>
                          {t('book_view_notes')}
                        </button>
                        <button className="btn small" onClick={() => printAll(b.id)}>
                          {t('book_print_all')}
                        </button>
                      </>
                    )}
                    {b.status === 'open' && (
                      <button className="btn small primary" onClick={onNewVoucher}>
                        {t('nav_new')}
                      </button>
                    )}
                    {(b.status === 'open' || b.used < b.count) && (
                      <button className="btn small" onClick={() => toggle(b)}>
                        {t(b.status === 'open' ? 'book_close' : 'book_reopen')}
                      </button>
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
