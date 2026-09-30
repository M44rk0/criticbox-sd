import React from 'react';
import { Tv, Tv2, Calendar, Star, Check } from 'lucide-react';
import { formatReleaseDate } from '../../utils/date';
import { useReviewModal } from '../../context/ReviewModalContext';

export default function SeriesEpisodeGuide({
  movie,
  selectedSeason,
  handleSelectSeason,
  loadingSeason,
  seasonEpisodesMap,
  userReviews = [],
  loadData,
}) {
  const { openEpisodeReviewModal } = useReviewModal();

  if (movie.media_type !== 'tv' || !movie.seasons || movie.seasons.length === 0) {
    return null;
  }

  return (
    <section className="section" style={{ paddingTop: '30px', paddingBottom: '30px' }}>
      <div className="section-header">
        <div className="section-title-group">
          <span className="section-num">
            <Tv2 size={18} />
          </span>
          <h2 className="section-title">Temporadas & Episódios</h2>
        </div>
        <div className="series-header-stats">
          <span>
            {movie.number_of_seasons} {movie.number_of_seasons === 1 ? 'Temporada' : 'Temporadas'}
          </span>
          <span className="series-header-sep">/</span>
          <span>{movie.number_of_episodes} Episódios</span>
        </div>
      </div>

      <div className="series-guide-section">
        {/* CARDS DE ÚLTIMO E PRÓXIMO EPISÓDIO */}
        {(movie.last_episode_to_air || movie.next_episode_to_air) && (
          <div className="series-special-cards">
            {movie.last_episode_to_air && (
              <div className="series-special-card">
                {movie.last_episode_to_air.still_url ? (
                  <img
                    src={movie.last_episode_to_air.still_url}
                    alt={movie.last_episode_to_air.name}
                    className="series-special-still"
                    loading="lazy"
                  />
                ) : (
                  <div className="series-special-still empty">
                    <Tv size={20} color="var(--gray-600)" />
                  </div>
                )}
                <div className="series-special-info">
                  <span className="series-special-tag">ÚLTIMO EXIBIDO</span>
                  <h4 className="series-special-title">
                    T{movie.last_episode_to_air.season_number}E{movie.last_episode_to_air.episode_number} ·{' '}
                    {movie.last_episode_to_air.name}
                  </h4>
                  <span className="series-special-date">
                    {formatReleaseDate(movie.last_episode_to_air.air_date)}
                    {movie.last_episode_to_air.vote_average > 0 &&
                      ` · ★ ${movie.last_episode_to_air.vote_average.toFixed(1)}`}
                  </span>
                </div>
              </div>
            )}

            {movie.next_episode_to_air && (
              <div className="series-special-card next">
                {movie.next_episode_to_air.still_url ? (
                  <img
                    src={movie.next_episode_to_air.still_url}
                    alt={movie.next_episode_to_air.name}
                    className="series-special-still"
                    loading="lazy"
                  />
                ) : (
                  <div className="series-special-still empty">
                    <Calendar size={20} color="var(--accent)" />
                  </div>
                )}
                <div className="series-special-info">
                  <span className="series-special-tag accent">PRÓXIMA ESTREIA</span>
                  <h4 className="series-special-title">
                    T{movie.next_episode_to_air.season_number}E{movie.next_episode_to_air.episode_number} ·{' '}
                    {movie.next_episode_to_air.name}
                  </h4>
                  <span className="series-special-date">
                    Estreia em {formatReleaseDate(movie.next_episode_to_air.air_date)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SELETOR DE TEMPORADAS - TABS BRUTALISTAS DESTILADAS */}
        <div className="season-selector-bar">
          {movie.seasons.map((s) => (
            <button
              key={s.season_number}
              type="button"
              className={`season-selector-btn ${selectedSeason === s.season_number ? 'active' : ''}`}
              onClick={() => handleSelectSeason(s.season_number)}
            >
              <span className="season-btn-title">{s.name || `Temporada ${s.season_number}`}</span>
              <span className="season-btn-count">({s.episode_count} eps)</span>
            </button>
          ))}
        </div>

        {/* LISTA DE EPISÓDIOS DA TEMPORADA */}
        {loadingSeason ? (
          <div className="loading-pulse" style={{ padding: '40px 0' }}>
            Carregando episódios da Temporada {selectedSeason}...
          </div>
        ) : seasonEpisodesMap[selectedSeason] && seasonEpisodesMap[selectedSeason].length > 0 ? (
          <div className="episodes-grid">
            {seasonEpisodesMap[selectedSeason].map((ep) => (
              <div key={ep.episode_number} className="episode-card">
                <div className="episode-still-wrap">
                  {ep.still_url ? (
                    <img src={ep.still_url} alt={ep.name} loading="lazy" />
                  ) : (
                    <div className="episode-still-empty">
                      <Tv size={24} />
                    </div>
                  )}
                  <span className="episode-number-badge">
                    EP {ep.episode_number < 10 ? `0${ep.episode_number}` : ep.episode_number}
                  </span>
                </div>

                <div className="episode-body">
                  <div>
                    <div className="episode-header-row">
                      <h4 className="episode-title">{ep.name}</h4>
                      <div className="episode-meta-row">
                        {ep.vote_average > 0 && (
                          <span className="episode-meta-rating">
                            <Star size={11} fill="currentColor" />
                            {ep.vote_average.toFixed(1)}
                          </span>
                        )}
                        {ep.runtime > 0 && <span>{ep.runtime} min</span>}
                        {ep.air_date && <span>{formatReleaseDate(ep.air_date)}</span>}
                      </div>
                    </div>

                    <p className="episode-overview">
                      {ep.overview || 'Sinopse não disponível para este episódio.'}
                    </p>
                  </div>

                  <div className="episode-footer-row">
                    {ep.directors?.length > 0 || ep.writers?.length > 0 ? (
                      <div className="episode-crew">
                        {ep.directors?.length > 0 && <span>Dir: {ep.directors.join(', ')}</span>}
                        {ep.directors?.length > 0 && ep.writers?.length > 0 && (
                          <span className="episode-crew-sep">/</span>
                        )}
                        {ep.writers?.length > 0 && <span>Rot: {ep.writers.join(', ')}</span>}
                      </div>
                    ) : (
                      <div />
                    )}

                    {(() => {
                      const userEpReview = userReviews?.find(
                        (r) =>
                          Number(r.season_number) === Number(selectedSeason) &&
                          Number(r.episode_number) === Number(ep.episode_number)
                      );
                      const isAlreadyReviewed = Boolean(userEpReview);

                      if (isAlreadyReviewed) {
                        return (
                          <div
                            className="episode-already-reviewed-badge"
                            title={`Você já avaliou este episódio com nota ${userEpReview.rating?.toFixed(1)}`}
                          >
                            <Check size={12} />
                            <span>AVALIADO</span>
                            {userEpReview.rating > 0 && (
                              <span className="episode-reviewed-score">★ {userEpReview.rating.toFixed(1)}</span>
                            )}
                          </div>
                        );
                      }

                      return (
                        <button
                          type="button"
                          className="episode-eval-btn"
                          onClick={() =>
                            openEpisodeReviewModal(movie, ep, selectedSeason, loadData, userReviews)
                          }
                        >
                          <Star size={11} fill="currentColor" />
                          AVALIAR
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="watch-providers-empty">Episódios desta temporada não detalhados no catálogo.</div>
        )}
      </div>
    </section>
  );
}
