import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser } from '../api/auth';
import { setClientToken, getClientToken } from '../api/client';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { showToast } = useToast();
  const [token, setToken] = useState(() => getClientToken());
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('criticbox_user') || '';
    } catch (e) {
      return '';
    }
  });
  const [userId, setUserId] = useState(() => {
    try {
      return localStorage.getItem('criticbox_user_id') || '';
    } catch (e) {
      return '';
    }
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'

  useEffect(() => {
    const handleUnauthorized = () => {
      setClientToken('');
      setToken('');
      setUsername('');
      setUserId('');
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
    setClientToken(data.access_token);
    try {
      localStorage.setItem('criticbox_user', data.username);
      if (data.user_id) localStorage.setItem('criticbox_user_id', data.user_id);
    } catch (e) {}

    setToken(data.access_token);
    setUsername(data.username);
    setUserId(data.user_id || '');
    closeAuth();
    showToast(`Bem-vindo(a), ${data.username}!`, false);
    return data;
  };

  const register = async (user, pass) => {
    const data = await registerUser(user, pass);
    setClientToken(data.access_token);
    try {
      localStorage.setItem('criticbox_user', data.username);
      if (data.user_id) localStorage.setItem('criticbox_user_id', data.user_id);
    } catch (e) {}

    setToken(data.access_token);
    setUsername(data.username);
    setUserId(data.user_id || '');
    closeAuth();
    showToast(`Conta criada com sucesso! ${data.username}`, false);
    return data;
  };

  const logout = () => {
    setClientToken('');
    try {
      localStorage.removeItem('criticbox_user');
      localStorage.removeItem('criticbox_user_id');
    } catch (e) {}
    setToken('');
    setUsername('');
    setUserId('');
    showToast('Sessão encerrada com sucesso.', false);
  };

  const value = {
    token,
    username,
    userId,
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
