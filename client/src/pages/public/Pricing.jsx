import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import apiClient from '../../api/client';

// Keep in step with server/config/plans.js (prices exclude 18% GST).
const plans = [
  {
    name: 'Solo', blurb: 'For a trainer or a very small studio', monthly: 249, yearly: 2490,
    features: ['Up to 50 members', '1 staff login', 'Member portal with QR check-in', 'Attendance and payments', 'No WhatsApp messages (upgrade for reminders)', '15 AI answers a month'],
  },
  {
    name: 'Starter', blurb: 'For a small gym just getting organised', monthly: 599, yearly: 5999,
    features: ['Up to 150 members', '2 staff logins', 'Member portal with QR check-in', 'Attendance and payments', 'Renewal reminders on WhatsApp', '40 AI answers a month'],
  },
  {
    name: 'Growth', blurb: 'For most gyms', monthly: 999, yearly: 9999, popular: true,
    features: ['Up to 500 members', '5 staff logins', 'Everything in Starter', 'PT sessions and trainer commission', 'Accounts and expenses', 'AI workout and diet plans', '120 AI answers a month'],
  },
  {
    name: 'Pro', blurb: 'For big or multi-trainer gyms', monthly: 1999, yearly: 19999,
    features: ['Unlimited members', 'Unlimited staff logins', 'Everything in Growth', 'Your own logo and colours', 'Higher WhatsApp allowance', '300 AI answers a month'],
  },
];

// SET-01: prices and limits come live from the server (Root Admin > Plan settings), so a change shows without a deploy.
// The list above is the fallback if the server cannot be reached.
const BLURBS = { solo: 'For a trainer or a very small studio', starter: 'For a small gym just getting organised', growth: 'For most gyms', pro: 'For big or multi-trainer gyms' };
const liveFeatures = (p) => [
  p.memberLimit ? `Up to ${p.memberLimit.toLocaleString('en-IN')} members` : 'Unlimited members',
  p.staffLimit ? `${p.staffLimit} staff login${p.staffLimit > 1 ? 's' : ''}` : 'Unlimited staff logins',
  'Member portal with QR check-in', 'Attendance and payments',
  p.whatsappPerMonth > 0 ? `${p.whatsappPerMonth.toLocaleString('en-IN')} WhatsApp messages a month` : 'No WhatsApp messages (upgrade for reminders)',
  ...(p.features['pt-sessions'] ? ['PT sessions and trainer commission'] : []),
  ...(p.features.accounts ? ['Accounts and expenses'] : []),
  ...(p.features['ai-plans'] ? [`AI workout and diet plans${p.aiPlansPerMonth ? ` (${p.aiPlansPerMonth} a month)` : ''}`] : []),
  ...(p.features.branding ? ['Your own logo and colours'] : []),
  `${p.aiCallsPerMonth} AI answers a month`,
];
const fromServer = (list) => list.map((p) => ({ name: p.name, blurb: BLURBS[p.key] || '', monthly: p.monthly, yearly: p.yearly, popular: p.key === 'growth', features: liveFeatures(p) }));

const rupees = (n) => `₹${n.toLocaleString('en-IN')}`;

const Pricing = () => {
  const [cycle, setCycle] = useState('yearly');
  const [shown, setShown] = useState(plans);
  useEffect(() => { apiClient.get('/public/plans').then((r) => { const l = r.data && r.data.data && r.data.data.plans; if (Array.isArray(l) && l.length) setShown(fromServer(l)); }).catch(() => {}); }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-950 via-teal-950 to-gray-900 text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-4xl font-extrabold text-white mb-4">Simple pricing. Start free for 14 days.</h1>
          <p className="text-gray-300 text-lg">No card needed. No setup fee. Pay in advance, no auto-renewal.</p>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-center mb-10">
            <div className="inline-flex rounded-xl bg-gray-200 p-1">
              {['monthly', 'yearly'].map((c) => (
                <button key={c} onClick={() => setCycle(c)} className={`rounded-lg px-5 py-2 text-sm font-semibold ${cycle === c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}>
                  {c === 'monthly' ? 'Monthly' : (shown.every((x) => x.yearly <= x.monthly * 10) ? 'Yearly (2 months free)' : 'Yearly')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {shown.map((plan) => (
              <div key={plan.name} className={`relative rounded-3xl p-8 flex flex-col border ${plan.popular ? 'border-teal-400 bg-gradient-to-b from-teal-50 to-white shadow-lg shadow-teal-100' : 'border-gray-100 bg-white shadow-sm'}`}>
                {plan.popular && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-teal-600 text-white text-xs font-bold uppercase tracking-wider">Most popular</span>
                )}
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-gray-500 text-sm">{plan.blurb}</p>
                <div className="my-6">
                  <span className="text-4xl font-extrabold text-gray-900">{rupees(plan[cycle])}</span>
                  <span className="text-gray-400 text-sm font-medium"> / {cycle === 'monthly' ? 'month' : 'year'}</span>
                  <p className="text-xs text-gray-400 mt-1">+ 18% GST</p>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className={`block text-center py-3.5 rounded-2xl font-semibold text-sm ${plan.popular ? 'bg-teal-600 text-white hover:bg-teal-700' : 'border border-teal-200 text-teal-700 hover:bg-teal-50'}`}>
                  Start 14-day free trial
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-500 mt-8">Questions? <Link to="/contact" className="text-teal-700 underline">Talk to us</Link> or read the <Link to="/faq" className="text-teal-700 underline">FAQ</Link>.</p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Pricing;
