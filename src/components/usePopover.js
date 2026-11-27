import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Shared open/close behaviour for Select and DateInput: closes on outside click and Escape,
// and opens upwards when there is no room below.
export function usePopover() {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const root = useRef(null);
  const pop = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (root.current && !root.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !root.current || !pop.current) return;
    const r = root.current.getBoundingClientRect();
    const h = pop.current.offsetHeight;
    const below = window.innerHeight - r.bottom;
    setUp(below < h + 12 && r.top > below);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);
  return { open, setOpen, close, up, root, pop };
}
