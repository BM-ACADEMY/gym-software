import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';

const LegalLayout = ({ title, children }) => (
  <div className="min-h-screen">
    <Navbar />
    <section className="pt-32 pb-16 bg-gradient-to-br from-gray-950 via-teal-950 to-gray-900 relative overflow-hidden">
      <div className="absolute inset-0" style={{backgroundImage:'radial-gradient(rgba(13,148,136,0.1) 1px, transparent 1px)', backgroundSize:'40px 40px'}}></div>
      <div className="relative max-w-2xl mx-auto px-4 text-center">
        <h1 className="text-4xl font-extrabold text-white mb-4">{title}</h1>
        <p className="text-gray-400 text-sm">Last updated: January 2024</p>
      </div>
    </section>
    <section className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 prose prose-gray max-w-none">
          {children}
        </div>
      </div>
    </section>
    <Footer />
  </div>
);

export default LegalLayout;
