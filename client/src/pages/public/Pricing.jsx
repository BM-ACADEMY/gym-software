import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';

const plans = [
  {
    name: 'Starter',
    subtitle: 'Starting Up Businesses',
    price: '17,999',
    originalPrice: '21,999',
    popular: false,
    features: [
      'Smart Dashboard',
      'Prospect Management',
      'Billing & POS Sales',
      'Package Management',
      'Automated SMS & Email',
      'Trial Tracking',
      'Attendance Tracking',
      'Promotional SMS',
      'Membership Management',
    ],
  },
  {
    name: 'Pro',
    subtitle: 'Growing Businesses',
    price: '22,999',
    originalPrice: '24,999',
    popular: true,
    features: [
      'Everything in Starter',
      'Enquiry & Conversion Analysis',
      'Follow Up Analysis',
      'Sales Analysis Graphs',
      'BMI Machine Integration',
      'Expense Management',
      'Payroll Management',
      'PT Commission Management',
      'WhatsApp Integration',
    ],
  },
  {
    name: 'Enterprise',
    subtitle: 'Established Businesses',
    price: null,
    originalPrice: null,
    popular: false,
    features: [
      'Everything in Pro',
      'Multi-Branch Management',
      'White-label Mobile App',
      'Custom Reporting',
      'API Access',
      'Dedicated Account Manager',
      'Priority 24/7 Support',
      'Custom Integrations',
    ],
  },
];

const Pricing = () => {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Page Banner */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-gray-950 via-teal-950 to-gray-900 text-center relative overflow-hidden">
        <div className="absolute inset-0" style={{backgroundImage:'radial-gradient(rgba(13,148,136,0.1) 1px, transparent 1px)', backgroundSize:'40px 40px'}}></div>
        <div className="relative max-w-2xl mx-auto px-4">
          <h1 className="text-4xl font-extrabold text-white mb-4">Choose Plan That Fits For You</h1>
          <p className="text-gray-300 text-lg">All-In-One Gym Membership Management Software with multiple features made for Gyms & Fitness Health Clubs.</p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">Annual Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-3xl p-8 flex flex-col border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  plan.popular
                    ? 'border-teal-400 bg-gradient-to-b from-teal-50 to-white shadow-lg shadow-teal-100'
                    : 'border-gray-100 bg-white shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-5 py-1.5 rounded-full bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white text-xs font-bold uppercase tracking-wider shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-teal-100 flex items-center justify-center mb-4">
                    <span className="text-2xl">{['🚀', '⭐', '🏆'][i]}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-gray-500 text-sm">{plan.subtitle}</p>
                </div>

                {plan.price ? (
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-gray-900">₹{plan.price}</span>
                      <span className="text-gray-400 text-sm font-medium">/yearly</span>
                    </div>
                    {plan.originalPrice && (
                      <p className="text-sm text-gray-400 mt-1">
                        <del className="text-red-400">₹{plan.originalPrice}</del>
                        <span className="ml-2 text-green-600 font-medium">Save ₹{(parseInt(plan.originalPrice.replace(',','')) - parseInt(plan.price.replace(',',''))).toLocaleString('en-IN')}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="text-3xl font-extrabold text-gray-900">Custom</div>
                    <p className="text-sm text-gray-400 mt-1">Contact us for pricing</p>
                  </div>
                )}

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/contact"
                  className={`block text-center py-3.5 rounded-2xl font-semibold text-sm transition-all ${
                    plan.popular
                      ? 'bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white hover:brightness-110 shadow-lg shadow-teal-200'
                      : 'border border-teal-200 text-teal-700 hover:bg-teal-50'
                  }`}
                >
                  {plan.price ? 'Contact Us' : 'Talk to Sales'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-gradient-to-r from-teal-900 to-teal-900">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 text-center text-white">
            {[
              { num: '99%', label: 'Customer Retention Rate' },
              { num: '500+', label: 'Trusted Brands' },
              { num: 'Pan India', label: 'Location Coverage' },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-4xl font-extrabold text-teal-300 mb-2">{stat.num}</div>
                <div className="text-gray-300">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Pricing;
