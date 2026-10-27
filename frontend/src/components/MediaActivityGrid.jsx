import React from 'react';
import PosterQuickActions from './PosterQuickActions';
import { getMediaTypeLabel } from '../utils/media';

export default function MediaActivityGrid({
  items = [],
  posters = {},
  onNavigate,
  itemPrefix = 'media',
}) {
  return (
    <div className="movies-grid">
      {items.map((item, idx) => {
        const tmdbId = item.tmdb_id;
        const mediaType = item.media_type || 'movie';
        const title = item.movie_title || item.title || `Título #${tmdbId}`;
        const poster =
          item.poster_url ||
          posters[`${tmdbId}_${mediaType}`] ||
          posters[tmdbId] ||
          'https://via.placeholder.com/500x750?text=Sem+Poster';
        const hasReview = Boolean(item.has_review);
        const userRating = Number(item.user_rating) || 0;

        return (
          <div
            key={`${itemPrefix}_${tmdbId}_${mediaType}_${idx}`}
            className="movie-card"
            onClick={() => onNavigate(tmdbId, mediaType)}
            title={`Ver detalhes de ${title}`}
          >
            <div className="movie-card-poster">
              <img src={poster} alt={title} loading="lazy" />

              <PosterQuickActions
                tmdbId={tmdbId}
                mediaType={mediaType}
                title={title}
                posterUrl={poster}
              />
            </div>

            <div className="movie-card-info">
              <div className="movie-card-topline">
                <span className="movie-card-tag">{getMediaTypeLabel(item)}</span>
                {hasReview && (
                  <span className="movie-card-score-pill movie-card-cb-pill">
                    <span className="cb-square-icon" aria-hidden="true">■</span> {userRating.toFixed(1)}
                  </span>
                )}
              </div>
              <h3 className="movie-card-title">{title}</h3>
            </div>
          </div>
        );
      })}
    </div>
  );
}
