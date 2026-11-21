import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import { HELP_ARTICLES } from '../../config/helpArticles';
import useSiteContent from '../../hooks/useSiteContent';
import { company } from '../../config/company';

const Help = () => {
  const articles = useSiteContent('help', HELP_ARTICLES);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const q = query.trim().toLowerCase();
  const list = q
    ? articles.filter((a) => (a.q + ' ' + a.a.join(' ')).toLowerCase().includes(q))
    : articles;

  return (
    <div className="min-h-screen">
      <Navbar />
      <section className="pt-32 pb-12 bg-gradient-to-br from-gray-950 via-teal-950 to-gray-900">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-extrabold text-white mb-4">Help centre</h1>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, for example: import, WhatsApp, invoice"
            className="w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
        </div>
      </section>
      <section className="py-12 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 space-y-3">
          {list.length === 0 && <p className="text-center text-gray-500">No article found. Try another word, or contact us below.</p>}
          {list.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl border border-gray-100">
              <button className="w-full text-left px-5 py-4 font-semibold text-gray-800 flex justify-between gap-3" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
                <span>{a.q}</span><span aria-hidden>{open === a.id ? '−' : '+'}</span>
              </button>
              {open === a.id && (
                <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed space-y-2">
                  {a.a.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              )}
            </div>
          ))}
          <p className="text-center text-sm text-gray-500 pt-6">
            Still stuck? {company.email ? <a className="text-teal-600" href={`mailto:${company.email}`}>{company.email}</a> : <Link className="text-teal-600" to="/contact">Contact us</Link>}
          </p>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Help;
