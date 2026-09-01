import { useState } from 'react';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';

const faqs = [
  { q: 'What is GymDesk Software?', a: 'GymDesk is a complete web-based gym management software designed to streamline and optimize fitness center operations. It provides gym owners and managers with a centralized platform to manage member data, attendance tracking, billing, and reporting.' },
  { q: 'Is GymDesk useful for both small and large gym businesses?', a: 'GymDesk has been developed to serve gyms of all sizes. Whether you run a small health studio or a large fitness club, our scalable software adapts to your specific needs and helps increase revenue.' },
  { q: 'Is GymDesk online or offline software?', a: 'GymDesk is 100% online cloud-based software. Our platform is accessible via the Internet, allowing gym owners and employees to manage operations from anywhere. Real-time updates and data security are built in.' },
  { q: 'How can GymDesk help a gym or fitness studio?', a: 'GymDesk automates time-consuming tasks including member sign-up, payment tracking, and class booking. It enhances member engagement through personalized communications and provides detailed reporting and analytics for data-driven decisions.' },
  { q: 'Can it handle membership management and sign-ups?', a: 'Yes! GymDesk offers robust membership management. You can create and manage member profiles, track membership status, handle renewals, and support online sign-up — making it convenient for new members to join your gym.' },
  { q: 'Does GymDesk provide billing and payment processing features?', a: 'GymDesk includes built-in billing and payment processing features. Gyms can manage membership fees, dues, and class fees efficiently. Members can make secure payments through the software.' },
  { q: 'Is GymDesk integrated with biometric systems?', a: 'GymDesk integrates with biometric devices for secure member authentication and attendance tracking. This allows gym owners to manage attendance accurately and enhance the overall member experience.' },
  { q: 'Can GymDesk manage class schedules and bookings?', a: 'Absolutely! GymDesk includes class scheduling and booking capabilities. Gym owners can schedule and manage classes, track attendance, and manage bookings and cancellations easily.' },
  { q: 'Does GymDesk provide attendance tracking for members?', a: 'GymDesk offers full attendance tracking functionality. Track member attendance, analyze class participation, and use attendance data to identify popular courses and improve offerings.' },
  { q: 'How does GymDesk handle inventory and expense management?', a: 'The GymDesk expense management module ensures proper tracking of gym equipment and supplies. Monitor stock levels, track usage patterns, and set reorder alerts to keep operations smooth.' },
  { q: 'Can GymDesk generate customizable reports?', a: 'GymDesk offers full reporting and analytics features. Generate reports on membership statistics, attendance, revenue analysis, class usage, and more — helping you make data-driven decisions.' },
  { q: 'How safe is GymDesk in terms of data security?', a: 'GymDesk prioritizes data security. The software uses OTP login, advanced encryption, and secure data storage protocols to protect sensitive information including personal details and payment data.' },
  { q: 'What customer support options are available?', a: 'GymDesk provides 24/7 customer support including live chat, email, and phone support. Our team of experts is always ready to assist you with any questions or technical issues.' },
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
                <p className="text-gray-500 text-sm mb-6">Our support team is here to help you 24/7.</p>
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
