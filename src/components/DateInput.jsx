import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { usePopover } from './usePopover.js';
import { useI18n } from '../i18n.js';
import { todayIso } from '../lib/format.js';
import {
  MONTHS,
  WEEKDAYS,
  addDays,
  displayDate,
  hijriMonthSpan,
  monthGrid,
  parseTypedDate,
  partsOf,
  shiftMonth,
} from '../lib/calendar.js';

const WEEK_START = 0; // Sunday, as in Saudi Arabia

/**
 * Date field: type dd/mm/yyyy (Arabic digits OK) or pick from a calendar that also shows the
 * Hijri day of every date. Value is ISO "YYYY-MM-DD" or ''.
 * Calendar keys: arrows move a day/week (mirrored in RTL), PageUp/PageDown change month,
 * Shift+PageUp/PageDown change year, Home/End go to week start/end, Enter picks, Escape closes.
 */
export default function DateInput({ value, onChange, label, allowClear = false, testId }) {
  const { t, lang } = useI18n();
  const { open, setOpen, close, up, root, pop } = usePopover();
  const [text, setText] = useState(displayDate(value));
  const [focusIso, setFocusIso] = useState(value || todayIso());
  const input = useRef(null);
  const grid = useRef(null);
  const today = todayIso();
  const rtl = lang === 'ar';

  useEffect(() => setText(displayDate(value)), [value]);

  useEffect(() => {
    if (open) setFocusIso(value || todayIso());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep keyboard focus on the focused day while the calendar is open
  useEffect(() => {
    if (!open || !grid.current) return;
    const el = grid.current.querySelector(`[data-iso="${focusIso}"]`);
    if (el && document.activeElement !== input.current) el.focus();
  }, [open, focusIso]);

  const commitText = () => {
    if (!text.trim()) {
      if (allowClear) onChange('');
      else setText(displayDate(value));
      return;
    }
    const iso = parseTypedDate(text);
    if (iso) {
      if (iso !== value) onChange(iso);
      setText(displayDate(iso));
    } else {
      setText(displayDate(value));
    }
  };

  const pick = (iso) => {
    onChange(iso);
    close();
    input.current && input.current.focus();
  };

  const onGridKey = (e) => {
    const step = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) {
      e.preventDefault();
      setFocusIso((f) => addDays(f, step));
      return;
    }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const n = (e.key === 'PageUp' ? -1 : 1) * (e.shiftKey ? 12 : 1);
      setFocusIso((f) => shiftMonth(f, n));
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setFocusIso((f) => {
        const dow = new Date(`${f}T12:00:00Z`).getUTCDay();
        const fromStart = (dow - WEEK_START + 7) % 7;
        return addDays(f, e.key === 'Home' ? -fromStart : 6 - fromStart);
      });
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(focusIso);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      input.current && input.current.focus();
    }
  };

  const fp = partsOf(focusIso);
  const cells = monthGrid(fp.y, fp.m0, WEEK_START);
  const names = WEEKDAYS[lang] || WEEKDAYS.ar;
  const weekdays = Array.from({ length: 7 }, (_, i) => names[(WEEK_START + i) % 7]);
  const months = MONTHS[lang] || MONTHS.ar;

  const navBtn = (icon, n, title) => (
    <button
      type="button"
      className="cal-nav"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setFocusIso((f) => shiftMonth(f, n))}
    >
      <Icon name={icon} size={16} />
    </button>
  );

  return (
    <div className={`date ${open ? 'is-open' : ''}`} ref={root}>
      <div className="field-box date-box">
        <input
          ref={input}
          value={text}
          dir="ltr"
          inputMode="numeric"
          placeholder="dd/mm/yyyy"
          aria-label={label}
          data-testid={testId}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitText();
              close();
            } else if (e.key === 'ArrowDown' && (e.altKey || !open)) {
              e.preventDefault();
              setOpen(true);
              setTimeout(() => {
                const el = grid.current && grid.current.querySelector('[tabindex="0"]');
                el && el.focus();
              });
            } else if (e.key === 'Escape') {
              close();
            }
          }}
        />
        <button
          type="button"
          className="date-btn"
          aria-label={t('open_calendar')}
          title={t('open_calendar')}
          onClick={() => setOpen(!open)}
        >
          <Icon name="calendar" size={18} />
        </button>
      </div>

      {open && (
        <div ref={pop} className={`popover cal ${up ? 'up' : ''}`} role="dialog" aria-label={label}>
          <div className="cal-head">
            {navBtn(rtl ? 'chevronsRight' : 'chevronsLeft', -12, t('prev_year'))}
            {navBtn(rtl ? 'chevronRight' : 'chevronLeft', -1, t('prev_month'))}
            <div className="cal-title">
              <b>
                {months[fp.m0]} {fp.y}
              </b>
              <small>{hijriMonthSpan(fp.y, fp.m0)}</small>
            </div>
            {navBtn(rtl ? 'chevronLeft' : 'chevronRight', 1, t('next_month'))}
            {navBtn(rtl ? 'chevronsLeft' : 'chevronsRight', 12, t('next_year'))}
          </div>

          <div className="cal-grid" ref={grid} role="grid" onKeyDown={onGridKey}>
            {weekdays.map((w) => (
              <div key={w} className="cal-wd" role="columnheader">
                {w}
              </div>
            ))}
            {cells.map((c) => (
              <button
                key={c.iso}
                type="button"
                role="gridcell"
                data-iso={c.iso}
                tabIndex={c.iso === focusIso ? 0 : -1}
                aria-selected={c.iso === value}
                aria-label={displayDate(c.iso)}
                className={[
                  'cal-day',
                  c.inMonth ? '' : 'out',
                  c.iso === value ? 'selected' : '',
                  c.iso === today ? 'today' : '',
                  c.iso === focusIso ? 'focus' : '',
                ].join(' ')}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c.iso)}
              >
                <span>{c.day}</span>
                <small>{c.hijriDay}</small>
              </button>
            ))}
          </div>

          <div className="cal-foot">
            <button type="button" className="btn small" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(today)}>
              {t('today')}
            </button>
            {allowClear && value ? (
              <button
                type="button"
                className="btn small ghost"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange('');
                  close();
                }}
              >
                {t('clear')}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
