import React from 'react';
import { Film, ChevronLeft, ChevronRight } from 'lucide-react';

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
          <h2 className="section-title">Títulos Recomendados</h2>
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

      <div className="recommendations-wrap">
        <div className="recommendations-carousel" ref={recsCarouselRef}>
          {recommendations.map((rec) => {
            const recId = rec.tmdb_id || rec.id;
            return (
              <div
                key={recId}
                className="rec-card"
                onClick={() => {
                  navigate(`/movie/${recId}?type=${rec.media_type || 'movie'}`);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                title={rec.title}
              >
                <img
                  src={
                    rec.poster_url ||
                    'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?auto=format&fit=crop&w=400&q=80'
                  }
                  alt={rec.title}
                  className="rec-poster"
                  loading="lazy"
                />
                <div className="rec-info">
                  <span className="rec-title">{rec.title}</span>
                  <span className="rec-rating">★ {rec.tmdb_vote_average ? rec.tmdb_vote_average.toFixed(1) : '-'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
