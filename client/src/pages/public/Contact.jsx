import { useState } from 'react';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';

const Contact = () => {
  const [form, setForm] = useState({ name: '', mobile: '', email: '', business: '', comment: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Banner */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-950 via-violet-950 to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0" style={{backgroundImage:'radial-gradient(rgba(139,92,246,0.1) 1px, transparent 1px)', backgroundSize:'40px 40px'}}></div>
        <div className="relative max-w-2xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-extrabold text-white mb-4">Get in Touch</h1>
          <p className="text-gray-300">Chat to our friendly team. We're here to help!</p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 items-start">
            {/* Left info */}
            <div className="lg:col-span-2">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">We'd love to hear from you</h2>
              <p className="text-gray-500 mb-8">Chat to our friendly team.</p>

              <div className="space-y-6">
                <div className="flex gap-4 items-start p-5 rounded-2xl bg-violet-50 border border-violet-100">
                  <div className="w-11 h-11 bg-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 mb-1">Chat to Sales</h3>
                    <p className="text-gray-500 text-sm mb-2">Speak to our friendly team.</p>
                    <a href="mailto:info@gymdesk.in" className="text-violet-600 font-medium text-sm hover:underline">info@gymdesk.in</a>
                  </div>
                </div>

                <div className="flex gap-4 items-start p-5 rounded-2xl bg-violet-50 border border-violet-100">
                  <div className="w-11 h-11 bg-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 mb-1">Call Us</h3>
                    <p className="text-gray-500 text-sm mb-2">We are available 24/7 for you.</p>
                    <a href="tel:+918587885643" className="text-violet-600 font-medium text-sm hover:underline block">+91 85878 85643</a>
                    <a href="tel:+919289790047" className="text-violet-600 font-medium text-sm hover:underline block">+91 92897 90047</a>
                  </div>
                </div>

                <div className="flex gap-4 items-start p-5 rounded-2xl bg-violet-50 border border-violet-100">
                  <div className="w-11 h-11 bg-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 mb-1">Office</h3>
                    <p className="text-gray-500 text-sm">Your Address,<br/>City, State, India</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right form */}
            <div className="lg:col-span-3">
              <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Schedule a Free Demo</h2>
                <p className="text-gray-500 text-sm mb-7">Fill out the form below and we'll be in touch shortly to schedule a free demo.</p>

                {submitted ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Message Sent!</h3>
                    <p className="text-gray-500">Our team will contact you within 24 hours.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input required className="px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="Your Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                      <input required type="tel" pattern="[0-9]{10}" maxLength={10} className="px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="Mobile Number *" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value.replace(/[^0-9]/g,'')})} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input required type="email" className="px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" placeholder="Email Address *" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                      <select className="px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-500" value={form.business} onChange={e => setForm({...form, business: e.target.value})}>
                        <option value="">Business Type</option>
                        <option>Gym / Fitness Studio</option>
                        <option>Yoga Studio</option>
                        <option>CrossFit Box</option>
                        <option>Sports Club</option>
                        <option>Others</option>
                      </select>
                    </div>
                    <textarea required rows={4} className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" placeholder="Your message or questions..." value={form.comment} onChange={e => setForm({...form, comment: e.target.value})} />
                    <button type="submit" className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg shadow-violet-200">
                      Send Your Message →
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
