import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  showAdminButton?: boolean;
}

export default function Navbar({ showAdminButton = false }: NavbarProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isLandingOrEvent = location.pathname === '/' || location.pathname === '/event' || location.pathname === '/leaderboard';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isTransparent = isLandingOrEvent && !scrolled && !mobileMenuOpen;

  const navLinks = [
    { to: '#products', label: 'About' },
    { to: '/event', label: 'Events' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isTransparent ? 'bg-transparent' : 'bg-white/95 backdrop-blur-xl border-b border-gray-100 shadow-sm'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-1 shrink-0">
          <span className={`text-xl sm:text-2xl font-black uppercase tracking-widest ${isTransparent ? 'text-white' : 'text-gray-900'}`}>Lumpat</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6 ml-auto mr-8">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to}
              className={`text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? isTransparent ? 'text-white' : 'text-gray-900'
                  : isTransparent ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >{link.label}</Link>
          ))}
        </div>

        {/* Right Side */}
        <div className="hidden md:flex items-center gap-3">
          {showAdminButton && (
            <Link to="/admin/overview" className="px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors">Admin</Link>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
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
          </div>
        </div>
      )}

      <style>{`.animate-in { animation: dropIn 0.15s ease-out; } @keyframes dropIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </nav>
  );
}
