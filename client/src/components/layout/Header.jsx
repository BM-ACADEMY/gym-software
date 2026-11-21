import { useT, LANGUAGES } from '../../i18n';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { logout, selectCurrentUser } from '../../store/slices/authSlice';

const Header = ({ onMenuClick, title }) => {
  const { t, lang, setLanguage } = useT();
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
        {title && <h1 className="text-lg font-semibold text-gray-800">{t(title)}</h1>}
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
            <label className="block px-4 pt-2 text-xs font-medium text-gray-400">{t('Language')}</label>
            <select
              value={lang}
              onChange={(e) => setLanguage(e.target.value)}
              className="mx-3 mb-2 mt-1 w-[calc(100%-1.5rem)] rounded border border-gray-200 px-2 py-1 text-sm text-gray-700"
            >
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <a href="/help" target="_blank" rel="noreferrer" className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{t('Help centre')}</a>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4" />
              {t('Logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
