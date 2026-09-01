import { NavLink } from 'react-router-dom';
import { Dumbbell, X } from 'lucide-react';

// Generic, role-aware sidebar. Every layout passes in its own nav config —
// the component itself has no idea which role is looking at it.
const Sidebar = ({ navItems, basePath, roleLabel, open, onClose }) => {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-gray-900 text-gray-100 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))]">
              <Dumbbell className="h-5 w-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-wide">GymDesk</p>
              <p className="text-[11px] text-gray-400">{roleLabel}</p>
            </div>
          </div>
          <button className="lg:hidden text-gray-400 hover:text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-4 space-y-1 px-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
          {navItems.map(({ key, label, path, icon: Icon }) => (
            <NavLink
              key={key}
              to={`${basePath}/${path}`.replace(/\/+$/, '') || basePath}
              end={path === ''}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[linear-gradient(135deg,rgb(45,212,191),rgb(13,148,136))] text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
              onClick={onClose}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
