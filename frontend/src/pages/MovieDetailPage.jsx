import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Check,
  Plus,
  PlayCircle,
  ExternalLink,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useReviewModal } from '../context/ReviewModalContext';
import { getMovieDetails, getSeasonEpisodes } from '../api/movies';
import { getMovieReviews } from '../api/reviews';
import ReviewCard from '../components/ReviewCard';
import SeriesEpisodeGuide from '../components/detail/SeriesEpisodeGuide';
import ProductionDossier from '../components/detail/ProductionDossier';
import RecommendationsCarousel from '../components/detail/RecommendationsCarousel';
import { formatReleaseDate, isUnreleased } from '../utils/date';

const INITIAL_CAST_COUNT = 6;

export default function MovieDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const mediaType = searchParams.get('type') || '';
  const navigate = useNavigate();

  const { username } = useAuth();
  const { openReviewModal } = useReviewModal();

  const [movie, setMovie] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Aba ativa do dossiê: 'cast' | 'crew' | 'market'
  const [activeInfoTab, setActiveInfoTab] = useState('cast');
  const [showAllCast, setShowAllCast] = useState(false);

  // Séries: Temporada ativa e episódios
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [seasonEpisodesMap, setSeasonEpisodesMap] = useState({});
  const [loadingSeason, setLoadingSeason] = useState(false);

  // Carrossel de Recomendações
  const recsCarouselRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [movieData, reviewsData] = await Promise.all([
        getMovieDetails(id, mediaType),
        getMovieReviews(id).catch(() => []),
      ]);

      setMovie(movieData);
      setReviews(reviewsData || []);

      if (movieData.media_type === 'tv' && movieData.seasons && movieData.seasons.length > 0) {
        const firstSeasonNum = movieData.seasons[0].season_number || 1;
        setSelectedSeason(firstSeasonNum);
        loadSeasonEpisodes(firstSeasonNum);
      }
    } catch (err) {
      setError(err.message || 'Erro ao carregar detalhes do título.');
    } finally {
      setLoading(false);
    }
  };

  const loadSeasonEpisodes = async (seasonNum) => {
    if (seasonEpisodesMap[seasonNum]) return;
    setLoadingSeason(true);
    try {
      const res = await getSeasonEpisodes(id, seasonNum);
      if (res?.episodes) {
        setSeasonEpisodesMap((prev) => ({
          ...prev,
          [seasonNum]: res.episodes,
        }));
      }
    } catch (err) {
      console.warn('Erro ao carregar episódios da temporada:', err);
    } finally {
      setLoadingSeason(false);
    }
  };

  const handleSelectSeason = (seasonNum) => {
    setSelectedSeason(seasonNum);
    loadSeasonEpisodes(seasonNum);
  };

  useEffect(() => {
    loadData();
    setShowAllCast(false);
    setActiveInfoTab('cast');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id, mediaType]);

  if (loading) {
    return <div className="loading-pulse" style={{ marginTop: '100px' }}>Carregando catálogo e ficha técnica...</div>;
  }

  if (error || !movie) {
    return (
      <div className="section" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.8rem', color: '#fff', marginBottom: '12px' }}>
          {error || 'Título não encontrado'}
        </h2>
        <button className="nav-btn nav-btn-accent" onClick={() => navigate('/')}>
          <ArrowLeft size={14} style={{ marginRight: '6px' }} />
          VOLTAR AO INÍCIO
        </button>
      </div>
    );
  }

  const unreleased = isUnreleased(movie.release_date);
  const userReviews = username
    ? reviews.filter((r) => r.user_id && r.user_id.toLowerCase() === username.toLowerCase())
    : [];
  const otherReviews = username
    ? reviews.filter((r) => !r.user_id || r.user_id.toLowerCase() !== username.toLowerCase())
    : reviews;

  const userAlreadyReviewed = Boolean(
    username &&
      movie.media_type !== 'tv' &&
      userReviews.length > 0
  );

  const runtimeHours = movie.runtime ? Math.floor(movie.runtime / 60) : 0;
  const runtimeMins = movie.runtime ? movie.runtime % 60 : 0;
  const runtimeStr = movie.runtime ? `${runtimeHours > 0 ? `${runtimeHours}H ` : ''}${runtimeMins}MIN` : '';

  const getYouTubeKey = (url) => {
    if (!url) return null;
    const match = url.match(/(?:watch\?v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };
  const trailerKey = getYouTubeKey(movie.trailer_url);

  // Helper para selos oficiais da Classificação Indicativa do Brasil (DJCTQ/ClassInd)
  const getClassIndBadge = (cert) => {
    if (!cert) return null;
    const c = String(cert).toUpperCase().trim();
    if (c === 'L' || c === 'LIVRE') return <span className="classind-badge classind-l">L</span>;
    if (c === '10') return <span className="classind-badge classind-10">10</span>;
    if (c === '12') return <span className="classind-badge classind-12">12</span>;
    if (c === '14') return <span className="classind-badge classind-14">14</span>;
    if (c === '16') return <span className="classind-badge classind-16">16</span>;
    if (c === '18') return <span className="classind-badge classind-18">18</span>;
    return <span className="movie-genre-badge">{c}</span>;
  };

  // Provedores de Streaming (Watch Providers BR)
  const wp = movie.watch_providers || {};
  const flatrateList = wp.flatrate || [];
  const rentList = wp.rent || [];
  const buyList = wp.buy || [];
  const hasAnyProviders = flatrateList.length > 0 || rentList.length > 0 || buyList.length > 0;

  const allProviders = (() => {
    const map = new Map();
    const addToMap = (list, type) => {
      list.forEach((p) => {
        if (!map.has(p.provider_name)) {
          map.set(p.provider_name, { ...p, types: [type] });
        } else {
          map.get(p.provider_name).types.push(type);
        }
      });
    };
    addToMap(flatrateList, 'Assinatura');
    addToMap(rentList, 'Aluguel');
    addToMap(buyList, 'Compra');
    return Array.from(map.values());
  })();

  const scrollRecs = (dir) => {
    if (recsCarouselRef.current) {
      const scrollAmt = dir === 'left' ? -350 : 350;
      recsCarouselRef.current.scrollBy({ left: scrollAmt, behavior: 'smooth' });
    }
  };

  const castList = movie.cast || [];
  const visibleCast = showAllCast ? castList : castList.slice(0, INITIAL_CAST_COUNT);
  const hasMoreCast = castList.length > INITIAL_CAST_COUNT;

  return (
    <div>
      {/* HERO BANNER DO TÍTULO */}
      <section className="movie-detail-hero">
        <div className="movie-detail-bg">
          <img
            src={
              movie.backdrop_url ||
              movie.poster_url ||
              'https://image.tmdb.org/t/p/w1280/qeQJx07rK2xm8SD2sJxFKhE7gs0.jpg'
            }
            alt={movie.title}
          />
        </div>

        <div className="movie-detail-content">
          {/* COLUNA ESQUERDA: PÔSTER + BOTÃO DE AVALIAR */}
          <div className="movie-detail-poster-col">
            <div className="movie-detail-poster">
              <img
                src={
                  movie.poster_url ||
                  'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?auto=format&fit=crop&w=400&q=80'
                }
                alt={movie.title}
              />
            </div>

            {unreleased ? (
              <div className="movie-unreleased-alert">
                <Clock size={16} />
                <span>LANÇAMENTO FUTURO</span>
              </div>
            ) : userAlreadyReviewed ? (
              <div className="movie-already-reviewed-badge">
                <Check size={16} />
                <span>AVALIADO POR VOCÊ</span>
              </div>
            ) : (
              <button
                className="movie-detail-eval-btn"
                onClick={() => openReviewModal(movie, loadData)}
              >
                <Plus size={16} />
                AVALIAR TÍTULO
              </button>
            )}
          </div>

          {/* COLUNA DIREITA: METADADOS COMPLETOS */}
          <div className="movie-detail-info-col">
            <button className="movie-detail-back-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={13} />
              VOLTAR
            </button>

            <div>
              <h1 className="movie-detail-title">{movie.title}</h1>
              {movie.original_title && movie.original_title !== movie.title && (
                <span className="movie-detail-orig-title">
                  TÍTULO ORIGINAL: {movie.original_title}
                  {movie.original_language && ` (${movie.original_language.toUpperCase()})`}
                </span>
              )}
            </div>

            {/* DIRETORES / SHOWRUNNERS */}
            {movie.directors && movie.directors.length > 0 && (
              <div className="movie-detail-directors">
                <span className="director-label">
                  {movie.media_type === 'tv' ? 'CRIAÇÃO / DIREÇÃO:' : 'DIREÇÃO:'}
                </span>
                {movie.directors.map((d, i) => (
                  <span key={i} className="director-chip">{d}</span>
                ))}
              </div>
            )}

            {/* TAGLINE */}
            {movie.tagline && <p className="movie-detail-tagline">"{movie.tagline}"</p>}

            {/* BARRA DE METADADOS */}
            <div className="movie-detail-meta-bar">
              {movie.release_date && (
                <span className="movie-detail-meta-item">
                  {movie.release_date.substring(0, 4)}
                </span>
              )}

              {runtimeStr && (
                <span className="movie-detail-meta-item">{runtimeStr}</span>
              )}

              {movie.number_of_seasons && (
                <span className="movie-detail-meta-item">
                  {movie.number_of_seasons} {movie.number_of_seasons === 1 ? 'TEMPORADA' : 'TEMPORADAS'}
                  {movie.number_of_episodes ? ` (${movie.number_of_episodes} EPS)` : ''}
                </span>
              )}

              {getClassIndBadge(movie.certification)}

              {movie.media_type && (
                <span className="movie-format-chip">
                  {movie.media_type === 'tv' ? 'SÉRIE' : 'FILME'}
                </span>
              )}
            </div>

            {/* GÊNEROS */}
            {movie.genres && movie.genres.length > 0 && (
              <div className="movie-detail-genres">
                {movie.genres.map((g) => (
                  <span key={g} className="movie-genre-badge">{g}</span>
                ))}

                {movie.homepage && (
                  <a
                    href={movie.homepage}
                    target="_blank"
                    rel="noreferrer"
                    className="movie-homepage-link"
                    title="Website oficial"
                  >
                    SITE OFICIAL
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            )}

            {/* SINOPSE */}
            <p className="movie-detail-synopsis">
              {movie.overview || 'Sinopse não disponível para este título.'}
            </p>

            {/* LEDGER DE AVALIAÇÃO OFICIAL */}
            <div className="movie-detail-ledger">
              <div className="detail-ledger-item">
                <span className="detail-ledger-score">
                  ★ {movie.tmdb_vote_average ? movie.tmdb_vote_average.toFixed(1) : '-'}
                </span>
                <div className="detail-ledger-meta">
                  <span className="detail-ledger-label">ÍNDICE TMDB</span>
                  <span className="detail-ledger-sub">
                    {movie.vote_count ? `${movie.vote_count.toLocaleString('pt-BR')} VOTOS` : 'BASE GLOBAL'}
                  </span>
                </div>
              </div>
              <div className="detail-ledger-divider" />
              <div className="detail-ledger-item">
                <span className="detail-ledger-score accent">
                  {movie.criticbox_rating > 0 ? movie.criticbox_rating.toFixed(1) : '—'}
                </span>
                <div className="detail-ledger-meta">
                  <span className="detail-ledger-label">NOTA CRITICBOX</span>
                  <span className="detail-ledger-sub">{movie.criticbox_review_count || 0} CRÍTICAS</span>
                </div>
              </div>
              {movie.popularity > 0 && (
                <>
                  <div className="detail-ledger-divider" />
                  <div className="detail-ledger-item">
                    <span className="detail-ledger-score muted">
                      {Math.round(movie.popularity)}
                    </span>
                    <div className="detail-ledger-meta">
                      <span className="detail-ledger-label">POPULARIDADE</span>
                      <span className="detail-ledger-sub">RANKING ATUAL</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO GUIA DE TEMPORADAS E EPISÓDIOS (PARA SÉRIES) */}
      <SeriesEpisodeGuide
        movie={movie}
        selectedSeason={selectedSeason}
        handleSelectSeason={handleSelectSeason}
        loadingSeason={loadingSeason}
        seasonEpisodesMap={seasonEpisodesMap}
        openReviewModal={openReviewModal}
        loadData={loadData}
      />

      {/* SEÇÃO DO TRAILER OFICIAL */}
      {trailerKey && (
        <section className="section" style={{ paddingTop: '30px', paddingBottom: '30px' }}>
          <div className="section-header">
            <div className="section-title-group">
              <span className="section-num">
                <PlayCircle size={18} />
              </span>
              <h2 className="section-title">Trailer Oficial</h2>
            </div>
            <a href={movie.trailer_url} target="_blank" rel="noreferrer" className="section-link">
              ABRIR NO YOUTUBE
              <ExternalLink size={13} />
            </a>
          </div>
          <div className="trailer-frame-wrap">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${trailerKey}`}
              title={`${movie.title} Trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      )}

      {/* SEÇÃO TABULADA: ELENCO | FICHA TÉCNICA | MERCADO */}
      <ProductionDossier
        movie={movie}
        activeInfoTab={activeInfoTab}
        setActiveInfoTab={setActiveInfoTab}
        castList={castList}
        visibleCast={visibleCast}
        showAllCast={showAllCast}
        setShowAllCast={setShowAllCast}
        hasMoreCast={hasMoreCast}
        INITIAL_CAST_COUNT={INITIAL_CAST_COUNT}
        runtimeStr={runtimeStr}
        hasAnyProviders={hasAnyProviders}
        allProviders={allProviders}
      />

      {/* SEÇÃO TÍTULOS RECOMENDADOS / SIMILARES */}
      <RecommendationsCarousel
        recommendations={movie.recommendations}
        recsCarouselRef={recsCarouselRef}
        scrollRecs={scrollRecs}
        navigate={navigate}
      />

      {/* SEÇÃO DE CRÍTICAS DA COMUNIDADE */}
      <section className="section" style={{ paddingTop: '30px', paddingBottom: '60px' }}>
        <div className="section-header">
          <div className="section-title-group">
            <span className="section-num">
              <MessageSquare size={18} />
            </span>
            <h2 className="section-title">Críticas da Comunidade ({reviews.length})</h2>
          </div>
          {unreleased ? (
            <span className="movie-unreleased-chip">
              <Clock size={14} />
              ESTREIA EM {formatReleaseDate(movie.release_date)}
            </span>
          ) : userAlreadyReviewed ? (
            <span className="movie-already-reviewed-badge" style={{ padding: '6px 14px' }}>
              <Check size={14} />
              SUA CRÍTICA JÁ FOI PUBLICADA
            </span>
          ) : (
            <button className="nav-btn nav-btn-accent" onClick={() => openReviewModal(movie, loadData)}>
              <Plus size={14} style={{ marginRight: '6px' }} />
              ESCREVER CRÍTICA
            </button>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="detail-reviews-empty">
            <h3 className="detail-reviews-empty-title">
              {unreleased ? 'Título aguardando lançamento' : 'Nenhuma avaliação para este título ainda'}
            </h3>
            <p className="detail-reviews-empty-desc">
              {unreleased
                ? `As avaliações serão liberadas a partir de ${formatReleaseDate(movie.release_date)}.`
                : 'Seja o primeiro a compartilhar sua análise crítica com a comunidade.'}
            </p>
            {!unreleased && (
              <button className="nav-btn nav-btn-accent" onClick={() => openReviewModal(movie, loadData)}>
                AVALIAR "{movie.title}" AGORA
                <ArrowRight size={14} style={{ marginLeft: '6px' }} />
              </button>
            )}
          </div>
        ) : (
          <div className="movie-reviews-list">
            {userReviews.length > 0 && (
              <div className="movie-reviews-divider">
                <div className="movie-reviews-divider-line" />
                <span className="movie-reviews-divider-label">Sua Crítica</span>
                <div className="movie-reviews-divider-line" />
              </div>
            )}

            {userReviews.map((r) => (
              <ReviewCard key={r.review_id} review={r} />
            ))}

            {userReviews.length > 0 && otherReviews.length > 0 && (
              <div className="movie-reviews-divider">
                <div className="movie-reviews-divider-line" />
                <span className="movie-reviews-divider-label">Críticas da Comunidade</span>
                <div className="movie-reviews-divider-line" />
              </div>
            )}

            {otherReviews.map((r) => (
              <ReviewCard key={r.review_id} review={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
