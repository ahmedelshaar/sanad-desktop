import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n, errorText } from '../i18n.js';
import { TextField } from './VoucherForm.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, EmptyState, IconButton, Ltr, PageHeader, Section, useToast } from '../components/ui.jsx';

export default function Books({ onNewVoucher, onNewInstallments, onOpenBook }) {
  const { t } = useI18n();
  const toast = useToast();
  const [books, setBooks] = useState(null);
  const [form, setForm] = useState({ name: '', count: 60, notes: '' });
  const [error, setError] = useState(null);

  const load = () => api.books.list().then(setBooks);
  useEffect(() => {
    load();
  }, []);

  const run = async (fn, okText) => {
    setError(null);
    try {
      await fn();
      if (okText) toast.show(okText);
      load();
    } catch (err) {
      setError(errorText(t, err.message));
    }
  };

  const create = (e) => {
    e.preventDefault();
    run(async () => {
      await api.books.create(form);
      setForm({ name: '', count: form.count, notes: '' });
    }, t('book_created'));
  };

  return (
    <div className="page">
      <PageHeader icon="book" title={t('books_title')} subtitle={t('sub_books')}>
        <button className="btn" onClick={onNewInstallments}>
          <Icon name="layers" size={16} />
          {t('inst_new')}
        </button>
      </PageHeader>

      <Section icon="plus" title={t('book_new')}>
        <form className="form-grid" onSubmit={create}>
          <TextField
            label={t('book_name')}
            required
            placeholder={t('book_name_ph')}
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            testId="book-name"
          />
          <TextField
            label={t('book_count')}
            type="number"
            min="1"
            max="10000"
            dir="ltr"
            value={form.count}
            onChange={(v) => setForm({ ...form, count: v })}
            testId="book-count"
          />
          <TextField
            label={t('book_notes')}
            className="span-2"
            value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
          />
          <div className="span-all actions">
            <button className="btn primary" type="submit" data-testid="book-create">
              <Icon name="plus" size={16} />
              {t('book_create')}
            </button>
          </div>
        </form>
      </Section>

      {error && <Alert>{error}</Alert>}

      <div className="card table-card">
        {books && books.length === 0 ? (
          <EmptyState icon="book" text={t('books_empty')} />
        ) : (
          <div className="table-wrap">
            <table className="table" data-testid="books-table">
              <thead>
                <tr>
                  <th>{t('book_name')}</th>
                  <th>{t('book_used')}</th>
                  <th>{t('book_remaining')}</th>
                  <th>{t('book_cancelled')}</th>
                  <th>{t('book_status')}</th>
                  <th>{t('book_created_at')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {(books || []).map((b) => (
                  <tr key={b.id} data-testid={`book-row-${b.id}`}>
                    <td>
                      <b>{b.name}</b>
                      {b.kind === 'installments' && <span className="badge kind">{t('book_kind_installments')}</span>}
                    </td>
                    <td>
                      <div className="progress-row">
                        <div className="progress">
                          <div style={{ width: `${(b.used / b.count) * 100}%` }} />
                        </div>
                        <span className="muted small">
                          <Ltr>
                            {b.used} / {b.count}
                          </Ltr>
                        </span>
                      </div>
                    </td>
                    <td>{b.count - b.used}</td>
                    <td>{b.cancelled}</td>
                    <td>
                      <span className={`badge ${b.status}`}>{t(b.status === 'open' ? 'book_open' : 'book_closed')}</span>
                    </td>
                    <td className="muted">
                      <Ltr>{String(b.created_at).slice(0, 10)}</Ltr>
                    </td>
                    <td>
                      <div className="row-actions">
                        {b.status === 'open' && (
                          <IconButton icon="plus" title={t('nav_new')} variant="primary" onClick={onNewVoucher} />
                        )}
                        {b.used > 0 && (
                          <>
                            <IconButton icon="list" title={t('book_view_notes')} testId={`book-notes-${b.id}`} onClick={() => onOpenBook(b.id)} />
                            <IconButton icon="print" title={t('book_print_all')} onClick={() => run(() => api.books.print(b.id, 'print'))} />
                          </>
                        )}
                        {(b.status === 'open' || b.used < b.count) && (
                          <button
                            className="btn small"
                            data-testid={`book-toggle-${b.id}`}
                            onClick={() => run(() => api.books.setStatus(b.id, b.status === 'open' ? 'closed' : 'open'))}
                          >
                            {t(b.status === 'open' ? 'book_close' : 'book_reopen')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
