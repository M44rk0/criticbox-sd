import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useReviewModal } from '../context/ReviewModalContext';
import { useToast } from '../context/ToastContext';
import { createReview } from '../api/reviews';
import { isAnime } from '../utils/media';

export default function ReviewModal() {
  const { reviewModalMovie, closeReviewModal, onReviewSuccess } = useReviewModal();
  const { showToast } = useToast();

  const [modalRating, setModalRating] = useState(5.0);
  const [hoverRating, setHoverRating] = useState(null);
  const [modalComment, setModalComment] = useState('');
  const [modalSpoilers, setModalSpoilers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!reviewModalMovie) return;
    setModalRating(5.0);
    setHoverRating(null);
    setModalComment('');
    setModalSpoilers(false);
  }, [reviewModalMovie]);

  if (!reviewModalMovie) return null;

  const displayedRating = hoverRating !== null ? hoverRating : modalRating;
  const isTv = reviewModalMovie.media_type === 'tv';

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        tmdb_id: reviewModalMovie.tmdb_id,
        media_type: reviewModalMovie.media_type || 'movie',
        rating: modalRating,
        comment: modalComment.trim(),
        contains_spoilers: modalSpoilers,
        season_number: null,
        episode_number: null,
      };

      await createReview(payload);
      onReviewSuccess(modalRating);
    } catch (err) {
      showToast(err.message || 'Erro ao publicar avaliação.', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="review-modal-overlay active"
      onClick={(e) => {
        if (e.target.classList.contains('review-modal-overlay')) closeReviewModal();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="v1-card" onClick={(e) => e.stopPropagation()}>
        <div className="v1-poster-col">
          <img
            src={reviewModalMovie.poster_url || 'https://via.placeholder.com/500x750?text=Sem+Poster'}
            alt={reviewModalMovie.title}
          />
          <div className="v1-poster-overlay"></div>
          <div className="v1-poster-info">
            <span className="v1-poster-chip">
              {reviewModalMovie.release_date ? reviewModalMovie.release_date.substring(0, 4) : ''}
            </span>
            <h2 className="v1-poster-title">{reviewModalMovie.title}</h2>
          </div>
        </div>

        <div className="v1-content-col">
          <div>
            <div className="v1-header-bar">
              <div className="v1-meta-row">
                <span className={`v1-chip-lancamento ${isAnime(reviewModalMovie) ? 'ep-chip-anime' : ''}`}>
                  {isAnime(reviewModalMovie)
                    ? 'AVALIAÇÃO DE ANIME COMPLETO'
                    : isTv
                    ? 'AVALIAÇÃO DE SÉRIE COMPLETA'
                    : 'NOVA CRÍTICA'}
                </span>
                <span
                  style={{
                    marginLeft: '10px',
                    color: 'var(--gray-400)',
                    fontSize: '0.78rem',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  NOTA: {displayedRating.toFixed(1)}
                </span>
              </div>
              <button className="v1-close-btn" onClick={closeReviewModal} aria-label="Fechar" title="Fechar">
                <X size={16} />
              </button>
            </div>
            <h1 className="v1-movie-title">{reviewModalMovie.title}</h1>
            <p className="v1-movie-synopsis">{reviewModalMovie.overview || 'Sem sinopse disponível.'}</p>
          </div>

          <hr className="v1-divider" />

          <div>
            <label className="v1-field-label">SUA CLASSIFICAÇÃO (0.5 A 5.0 ESTRELAS)</label>
            <div className="v1-rating-row">
              <div className="stars-flex" onMouseLeave={() => setHoverRating(null)}>
                {[1, 2, 3, 4, 5].map((starIdx) => {
                  const isFull = displayedRating >= starIdx;
                  const isHalf = !isFull && displayedRating >= starIdx - 0.5;
                  const starClass = isFull ? 'star-glyph full' : isHalf ? 'star-glyph half' : 'star-glyph';

                  return (
                    <span
                      key={starIdx}
                      className={starClass}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isLeftHalf = e.clientX - rect.left < rect.width / 2;
                        setModalRating(isLeftHalf ? starIdx - 0.5 : starIdx);
                      }}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const isLeftHalf = e.clientX - rect.left < rect.width / 2;
                        setHoverRating(isLeftHalf ? starIdx - 0.5 : starIdx);
                      }}
                    >
                      <svg viewBox="0 0 24 24">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </span>
                  );
                })}
              </div>
              <span className="v1-score-badge">{modalRating.toFixed(1)}</span>
            </div>
          </div>

          <div>
            <label className="v1-field-label">SUA CRÍTICA</label>
            <textarea
              className="v1-textarea"
              placeholder={
                isAnime(reviewModalMovie)
                  ? "Escreva sua análise crítica sobre o anime completo..."
                  : isTv
                  ? "Escreva sua análise crítica sobre a série completa..."
                  : "Escreva sua análise detalhada..."
              }
              maxLength={1000}
              value={modalComment}
              onChange={(e) => setModalComment(e.target.value)}
            />
            <span className="v1-char-counter">{modalComment.length} / 1000</span>
          </div>

          <div className="v1-actions-row">
            <label className="v1-spoiler-wrap">
              <input
                type="checkbox"
                checked={modalSpoilers}
                onChange={(e) => setModalSpoilers(e.target.checked)}
              />
              <span className="v1-custom-checkbox"></span>
              <span>Contém spoilers</span>
            </label>
            <button className="v1-submit-btn" disabled={isSubmitting} onClick={handleSubmit}>
              {isSubmitting ? 'PUBLICANDO...' : 'PUBLICAR AVALIAÇÃO'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
