import React from 'react';
import { X, Tv } from 'lucide-react';
import { useReviewModal } from '../context/ReviewModalContext';
import { useToast } from '../context/ToastContext';
import { createReview } from '../api/reviews';
import { formatReleaseDate } from '../utils/date';
import { isAnime } from '../utils/media';
import {
  useReviewFormState,
  StarRatingSplitSection,
  CoViewingAndVenueFields,
  ReviewModalActionsRow,
} from './ReviewModalExtraFields';
import './EpisodeReviewModal.css';

export default function EpisodeReviewModal() {
  const { episodeModalData, closeEpisodeReviewModal, onEpisodeReviewSuccess } = useReviewModal();
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
  } = useReviewFormState(episodeModalData);

  if (!episodeModalData) return null;

  const { movie, episode, season } = episodeModalData;

  const episodeImage = episode.still_url || movie.backdrop_url || movie.poster_url;
  const episodeNumStr = episode.episode_number < 10 ? `0${episode.episode_number}` : episode.episode_number;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const parsedCustomRating =
        isDetailed && customRating !== '' ? parseInt(customRating, 10) : null;

      const payload = {
        tmdb_id: movie.tmdb_id,
        media_type: movie.media_type || 'tv',
        rating: modalRating,
        comment: modalComment.trim(),
        contains_spoilers: modalSpoilers,
        season_number: parseInt(season, 10),
        episode_number: parseInt(episode.episode_number, 10),
        custom_rating: parsedCustomRating,
        watched_with: isDetailed ? watchedWith.join(', ') : '',
        viewing_venue: isDetailed ? (venue || '') : '',
      };

      await createReview(payload);
      onEpisodeReviewSuccess(modalRating, movie, episode, season);
    } catch (err) {
      showToast(err.message || 'Erro ao publicar avaliação do episódio.', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="review-modal-overlay active"
      onClick={(e) => {
        if (e.target.classList.contains('review-modal-overlay')) closeEpisodeReviewModal();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={`v1-card ep-modal-card ${isDetailed ? 'detailed-mode' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* COLUNA ESQUERDA: IMAGEM DO EPISÓDIO AMPLIADA + FICHA LIMPA (SEM POSTER ADICIONAL) */}
        <div className="v1-poster-col ep-visual-col">
          <div className="ep-still-container">
            {episodeImage ? (
              <img
                src={episodeImage}
                alt={episode.name || `Episódio ${episode.episode_number}`}
                className="ep-still-img"
              />
            ) : (
              <div className="episode-still-empty" style={{ width: '100%', height: '100%' }}>
                <Tv size={48} />
              </div>
            )}
            <div className="v1-poster-overlay"></div>
            <span className="ep-badge-pill">
              T{season} · EP {episodeNumStr}
            </span>
          </div>

          <div className="ep-sidebar-details">
            <div className="ep-sidebar-header">
              <span className="ep-sidebar-label">{isAnime(movie) ? 'ANIME' : 'SÉRIE'}</span>
              <h3 className="ep-sidebar-series-title">{movie.title}</h3>
              <span className="ep-sidebar-season-label">Temporada {season} · Episódio {episode.episode_number}</span>
            </div>

            <div className="ep-sidebar-meta-list">
              {episode.air_date && (
                <div className="ep-sidebar-meta-item">
                  <span className="ep-sidebar-meta-key">EXIBIÇÃO</span>
                  <span className="ep-sidebar-meta-val">{formatReleaseDate(episode.air_date)}</span>
                </div>
              )}
              {episode.runtime > 0 && (
                <div className="ep-sidebar-meta-item">
                  <span className="ep-sidebar-meta-key">DURAÇÃO</span>
                  <span className="ep-sidebar-meta-val">{episode.runtime} MIN</span>
                </div>
              )}
              {episode.vote_average > 0 && (
                <div className="ep-sidebar-meta-item">
                  <span className="ep-sidebar-meta-key">NOTA TMDB</span>
                  <span className="ep-sidebar-meta-val ep-gold">★ {episode.vote_average.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: ESTRUTURA CLÁSSICA COM CAMPO DE CRÍTICA ESTENDIDO */}
        <div className={`v1-content-col ep-content-col ${isDetailed ? 'has-detailed' : ''}`}>
          <div>
            <div className="v1-header-bar">
              <div className="v1-meta-row">
                <span className="v1-chip-lancamento">
                  AVALIAÇÃO DE EPISÓDIO
                </span>
              </div>
              <button
                className="v1-close-btn"
                onClick={closeEpisodeReviewModal}
                aria-label="Fechar"
                title="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <h1 className="v1-movie-title">
              {episode.name || `Episódio ${episode.episode_number}`}
            </h1>
            <p className="v1-movie-synopsis">
              {episode.overview || 'Sinopse não disponível para este episódio.'}
            </p>
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

          {/* CAMPO DE CRÍTICA ESTENDIDO */}
          <div className="ep-textarea-group">
            <label className="v1-field-label">SUA CRÍTICA</label>
            <textarea
              className="v1-textarea ep-textarea-extended"
              placeholder="Escreva sua análise detalhada sobre este episódio..."
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
