import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, LogIn, UserPlus, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const navigate = useNavigate();
  const { isLoggedIn, username, openAuth, logout } = useAuth();
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
            <Link to="/" className="nav-link">
              INÍCIO
            </Link>
          </li>
          <li>
            <Link to="/search" className="nav-link">
              BUSCAR
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
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--accent)',
                border: '1px solid var(--accent-border)',
                padding: '5px 12px',
                background: 'var(--accent-dim)',
              }}
            >
              <User size={13} />
              @{username}
            </span>
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
