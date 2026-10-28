import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser } from '../api/auth';
import { setClientToken, getClientToken } from '../api/client';
import { getUserProfile } from '../api/social';
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
  const [avatarUrl, setAvatarUrl] = useState(() => {
    try {
      return localStorage.getItem('criticbox_avatar') || '';
    } catch (e) {
      return '';
    }
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'

  const updateUserAvatar = useCallback((newUrl) => {
    const cleanUrl = newUrl || '';
    setAvatarUrl(cleanUrl);
    try {
      if (cleanUrl) {
        localStorage.setItem('criticbox_avatar', cleanUrl);
      } else {
        localStorage.removeItem('criticbox_avatar');
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (token && username) {
      getUserProfile(username)
        .then((res) => {
          if (res && res.success !== false) {
            updateUserAvatar(res.avatar_url || '');
          }
        })
        .catch(() => {});
    }
  }, [token, username, updateUserAvatar]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setClientToken('');
      setToken('');
      setUsername('');
      setUserId('');
      updateUserAvatar('');
      showToast('Sessão expirada. Faça login novamente.', true);
      openAuth('login');
    };

    window.addEventListener('criticbox:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('criticbox:unauthorized', handleUnauthorized);
  }, [showToast, updateUserAvatar]);

  const openAuth = (mode = 'login') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuth = () => {
    setAuthModalOpen(false);
  };

  const establishSession = (data, welcomeMessage) => {
    setClientToken(data.access_token);
    try {
      localStorage.setItem('criticbox_user', data.username);
      if (data.user_id) {
        localStorage.setItem('criticbox_user_id', data.user_id);
      } else {
        localStorage.removeItem('criticbox_user_id');
      }
    } catch (e) {}

    updateUserAvatar(data.avatar_url || '');
    setToken(data.access_token);
    setUsername(data.username);
    setUserId(data.user_id || '');
    closeAuth();
    showToast(welcomeMessage, false);
    return data;
  };

  const login = async (user, pass) => {
    const data = await loginUser(user, pass);
    return establishSession(data, `Bem-vindo(a), ${data.username}!`);
  };

  const register = async (user, pass) => {
    const data = await registerUser(user, pass);
    return establishSession(data, `Conta criada com sucesso! ${data.username}`);
  };

  const logout = () => {
    setClientToken('');
    try {
      localStorage.removeItem('criticbox_user');
      localStorage.removeItem('criticbox_user_id');
      localStorage.removeItem('criticbox_avatar');
    } catch (e) {}
    setToken('');
    setUsername('');
    setUserId('');
    setAvatarUrl('');
    showToast('Sessão encerrada com sucesso.', false);
  };

  const value = {
    token,
    username,
    userId,
    avatarUrl,
    updateUserAvatar,
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
