const LegalSection = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">{title}</h2>
    <div className="text-gray-600 text-sm leading-relaxed space-y-3">{children}</div>
  </div>
);

export const DraftNotice = () => (
  <p className="text-amber-800 text-xs mb-6 bg-amber-50 border border-amber-200 rounded-xl p-3">
    Draft wording. To be reviewed by a lawyer before public launch.
  </p>
);

export default LegalSection;
