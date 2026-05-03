import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  showAdminButton?: boolean;
}

export default function Navbar({ showAdminButton = false }: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, logout } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isLanding = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isTransparent = isLanding && !scrolled && !mobileMenuOpen;
  const initials = user ? ((user as any)?.name || user.username || user.email || '?').charAt(0).toUpperCase() : '';

  const navLinks = [
    { to: '/event', label: 'Events' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isTransparent ? 'bg-transparent' : 'bg-white/95 backdrop-blur-xl border-b border-gray-100 shadow-sm'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-1 shrink-0">
          <img src="/Assets/logo2.gif" alt="Logo" className="h-40 w-40 sm:h-25 sm:w-25 rounded-xl" />
          <span className={`text-3xl sm:text-3xl font-black tracking-tighter hidden sm:block ${isTransparent ? 'text-white' : 'text-gray-900'}`}>Lumpat</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? isTransparent ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-900'
                  : isTransparent ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >{link.label}</Link>
          ))}
        </div>

        {/* Right Side */}
        <div className="hidden md:flex items-center gap-3">
          {showAdminButton && (
            <Link to="/admin/overview" className="px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors">Admin</Link>
          )}

          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setProfileOpen(!profileOpen)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors ${isTransparent ? 'hover:bg-white/10' : 'hover:bg-gray-50'}`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                  {initials}
                </div>
                <span className={`text-sm font-medium max-w-[100px] truncate ${isTransparent ? 'text-white' : 'text-gray-700'}`}>{user.username || 'User'}</span>
                <svg className={`w-4 h-4 transition-transform ${profileOpen ? 'rotate-180' : ''} ${isTransparent ? 'text-white/70' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-in">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">{(user as any)?.name || user.username}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <div className="py-1">
                    <Link to="/profile" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      My Profile
                    </Link>
                    <Link to="/event" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      My Events
                    </Link>
                    {user.role === 'admin' && (
                      <Link to="/admin/overview" onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Admin Panel
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-gray-100 pt-1">
                    <button onClick={() => { logout(); setProfileOpen(false); navigate('/'); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isTransparent ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}>Sign In</Link>
              <Link to="/register" className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">Register</Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`md:hidden w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${isTransparent ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}>
          {mobileMenuOpen
            ? <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            : <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          }
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(link => (
              <Link key={link.to} to={link.to} onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${location.pathname === link.to ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}>
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <div className="border-t border-gray-100 my-2" />
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-sm font-bold">{initials}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{user.username}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-gray-600 hover:bg-gray-50">My Profile</Link>
                {user.role === 'admin' && <Link to="/admin/overview" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Admin Panel</Link>}
                <button onClick={() => { logout(); setMobileMenuOpen(false); navigate('/'); }} className="w-full text-left px-4 py-3 rounded-lg text-sm text-red-600 hover:bg-red-50">Sign Out</button>
              </>
            ) : (
              <>
                <div className="border-t border-gray-100 my-2" />
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Sign In</Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50">Register</Link>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`.animate-in { animation: dropIn 0.15s ease-out; } @keyframes dropIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </nav>
  );
}
