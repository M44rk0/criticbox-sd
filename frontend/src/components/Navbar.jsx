import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, LogIn, UserPlus, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, username, avatarUrl, openAuth, logout } = useAuth();
  const [navSearch, setNavSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Fecha menus ao mudar de rota
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && navSearch.trim()) {
      navigate(`/search?q=${encodeURIComponent(navSearch.trim())}`);
      setNavSearch('');
      setMobileSearchOpen(false);
    }
  };

  const handleMobileSearchSubmit = (e) => {
    e.preventDefault();
    if (navSearch.trim()) {
      navigate(`/search?q=${encodeURIComponent(navSearch.trim())}`);
      setNavSearch('');
      setMobileSearchOpen(false);
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="nav-left">
          <span
            className="nav-logo"
            onClick={() => {
              navigate('/');
              setMobileMenuOpen(false);
            }}
          >
            CRITICBOX
          </span>
          <ul className="nav-links">
            <li>
              <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
                INÍCIO
              </Link>
            </li>
            <li>
              <Link
                to="/minha-caixa"
                className={`nav-link ${location.pathname === '/minha-caixa' ? 'active' : ''}`}
              >
                MINHA CAIXA
              </Link>
            </li>
          </ul>
        </div>

        {/* DESKTOP RIGHT */}
        <div className="nav-right nav-desktop-only">
          <div className="nav-search">
            <span className="nav-search-icon" style={{ display: 'flex', alignItems: 'center' }}>
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Buscar filmes (Pressione Enter)..."
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          {!isLoggedIn ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="nav-btn nav-btn-ghost" onClick={() => openAuth('login')}>
                <LogIn size={13} style={{ marginRight: '6px' }} />
                ENTRAR
              </button>
              <button className="nav-btn nav-btn-accent" onClick={() => openAuth('register')}>
                <UserPlus size={13} style={{ marginRight: '6px' }} />
                CRIAR CONTA
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="nav-user-avatar-btn"
                onClick={() => navigate(`/user/${username}`)}
                title={`Perfil de @${username}`}
                aria-label={`Perfil de @${username}`}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={username} className="nav-user-avatar-img" />
                ) : (
                  <span className="nav-user-avatar-initial">{(username || 'U')[0].toUpperCase()}</span>
                )}
              </button>
              <button className="nav-btn nav-btn-ghost" onClick={logout}>
                <LogOut size={13} style={{ marginRight: '6px' }} />
                SAIR
              </button>
            </div>
          )}
        </div>

        {/* MOBILE CONTROLS BAR (ONLY VISIBLE ON MOBILE) */}
        <div className="nav-mobile-controls">
          <button
            type="button"
            className={`nav-mobile-icon-btn ${mobileSearchOpen ? 'active' : ''}`}
            onClick={() => {
              setMobileSearchOpen(!mobileSearchOpen);
              if (mobileMenuOpen) setMobileMenuOpen(false);
            }}
            aria-label="Buscar títulos"
            title="Buscar"
          >
            <Search size={18} />
          </button>

          {isLoggedIn && (
            <button
              type="button"
              className="nav-user-avatar-btn nav-mobile-avatar-btn"
              onClick={() => {
                navigate(`/user/${username}`);
                setMobileMenuOpen(false);
              }}
              title={`Perfil de @${username}`}
              aria-label={`Perfil de @${username}`}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={username} className="nav-user-avatar-img" />
              ) : (
                <span className="nav-user-avatar-initial">{(username || 'U')[0].toUpperCase()}</span>
              )}
            </button>
          )}

          <button
            type="button"
            className="nav-mobile-icon-btn nav-mobile-burger"
            onClick={() => {
              setMobileMenuOpen(!mobileMenuOpen);
              if (mobileSearchOpen) setMobileSearchOpen(false);
            }}
            aria-label={mobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* MOBILE SEARCH BAR DROPDOWN */}
      {mobileSearchOpen && (
        <form className="nav-mobile-search-dropdown" onSubmit={handleMobileSearchSubmit}>
          <div className="nav-mobile-search-input-wrap">
            <Search size={16} className="nav-mobile-search-icon" />
            <input
              type="text"
              className="nav-mobile-search-input"
              placeholder="Buscar filmes, séries e animes..."
              value={navSearch}
              autoFocus
              onChange={(e) => setNavSearch(e.target.value)}
            />
            {navSearch && (
              <button
                type="button"
                className="nav-mobile-search-clear"
                onClick={() => setNavSearch('')}
                aria-label="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button type="submit" className="nav-mobile-search-submit">
            BUSCAR
          </button>
        </form>
      )}

      {/* MOBILE MENU DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <>
          <div
            className="nav-mobile-drawer-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="nav-mobile-drawer" role="dialog" aria-modal="true" aria-label="Menu principal">
            <div className="nav-mobile-drawer-header">
              <span className="nav-mobile-drawer-tag">NAVEGAÇÃO DO CATÁLOGO</span>
              <button
                type="button"
                className="nav-mobile-drawer-close"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            </div>

            <ul className="nav-mobile-drawer-links">
              <li>
                <Link
                  to="/"
                  className={`nav-mobile-drawer-link ${location.pathname === '/' ? 'active' : ''}`}
                >
                  <span>INÍCIO</span>
                  <span className="nav-mobile-drawer-arrow">→</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/minha-caixa"
                  className={`nav-mobile-drawer-link ${location.pathname === '/minha-caixa' ? 'active' : ''}`}
                >
                  <span>MINHA CAIXA</span>
                  <span className="nav-mobile-drawer-arrow">→</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/search"
                  className={`nav-mobile-drawer-link ${location.pathname === '/search' ? 'active' : ''}`}
                >
                  <span>BUSCAR TÍTULOS</span>
                  <span className="nav-mobile-drawer-arrow">→</span>
                </Link>
              </li>
            </ul>

            <div className="nav-mobile-drawer-footer">
              {!isLoggedIn ? (
                <div className="nav-mobile-auth-actions">
                  <button
                    className="nav-btn nav-btn-ghost nav-mobile-btn-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuth('login');
                    }}
                  >
                    <LogIn size={15} style={{ marginRight: '8px' }} />
                    ENTRAR
                  </button>
                  <button
                    className="nav-btn nav-btn-accent nav-mobile-btn-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuth('register');
                    }}
                  >
                    <UserPlus size={15} style={{ marginRight: '8px' }} />
                    CRIAR CONTA
                  </button>
                </div>
              ) : (
                <div className="nav-mobile-user-box">
                  <div
                    className="nav-mobile-user-profile-row"
                    onClick={() => {
                      navigate(`/user/${username}`);
                      setMobileMenuOpen(false);
                    }}
                  >
                    <div className="nav-user-avatar-btn">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={username} className="nav-user-avatar-img" />
                      ) : (
                        <span className="nav-user-avatar-initial">{(username || 'U')[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="nav-mobile-user-info">
                      <span className="nav-mobile-user-label">LOGADO COMO</span>
                      <span className="nav-mobile-user-name">@{username}</span>
                    </div>
                  </div>

                  <button
                    className="nav-btn nav-btn-ghost nav-mobile-btn-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={15} style={{ marginRight: '8px' }} />
                    SAIR DA CONTA
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
