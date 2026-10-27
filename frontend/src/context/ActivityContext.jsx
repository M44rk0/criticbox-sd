import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import {
  toggleWatched as apiToggleWatched,
  toggleFavorite as apiToggleFavorite,
  getMediaStatus as apiGetMediaStatus,
} from '../api/activity';

const ActivityContext = createContext(null);

export function ActivityProvider({ children }) {
  const { isLoggedIn, openAuth, username } = useAuth();
  const { showToast } = useToast();

  // activityMap: { [`${tmdb_id}_${media_type}`]: { is_watched: boolean, is_favorite: boolean, has_review: boolean, user_rating: number } }
  const [activityMap, setActivityMap] = useState({});
  const [activityRevision, setActivityRevision] = useState(0);

  // Limpa o cache se o usuário deslogar
  useEffect(() => {
    if (!isLoggedIn) {
      setActivityMap({});
    }
  }, [isLoggedIn, username]);

  const getKey = useCallback((tmdbId, mediaType = 'movie') => {
    return `${Number(tmdbId)}_${mediaType || 'movie'}`;
  }, []);

  const getCachedStatus = useCallback(
    (tmdbId, mediaType = 'movie') => {
      const key = getKey(tmdbId, mediaType);
      return activityMap[key] || { is_watched: false, is_favorite: false, has_review: false, user_rating: 0 };
    },
    [activityMap, getKey]
  );

  const fetchStatus = useCallback(
    async (tmdbId, mediaType = 'movie', force = false) => {
      const key = getKey(tmdbId, mediaType);
      if (!force && activityMap[key]) {
        return activityMap[key];
      }
      try {
        const res = await apiGetMediaStatus(tmdbId, mediaType);
        const data = {
          is_watched: Boolean(res.is_watched),
          is_favorite: Boolean(res.is_favorite),
          has_review: Boolean(res.has_review),
          user_rating: Number(res.user_rating) || 0,
        };
        setActivityMap((prev) => ({ ...prev, [key]: data }));
        return data;
      } catch (err) {
        return { is_watched: false, is_favorite: false, has_review: false, user_rating: 0 };
      }
    },
    [activityMap, getKey]
  );

  const seedActivityItems = useCallback(
    (items, itemType) => {
      if (!Array.isArray(items)) return;
      setActivityMap((prev) => {
        const next = { ...prev };
        items.forEach((item) => {
          const key = getKey(item.tmdb_id, item.media_type);
          const current = next[key] || {};
          next[key] = {
            ...current,
            is_watched: itemType === 'watched' ? true : current.is_watched || false,
            is_favorite: itemType === 'favorite' ? true : current.is_favorite || false,
            has_review: item.has_review !== undefined ? Boolean(item.has_review) : current.has_review || false,
            user_rating: Number(item.user_rating) || current.user_rating || 0,
          };
        });
        return next;
      });
    },
    [getKey]
  );

  const toggleWatched = useCallback(
    async ({ tmdbId, mediaType = 'movie', title = '', posterUrl = '' }) => {
      if (!isLoggedIn) {
        showToast('Identifique-se para marcar filmes como assistidos.');
        openAuth('login');
        return false;
      }

      const key = getKey(tmdbId, mediaType);
      let blockedByReview = false;
      let nextWatchedVal = false;
      let originalWatched = false;

      // Atualização otimista funcional sem risco de sobrescrever estados concorrentes
      setActivityMap((prev) => {
        const current = prev[key] || { is_watched: false, is_favorite: false, has_review: false, user_rating: 0 };
        originalWatched = Boolean(current.is_watched);
        if (current.is_watched && current.has_review) {
          blockedByReview = true;
          return prev;
        }
        nextWatchedVal = !current.is_watched;
        return {
          ...prev,
          [key]: {
            ...current,
            is_watched: nextWatchedVal,
          },
        };
      });

      if (blockedByReview) {
        showToast('Este título possui uma crítica registrada e não pode ser desmarcado.', true);
        return false;
      }

      try {
        const res = await apiToggleWatched({
          tmdb_id: tmdbId,
          media_type: mediaType,
          movie_title: title,
          poster_url: posterUrl,
        });
        setActivityMap((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] || {}),
            is_watched: Boolean(res.active),
          },
        }));
        setActivityRevision((rev) => rev + 1);
        if (res.active) {
          showToast(title ? `"${title}" marcado como assistido.` : 'Marcado como assistido.');
        } else {
          showToast(title ? `"${title}" removido dos assistidos.` : 'Removido dos assistidos.');
        }
        return res.active;
      } catch (err) {
        // Rollback pontual sem apagar outras propriedades
        setActivityMap((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] || {}),
            is_watched: originalWatched,
          },
        }));
        showToast(err.message || 'Falha ao atualizar status de assistido.', true);
        return originalWatched;
      }
    },
    [isLoggedIn, openAuth, showToast, getKey]
  );

  const toggleFavorite = useCallback(
    async ({ tmdbId, mediaType = 'movie', title = '', posterUrl = '' }) => {
      if (!isLoggedIn) {
        showToast('Identifique-se para adicionar aos favoritos.');
        openAuth('login');
        return false;
      }

      const key = getKey(tmdbId, mediaType);
      let nextFavoriteVal = false;
      let originalFavorite = false;

      // Atualização otimista funcional sem risco de sobrescrever estados concorrentes
      setActivityMap((prev) => {
        const current = prev[key] || { is_watched: false, is_favorite: false, has_review: false, user_rating: 0 };
        originalFavorite = Boolean(current.is_favorite);
        nextFavoriteVal = !current.is_favorite;
        return {
          ...prev,
          [key]: {
            ...current,
            is_favorite: nextFavoriteVal,
          },
        };
      });

      try {
        const res = await apiToggleFavorite({
          tmdb_id: tmdbId,
          media_type: mediaType,
          movie_title: title,
          poster_url: posterUrl,
        });
        setActivityMap((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] || {}),
            is_favorite: Boolean(res.active),
          },
        }));
        setActivityRevision((rev) => rev + 1);
        if (res.active) {
          showToast(title ? `"${title}" adicionado aos favoritos.` : 'Adicionado aos favoritos.');
        } else {
          showToast(title ? `"${title}" removido dos favoritos.` : 'Removido dos favoritos.');
        }
        return res.active;
      } catch (err) {
        // Rollback pontual sem apagar outras propriedades
        setActivityMap((prev) => ({
          ...prev,
          [key]: {
            ...(prev[key] || {}),
            is_favorite: originalFavorite,
          },
        }));
        showToast(err.message || 'Falha ao atualizar favoritos.', true);
        return originalFavorite;
      }
    },
    [isLoggedIn, openAuth, showToast, getKey]
  );

  return (
    <ActivityContext.Provider
      value={{
        activityMap,
        activityRevision,
        getCachedStatus,
        fetchStatus,
        seedActivityItems,
        toggleWatched,
        toggleFavorite,
      }}
    >
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity deve ser usado dentro de um ActivityProvider');
  }
  return context;
}
