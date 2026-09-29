import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  Clock,
  Check,
  Plus,
  PlayCircle,
  ExternalLink,
  Users,
  User,
  MessageSquare,
  ArrowRight,
  Tv,
  Film,
  Calendar,
  Globe,
  DollarSign,
  TrendingUp,
  Tv2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useReviewModal } from '../context/ReviewModalContext';
import { getMovieDetails, getSeasonEpisodes, getSeriesEpisodes } from '../api/movies';
import { getMovieReviews } from '../api/reviews';
import ReviewComment from '../components/ReviewComment';
import { formatReviewDate, formatReleaseDate, isUnreleased } from '../utils/date';
import { SERIES_EPISODES_CACHE } from '../utils/constants';

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

  // Aba ativa: 'cast' | 'crew' | 'market'
  const [activeInfoTab, setActiveInfoTab] = useState('cast');

  // Controle "Mostrar mais" do elenco
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

      // Se for série, inicializa a primeira temporada
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

  // Helper para moedas (Budget & Revenue)
  const formatCurrency = (val) => {
    if (!val || val <= 0) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

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

  // Helper para status de séries/filmes traduzidos
  const translateStatus = (s) => {
    if (!s) return null;
    const map = {
      'Returning Series': 'Em Exibição',
      Ended: 'Finalizada',
      Canceled: 'Cancelada',
      'In Production': 'Em Produção',
      'Post Production': 'Pós-Produção',
      Released: 'Lançado',
      Planned: 'Planejado',
    };
    return map[s] || s;
  };

  // Provedores de Streaming (Watch Providers BR)
  const wp = movie.watch_providers || {};
  const flatrateList = wp.flatrate || [];
  const rentList = wp.rent || [];
  const buyList = wp.buy || [];
  const hasAnyProviders = flatrateList.length > 0 || rentList.length > 0 || buyList.length > 0;

  // Todos os provedores únicos (sem duplicatas, logo consolidada)
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

  // Rolagem no carrossel de recomendações
  const scrollRecs = (dir) => {
    if (recsCarouselRef.current) {
      const scrollAmt = dir === 'left' ? -350 : 350;
      recsCarouselRef.current.scrollBy({ left: scrollAmt, behavior: 'smooth' });
    }
  };

  // Elenco visível
  const castList = movie.cast || [];
  const visibleCast = showAllCast ? castList : castList.slice(0, INITIAL_CAST_COUNT);
  const hasMoreCast = castList.length > INITIAL_CAST_COUNT;

  const renderReviewCard = (r) => (
    <div key={r.review_id} className="review-card">
      <div className="review-card-body">
        <div className="review-card-header">
          <div className="movie-review-author-info">
            <span className="review-card-avatar">{(r.user_id || 'U')[0].toUpperCase()}</span>
            <span className="review-card-username">@{r.user_id}</span>
            {r.season_number && r.episode_number ? (
              <span className="review-scope-chip">
                T{r.season_number < 10 ? `0${r.season_number}` : r.season_number}E
                {r.episode_number < 10 ? `0${r.episode_number}` : r.episode_number}
              </span>
            ) : r.season_number ? (
              <span className="review-scope-chip">T{r.season_number}</span>
            ) : null}
          </div>
          <div className="movie-review-rating-wrap">
            <div className="review-card-stars">
              {[1, 2, 3, 4, 5].map((i) => {
                const isFilled = i <= Math.round(r.rating || 0);
                return (
                  <Star
                    key={i}
                    size={13}
                    fill={isFilled ? 'var(--accent)' : 'none'}
                    color={isFilled ? 'var(--accent)' : 'var(--gray-700)'}
                  />
                );
              })}
            </div>
            <span className="review-card-score-badge">{r.rating.toFixed(1)}</span>
          </div>
        </div>

        <ReviewComment comment={r.comment} containsSpoilers={r.contains_spoilers} />

        <div className="movie-review-footer">
          <span className="review-card-date">{formatReviewDate(r.created_at)}</span>
        </div>
      </div>
    </div>
  );

  // Renderização do conteúdo da aba Ficha Técnica (Dossiê de Produção Industrial - Máx 6 itens)
  const renderCrewTab = () => {
    const cards = [];
    if (movie.directors && movie.directors.length > 0) {
      cards.push(
        <div key="directors" className="dossier-card">
          <span className="dossier-label">// {movie.media_type === 'tv' ? 'CRIAÇÃO / DIREÇÃO' : 'DIREÇÃO'}</span>
          <span className="dossier-value">{movie.directors.join(', ')}</span>
        </div>
      );
    }
    if (movie.writers && movie.writers.length > 0) {
      cards.push(
        <div key="writers" className="dossier-card">
          <span className="dossier-label">// ROTEIRO & ARGUMENTO</span>
          <span className="dossier-value">{movie.writers.join(', ')}</span>
        </div>
      );
    }
    if (movie.music_composers && movie.music_composers.length > 0) {
      cards.push(
        <div key="music" className="dossier-card">
          <span className="dossier-label">// TRILHA SONORA ORIGINAL</span>
          <span className="dossier-value">{movie.music_composers.join(', ')}</span>
        </div>
      );
    }
    if (movie.cinematographers && movie.cinematographers.length > 0) {
      cards.push(
        <div key="cinematographers" className="dossier-card">
          <span className="dossier-label">// DIREÇÃO DE FOTOGRAFIA</span>
          <span className="dossier-value">{movie.cinematographers.join(', ')}</span>
        </div>
      );
    }
    if (movie.producers && movie.producers.length > 0) {
      cards.push(
        <div key="producers" className="dossier-card">
          <span className="dossier-label">// PRODUÇÃO EXECUTIVA</span>
          <span className="dossier-value">{movie.producers.slice(0, 4).join(', ')}</span>
        </div>
      );
    }
    if (runtimeStr) {
      cards.push(
        <div key="runtime" className="dossier-card">
          <span className="dossier-label">// DURAÇÃO</span>
          <span className="dossier-value mono">{runtimeStr}</span>
        </div>
      );
    }
    if (movie.original_language) {
      cards.push(
        <div key="lang" className="dossier-card">
          <span className="dossier-label">// IDIOMA ORIGINAL</span>
          <span className="dossier-value mono">{movie.original_language.toUpperCase()}</span>
        </div>
      );
    }
    if (movie.certification) {
      cards.push(
        <div key="cert" className="dossier-card">
          <span className="dossier-label">// CLASSIFICAÇÃO INDICATIVA</span>
          <span className="dossier-value mono">{movie.certification} ANOS (DJCTQ/ClassInd)</span>
        </div>
      );
    }
    if (movie.release_date) {
      cards.push(
        <div key="release" className="dossier-card">
          <span className="dossier-label">// DATA DE LANÇAMENTO</span>
          <span className="dossier-value mono">{formatReleaseDate(movie.release_date)}</span>
        </div>
      );
    }

    return (
      <div className="info-tab-content">
        <div className="dossier-grid">
          {cards.slice(0, 6)}
        </div>
      </div>
    );
  };

  // Renderização do conteúdo da aba Mercado (Métricas Financeiras & Distribuição)
  const renderMarketTab = () => (
    <div className="info-tab-content">
      <div className="dossier-grid">
        {movie.media_type === 'movie' ? (
          <>
            <div className="dossier-card">
              <span className="dossier-label">// ORÇAMENTO ESTIMADO</span>
              <span className="dossier-value mono">{formatCurrency(movie.budget) || 'NÃO DIVULGADO'}</span>
            </div>
            <div className="dossier-card">
              <span className="dossier-label">// BILHETERIA MUNDIAL</span>
              <span className="dossier-value mono">{formatCurrency(movie.revenue) || 'NÃO DIVULGADO'}</span>
            </div>
            <div className="dossier-card">
              <span className="dossier-label">// STATUS DE PRODUÇÃO</span>
              <span className="dossier-value mono">{translateStatus(movie.status) || 'LANÇADO'}</span>
            </div>
          </>
        ) : (
          <>
            <div className="dossier-card">
              <span className="dossier-label">// STATUS DE EXIBIÇÃO</span>
              <span className="dossier-value mono">{translateStatus(movie.status) || 'EM EXIBIÇÃO'}</span>
            </div>
            <div className="dossier-card">
              <span className="dossier-label">// VOLUMETRIA</span>
              <span className="dossier-value mono">
                {movie.number_of_seasons} TEMPORADA{movie.number_of_seasons > 1 ? 'S' : ''} ({movie.number_of_episodes || 0} EPS)
              </span>
            </div>
            {movie.networks && movie.networks.length > 0 && (
              <div className="dossier-card">
                <span className="dossier-label">// EMISSORA ORIGINAL</span>
                <span className="dossier-value">{movie.networks.map((n) => n.name).join(', ')}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Onde Assistir */}
      {hasAnyProviders && (
        <div className="market-streaming-block">
          <div className="market-streaming-header">
            <span className="dossier-label">// ONDE ASSISTIR NO BRASIL (STREAMING & VOD)</span>
          </div>
          <div className="market-streaming-grid">
            {allProviders.map((p, idx) => (
              <div key={idx} className="market-streaming-card" title={`${p.provider_name} (${p.types.join(', ')})`}>
                {p.logo_url && <img src={p.logo_url} alt={p.provider_name} className="market-streaming-logo" />}
                <div className="market-streaming-info">
                  <span className="market-streaming-name">{p.provider_name}</span>
                  <span className="market-streaming-types">{p.types.join(' • ')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

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
          {/* COLUNA ESQUERDA: PÔSTER + AVALIAR + PREVIEW STREAMING */}
          <div className="movie-detail-poster-col">
            <div className="movie-detail-poster">
              <img src={movie.poster_url || 'https://via.placeholder.com/500x750?text=Sem+Poster'} alt={movie.title} />
            </div>

            {unreleased ? (
              <div className="movie-unreleased-badge" title="Este título ainda não foi lançado">
                <Clock size={16} style={{ flexShrink: 0 }} />
                <span>NÃO DISPONÍVEL (ESTREIA EM {formatReleaseDate(movie.release_date).toUpperCase()})</span>
              </div>
            ) : userAlreadyReviewed ? (
              <div className="movie-already-reviewed-badge">
                <Check size={16} />
                VOCÊ JÁ AVALIOU
              </div>
            ) : (
              <button
                className="movie-detail-eval-btn"
                onClick={() => openReviewModal(movie, loadData)}
              >
                <Star size={15} fill="currentColor" />
                AVALIAR {movie.media_type === 'tv' ? 'ESTA SÉRIE / EPISÓDIO' : 'ESTE FILME'}
              </button>
            )}

            {/* PREVIEW COMPACTO DE STREAMING NO BRASIL */}
            {hasAnyProviders && (
              <div className="hero-streaming-preview">
                <div className="hero-streaming-title">
                  <span>DISPONÍVEL NO BRASIL</span>
                </div>
                <div className="hero-streaming-logos">
                  {allProviders.slice(0, 6).map((p, idx) => (
                    <img
                      key={idx}
                      src={p.logo_url}
                      alt={p.provider_name}
                      title={`${p.provider_name} — ${p.types.join(', ')}`}
                      className="hero-streaming-logo-img"
                    />
                  ))}
                  {allProviders.length > 6 && (
                    <span className="hero-streaming-overflow">+{allProviders.length - 6}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* COLUNA DIREITA: INFORMAÇÕES DETALHADAS */}
          <div className="movie-detail-info-col">
            <button className="movie-detail-back-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={14} style={{ marginRight: '6px' }} />
              VOLTAR
            </button>

            {/* KICKER DE CABEÇALHO BRUTALISTA */}
            <div className="movie-detail-kicker">
              <span className={`movie-kicker-type ${movie.media_type === 'tv' ? 'series' : ''}`}>
                {movie.media_type === 'tv' ? (
                  <>
                    <Tv size={11} /> SÉRIE
                  </>
                ) : (
                  <>
                    <Film size={11} /> FILME
                  </>
                )}
              </span>
              {movie.certification && (
                <>
                  <span className="movie-kicker-dot">•</span>
                  {getClassIndBadge(movie.certification)}
                </>
              )}
              {movie.genres && movie.genres.length > 0 && (
                <>
                  <span className="movie-kicker-dot">•</span>
                  <span className="movie-kicker-genres">{movie.genres.slice(0, 3).join(' / ').toUpperCase()}</span>
                </>
              )}
              {movie.status && (
                <>
                  <span className="movie-kicker-dot">•</span>
                  <span className="movie-kicker-status">{translateStatus(movie.status).toUpperCase()}</span>
                </>
              )}
            </div>

            {/* TÍTULO (SEM LOGO) */}
            <h1 className="movie-detail-title">{movie.title}</h1>

            {/* TÍTULO ORIGINAL (APENAS O TEXTO + IDIOMA BADGE) */}
            {movie.original_title && movie.original_title.toLowerCase() !== movie.title.toLowerCase() && (
              <div className="movie-original-title">
                <span><strong>{movie.original_title}</strong></span>
                {movie.original_language && (
                  <span className="movie-genre-badge" style={{ padding: '1px 6px', fontSize: '0.62rem' }}>
                    {movie.original_language.toUpperCase()}
                  </span>
                )}
              </div>
            )}

            {movie.tagline && <p className="movie-detail-tagline">"{movie.tagline}"</p>}

            {/* METADADOS: DATA + TEMPO/TEMPORADAS + IDIOMAS */}
            <div className="movie-detail-meta">
              <span>{movie.release_date ? movie.release_date.substring(0, 4) : '2026'}</span>
              {movie.media_type === 'tv' && movie.number_of_seasons ? (
                <span>
                  • {movie.number_of_seasons} Temporada{movie.number_of_seasons > 1 ? 's' : ''} (
                  {movie.number_of_episodes || 0} eps)
                </span>
              ) : (
                runtimeStr && <span>• {runtimeStr}</span>
              )}
              {movie.spoken_languages && movie.spoken_languages.length > 0 && (
                <span>• {movie.spoken_languages.slice(0, 2).join(', ')}</span>
              )}
            </div>

            {/* DIREÇÃO / CRIADORES */}
            {movie.directors && movie.directors.length > 0 && (
              <div className="movie-detail-directors">
                <span>{movie.media_type === 'tv' ? 'CRIADO POR / DIREÇÃO:' : 'DIREÇÃO:'}</span>
                {movie.directors.map((d) => (
                  <span key={d} className="director-chip">
                    {d}
                  </span>
                ))}
              </div>
            )}

            {/* LINKS EXTERNOS: IMDB & SITE OFICIAL */}
            {(movie.imdb_id || movie.homepage) && (
              <div className="movie-external-links">
                {movie.imdb_id && (
                  <a
                    href={`https://www.imdb.com/title/${movie.imdb_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="movie-ext-badge imdb"
                  >
                    IMDb
                    <ExternalLink size={11} />
                  </a>
                )}
                {movie.homepage && (
                  <a
                    href={movie.homepage}
                    target="_blank"
                    rel="noreferrer"
                    className="movie-ext-badge"
                  >
                    <Globe size={11} />
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
                <span className="detail-ledger-score">★ {movie.tmdb_vote_average ? movie.tmdb_vote_average.toFixed(1) : '-'}</span>
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

      {/* SEÇÃO GUIA COMPLETO DE SÉRIES (TEMPORADAS & EPISÓDIOS) */}
      {movie.media_type === 'tv' && movie.seasons && movie.seasons.length > 0 && (
        <section className="section" style={{ paddingTop: '40px', paddingBottom: '30px' }}>
          <div className="section-header">
            <div className="section-title-group">
              <span className="section-num">
                <Tv2 size={18} />
              </span>
              <h2 className="section-title">Temporadas & Episódios</h2>
            </div>
            <div className="series-header-stats">
              <span>{movie.number_of_seasons} {movie.number_of_seasons === 1 ? 'Temporada' : 'Temporadas'}</span>
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
                        T{movie.last_episode_to_air.season_number}E{movie.last_episode_to_air.episode_number} · {movie.last_episode_to_air.name}
                      </h4>
                      <span className="series-special-date">
                        {formatReleaseDate(movie.last_episode_to_air.air_date)}
                        {movie.last_episode_to_air.vote_average > 0 && ` · ★ ${movie.last_episode_to_air.vote_average.toFixed(1)}`}
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
                        T{movie.next_episode_to_air.season_number}E{movie.next_episode_to_air.episode_number} · {movie.next_episode_to_air.name}
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
                        {(ep.directors?.length > 0 || ep.writers?.length > 0) ? (
                          <div className="episode-crew">
                            {ep.directors?.length > 0 && <span>Dir: {ep.directors.join(', ')}</span>}
                            {ep.directors?.length > 0 && ep.writers?.length > 0 && <span className="episode-crew-sep">/</span>}
                            {ep.writers?.length > 0 && <span>Rot: {ep.writers.join(', ')}</span>}
                          </div>
                        ) : <div />}

                        <button
                          type="button"
                          className="episode-eval-btn"
                          onClick={() =>
                            openReviewModal(movie, loadData, {
                              season: selectedSeason,
                              episode: ep.episode_number,
                            })
                          }
                        >
                          <Star size={11} fill="currentColor" />
                          AVALIAR
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="watch-providers-empty">
                Episódios desta temporada não detalhados no catálogo.
              </div>
            )}
          </div>
        </section>
      )}

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
      <section className="section" style={{ paddingTop: '30px', paddingBottom: '30px' }}>
        <div className="detail-info-tabs">
          <button
            className={`detail-info-tab ${activeInfoTab === 'cast' ? 'active' : ''}`}
            onClick={() => setActiveInfoTab('cast')}
          >
            <Users size={15} />
            Elenco Principal {castList.length > 0 ? `(${castList.length})` : ''}
          </button>
          <button
            className={`detail-info-tab ${activeInfoTab === 'crew' ? 'active' : ''}`}
            onClick={() => setActiveInfoTab('crew')}
          >
            <Sparkles size={15} />
            Ficha Técnica
          </button>
          <button
            className={`detail-info-tab ${activeInfoTab === 'market' ? 'active' : ''}`}
            onClick={() => setActiveInfoTab('market')}
          >
            <DollarSign size={15} />
            Mercado
          </button>
        </div>

        {/* Conteúdo da aba ativa */}
        {activeInfoTab === 'cast' && (
          <div className="info-tab-content">
            {castList.length > 0 ? (
              <>
                <div className="cast-grid">
                  {visibleCast.map((actor, idx) => (
                    <div key={idx} className="cast-card">
                      {actor.profile_url ? (
                        <img src={actor.profile_url} alt={actor.name} className="cast-photo" loading="lazy" />
                      ) : (
                        <div className="cast-photo-placeholder">
                          <User size={28} color="var(--gray-500)" />
                        </div>
                      )}
                      <div className="cast-info">
                        <span className="cast-name" title={actor.name}>
                          {actor.name}
                        </span>
                        <span className="cast-char" title={actor.character}>
                          {actor.character || 'Personagem'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {hasMoreCast && (
                  <div className="cast-footer-wrap">
                    <button
                      type="button"
                      className="cast-show-more-btn"
                      onClick={() => setShowAllCast(!showAllCast)}
                    >
                      {showAllCast ? (
                        <>
                          <ChevronUp size={16} />
                          <span>RECOLHER ELENCO</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={16} />
                          <span>MOSTRAR TODO O ELENCO</span>
                          <span className="cast-btn-badge">+{castList.length - INITIAL_CAST_COUNT}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="watch-providers-empty">
                Elenco não informado para este título.
              </div>
            )}
          </div>
        )}

        {activeInfoTab === 'crew' && renderCrewTab()}
        {activeInfoTab === 'market' && renderMarketTab()}
      </section>

      {/* SEÇÃO TÍTULOS RECOMENDADOS / SIMILARES */}
      {movie.recommendations && movie.recommendations.length > 0 && (
        <section className="section" style={{ paddingTop: '30px', paddingBottom: '30px' }}>
          <div className="section-header">
            <div className="section-title-group">
              <span className="section-num">
                <TrendingUp size={18} />
              </span>
              <h2 className="section-title">Títulos Recomendados ({movie.recommendations.length})</h2>
            </div>
            <div className="carousel-controls">
              <button
                className="carousel-ctrl-btn"
                onClick={() => scrollRecs('left')}
                title="Rolar para esquerda"
                aria-label="Rolar para esquerda"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="carousel-ctrl-btn"
                onClick={() => scrollRecs('right')}
                title="Rolar para direita"
                aria-label="Rolar para direita"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="recommendations-wrap">
            <div className="recommendations-carousel" ref={recsCarouselRef}>
              {movie.recommendations.map((rec) => (
                <div
                  key={rec.tmdb_id}
                  className="rec-card"
                  onClick={() => navigate(`/movie/${rec.tmdb_id}?type=${rec.media_type || movie.media_type}`)}
                >
                  <img
                    src={rec.poster_url || 'https://via.placeholder.com/300x450?text=Sem+Poster'}
                    alt={rec.title}
                    className="rec-poster"
                    loading="lazy"
                  />
                  <div className="rec-info">
                    <span className="rec-title" title={rec.title}>
                      {rec.title}
                    </span>
                    <div className="rec-meta">
                      <span>{rec.release_date ? rec.release_date.substring(0, 4) : ''}</span>
                      {rec.tmdb_vote_average > 0 && (
                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                          ★ {rec.tmdb_vote_average.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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
            {/* Linha divisória acima da crítica do usuário */}
            {userReviews.length > 0 && (
              <div className="movie-reviews-divider">
                <div className="movie-reviews-divider-line" />
                <span className="movie-reviews-divider-label">Sua Crítica</span>
                <div className="movie-reviews-divider-line" />
              </div>
            )}

            {/* Crítica(s) do usuário logado sempre no topo */}
            {userReviews.map((r) => renderReviewCard(r))}

            {/* Linha divisória entre a crítica do usuário e as demais */}
            {userReviews.length > 0 && otherReviews.length > 0 && (
              <div className="movie-reviews-divider">
                <div className="movie-reviews-divider-line" />
                <span className="movie-reviews-divider-label">Críticas da Comunidade</span>
                <div className="movie-reviews-divider-line" />
              </div>
            )}

            {/* Demais críticas da comunidade */}
            {otherReviews.map((r) => renderReviewCard(r))}
          </div>
        )}
      </section>

    </div>
  );
}
