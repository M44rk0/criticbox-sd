import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Search,
  X,
  Star,
  Film,
  User,
  Users,
  PlayCircle,
  MessageSquare,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Check,
  LogIn,
  LogOut,
  UserPlus,
  Plus,
  Rocket,
  Zap,
  Skull,
  Heart,
  Laugh,
  Eye,
  EyeOff,
  Clock,
  Tv,
} from 'lucide-react';

const API_BASE = '';

const CACHE_KEY_TRENDING = 'criticbox_cache_trending_v3';
const CACHE_KEY_REVIEWS = 'criticbox_cache_reviews_v3';
const CACHE_KEY_NOW_PLAYING = 'criticbox_cache_now_playing_v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos
const SERIES_EPISODES_CACHE = {};

const formatReviewDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const cleanStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) {
      const parts = dateStr.split(/[- :T]/);
      if (parts.length >= 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const fallbackDate = new Date(year, month, day);
        return fallbackDate.toLocaleDateString('pt-BR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }
      return dateStr;
    }
    return d.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch (e) {
    return dateStr;
  }
};

const formatReleaseDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

const isUnreleased = (releaseDate) => {
  if (!releaseDate) return false;
  const today = new Date().toISOString().split('T')[0];
  return releaseDate > today;
};

function ReviewComment({ comment, containsSpoilers }) {
  const [revealed, setRevealed] = useState(false);
  if (!comment) return null;
  if (!containsSpoilers) {
    return <p className="review-card-text">{comment}</p>;
  }
  return (
    <div className="spoiler-wrap">
      <p
        className={`review-card-text ${!revealed ? 'spoiler-blurred' : ''}`}
        onClick={() => !revealed && setRevealed(true)}
        style={!revealed ? { cursor: 'pointer' } : undefined}
      >
        {comment}
      </p>
      {!revealed ? (
        <button
          type="button"
          className="spoiler-toggle"
          onClick={() => setRevealed(true)}
          title="Revelar crítica com spoiler"
        >
          <Eye size={12} />
          <span>Contém spoiler — clique para ver</span>
        </button>
      ) : (
        <button
          type="button"
          className="spoiler-toggle spoiler-toggle--hide"
          onClick={() => setRevealed(false)}
          title="Ocultar spoiler"
        >
          <EyeOff size={12} />
          <span>Ocultar spoiler</span>
        </button>
      )}
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();

  // Auth State
  const [token, setToken] = useState(() => localStorage.getItem('criticbox_token') || '');
  const [username, setUsername] = useState(() => localStorage.getItem('criticbox_user') || '');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Global revision counter for review additions (syncs homepage immediately)
  const [reviewRevision, setReviewRevision] = useState(0);

  // Review Modal State
  const [reviewModalMovie, setReviewModalMovie] = useState(null);
  const [modalRating, setModalRating] = useState(5.0);
  const [hoverRating, setHoverRating] = useState(null);
  const [modalComment, setModalComment] = useState('');
  const [modalSpoilers, setModalSpoilers] = useState(false);
  const [modalScope, setModalScope] = useState('series'); // 'series' | 'episode'
  const [modalSeason, setModalSeason] = useState(1);
  const [modalEpisode, setModalEpisode] = useState(1);
  const [allSeriesEpisodes, setAllSeriesEpisodes] = useState({});
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [onReviewSuccessCallback, setOnReviewSuccessCallback] = useState(null);

  // Toast State
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, isError = false) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, isError });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3800);
  };

  // Sync Auth with LocalStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem('criticbox_token', token);
    } else {
      localStorage.removeItem('criticbox_token');
    }
    if (username) {
      localStorage.setItem('criticbox_user', username);
    } else {
      localStorage.removeItem('criticbox_user');
    }
  }, [token, username]);

  // Auth Actions
  const openAuth = (mode = 'login') => {
    setAuthMode(mode);
    setAuthError('');
    setAuthUsername('');
    setAuthPassword('');
    setAuthModalOpen(true);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmittingAuth(true);

    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.detail || (data.erros ? data.erros.map((er) => er.mensagem).join(', ') : 'Erro na requisição');
        setAuthError(msg);
        return;
      }

      setToken(data.access_token);
      setUsername(data.username);
      setAuthModalOpen(false);
      showToast(authMode === 'login' ? `Bem-vindo(a), @${data.username}!` : `Conta criada com sucesso! @${data.username}`, false);
    } catch (err) {
      setAuthError('Falha ao conectar com o servidor.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setUsername('');
    showToast('Sessão encerrada com sucesso.', false);
  };

  // Review Actions
  const openReviewModal = (movie, onSuccess = null) => {
    if (!token) {
      showToast('Faça login para avaliar.', true);
      openAuth('login');
      return;
    }
    if (isUnreleased(movie.release_date)) {
      showToast('Este título ainda não estreou e não está disponível para avaliação.', true);
      return;
    }
    setReviewModalMovie(movie);
    setModalRating(5.0);
    setHoverRating(null);
    setModalComment('');
    setModalSpoilers(false);
    setModalScope('series');
    setModalSeason(1);
    setModalEpisode(1);
    if (movie.media_type === 'tv' && SERIES_EPISODES_CACHE[movie.tmdb_id]) {
      setAllSeriesEpisodes(SERIES_EPISODES_CACHE[movie.tmdb_id]);
    } else {
      setAllSeriesEpisodes({});
    }
    setOnReviewSuccessCallback(() => onSuccess);
  };

  // Pull all episodes of all seasons in one single request for the series
  useEffect(() => {
    if (!reviewModalMovie || reviewModalMovie.media_type !== 'tv') {
      setAllSeriesEpisodes({});
      return;
    }

    const mid = reviewModalMovie.tmdb_id;

    if (SERIES_EPISODES_CACHE[mid]) {
      setAllSeriesEpisodes(SERIES_EPISODES_CACHE[mid]);
      return;
    }

    let isCancelled = false;

    // Fetch all episodes in one request
    fetch(`${API_BASE}/movies/${mid}/episodes`)
      .then((res) => {
        if (!res.ok) throw new Error('Falha ao carregar episódios');
        return res.json();
      })
      .then((data) => {
        if (isCancelled) return;
        SERIES_EPISODES_CACHE[mid] = data || {};
        setAllSeriesEpisodes(data || {});
      })
      .catch((err) => {
        console.warn('Erro ao carregar episódios da série:', err);
      });

    // Se a lista de temporadas não veio, busca os detalhes da série
    if (!reviewModalMovie.seasons || reviewModalMovie.seasons.length === 0) {
      fetch(`${API_BASE}/movies/${mid}?type=tv`)
        .then((res) => res.json())
        .then((data) => {
          if (!isCancelled && data && data.seasons) {
            setReviewModalMovie((prev) => (prev ? { ...prev, seasons: data.seasons } : null));
          }
        })
        .catch((e) => console.warn('Erro ao carregar detalhes da série:', e));
    }

    return () => {
      isCancelled = true;
    };
  }, [reviewModalMovie?.tmdb_id, reviewModalMovie?.media_type]);

  const submitReview = async () => {
    if (!token) {
      showToast('Faça login para avaliar.', true);
      openAuth('login');
      return;
    }

    if (!reviewModalMovie) return;

    setIsSubmittingReview(true);
    try {
      const isTv = reviewModalMovie.media_type === 'tv';
      const isEpScope = isTv && modalScope === 'episode';
      const payload = {
        tmdb_id: reviewModalMovie.tmdb_id,
        media_type: reviewModalMovie.media_type || 'movie',
        rating: modalRating,
        comment: modalComment.trim(),
        contains_spoilers: modalSpoilers,
        season_number: isEpScope ? parseInt(modalSeason, 10) : null,
        episode_number: isEpScope ? parseInt(modalEpisode, 10) : null,
      };

      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 401) {
        setToken('');
        setUsername('');
        showToast('Sessão expirada. Faça login novamente.', true);
        openAuth('login');
        return;
      }

      if (!res.ok) {
        const msg = data.detail || (data.erros ? data.erros.map((er) => er.mensagem).join(', ') : 'Erro ao salvar avaliação.');
        showToast(`Erro: ${msg}`, true);
        return;
      }

      // Invalidate reviews & trending cache on new review
      try {
        sessionStorage.removeItem(CACHE_KEY_REVIEWS);
        sessionStorage.removeItem(CACHE_KEY_TRENDING);
      } catch (e) {}

      // Trigger immediate update across components
      setReviewRevision((prev) => prev + 1);

      const currentSeasonEps = allSeriesEpisodes[modalSeason] || allSeriesEpisodes[String(modalSeason)] || [];
      const selectedEp = isEpScope ? currentSeasonEps.find((e) => e.episode_number === parseInt(modalEpisode, 10)) : null;
      const epNamePart = selectedEp?.name ? ` - "${selectedEp.name}"` : '';
      const scopeInfo = isEpScope ? ` (T${modalSeason}E${modalEpisode}${epNamePart})` : '';
      showToast(`[${reviewModalMovie.title}${scopeInfo}] Crítica publicada com nota ${modalRating.toFixed(1)}!`, false);
      setReviewModalMovie(null);
      if (onReviewSuccessCallback) {
        onReviewSuccessCallback();
      }
    } catch (err) {
      showToast('Erro ao publicar avaliação.', true);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const displayedRating = hoverRating !== null ? hoverRating : modalRating;

  return (
    <>
      {/* Hidden SVG for half-star gradient */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        <defs>
          <linearGradient id="halfGrad">
            <stop offset="50%" stopColor="#ff9900" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.15)" />
          </linearGradient>
        </defs>
      </svg>

      {/* NAVBAR */}
      <Navbar
        token={token}
        username={username}
        onOpenAuth={openAuth}
        onLogout={handleLogout}
      />

      {/* ROUTES */}
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              token={token}
              onOpenAuth={openAuth}
              onOpenReview={openReviewModal}
              reviewRevision={reviewRevision}
            />
          }
        />
        <Route
          path="/search"
          element={
            <SearchPage
              onOpenReview={openReviewModal}
            />
          }
        />
        <Route
          path="/movie/:id"
          element={
            <MovieDetailPage
              token={token}
              username={username}
              onOpenAuth={openAuth}
              onOpenReview={openReviewModal}
            />
          }
        />
      </Routes>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-logo">CRITICBOX</span>
            <span className="footer-copy">© 2026 Criticbox — Sua caixa de críticas e catálogo de cinema.</span>
          </div>
          <ul className="footer-links">
            <li>
              <Link to="/">Início</Link>
            </li>
            <li>
              <Link to="/search">Buscar Títulos</Link>
            </li>
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                Voltar ao Topo
              </a>
            </li>
          </ul>
          <span className="footer-tech">built for movie & series lovers</span>
        </div>
      </footer>

      {/* REVIEW MODAL */}
      {reviewModalMovie && (
        <div
          className="review-modal-overlay active"
          onClick={(e) => {
            if (e.target.classList.contains('review-modal-overlay')) setReviewModalMovie(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="v1-card" onClick={(e) => e.stopPropagation()}>
            <div className="v1-poster-col">
              <img
                src={reviewModalMovie.poster_url || 'https://via.placeholder.com/500x750?text=Sem+Poster'}
                alt={reviewModalMovie.title}
              />
              <div className="v1-poster-overlay"></div>
              <div className="v1-poster-info">
                <span className="v1-poster-chip">
                  {reviewModalMovie.release_date ? reviewModalMovie.release_date.substring(0, 4) : ''}
                </span>
                <h2 className="v1-poster-title">{reviewModalMovie.title}</h2>
              </div>
            </div>
            <div className="v1-content-col">
              <div>
                <div className="v1-header-bar">
                  <div className="v1-meta-row">
                    <span className="v1-chip-lancamento">
                      {reviewModalMovie.media_type === 'tv' ? 'AVALIAÇÃO DE SÉRIE' : 'NOVA CRÍTICA'}
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
                  <button className="v1-close-btn" onClick={() => setReviewModalMovie(null)} aria-label="Fechar" title="Fechar">
                    <X size={16} />
                  </button>
                </div>
                <h1 className="v1-movie-title">{reviewModalMovie.title}</h1>
                <p className="v1-movie-synopsis">{reviewModalMovie.overview || 'Sem sinopse disponível.'}</p>
              </div>

              {/* SELETOR DE ESCOPO PARA SÉRIES */}
              {reviewModalMovie.media_type === 'tv' && (
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
                            {(reviewModalMovie.seasons && reviewModalMovie.seasons.length > 0
                              ? reviewModalMovie.seasons.filter((s) => s.season_number > 0)
                              : Array.from({ length: reviewModalMovie.number_of_seasons || 1 }, (_, i) => ({
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
                              const currentSeasonEps = allSeriesEpisodes[modalSeason] || allSeriesEpisodes[String(modalSeason)] || [];
                              if (currentSeasonEps.length > 0) {
                                return currentSeasonEps.map((ep) => (
                                  <option key={ep.episode_number} value={ep.episode_number}>
                                    Ep. {ep.episode_number} — {ep.name || `Episódio ${ep.episode_number}`}
                                  </option>
                                ));
                              }
                              const currSeason = reviewModalMovie.seasons?.find(
                                (s) => s.season_number === modalSeason
                              );
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
                <button className="v1-submit-btn" disabled={isSubmittingReview} onClick={submitReview}>
                  {isSubmittingReview ? 'PUBLICANDO...' : 'PUBLICAR AVALIAÇÃO'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUTH MODAL */}
      {authModalOpen && (
        <div
          className="auth-modal-overlay active"
          onClick={(e) => {
            if (e.target.classList.contains('auth-modal-overlay')) setAuthModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="auth-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span className="nav-logo" style={{ fontSize: '1rem' }}>
                CRITICBOX // CONTA
              </span>
              <button className="v1-close-btn" onClick={() => setAuthModalOpen(false)} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
              >
                Entrar
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
              >
                Criar Conta
              </button>
            </div>
            {authError && <div className="auth-error">{authError}</div>}
            <form onSubmit={handleAuthSubmit}>
              <div className="auth-input-group">
                <label htmlFor="auth-username">Nome de Usuário</label>
                <input
                  type="text"
                  id="auth-username"
                  required
                  placeholder="ex: cinemanerd"
                  autoComplete="username"
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                />
              </div>
              <div className="auth-input-group">
                <label htmlFor="auth-password">Senha</label>
                <input
                  type="password"
                  id="auth-password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="current-password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="v1-submit-btn"
                style={{ width: '100%', marginTop: '10px' }}
                disabled={isSubmittingAuth}
              >
                {isSubmittingAuth
                  ? 'PROCESSANDO...'
                  : authMode === 'login'
                  ? 'ENTRAR NA CONTA'
                  : 'CRIAR CONTA'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div
          className="toast-box show"
          style={{
            borderColor: toast.isError ? '#ff5555' : 'var(--accent)',
            boxShadow: toast.isError ? '4px 4px 0px 0px #ff5555' : '4px 4px 0px 0px var(--accent)',
          }}
        >
          {toast.isError ? (
            <AlertCircle size={18} color="#ff5555" style={{ flexShrink: 0 }} />
          ) : (
            <CheckCircle2 size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </>
  );
}

// ----------------- NAVBAR ----------------- //
function Navbar({ token, username, onOpenAuth, onLogout }) {
  const navigate = useNavigate();
  const [navSearch, setNavSearch] = useState('');

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && navSearch.trim()) {
      navigate(`/search?q=${encodeURIComponent(navSearch.trim())}`);
      setNavSearch('');
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-left">
        <span className="nav-logo" onClick={() => navigate('/')}>
          CRITICBOX
        </span>
        <ul className="nav-links">
          <li>
            <Link to="/" className="nav-link">
              INÍCIO
            </Link>
          </li>
          <li>
            <Link to="/search" className="nav-link">
              BUSCAR
            </Link>
          </li>
        </ul>
      </div>
      <div className="nav-right">
        <div className="nav-search">
          <span className="nav-search-icon" style={{ display: 'flex', alignItems: 'center' }}>
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Buscar filmes (Pressione Enter)..."
            value={navSearch}
            onChange={(e) => setNavSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        {!token ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="nav-btn nav-btn-ghost" onClick={() => onOpenAuth('login')}>
              <LogIn size={13} style={{ marginRight: '6px' }} />
              ENTRAR
            </button>
            <button className="nav-btn nav-btn-accent" onClick={() => onOpenAuth('register')}>
              <UserPlus size={13} style={{ marginRight: '6px' }} />
              CRIAR CONTA
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--accent)',
                border: '1px solid var(--accent-border)',
                padding: '5px 12px',
                background: 'var(--accent-dim)',
              }}
            >
              <User size={13} />
              @{username}
            </span>
            <button className="nav-btn nav-btn-ghost" onClick={onLogout}>
              <LogOut size={13} style={{ marginRight: '6px' }} />
              SAIR
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

// ----------------- PAGE: HOME ----------------- //
function HomePage({ token, onOpenAuth, reviewRevision = 0 }) {
  const navigate = useNavigate();
  const [trendingMovies, setTrendingMovies] = useState([]);
  const [heroMovie, setHeroMovie] = useState(null);
  const [recentReviews, setRecentReviews] = useState([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const REVIEWS_PER_PAGE = 10;
  const [posters, setPosters] = useState({});
  const [isLoadingTrending, setIsLoadingTrending] = useState(true);
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

      // Safeguard: ensure pagination buttons remain visible in viewport
      const finalRect = reviewsPaginationRef.current.getBoundingClientRect();
      if (finalRect.top < 60 || finalRect.bottom > window.innerHeight) {
        reviewsPaginationRef.current.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    }
  }, [currentReviewsPage]);

  useEffect(() => {
    setReviewsPage(1);
    // 1. Caching para destaques da semana
    let hasValidTrendingCache = false;
    let hasValidReviewsCache = false;

    // Se reviewRevision for 0 (carregamento comum), checa o cache
    // Se reviewRevision > 0 (uma review acabou de ser criada), busca dados frescos diretamente!
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
        const res = await fetch(`${API_BASE}/movies/trending`);
        if (!res.ok) throw new Error('Erro ao carregar trending');
        const data = await res.json();
        const list = data.movies || [];
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
        console.error(err);
      } finally {
        setIsLoadingTrending(false);
      }
    };

    // 2. Caching para avaliações recentes (busca até 100 para paginação)
    const fetchReviews = async () => {
      try {
        const res = await fetch(`${API_BASE}/reviews?limit=100`);
        if (!res.ok) throw new Error('Erro ao carregar reviews');
        const data = await res.json();
        const list = data || [];
        setRecentReviews(list);

        const fetchedPosters = {};
        const uniqueIds = [...new Set(list.map((r) => r.tmdb_id))].filter(Boolean);
        await Promise.all(
          uniqueIds.map(async (mid) => {
            try {
              const mRes = await fetch(`${API_BASE}/movies/${mid}`);
              if (mRes.ok) {
                const mData = await mRes.json();
                if (mData.poster_url) {
                  fetchedPosters[mid] = mData.poster_url;
                }
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
        console.error(err);
      } finally {
        setIsLoadingReviews(false);
      }
    };

    if (!hasValidTrendingCache) fetchTrending();
    if (!hasValidReviewsCache) fetchReviews();
  }, [reviewRevision]);

  const [nowPlayingMovies, setNowPlayingMovies] = useState([]);
  const [isLoadingNowPlaying, setIsLoadingNowPlaying] = useState(true);

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
        const res = await fetch(`${API_BASE}/movies/now-playing`);
        if (!res.ok) throw new Error('Erro ao carregar filmes em cartaz');
        const data = await res.json();
        const list = (data.movies || []).filter((m) => m.poster_url);
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
        console.error(err);
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
              src={heroMovie.backdrop_url || heroMovie.poster_url || 'https://image.tmdb.org/t/p/w1280/qeQJx07rK2xm8SD2sJxFKhE7gs0.jpg'}
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
                  <span className="hero-stat-value">{heroMovie.tmdb_vote_average.toFixed(1)}</span>
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
                    {m.release_date ? m.release_date.substring(0, 4) : '2026'} • Criticbox: {m.criticbox_rating > 0 ? `${m.criticbox_rating.toFixed(1)}/5.0` : 'Sem notas'}
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
                  <span className="media-type-chip">
                    CINEMA
                  </span>
                  <span className="movie-card-score">
                    <Star size={11} fill="currentColor" stroke="none" />
                    {m.tmdb_vote_average ? m.tmdb_vote_average.toFixed(1) : '-'}
                  </span>
                </div>
                <div className="movie-card-info">
                  <span className="movie-card-title">{m.title}</span>
                  <span className="movie-card-meta">
                    {m.release_date ? m.release_date.substring(0, 4) : '2026'} • Criticbox: {m.criticbox_rating > 0 ? `${m.criticbox_rating.toFixed(1)}/5.0` : 'Sem notas'}
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
                            T{r.season_number < 10 ? `0${r.season_number}` : r.season_number}E{r.episode_number < 10 ? `0${r.episode_number}` : r.episode_number}
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
      {!token && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="cta-banner">
            <div className="cta-text">
              <h2>COMECE A CRITICAR AGORA.</h2>
              <p>Crie sua conta e compartilhe suas opiniões sobre os filmes que você assistiu.</p>
            </div>
            <button className="cta-btn" onClick={() => onOpenAuth('register')}>
              CRIAR CONTA GRÁTIS
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}
    </>
  );
}

// ----------------- PAGE: SEARCH ----------------- //
function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const genreId = searchParams.get('genre_id') || '';
  const genreName = searchParams.get('genre_name') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [results, setResults] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCatalog = async (q, gid, page) => {
    setLoading(true);
    try {
      let endpoint = '';
      if (gid) {
        endpoint = `${API_BASE}/movies/discover?genre_id=${encodeURIComponent(gid)}&page=${page}`;
      } else if (q.trim()) {
        endpoint = `${API_BASE}/movies?query=${encodeURIComponent(q.trim())}&page=${page}`;
      } else {
        setResults([]);
        setTotalPages(1);
        setTotalResults(0);
        setLoading(false);
        return;
      }

      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Erro na busca');
      const data = await res.json();
      // Exclui títulos sem poster
      const list = (data.movies || []).filter((m) => m.poster_url && !m.poster_url.includes('placeholder'));
      setResults(list);
      setTotalPages(data.total_pages || 1);
      setTotalResults(data.total_results || 0);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchTerm(queryParam);
    if (genreId || queryParam) {
      fetchCatalog(queryParam, genreId, pageParam);
    }
  }, [queryParam, genreId, pageParam]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setSearchParams({ q: searchTerm.trim(), page: 1 });
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSearchParams({});
    setResults([]);
    setTotalPages(1);
    setTotalResults(0);
  };

  const goToPage = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    if (genreId) {
      setSearchParams({ genre_id: genreId, genre_name: genreName, page: newPage });
    } else {
      setSearchParams({ q: queryParam, page: newPage });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activeTitle = genreId ? `Explorar Gênero: ${genreName}` : 'Busca de Títulos (Filmes, Séries & Animes)';

  return (
    <div className="search-page-container">
      <div className="search-page-header">
        <div className="section-title-group">
          <span className="section-num">
            <Search size={18} />
          </span>
          <h1 className="section-title">{activeTitle}</h1>
          {genreId && (
            <span className="active-genre-tag" onClick={clearFilters} title="Remover filtro de gênero">
              {genreName}
              <X size={12} />
            </span>
          )}
        </div>
        <form onSubmit={handleSubmit} className="search-input-big-wrap">
          <Search size={18} color="var(--gray-500)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            className="search-input-big"
            placeholder="Digite o título de filme, série ou anime e pressione Enter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {(searchTerm || genreId) && (
            <button
              type="button"
              className="v1-close-btn"
              onClick={clearFilters}
              aria-label="Limpar busca"
            >
              <X size={15} />
            </button>
          )}
        </form>
        {queryParam && (
          <p style={{ marginTop: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--gray-400)' }}>
            Exibindo resultados para: <strong style={{ color: 'var(--accent)' }}>"{queryParam}"</strong> • {totalResults} títulos encontrados (Página {pageParam} de {totalPages})
          </p>
        )}
        {genreId && !queryParam && (
          <p style={{ marginTop: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--gray-400)' }}>
            Explorando gênero <strong style={{ color: 'var(--accent)' }}>"{genreName}"</strong> • Página {pageParam} de {totalPages}
          </p>
        )}
      </div>

      <div className="section">
        {loading ? (
          <div className="loading-pulse">Buscando títulos no catálogo...</div>
        ) : (queryParam || genreId) && results.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', background: '#0a0c11', border: '1px solid var(--gray-700)' }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.3rem', color: '#fff', marginBottom: '8px' }}>
              Nenhum título encontrado
            </h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.88rem' }}>
              Tente buscar por termos mais genéricos ou selecione outro gênero.
            </p>
          </div>
        ) : (
          <>
            <div className="movies-grid">
              {results.map((m, idx) => (
                <div
                  key={m.tmdb_id}
                  className="movie-card"
                  onClick={() => navigate(`/movie/${m.tmdb_id}?type=${m.media_type || 'movie'}`)}
                  title={`Ver detalhes de ${m.title}`}
                >
                  <div className="movie-card-poster">
                    <img src={m.poster_url} alt={m.title} loading="lazy" />
                    <span className="movie-card-rank">#{(pageParam - 1) * 20 + idx + 1}</span>
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
                      {m.release_date ? m.release_date.substring(0, 4) : '2026'} • Criticbox: {m.criticbox_rating > 0 ? `${m.criticbox_rating.toFixed(1)}/5.0` : 'Sem notas'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* BARRA DE PAGINAÇÃO */}
            {totalPages > 1 && (
              <div className="pagination-bar">
                <button
                  className="pagination-btn"
                  disabled={pageParam <= 1 || loading}
                  onClick={() => goToPage(pageParam - 1)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ChevronLeft size={15} />
                  Anterior
                </button>
                <span className="pagination-info">
                  Página <strong>{pageParam}</strong> de <strong>{totalPages}</strong>
                </span>
                <button
                  className="pagination-btn"
                  disabled={pageParam >= totalPages || loading}
                  onClick={() => goToPage(pageParam + 1)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  Próxima
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ----------------- PAGE: MOVIE DETAIL ----------------- //
function MovieDetailPage({ token, username, onOpenAuth, onOpenReview }) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const mediaType = searchParams.get('type') || '';
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [movieRes, reviewsRes] = await Promise.all([
        fetch(`${API_BASE}/movies/${id}${mediaType ? `?type=${mediaType}` : ''}`),
        fetch(`${API_BASE}/reviews/movie/${id}`),
      ]);

      if (!movieRes.ok) throw new Error('Título não encontrado.');

      const movieData = await movieRes.json();
      setMovie(movieData);

      if (movieData.media_type === 'tv' && !SERIES_EPISODES_CACHE[id]) {
        fetch(`${API_BASE}/movies/${id}/episodes`)
          .then((res) => (res.ok ? res.json() : null))
          .then((epData) => {
            if (epData) SERIES_EPISODES_CACHE[id] = epData;
          })
          .catch(() => {});
      }

      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json();
        setReviews(reviewsData || []);
      }
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

  const renderReviewCard = (r) => (
    <div key={r.review_id} className="review-card">
      <div className="review-card-body">
        <div className="review-card-header">
          <div className="movie-review-author-info">
            <span className="review-card-avatar">{(r.user_id || 'U')[0].toUpperCase()}</span>
            <span className="review-card-username">@{r.user_id}</span>
            {r.season_number && r.episode_number ? (
              <span className="review-scope-chip">
                T{r.season_number < 10 ? `0${r.season_number}` : r.season_number}E{r.episode_number < 10 ? `0${r.episode_number}` : r.episode_number}
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

  const runtimeHours = movie.runtime ? Math.floor(movie.runtime / 60) : 0;
  const runtimeMins = movie.runtime ? movie.runtime % 60 : 0;
  const runtimeStr = movie.runtime ? `${runtimeHours > 0 ? `${runtimeHours}H ` : ''}${runtimeMins}MIN` : '';

  const getYouTubeKey = (url) => {
    if (!url) return null;
    const match = url.match(/(?:watch\?v=|embed\/|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };
  const trailerKey = getYouTubeKey(movie.trailer_url);

  return (
    <div>
      {/* HERO BANNER DO TÍTULO */}
      <section className="movie-detail-hero">
        <div className="movie-detail-bg">
          <img
            src={movie.backdrop_url || movie.poster_url || 'https://image.tmdb.org/t/p/w1280/qeQJx07rK2xm8SD2sJxFKhE7gs0.jpg'}
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
                onClick={() => onOpenReview(movie, loadData)}
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

            {movie.tagline && (
              <p className="movie-detail-tagline">"{movie.tagline}"</p>
            )}

            <div className="movie-detail-meta">
              <span>{movie.release_date ? movie.release_date.substring(0, 4) : '2026'}</span>
              {movie.media_type === 'tv' && movie.number_of_seasons ? (
                <span>• {movie.number_of_seasons} Temporada{movie.number_of_seasons > 1 ? 's' : ''} ({movie.number_of_episodes || 0} eps)</span>
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
                <span className="movie-detail-rating-num">{movie.tmdb_vote_average ? movie.tmdb_vote_average.toFixed(1) : '-'}</span>
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
            <a
              href={movie.trailer_url}
              target="_blank"
              rel="noreferrer"
              className="section-link"
            >
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
        <section className="section" style={{ paddingTop: trailerKey ? '30px' : '50px', paddingBottom: '30px' }}>
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
                  <span className="cast-name" title={actor.name}>{actor.name}</span>
                  <span className="cast-char" title={actor.character}>{actor.character || 'Personagem'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SEÇÃO DE CRÍTICAS */}
      <section className="section" style={{ paddingTop: (trailerKey || (movie.cast && movie.cast.length > 0)) ? '30px' : '50px' }}>
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
            <button className="nav-btn nav-btn-accent" onClick={() => onOpenReview(movie, loadData)}>
              <Plus size={14} style={{ marginRight: '6px' }} />
              ESCREVER CRÍTICA
            </button>
          )}
        </div>

        {reviews.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', background: '#0a0c11', border: '1px solid var(--gray-700)' }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.25rem', color: '#fff', marginBottom: '8px' }}>
              {unreleased ? 'Título aguardando lançamento' : 'Nenhuma avaliação para este título ainda'}
            </h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.88rem', marginBottom: unreleased ? '0' : '20px' }}>
              {unreleased
                ? `As avaliações serão liberadas a partir de ${formatReleaseDate(movie.release_date)}.`
                : 'Seja o primeiro a compartilhar sua opinião com a comunidade!'}
            </p>
            {!unreleased && (
              <button className="nav-btn nav-btn-accent" onClick={() => onOpenReview(movie, loadData)}>
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
