import React from 'react';
import { Film, ChevronLeft, ChevronRight } from 'lucide-react';
import { getMediaTypeLabel } from '../../utils/media';

export default function RecommendationsCarousel({
  recommendations = [],
  recsCarouselRef,
  scrollRecs,
  navigate,
}) {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <section className="section" style={{ paddingTop: '30px', paddingBottom: '30px' }}>
      <div className="section-header">
        <div className="section-title-group">
          <span className="section-num">
            <Film size={18} />
          </span>
          <h2 className="section-title">TÍTULOS RECOMENDADOS</h2>
        </div>
        <div className="carousel-controls">
          <button
            type="button"
            className="carousel-ctrl-btn"
            onClick={() => scrollRecs('left')}
            aria-label="Rolar para esquerda"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="carousel-ctrl-btn"
            onClick={() => scrollRecs('right')}
            aria-label="Rolar para direita"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="movies-carousel-wrap">
        <div className="movies-carousel" ref={recsCarouselRef}>
          {recommendations.map((rec, idx) => {
            const recId = rec.tmdb_id || rec.id;
            const mediaType = rec.media_type || 'movie';
            const rankNum = idx + 1 < 10 ? `0${idx + 1}` : idx + 1;

            return (
              <div
                key={`${recId}_${idx}`}
                className="movie-card"
                onClick={() => {
                  navigate(`/movie/${recId}?type=${mediaType}`);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                title={`Ver detalhes de ${rec.title}`}
              >
                <div className="movie-card-poster">
                  <img
                    src={
                      rec.poster_url ||
                      'https://via.placeholder.com/500x750?text=Sem+Poster'
                    }
                    alt={rec.title}
                    loading="lazy"
                  />
                  <span className="movie-card-rank">#{rankNum}</span>
                </div>
                <div className="movie-card-info">
                  <div className="movie-card-topline">
                    <span className="movie-card-tag">
                      {rec.release_date ? rec.release_date.substring(0, 4) : '2026'} • {getMediaTypeLabel(rec)}
                    </span>
                    {rec.criticbox_rating > 0 ? (
                      <span
                        className="movie-card-score-pill movie-card-cb-pill"
                        title={`Nota Criticbox: ${rec.criticbox_rating.toFixed(1)}`}
                      >
                        <span className="cb-square-icon" aria-hidden="true">■</span>
                        {rec.criticbox_rating.toFixed(1)}
                      </span>
                    ) : (
                      <span
                        className="movie-card-score-pill"
                        title={`Nota IMDb: ${rec.tmdb_vote_average ? rec.tmdb_vote_average.toFixed(1) : '-'}`}
                      >
                        ★ {rec.tmdb_vote_average ? rec.tmdb_vote_average.toFixed(1) : '-'}
                      </span>
                    )}
                  </div>
                  <h3 className="movie-card-title">{rec.title}</h3>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
