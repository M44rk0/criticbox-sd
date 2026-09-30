import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getMediaTypeLabel } from '../utils/media';

export default function MovieCarouselSection({
  id,
  sectionNum,
  sectionTitle,
  sectionKicker,
  linkTo,
  linkLabel,
  movies = [],
  isLoading = false,
  loadingMessage = 'Carregando títulos...',
  navigate,
}) {
  const carouselRef = useRef(null);

  const scroll = (direction) => {
    if (!carouselRef.current) return;
    const scrollAmount = direction === 'left' ? -520 : 520;
    carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  return (
    <section id={id} className="section" style={{ paddingTop: sectionNum === '01' ? undefined : 0 }}>
      <div className="section-header">
        <div className="section-title-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="section-num">{sectionNum}</span>
            <h2 className="section-title">{sectionTitle}</h2>
          </div>
          {sectionKicker && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.68rem',
                color: 'var(--gray-400)',
                letterSpacing: '0.04em',
                marginLeft: '36px',
              }}
            >
              {sectionKicker}
            </span>
          )}
        </div>

        <div>
          {linkTo && (
            <Link to={linkTo} className="section-link">
              {linkLabel || 'VER MAIS'}
              <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="loading-pulse">{loadingMessage}</div>
      ) : !movies || movies.length === 0 ? (
        <div style={{ padding: '30px', textAlign: 'center', background: '#0a0c11', border: '1px solid var(--gray-700)' }}>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.88rem', color: 'var(--gray-400)' }}>
            Nenhum título disponível no momento.
          </p>
        </div>
      ) : (
        <div className="movies-carousel-wrap">
          <div className="movies-carousel" ref={carouselRef}>
            {movies.map((m, idx) => {
              const movieId = m.tmdb_id || m.id;
              const mediaType = m.media_type || 'movie';
              const rankNum = idx + 1 < 10 ? `0${idx + 1}` : idx + 1;

              return (
                <div
                  key={`${movieId}_${idx}`}
                  className="movie-card"
                  onClick={() => navigate(`/movie/${movieId}?type=${mediaType}`)}
                  title={`Ver detalhes de ${m.title}`}
                >
                  <div className="movie-card-poster">
                    <img
                      src={m.poster_url || 'https://via.placeholder.com/500x750?text=Sem+Poster'}
                      alt={m.title}
                      loading="lazy"
                    />
                    <span className="movie-card-rank">#{rankNum}</span>
                  </div>
                  <div className="movie-card-info">
                    <div className="movie-card-topline">
                      <span className="movie-card-tag">
                        {m.release_date ? m.release_date.substring(0, 4) : '2026'} • {getMediaTypeLabel(m)}
                      </span>
                      <span className="movie-card-score-pill">
                        ★ {m.tmdb_vote_average ? m.tmdb_vote_average.toFixed(1) : '-'}
                      </span>
                    </div>
                    <h3 className="movie-card-title">{m.title}</h3>
                    <div className="movie-card-meta">
                      {m.criticbox_rating > 0 ? (
                        <span className="movie-card-cb-score">
                          CRITICBOX: <strong>{m.criticbox_rating.toFixed(1)}</strong>
                        </span>
                      ) : (
                        <span className="movie-card-cb-empty">SEM CRÍTICAS</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
