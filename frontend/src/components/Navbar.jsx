import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, LogIn, UserPlus, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, username, avatarUrl, openAuth, logout } = useAuth();
  const [navSearch, setNavSearch] = useState('');

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && navSearch.trim()) {
      navigate(`/search?q=${encodeURIComponent(navSearch.trim())}`);
      setNavSearch('');
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-left">
        <span className="nav-logo" onClick={() => navigate('/')}>
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
      <div className="nav-right">
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
    </nav>
  );
}
