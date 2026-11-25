import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { I18nContext, makeT } from './i18n.js';
import Books from './pages/Books.jsx';
import VoucherForm from './pages/VoucherForm.jsx';
import Vouchers from './pages/Vouchers.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const [settings, setSettings] = useState(null);
  const [page, setPage] = useState({ name: 'new' });
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    api.settings.get().then(setSettings);
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
    ['list', 'nav_vouchers'],
    ['books', 'nav_books'],
    ['settings', 'nav_settings'],
  ];

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">{t('app_name')}</div>
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
        </aside>

        <main className="content">
          {page.name === 'new' && <VoucherForm key={`new-${formKey}`} settings={settings} onNew={() => go('new')} />}
          {page.name === 'edit' && (
            <VoucherForm key={`edit-${page.id}`} id={page.id} settings={settings} onNew={() => go('new')} />
          )}
          {page.name === 'list' && <Vouchers onEdit={(id) => go('edit', { id })} />}
          {page.name === 'books' && <Books onNewVoucher={() => go('new')} />}
          {page.name === 'settings' && <Settings settings={settings} onSaved={setSettings} />}
        </main>
      </div>
    </I18nContext.Provider>
  );
}
