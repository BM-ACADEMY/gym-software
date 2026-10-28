import { Link } from 'react-router-dom';
import { company, prettyPhone } from '../../config/company';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';

const Contact = () => {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Banner */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-950 via-teal-950 to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0" style={{backgroundImage:'radial-gradient(rgba(13,148,136,0.1) 1px, transparent 1px)', backgroundSize:'40px 40px'}}></div>
        <div className="relative max-w-2xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-extrabold text-white mb-4">Get in Touch</h1>
          <p className="text-gray-300">We're here to help.</p>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">We'd love to hear from you</h2>
            <p className="text-gray-500 mb-8">Questions about plans, setup or billing? Reach us here, or start the free trial and use support from inside the app.</p>
            <div className="space-y-4 text-left">
              {company.email && (
                <div className="p-5 rounded-2xl bg-teal-50 border border-teal-100">
                  <h3 className="font-bold text-gray-800 mb-1">Email</h3>
                  <a href={`mailto:${company.email}`} className="text-teal-600 font-medium text-sm hover:underline">{company.email}</a>
                </div>
              )}
              {company.phone && (
                <div className="p-5 rounded-2xl bg-teal-50 border border-teal-100">
                  <h3 className="font-bold text-gray-800 mb-1">Phone / WhatsApp</h3>
                  <a href={`https://wa.me/${company.phone}`} className="text-teal-600 font-medium text-sm hover:underline">{prettyPhone(company.phone)}</a>
                </div>
              )}
              {company.address && (
                <div className="p-5 rounded-2xl bg-teal-50 border border-teal-100">
                  <h3 className="font-bold text-gray-800 mb-1">Office</h3>
                  <p className="text-gray-500 text-sm">{company.legalName}<br />{company.address}</p>
                </div>
              )}
              {!company.email && !company.phone && (
                <p className="text-gray-500 text-sm text-center">Contact details will be added here soon.</p>
              )}
            </div>
            <Link to="/register" className="inline-block mt-8 px-8 py-3.5 rounded-2xl bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white font-semibold hover:brightness-110 shadow-lg shadow-teal-200">
              Start your free trial
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
