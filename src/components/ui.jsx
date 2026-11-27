import { createContext, useCallback, useContext, useState } from 'react';
import Icon from './Icon.jsx';

// Keeps numbers and dates in their left-to-right order inside Arabic text ("03 / 60", "17 / 06 / 1448").
export function Ltr({ children }) {
  return <bdi dir="ltr">{children}</bdi>;
}

// ---------- layout pieces ----------

export function PageHeader({ icon, title, subtitle, children }) {
  return (
    <header className="page-head">
      <div className="page-title">
        {icon ? (
          <span className="page-icon">
            <Icon name={icon} size={22} />
          </span>
        ) : null}
        <div>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {children ? <div className="page-actions">{children}</div> : null}
    </header>
  );
}

export function Section({ icon, title, children, className = '', aside }) {
  return (
    <section className={`card ${className}`}>
      {title ? (
        <div className="section-head">
          <h2>
            {icon ? (
              <span className="section-icon">
                <Icon name={icon} size={16} />
              </span>
            ) : null}
            {title}
          </h2>
          {aside}
        </div>
      ) : null}
      {children}
    </section>
  );
}

// Wrapper for custom controls (Select, DateInput, Switch). A <div>, not a <label>, so clicks
// inside their popovers are not re-sent to the control.
export function Field({ label, hint, required, className = '', children }) {
  return (
    <div className={`field ${className}`}>
      {label ? (
        <span className="field-label">
          {label}
          {required ? <i className="req">*</i> : null}
        </span>
      ) : null}
      {children}
      {hint ? <small className="field-hint">{hint}</small> : null}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', text, children }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <p>{text}</p>
      {children}
    </div>
  );
}

export function Alert({ type = 'error', children }) {
  return (
    <div className={`alert ${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon name={type === 'error' ? 'alert' : 'info'} size={18} />
      <span>{children}</span>
    </div>
  );
}

export function IconButton({ icon, title, onClick, variant = '', disabled, testId }) {
  return (
    <button
      type="button"
      className={`icon-btn ${variant}`}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

// ---------- toasts ----------

const ToastContext = createContext({ show: () => {} });

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const show = useCallback((text, type = 'success') => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list, { id, text, type }]);
    setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((x) => (
          <div key={x.id} className={`toast ${x.type}`}>
            <Icon name={x.type === 'error' ? 'alert' : 'check'} size={18} />
            <span>{x.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
