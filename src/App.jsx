import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { I18nContext, makeT } from './i18n.js';
import Books from './pages/Books.jsx';
import VoucherForm from './pages/VoucherForm.jsx';
import Vouchers from './pages/Vouchers.jsx';
import Settings from './pages/Settings.jsx';
import Installments from './pages/Installments.jsx';
import appIcon from '../electron/assets/icon.png';

export default function App() {
  const [settings, setSettings] = useState(null);
  const [page, setPage] = useState({ name: 'new' });
  const [formKey, setFormKey] = useState(0);
  const [version, setVersion] = useState('');

  useEffect(() => {
    api.settings.get().then(setSettings);
    api.app
      .info()
      .then((i) => setVersion(i.version))
      .catch(() => {});
  }, []);

  const lang = settings?.ui_lang === 'en' ? 'en' : 'ar';
  const t = useMemo(() => makeT(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const setLang = useCallback(async (l) => {
    setSettings(await api.settings.save({ ui_lang: l }));
  }, []);

  const go = (name, extra = {}) => {
    if (name === 'new') setFormKey((k) => k + 1);
    setPage({ name, ...extra });
  };

  if (!settings) return null;

  const nav = [
    ['new', 'nav_new'],
    ['installments', 'nav_installments'],
    ['list', 'nav_vouchers'],
    ['books', 'nav_books'],
    ['settings', 'nav_settings'],
  ];

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <img src={appIcon} alt="" />
            {t('app_name')}
          </div>
          <nav>
            {nav.map(([name, key]) => (
              <button
                key={name}
                className={`nav-item ${page.name === name || (name === 'new' && page.name === 'edit') ? 'active' : ''}`}
                onClick={() => go(name)}
              >
                {t(key)}
              </button>
            ))}
          </nav>
          <button className="lang" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
            {t('lang_toggle')}
          </button>
          <button className="credit" onClick={() => api.app.openSite()} title="eleva-protech.com">
            <span className="credit-by">{t('developed_by')}</span>
            <span className="credit-name">
              Eleva <b>Pro Technology</b>
            </span>
            <span className="credit-link">eleva-protech.com</span>
            {version ? (
              <span className="credit-version">
                {t('version')} {version}
              </span>
            ) : null}
          </button>
        </aside>

        <main className="content">
          {page.name === 'new' && <VoucherForm key={`new-${formKey}`} settings={settings} onNew={() => go('new')} />}
          {page.name === 'edit' && (
            <VoucherForm key={`edit-${page.id}`} id={page.id} settings={settings} onNew={() => go('new')} />
          )}
          {page.name === 'installments' && (
            <Installments settings={settings} onOpenBook={(bookId) => go('list', { bookId })} />
          )}
          {page.name === 'list' && (
            <Vouchers key={`list-${page.bookId || ''}`} bookId={page.bookId} onEdit={(id) => go('edit', { id })} />
          )}
          {page.name === 'books' && (
            <Books onNewVoucher={() => go('new')} onOpenBook={(bookId) => go('list', { bookId })} />
          )}
          {page.name === 'settings' && <Settings settings={settings} onSaved={setSettings} />}
        </main>
      </div>
    </I18nContext.Provider>
  );
}
