import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n, errorText } from '../i18n.js';
import { formatMoney, gregorianText } from '../lib/format.js';
import Select from '../components/Select.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, EmptyState, IconButton, Ltr, PageHeader, useToast } from '../components/ui.jsx';

export default function Vouchers({ onEdit, bookId }) {
  const { t } = useI18n();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [books, setBooks] = useState([]);
  const [filters, setFilters] = useState({ q: '', bookId: bookId ? String(bookId) : '', status: '' });
  const [error, setError] = useState(null);
  // Electron has no window.prompt, so cancelling uses a small dialog of our own.
  const [voiding, setVoiding] = useState(null);
  const [reason, setReason] = useState('');

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

  const confirmVoid = () =>
    run(async () => {
      await api.vouchers.cancel(voiding.id, reason);
      setVoiding(null);
      setReason('');
    }, t('voided'));

  const selectedBook = filters.bookId ? Number(filters.bookId) : null;
  const total = (list || []).filter((v) => v.status === 'active').reduce((a, v) => a + (Number(v.amount) || 0), 0);

  return (
    <div className="page">
      <PageHeader icon="list" title={t('list_title')} subtitle={t('sub_list')}>
        {selectedBook ? (
          <>
            <button className="btn primary" onClick={() => run(() => api.books.print(selectedBook, 'print'))} data-testid="book-print-all">
              <Icon name="print" size={16} />
              {t('inst_print_all')}
            </button>
            <button className="btn" onClick={() => run(() => api.books.print(selectedBook, 'pdf'))}>
              <Icon name="pdf" size={16} />
              {t('inst_pdf_all')}
            </button>
            <button className="btn" onClick={() => run(() => api.books.print(selectedBook, 'preview'))} data-testid="book-preview">
              <Icon name="eye" size={16} />
              {t('preview')}
            </button>
          </>
        ) : null}
      </PageHeader>

      <div className="card filters">
        <div className="field-box search-input grow">
          <Icon name="search" size={16} />
          <input
            placeholder={t('search')}
            aria-label={t('search')}
            data-testid="list-search"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </div>
        <Select
          label={t('col_book')}
          testId="filter-book"
          className="w-220"
          value={filters.bookId}
          onChange={(v) => setFilters({ ...filters, bookId: String(v) })}
          options={[{ value: '', label: t('all_books') }, ...books.map((b) => ({ value: String(b.id), label: b.name }))]}
        />
        <Select
          label={t('col_status')}
          testId="filter-status"
          className="w-160"
          value={filters.status}
          onChange={(v) => setFilters({ ...filters, status: v })}
          options={[
            { value: '', label: t('all_status') },
            { value: 'active', label: t('status_active') },
            { value: 'cancelled', label: t('status_cancelled') },
          ]}
        />
      </div>

      {error && <Alert>{error}</Alert>}

      {voiding && (
        <div className="modal-backdrop" onClick={() => setVoiding(null)}>
          <div className="modal card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>
              {t('void')} — {voiding.number_label} / {voiding.book_count}
            </h2>
            <p className="muted">{t('void_confirm')}</p>
            <label className="field">
              <span className="field-label">{t('void_reason')}</span>
              <input
                className="field-box"
                autoFocus
                data-testid="void-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="actions">
              <button className="btn danger-solid" onClick={confirmVoid} data-testid="void-confirm">
                <Icon name="ban" size={16} />
                {t('void')}
              </button>
              <button className="btn" onClick={() => setVoiding(null)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card table-card">
        {list && list.length === 0 ? (
          <EmptyState icon="inbox" text={t('list_empty')} />
        ) : (
          <div className="table-wrap">
            <table className="table" data-testid="vouchers-table">
              <thead>
                <tr>
                  <th>{t('col_number')}</th>
                  <th>{t('col_book')}</th>
                  <th>{t('col_debtor')}</th>
                  <th className="num">{t('col_amount')}</th>
                  <th>{t('col_issue')}</th>
                  <th>{t('col_due')}</th>
                  <th>{t('col_status')}</th>
                  <th>{t('col_printed')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {(list || []).map((v) => (
                  <tr key={v.id} className={v.status === 'cancelled' ? 'is-cancelled' : ''} data-testid={`row-${v.id}`}>
                    <td>
                      <span className="num-pill">
                        <Ltr>
                          {v.number_label} / {v.book_count}
                        </Ltr>
                      </span>
                    </td>
                    <td>{v.book_name}</td>
                    <td>
                      <b>{v.debtor_name}</b>
                      <div className="muted small">
                        <Ltr>{v.debtor_id_number}</Ltr>
                      </div>
                    </td>
                    <td dir="ltr" className="num">
                      <b>{formatMoney(v.amount)}</b>
                    </td>
                    <td>
                      <Ltr>{gregorianText(v.issue_date)}</Ltr>
                    </td>
                    <td>
                      <Ltr>{gregorianText(v.due_date)}</Ltr>
                    </td>
                    <td>
                      <span className={`badge ${v.status}`}>
                        {t(v.status === 'cancelled' ? 'status_cancelled' : 'status_active')}
                      </span>
                    </td>
                    <td className="muted">
                      {v.print_count} {t('times')}
                    </td>
                    <td>
                      <div className="row-actions">
                        <IconButton icon="print" title={t('print')} variant="primary" testId={`print-${v.id}`} onClick={() => run(() => api.vouchers.print(v.id, 'print'))} />
                        <IconButton icon="eye" title={t('preview')} testId={`preview-${v.id}`} onClick={() => run(() => api.vouchers.print(v.id, 'preview'))} />
                        <IconButton icon="pdf" title={t('pdf')} onClick={() => run(() => api.vouchers.print(v.id, 'pdf'))} />
                        {v.status !== 'cancelled' && (
                          <>
                            <IconButton icon="edit" title={t('edit')} testId={`edit-${v.id}`} onClick={() => onEdit(v.id)} />
                            <IconButton icon="ban" title={t('void')} variant="danger" testId={`void-${v.id}`} onClick={() => setVoiding(v)} />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {list && list.length > 0 ? (
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      {list.length} {t('inst_notes')}
                    </td>
                    <td dir="ltr" className="num">
                      <b data-testid="list-total">{formatMoney(total)}</b>
                    </td>
                    <td colSpan={5} className="muted small">
                      {t('total_active')}
                    </td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
