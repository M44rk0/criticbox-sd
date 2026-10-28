import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useReviewModal } from '../context/ReviewModalContext';
import {
  getTrendingMovies,
  getNowPlayingMovies,
  getTrendingTV,
  getRecommendations,
  getMovieDetails,
} from '../api/movies';
import { getRecentReviews } from '../api/reviews';
import ReviewCard from '../components/ReviewCard';
import MovieCarouselSection from '../components/MovieCarouselSection';
import { isAnime } from '../utils/media';
import {
  CACHE_KEY_TRENDING,
  CACHE_KEY_TRENDING_TV,
  CACHE_KEY_RECOMMENDED,
  CACHE_KEY_REVIEWS,
  CACHE_KEY_NOW_PLAYING,
  CACHE_TTL_MS,
  readSessionCache,
} from '../utils/constants';
import './HomePage.css';

export default function HomePage() {
  const navigate = useNavigate();
  const { isLoggedIn, username, openAuth } = useAuth();
  const { reviewRevision } = useReviewModal();

  const [trendingMovies, setTrendingMovies] = useState([]);
  const [heroMovie, setHeroMovie] = useState(null);
  const [recentReviews, setRecentReviews] = useState([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const REVIEWS_PER_PAGE = 10;
  const [posters, setPosters] = useState({});

  const [isLoadingTrending, setIsLoadingTrending] = useState(true);
  const [nowPlayingMovies, setNowPlayingMovies] = useState([]);
  const [isLoadingNowPlaying, setIsLoadingNowPlaying] = useState(true);
  const [trendingTV, setTrendingTV] = useState([]);
  const [isLoadingTrendingTV, setIsLoadingTrendingTV] = useState(true);
  const [recommendedMovies, setRecommendedMovies] = useState([]);
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(false);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);

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

    let hasTrendingCache = false;
    let hasReviewsCache = false;
    let hasNowPlayingCache = false;
    let hasTVCache = false;
    let hasRecsCache = false;

    if (reviewRevision === 0) {
      const trendingCached = readSessionCache(CACHE_KEY_TRENDING);
      if (trendingCached?.movies?.length > 0) {
        setTrendingMovies(trendingCached.movies);
        if (trendingCached.heroMovie) setHeroMovie(trendingCached.heroMovie);
        if (trendingCached.posters) setPosters((prev) => ({ ...trendingCached.posters, ...prev }));
        setIsLoadingTrending(false);
        hasTrendingCache = true;
      }

      const reviewsCached = readSessionCache(CACHE_KEY_REVIEWS);
      if (reviewsCached?.reviews) {
        setRecentReviews(reviewsCached.reviews);
        const cachedPosters = { ...(reviewsCached.posters || {}) };
        reviewsCached.reviews.forEach((r) => {
          if (r.poster_url) {
            cachedPosters[`${r.tmdb_id}_${r.media_type || 'movie'}`] = r.poster_url;
            cachedPosters[r.tmdb_id] = r.poster_url;
          }
        });
        setPosters((prev) => ({ ...cachedPosters, ...prev }));
        setIsLoadingReviews(false);
        hasReviewsCache = true;
      }

      const nowPlayingCached = readSessionCache(CACHE_KEY_NOW_PLAYING);
      if (nowPlayingCached?.movies?.length > 0) {
        setNowPlayingMovies(nowPlayingCached.movies);
        setIsLoadingNowPlaying(false);
        hasNowPlayingCache = true;
      }

      const tvCached = readSessionCache(CACHE_KEY_TRENDING_TV);
      if (tvCached?.movies?.length > 0) {
        setTrendingTV(tvCached.movies);
        setIsLoadingTrendingTV(false);
        hasTVCache = true;
      }

      if (isLoggedIn && username) {
        const recsCached = readSessionCache(`${CACHE_KEY_RECOMMENDED}_${username}`);
        if (recsCached?.movies?.length > 0) {
          setRecommendedMovies(recsCached.movies);
          setIsLoadingRecommended(false);
          hasRecsCache = true;
        }
      } else {
        setRecommendedMovies([]);
        setIsLoadingRecommended(false);
        hasRecsCache = true;
      }
    } else if (!isLoggedIn || !username) {
      setRecommendedMovies([]);
      setIsLoadingRecommended(false);
      hasRecsCache = true;
    }

    const fetchAllData = async () => {
      const promises = [];
      const keys = [];

      if (!hasTrendingCache) {
        keys.push('trending');
        promises.push(getTrendingMovies());
      }
      if (!hasNowPlayingCache) {
        keys.push('nowPlaying');
        promises.push(getNowPlayingMovies());
      }
      if (!hasTVCache) {
        keys.push('tv');
        promises.push(getTrendingTV());
      }
      if (isLoggedIn && username && !hasRecsCache) {
        setIsLoadingRecommended(true);
        keys.push('recs');
        promises.push(getRecommendations(username));
      }
      if (!hasReviewsCache) {
        keys.push('reviews');
        promises.push(getRecentReviews(100));
      }

      if (promises.length === 0) return;

      const results = await Promise.allSettled(promises);

      results.forEach((res, idx) => {
        const key = keys[idx];
        if (res.status !== 'fulfilled' || !res.value) {
          if (key === 'trending') setIsLoadingTrending(false);
          if (key === 'nowPlaying') setIsLoadingNowPlaying(false);
          if (key === 'tv') setIsLoadingTrendingTV(false);
          if (key === 'recs') setIsLoadingRecommended(false);
          if (key === 'reviews') setIsLoadingReviews(false);
          return;
        }

        const data = res.value;

        if (key === 'trending') {
          const list = data?.movies || [];
          setTrendingMovies(list);
          const hero = list.length > 0 ? list[0] : null;
          if (hero) setHeroMovie(hero);

          const initialPosters = {};
          list.forEach((m) => {
            if (m.tmdb_id && m.poster_url) {
              initialPosters[`${m.tmdb_id}_${m.media_type || 'movie'}`] = m.poster_url;
              initialPosters[m.tmdb_id] = m.poster_url;
            }
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
          setIsLoadingTrending(false);
        } else if (key === 'nowPlaying') {
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
          setIsLoadingNowPlaying(false);
        } else if (key === 'tv') {
          const list = (data?.movies || []).filter((m) => m.poster_url);
          setTrendingTV(list);
          try {
            sessionStorage.setItem(
              CACHE_KEY_TRENDING_TV,
              JSON.stringify({
                movies: list,
                timestamp: Date.now(),
              })
            );
          } catch (e) {}
          setIsLoadingTrendingTV(false);
        } else if (key === 'recs') {
          const list = (data?.movies || []).filter((m) => m.poster_url);
          setRecommendedMovies(list);
          if (username) {
            const cacheKey = `${CACHE_KEY_RECOMMENDED}_${username}`;
            try {
              sessionStorage.setItem(
                cacheKey,
                JSON.stringify({
                  movies: list,
                  timestamp: Date.now(),
                })
              );
            } catch (e) {}
          }
          setIsLoadingRecommended(false);
        } else if (key === 'reviews') {
          const list = data || [];
          setRecentReviews(list);

          const fetchedPosters = {};
          const missingItems = [];
          list.forEach((r) => {
            if (r.poster_url) {
              fetchedPosters[`${r.tmdb_id}_${r.media_type || 'movie'}`] = r.poster_url;
              if (!fetchedPosters[r.tmdb_id]) {
                fetchedPosters[r.tmdb_id] = r.poster_url;
              }
            } else {
              missingItems.push({ id: r.tmdb_id, type: r.media_type || 'movie' });
            }
          });

          if (missingItems.length > 0) {
            const uniqueMissing = Array.from(
              new Map(missingItems.map((item) => [`${item.id}_${item.type}`, item])).values()
            );
            Promise.all(
              uniqueMissing.slice(0, 10).map(async ({ id, type }) => {
                try {
                  const mData = await getMovieDetails(id, type);
                  if (mData?.poster_url) {
                    setPosters((prev) => ({
                      ...prev,
                      [`${id}_${type}`]: mData.poster_url,
                      [id]: mData.poster_url,
                    }));
                  }
                } catch (e) {}
              })
            );
          }

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
          setIsLoadingReviews(false);
        }
      });
    };

    fetchAllData();
  }, [isLoggedIn, username, reviewRevision]);

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
              <span className="hero-poster-rank">#01 · EM ALTA</span>
            </div>
            <div className="hero-info">
              <div className="hero-kicker">
                <span>
                  [ {heroMovie.release_date ? heroMovie.release_date.substring(0, 4) : '2026'} •{' '}
                  {isAnime(heroMovie) ? 'ANIME' : heroMovie.media_type === 'tv' ? 'SÉRIE' : 'LONGA-METRAGEM'} • DESTAQUE
                  DO PROJETOR ]
                </span>
              </div>
              <h1 className="hero-title">{heroMovie.title}</h1>
              <p className="hero-synopsis">
                {heroMovie.overview || 'Sinopse e ficha técnica disponíveis no registro oficial.'}
              </p>
              <div className="hero-ledger">
                <div className="hero-ledger-item">
                  <span className="hero-ledger-score">
                    <span className="detail-ledger-star" aria-hidden="true">★</span>
                    {heroMovie.tmdb_vote_average?.toFixed(1) || '-'}
                  </span>
                  <div className="hero-ledger-meta">
                    <span className="hero-ledger-label">ÍNDICE TMDB</span>
                    <span className="hero-ledger-sub">BASE GLOBAL</span>
                  </div>
                </div>
                <div className="hero-ledger-divider"></div>
                <div className="hero-ledger-item">
                  <span className="hero-ledger-score accent">
                    <span className="cb-square-icon" aria-hidden="true">■</span>
                    {heroMovie.criticbox_rating > 0 ? heroMovie.criticbox_rating.toFixed(1) : '—'}
                  </span>
                  <div className="hero-ledger-meta">
                    <span className="hero-ledger-label">NOTA CRITICBOX</span>
                    <span className="hero-ledger-sub">{heroMovie.criticbox_review_count || 0} AVALIAÇÕES</span>
                  </div>
                </div>
              </div>
              <div className="hero-actions">
                <button
                  className="hero-btn hero-btn-primary"
                  onClick={() => navigate(`/movie/${heroMovie.tmdb_id}?type=${heroMovie.media_type || 'movie'}`)}
                >
                  VER FICHA & CRÍTICAS
                  <ArrowRight size={14} />
                </button>
                <button
                  className="hero-btn hero-btn-ghost"
                  onClick={() => navigate('/search?filter=trending')}
                >
                  EXPLORAR ACERVO
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SEÇÃO 01: EM ALTA NA SEMANA (CARROSSEL HORIZONTAL) */}
      <MovieCarouselSection
        id="trending-section"
        sectionNum="01"
        sectionTitle="Em Alta Esta Semana"
        linkTo="/search?filter=trending"
        linkLabel="ACERVO EM ALTA"
        movies={trendingMovies}
        isLoading={isLoadingTrending}
        loadingMessage="SINCRONIZANDO CATÁLOGO EM DESTAQUE..."
        navigate={navigate}
      />

      {/* SEÇÃO 02: EM CARTAZ NOS CINEMAS (CARROSSEL HORIZONTAL) */}
      <MovieCarouselSection
        id="now-playing-section"
        sectionNum="02"
        sectionTitle="Em Cartaz nos Cinemas"
        linkTo="/search?filter=now_playing"
        linkLabel="SESSÕES EM CARTAZ"
        movies={nowPlayingMovies}
        isLoading={isLoadingNowPlaying}
        loadingMessage="CONSULTANDO PROGRAMAÇÃO DAS SALAS..."
        navigate={navigate}
      />

      {/* SEÇÃO 03: SÉRIES EM ALTA ESSA SEMANA (CARROSSEL HORIZONTAL) */}
      <MovieCarouselSection
        id="tv-section"
        sectionNum="03"
        sectionTitle="Séries em Alta Esta Semana"
        linkTo="/search?filter=series"
        linkLabel="ACERVO DE SÉRIES"
        movies={trendingTV}
        isLoading={isLoadingTrendingTV}
        loadingMessage="SINCRONIZANDO SÉRIES EM ALTA..."
        navigate={navigate}
      />

      {/* SEÇÃO 04: RECOMENDADOS PARA VOCÊ (CARROSSEL HORIZONTAL BASEADO EM REVIEWS - APENAS SE LOGADO) */}
      {isLoggedIn && username && (
        <MovieCarouselSection
          id="recommended-section"
          sectionNum="04"
          sectionTitle="Recomendados para Você"
          linkTo="/search?filter=recommended"
          linkLabel="EXPLORAR RECOMENDAÇÕES"
          movies={recommendedMovies}
          isLoading={isLoadingRecommended}
          loadingMessage="COMPILANDO RECOMENDAÇÕES PERSONALIZADAS..."
          navigate={navigate}
        />
      )}

      {/* SEÇÃO DE CRÍTICAS RECENTES DA COMUNIDADE */}
      <section id="reviews-section" className="section" style={{ paddingTop: 0 }}>
        <div className="section-header">
          <div className="section-title-group">
            <span className="section-num">{isLoggedIn && username ? '05' : '04'}</span>
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
              {displayedReviews.map((r) => {
                const pUrl =
                  r.poster_url ||
                  posters[`${r.tmdb_id}_${r.media_type || 'movie'}`] ||
                  posters[r.tmdb_id];

                return (
                  <ReviewCard
                    key={r.review_id}
                    review={r}
                    posterUrl={pUrl}
                    showPoster={true}
                    canDelete={false}
                    isAnime={isAnime(r)}
                  />
                );
              })}
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
              <h2>SUA VOZ NA CRÍTICA CINEMATOGRÁFICA.</h2>
              <p>Junte-se à nossa comunidade de membros. Registre seus votos, elabore ensaios e acompanhe os grandes lançamentos.</p>
            </div>
            <button className="cta-btn" onClick={() => openAuth('register')}>
              CRIAR CONTA GRATUITA
            </button>
          </div>
        </section>
      )}
    </>
  );
}
