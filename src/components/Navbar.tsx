import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavbarProps {
  showAdminButton?: boolean;
}

export default function Navbar({ showAdminButton = false }: NavbarProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isLanding = location.pathname === '/';
  const isLeaderboard = location.pathname === '/leaderboard';
  const isEvents = location.pathname === '/event';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Language translation handler
  const [currentLang, setCurrentLang] = useState('ENG');
  
  useEffect(() => {
    // Check current language from google translate cookie if present
    const match = document.cookie.match(/(?:^|;)\s*googtrans=([^;]*)/);
    if (match && match[1] === '/en/id') {
      setCurrentLang('IDN');
    }
  }, []);

  const toggleLanguage = (lang: 'ENG' | 'IDN') => {
    if (lang === 'ENG') {
      document.cookie = `googtrans=/en/en; path=/; domain=${window.location.hostname}`;
      document.cookie = `googtrans=/en/en; path=/`;
    } else {
      document.cookie = `googtrans=/en/id; path=/; domain=${window.location.hostname}`;
      document.cookie = `googtrans=/en/id; path=/`;
    }
    window.location.reload();
  };

  // On landing page: transparent at top, solid on scroll
  // On other pages: always solid
  const isTransparent = isLanding && !scrolled && !mobileMenuOpen;

  const navLinks = [
    { to: '/leaderboard', label: 'Leaderboard', isActive: isLeaderboard },
    { to: '/apaya', label: 'Apa ya', isActive: isEvents },
  ];

  return (
    <nav
      className={`navbar-sticky ${isTransparent ? 'navbar-sticky--transparent' : 'navbar-sticky--solid'}`}
    >
      <div className="navbar-sticky__inner">
        {/* Logo */}
        <Link to="/" className="navbar-sticky__logo">
          <img src="/Assets/logo2.gif" alt="IJT Logo" className="navbar-sticky__logo-img" />
        </Link>

        {/* Desktop Navigation */}
        <div className="navbar-sticky__links">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`navbar-sticky__link ${
                link.isActive ? 'navbar-sticky__link--active' : ''
              } ${isTransparent ? 'navbar-sticky__link--light' : ''}`}
            >
              {link.label}
            </Link>
          ))}
          {/* Language Toggle */}
          <div className="flex items-center bg-stone-900 rounded-full p-1 ml-4 shadow-inner border border-stone-800">
            <button
              onClick={() => toggleLanguage('ENG')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                currentLang === 'ENG' 
                  ? 'bg-red-600 text-white shadow-md' 
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              ENG
            </button>
            <button
              onClick={() => toggleLanguage('IDN')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                currentLang === 'IDN' 
                  ? 'bg-red-600 text-white shadow-md' 
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              IDN
            </button>
          </div>

          {showAdminButton && (
            <Link
              to="/admin/overview"
              className="navbar-sticky__admin-btn"
            >
              Admin
            </Link>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`navbar-sticky__hamburger ${isTransparent ? 'navbar-sticky__hamburger--light' : ''}`}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`navbar-sticky__mobile ${mobileMenuOpen ? 'navbar-sticky__mobile--open' : ''}`}>
        {navLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            onClick={() => setMobileMenuOpen(false)}
            className={`navbar-sticky__mobile-link ${
              link.isActive ? 'navbar-sticky__mobile-link--active' : ''
            }`}
          >
            {link.label}
          </Link>
        ))}

        {showAdminButton && (
          <Link
            to="/admin/overview"
            onClick={() => setMobileMenuOpen(false)}
            className="navbar-sticky__admin-btn navbar-sticky__admin-btn--mobile"
          >
            Admin
          </Link>
        )}
      </div>
    </nav>
  );
}
