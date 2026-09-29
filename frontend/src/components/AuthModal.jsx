import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const { authModalOpen, authMode, setAuthMode, closeAuth, login, register } = useAuth();
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!authModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    try {
      if (authMode === 'login') {
        await login(authUsername, authPassword);
      } else {
        await register(authUsername, authPassword);
      }
      setAuthUsername('');
      setAuthPassword('');
    } catch (err) {
      setAuthError(err.message || 'Falha ao processar solicitação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="auth-modal-overlay active"
      onClick={(e) => {
        if (e.target.classList.contains('auth-modal-overlay')) closeAuth();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span className="nav-logo" style={{ fontSize: '1rem' }}>
            CRITICBOX // CONTA
          </span>
          <button className="v1-close-btn" onClick={closeAuth} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('login');
              setAuthError('');
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setAuthMode('register');
              setAuthError('');
            }}
          >
            Criar Conta
          </button>
        </div>
        {authError && <div className="auth-error">{authError}</div>}
        <form onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label htmlFor="auth-username">Nome de Usuário</label>
            <input
              type="text"
              id="auth-username"
              required
              placeholder="ex: cinemanerd"
              autoComplete="username"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
            />
          </div>
          <div className="auth-input-group">
            <label htmlFor="auth-password">Senha</label>
            <input
              type="password"
              id="auth-password"
              required
              placeholder="Mínimo 6 caracteres"
              autoComplete="current-password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="v1-submit-btn"
            style={{ width: '100%', marginTop: '10px' }}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'PROCESSANDO...'
              : authMode === 'login'
              ? 'ENTRAR NA CONTA'
              : 'CRIAR CONTA'}
          </button>
        </form>
      </div>
    </div>
  );
}
