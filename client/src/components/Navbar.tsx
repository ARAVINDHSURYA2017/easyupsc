import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
    setProfileOpen(false);
  }

  const active = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')
      ? 'text-primary-600 font-semibold'
      : 'text-gray-600 hover:text-primary-600';

  if (!user) return null;

  const studentLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/series', label: 'Test Series' },
    { to: '/pyq', label: 'PYQ Bank' },
    { to: '/tests', label: 'All Tests' },
    { to: '/history', label: 'My History' },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/tests', label: 'Tests' },
    { to: '/admin/questions', label: 'Question Bank' },
    { to: '/admin/ai-upload', label: '✨ AI Upload' },
    { to: '/admin/users', label: 'Users' },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo + nav links */}
          <div className="flex items-center gap-8">
            <Link to={isAdmin ? '/admin' : '/dashboard'} className="text-xl font-bold text-primary-600 tracking-tight flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              TestPro
            </Link>
            <div className="hidden md:flex items-center gap-1 text-sm">
              {links.map(l => (
                <Link key={l.to} to={l.to} className={`px-3 py-1.5 rounded-lg transition ${active(l.to)}`}>{l.label}</Link>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Profile dropdown */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-700 font-medium max-w-[120px] truncate">{user.name}</span>
                {isAdmin && <span className="badge-blue text-xs">Admin</span>}
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20">
                    {!isAdmin && (
                      <Link to="/profile" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                        <span>👤</span> My Profile
                      </Link>
                    )}
                    {!isAdmin && (
                      <Link to="/history" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                        <span>📋</span> My Attempts
                      </Link>
                    )}
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50 w-full text-left">
                      <span>🚪</span> Logout
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden py-3 border-t border-gray-100 flex flex-col gap-1 text-sm">
            {links.map(l => (
              <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
                className={`px-3 py-2 rounded-lg ${active(l.to)}`}>{l.label}</Link>
            ))}
            <div className="border-t border-gray-100 my-2" />
            {!isAdmin && (
              <Link to="/profile" onClick={() => setMenuOpen(false)} className="px-3 py-2 text-gray-700 hover:text-primary-600">👤 My Profile</Link>
            )}
            <button onClick={handleLogout} className="px-3 py-2 text-danger-600 text-left hover:bg-danger-50 rounded-lg">🚪 Logout</button>
          </div>
        )}
      </div>
    </nav>
  );
}
