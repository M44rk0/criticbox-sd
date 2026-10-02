import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ initialMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, username, login, register, logout } = useAuth();

  const routeMode =
    initialMode ||
    (location.pathname === '/register'
      ? 'register'
      : location.pathname === '/login'
      ? 'login'
      : new URLSearchParams(location.search).get('mode') === 'register'
      ? 'register'
      : 'login');

  const [authMode, setAuthMode] = useState(routeMode);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const usernameInputRef = useRef(null);

  const prevPath = useRef(location.pathname);
  if (prevPath.current !== location.pathname) {
    prevPath.current = location.pathname;
    if (location.pathname === '/register' && authMode !== 'register') {
      setAuthMode('register');
    } else if (location.pathname === '/login' && authMode !== 'login') {
      setAuthMode('login');
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      usernameInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [authMode]);

  const handleSwitchMode = (newMode) => {
    setAuthMode(newMode);
    setAuthError('');
    setAuthConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);

    const searchParams = new URLSearchParams(location.search);
    const redirectParam = searchParams.get('redirect');
    const redirectSuffix = redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : '';

    if (newMode === 'register') {
      navigate(`/register${redirectSuffix}`, { replace: true });
    } else {
      navigate(`/login${redirectSuffix}`, { replace: true });
    }
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
      setAuthError('O nome de usuário deve ter no mínimo 3 caracteres.');
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
      const searchParams = new URLSearchParams(location.search);
      const redirectTarget = searchParams.get('redirect') || '/';
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setAuthError(err.message || 'Falha na autenticação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-clean-page">
      <div className="auth-clean-container">
        {/* Link voltar discreto */}
        <Link to="/" className="auth-clean-back">
          <ArrowLeft size={13} />
          <span>Voltar ao catálogo</span>
        </Link>

        {isLoggedIn ? (
          <div className="auth-clean-card">
            <div className="auth-clean-header">
              <span className="nav-logo" style={{ fontSize: '1.1rem' }}>CRITICBOX</span>
              <h1 className="auth-clean-title" style={{ marginTop: '12px' }}>SESSÃO ATIVA</h1>
              <p className="auth-clean-sub">
                Conectado como <strong style={{ color: 'var(--accent)' }}>@{username}</strong>
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="hero-btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => navigate('/')}
              >
                <span>IR PARA O CATÁLOGO</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                className="nav-btn-ghost"
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                onClick={logout}
              >
                <LogOut size={13} />
                <span>SAIR DA CONTA</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="auth-clean-card">
            {/* Topbar com logo */}
            <div className="auth-clean-header">
              <Link to="/" style={{ textDecoration: 'none' }}>
                <span className="nav-logo" style={{ fontSize: '1.25rem' }}>CRITICBOX</span>
              </Link>
              <h1 className="auth-clean-title">
                {authMode === 'login' ? 'ENTRAR NA CONTA' : 'CRIAR CONTA'}
              </h1>
              <p className="auth-clean-sub">
                {authMode === 'login'
                  ? 'Acesse seu acervo de críticas e notas.'
                  : 'Participe da comunidade e avalie filmes e séries.'}
              </p>
            </div>



            {/* Mensagem de Erro */}
            {authError && (
              <div className="auth-clean-error" role="alert">
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{authError}</span>
              </div>
            )}

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="auth-clean-form" noValidate>
              <div className="auth-clean-field">
                <label htmlFor="clean-username">Nome de usuário</label>
                <div className="auth-clean-input-wrap">
                  <span className="auth-clean-icon">
                    <User size={15} />
                  </span>
                  <input
                    ref={usernameInputRef}
                    id="clean-username"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="Seu usuário"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="auth-clean-field">
                <label htmlFor="clean-password">Senha</label>
                <div className="auth-clean-input-wrap">
                  <span className="auth-clean-icon">
                    <Lock size={15} />
                  </span>
                  <input
                    id="clean-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="Mínimo 6 caracteres"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="auth-clean-pw-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {authMode === 'register' && (
                <div className="auth-clean-field">
                  <label htmlFor="clean-confirm-password">Confirmar senha</label>
                  <div className="auth-clean-input-wrap">
                    <span className="auth-clean-icon">
                      <Lock size={15} />
                    </span>
                    <input
                      id="clean-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Repita sua senha"
                      value={authConfirmPassword}
                      onChange={(e) => setAuthConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="auth-clean-pw-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
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

            {/* Alternar modo */}
            <div className="auth-clean-footer">
              <span>
                {authMode === 'login'
                  ? 'Não tem uma conta?'
                  : 'Já possui uma conta?'}
              </span>
              <button
                type="button"
                className="auth-clean-switch"
                onClick={() => handleSwitchMode(authMode === 'login' ? 'register' : 'login')}
              >
                {authMode === 'login' ? 'Cadastre-se' : 'Entrar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
