import { Search, X } from 'lucide-react';

export const Page = ({ children }) => <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">{children}</div>;

export const PageHeader = ({ eyebrow = 'Trainer workspace', title, description, actions }) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>
);

export const Card = ({ children, className = '' }) => (
  <section className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`}>{children}</section>
);

export const CardTitle = ({ title, description, action }) => (
  <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
    <div><h3 className="font-semibold text-gray-900">{title}</h3>{description && <p className="mt-1 text-xs text-gray-500">{description}</p>}</div>
    {action}
  </div>
);

export const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const styles = variant === 'secondary'
    ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
    : variant === 'danger' ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm';
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`} {...props}>{children}</button>;
};

export const Stat = ({ label, value, helper, icon: Icon, tone = 'teal' }) => {
  const tones = { teal: 'bg-teal-50 text-teal-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', violet: 'bg-violet-50 text-violet-700' };
  return <Card className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-gray-500">{label}</p><p className="mt-2 text-3xl font-bold text-gray-950">{value}</p><p className="mt-1 text-xs text-gray-500">{helper}</p></div>{Icon && <div className={`rounded-xl p-3 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>}</div></Card>;
};

export const SearchBox = ({ value, onChange, placeholder = 'Search...' }) => (
  <label className="relative block min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"/><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"/></label>
);

export const Pill = ({ children, tone = 'gray' }) => {
  const tones = { gray: 'bg-gray-100 text-gray-600', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', blue: 'bg-blue-50 text-blue-700', violet: 'bg-violet-50 text-violet-700' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
};

export const Modal = ({ open, title, children, onClose, footer }) => !open ? null : (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><h3 className="text-lg font-bold">{title}</h3><button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5"/></button></div>
      <div className="p-5">{children}</div>{footer && <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">{footer}</div>}
    </div>
  </div>
);

export const Field = ({ label, ...props }) => <label className="block"><span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span><input className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" {...props}/></label>;

export const Empty = ({ title, text }) => <div className="px-5 py-12 text-center"><p className="font-semibold text-gray-800">{title}</p><p className="mt-1 text-sm text-gray-500">{text}</p></div>;
