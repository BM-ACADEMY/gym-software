const TONES = {
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
  violet: 'bg-teal-50 text-teal-700 border-teal-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
};

const Badge = ({ tone = 'gray', children }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${TONES[tone] || TONES.gray}`}>
    {children}
  </span>
);

export default Badge;
