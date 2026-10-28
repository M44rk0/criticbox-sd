import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, StarHalf, Film, Trash2, Users, Tv, MapPin } from 'lucide-react';
import ReviewComment from './ReviewComment';
import { formatReviewDate } from '../utils/date';
import { isAnime as isAnimeUtil, isEpisodic, getCachedMediaMeta } from '../utils/media';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useReviewModal } from '../context/ReviewModalContext';
import { deleteReview } from '../api/reviews';
import './ReviewCard.css';

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
      aria-label="Excluir sua avaliação"
      onClick={(e) => {
        e.stopPropagation();
        setShowConfirm(true);
      }}
    >
      <Trash2 size={13} strokeWidth={2} />
    </button>
  );
}

function PrivateSessionMeta({ review, navigate }) {
  if (!review.watched_with && !review.viewing_venue) return null;

  const venueLower = (review.viewing_venue || '').toLowerCase();
  const VenueIcon = venueLower.includes('cine') ? Film : venueLower.includes('stream') ? Tv : MapPin;

  return (
    <div className="review-card-session-meta" title="Detalhes privados da sua sessão (visíveis apenas na sua caixa)">
      {review.watched_with && (
        <div className="review-card-session-item">
          <Users size={12} className="review-card-session-icon" />
          <span>
            {review.watched_with.split(',').map((name, i, arr) => {
              const trimmed = name.trim();
              const isMention = trimmed.startsWith('@');
              const usernameOnly = isMention ? trimmed.replace(/^@+/, '') : trimmed;
              return (
                <React.Fragment key={i}>
                  {isMention ? (
                    <span
                      className="review-card-mention-link"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/user/${usernameOnly}`);
                      }}
                      title={`Ver perfil de ${usernameOnly}`}
                    >
                      {usernameOnly}
                    </span>
                  ) : (
                    <span>{trimmed}</span>
                  )}
                  {i < arr.length - 1 && ', '}
                </React.Fragment>
              );
            })}
          </span>
        </div>
      )}

      {review.watched_with && review.viewing_venue && (
        <span className="review-card-session-dot">·</span>
      )}

      {review.viewing_venue && (
        <div className="review-card-session-item" title={`Local: ${review.viewing_venue}`}>
          <VenueIcon size={12} className="review-card-session-icon" />
          <span className="review-card-venue-text">{review.viewing_venue}</span>
        </div>
      )}
    </div>
  );
}


function ReviewMiniAvatar({ review }) {
  const handle = review.username || review.user_id || 'U';
  return (
    <span className="review-card-mini-avatar">
      {review.user_avatar ? (
        <img src={review.user_avatar} alt={handle} />
      ) : (
        <span>{handle[0].toUpperCase()}</span>
      )}
    </span>
  );
}

function ReviewRatingBlock({ review, isMyBox }) {
  const ratingText = review.rating ? review.rating.toFixed(1) : '0';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {isMyBox && review.custom_rating > 0 && (
        <span
          className="review-card-private-badge"
          title="Sua nota pessoal (privada, visível apenas na sua caixa)"
        >
          ★ {review.custom_rating} / 9999
        </span>
      )}
      <div
        className="review-card-stars"
        title={`${ratingText}/5 estrelas`}
        aria-label={`Nota: ${ratingText} de 5 estrelas`}
      >
        {renderStars(review.rating)}
      </div>
    </div>
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
  variant = 'editorial',
  context = 'feed',
  isAnime: isAnimeProp = false,
  mediaLabel: mediaLabelProp = '',
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

  const isMyBox = context === 'my-box';

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

  const cachedMeta = getCachedMediaMeta(review.tmdb_id);
  const isAnimeItem = Boolean(
    isAnimeProp ||
    (review && isAnimeUtil(review)) ||
    cachedMeta?.isAnime
  );

  const mediaLabel =
    mediaLabelProp ||
    (isAnimeItem ? 'ANIME' : isEpisodic(review) ? 'SÉRIE' : 'FILME');
  const isTv = isEpisodic(review);

  /* =====================================================================
     VARIAÇÃO A: DIÁRIO EDITORIAL (Recomendada para Arquivo Pessoal)
     ===================================================================== */
  if (showPoster && variant === 'editorial') {
    return (
      <article className="review-card variant-editorial">
        <div
          className="editorial-poster-box"
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

        <div className="editorial-content-box">
          <div className="editorial-header">
            <div className="editorial-title-wrap">
              <div className="editorial-title-flow">
                <h3
                  className={`editorial-title ${isTv ? 'is-tv' : ''}`}
                  onClick={() => navigate(`/movie/${review.tmdb_id}?type=${review.media_type || 'movie'}`)}
                  title={review.movie_title || `Título #${review.tmdb_id}`}
                >
                  {review.movie_title || `Título #${review.tmdb_id}`}
                </h3>
                {episodeCode && (
                  <span className="review-scope-chip editorial-scope-chip">
                    {episodeCode}
                  </span>
                )}
                {episodeName && (
                  <span className="editorial-episode-name">"{episodeName}"</span>
                )}
              </div>
            </div>

            <ReviewRatingBlock review={review} isMyBox={isMyBox} />
          </div>

          <div className="editorial-comment-wrap">
            <ReviewComment comment={review.comment} containsSpoilers={review.contains_spoilers} allowExpand={true} />
          </div>

          {/* DETALHES PRIVADOS DA SESSÃO: EXIBIDOS APENAS EM MINHA CAIXA */}
          {isMyBox && <PrivateSessionMeta review={review} navigate={navigate} />}

          <div className="editorial-footer">
            <div className="editorial-footer-left">
              <span className="editorial-media-badge">{mediaLabel}</span>
              <span className="editorial-footer-dot">·</span>
              <span className="editorial-date-stamp">
                {formatReviewDate(review.created_at)}
              </span>
              {!isMyBox && (review.username || review.user_id) && (
                <>
                  <span className="editorial-footer-dot">·</span>
                  <span
                    className="editorial-author-tag"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/user/${review.username || review.user_id}`);
                    }}
                    title={`Ver perfil de ${review.username || review.user_id}`}
                  >
                    <ReviewMiniAvatar review={review} />
                    <span>{review.username || review.user_id}</span>
                  </span>
                </>
              )}
            </div>


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
      </article>
    );
  }

  /* =====================================================================
     LAYOUT PADRÃO (FEED E DETALHES)
     ===================================================================== */
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
              style={{ cursor: 'pointer' }}
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
            <ReviewRatingBlock review={review} isMyBox={isMyBox} />
          </div>
          <ReviewComment comment={review.comment} containsSpoilers={review.contains_spoilers} allowExpand={true} />
          {isMyBox && <PrivateSessionMeta review={review} navigate={navigate} />}
          <div className="review-card-user">
            {!isMyBox && (
              <div
                className="review-card-user-info"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/user/${review.username || review.user_id}`);
                }}
                title={`Ver perfil de ${review.username || review.user_id}`}
              >
                <ReviewMiniAvatar review={review} />
                <span className="review-card-username">{review.username || review.user_id}</span>
              </div>
            )}
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
          {!isMyBox && (
            <div
              className="movie-review-author-info"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/user/${review.username || review.user_id}`);
              }}
              title={`Ver perfil de ${review.username || review.user_id}`}
            >
              <ReviewMiniAvatar review={review} />
              <span className="review-card-username">{review.username || review.user_id}</span>
              {episodeCode && (
                <span className="review-scope-chip">{episodeCode}</span>
              )}
              {episodeName && (
                <span className="review-episode-name" title={episodeName}>
                  "{episodeName}"
                </span>
              )}
            </div>
          )}
          <div className="movie-review-rating-wrap">
            <ReviewRatingBlock review={review} isMyBox={isMyBox} />
          </div>
        </div>

        <ReviewComment comment={review.comment} containsSpoilers={review.contains_spoilers} allowExpand={true} />
        {isMyBox && <PrivateSessionMeta review={review} navigate={navigate} />}

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
