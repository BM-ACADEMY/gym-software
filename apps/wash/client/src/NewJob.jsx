import { useEffect, useState } from 'react';
import S from './strings.js';
import { Card, Err, Field, Note, btn, colors, input, useAction } from './ui.jsx';

const T = S.job;
const normalize = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// New job by number plate: find the vehicle, show the monthly pass balance, pick the class and extras, optional discount with a reason.
// The server prices the job from the owner's list and enforces the owner's discount limit; its message is shown as it is.
export default function NewJob({ api, onCreated }) {
  const [run, busy, err] = useAction();
  const [plate, setPlate] = useState(''); const [vehicle, setVehicle] = useState(undefined); // undefined: not looked up, null: not found
  const [pass, setPass] = useState(null); const [prices, setPrices] = useState(null);
  const [klass, setKlass] = useState(''); const [addons, setAddons] = useState([]);
  const [veh, setVeh] = useState({ owner: '', phone: '' });
  const [disc, setDisc] = useState(false); const [dtype, setDtype] = useState('amount'); const [dvalue, setDvalue] = useState(''); const [dreason, setDreason] = useState('');
  const [done, setDone] = useState('');
  useEffect(() => { run(async () => { setPrices((await api.get('/price-list')).data); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const find = () => run(async () => {
    setDone(''); const p = normalize(plate); setPlate(p);
    const v = ((await api.get('/vehicles', { q: p })).data || []).find((x) => x.plate === p) || null;
    setVehicle(v); setKlass(v ? v.klass : '');
    const ps = ((await api.get('/passes', { plate: p })).data || []).find((x) => x.status && x.status.usable) || null;
    setPass(ps);
  });
  const saveVehicle = () => run(async () => {
    await api.post('/vehicles', { plate: normalize(plate), klass, ownerName: veh.owner, ownerPhone: veh.phone });
    await find();
  });
  const create = () => run(async () => {
    const body = { plate: normalize(plate), klass, addons };
    if (disc && dvalue) { body.discount = { type: dtype, value: Number(dvalue) }; body.discountReason = dreason; }
    await api.post('/jobs', body);
    setDone(T.created); setPlate(''); setVehicle(undefined); setPass(null); setKlass(''); setAddons([]); setDisc(false); setDvalue(''); setDreason('');
    if (onCreated) onCreated();
  });
  const classes = prices ? Object.keys(prices.prices || {}) : [];
  const addonKeys = prices ? Object.keys(prices.addons || {}) : [];
  const price = prices && klass ? (prices.prices[klass] || 0) + addons.reduce((s, k) => s + (prices.addons[k] || 0), 0) : 0;
  const ready = !!vehicle && !!klass;
  return (
    <div style={{ padding: 12 }}>
      <Field label={T.plate}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={plate} onChange={(e) => { setPlate(e.target.value.toUpperCase()); setVehicle(undefined); }} style={input} autoCapitalize="characters" autoComplete="off" />
          <button type="button" disabled={busy || normalize(plate).length < 4} style={btn(true)} onClick={find}>{T.find}</button>
        </div>
      </Field>
      <Err text={err} />
      {done && <p style={{ color: colors.ok }}>{done}</p>}
      {vehicle === null && (
        <Card>
          <Note>{T.newVehicle}</Note>
          <Field label={T.klass}>
            <select value={klass} onChange={(e) => setKlass(e.target.value)} style={input}><option value="">{S.board.choose}</option>{Object.keys(T.classes).map((k) => <option key={k} value={k}>{T.classes[k]}</option>)}</select>
          </Field>
          <Field label={T.owner}><input value={veh.owner} onChange={(e) => setVeh({ ...veh, owner: e.target.value })} style={input} /></Field>
          <Field label={T.phone}><input inputMode="numeric" maxLength={10} value={veh.phone} onChange={(e) => setVeh({ ...veh, phone: e.target.value.replace(/\D/g, '') })} style={input} /></Field>
          <button type="button" disabled={busy || !klass} style={btn(true)} onClick={saveVehicle}>{T.save}</button>
        </Card>
      )}
      {vehicle && (
        <Card>
          <strong>{vehicle.plate}</strong> · {T.classes[vehicle.klass] || vehicle.klass}{vehicle.ownerName ? ' · ' + vehicle.ownerName : ''}
          {vehicle.lastWash && <Note>{T.lastWash}: {vehicle.lastWash}</Note>}
          {pass ? <Note>{T.passLeft}: {pass.status.left}. {T.passUsed}</Note> : <Note>{T.passNone}</Note>}
        </Card>
      )}
      {vehicle && prices && (
        <Card>
          <Field label={T.klass}>
            <select value={klass} onChange={(e) => setKlass(e.target.value)} style={input}>{classes.map((k) => <option key={k} value={k}>{T.classes[k] || k}</option>)}</select>
          </Field>
          {klass && prices.prices[klass] === undefined && <Err text={T.noPrice} />}
          {addonKeys.length > 0 && <span style={{ fontSize: 14 }}>{T.addons}</span>}
          {addonKeys.map((k) => (
            <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
              <input type="checkbox" checked={addons.includes(k)} onChange={(e) => setAddons(e.target.checked ? [...addons, k] : addons.filter((x) => x !== k))} style={{ width: 22, height: 22 }} /> {k} ({S.common.rupee} {prices.addons[k]})
            </label>
          ))}
          <p><strong>{T.total}: {S.common.rupee} {price}</strong>{pass ? ' · ' + S.board.passCovered : ''}</p>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
            <input type="checkbox" checked={disc} onChange={(e) => setDisc(e.target.checked)} style={{ width: 22, height: 22 }} /> {T.withDiscount}
          </label>
          {disc && (
            <>
              <Field label={T.type}><select value={dtype} onChange={(e) => setDtype(e.target.value)} style={input}><option value="amount">{T.amount}</option><option value="percent">{T.percent}</option></select></Field>
              <Field label={T.value}><input inputMode="numeric" value={dvalue} onChange={(e) => setDvalue(e.target.value.replace(/[^0-9]/g, ''))} style={input} /></Field>
              <Field label={T.why}><input value={dreason} onChange={(e) => setDreason(e.target.value)} style={input} maxLength={120} /></Field>
            </>
          )}
          <button type="button" disabled={busy || !ready || !klass || prices.prices[klass] === undefined || (disc && dvalue && dreason.trim().length < 3)} style={btn(true)} onClick={create}>{T.create}</button>
        </Card>
      )}
    </div>
  );
}
