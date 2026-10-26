import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Inbox,
  LogIn,
  UserPlus,
  Compass,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useReviewModal } from '../context/ReviewModalContext';
import { getMyReviews } from '../api/reviews';
import { getMovieDetails } from '../api/movies';
import { getClientToken } from '../api/client';
import { isAnime, isEpisodic } from '../utils/media';
import ReviewCard from '../components/ReviewCard';

export default function MyBoxPage() {
  const navigate = useNavigate();
  const { isLoggedIn, username, token, openAuth } = useAuth();
  const { reviewRevision } = useReviewModal();

  const [reviews, setReviews] = useState([]);
  const [posters, setPosters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'movie' | 'tv' | 'anime'
  const [searchQuery, setSearchQuery] = useState('');

  const loadMyReviews = async () => {
    const activeToken = token || getClientToken();
    console.log('[Criticbox:MyBox] Verificando sessão para carregar críticas:', {
      isLoggedIn,
      hasContextToken: Boolean(token),
      hasClientToken: Boolean(getClientToken()),
      username,
    });

    if (!isLoggedIn && !activeToken) {
      console.log('[Criticbox:MyBox] Usuário não logado. Abortando busca de críticas.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      console.log('[Criticbox:MyBox] Disparando GET /reviews/me...');
      const data = await getMyReviews();
      const list = Array.isArray(data) ? data : [];
      console.log(`[Criticbox:MyBox] ${list.length} críticas recebidas com sucesso.`);
      setReviews(list);

      // Coleta pôsteres existentes
      const initialPosters = {};
      const missingPosters = [];

      list.forEach((r) => {
        if (r.poster_url) {
          initialPosters[`${r.tmdb_id}_${r.media_type || 'movie'}`] = r.poster_url;
          initialPosters[r.tmdb_id] = r.poster_url;
        } else {
          missingPosters.push({ id: r.tmdb_id, type: r.media_type || 'movie' });
        }
      });
      setPosters(initialPosters);

      // Backfill assíncrono enxuto apenas se houver reviews sem pôster persistido
      if (missingPosters.length > 0) {
        const unique = Array.from(
          new Map(missingPosters.map((item) => [`${item.id}_${item.type}`, item])).values()
        );
        Promise.all(
          unique.slice(0, 5).map(async ({ id, type }) => {
            try {
              const details = await getMovieDetails(id, type);
              if (details?.poster_url) {
                setPosters((prev) => ({
                  ...prev,
                  [`${id}_${type}`]: details.poster_url,
                  [id]: details.poster_url,
                }));
              }
            } catch (e) {}
          })
        );
      }
    } catch (err) {
      setError(err.message || 'Erro ao carregar sua caixa de críticas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyReviews();
  }, [isLoggedIn, token, username, reviewRevision]);

  const handleDeleteReview = (deletedId) => {
    setReviews((prev) => prev.filter((r) => r.review_id !== deletedId));
  };

  // Estatísticas do Usuário
  const stats = useMemo(() => {
    const total = reviews.length;
    if (total === 0) {
      return { total: 0, avg: '—', moviesCount: 0, tvCount: 0, animeCount: 0 };
    }
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    const avg = (sum / total).toFixed(1);

    let animeCount = 0;
    let tvCount = 0;
    let moviesCount = 0;

    reviews.forEach((r) => {
      if (isAnime(r)) {
        animeCount++;
      } else if (isEpisodic(r)) {
        tvCount++;
      } else {
        moviesCount++;
      }
    });

    return { total, avg, moviesCount, tvCount, animeCount };
  }, [reviews]);

  // Filtragem
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      const isAnimeItem = isAnime(r);
      const isEpisodicItem = isEpisodic(r);

      // Filtro de aba
      if (activeTab === 'movie' && (isAnimeItem || isEpisodicItem)) return false;
      if (activeTab === 'tv' && (isAnimeItem || !isEpisodicItem)) return false;
      if (activeTab === 'anime' && !isAnimeItem) return false;

      // Filtro de busca textual
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = (r.movie_title || '').toLowerCase().includes(query);
        const commentMatch = (r.comment || '').toLowerCase().includes(query);
        const idMatch = String(r.tmdb_id).includes(query);
        return titleMatch || commentMatch || idMatch;
      }
      return true;
    });
  }, [reviews, activeTab, searchQuery]);

  return (
    <div className="my-box-page">
      {/* CABEÇALHO DA MINHA CAIXA */}
      <header className="my-box-header">
        <div className="my-box-header-main">
          <h1 className="my-box-title">MINHA CAIXA</h1>
          <p className="my-box-subtitle">Seu arquivo pessoal de avaliações e impressões críticas.</p>
        </div>

        {/* LEDGER ARQUITETURAL COMPACTO */}
        {isLoggedIn && reviews.length > 0 && (
          <div className="my-box-ledger">
            <div className="my-box-ledger-cell">
              <span className="my-box-ledger-val accent">{stats.total}</span>
              <span className="my-box-ledger-lbl">Críticas</span>
            </div>
            <div className="my-box-ledger-cell">
              <span className="my-box-ledger-val">
                <span className="my-box-star">★</span> {stats.avg}
              </span>
              <span className="my-box-ledger-lbl">Média</span>
            </div>
            <div className="my-box-ledger-cell">
              <span className="my-box-ledger-val">{stats.moviesCount}</span>
              <span className="my-box-ledger-lbl">Filmes</span>
            </div>
            <div className="my-box-ledger-cell">
              <span className="my-box-ledger-val">{stats.tvCount}</span>
              <span className="my-box-ledger-lbl">Séries</span>
            </div>
            {stats.animeCount > 0 && (
              <div className="my-box-ledger-cell">
                <span className="my-box-ledger-val">{stats.animeCount}</span>
                <span className="my-box-ledger-lbl">Animes</span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* CASO: USUÁRIO NÃO ESTÁ LOGADO */}
      {!isLoggedIn ? (
        <div className="my-box-empty-card">
          <div className="my-box-empty-icon">
            <LogIn size={20} />
          </div>
          <h2 className="my-box-empty-title">IDENTIFICAÇÃO NECESSÁRIA</h2>
          <p className="my-box-empty-desc">
            Entre na sua conta para acessar seu arquivo pessoal de críticas e gerenciar suas avaliações.
          </p>
          <div className="my-box-auth-buttons">
            <button className="nav-btn nav-btn-accent" onClick={() => openAuth('login')}>
              <LogIn size={13} style={{ marginRight: '6px' }} />
              ENTRAR NA CONTA
            </button>
            <button className="nav-btn nav-btn-ghost" onClick={() => openAuth('register')}>
              <UserPlus size={13} style={{ marginRight: '6px' }} />
              CRIAR CONTA
            </button>
          </div>
        </div>
      ) : loading ? (
        /* LOADING */
        <div className="my-box-loading">
          <span className="my-box-loading-indicator" />
          <span>Acessando seu arquivo de críticas...</span>
        </div>
      ) : error ? (
        /* ERRO */
        <div className="my-box-empty-card">
          <h2 className="my-box-empty-title" style={{ color: '#ef4444' }}>
            FALHA NA CONSULTA
          </h2>
          <p className="my-box-empty-desc">{error}</p>
          <button className="nav-btn nav-btn-accent" onClick={loadMyReviews}>
            TENTAR NOVAMENTE
          </button>
        </div>
      ) : reviews.length === 0 ? (
        /* CAIXA VAZIA */
        <div className="my-box-empty-card">
          <div className="my-box-empty-icon">
            <Inbox size={22} />
          </div>
          <h2 className="my-box-empty-title">SUA CAIXA ESTÁ VAZIA</h2>
          <p className="my-box-empty-desc">
            Você ainda não registrou nenhuma avaliação. Explore o catálogo para registrar suas notas e comentários.
          </p>
          <button className="nav-btn nav-btn-accent" onClick={() => navigate('/search?filter=trending')}>
            <Compass size={14} style={{ marginRight: '8px' }} />
            EXPLORAR CATÁLOGO EM ALTA
          </button>
        </div>
      ) : (
        /* COM AVALIAÇÕES: BARRA DE FERRAMENTAS + GRID */
        <>
          <div className="my-box-toolbar">
            <div className="my-box-segmented-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'all'}
                className={`my-box-seg-btn ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                <span>Todas</span>
                <span className="my-box-tab-count">{reviews.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'movie'}
                className={`my-box-seg-btn ${activeTab === 'movie' ? 'active' : ''}`}
                onClick={() => setActiveTab('movie')}
              >
                <span>Filmes</span>
                <span className="my-box-tab-count">{stats.moviesCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'tv'}
                className={`my-box-seg-btn ${activeTab === 'tv' ? 'active' : ''}`}
                onClick={() => setActiveTab('tv')}
              >
                <span>Séries</span>
                <span className="my-box-tab-count">{stats.tvCount}</span>
              </button>
              {(stats.animeCount > 0 || activeTab === 'anime') && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'anime'}
                  className={`my-box-seg-btn ${activeTab === 'anime' ? 'active' : ''}`}
                  onClick={() => setActiveTab('anime')}
                >
                  <span>Animes</span>
                  <span className="my-box-tab-count">{stats.animeCount}</span>
                </button>
              )}
            </div>

            <div className="my-box-search-field">
              <Search size={14} className="my-box-search-icon" />
              <input
                type="text"
                className="my-box-search-input"
                placeholder="Filtrar por obra ou texto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="my-box-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Limpar busca"
                  aria-label="Limpar busca"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {filteredReviews.length === 0 ? (
            <div className="my-box-empty-card" style={{ padding: '48px 24px' }}>
              <h3 className="my-box-empty-title" style={{ fontSize: '1.15rem' }}>
                NENHUMA CRÍTICA ENCONTRADA
              </h3>
              <p className="my-box-empty-desc" style={{ marginBottom: '16px' }}>
                Nenhuma avaliação corresponde aos filtros ou ao termo pesquisado.
              </p>
              <button
                className="nav-btn nav-btn-ghost"
                onClick={() => {
                  setActiveTab('all');
                  setSearchQuery('');
                }}
              >
                LIMPAR FILTROS
              </button>
            </div>
          ) : (
            <div className="my-box-reviews-grid">
              {filteredReviews.map((r) => {
                const poster =
                  r.poster_url ||
                  posters[`${r.tmdb_id}_${r.media_type || 'movie'}`] ||
                  posters[r.tmdb_id];

                return (
                  <ReviewCard
                    key={r.review_id}
                    review={r}
                    posterUrl={poster}
                    showPoster={true}
                    onDelete={handleDeleteReview}
                    canDelete={true}
                    variant="editorial"
                    context="my-box"
                    isAnime={isAnime(r)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
