import React, { useState, useEffect } from 'react';
import { X, Tv, Film } from 'lucide-react';
import { useReviewModal } from '../context/ReviewModalContext';
import { useToast } from '../context/ToastContext';
import { getSeriesEpisodes, getMovieDetails } from '../api/movies';
import { createReview } from '../api/reviews';
import { SERIES_EPISODES_CACHE } from '../utils/constants';

export default function ReviewModal() {
  const { reviewModalMovie, closeReviewModal, onReviewSuccess } = useReviewModal();
  const { showToast } = useToast();

  const [modalRating, setModalRating] = useState(5.0);
  const [hoverRating, setHoverRating] = useState(null);
  const [modalComment, setModalComment] = useState('');
  const [modalSpoilers, setModalSpoilers] = useState(false);
  const [modalScope, setModalScope] = useState('series'); // 'series' | 'episode'
  const [modalSeason, setModalSeason] = useState(1);
  const [modalEpisode, setModalEpisode] = useState(1);
  const [allSeriesEpisodes, setAllSeriesEpisodes] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [movieDetails, setMovieDetails] = useState(null);

  useEffect(() => {
    if (!reviewModalMovie) return;

    setModalRating(5.0);
    setHoverRating(null);
    setModalComment('');
    setModalSpoilers(false);
    setModalScope('series');
    setModalSeason(1);
    setModalEpisode(1);
    setMovieDetails(reviewModalMovie);

    if (reviewModalMovie.media_type === 'tv') {
      const mid = reviewModalMovie.tmdb_id;
      if (SERIES_EPISODES_CACHE[mid]) {
        setAllSeriesEpisodes(SERIES_EPISODES_CACHE[mid]);
      } else {
        setAllSeriesEpisodes({});
        getSeriesEpisodes(mid)
          .then((data) => {
            SERIES_EPISODES_CACHE[mid] = data || {};
            setAllSeriesEpisodes(data || {});
          })
          .catch((err) => console.warn('Erro ao carregar episódios da série:', err));
      }

      if (!reviewModalMovie.seasons || reviewModalMovie.seasons.length === 0) {
        getMovieDetails(mid, 'tv')
          .then((data) => {
            if (data?.seasons) {
              setMovieDetails((prev) => (prev ? { ...prev, seasons: data.seasons } : data));
            }
          })
          .catch((e) => console.warn('Erro ao carregar temporadas da série:', e));
      }
    } else {
      setAllSeriesEpisodes({});
    }
  }, [reviewModalMovie]);

  if (!reviewModalMovie) return null;

  const currentMovie = movieDetails || reviewModalMovie;
  const displayedRating = hoverRating !== null ? hoverRating : modalRating;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const isTv = currentMovie.media_type === 'tv';
      const isEpScope = isTv && modalScope === 'episode';
      const payload = {
        tmdb_id: currentMovie.tmdb_id,
        media_type: currentMovie.media_type || 'movie',
        rating: modalRating,
        comment: modalComment.trim(),
        contains_spoilers: modalSpoilers,
        season_number: isEpScope ? parseInt(modalSeason, 10) : null,
        episode_number: isEpScope ? parseInt(modalEpisode, 10) : null,
      };

      await createReview(payload);

      const currentSeasonEps = allSeriesEpisodes[modalSeason] || allSeriesEpisodes[String(modalSeason)] || [];
      const selectedEp = isEpScope ? currentSeasonEps.find((e) => e.episode_number === parseInt(modalEpisode, 10)) : null;
      const epNamePart = selectedEp?.name ? ` - "${selectedEp.name}"` : '';
      const scopeInfo = isEpScope ? ` (T${modalSeason}E${modalEpisode}${epNamePart})` : '';

      onReviewSuccess(modalRating, scopeInfo);
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
            src={currentMovie.poster_url || 'https://via.placeholder.com/500x750?text=Sem+Poster'}
            alt={currentMovie.title}
          />
          <div className="v1-poster-overlay"></div>
          <div className="v1-poster-info">
            <span className="v1-poster-chip">
              {currentMovie.release_date ? currentMovie.release_date.substring(0, 4) : ''}
            </span>
            <h2 className="v1-poster-title">{currentMovie.title}</h2>
          </div>
        </div>

        <div className="v1-content-col">
          <div>
            <div className="v1-header-bar">
              <div className="v1-meta-row">
                <span className="v1-chip-lancamento">
                  {currentMovie.media_type === 'tv' ? 'AVALIAÇÃO DE SÉRIE' : 'NOVA CRÍTICA'}
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
            <h1 className="v1-movie-title">{currentMovie.title}</h1>
            <p className="v1-movie-synopsis">{currentMovie.overview || 'Sem sinopse disponível.'}</p>
          </div>

          {/* SELETOR DE ESCOPO PARA SÉRIES */}
          {currentMovie.media_type === 'tv' && (
            <div className="scope-section">
              <div className="scope-tabs">
                <button
                  type="button"
                  className={`scope-tab ${modalScope === 'series' ? 'active' : ''}`}
                  onClick={() => setModalScope('series')}
                >
                  <Tv size={13} />
                  Série Completa
                </button>
                <button
                  type="button"
                  className={`scope-tab ${modalScope === 'episode' ? 'active' : ''}`}
                  onClick={() => setModalScope('episode')}
                >
                  <Film size={13} />
                  Episódio
                </button>
              </div>

              <div className="scope-body">
                {modalScope === 'episode' ? (
                  <div className="scope-fields">
                    <div className="scope-field">
                      <label className="scope-field-label">Temporada</label>
                      <select
                        className="scope-select"
                        value={modalSeason}
                        onChange={(e) => {
                          const sNum = parseInt(e.target.value, 10);
                          setModalSeason(sNum);
                          const eps = allSeriesEpisodes[sNum] || allSeriesEpisodes[String(sNum)] || [];
                          if (eps.length > 0) {
                            setModalEpisode(eps[0].episode_number);
                          } else {
                            setModalEpisode(1);
                          }
                        }}
                      >
                        {(currentMovie.seasons && currentMovie.seasons.length > 0
                          ? currentMovie.seasons.filter((s) => s.season_number > 0)
                          : Array.from({ length: currentMovie.number_of_seasons || 1 }, (_, i) => ({
                              season_number: i + 1,
                              name: `Temporada ${i + 1}`,
                              episode_count: 10,
                            }))
                        ).map((s) => (
                          <option key={s.season_number} value={s.season_number}>
                            {s.name || `Temporada ${s.season_number}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="scope-field">
                      <label className="scope-field-label">Episódio</label>
                      <select
                        className="scope-select"
                        value={modalEpisode}
                        onChange={(e) => setModalEpisode(parseInt(e.target.value, 10))}
                      >
                        {(() => {
                          const currentSeasonEps =
                            allSeriesEpisodes[modalSeason] || allSeriesEpisodes[String(modalSeason)] || [];
                          if (currentSeasonEps.length > 0) {
                            return currentSeasonEps.map((ep) => (
                              <option key={ep.episode_number} value={ep.episode_number}>
                                Ep. {ep.episode_number} — {ep.name || `Episódio ${ep.episode_number}`}
                              </option>
                            ));
                          }
                          const currSeason = currentMovie.seasons?.find((s) => s.season_number === modalSeason);
                          const count = currSeason?.episode_count || 10;
                          return Array.from({ length: count }, (_, i) => i + 1).map((ep) => (
                            <option key={ep} value={ep}>
                              Episódio {ep}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="scope-series-info">
                    <span className="scope-series-pill">GERAL</span>
                    <span className="scope-series-desc">
                      Sua crítica e nota serão atribuídas à série completa (todas as temporadas).
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

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
              placeholder="Escreva sua análise detalhada..."
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
