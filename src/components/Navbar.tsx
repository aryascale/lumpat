import { useState, useEffect } from 'react';
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
  const { user, logout } = useAuth();

  const isLanding = location.pathname === '/';
  const isLeaderboard = location.pathname === '/leaderboard';
  const isEvents = location.pathname === '/event';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);



  // On landing page: transparent at top, solid on scroll
  // On other pages: always solid
  const isTransparent = isLanding && !scrolled && !mobileMenuOpen;

  const navLinks = [
    { to: '/leaderboard', label: 'Leaderboard', isActive: isLeaderboard },
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


          {user ? (
            <div className="flex items-center gap-4 ml-4">
              <Link to="/profile" className={`navbar-sticky__link ${isTransparent ? 'navbar-sticky__link--light' : ''} font-bold`}>
                Profile ({user.username || user.name || 'User'})
              </Link>
              <button
                onClick={() => { logout(); navigate('/'); }}
                className={`navbar-sticky__link ${isTransparent ? 'navbar-sticky__link--light' : ''} text-red-500 font-bold`}
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4 ml-4">
              <Link to="/login" className={`navbar-sticky__link ${isTransparent ? 'navbar-sticky__link--light' : ''} font-bold`}>
                Login
              </Link>
              <Link to="/register" className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-full text-sm font-bold transition-colors shadow-sm">
                Register
              </Link>
            </div>
          )}

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

        {user ? (
          <>
            <Link
              to="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="navbar-sticky__mobile-link"
            >
              Profile ({user.username || user.name || 'User'})
            </Link>
            <button
              onClick={() => { logout(); setMobileMenuOpen(false); navigate('/'); }}
              className="navbar-sticky__mobile-link text-red-500 font-bold w-full text-left"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="navbar-sticky__mobile-link font-bold"
            >
              Login
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="navbar-sticky__mobile-link text-red-500 font-bold"
            >
              Register
            </Link>
          </>
        )}

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
