import React from 'react';
import { X } from 'lucide-react';
import { useReviewModal } from '../context/ReviewModalContext';
import { useToast } from '../context/ToastContext';
import { createReview } from '../api/reviews';
import { isAnime, isEpisodic } from '../utils/media';
import {
  useReviewFormState,
  StarRatingSplitSection,
  CoViewingAndVenueFields,
  ReviewModalActionsRow,
} from './ReviewModalExtraFields';
import './ReviewModal.css';

export default function ReviewModal() {
  const { reviewModalMovie, closeReviewModal, onReviewSuccess } = useReviewModal();
  const { showToast } = useToast();

  const {
    modalRating,
    setModalRating,
    displayedRating,
    setHoverRating,
    modalComment,
    setModalComment,
    modalSpoilers,
    setModalSpoilers,
    isSubmitting,
    setIsSubmitting,
    isDetailed,
    setIsDetailed,
    customRating,
    setCustomRating,
    watchedWith,
    setWatchedWith,
    venue,
    setVenue,
  } = useReviewFormState(reviewModalMovie);

  if (!reviewModalMovie) return null;

  const isTv = isEpisodic(reviewModalMovie);
  const animeMedia = isAnime(reviewModalMovie);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const parsedCustomRating =
        isDetailed && customRating !== '' ? parseInt(customRating, 10) : null;

      const payload = {
        tmdb_id: reviewModalMovie.tmdb_id,
        media_type: reviewModalMovie.media_type || 'movie',
        rating: modalRating,
        comment: modalComment.trim(),
        contains_spoilers: modalSpoilers,
        season_number: null,
        episode_number: null,
        custom_rating: parsedCustomRating,
        watched_with: isDetailed ? watchedWith.join(', ') : '',
        viewing_venue: isDetailed ? (venue || '') : '',
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
      <div className={`v1-card ${isDetailed ? 'detailed-mode' : ''}`} onClick={(e) => e.stopPropagation()}>
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

        <div className={`v1-content-col ${isDetailed ? 'has-detailed' : ''}`}>
          <div>
            <div className="v1-header-bar">
              <div className="v1-meta-row">
                {(animeMedia || isTv) && (
                  <span className={`v1-chip-lancamento ${animeMedia ? 'ep-chip-anime' : ''}`}>
                    {animeMedia
                      ? 'AVALIAÇÃO DE ANIME COMPLETO'
                      : 'AVALIAÇÃO DE SÉRIE COMPLETA'}
                  </span>
                )}
              </div>
              <button className="v1-close-btn" onClick={closeReviewModal} aria-label="Fechar" title="Fechar">
                <X size={16} />
              </button>
            </div>
            <h1 className="v1-movie-title">{reviewModalMovie.title}</h1>
            <p className="v1-movie-synopsis">{reviewModalMovie.overview || 'Sem sinopse disponível.'}</p>
          </div>

          <hr className="v1-divider" />

          <StarRatingSplitSection
            modalRating={modalRating}
            setModalRating={setModalRating}
            displayedRating={displayedRating}
            setHoverRating={setHoverRating}
            isDetailed={isDetailed}
            customRating={customRating}
            setCustomRating={setCustomRating}
          />

          <div>
            <label className="v1-field-label">SUA CRÍTICA</label>
            <textarea
              className="v1-textarea"
              placeholder={
                animeMedia
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

          <CoViewingAndVenueFields
            isDetailed={isDetailed}
            watchedWith={watchedWith}
            setWatchedWith={setWatchedWith}
            venue={venue}
            setVenue={setVenue}
          />

          <ReviewModalActionsRow
            modalSpoilers={modalSpoilers}
            setModalSpoilers={setModalSpoilers}
            isDetailed={isDetailed}
            setIsDetailed={setIsDetailed}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
