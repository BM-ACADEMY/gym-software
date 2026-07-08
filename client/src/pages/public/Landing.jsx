import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle, BarChart, Users, Calendar, Settings } from 'lucide-react';

const Landing = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-fuchsia-600">GymDesk</span>
            </div>
            <div className="flex space-x-4">
              <Link
                to="/login"
                className="text-gray-700 hover:text-fuchsia-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="bg-fuchsia-600 text-white hover:bg-fuchsia-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-grow">
        <div className="relative overflow-hidden bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
            <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight sm:text-6xl">
              Manage your gym with <span className="text-fuchsia-600">GymDesk</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-500">
              The all-in-one platform for gym owners. Handle memberships, trainers, billing, and workouts from one powerful dashboard.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-fuchsia-600 hover:bg-fuchsia-700 md:text-lg"
              >
                Start Free 7-Day Trial
                <ArrowRight className="ml-2 -mr-1 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Features/Modules Section */}
        <div className="bg-gray-50 py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">Everything you need in one place</h2>
              <p className="mt-4 text-lg text-gray-500">Powerful modules built specifically for fitness businesses.</p>
            </div>

            <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <Users className="h-10 w-10 text-fuchsia-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Member Management</h3>
                <p className="mt-2 text-gray-500">Track attendance, handle subscriptions, and monitor member progress easily.</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <Calendar className="h-10 w-10 text-fuchsia-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Trainer & PT Sessions</h3>
                <p className="mt-2 text-gray-500">Assign trainers, schedule personal training, and calculate commissions.</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <Settings className="h-10 w-10 text-fuchsia-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Workout & AI Plans</h3>
                <p className="mt-2 text-gray-500">Generate custom workout and diet plans for members using AI.</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <BarChart className="h-10 w-10 text-fuchsia-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Billing & Analytics</h3>
                <p className="mt-2 text-gray-500">Automated payments, invoicing, and detailed revenue reporting.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="bg-white py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">Simple, transparent pricing</h2>
              <p className="mt-4 text-lg text-gray-500">Choose the plan that fits your gym's size.</p>
            </div>
            
            <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Starter */}
              <div className="border border-gray-200 rounded-lg shadow-sm p-8 bg-white flex flex-col">
                <h3 className="text-2xl font-semibold text-gray-900">Starter</h3>
                <p className="mt-4 text-gray-500 flex-grow">Perfect for small studios and new gyms.</p>
                <div className="mt-6 text-4xl font-extrabold text-gray-900">$49<span className="text-xl text-gray-500 font-medium">/mo</span></div>
                <ul className="mt-8 space-y-4">
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-fuchsia-500 mr-2" /> Up to 100 Members</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-fuchsia-500 mr-2" /> Basic Analytics</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-fuchsia-500 mr-2" /> Payment Gateway</li>
                </ul>
                <Link to="/register" className="mt-8 block w-full bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 text-center py-3 rounded-md font-medium transition-colors">Start Trial</Link>
              </div>

              {/* Pro */}
              <div className="border-2 border-fuchsia-500 rounded-lg shadow-md p-8 bg-white relative flex flex-col transform scale-105">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4">
                  <span className="bg-fuchsia-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">Most Popular</span>
                </div>
                <h3 className="text-2xl font-semibold text-gray-900">Pro</h3>
                <p className="mt-4 text-gray-500 flex-grow">For growing fitness centers and franchises.</p>
                <div className="mt-6 text-4xl font-extrabold text-gray-900">$99<span className="text-xl text-gray-500 font-medium">/mo</span></div>
                <ul className="mt-8 space-y-4">
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-fuchsia-500 mr-2" /> Up to 500 Members</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-fuchsia-500 mr-2" /> Advanced Analytics</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-fuchsia-500 mr-2" /> Trainer Management</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-fuchsia-500 mr-2" /> AI Workout Plans</li>
                </ul>
                <Link to="/register" className="mt-8 block w-full bg-fuchsia-600 text-white hover:bg-fuchsia-700 text-center py-3 rounded-md font-medium transition-colors">Start Trial</Link>
              </div>

              {/* Premium */}
              <div className="border border-gray-200 rounded-lg shadow-sm p-8 bg-white flex flex-col">
                <h3 className="text-2xl font-semibold text-gray-900">Premium</h3>
                <p className="mt-4 text-gray-500 flex-grow">Unlimited power for enterprise gyms.</p>
                <div className="mt-6 text-4xl font-extrabold text-gray-900">$199<span className="text-xl text-gray-500 font-medium">/mo</span></div>
                <ul className="mt-8 space-y-4">
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-fuchsia-500 mr-2" /> Unlimited Members</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-fuchsia-500 mr-2" /> White-label App</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-fuchsia-500 mr-2" /> Custom Reporting</li>
                  <li className="flex items-center"><CheckCircle className="h-5 w-5 text-fuchsia-500 mr-2" /> Dedicated Support</li>
                </ul>
                <Link to="/register" className="mt-8 block w-full bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 text-center py-3 rounded-md font-medium transition-colors">Contact Sales</Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">&copy; {new Date().getFullYear()} GymDesk. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
