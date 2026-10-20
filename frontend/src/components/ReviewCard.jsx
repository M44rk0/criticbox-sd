import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, StarHalf, Film, Trash2 } from 'lucide-react';
import ReviewComment from './ReviewComment';
import { formatReviewDate } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useReviewModal } from '../context/ReviewModalContext';
import { deleteReview } from '../api/reviews';

function renderStars(rating) {
  const score = Number(rating) || 0;
  return [1, 2, 3, 4, 5].map((i) => {
    if (score >= i) {
      return (
        <Star
          key={i}
          size={14}
          fill="var(--accent)"
          color="var(--accent)"
        />
      );
    }
    if (score >= i - 0.5) {
      return (
        <StarHalf
          key={i}
          size={14}
          fill="var(--accent)"
          color="var(--accent)"
        />
      );
    }
    return (
      <Star
        key={i}
        size={14}
        fill="none"
        color="var(--gray-700)"
      />
    );
  });
}

function DeleteActionWidget({ showConfirm, setShowConfirm, isDeleting, onConfirm }) {
  if (showConfirm) {
    return (
      <div className="review-delete-confirm-box" onClick={(e) => e.stopPropagation()}>
        <span className="review-delete-confirm-msg">EXCLUIR?</span>
        <button
          type="button"
          className="review-delete-confirm-btn yes"
          disabled={isDeleting}
          onClick={onConfirm}
        >
          {isDeleting ? '...' : 'SIM'}
        </button>
        <button
          type="button"
          className="review-delete-confirm-btn no"
          disabled={isDeleting}
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(false);
          }}
        >
          NÃO
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="review-delete-btn"
      title="Excluir sua avaliação"
      onClick={(e) => {
        e.stopPropagation();
        setShowConfirm(true);
      }}
    >
      <Trash2 size={12} strokeWidth={2} />
      <span>EXCLUIR</span>
    </button>
  );
}

export default function ReviewCard({
  review,
  posterUrl,
  showPoster = false,
  episodeName = '',
  episodeStillUrl = '',
  onDelete = null,
  canDelete = true,
}) {
  const navigate = useNavigate();
  const { isLoggedIn, username: authUsername, userId: authUserId } = useAuth();
  const { showToast } = useToast();
  const { triggerReviewUpdate } = useReviewModal();

  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isAuthor = Boolean(
    canDelete &&
      isLoggedIn &&
      ((review.username && authUsername && review.username.toLowerCase() === authUsername.toLowerCase()) ||
        (review.user_id && authUserId && review.user_id === authUserId) ||
        (review.user_id && authUsername && review.user_id.toLowerCase() === authUsername.toLowerCase()))
  );

  const handleConfirmDelete = async (e) => {
    e?.stopPropagation();
    setIsDeleting(true);
    try {
      await deleteReview(review.review_id);
      showToast('Avaliação removida com sucesso.', false);
      triggerReviewUpdate();
      if (onDelete) {
        onDelete(review.review_id);
      }
    } catch (err) {
      showToast(err.message || 'Erro ao remover avaliação.', true);
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const episodeCode = review.season_number && review.episode_number
    ? `T${review.season_number < 10 ? `0${review.season_number}` : review.season_number}E${review.episode_number < 10 ? `0${review.episode_number}` : review.episode_number}`
    : review.season_number ? `T${review.season_number}` : null;

  if (showPoster) {
    return (
      <div className={`review-card review-card-with-poster ${episodeStillUrl ? 'review-card-has-still' : ''}`}>
        {episodeStillUrl && (
          <div
            className="review-card-still-backdrop"
            style={{ backgroundImage: `url(${episodeStillUrl})` }}
            aria-hidden="true"
          />
        )}
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
              {episodeCode && (
                <span className="review-scope-chip">
                  {episodeCode}
                </span>
              )}
              {episodeName && (
                <span className="review-episode-name">"{episodeName}"</span>
              )}
            </span>
            <div
              className="review-card-stars"
              title={`${review.rating ? review.rating.toFixed(1) : '0'}/5 estrelas`}
              aria-label={`Nota: ${review.rating ? review.rating.toFixed(1) : '0'} de 5 estrelas`}
            >
              {renderStars(review.rating)}
            </div>
          </div>
          <ReviewComment comment={review.comment} containsSpoilers={review.contains_spoilers} />
          <div className="review-card-user">
            <div className="review-card-user-info">
              <span className="review-card-avatar">{(review.username || review.user_id || 'U')[0].toUpperCase()}</span>
              <span className="review-card-username">@{review.username || review.user_id}</span>
            </div>
            <div className="review-card-user-meta">
              <span className="review-card-date">{formatReviewDate(review.created_at)}</span>
              {isAuthor && (
                <DeleteActionWidget
                  showConfirm={showConfirm}
                  setShowConfirm={setShowConfirm}
                  isDeleting={isDeleting}
                  onConfirm={handleConfirmDelete}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`review-card ${episodeStillUrl ? 'review-card-has-still' : ''}`}>
      {episodeStillUrl && (
        <div
          className="review-card-still-backdrop"
          style={{ backgroundImage: `url(${episodeStillUrl})` }}
          aria-hidden="true"
        />
      )}
      <div className="review-card-body">
        <div className="review-card-header">
          <div className="movie-review-author-info">
            <span className="review-card-avatar">{(review.username || review.user_id || 'U')[0].toUpperCase()}</span>
            <span className="review-card-username">@{review.username || review.user_id}</span>
            {episodeCode && (
              <span className="review-scope-chip">{episodeCode}</span>
            )}
            {episodeName && (
              <span className="review-episode-name" title={episodeName}>
                "{episodeName}"
              </span>
            )}
          </div>
          <div className="movie-review-rating-wrap">
            <div
              className="review-card-stars"
              title={`${review.rating ? review.rating.toFixed(1) : '0'}/5 estrelas`}
              aria-label={`Nota: ${review.rating ? review.rating.toFixed(1) : '0'} de 5 estrelas`}
            >
              {renderStars(review.rating)}
            </div>
          </div>
        </div>

        <ReviewComment comment={review.comment} containsSpoilers={review.contains_spoilers} />

        <div className="movie-review-footer">
          <span className="review-card-date">{formatReviewDate(review.created_at)}</span>
          {isAuthor && (
            <DeleteActionWidget
              showConfirm={showConfirm}
              setShowConfirm={setShowConfirm}
              isDeleting={isDeleting}
              onConfirm={handleConfirmDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
