import { useEffect, useMemo, useState } from 'react';
import { expandNav, validateManifest, visibleNav } from './schema.js';
import ResourceScreen from './ResourceScreen.jsx';
import StatsScreen from './StatsScreen.jsx';
import SettingsScreen from './SettingsScreen.jsx';
import './admin.css';

// The whole panel comes from a manifest (data). `custom` screens are passed in by the product: screens={ key: Component }.
export default function AdminShell({ manifest, api, role = 'admin', screens = {} }) {
  const m = useMemo(() => { try { return { ok: validateManifest(manifest) }; } catch (e) { return { error: e.message }; } }, [manifest]);
  const [navData, setNavData] = useState({});
  const [key, setKey] = useState(() => (typeof location !== 'undefined' && location.hash.slice(1)) || '');
  useEffect(() => { const h = () => setKey(location.hash.slice(1)); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  useEffect(() => { // data sources that build the menu itself (for example one page per product)
    if (!m.ok || !manifest.navData) return;
    let live = true;
    Promise.all(Object.entries(manifest.navData).map(([name, ep]) => api.get(ep).then((r) => [name, r.data]).catch(() => [name, null])))
      .then((pairs) => { if (live) setNavData(Object.fromEntries(pairs)); });
    return () => { live = false; };
  }, [m, manifest, api]);

  if (m.error) return <p role="alert" className="adm-error">This panel is set up wrongly: {m.error}</p>;
  const nav = visibleNav({ nav: expandNav(manifest, navData) }, role);
  const current = nav.find((n) => n.key === key) || nav[0];
  const render = () => {
    if (!current) return <p className="adm-note">Nothing available for your role.</p>;
    if (current.screen === 'resource') return <ResourceScreen key={current.key} def={manifest.resources[current.resource]} api={api} title={current.label} />;
    if (current.screen === 'stats') return <StatsScreen key={current.key} def={manifest.stats[current.stats]} api={api} params={current.params} title={current.label} />;
    if (current.screen === 'settings') return <SettingsScreen key={current.key} def={manifest.settings[current.settings]} api={api} title={current.label} />;
    const Custom = screens[current.key]; return Custom ? <Custom api={api} /> : <p className="adm-note">This screen is not available yet.</p>;
  };
  return (
    <div className="adm-shell">
      <nav aria-label={manifest.title}>
        <div className="adm-brand">{manifest.title}</div>
        <ul>{nav.map((n) => <li key={n.key}><a href={`#${n.key}`} aria-current={current && current.key === n.key ? 'page' : undefined}>{n.label}</a></li>)}</ul>
      </nav>
      <main>{render()}</main>
    </div>
  );
}
