import { useState } from 'react';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';

const faqs = [
  { q: 'What is GymDesk?', a: 'GymDesk is web-based software for running a gym: members, plans, payments and dues, attendance, trainers, and WhatsApp reminders. You use it in a browser on a phone or computer.' },
  { q: 'Is there a free trial?', a: 'Yes. 14 days with Growth plan features, no card needed. After that the account becomes read-only until you choose a plan.' },
  { q: 'Which plan is right for my gym?', a: 'Solo for up to 50 members, Starter up to 150, Growth up to 500, Pro for bigger gyms. You can upgrade any time and the unused value of your current plan is credited.' },
  { q: 'Does it renew automatically?', a: 'No. You pay for a month or a year in advance. We remind you before it ends and you pay again to continue. Nothing is charged without you paying.' },
  { q: 'Do I get a GST invoice?', a: 'Yes, for every payment. Gyms in Puducherry see CGST and SGST; other states see IGST.' },
  { q: 'Can I move my existing members in?', a: 'Yes. Upload an Excel or CSV file. You see a preview and any errors before anything is saved.' },
  { q: 'Does it work with fingerprint or face machines?', a: 'You can import the attendance log from any brand as an Excel or CSV file. Live sync with machines is planned for later and is not available yet.' },
  { q: 'What WhatsApp messages are sent?', a: 'Renewal reminders, weekly dues reminders, a check-in after 10 days of absence, and a daily summary for the owner. You can turn each off. Solo has no WhatsApp messages; other plans include a monthly allowance.' },
  { q: 'Is there a mobile app?', a: 'Members use a web portal on their phone browser. There is no iOS or Android app yet.' },
  { q: 'Which languages are supported?', a: 'English, Tamil and Hindi menus are available now, with more screens being translated.' },
  { q: 'How safe is my data?', a: 'Each gym\'s data is kept separate, connections are encrypted and passwords are stored hashed. You can export your data.' },
  { q: 'How do I get help?', a: 'Use the Help centre, or raise a request from Help & Support inside the app. We reply by email.' },
];

const Faq = () => {
  const [open, setOpen] = useState(0);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Banner */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-950 via-teal-950 to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0" style={{backgroundImage:'radial-gradient(rgba(13,148,136,0.1) 1px, transparent 1px)', backgroundSize:'40px 40px'}}></div>
        <div className="relative max-w-2xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-extrabold text-white mb-4">Frequently Asked Questions</h1>
          <p className="text-gray-300">Get quick answers to common queries about GymDesk software.</p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
            {/* Left illustration */}
            <div className="lg:col-span-2">
              <div className="sticky top-28 bg-gradient-to-br from-teal-50 to-teal-50 rounded-3xl p-10 border border-teal-100 text-center">
                <div className="text-8xl mb-6">❓</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Can't find your answer?</h3>
                <p className="text-gray-500 text-sm mb-6">Write to us and we will reply by email.</p>
                <a
                  href="/contact"
                  className="inline-block px-6 py-3 rounded-xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white font-semibold text-sm hover:brightness-110 transition-all"
                >
                  Contact Support
                </a>
              </div>
            </div>

            {/* Right accordion */}
            <div className="lg:col-span-3">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">All Questions</h2>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <button
                      onClick={() => setOpen(open === i ? -1 : i)}
                      className="w-full flex items-center justify-between px-6 py-5 text-left font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
                    >
                      <span className="pr-4">{faq.q}</span>
                      <svg className={`w-5 h-5 text-teal-500 flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                      </svg>
                    </button>
                    {open === i && (
                      <div className="px-6 pb-5 text-gray-500 text-sm leading-relaxed border-t border-gray-50">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Faq;
