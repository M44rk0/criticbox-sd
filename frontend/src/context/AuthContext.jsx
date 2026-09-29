import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser } from '../api/auth';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { showToast } = useToast();
  const [token, setToken] = useState(() => localStorage.getItem('criticbox_token') || '');
  const [username, setUsername] = useState(() => localStorage.getItem('criticbox_user') || '');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'

  useEffect(() => {
    if (token) {
      localStorage.setItem('criticbox_token', token);
    } else {
      localStorage.removeItem('criticbox_token');
    }
    if (username) {
      localStorage.setItem('criticbox_user', username);
    } else {
      localStorage.removeItem('criticbox_user');
    }
  }, [token, username]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setToken('');
      setUsername('');
      showToast('Sessão expirada. Faça login novamente.', true);
      openAuth('login');
    };

    window.addEventListener('criticbox:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('criticbox:unauthorized', handleUnauthorized);
  }, []);

  const openAuth = (mode = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuth = () => {
    setAuthModalOpen(false);
  };

  const login = async (user, pass) => {
    const data = await loginUser(user, pass);
    setToken(data.access_token);
    setUsername(data.username);
    closeAuth();
    showToast(`Bem-vindo(a), @${data.username}!`, false);
    return data;
  };

  const register = async (user, pass) => {
    const data = await registerUser(user, pass);
    setToken(data.access_token);
    setUsername(data.username);
    closeAuth();
    showToast(`Conta criada com sucesso! @${data.username}`, false);
    return data;
  };

  const logout = () => {
    setToken('');
    setUsername('');
    showToast('Sessão encerrada com sucesso.', false);
  };

  const value = {
    token,
    username,
    isLoggedIn: Boolean(token),
    authModalOpen,
    authMode,
    setAuthMode,
    openAuth,
    closeAuth,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
