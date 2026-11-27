import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { I18nContext, makeT } from './i18n.js';
import Books from './pages/Books.jsx';
import VoucherForm from './pages/VoucherForm.jsx';
import Vouchers from './pages/Vouchers.jsx';
import Settings from './pages/Settings.jsx';
import Installments from './pages/Installments.jsx';
import Icon from './components/Icon.jsx';
import { ToastProvider } from './components/ui.jsx';
import { LockScreen, RegisterScreen, TrialBanner } from './pages/License.jsx';
import appIcon from '../electron/assets/icon.png';

const NAV = [
  ['new', 'nav_new', 'note'],
  ['installments', 'nav_installments', 'layers'],
  ['list', 'nav_vouchers', 'list'],
  ['books', 'nav_books', 'book'],
  ['settings', 'nav_settings', 'settings'],
];

export default function App() {
  const [settings, setSettings] = useState(null);
  const [page, setPage] = useState({ name: 'new' });
  const [formKey, setFormKey] = useState(0);
  const [version, setVersion] = useState('');
  const [license, setLicense] = useState(null);

  useEffect(() => {
    api.license
      .status()
      .then(setLicense)
      .catch(() => setLicense({ state: 'off', usable: true }));
    return api.onLicenseChanged((state) => setLicense((old) => ({ ...(old || {}), ...state })));
  }, []);

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

  if (!settings || !license) return null;

  const gate =
    license.state === 'unregistered' ? (
      <RegisterScreen license={license} onState={setLicense} />
    ) : license.state === 'locked' ? (
      <LockScreen license={license} onState={setLicense} />
    ) : null;

  if (gate) {
    return (
      <I18nContext.Provider value={{ lang, t, setLang }}>
        <ToastProvider>{gate}</ToastProvider>
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>
      <ToastProvider>
        <div className="app">
          <aside className="sidebar">
            <div className="brand">
              <img src={appIcon} alt="" />
              <div>
                <b>{t('app_name')}</b>
                <small>Sanad</small>
              </div>
            </div>
            <nav aria-label={t('app_name')}>
              {NAV.map(([name, key, icon]) => {
                const active = page.name === name || (name === 'new' && page.name === 'edit');
                return (
                  <button
                    key={name}
                    className={`nav-item ${active ? 'active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    data-testid={`nav-${name}`}
                    onClick={() => go(name)}
                  >
                    <Icon name={icon} size={18} />
                    {t(key)}
                  </button>
                );
              })}
            </nav>
            <button className="lang" data-testid="lang-toggle" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
              <Icon name="globe" size={16} />
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
            <TrialBanner license={license} onState={setLicense} />
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
              <Books
                onNewVoucher={() => go('new')}
                onNewInstallments={() => go('installments')}
                onOpenBook={(bookId) => go('list', { bookId })}
              />
            )}
            {page.name === 'settings' && (
              <Settings settings={settings} onSaved={setSettings} license={license} onLicense={setLicense} />
            )}
          </main>
        </div>
      </ToastProvider>
    </I18nContext.Provider>
  );
}
