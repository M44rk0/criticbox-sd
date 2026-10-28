import React, { useState } from 'react';
import { Eye, Heart } from 'lucide-react';
import { useActivity } from '../context/ActivityContext';
import './PosterQuickActions.css';

export default function PosterQuickActions({
  tmdbId,
  mediaType = 'movie',
  title = '',
  posterUrl = '',
  userRating,
  hasReview,
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

  // Determina se a obra possui avaliação registrada e extrai a nota para exibição no canto superior direito
  const isEvaluated = hasReview !== undefined ? Boolean(hasReview) : Boolean(status.has_review);
  const rawScore = userRating !== undefined ? Number(userRating) : Number(status.user_rating);
  const ratingToDisplay = isEvaluated && rawScore > 0 ? rawScore : 0;

  return (
    <>
      {ratingToDisplay > 0 && (
        <div
          className="poster-rating-badge"
          title={`Sua avaliação: ${ratingToDisplay.toFixed(1)}`}
          aria-label={`Avaliação: ${ratingToDisplay.toFixed(1)}`}
        >
          <span className="poster-rating-star">★</span>
          <span className="poster-rating-val">{ratingToDisplay.toFixed(1)}</span>
        </div>
      )}

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
  </>
);
}
