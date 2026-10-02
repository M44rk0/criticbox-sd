import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Eye, EyeOff, User, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authModalOpen, authMode, setAuthMode, closeAuth, login, register } = useAuth();

  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usernameInputRef = useRef(null);

  // Auto-focus username on open or mode switch
  useEffect(() => {
    if (authModalOpen) {
      setAuthError('');
      const timer = setTimeout(() => {
        usernameInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [authModalOpen, authMode]);

  // Handle ESC key to close
  useEffect(() => {
    if (!authModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authModalOpen]);

  if (!authModalOpen) return null;

  const handleClose = () => {
    closeAuth();
    if (location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/auth') {
      navigate('/', { replace: true });
    }
  };

  const switchMode = (mode) => {
    setAuthMode(mode);
    setAuthError('');
    setAuthConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    const cleanUsername = authUsername.trim();
    if (!cleanUsername) {
      setAuthError('Informe o nome de usuário.');
      return;
    }
    if (cleanUsername.length < 3) {
      setAuthError('O nome de usuário deve conter no mínimo 3 caracteres.');
      return;
    }
    if (!authPassword) {
      setAuthError('Informe a senha.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (authMode === 'register' && authPassword !== authConfirmPassword) {
      setAuthError('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === 'login') {
        await login(cleanUsername, authPassword);
      } else {
        await register(cleanUsername, authPassword);
      }
      setAuthUsername('');
      setAuthPassword('');
      setAuthConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      handleClose();
    } catch (err) {
      setAuthError(err.message || 'Falha na autenticação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="auth-modal-overlay active"
      onClick={(e) => {
        if (e.target.classList.contains('auth-modal-overlay')) handleClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        {/* Topbar com logo e botão fechar */}
        <div className="auth-topbar">
          <span className="nav-logo" style={{ fontSize: '1.05rem' }}>
            CRITICBOX
          </span>
          <button
            type="button"
            className="v1-close-btn"
            onClick={handleClose}
            aria-label="Fechar"
            title="Fechar"
          >
            <X size={15} />
          </button>
        </div>

        {/* Cabeçalho discreto e alinhado */}
        <div className="auth-header-discreet">
          <h2 className="auth-discreet-title">
            {authMode === 'login' ? 'ENTRAR NA CONTA' : 'CRIAR CONTA'}
          </h2>
          <p className="auth-discreet-sub">
            {authMode === 'login'
              ? 'Informe seu usuário e senha para acessar o acervo.'
              : 'Preencha os campos abaixo para criar seu cadastro.'}
          </p>
        </div>

        {authError && (
          <div className="auth-clean-error" role="alert">
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-clean-form" noValidate>
          <div className="auth-clean-field">
            <label htmlFor="modal-username">Nome de usuário</label>
            <div className="auth-clean-input-wrap">
              <span className="auth-clean-icon">
                <User size={15} />
              </span>
              <input
                ref={usernameInputRef}
                type="text"
                id="modal-username"
                required
                placeholder="Seu usuário"
                autoComplete="username"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="auth-clean-field">
            <label htmlFor="modal-password">Senha</label>
            <div className="auth-clean-input-wrap">
              <span className="auth-clean-icon">
                <Lock size={15} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="modal-password"
                required
                placeholder="Mínimo 6 caracteres"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="auth-clean-pw-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {authMode === 'register' && (
            <div className="auth-clean-field">
              <label htmlFor="modal-confirm-password">Confirmar senha</label>
              <div className="auth-clean-input-wrap">
                <span className="auth-clean-icon">
                  <Lock size={15} />
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="modal-confirm-password"
                  required
                  placeholder="Repita sua senha"
                  autoComplete="new-password"
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="auth-clean-pw-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
                  title={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="auth-clean-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              'PROCESSANDO...'
            ) : authMode === 'login' ? (
              <>
                <span>ENTRAR</span>
                <ArrowRight size={14} />
              </>
            ) : (
              <>
                <span>CRIAR CONTA</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <div className="auth-clean-footer">
          <span>
            {authMode === 'login' ? 'Não tem uma conta?' : 'Já possui uma conta?'}
          </span>
          <button
            type="button"
            className="auth-clean-switch"
            onClick={() => switchMode(authMode === 'login' ? 'register' : 'login')}
          >
            {authMode === 'login' ? 'Cadastre-se' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
