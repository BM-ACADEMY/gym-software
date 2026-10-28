import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';

// ─── Feature Block ──────────────────────────────────────────────────────────
const FeatureBlock = ({ title, description, items, imageIcon, reverse }) => {
  const [open, setOpen] = useState(0);
  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className={`flex flex-col lg:flex-row gap-16 items-center ${reverse ? 'lg:flex-row-reverse' : ''}`}>
          {/* Visual */}
          <div className="lg:w-1/2 flex-shrink-0">
            <div className="relative bg-gradient-to-br from-teal-50 to-teal-50 rounded-3xl p-10 border border-teal-100 shadow-xl">
              <div className="text-8xl text-center">{imageIcon}</div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-3 rounded-full bg-gradient-to-r from-teal-200 to-teal-200 opacity-60" style={{width:`${60+i*10}%`}}></div>
                ))}
              </div>
              <div className="absolute -top-4 -right-4 w-12 h-12 bg-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="lg:w-1/2">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{title}</h2>
            <p className="text-gray-500 mb-8 leading-relaxed">{description}</p>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                    onClick={() => setOpen(open === i ? -1 : i)}
                  >
                    <span>{item.title}</span>
                    <svg className={`w-5 h-5 text-teal-500 transition-transform ${open === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  {open === i && (
                    <div className="px-5 pb-5 text-gray-500 text-sm leading-relaxed border-t border-gray-50">{item.content}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Main Landing Page ───────────────────────────────────────────────────────
const Landing = () => {

  const features = [
    { icon: '👥', title: 'Members Management', desc: 'Streamline member profiles, attendance, payments & communication.' },
    { icon: '📱', title: 'Member Portal', desc: 'Members open it on their phone browser to see their plan, expiry, attendance QR and workout plan. No app store download.' },
    { icon: '💬', title: 'WhatsApp Reminders', desc: 'Renewal, dues and absence reminders go out by themselves, and you get a daily summary at 8 pm.' },
        { icon: '💰', title: 'Commissions and Expenses', desc: 'Track trainer commissions, PT sessions and gym expenses in one place.' },
    { icon: '🔒', title: 'Your Data Stays Yours', desc: 'Each gym\'s data is kept separate, connections are encrypted, and you can export it any time.' },
  ];


  return (
    <div className="min-h-screen">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-gray-950 via-teal-950 to-gray-900">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-600/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-600/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-800/10 rounded-full blur-3xl"></div>
          {/* Grid pattern */}
          <div className="absolute inset-0" style={{backgroundImage:'radial-gradient(rgba(13,148,136,0.1) 1px, transparent 1px)', backgroundSize:'40px 40px'}}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left text */}
            <div className="lg:w-1/2 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/20 border border-teal-500/30 mb-6">
                <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
                <span className="text-teal-300 text-sm font-medium">Gym Management Software Made in India</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
                Gym management<br />
                <span className="bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">software for</span><br />
                fitness industry
              </h1>
              <p className="mt-6 text-lg text-gray-300 leading-relaxed max-w-xl">
                All-In-One Gym Membership Management Software with multiple features made for Gyms & Fitness Health Clubs.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white font-semibold text-lg shadow-2xl shadow-teal-500/30 hover:shadow-teal-500/50 hover:-translate-y-1 transition-all duration-200"
                >
                  Request a Free Demo
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-white/20 text-white font-medium text-lg hover:bg-white/5 transition-all"
                >
                  See Features
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 justify-center lg:justify-start text-sm text-gray-400">
                <li className="flex items-center gap-1.5"><svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>No credit card required</li>
                <li className="flex items-center gap-1.5"><svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>No auto-renewal</li>
                <li className="flex items-center gap-1.5"><svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>14-day free trial</li>
              </ul>
            </div>

            {/* Right hero image */}
            <div className="lg:w-1/2 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] rounded-3xl blur-2xl opacity-20 scale-110"></div>
                <img
                  src="/hero-dashboard.png"
                  alt="GymDesk Dashboard"
                  className="relative rounded-2xl shadow-2xl border border-white/10 max-w-lg w-full"
                  style={{ filter: 'hue-rotate(-87deg) saturate(1.15)' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES INTRO ───────────────────────────────────────────────── */}
      <section id="features" className="py-20 bg-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900">GymDesk provides smart fitness features</h2>
          <p className="mt-4 text-gray-500 leading-relaxed">
            Sign-up members and prospects online or through an in-person kiosk, using a laptop, tablet or mobile device. Manage multiple programs and customize membership plans.
          </p>
        </div>
      </section>

      {/* ── FEATURE BLOCKS ───────────────────────────────────────────────── */}
      <div className="bg-gray-50">
        <FeatureBlock
          title="Member Registration Process"
          description="Empower your club members with our top-notch fitness software solutions, granting them autonomy and self-management capabilities."
          imageIcon="📋"
          reverse={false}
          items={[
            { title: 'Bring Your Members Over', content: 'Upload your existing members from Excel or CSV. You see a preview with any errors before anything is saved.' },
            { title: 'QR Check-in', content: 'Each member gets a signed QR code in the member portal. Scan it at the front desk to mark attendance.' },
            { title: 'Member Portal', content: 'Members sign in from their phone browser to see their plan, expiry date, check-in QR and workout plan. There is no separate iOS or Android app yet.' },
          ]}
        />
        <FeatureBlock
          title="Club Retention"
          description="Know who is about to leave and remind them before they do."
          imageIcon="📊"
          reverse={true}
          items={[
            { title: 'Absence Alerts', content: 'See members who have not come for 10 days, and send a friendly check-in message on WhatsApp.' },
            { title: 'WhatsApp Reminders', content: 'Renewal reminders, dues reminders, absence check-ins and a daily summary for you are sent on WhatsApp automatically. Each plan includes a monthly message allowance.' },
            { title: 'Dues Reminders', content: 'Pending balances are chased weekly on WhatsApp, with your UPI ID in the message.' },
          ]}
        />
        <FeatureBlock
          title="Money"
          description="Collect fees, track dues and pay your trainers correctly."
          imageIcon="💹"
          reverse={false}
          items={[
            { title: 'Payments and Dues', content: 'Record full or part payments at the desk, see who owes what, and keep a payment history for every member.' },
            { title: 'Trial Leads', content: 'Track people who booked a trial visit and convert them into members with one click.' },
            { title: 'Trainer Commission and Expenses', content: 'Track PT sessions, trainer commission and gym expenses in one place (Growth plan and above).' },
          ]}
        />
        <FeatureBlock
          title="Operations"
          description="Run the day without paper registers."
          imageIcon="⚙️"
          reverse={true}
          items={[
            { title: 'Dashboard', content: 'See active members, renewals due this week, today\'s check-ins and money collected on one screen.' },
            { title: 'Biometric Machine Logs', content: 'Export the attendance log from your fingerprint or face machine and import it. Live sync with machines is planned, not available yet.' },
            { title: 'Staff and Attendance', content: 'Give each staff member their own login with limited screens, and mark staff attendance daily.' },
          ]}
        />
      </div>

      {/* ── 6 FEATURE CARDS ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-14">GymDesk provides smart fitness features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="group p-7 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3 VALUE CARDS ────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-3xl p-8 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Hassle-Free Experience.</h2>
              <p className="text-gray-600 text-sm leading-relaxed">Members see their plan, expiry and QR on their phone, and get reminders before they lapse.</p>
            </div>
            <div className="rounded-3xl p-8 bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Data-Centric</h2>
              <p className="text-gray-600 text-sm leading-relaxed">Your dashboard shows renewals due, dues pending and who has stopped coming, so you act on facts.</p>
            </div>
            <div className="rounded-3xl p-8 bg-gradient-to-br from-teal-50 to-teal-50 border border-teal-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Be a Brand</h2>
              <p className="text-gray-600 text-sm leading-relaxed">Your gym name shows on the member portal. The Pro plan adds your own logo and colours.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── HONEST PROOF: what you get, no made-up numbers ───────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Built for Indian gyms</h2>
          <p className="text-gray-500 mb-10">Start free, set up in under an hour, and we remind your members to renew so you don't have to chase them.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {[
              { t: '14 days free', d: 'Try everything. No card needed.' },
              { t: 'No hidden fees', d: 'We never take a cut of your members\' payments.' },
              { t: 'Your data stays yours', d: 'Export your members any time.' },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl bg-white p-6 border border-gray-100 shadow-sm">
                <p className="font-bold text-gray-900">{x.t}</p>
                <p className="text-sm text-gray-500 mt-1">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FREE TRIAL FORM ───────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left copy */}
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Digitally Transform Your <span className="text-teal-600">Health Club</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                Our cutting-edge fitness software serves as a digital hub, enabling a range of options and fitness encounters through seamless data utilization and integrations.
              </p>
              <ul className="space-y-3">
                {['Smart Dashboard with real-time KPIs', 'Automated SMS & WhatsApp alerts', 'Biometric & BMI device integration', 'AI-powered workout & diet plans', 'Multi-branch management support'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-700">
                    <svg className="w-5 h-5 text-teal-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right form */}
            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Start your 14-day free trial</h3>
              <p className="text-sm text-gray-500 mb-6">Create your gym in two minutes. No card needed. Add your members, send your first reminder, and see if it saves you time.</p>
              <Link
                to="/register"
                className="block w-full text-center py-4 rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white font-semibold hover:brightness-110 transition-all shadow-lg shadow-teal-500/20"
              >
                Start free trial →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── SCROLLING MARQUEE ────────────────────────────────────────────── */}
      <section className="py-4 bg-teal-600 overflow-hidden">
        <div className="flex gap-8 animate-[marquee_25s_linear_infinite] whitespace-nowrap text-white/80 text-sm font-medium">
          {['Member Management', 'QR Attendance', 'Payments and Dues', 'Trainer Commission', 'AI Workout Plans', 'WhatsApp Reminders', 'Excel Import', 'Biometric Log Import', 'GST Invoices', 'Tamil and Hindi menus', 'Smart Dashboard', 'Staff Attendance'].map((item, i) => (
            <span key={i} className="flex-shrink-0">{item} &nbsp;|&nbsp;</span>
          ))}
        </div>
      </section>

      <Footer />

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default Landing;
