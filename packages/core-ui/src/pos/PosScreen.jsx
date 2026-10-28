import { useEffect, useMemo, useRef, useState } from 'react';
import { createQueue } from './offlineQueue';

// Billing screen shared by every shop product. The app passes in:
//   api      an axios-like client ({ get, post }) already signed in
//   rules    { compute, settle } from '@afra/core-pos/pure (so totals match the server exactly and work offline)
//   basePath where the server router is mounted, e.g. '/pos'
// Items are cached on the device so billing keeps working without a network.
const METHODS = [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card'], ['credit', 'Pay later']];
const ITEMS_KEY = 'pos:items';
const rs = (n) => `Rs ${Number(n || 0).toLocaleString('en-IN')}`;
const safeStorage = () => { try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => {} }; } };

const PosScreen = ({ api, rules, basePath = '/pos', defaultTaxMode = 'none', gstMode = 'cgst_sgst' }) => {
  const storage = useMemo(safeStorage, []);
  const queue = useMemo(() => createQueue(storage), [storage]);
  const [items, setItems] = useState(() => { try { return JSON.parse(storage.getItem(ITEMS_KEY) || '[]'); } catch { return []; } });
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [taxMode, setTaxMode] = useState(defaultTaxMode);
  const [discountPct, setDiscountPct] = useState('');
  const [customer, setCustomer] = useState(null);
  const [phone, setPhone] = useState('');
  const [pay, setPay] = useState({ cash: '', upi: '', card: '', credit: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [queued, setQueued] = useState(queue.pending().length);
  const [rejected, setRejected] = useState(queue.rejected());
  const searchRef = useRef(null);

  const refreshQueue = () => { setQueued(queue.pending().length); setRejected(queue.rejected()); };
  const send = async (bill) => {
    try { await api.post(`${basePath}/bills`, bill); }
    catch (e) { const err = new Error(e.response?.data?.message || e.message); err.status = e.response?.status; throw err; }
  };
  const sync = async () => { const r = await queue.flush(send); refreshQueue(); if (r.sent) setMsg(`${r.sent} saved bill(s) sent.`); };

  useEffect(() => {
    api.get(`${basePath}/items`).then((r) => { setItems(r.data.data); try { storage.setItem(ITEMS_KEY, JSON.stringify(r.data.data)); } catch { /* storage full: keep going */ } }).catch(() => {});
    const on = () => { setOnline(true); sync(); }; const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    sync();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q) || i.barcode === search.trim() || (i.sku || '').toLowerCase() === q).slice(0, 12) : items.slice(0, 12);
  }, [items, search]);

  const add = (item) => { setCart((c) => { const i = c.findIndex((l) => l.itemId === item._id); if (i >= 0) return c.map((l, k) => (k === i ? { ...l, qty: l.qty + 1 } : l)); return [...c, { itemId: item._id, name: item.name, unitPrice: item.price, gstRate: item.gstRate, qty: 1 }]; }); setSearch(''); searchRef.current?.focus(); };
  const onSearchKey = (e) => { if (e.key === 'Enter') { const hit = items.find((i) => i.barcode === search.trim()); if (hit) { e.preventDefault(); add(hit); } } }; // a barcode scanner types the code then presses Enter
  const setQty = (idx, q) => setCart((c) => (q <= 0 ? c.filter((_, k) => k !== idx) : c.map((l, k) => (k === idx ? { ...l, qty: q } : l))));

  const billDiscount = Number(discountPct) > 0 ? { type: 'percent', value: Number(discountPct) } : undefined;
  const calc = useMemo(() => { try { return cart.length ? rules.compute({ lines: cart, billDiscount, taxMode, gstMode }) : null; } catch { return null; } }, [cart, billDiscount?.value, taxMode, gstMode, rules]); // eslint-disable-line react-hooks/exhaustive-deps
  const payments = METHODS.map(([m]) => ({ method: m, amount: Number(pay[m]) || 0 })).filter((p) => p.amount > 0);
  const settled = useMemo(() => { try { return calc ? rules.settle(calc.total, payments) : null; } catch (e) { return { error: e.message }; } }, [calc, pay]); // eslint-disable-line react-hooks/exhaustive-deps

  const findCustomer = async () => {
    setMsg('');
    try { const r = await api.get(`${basePath}/customers`, { params: { q: phone.trim() } }); const c = r.data.data[0]; if (c) setCustomer(c); else setMsg('No customer with that number. Add one below.'); }
    catch { setMsg('Could not look up customers. You can still bill without one.'); }
  };
  const addCustomer = async () => {
    const name = window.prompt('Customer name');
    if (!name) return;
    try { const r = await api.post(`${basePath}/customers`, { name, phone: phone.trim() || undefined }); setCustomer(r.data.data); } catch (e) { setMsg(e.response?.data?.message || 'Could not add the customer.'); }
  };
  const fillFull = (m) => setPay({ cash: '', upi: '', card: '', credit: '', [m]: String(calc?.total || '') });

  const submit = async () => {
    if (!calc || !settled || settled.error) return;
    setBusy(true); setMsg('');
    const bill = { customerId: customer?._id, lines: cart.map(({ itemId, qty, name, unitPrice, gstRate }) => ({ itemId, qty, name, unitPrice, gstRate })), billDiscount, taxMode, gstMode, payments };
    const entry = queue.add(bill); // saved on the device first, so a dropped network can never lose a bill
    try {
      await send(entry); queue.remove(entry.clientId);
      setMsg(`Bill saved. Total ${rs(calc.total)}${settled.change ? `, give back ${rs(settled.change)}` : ''}.`);
    } catch (e) {
      if (e.status && e.status >= 400 && e.status < 500) { queue.remove(entry.clientId); setMsg(e.message); }
      else setMsg('No network. The bill is saved on this device and will be sent when you are back online.');
    }
    setCart([]); setPay({ cash: '', upi: '', card: '', credit: '' }); setDiscountPct(''); setCustomer(null); setPhone('');
    refreshQueue(); setBusy(false);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <span className={`text-xs px-2 py-1 rounded-full ${online ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{online ? 'Online' : 'Offline: bills are saved on this device'}</span>
        </div>
        {queued > 0 && <p className="text-sm text-amber-700">{queued} bill(s) waiting to be sent. <button type="button" onClick={sync} className="underline">Send now</button></p>}
        {rejected.length > 0 && (
          <div className="text-sm bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
            <p className="font-semibold text-red-700">{rejected.length} saved bill(s) were refused and need your attention:</p>
            {rejected.map((b) => <p key={b.clientId}>{b.reason} <button type="button" onClick={() => { queue.dismiss(b.clientId); refreshQueue(); }} className="underline">Dismiss</button></p>)}
          </div>
        )}
        <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey} placeholder="Search item or scan barcode" className="w-full border border-gray-300 rounded-lg px-3 py-2" aria-label="Search item or scan barcode" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {shown.map((i) => (
            <button type="button" key={i._id} onClick={() => add(i)} className="text-left border border-gray-200 rounded-lg p-2 bg-white hover:border-teal-500">
              <p className="text-sm font-medium truncate">{i.name}</p><p className="text-xs text-gray-500">{rs(i.price)}{i.trackStock ? ` · ${i.qty} left` : ''}</p>
            </button>
          ))}
          {shown.length === 0 && <p className="text-sm text-gray-500 col-span-full">No items found.</p>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        {cart.length === 0 && <p className="text-sm text-gray-500">Tap an item to start a bill.</p>}
        {cart.map((l, idx) => (
          <div key={l.itemId || idx} className="flex items-center justify-between text-sm">
            <span className="flex-1 truncate">{l.name}</span>
            <span className="flex items-center gap-2">
              <button type="button" aria-label={`less ${l.name}`} onClick={() => setQty(idx, l.qty - 1)} className="w-7 h-7 border rounded">-</button>
              <span>{l.qty}</span>
              <button type="button" aria-label={`more ${l.name}`} onClick={() => setQty(idx, l.qty + 1)} className="w-7 h-7 border rounded">+</button>
              <span className="w-20 text-right">{rs(l.unitPrice * l.qty)}</span>
            </span>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="space-y-1"><span className="text-gray-600">Tax</span>
            <select value={taxMode} onChange={(e) => setTaxMode(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-2">
              <option value="none">Plain bill (no GST)</option><option value="gst_inclusive">GST included in price</option><option value="gst_exclusive">GST added on top</option></select></label>
          <label className="space-y-1"><span className="text-gray-600">Discount %</span>
            <input type="number" min="0" max="100" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-2" /></label>
        </div>
        <div className="flex gap-2 text-sm">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Customer phone (optional)" className="flex-1 border border-gray-300 rounded-lg px-3 py-2" inputMode="tel" />
          <button type="button" onClick={findCustomer} className="px-3 border rounded-lg">Find</button>
          <button type="button" onClick={addCustomer} className="px-3 border rounded-lg">Add</button>
        </div>
        {customer && <p className="text-sm text-teal-700">Customer: {customer.name}</p>}
        {calc && (
          <div className="text-sm space-y-1 border-t pt-3">
            <p className="flex justify-between"><span>Discount</span><span>- {rs(calc.discount)}</span></p>
            {calc.gst > 0 && <p className="flex justify-between"><span>GST {calc.igst ? '(IGST)' : '(CGST + SGST)'}</span><span>{rs(calc.gst)}</span></p>}
            <p className="flex justify-between text-lg font-bold"><span>Total</span><span>{rs(calc.total)}</span></p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {METHODS.map(([m, label]) => (
                <label key={m} className="space-y-1"><span className="text-gray-600 flex justify-between">{label}<button type="button" onClick={() => fillFull(m)} className="text-teal-700 text-xs">Full</button></span>
                  <input type="number" min="0" value={pay[m]} onChange={(e) => setPay((p) => ({ ...p, [m]: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-2 py-2" /></label>
              ))}
            </div>
            {settled?.error && <p className="text-red-600">{settled.error}</p>}
            {settled && !settled.error && <p className="text-gray-600">{settled.status === 'paid' ? (settled.change ? `Give back ${rs(settled.change)}` : 'Paid in full') : settled.status === 'credit' ? 'Pay later' : `Still to pay ${rs(settled.due)}`}</p>}
          </div>
        )}
        {msg && <p className="text-sm text-gray-700">{msg}</p>}
        <button type="button" onClick={submit} disabled={busy || !calc || !settled || !!settled.error} className="w-full py-3 rounded-lg bg-teal-600 text-white font-semibold disabled:opacity-40">{busy ? 'Saving...' : 'Save bill'}</button>
      </div>
    </div>
  );
};

export default PosScreen;
