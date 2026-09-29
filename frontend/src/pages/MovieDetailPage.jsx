import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useReviewModal } from '../context/ReviewModalContext';
import { getMovieDetails, getSeriesEpisodes } from '../api/movies';
import { getMovieReviews } from '../api/reviews';
import ReviewComment from '../components/ReviewComment';
import { formatReviewDate, formatReleaseDate, isUnreleased } from '../utils/date';
import { SERIES_EPISODES_CACHE } from '../utils/constants';

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

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [movieData, reviewsData] = await Promise.all([
        getMovieDetails(id, mediaType),
        getMovieReviews(id).catch(() => []),
      ]);

      setMovie(movieData);

      if (movieData.media_type === 'tv' && !SERIES_EPISODES_CACHE[id]) {
        getSeriesEpisodes(id)
          .then((epData) => {
            if (epData) SERIES_EPISODES_CACHE[id] = epData;
          })
          .catch(() => {});
      }

      setReviews(reviewsData || []);
    } catch (err) {
      setError(err.message || 'Erro ao carregar detalhes do título.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id, mediaType]);

  if (loading) {
    return <div className="loading-pulse" style={{ marginTop: '100px' }}>Carregando informações do catálogo...</div>;
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
            ) : r.media_type === 'tv' ? (
              <span className="review-scope-chip">SÉRIE</span>
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
                className="hero-btn hero-btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => openReviewModal(movie, loadData)}
              >
                <Star size={15} fill="currentColor" style={{ marginRight: '6px' }} />
                AVALIAR {movie.media_type === 'tv' ? 'ESTA SÉRIE / EPISÓDIO' : 'ESTE FILME'}
              </button>
            )}
          </div>

          <div className="movie-detail-info-col">
            <button className="movie-detail-back-btn" onClick={() => navigate(-1)}>
              <ArrowLeft size={14} style={{ marginRight: '6px' }} />
              VOLTAR
            </button>

            <div className="movie-detail-genres">
              {movie.media_type === 'tv' && (
                <span className="movie-genre-badge" style={{ background: '#38bdf8', color: '#000', borderColor: '#38bdf8' }}>
                  SÉRIE
                </span>
              )}
              {movie.genres && movie.genres.length > 0 ? (
                movie.genres.map((g) => (
                  <span key={g} className="movie-genre-badge">
                    {g}
                  </span>
                ))
              ) : (
                <span className="movie-genre-badge">CATÁLOGO</span>
              )}
            </div>

            <h1 className="movie-detail-title">{movie.title}</h1>

            {movie.tagline && <p className="movie-detail-tagline">"{movie.tagline}"</p>}

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
            </div>

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

            <p className="movie-detail-synopsis">
              {movie.overview || 'Sinopse não disponível para este título.'}
            </p>

            <div className="movie-detail-ratings-box">
              <div className="movie-detail-rating-item">
                <span className="movie-detail-rating-num">
                  {movie.tmdb_vote_average ? movie.tmdb_vote_average.toFixed(1) : '-'}
                </span>
                <span className="movie-detail-rating-label">NOTA TMDB</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="movie-detail-rating-item">
                <span className="movie-detail-rating-num">
                  {movie.criticbox_rating > 0 ? movie.criticbox_rating.toFixed(1) : '-'}
                </span>
                <span className="movie-detail-rating-label">NOTA CRITICBOX</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="movie-detail-rating-item">
                <span className="movie-detail-rating-num">{movie.criticbox_review_count}</span>
                <span className="movie-detail-rating-label">AVALIAÇÕES</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO DO TRAILER */}
      {trailerKey && (
        <section className="section" style={{ paddingTop: '50px', paddingBottom: '30px' }}>
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

      {/* SEÇÃO DO ELENCO PRINCIPAL */}
      {movie.cast && movie.cast.length > 0 && (
        <section
          className="section"
          style={{ paddingTop: trailerKey ? '30px' : '50px', paddingBottom: '30px' }}
        >
          <div className="section-header">
            <div className="section-title-group">
              <span className="section-num">
                <Users size={18} />
              </span>
              <h2 className="section-title">Elenco Principal ({movie.cast.length})</h2>
            </div>
          </div>
          <div className="cast-grid">
            {movie.cast.map((actor, idx) => (
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
        </section>
      )}

      {/* SEÇÃO DE CRÍTICAS */}
      <section
        className="section"
        style={{ paddingTop: trailerKey || (movie.cast && movie.cast.length > 0) ? '30px' : '50px' }}
      >
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
          <div
            style={{
              padding: '60px 40px',
              textAlign: 'center',
              background: '#0a0c11',
              border: '1px solid var(--gray-700)',
            }}
          >
            <h3
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '1.25rem',
                color: '#fff',
                marginBottom: '8px',
              }}
            >
              {unreleased ? 'Título aguardando lançamento' : 'Nenhuma avaliação para este título ainda'}
            </h3>
            <p
              style={{
                color: 'var(--gray-400)',
                fontSize: '0.88rem',
                marginBottom: unreleased ? '0' : '20px',
              }}
            >
              {unreleased
                ? `As avaliações serão liberadas a partir de ${formatReleaseDate(movie.release_date)}.`
                : 'Seja o primeiro a compartilhar sua opinião com a comunidade!'}
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
