import React, { useState, useEffect } from 'react';
import { X, Tv, Calendar, Clock, Star } from 'lucide-react';
import { useReviewModal } from '../context/ReviewModalContext';
import { useToast } from '../context/ToastContext';
import { createReview } from '../api/reviews';
import { formatReleaseDate } from '../utils/date';
import { isAnime } from '../utils/media';

export default function EpisodeReviewModal() {
  const { episodeModalData, closeEpisodeReviewModal, onEpisodeReviewSuccess } = useReviewModal();
  const { showToast } = useToast();

  const [modalRating, setModalRating] = useState(5.0);
  const [hoverRating, setHoverRating] = useState(null);
  const [modalComment, setModalComment] = useState('');
  const [modalSpoilers, setModalSpoilers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!episodeModalData) return;
    setModalRating(5.0);
    setHoverRating(null);
    setModalComment('');
    setModalSpoilers(false);
  }, [episodeModalData]);

  if (!episodeModalData) return null;

  const { movie, episode, season } = episodeModalData;
  const displayedRating = hoverRating !== null ? hoverRating : modalRating;

  const episodeImage = episode.still_url || movie.backdrop_url || movie.poster_url;
  const episodeNumStr = episode.episode_number < 10 ? `0${episode.episode_number}` : episode.episode_number;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        tmdb_id: movie.tmdb_id,
        movie_title: movie.title || '',
        media_type: 'tv',
        rating: modalRating,
        comment: modalComment.trim(),
        contains_spoilers: modalSpoilers,
        season_number: parseInt(season, 10),
        episode_number: parseInt(episode.episode_number, 10),
        poster_url: movie.poster_url || '',
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
      <div className="v1-card ep-modal-card" onClick={(e) => e.stopPropagation()}>
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
        <div className="v1-content-col ep-content-col">
          <div>
            <div className="v1-header-bar">
              <div className="v1-meta-row">
                <span className="v1-chip-lancamento">
                  AVALIAÇÃO DE EPISÓDIO
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

          {/* CLASSIFICAÇÃO COM ESTRELAS */}
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

          {/* CAMPO DE CRÍTICA ESTENDIDO */}
          <div className="ep-textarea-group">
            <label className="v1-field-label">SUA CRÍTICA</label>
            <textarea
              className="v1-textarea ep-textarea-extended"
              placeholder={`Escreva sua análise detalhada sobre este episódio...`}
              maxLength={1000}
              value={modalComment}
              onChange={(e) => setModalComment(e.target.value)}
            />
            <span className="v1-char-counter">{modalComment.length} / 1000</span>
          </div>

          {/* AÇÕES FINAIS: SPOILER E SUBMIT */}
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
