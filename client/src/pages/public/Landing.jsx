import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';

// ─── Animated Counter Hook ──────────────────────────────────────────────────
const useCounter = (target, duration = 2000, start = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
      else setCount(target);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
};

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

// ─── Testimonial Card ───────────────────────────────────────────────────────
const TestimonialCard = ({ name, role, review }) => (
  <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100 flex flex-col gap-4">
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => <svg key={s} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>)}
    </div>
    <p className="text-gray-600 text-sm leading-relaxed flex-1">"{review}"</p>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
        {name.charAt(0)}
      </div>
      <div>
        <p className="font-semibold text-gray-800 text-sm">{name}</p>
        <p className="text-gray-400 text-xs">{role}</p>
      </div>
    </div>
  </div>
);

// ─── Main Landing Page ───────────────────────────────────────────────────────
const Landing = () => {
  const [formData, setFormData] = useState({ firstName: '', lastName: '', company: '', phone: '', email: '', password: '' });
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const c1 = useCounter(99, 2000, statsVisible);
  const c2 = useCounter(500, 2200, statsVisible);
  const c3 = useCounter(1000, 2500, statsVisible);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setStatsVisible(true); }, { threshold: 0.3 });
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const features = [
    { icon: '👥', title: 'Members Management', desc: 'Streamline member profiles, attendance, payments & communication.' },
    { icon: '📱', title: 'Mobile App', desc: 'Members book classes, track progress & view plans from their phones.' },
    { icon: '💬', title: 'WhatsApp Alerts', desc: 'Engage members with automated WhatsApp notifications and updates.' },
    { icon: '⚖️', title: 'BMI Integration', desc: 'Connect BMI machines for body measurement tracking & analytics.' },
    { icon: '💰', title: 'Payroll Management', desc: 'Automate staff payroll, trainer commissions and expense tracking.' },
    { icon: '🔒', title: 'Data Security', desc: 'OTP login, encrypted storage and IP-based security for your data.' },
  ];

  const testimonials = [
    { name: 'Kiran Sharma', role: 'Founder, Iron Peak Gym', review: 'GymDesk transformed how I run my gym. Membership management is effortless and the automated billing saves me hours every week.' },
    { name: 'Priya Menon', role: 'Owner, FitZone Studio', review: 'The OTP login and WhatsApp alerts are fantastic. My members love getting reminders and my staff loves how easy check-in is.' },
    { name: 'Rajesh Patel', role: 'Founder, PowerFit Center', review: 'Switching to GymDesk was the best decision. The analytics dashboard gives me insights I never had before. Revenue is up 30%!' },
    { name: 'Amit Singh', role: 'Founder, Warrior Fitness', review: 'The trainer management and commission tracking alone is worth it. No more spreadsheets! Everything is in one clean dashboard.' },
  ];

  const blogs = [
    { title: 'Top Features Every Gym Management Software Should Have', excerpt: 'Managing a fitness business effectively is challenging. Here are the must-have features...', date: 'June 14, 2024' },
    { title: 'How to Boost Member Retention at Your Gym', excerpt: 'Member retention is the biggest challenge gym owners face. Here are proven strategies...', date: 'May 28, 2024' },
    { title: 'Why Your Gym Needs Digital Attendance Tracking', excerpt: 'Paper-based attendance is outdated. Discover how digital tracking transforms operations...', date: 'Apr 12, 2024' },
    { title: 'Gym Payroll Management Made Simple', excerpt: 'Calculating trainer commissions and staff salaries manually wastes hours. Here\'s how to automate...', date: 'Mar 5, 2024' },
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
                <span className="text-teal-300 text-sm font-medium">India's #1 Gym Management Software</span>
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
                <li className="flex items-center gap-1.5"><svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>Cancel anytime</li>
                <li className="flex items-center gap-1.5"><svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>7-day free trial</li>
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
                {/* Floating badges */}
                <div className="absolute -top-4 -left-4 bg-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <div><p className="text-xs font-bold text-gray-800">500+</p><p className="text-xs text-gray-500">Gyms Trusted</p></div>
                </div>
                <div className="absolute -bottom-4 -right-4 bg-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-2">
                  <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                    <span className="text-sm">📈</span>
                  </div>
                  <div><p className="text-xs font-bold text-gray-800">99%</p><p className="text-xs text-gray-500">Retention Rate</p></div>
                </div>
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
            { title: 'Quick Registration', content: 'Our Quick Registration feature optimizes the enrollment process, reducing both time and effort. It simplifies and expedites registration, ensuring a seamless experience for users.' },
            { title: 'Member Management', content: 'Members management is the main goal of GymDesk software, helping employees respond to customers needs faster. Avoid lines at the check-in desk and reduce waiting times.' },
            { title: 'Mobile App Access', content: 'Our Gym App gives members the convenience of reserving classes, referring their friends, and exploring your club locations. Available on iOS and Android.' },
          ]}
        />
        <FeatureBlock
          title="Club Retention"
          description="Our software uses cutting-edge analytics and comprehensive reporting to help you increase your gym's retention rate. Track member activity and identify churn risks."
          imageIcon="📊"
          reverse={true}
          items={[
            { title: 'Data Management', content: 'Collect, store, and analyze data about your members. This data can be used to improve the member experience, personalize marketing campaigns, and identify churn risks.' },
            { title: 'Gym Automation', content: "Automate your club's operations: special offers, class schedules, payment confirmations, and contract due dates — all handled automatically." },
            { title: 'Alerts Automation', content: 'Keep your clients motivated with personalized emails, push notifications, and SMS alerts. Send event and class reminders so they never miss a beat.' },
          ]}
        />
        <FeatureBlock
          title="Sales & Marketing"
          description="Our specialized platform enables you to improve member acquisition and boost your sales and marketing performance."
          imageIcon="💹"
          reverse={false}
          items={[
            { title: 'Sales System', content: 'Our payment integration makes front-desk transactions easy for everyone. Members can sign up for classes, purchase supplements, and pay dues all at the reception desk.' },
            { title: 'CRM', content: 'Track the entire customer journey from prospect to happy club member! Assign lead acquisition channels to each prospect and see which marketing channels are most effective.' },
            { title: 'Recommendation Engine', content: 'Our Business Intelligence module uses data to recommend fitness classes to new members based on their behavior, preferences, and fitness goals.' },
          ]}
        />
        <FeatureBlock
          title="Operations"
          description="Our health club and fitness management software solutions are intended to make running your club a breeze, streamlining operations and saving time."
          imageIcon="⚙️"
          reverse={true}
          items={[
            { title: 'Dashboard Reports', content: "Our interactive dashboard provides a centralized view of your health club's most important metrics. Track KPIs like membership numbers, attendance, and revenue in real time." },
            { title: 'Device Integration', content: "Our software offers integrations with biometric devices, BMI machines, and more — enhancing your club's fitness experiences for members." },
            { title: 'Staff Management', content: "Manage your gym's staff operations with dynamic employee scheduling, commission programs, and notifications. Keep employees organized and motivated." },
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
              <p className="text-gray-600 text-sm leading-relaxed">A hassle-free experience is the currency that drives customer loyalty. GymDesk helps fitness centres find more ways to make life convenient for their members.</p>
            </div>
            <div className="rounded-3xl p-8 bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Data-Centric</h2>
              <p className="text-gray-600 text-sm leading-relaxed">Adopt a data-centric approach with our gym software. Leverage insightful data analytics to empower your decision-making with the most effective strategies.</p>
            </div>
            <div className="rounded-3xl p-8 bg-gradient-to-br from-teal-50 to-teal-50 border border-teal-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Be a Brand</h2>
              <p className="text-gray-600 text-sm leading-relaxed">Service is the silent ambassador of your brand. Your reputation is earned by doing hard things well. GymDesk helps you build that reputation every day.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUSTED BY BRANDS ────────────────────────────────────────────── */}
      <section className="py-16 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900">We are fortunate to work with exceptional brands</h2>
        </div>
        <div className="relative flex overflow-hidden">
          <div className="flex gap-8 animate-[marquee_30s_linear_infinite]">
            {['Origin Gym', 'Sculpt Master', 'Indian Iron', 'Tornado Fitness', 'The Warrior', 'Gym Discovery', 'Gym Naka', 'Urban Fitness', 'Pulse Fitness', 'Alpha Studio', 'FitZone', 'PowerFit'].map((name, i) => (
              <div key={i} className="flex-shrink-0 px-8 py-4 rounded-2xl border border-gray-100 bg-gray-50 text-gray-500 font-semibold text-sm whitespace-nowrap">
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Trusted by <span className="text-teal-600">500+</span> Worldwide Gyms and Fitness Studios
          </h2>
          <p className="text-center text-gray-500 mb-12">See what gym owners say about GymDesk</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {testimonials.map((t, i) => <TestimonialCard key={i} {...t} />)}
          </div>
        </div>
      </section>

      {/* ── STATS COUNTER ────────────────────────────────────────────────── */}
      <section ref={statsRef} className="py-20 bg-gradient-to-r from-teal-900 to-teal-900">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 text-center text-white">
            <div>
              <div className="text-5xl font-extrabold text-teal-300">{c1}%</div>
              <div className="mt-2 text-gray-300 font-medium">Customer Retention Rate</div>
            </div>
            <div>
              <div className="text-5xl font-extrabold text-teal-300">{c2}+</div>
              <div className="mt-2 text-gray-300 font-medium">Trusted Brands</div>
            </div>
            <div>
              <div className="text-5xl font-extrabold text-teal-300">{c3}+</div>
              <div className="mt-2 text-gray-300 font-medium">Members Managed</div>
            </div>
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
              <h3 className="text-xl font-bold text-gray-900 mb-6">Schedule a FREE Trial</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input className="px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" placeholder="First Name *" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                  <input className="px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" placeholder="Last Name *" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
                <input className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" placeholder="Company / Gym Name *" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <input type="tel" className="px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" placeholder="Phone Number *" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  <input type="email" className="px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white" placeholder="Email Address *" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <Link
                  to="/register"
                  className="block w-full text-center py-4 rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white font-semibold hover:brightness-110 transition-all shadow-lg shadow-teal-500/20"
                >
                  Request a Free Trial →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BLOG PREVIEW ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">
            Get to know more from <span className="text-teal-600">GymDesk Blog</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {blogs.map((blog, i) => (
              <Link to="/blog" key={i} className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="h-36 bg-gradient-to-br from-teal-100 to-teal-50 flex items-center justify-center text-5xl">
                  {['📝', '🏋️', '📊', '💼'][i]}
                </div>
                <div className="p-5">
                  <p className="text-xs text-teal-500 font-medium mb-2">{blog.date}</p>
                  <h3 className="font-semibold text-gray-800 text-sm leading-snug mb-2 group-hover:text-teal-600 transition-colors line-clamp-2">{blog.title}</h3>
                  <p className="text-gray-400 text-xs line-clamp-2">{blog.excerpt}</p>
                  <span className="mt-3 inline-block text-teal-600 text-xs font-semibold">Read more →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCROLLING MARQUEE ────────────────────────────────────────────── */}
      <section className="py-4 bg-teal-600 overflow-hidden">
        <div className="flex gap-8 animate-[marquee_25s_linear_infinite] whitespace-nowrap text-white/80 text-sm font-medium">
          {['Member Management', 'Attendance Tracking', 'Billing & POS', 'Trainer Management', 'AI Workout Plans', 'WhatsApp Alerts', 'BMI Integration', 'Payroll Management', 'Data Security', 'Multi-Branch Support', 'Smart Dashboard', 'Class Scheduling'].map((item, i) => (
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
