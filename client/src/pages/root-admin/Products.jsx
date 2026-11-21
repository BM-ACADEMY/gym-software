import { useEffect, useState } from 'react';
import { Rocket } from 'lucide-react';
import apiClient from '../../api/client';
import Badge from '../../components/ui/Badge';

const CONF = { low: ['red', 'Date confidence: low'], medium: ['amber', 'Date confidence: medium'], high: ['green', 'Date confidence: high'] };
const fmt = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const List = ({ title, items, empty }) => (
  <div>
    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{title}</h4>
    {items && items.length ? (
      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">{items.map((t) => <li key={t}>{t}</li>)}</ul>
    ) : <p className="text-sm text-gray-400">{empty}</p>}
  </div>
);

const Products = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState('');

  useEffect(() => {
    apiClient.get('/root-admin/products')
      .then((res) => { setData(res.data.data); setOpen(res.data.data.products[0]?.key || ''); })
      .catch((err) => setError(err.response?.data?.message || 'Could not load products.'));
  }, []);

  if (!data) return <p className="p-6 text-sm text-gray-500">{error || 'Loading...'}</p>;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="flex items-center gap-2"><Rocket className="w-5 h-5 text-teal-600" /><h1 className="text-xl font-bold text-gray-900">Products &amp; Launch</h1></div>
      <p className="text-sm text-gray-600">{data.note} Last updated {fmt(data.updatedAt)}.</p>
      {data.products.map((p) => {
        const isOpen = open === p.key;
        const [tone, label] = CONF[p.confidence];
        return (
          <section key={p.key} className="bg-white border border-gray-200 rounded-xl">
            <button type="button" onClick={() => setOpen(isOpen ? '' : p.key)} aria-expanded={isOpen}
              className="w-full text-left p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-500">{p.address} · {p.stage}</div>
              </div>
              <div className="text-sm text-gray-700">Target {fmt(p.targetDate)} ({p.daysToTarget >= 0 ? `${p.daysToTarget} days` : `${-p.daysToTarget} days past`})</div>
              <Badge tone={tone}>{label}</Badge>
              <Badge tone="gray">Checklist {p.checklistDone}/{p.checklistTotal}</Badge>
            </button>
            {isOpen && (
              <div className="border-t border-gray-100 p-4 grid gap-4 sm:grid-cols-2">
                <p className="sm:col-span-2 text-sm text-gray-600">{p.confidenceNote}</p>
                <List title="Written so far (not yet tested by a person)" items={p.done} empty="Nothing yet" />
                <List title="Next" items={p.next} empty="Nothing planned" />
                <List title="Blocking or open" items={p.blockers} empty="Nothing blocking" />
                <List title="Claude's suggestions" items={p.suggestions} empty="None yet" />
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Launch checklist</h4>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {p.launchChecklist.map((c) => <li key={c.item}>{c.done ? '[x]' : '[ ]'} {c.item}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Updates</h4>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {p.updates.map((u) => <li key={u.date + u.text}><span className="text-gray-500">{fmt(u.date)}</span> {u.text}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default Products;
