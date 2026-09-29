import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Film } from 'lucide-react';
import ReviewComment from './ReviewComment';
import { formatReviewDate } from '../utils/date';

export default function ReviewCard({ review, posterUrl, showPoster = false }) {
  const navigate = useNavigate();

  if (showPoster) {
    return (
      <div className="review-card review-card-with-poster">
        <div
          className="review-card-poster"
          onClick={() => navigate(`/movie/${review.tmdb_id}?type=${review.media_type || 'movie'}`)}
          title={`Ver detalhes de ${review.movie_title || 'Título'}`}
        >
          {posterUrl ? (
            <img src={posterUrl} alt={review.movie_title || 'Poster'} loading="lazy" />
          ) : (
            <div className="review-card-poster-placeholder">
              <Film size={26} color="var(--gray-500)" />
            </div>
          )}
        </div>
        <div className="review-card-body">
          <div className="review-card-header">
            <span
              className="review-card-movie"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate(`/movie/${review.tmdb_id}?type=${review.media_type || 'movie'}`)}
            >
              {review.movie_title || `Título #${review.tmdb_id}`}
              {review.season_number && review.episode_number ? (
                <span className="review-scope-chip">
                  T{review.season_number < 10 ? `0${review.season_number}` : review.season_number}E
                  {review.episode_number < 10 ? `0${review.episode_number}` : review.episode_number}
                </span>
              ) : review.season_number ? (
                <span className="review-scope-chip">T{review.season_number}</span>
              ) : review.media_type === 'tv' ? (
                <span className="review-scope-chip">SÉRIE</span>
              ) : null}
            </span>
            <div className="review-card-stars">
              <span className="review-card-score-badge">{review.rating ? review.rating.toFixed(1) : '-'}</span>
              {[1, 2, 3, 4, 5].map((i) => {
                const isFilled = i <= Math.round(review.rating || 0);
                return (
                  <Star
                    key={i}
                    size={13}
                    fill={isFilled ? 'var(--accent)' : 'none'}
                    color={isFilled ? 'var(--accent)' : 'var(--gray-700)'}
                  />
                );
              })}
            </div>
          </div>
          <ReviewComment comment={review.comment} containsSpoilers={review.contains_spoilers} />
          <div className="review-card-user">
            <span className="review-card-avatar">{(review.user_id || 'U')[0].toUpperCase()}</span>
            <span className="review-card-username">@{review.user_id}</span>
            <span className="review-card-date">{formatReviewDate(review.created_at)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Detail Page layout (without poster)
  return (
    <div className="review-card">
      <div className="review-card-body">
        <div className="review-card-header">
          <div className="movie-review-author-info">
            <span className="review-card-avatar">{(review.user_id || 'U')[0].toUpperCase()}</span>
            <span className="review-card-username">@{review.user_id}</span>
            {review.season_number && review.episode_number ? (
              <span className="review-scope-chip">
                T{review.season_number < 10 ? `0${review.season_number}` : review.season_number}E
                {review.episode_number < 10 ? `0${review.episode_number}` : review.episode_number}
              </span>
            ) : review.season_number ? (
              <span className="review-scope-chip">T{review.season_number}</span>
            ) : review.media_type === 'tv' ? (
              <span className="review-scope-chip">SÉRIE</span>
            ) : null}
          </div>
          <div className="movie-review-rating-wrap">
            <div className="review-card-stars">
              {[1, 2, 3, 4, 5].map((i) => {
                const isFilled = i <= Math.round(review.rating || 0);
                return (
                  <Star
                    key={i}
                    size={13}
                    fill={isFilled ? 'var(--accent)' : 'none'}
                    color={isFilled ? 'var(--accent)' : 'var(--gray-700)'}
                  />
                );
              })}
            </div>
            <span className="review-card-score-badge">{review.rating ? review.rating.toFixed(1) : '-'}</span>
          </div>
        </div>

        <ReviewComment comment={review.comment} containsSpoilers={review.contains_spoilers} />

        <div className="movie-review-footer">
          <span className="review-card-date">{formatReviewDate(review.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
