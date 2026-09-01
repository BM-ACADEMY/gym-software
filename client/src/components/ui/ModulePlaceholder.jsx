import { Construction } from 'lucide-react';

// Consistent "not built yet" placeholder for every scaffolded module page.
// Swap this out for the real page content as each module gets implemented.
const ModulePlaceholder = ({ title, description, children }) => (
  <div className="p-6 sm:p-8">
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {description && <p className="mt-1.5 text-gray-500">{description}</p>}

      {children ? (
        <div className="mt-6">{children}</div>
      ) : (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-gray-400">
          <Construction className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">This module's UI hasn't been built yet.</span>
        </div>
      )}
    </div>
  </div>
);

export default ModulePlaceholder;
