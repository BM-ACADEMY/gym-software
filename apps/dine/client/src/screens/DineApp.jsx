import { useEffect, useState } from 'react';
import { makeT, hasDraft } from './strings.js';
import { S } from './ui.js';
import Tables from './Tables.jsx';
import OrderScreen from './OrderScreen.jsx';
import Kitchen from './Kitchen.jsx';
import BillScreen from './BillScreen.jsx';
import { Credit, Returns } from './CreditReturns.jsx';

// The staff screens of Dine, shown as tabs next to the manifest-driven owner panel (main.jsx renders this and the panel together).
// Which tab a login may really use is decided by the server (it answers "Not allowed for your role" and the screen shows that).
export default function DineApp({ api, lang, panel }) {
  const t = makeT(lang);
  const [tab, setTab] = useState('tables'); const [orderId, setOrderId] = useState(null); const [billId, setBillId] = useState(null); const [pub, setPub] = useState(false);
  useEffect(() => { api.get('/settings').then((r) => setPub(!!(r.data && r.data.pubMode))).catch(() => { /* a role without access simply sees no pub items */ }); }, [api]);
  const tabs = [['tables', 'tabs_tables'], ['kitchen', 'tabs_kitchen'], ['bill', 'tabs_bill'], ['credit', 'tabs_credit'], ['returns', 'tabs_returns'], ['panel', 'tabs_panel']];
  const toOrder = (id) => { setOrderId(id); setTab('tables'); };
  const toBill = (id) => { setBillId(id); setTab('bill'); };
  return (
    <div>
      <nav style={{ display: 'flex', gap: 6, padding: 8, overflowX: 'auto', background: '#fff7ed', position: 'sticky', top: 0, zIndex: 2 }} aria-label="Dine">
        {tabs.map(([k, label]) => <button key={k} type="button" aria-current={tab === k ? 'page' : undefined} style={{ ...S.big, flex: '0 0 auto', background: tab === k ? '#fde68a' : '#fff', fontWeight: tab === k ? 700 : 400 }} onClick={() => setTab(k)}>{t(label)}</button>)}
      </nav>
      {hasDraft(lang) && <p style={{ margin: 0, padding: '4px 12px', background: '#fff4e5', fontSize: 12 }}>{t('draft_ta')}</p>}
      {tab === 'tables' && (orderId ? <OrderScreen api={api} t={t} orderId={orderId} onBack={() => setOrderId(null)} onBill={toBill} /> : <Tables api={api} t={t} pub={pub} onOpenOrder={toOrder} />)}
      {tab === 'kitchen' && <Kitchen api={api} t={t} />}
      {tab === 'bill' && (billId ? <BillScreen api={api} t={t} orderId={billId} onBack={() => toOrder(billId)} onDone={() => { setBillId(null); setOrderId(null); setTab('tables'); }} /> : <div style={S.page}><p>{t('pick_order')}</p></div>)}
      {tab === 'credit' && <Credit api={api} t={t} />}
      {tab === 'returns' && <Returns api={api} t={t} />}
      {tab === 'panel' && panel}
    </div>
  );
}
