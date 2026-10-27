import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Inbox,
  LogIn,
  UserPlus,
  Compass,
  Eye,
  Heart,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useReviewModal } from '../context/ReviewModalContext';
import { useActivity } from '../context/ActivityContext';
import { getMyReviews } from '../api/reviews';
import { getMyWatched, getMyFavorites } from '../api/activity';
import { getMovieDetails } from '../api/movies';
import { getClientToken } from '../api/client';
import { isAnime } from '../utils/media';
import {
  computeReviewStats,
  computeActivityStats,
  filterActivityItems,
} from '../utils/activityHelpers';
import ReviewCard from '../components/ReviewCard';
import MediaActivityGrid from '../components/MediaActivityGrid';
import MyBoxLedger from '../components/MyBoxLedger';

// Cache em memória de "Minha Caixa" para navegações instantâneas (0ms) na SPA
const globalMyBoxCache = {
  reviews: null,
  watched: null,
  favorites: null,
  posters: {},
  lastLoadedUser: null,
  lastActivityRevision: 0,
  lastReviewRevision: 0,
  timestamp: 0,
};

export default function MyBoxPage() {
  const navigate = useNavigate();
  const { isLoggedIn, username, token, openAuth } = useAuth();
  const { reviewRevision } = useReviewModal();
  const { activityRevision, seedActivityItems } = useActivity();

  // Visão Ativa: 'reviews' | 'watched' | 'favorites'
  const [activeView, setActiveView] = useState('reviews');

  // Limpeza de cache se o usuário autenticado mudou ou deslogou
  if (!isLoggedIn || (username && globalMyBoxCache.lastLoadedUser && globalMyBoxCache.lastLoadedUser !== username)) {
    globalMyBoxCache.reviews = null;
    globalMyBoxCache.watched = null;
    globalMyBoxCache.favorites = null;
    globalMyBoxCache.posters = {};
    globalMyBoxCache.lastLoadedUser = null;
  }

  const hasValidCache =
    Boolean(username) &&
    globalMyBoxCache.lastLoadedUser === username &&
    Array.isArray(globalMyBoxCache.reviews);

  const [reviews, setReviews] = useState(() => (hasValidCache ? globalMyBoxCache.reviews : []));
  const [watchedList, setWatchedList] = useState(() => (hasValidCache ? globalMyBoxCache.watched : []));
  const [favoritesList, setFavoritesList] = useState(() => (hasValidCache ? globalMyBoxCache.favorites : []));
  const [posters, setPosters] = useState(() => (hasValidCache ? globalMyBoxCache.posters : {}));
  const [loading, setLoading] = useState(() => !hasValidCache);
  const [error, setError] = useState('');

  // Flags para controle de quando uma aba precisa de sincronização fresca ao ser aberta
  const watchedDirtyRef = useRef(false);
  const favoritesDirtyRef = useRef(false);
  const reviewsDirtyRef = useRef(false);

  // Filtros internos da visão ativa
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'movie' | 'tv' | 'anime'
  const [searchQuery, setSearchQuery] = useState('');
  const isInitialLoad = useRef(!hasValidCache);

  const loadAllBoxData = async (isSilent = false) => {
    const activeToken = token || getClientToken();
    if (!isLoggedIn && !activeToken) {
      setLoading(false);
      return;
    }

    if (!isSilent && !hasValidCache) {
      setLoading(true);
    }
    setError('');
    try {
      const [reviewsData, watchedData, favoritesData] = await Promise.all([
        getMyReviews().catch(() => []),
        getMyWatched(1, 100).catch(() => []),
        getMyFavorites(1, 100).catch(() => []),
      ]);

      const revList = Array.isArray(reviewsData) ? reviewsData : [];
      const watList = Array.isArray(watchedData) ? watchedData : [];
      const favList = Array.isArray(favoritesData) ? favoritesData : [];

      setReviews(revList);
      setWatchedList(watList);
      setFavoritesList(favList);

      // Semeia o cache global de atividades para consistência imediata
      seedActivityItems(watList, 'watched');
      seedActivityItems(favList, 'favorite');

      // Atualiza o cache global em nível de módulo
      globalMyBoxCache.reviews = revList;
      globalMyBoxCache.watched = watList;
      globalMyBoxCache.favorites = favList;
      globalMyBoxCache.lastLoadedUser = username;
      globalMyBoxCache.lastActivityRevision = activityRevision;
      globalMyBoxCache.lastReviewRevision = reviewRevision;
      globalMyBoxCache.timestamp = Date.now();

      // Coleta e mescla pôsteres preservando os já existentes
      setPosters((prev) => {
        const next = { ...prev, ...(globalMyBoxCache.posters || {}) };
        revList.forEach((r) => {
          if (r.poster_url) {
            next[`${r.tmdb_id}_${r.media_type || 'movie'}`] = r.poster_url;
            next[r.tmdb_id] = r.poster_url;
          }
        });
        watList.forEach((w) => {
          if (w.poster_url) {
            next[`${w.tmdb_id}_${w.media_type || 'movie'}`] = w.poster_url;
            next[w.tmdb_id] = w.poster_url;
          }
        });
        favList.forEach((f) => {
          if (f.poster_url) {
            next[`${f.tmdb_id}_${f.media_type || 'movie'}`] = f.poster_url;
            next[f.tmdb_id] = f.poster_url;
          }
        });
        globalMyBoxCache.posters = next;
        return next;
      });

      // Backfill assíncrono apenas se houver reviews sem pôster
      const missingPosters = [];
      revList.forEach((r) => {
        if (!r.poster_url && !globalMyBoxCache.posters[`${r.tmdb_id}_${r.media_type || 'movie'}`]) {
          missingPosters.push({ id: r.tmdb_id, type: r.media_type || 'movie' });
        }
      });

      if (missingPosters.length > 0) {
        const unique = Array.from(
          new Map(missingPosters.map((item) => [`${item.id}_${item.type}`, item])).values()
        );
        Promise.all(
          unique.slice(0, 5).map(async ({ id, type }) => {
            try {
              const details = await getMovieDetails(id, type);
              if (details?.poster_url) {
                setPosters((prev) => {
                  const updated = {
                    ...prev,
                    [`${id}_${type}`]: details.poster_url,
                    [id]: details.poster_url,
                  };
                  globalMyBoxCache.posters = updated;
                  return updated;
                });
              }
            } catch (e) {}
          })
        );
      }
    } catch (err) {
      if (!isSilent) {
        setError(err.message || 'Erro ao carregar seu arquivo pessoal.');
      }
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  };

  // Carregamento inicial ou ao alternar sessão de usuário
  useEffect(() => {
    const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos
    const isCacheFresh =
      hasValidCache &&
      Date.now() - globalMyBoxCache.timestamp < CACHE_TTL_MS &&
      globalMyBoxCache.lastActivityRevision === activityRevision &&
      globalMyBoxCache.lastReviewRevision === reviewRevision;

    if (isCacheFresh) {
      setLoading(false);
      isInitialLoad.current = false;
      return;
    }

    const isSilent = hasValidCache;
    isInitialLoad.current = true;
    loadAllBoxData(isSilent);
  }, [isLoggedIn, token, username]);

  // Sincronização em segundo plano apenas quando uma crítica é salva ou excluída
  useEffect(() => {
    if (reviewRevision === 0) return;
    if (isInitialLoad.current) return;
    reviewsDirtyRef.current = true;
    if (activeViewRef.current === 'reviews') {
      loadAllBoxData(true);
    }
  }, [reviewRevision]);

  const activeViewRef = useRef(activeView);
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  // Sincronização seletiva em segundo plano quando activityRevision mudar
  useEffect(() => {
    if (activityRevision === 0) return;
    if (isInitialLoad.current) return;

    const currentTab = activeViewRef.current;

    if (currentTab === 'watched') {
      watchedDirtyRef.current = true;
      getMyFavorites(1, 100)
        .then((favData) => {
          if (Array.isArray(favData)) {
            setFavoritesList(favData);
            seedActivityItems(favData, 'favorite');
            globalMyBoxCache.favorites = favData;
          }
        })
        .catch(() => {});
    } else if (currentTab === 'favorites') {
      favoritesDirtyRef.current = true;
      getMyWatched(1, 100)
        .then((watData) => {
          if (Array.isArray(watData)) {
            setWatchedList(watData);
            seedActivityItems(watData, 'watched');
            globalMyBoxCache.watched = watData;
          }
        })
        .catch(() => {});
    } else {
      Promise.all([getMyWatched(1, 100).catch(() => []), getMyFavorites(1, 100).catch(() => [])]).then(
        ([watData, favData]) => {
          if (Array.isArray(watData)) {
            setWatchedList(watData);
            seedActivityItems(watData, 'watched');
            globalMyBoxCache.watched = watData;
          }
          if (Array.isArray(favData)) {
            setFavoritesList(favData);
            seedActivityItems(favData, 'favorite');
            globalMyBoxCache.favorites = favData;
          }
        }
      );
    }
  }, [activityRevision]);

  // Alternância instantânea de abas via cache em memória
  const handleViewChange = (newView) => {
    setActiveView(newView);
    setActiveCategory('all');
    setSearchQuery('');

    if (newView === 'watched' && watchedDirtyRef.current) {
      watchedDirtyRef.current = false;
      getMyWatched(1, 100)
        .then((data) => {
          if (Array.isArray(data)) {
            setWatchedList(data);
            seedActivityItems(data, 'watched');
            globalMyBoxCache.watched = data;
          }
        })
        .catch(() => {});
    } else if (newView === 'favorites' && favoritesDirtyRef.current) {
      favoritesDirtyRef.current = false;
      getMyFavorites(1, 100)
        .then((data) => {
          if (Array.isArray(data)) {
            setFavoritesList(data);
            seedActivityItems(data, 'favorite');
            globalMyBoxCache.favorites = data;
          }
        })
        .catch(() => {});
    } else if (newView === 'reviews' && reviewsDirtyRef.current) {
      reviewsDirtyRef.current = false;
      getMyReviews()
        .then((data) => {
          if (Array.isArray(data)) {
            setReviews(data);
            globalMyBoxCache.reviews = data;
          }
        })
        .catch(() => {});
    }
  };

  const handleDeleteReview = (deletedId) => {
    setReviews((prev) => {
      const next = prev.filter((r) => r.review_id !== deletedId);
      globalMyBoxCache.reviews = next;
      return next;
    });
  };

  // Estatísticas computadas via helpers puros
  const reviewStats = useMemo(() => computeReviewStats(reviews), [reviews]);
  const watchedStats = useMemo(() => computeActivityStats(watchedList), [watchedList]);
  const favoriteStats = useMemo(() => computeActivityStats(favoritesList), [favoritesList]);

  // Filtragem memoizada via predicado puro compartilhado
  const filteredReviews = useMemo(
    () => filterActivityItems(reviews, activeCategory, searchQuery),
    [reviews, activeCategory, searchQuery]
  );
  const filteredWatched = useMemo(
    () => filterActivityItems(watchedList, activeCategory, searchQuery),
    [watchedList, activeCategory, searchQuery]
  );
  const filteredFavorites = useMemo(
    () => filterActivityItems(favoritesList, activeCategory, searchQuery),
    [favoritesList, activeCategory, searchQuery]
  );

  // Metadados da visão ativa para o ledger e contadores das tabs
  const currentCategoryCounts = useMemo(() => {
    const activeStats =
      activeView === 'reviews'
        ? reviewStats
        : activeView === 'watched'
        ? watchedStats
        : favoriteStats;

    return {
      all: activeStats.total,
      movie: activeStats.moviesCount,
      tv: activeStats.tvCount,
      anime: activeStats.animeCount,
    };
  }, [activeView, reviewStats, watchedStats, favoriteStats]);

  const hasAnyActivity = reviews.length > 0 || watchedList.length > 0 || favoritesList.length > 0;

  return (
    <div className="my-box-page">
      {/* CABEÇALHO DA MINHA CAIXA */}
      <header className="my-box-header">
        <div className="my-box-header-main">
          <h1 className="my-box-title">MINHA CAIXA</h1>
          <p className="my-box-subtitle">Seu arquivo pessoal de avaliações, obras assistidas e títulos favoritos.</p>
        </div>

        {/* LEDGER ARQUITETURAL DINÂMICO CONFORME A VISÃO ATIVA */}
        {isLoggedIn && hasAnyActivity && (
          <MyBoxLedger
            activeView={activeView}
            reviewStats={reviewStats}
            watchedStats={watchedStats}
            favoriteStats={favoriteStats}
          />
        )}
      </header>

      {/* CASO: NÃO ESTÁ LOGADO */}
      {!isLoggedIn ? (
        <div className="my-box-empty-card">
          <div className="my-box-empty-icon">
            <LogIn size={20} />
          </div>
          <h2 className="my-box-empty-title">IDENTIFICAÇÃO NECESSÁRIA</h2>
          <p className="my-box-empty-desc">
            Entre na sua conta para acessar seu arquivo pessoal de críticas, filmes assistidos e favoritos.
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
        <div className="my-box-loading">
          <span className="my-box-loading-indicator" />
          <span>Acessando seu arquivo de cinema...</span>
        </div>
      ) : error ? (
        <div className="my-box-empty-card">
          <h2 className="my-box-empty-title" style={{ color: '#ef4444' }}>
            FALHA NA CONSULTA
          </h2>
          <p className="my-box-empty-desc">{error}</p>
          <button className="nav-btn nav-btn-accent" onClick={loadAllBoxData}>
            TENTAR NOVAMENTE
          </button>
        </div>
      ) : (
        <>
          {/* SELETOR PRINCIPAL DE VISÃO: CRÍTICAS | ASSISTIDOS | FAVORITOS */}
          <div className="my-box-view-selector" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'reviews'}
              className={`my-box-view-btn ${activeView === 'reviews' ? 'active' : ''}`}
              onClick={() => handleViewChange('reviews')}
            >
              <MessageSquare size={16} />
              <span>CRÍTICAS</span>
              <span className="my-box-view-badge">{reviews.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'watched'}
              className={`my-box-view-btn ${activeView === 'watched' ? 'active' : ''}`}
              onClick={() => handleViewChange('watched')}
            >
              <Eye size={16} />
              <span>ASSISTIDOS</span>
              <span className="my-box-view-badge">{watchedList.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeView === 'favorites'}
              className={`my-box-view-btn ${activeView === 'favorites' ? 'active' : ''}`}
              onClick={() => handleViewChange('favorites')}
            >
              <Heart size={16} />
              <span>FAVORITOS</span>
              <span className="my-box-view-badge">{favoritesList.length}</span>
            </button>
          </div>

          {/* BARRA DE FERRAMENTAS: CATEGORIA (TODAS/FILMES/SÉRIES/ANIMES) + BUSCA TEXTUAL */}
          <div className="my-box-toolbar">
            <div className="my-box-segmented-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === 'all'}
                className={`my-box-seg-btn ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                <span>Todas</span>
                <span className="my-box-tab-count">{currentCategoryCounts.all}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === 'movie'}
                className={`my-box-seg-btn ${activeCategory === 'movie' ? 'active' : ''}`}
                onClick={() => setActiveCategory('movie')}
              >
                <span>Filmes</span>
                <span className="my-box-tab-count">{currentCategoryCounts.movie}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === 'tv'}
                className={`my-box-seg-btn ${activeCategory === 'tv' ? 'active' : ''}`}
                onClick={() => setActiveCategory('tv')}
              >
                <span>Séries</span>
                <span className="my-box-tab-count">{currentCategoryCounts.tv}</span>
              </button>
              {(currentCategoryCounts.anime > 0 || activeCategory === 'anime') && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === 'anime'}
                  className={`my-box-seg-btn ${activeCategory === 'anime' ? 'active' : ''}`}
                  onClick={() => setActiveCategory('anime')}
                >
                  <span>Animes</span>
                  <span className="my-box-tab-count">{currentCategoryCounts.anime}</span>
                </button>
              )}
            </div>

            <div className="my-box-search-field">
              <Search size={14} className="my-box-search-icon" />
              <input
                type="text"
                className="my-box-search-input"
                placeholder={
                  activeView === 'reviews'
                    ? 'Filtrar críticas por obra ou texto...'
                    : activeView === 'watched'
                    ? 'Buscar nos seus assistidos...'
                    : 'Buscar nos seus favoritos...'
                }
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

          {/* ===============================================================
              VISÃO: CRÍTICAS (REVIEWS)
              =============================================================== */}
          {activeView === 'reviews' && (
            reviews.length === 0 ? (
              <div className="my-box-empty-card">
                <div className="my-box-empty-icon">
                  <Inbox size={22} />
                </div>
                <h2 className="my-box-empty-title">SUA CAIXA DE CRÍTICAS ESTÁ VAZIA</h2>
                <p className="my-box-empty-desc">
                  Você ainda não registrou nenhuma avaliação crítica. Explore o catálogo para registrar suas notas e comentários.
                </p>
                <button className="nav-btn nav-btn-accent" onClick={() => navigate('/search?filter=trending')}>
                  <Compass size={14} style={{ marginRight: '8px' }} />
                  EXPLORAR CATÁLOGO EM ALTA
                </button>
              </div>
            ) : filteredReviews.length === 0 ? (
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
                    setActiveCategory('all');
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
            )
          )}

          {/* ===============================================================
              VISÃO: ASSISTIDOS (WATCHED)
              =============================================================== */}
          {activeView === 'watched' && (
            watchedList.length === 0 ? (
              <div className="my-box-empty-card">
                <div className="my-box-empty-icon">
                  <Eye size={22} />
                </div>
                <h2 className="my-box-empty-title">NENHUM TÍTULO MARCADO COMO ASSISTIDO</h2>
                <p className="my-box-empty-desc">
                  Marque filmes, séries e animes que você já assistiu pelo catálogo ou pela página do filme para manter seu histórico de cinema.
                  Lembre-se: qualquer filme que você avaliar vira automaticamente assistido!
                </p>
                <button className="nav-btn nav-btn-accent" onClick={() => navigate('/search?filter=trending')}>
                  <Compass size={14} style={{ marginRight: '8px' }} />
                  EXPLORAR CATÁLOGO PARA MARCAR
                </button>
              </div>
            ) : filteredWatched.length === 0 ? (
              <div className="my-box-empty-card" style={{ padding: '48px 24px' }}>
                <h3 className="my-box-empty-title" style={{ fontSize: '1.15rem' }}>
                  NENHUM TÍTULO ENCONTRADO NOS ASSISTIDOS
                </h3>
                <p className="my-box-empty-desc" style={{ marginBottom: '16px' }}>
                  Nenhum título corresponde aos filtros ativos ou ao termo pesquisado.
                </p>
                <button
                  className="nav-btn nav-btn-ghost"
                  onClick={() => {
                    setActiveCategory('all');
                    setSearchQuery('');
                  }}
                >
                  LIMPAR FILTROS
                </button>
              </div>
            ) : (
              <MediaActivityGrid
                items={filteredWatched}
                posters={posters}
                onNavigate={(tmdbId, mediaType) => navigate(`/movie/${tmdbId}?type=${mediaType}`)}
                itemPrefix="watched"
              />
            )
          )}

          {/* ===============================================================
              VISÃO: FAVORITOS (FAVORITES)
              =============================================================== */}
          {activeView === 'favorites' && (
            favoritesList.length === 0 ? (
              <div className="my-box-empty-card">
                <div className="my-box-empty-icon" style={{ borderColor: 'rgba(255, 51, 102, 0.3)', color: '#ff3366' }}>
                  <Heart size={22} fill="currentColor" />
                </div>
                <h2 className="my-box-empty-title">NENHUM TÍTULO FAVORITADO</h2>
                <p className="my-box-empty-desc">
                  Favorite as obras que marcaram sua vida cinéfila. Ao passar o mouse sobre qualquer pôster no catálogo ou na página de detalhes, clique no coração para adicionar aos favoritos.
                </p>
                <button className="nav-btn nav-btn-accent" onClick={() => navigate('/search?filter=trending')}>
                  <Compass size={14} style={{ marginRight: '8px' }} />
                  EXPLORAR CATÁLOGO EM ALTA
                </button>
              </div>
            ) : filteredFavorites.length === 0 ? (
              <div className="my-box-empty-card" style={{ padding: '48px 24px' }}>
                <h3 className="my-box-empty-title" style={{ fontSize: '1.15rem' }}>
                  NENHUM FAVORITO ENCONTRADO
                </h3>
                <p className="my-box-empty-desc" style={{ marginBottom: '16px' }}>
                  Nenhum favorito corresponde aos filtros ou termo pesquisado.
                </p>
                <button
                  className="nav-btn nav-btn-ghost"
                  onClick={() => {
                    setActiveCategory('all');
                    setSearchQuery('');
                  }}
                >
                  LIMPAR FILTROS
                </button>
              </div>
            ) : (
              <MediaActivityGrid
                items={filteredFavorites}
                posters={posters}
                onNavigate={(tmdbId, mediaType) => navigate(`/movie/${tmdbId}?type=${mediaType}`)}
                itemPrefix="fav"
              />
            )
          )}
        </>
      )}
    </div>
  );
}
