import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { logout, selectCurrentUser } from '../../store/slices/authSlice';

const Header = ({ onMenuClick, title }) => {
  const user = useSelector(selectCurrentUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const initials = (user?.name || user?.gymName || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden text-gray-500 hover:text-gray-800"
          onClick={onMenuClick}
        >
          <Menu className="h-6 w-6" />
        </button>
        {title && <h1 className="text-lg font-semibold text-gray-800">{title}</h1>}
      </div>

      <div className="relative">
        <button
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
            {initials}
          </div>
          <span className="hidden sm:block text-sm font-medium text-gray-700">
            {user?.name || 'Account'}
          </span>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
