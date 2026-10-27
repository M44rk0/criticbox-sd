import React, { useState } from 'react';
import { Eye, Heart } from 'lucide-react';
import { useActivity } from '../context/ActivityContext';

export default function PosterQuickActions({
  tmdbId,
  mediaType = 'movie',
  title = '',
  posterUrl = '',
  className = '',
}) {
  const { getCachedStatus, toggleWatched, toggleFavorite } = useActivity();
  const status = getCachedStatus(tmdbId, mediaType);
  const [busyWatched, setBusyWatched] = useState(false);
  const [busyFavorite, setBusyFavorite] = useState(false);

  const handleWatchedClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (busyWatched) return;
    setBusyWatched(true);
    try {
      await toggleWatched({ tmdbId, mediaType, title, posterUrl });
    } finally {
      setBusyWatched(false);
    }
  };

  const handleFavoriteClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (busyFavorite) return;
    setBusyFavorite(true);
    try {
      await toggleFavorite({ tmdbId, mediaType, title, posterUrl });
    } finally {
      setBusyFavorite(false);
    }
  };

  const isWatched = Boolean(status.is_watched);
  const isFavorite = Boolean(status.is_favorite);

  return (
    <div
      className={`poster-quick-actions ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <button
        type="button"
        className={`poster-action-btn poster-action-watched ${isWatched ? 'active' : ''}`}
        onClick={handleWatchedClick}
        title={isWatched ? 'Assistido (clique para alternar)' : 'Marcar como assistido'}
        aria-label={isWatched ? 'Assistido' : 'Marcar como assistido'}
      >
        <Eye size={13} strokeWidth={isWatched ? 2.4 : 1.8} />
        <span>Assistido</span>
      </button>

      <button
        type="button"
        className={`poster-action-btn poster-action-favorite ${isFavorite ? 'active' : ''}`}
        onClick={handleFavoriteClick}
        title={isFavorite ? 'Favorito (clique para alternar)' : 'Adicionar aos favoritos'}
        aria-label={isFavorite ? 'Favorito' : 'Adicionar aos favoritos'}
      >
        <Heart
          size={13}
          fill={isFavorite ? 'currentColor' : 'none'}
          strokeWidth={isFavorite ? 2.4 : 1.8}
        />
        <span>Favorito</span>
      </button>
    </div>
  );
}
