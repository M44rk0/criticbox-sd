import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Star, Film, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useReviewModal } from '../context/ReviewModalContext';
import { getTrendingMovies, getNowPlayingMovies, getMovieDetails } from '../api/movies';
import { getRecentReviews } from '../api/reviews';
import ReviewComment from '../components/ReviewComment';
import { formatReviewDate } from '../utils/date';
import {
  CACHE_KEY_TRENDING,
  CACHE_KEY_REVIEWS,
  CACHE_KEY_NOW_PLAYING,
  CACHE_TTL_MS,
} from '../utils/constants';

export default function HomePage() {
  const navigate = useNavigate();
  const { isLoggedIn, openAuth } = useAuth();
  const { reviewRevision } = useReviewModal();

  const [trendingMovies, setTrendingMovies] = useState([]);
  const [heroMovie, setHeroMovie] = useState(null);
  const [recentReviews, setRecentReviews] = useState([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const REVIEWS_PER_PAGE = 10;
  const [posters, setPosters] = useState({});
  const [isLoadingTrending, setIsLoadingTrending] = useState(true);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [nowPlayingMovies, setNowPlayingMovies] = useState([]);
  const [isLoadingNowPlaying, setIsLoadingNowPlaying] = useState(true);

  const totalReviewsPages = Math.max(1, Math.ceil(recentReviews.length / REVIEWS_PER_PAGE));
  const currentReviewsPage = Math.min(reviewsPage, totalReviewsPages);
  const displayedReviews = recentReviews.slice(
    (currentReviewsPage - 1) * REVIEWS_PER_PAGE,
    currentReviewsPage * REVIEWS_PER_PAGE
  );

  const reviewsPaginationRef = useRef(null);
  const paginationScrollAnchorRef = useRef(null);

  const handleReviewsPageChange = (newPage) => {
    if (newPage === currentReviewsPage) return;
    if (reviewsPaginationRef.current) {
      const rect = reviewsPaginationRef.current.getBoundingClientRect();
      paginationScrollAnchorRef.current = {
        top: rect.top,
        bottom: rect.bottom,
      };
    }
    setReviewsPage(newPage);
  };

  useLayoutEffect(() => {
    if (paginationScrollAnchorRef.current && reviewsPaginationRef.current) {
      const prevAnchor = paginationScrollAnchorRef.current;
      paginationScrollAnchorRef.current = null;

      const newRect = reviewsPaginationRef.current.getBoundingClientRect();
      const diff = newRect.top - prevAnchor.top;

      if (Math.abs(diff) > 1) {
        window.scrollBy({ top: diff, behavior: 'instant' });
      }

      const finalRect = reviewsPaginationRef.current.getBoundingClientRect();
      if (finalRect.top < 60 || finalRect.bottom > window.innerHeight) {
        reviewsPaginationRef.current.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    }
  }, [currentReviewsPage]);

  useEffect(() => {
    setReviewsPage(1);

    let hasValidTrendingCache = false;
    let hasValidReviewsCache = false;

    if (reviewRevision === 0) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY_TRENDING);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.movies?.length > 0) {
            setTrendingMovies(parsed.movies);
            if (parsed.heroMovie) setHeroMovie(parsed.heroMovie);
            if (parsed.posters) setPosters((prev) => ({ ...parsed.posters, ...prev }));
            setIsLoadingTrending(false);
            hasValidTrendingCache = true;
          }
        }
      } catch (e) {}

      try {
        const cached = sessionStorage.getItem(CACHE_KEY_REVIEWS);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.reviews) {
            setRecentReviews(parsed.reviews);
            if (parsed.posters) setPosters((prev) => ({ ...parsed.posters, ...prev }));
            setIsLoadingReviews(false);
            hasValidReviewsCache = true;
          }
        }
      } catch (e) {}
    }

    const fetchTrending = async () => {
      try {
        const data = await getTrendingMovies();
        const list = data?.movies || [];
        setTrendingMovies(list);
        const hero = list.length > 0 ? list[0] : null;
        if (hero) setHeroMovie(hero);

        const initialPosters = {};
        list.forEach((m) => {
          if (m.tmdb_id && m.poster_url) initialPosters[m.tmdb_id] = m.poster_url;
        });
        setPosters((prev) => ({ ...initialPosters, ...prev }));

        try {
          sessionStorage.setItem(
            CACHE_KEY_TRENDING,
            JSON.stringify({
              movies: list,
              heroMovie: hero,
              posters: initialPosters,
              timestamp: Date.now(),
            })
          );
        } catch (e) {}
      } catch (err) {
        console.error('Erro ao carregar trending:', err);
      } finally {
        setIsLoadingTrending(false);
      }
    };

    const fetchReviews = async () => {
      try {
        const data = await getRecentReviews(100);
        const list = data || [];
        setRecentReviews(list);

        const fetchedPosters = {};
        const uniqueIds = [...new Set(list.map((r) => r.tmdb_id))].filter(Boolean);
        await Promise.all(
          uniqueIds.map(async (mid) => {
            try {
              const mData = await getMovieDetails(mid);
              if (mData?.poster_url) {
                fetchedPosters[mid] = mData.poster_url;
              }
            } catch (e) {}
          })
        );

        setPosters((prev) => {
          const merged = { ...prev, ...fetchedPosters };
          try {
            sessionStorage.setItem(
              CACHE_KEY_REVIEWS,
              JSON.stringify({
                reviews: list,
                posters: merged,
                timestamp: Date.now(),
              })
            );
          } catch (e) {}
          return merged;
        });
      } catch (err) {
        console.error('Erro ao carregar reviews:', err);
      } finally {
        setIsLoadingReviews(false);
      }
    };

    if (!hasValidTrendingCache) fetchTrending();
    if (!hasValidReviewsCache) fetchReviews();
  }, [reviewRevision]);

  useEffect(() => {
    let hasCache = false;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY_NOW_PLAYING);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.movies?.length > 0) {
          setNowPlayingMovies(parsed.movies);
          setIsLoadingNowPlaying(false);
          hasCache = true;
        }
      }
    } catch (e) {}

    const fetchNowPlaying = async () => {
      try {
        const data = await getNowPlayingMovies();
        const list = (data?.movies || []).filter((m) => m.poster_url);
        setNowPlayingMovies(list);
        try {
          sessionStorage.setItem(
            CACHE_KEY_NOW_PLAYING,
            JSON.stringify({
              movies: list,
              timestamp: Date.now(),
            })
          );
        } catch (e) {}
      } catch (err) {
        console.error('Erro ao carregar filmes em cartaz:', err);
      } finally {
        setIsLoadingNowPlaying(false);
      }
    };

    if (!hasCache) fetchNowPlaying();
  }, []);

  return (
    <>
      {/* HERO SECTION */}
      {heroMovie && (
        <section className="hero">
          <div className="hero-bg">
            <img
              src={
                heroMovie.backdrop_url ||
                heroMovie.poster_url ||
                'https://image.tmdb.org/t/p/w1280/qeQJx07rK2xm8SD2sJxFKhE7gs0.jpg'
              }
              alt={heroMovie.title}
            />
          </div>
          <div className="hero-content">
            <div
              className="hero-poster-frame"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/movie/${heroMovie.tmdb_id}?type=${heroMovie.media_type || 'movie'}`)}
            >
              <img
                src={heroMovie.poster_url || 'https://image.tmdb.org/t/p/w500/x0nvYzQpyJc5pdT9lMnkMuYAg0O.jpg'}
                alt={heroMovie.title}
              />
              <span className="hero-poster-rank">#1 EM ALTA</span>
            </div>
            <div className="hero-info">
              <div className="hero-eyebrow">
                <span className="hero-eyebrow-chip orange">DESTAQUE DA SEMANA</span>
                <span className="hero-eyebrow-chip outline">
                  {heroMovie.release_date ? heroMovie.release_date.substring(0, 4) : '2026'}
                </span>
                <span className="hero-eyebrow-chip outline">
                  {heroMovie.media_type === 'tv' ? 'SÉRIE' : 'CINEMA'}
                </span>
              </div>
              <h1 className="hero-title">{heroMovie.title}</h1>
              <p className="hero-tagline">"Descubra análises completas, sinopse e avaliações da comunidade."</p>
              <p className="hero-synopsis">
                {heroMovie.overview || 'Sinopse disponível na página do título.'}
              </p>
              <div className="hero-stats">
                <div className="hero-stat">
                  <span className="hero-stat-value">{heroMovie.tmdb_vote_average?.toFixed(1) || '-'}</span>
                  <span className="hero-stat-label">NOTA TMDB</span>
                </div>
                <div className="hero-stat-divider"></div>
                <div className="hero-stat">
                  <span className="hero-stat-value">
                    {heroMovie.criticbox_rating > 0 ? heroMovie.criticbox_rating.toFixed(1) : '-'}
                  </span>
                  <span className="hero-stat-label">NOTA CRITICBOX</span>
                </div>
                <div className="hero-stat-divider"></div>
                <div className="hero-stat">
                  <span className="hero-stat-value">{heroMovie.criticbox_review_count}</span>
                  <span className="hero-stat-label">AVALIAÇÕES</span>
                </div>
              </div>
              <div className="hero-actions">
                <button
                  className="hero-btn hero-btn-primary"
                  onClick={() => navigate(`/movie/${heroMovie.tmdb_id}?type=${heroMovie.media_type || 'movie'}`)}
                >
                  VER {heroMovie.media_type === 'tv' ? 'SÉRIE' : 'FILME'} & CRÍTICAS
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TRENDING SECTION */}
      <section id="trending-section" className="section">
        <div className="section-header">
          <div className="section-title-group">
            <span className="section-num">01</span>
            <h2 className="section-title">Em Alta Esta Semana</h2>
          </div>
          <Link to="/search" className="section-link">
            EXPLORAR CATÁLOGO
            <ArrowRight size={13} />
          </Link>
        </div>

        {isLoadingTrending ? (
          <div className="loading-pulse">Carregando catálogo em destaque...</div>
        ) : (
          <div className="movies-grid">
            {trendingMovies.slice(0, 10).map((m, idx) => (
              <div
                key={m.tmdb_id}
                className="movie-card"
                onClick={() => navigate(`/movie/${m.tmdb_id}?type=${m.media_type || 'movie'}`)}
                title={`Ver detalhes de ${m.title}`}
              >
                <div className="movie-card-poster">
                  <img src={m.poster_url || 'https://via.placeholder.com/500x750?text=Sem+Poster'} alt={m.title} loading="lazy" />
                  <span className="movie-card-rank">#{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
                  <span className={`media-type-chip ${m.media_type === 'tv' ? 'series' : ''}`}>
                    {m.media_type === 'tv' ? 'SÉRIE' : 'FILME'}
                  </span>
                  <span className="movie-card-score">
                    <Star size={11} fill="currentColor" stroke="none" />
                    {m.tmdb_vote_average ? m.tmdb_vote_average.toFixed(1) : '-'}
                  </span>
                </div>
                <div className="movie-card-info">
                  <span className="movie-card-title">{m.title}</span>
                  <span className="movie-card-meta">
                    {m.release_date ? m.release_date.substring(0, 4) : '2026'} • Criticbox:{' '}
                    {m.criticbox_rating > 0 ? `${m.criticbox_rating.toFixed(1)}/5.0` : 'Sem notas'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SEÇÃO 02: EM CARTAZ NOS CINEMAS */}
      <section id="now-playing-section" className="section" style={{ paddingTop: 0 }}>
        <div className="section-header">
          <div className="section-title-group">
            <span className="section-num">02</span>
            <h2 className="section-title">Em Cartaz nos Cinemas</h2>
          </div>
          <Link to="/search" className="section-link">
            EXPLORAR CATÁLOGO
            <ArrowRight size={13} />
          </Link>
        </div>

        {isLoadingNowPlaying ? (
          <div className="loading-pulse">Carregando filmes em cartaz nos cinemas...</div>
        ) : (
          <div className="movies-grid">
            {nowPlayingMovies.slice(0, 10).map((m, idx) => (
              <div
                key={m.tmdb_id}
                className="movie-card"
                onClick={() => navigate(`/movie/${m.tmdb_id}?type=${m.media_type || 'movie'}`)}
                title={`Ver detalhes de ${m.title}`}
              >
                <div className="movie-card-poster">
                  <img src={m.poster_url || 'https://via.placeholder.com/500x750?text=Sem+Poster'} alt={m.title} loading="lazy" />
                  <span className="movie-card-rank">#{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}</span>
                  <span className="media-type-chip">CINEMA</span>
                  <span className="movie-card-score">
                    <Star size={11} fill="currentColor" stroke="none" />
                    {m.tmdb_vote_average ? m.tmdb_vote_average.toFixed(1) : '-'}
                  </span>
                </div>
                <div className="movie-card-info">
                  <span className="movie-card-title">{m.title}</span>
                  <span className="movie-card-meta">
                    {m.release_date ? m.release_date.substring(0, 4) : '2026'} • Criticbox:{' '}
                    {m.criticbox_rating > 0 ? `${m.criticbox_rating.toFixed(1)}/5.0` : 'Sem notas'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* RECENT REVIEWS SECTION */}
      <section id="reviews-section" className="section" style={{ paddingTop: 0 }}>
        <div className="section-header">
          <div className="section-title-group">
            <span className="section-num">03</span>
            <h2 className="section-title">Críticas Recentes da Comunidade</h2>
          </div>
        </div>

        {isLoadingReviews ? (
          <div className="loading-pulse">Carregando avaliações recentes...</div>
        ) : recentReviews.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', background: '#0a0c11', border: '1px solid var(--gray-700)' }}>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.95rem', color: 'var(--gray-400)' }}>
              Nenhuma crítica registrada ainda. Seja o primeiro a avaliar um título!
            </p>
          </div>
        ) : (
          <>
            <div className="reviews-grid">
              {displayedReviews.map((r) => (
                <div key={r.review_id} className="review-card review-card-with-poster">
                  <div
                    className="review-card-poster"
                    onClick={() => navigate(`/movie/${r.tmdb_id}?type=${r.media_type || 'movie'}`)}
                    title={`Ver detalhes de ${r.movie_title || 'Título'}`}
                  >
                    {posters[r.tmdb_id] ? (
                      <img src={posters[r.tmdb_id]} alt={r.movie_title || 'Poster'} loading="lazy" />
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
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigate(`/movie/${r.tmdb_id}?type=${r.media_type || 'movie'}`)}
                      >
                        {r.movie_title || `Título #${r.tmdb_id}`}
                        {r.season_number && r.episode_number ? (
                          <span className="review-scope-chip">
                            T{r.season_number < 10 ? `0${r.season_number}` : r.season_number}E
                            {r.episode_number < 10 ? `0${r.episode_number}` : r.episode_number}
                          </span>
                        ) : r.season_number ? (
                          <span className="review-scope-chip">T{r.season_number}</span>
                        ) : r.media_type === 'tv' ? (
                          <span className="review-scope-chip">SÉRIE</span>
                        ) : null}
                      </span>
                      <span className="review-card-score-badge">{r.rating.toFixed(1)}</span>
                    </div>
                    <div className="review-card-stars">
                      {[1, 2, 3, 4, 5].map((i) => {
                        const isFilled = i <= Math.round(r.rating || 0);
                        return (
                          <Star
                            key={i}
                            size={12}
                            fill={isFilled ? 'var(--accent)' : 'none'}
                            color={isFilled ? 'var(--accent)' : 'var(--gray-700)'}
                          />
                        );
                      })}
                    </div>
                    <ReviewComment comment={r.comment} containsSpoilers={r.contains_spoilers} />
                    <div className="review-card-user">
                      <span className="review-card-avatar">{(r.user_id || 'U')[0].toUpperCase()}</span>
                      <span className="review-card-username">@{r.user_id}</span>
                      <span className="review-card-date">{formatReviewDate(r.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalReviewsPages > 1 && (
              <div ref={reviewsPaginationRef} className="reviews-pagination">
                <button
                  type="button"
                  className="pagination-square-btn"
                  disabled={currentReviewsPage <= 1}
                  onClick={() => handleReviewsPageChange(Math.max(1, currentReviewsPage - 1))}
                  aria-label="Página anterior"
                  title="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalReviewsPages }, (_, idx) => idx + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    className={`pagination-square-btn ${currentReviewsPage === pageNum ? 'active' : ''}`}
                    onClick={() => handleReviewsPageChange(pageNum)}
                    title={`Página ${pageNum}`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  className="pagination-square-btn"
                  disabled={currentReviewsPage >= totalReviewsPages}
                  onClick={() => handleReviewsPageChange(Math.min(totalReviewsPages, currentReviewsPage + 1))}
                  aria-label="Próxima página"
                  title="Próxima página"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* CTA BANNER - ONLY SHOWN IF NOT LOGGED IN */}
      {!isLoggedIn && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="cta-banner">
            <div className="cta-text">
              <h2>COMECE A CRITICAR AGORA.</h2>
              <p>Crie sua conta e compartilhe suas opiniões sobre os filmes que você assistiu.</p>
            </div>
            <button className="cta-btn" onClick={() => openAuth('register')}>
              CRIAR CONTA GRÁTIS
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}
    </>
  );
}
