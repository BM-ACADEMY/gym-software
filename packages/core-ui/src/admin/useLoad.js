import { useCallback, useEffect, useRef, useState } from 'react';
// Loads data, keeps the last good data on screen while refreshing, and reports a plain error message.
export function useLoad(fn, deps, refreshMs) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const alive = useRef(true);
  const run = useCallback(async () => {
    try { const data = await fn(); if (alive.current) setState({ loading: false, error: '', data }); }
    catch (e) { if (alive.current) setState((s) => ({ loading: false, error: (e && e.response && e.response.data && e.response.data.message) || (e && e.message) || 'Could not load.', data: s.data })); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { alive.current = true; setState((s) => ({ ...s, loading: true })); run(); const t = refreshMs ? setInterval(run, refreshMs) : null; return () => { alive.current = false; if (t) clearInterval(t); }; }, [run, refreshMs]);
  return { ...state, reload: run };
}
