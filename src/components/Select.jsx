import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { usePopover } from './usePopover.js';

/**
 * Custom select (combobox + listbox) with keyboard support:
 * Arrow keys, Home/End, Enter/Space to choose, Escape to close, type a letter to jump.
 * options: [{ value, label, hint? }]
 */
export default function Select({ value, onChange, options, placeholder = '', disabled, label, className = '', testId }) {
  const { open, setOpen, close, up, root, pop } = usePopover();
  const [active, setActive] = useState(0);
  const listId = useId();
  const button = useRef(null);
  const typed = useRef({ text: '', at: 0 });

  const index = options.findIndex((o) => String(o.value) === String(value));
  const current = index >= 0 ? options[index] : null;

  useEffect(() => {
    if (open) setActive(index >= 0 ? index : 0);
  }, [open, index]);

  useEffect(() => {
    if (!open || !pop.current) return;
    const el = pop.current.querySelector(`[data-index="${active}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [open, active, pop]);

  const choose = (i) => {
    const o = options[i];
    if (!o) return;
    onChange(o.value);
    close();
    button.current && button.current.focus();
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true);
        else setActive((a) => Math.min(last, a + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) setOpen(true);
        else setActive((a) => Math.max(0, a - 1));
        break;
      case 'Home':
        if (open) {
          e.preventDefault();
          setActive(0);
        }
        break;
      case 'End':
        if (open) {
          e.preventDefault();
          setActive(last);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open) choose(active);
        else setOpen(true);
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case 'Tab':
        close();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          const now = Date.now();
          const t = now - typed.current.at < 700 ? typed.current.text + e.key : e.key;
          typed.current = { text: t, at: now };
          const from = open ? active : index;
          const n = options.length;
          for (let k = 1; k <= n; k++) {
            const i = (from + k) % n;
            if (String(options[i].label).toLowerCase().startsWith(t.toLowerCase())) {
              if (open) setActive(i);
              else onChange(options[i].value);
              break;
            }
          }
        }
    }
  };

  return (
    <div className={`sel ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`} ref={root}>
      <button
        type="button"
        ref={button}
        className="field-box sel-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        disabled={disabled}
        data-testid={testId}
        onClick={() => setOpen(!open)}
        onKeyDown={onKeyDown}
      >
        <span className={current ? 'sel-value' : 'sel-placeholder'}>{current ? current.label : placeholder}</span>
        <Icon name="chevronDown" size={16} className="sel-chevron" />
      </button>
      {open && (
        <ul id={listId} ref={pop} className={`popover sel-list ${up ? 'up' : ''}`} role="listbox" aria-label={label}>
          {options.map((o, i) => (
            <li
              key={String(o.value)}
              data-index={i}
              role="option"
              aria-selected={i === index}
              className={`${i === active ? 'active' : ''} ${i === index ? 'selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(i);
              }}
            >
              <span className="sel-option-label">
                <bdi>{o.label}</bdi>
                {o.hint ? (
                  <small>
                    <bdi dir="ltr">{o.hint}</bdi>
                  </small>
                ) : null}
              </span>
              {i === index ? <Icon name="check" size={16} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
