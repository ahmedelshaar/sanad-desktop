import { useState } from 'react';
import { api } from '../api.js';
import { useI18n, errorText } from '../i18n.js';
import { TextField } from './VoucherForm.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, Ltr, Section, useToast } from '../components/ui.jsx';
import appIcon from '../../electron/assets/icon.png';

function useCheck(onState) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const state = await api.license.check();
      if (state.checkFailed) setError(t(state.checkFailed === 'offline' ? 'lic_offline' : 'lic_check_failed'));
      onState(state);
    } catch (err) {
      setError(errorText(t, err.message));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function Shell({ children }) {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-brand">
          <img src={appIcon} alt="" />
          <div>
            <b>{t('app_name')}</b>
            <small>
              {t('developed_by')} Eleva Pro Technology
            </small>
          </div>
          <button className="btn small ghost gate-lang" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
            <Icon name="globe" size={14} />
            {t('lang_toggle')}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** First run (or this copy moved to another PC): register with an email to start the trial. */
export function RegisterScreen({ license, onState }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ email: license.email || '', name: '', phone: '', company: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onState(await api.license.register(form));
    } catch (err) {
      setError(errorText(t, err.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <h1>{license.reason === 'device_changed' ? t('lic_moved_title') : t('lic_register_title')}</h1>
      <p className="muted">{license.reason === 'device_changed' ? t('lic_moved_body') : t('lic_register_body')}</p>
      <form className="form-grid gate-form" onSubmit={submit} noValidate>
        <TextField
          label={t('lic_email')}
          required
          type="email"
          dir="ltr"
          className="span-all"
          value={form.email}
          onChange={(v) => set({ email: v })}
          testId="lic-email"
          autoFocus
        />
        <TextField label={t('name')} className="span-2" value={form.name} onChange={(v) => set({ name: v })} testId="lic-name" />
        <TextField label={t('phone')} className="span-2" dir="ltr" value={form.phone} onChange={(v) => set({ phone: v })} testId="lic-phone" />
        <TextField
          label={t('lic_company')}
          className="span-all"
          value={form.company}
          onChange={(v) => set({ company: v })}
          testId="lic-company"
        />
        <p className="span-all field-hint gate-privacy">
          <Icon name="info" size={14} /> {t('lic_privacy')}
        </p>
        {error && (
          <div className="span-all">
            <Alert>{error}</Alert>
          </div>
        )}
        <div className="span-all actions">
          <button className="btn primary" type="submit" disabled={busy || !form.email.trim()} data-testid="lic-register">
            <Icon name="check" size={16} />
            {t('lic_register_action')}
          </button>
        </div>
      </form>
    </Shell>
  );
}

/** Trial over, blocked, suspended…: data stays, creating and printing are locked until activation. */
export function LockScreen({ license, onState }) {
  const { t } = useI18n();
  const toast = useToast();
  const check = useCheck(onState);
  const support = license.support || {};

  const backup = async () => {
    try {
      const file = await api.backup.create();
      if (file) toast.show(`${t('backup_done')} ${file}`);
    } catch (err) {
      toast.show(errorText(t, err.message), 'error');
    }
  };

  return (
    <Shell>
      <div className="gate-lock">
        <span className="gate-lock-icon">
          <Icon name="shield" size={28} />
        </span>
        <div>
          <h1 data-testid="lic-locked-title">{t(`lic_locked_${license.reason}`) === `lic_locked_${license.reason}` ? t('lic_locked_generic') : t(`lic_locked_${license.reason}`)}</h1>
          <p className="muted">{t('lic_locked_body')}</p>
        </div>
      </div>
      <dl className="gate-facts">
        <dt>{t('lic_email')}</dt>
        <dd>
          <Ltr>{license.email || '—'}</Ltr>
        </dd>
        <dt>{t('lic_device')}</dt>
        <dd>
          <Ltr>{license.deviceId || '—'}</Ltr>
        </dd>
        {support.email || support.website ? (
          <>
            <dt>{t('lic_contact')}</dt>
            <dd>
              <Ltr>{[support.email, support.website].filter(Boolean).join(' · ')}</Ltr>
            </dd>
          </>
        ) : null}
      </dl>
      {check.error && <Alert>{check.error}</Alert>}
      <div className="actions wrap">
        <button className="btn primary" onClick={check.run} disabled={check.busy} data-testid="lic-check">
          <Icon name="check" size={16} />
          {t('lic_check')}
        </button>
        <button className="btn" onClick={backup}>
          <Icon name="download" size={16} />
          {t('backup_now')}
        </button>
      </div>
    </Shell>
  );
}

/** A slim bar above the pages during the trial. */
export function TrialBanner({ license, onState }) {
  const { t } = useI18n();
  const check = useCheck(onState);
  if (license.state !== 'trial') return null;
  const urgent = license.daysLeft <= 3;
  return (
    <div className={`trial-bar ${urgent ? 'urgent' : ''}`} data-testid="trial-banner">
      <Icon name="calendar" size={16} />
      <span>
        {t('lic_trial_left').replace('{n}', license.daysLeft)} — {t('lic_trial_hint')}
      </span>
      <button className="btn small" onClick={check.run} disabled={check.busy} data-testid="trial-check">
        {t('lic_check')}
      </button>
    </div>
  );
}

/** Settings: what this copy is licensed for. */
export function LicenseSection({ license, onState }) {
  const { t } = useI18n();
  const check = useCheck(onState);
  if (!license || license.state === 'off') return null;
  const stateText =
    license.state === 'active'
      ? t('lic_state_active')
      : license.state === 'trial'
        ? t('lic_trial_left').replace('{n}', license.daysLeft)
        : t('lic_locked_generic');
  return (
    <Section icon="shield" title={t('lic_section')}>
      <dl className="gate-facts">
        <dt>{t('book_status')}</dt>
        <dd data-testid="lic-state">{stateText}</dd>
        {license.license && license.license.customer ? (
          <>
            <dt>{t('lic_customer')}</dt>
            <dd>{license.license.customer}</dd>
          </>
        ) : null}
        <dt>{t('lic_email')}</dt>
        <dd>
          <Ltr>{license.email || '—'}</Ltr>
        </dd>
        <dt>{t('lic_device')}</dt>
        <dd>
          <Ltr>{license.deviceId || '—'}</Ltr>
        </dd>
        <dt>{t('lic_fingerprint')}</dt>
        <dd>
          <Ltr>{license.fingerprint}</Ltr>
        </dd>
      </dl>
      {check.error && <Alert>{check.error}</Alert>}
      <button className="btn" onClick={check.run} disabled={check.busy}>
        <Icon name="check" size={16} />
        {t('lic_check')}
      </button>
    </Section>
  );
}
