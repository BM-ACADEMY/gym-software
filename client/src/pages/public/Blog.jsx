import { Link } from 'react-router-dom';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';

const blogPosts = [
  { emoji: '🏋️', title: 'Boost Member Engagement Through Gym Software', excerpt: 'In this blog, let\'s collect points and details about how you can use gym management software to boost member engagement and loyalty.', date: '14 June 2024', author: 'GymDesk Team', category: 'Software' },
  { emoji: '📋', title: 'Top Features Every Gym Management Software Should Have', excerpt: 'Nowadays, managing a fitness business effectively is challenging for success in the modern competitive landscape.', date: '20 May 2024', author: 'GymDesk Team', category: 'Management' },
  { emoji: '🔧', title: 'How to Manage Your Gym Easily?', excerpt: 'We are in an environment as competitive as the gym/fitness industry. If you don\'t know how to manage efficiently, you fall behind.', date: '5 Apr 2024', author: 'GymDesk Team', category: 'Tips' },
  { emoji: '📈', title: 'Top 10 Fitness Industry Trends for 2024', excerpt: 'Wearable technology has grown more and more common in the fitness sector. Here are the top trends shaping the industry.', date: '10 Mar 2024', author: 'GymDesk Team', category: 'Trends' },
  { emoji: '💪', title: 'How to Prepare Your Gym for Growth', excerpt: 'It\'s been a great time for gyms post-pandemic. Here is how you can prepare your gym for the next level of growth.', date: '25 Feb 2024', author: 'GymDesk Team', category: 'Growth' },
  { emoji: '🥗', title: 'Is Nose-Breathing Healthier During Workouts?', excerpt: 'Breathing is a vital function that keeps us alive, and how we breathe can have a huge impact on athletic performance.', date: '1 Jan 2024', author: 'GymDesk Team', category: 'Health' },
];

const Blog = () => {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Featured Article Hero */}
      <section className="pt-28 pb-16 bg-gradient-to-br from-gray-950 via-teal-950 to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0" style={{backgroundImage:'radial-gradient(rgba(13,148,136,0.1) 1px, transparent 1px)', backgroundSize:'40px 40px'}}></div>
        <div className="relative max-w-5xl mx-auto px-4">
          <Link to="#" className="group block rounded-3xl overflow-hidden border border-white/10 hover:border-teal-400/50 transition-all">
            <div className="h-64 bg-gradient-to-r from-teal-600/40 to-teal-600/40 flex items-center justify-center relative">
              <span className="text-7xl">🏋️</span>
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <span className="px-3 py-1 bg-teal-600 text-white text-xs font-semibold rounded-full">Featured</span>
                <h1 className="mt-3 text-2xl font-bold text-white group-hover:text-teal-300 transition-colors">Boost Member Engagement Through Gym Software</h1>
                <p className="mt-2 text-gray-400 text-sm">14 June 2024 &nbsp;·&nbsp; By GymDesk Team</p>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">
            Get to know more from <span className="text-teal-600">GymDesk Blog</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post, i) => (
              <Link to="#" key={i} className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className="h-44 bg-gradient-to-br from-teal-50 to-teal-50 flex items-center justify-center text-6xl">
                  {post.emoji}
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-600 text-xs font-medium">{post.category}</span>
                    <span className="text-gray-400 text-xs">{post.date}</span>
                  </div>
                  <h3 className="font-bold text-gray-800 leading-snug mb-2 group-hover:text-teal-600 transition-colors line-clamp-2">{post.title}</h3>
                  <p className="text-gray-500 text-sm line-clamp-2 mb-4">{post.excerpt}</p>
                  <span className="text-teal-600 text-sm font-semibold group-hover:underline">Read more →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Blog;
