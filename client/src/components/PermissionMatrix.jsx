import { SUBADMIN_NAV, SUBADMIN_TEMPLATES, ALWAYS_ON_SUBADMIN_MODULES } from '../config/navigation';

// The toggle grid the Gym Owner uses to configure a sub-admin: tick which
// modules they can see, and whether each is View-only or View+Edit.
// Controlled component — parent owns the `permissions` state.
const PermissionMatrix = ({ template, permissions, onTemplateChange, onPermissionsChange }) => {
  const applyTemplate = (key) => {
    onTemplateChange(key);
    onPermissionsChange(SUBADMIN_TEMPLATES[key]?.permissions || {});
  };

  const togglePermission = (moduleKey, field) => {
    const current = permissions[moduleKey] || { view: false, edit: false };
    const next = { ...current, [field]: !current[field] };
    // Edit implies View
    if (field === 'edit' && next.edit) next.view = true;
    if (field === 'view' && !next.view) next.edit = false;
    onPermissionsChange({ ...permissions, [moduleKey]: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Start from a template</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SUBADMIN_TEMPLATES).map(([key, tpl]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyTemplate(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                template === key
                  ? 'bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] border-teal-600 text-white'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Module</th>
              <th className="px-4 py-2.5 text-center font-semibold text-gray-600 w-24">View</th>
              <th className="px-4 py-2.5 text-center font-semibold text-gray-600 w-24">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {SUBADMIN_NAV.map(({ key, label }) => {
              const locked = ALWAYS_ON_SUBADMIN_MODULES.includes(key);
              const perm = permissions[key] || { view: locked, edit: false };
              return (
                <tr key={key}>
                  <td className="px-4 py-2.5 text-gray-700">{label}</td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={locked ? true : Boolean(perm.view)}
                      disabled={locked}
                      onChange={() => togglePermission(key, 'view')}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(perm.edit)}
                      onChange={() => togglePermission(key, 'edit')}
                      className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PermissionMatrix;
