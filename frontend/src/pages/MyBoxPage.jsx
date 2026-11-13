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
  ArrowUpRight,
  LayoutGrid,
  List,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useReviewModal } from '../context/ReviewModalContext';
import { useActivity } from '../context/ActivityContext';
import { getMyReviews } from '../api/reviews';
import { getMyWatched, getMyFavorites } from '../api/activity';
import { getMovieDetails } from '../api/movies';
import { getClientToken } from '../api/client';
import { isAnime, isEpisodic } from '../utils/media';
import {
  computeReviewStats,
  computeActivityStats,
  filterActivityItems,
} from '../utils/activityHelpers';
import ReviewCard from '../components/ReviewCard';
import MediaActivityGrid from '../components/MediaActivityGrid';
import MyBoxLedger from '../components/MyBoxLedger';
import MyBoxArchiveTable from '../components/MyBoxArchiveTable';
import './MyBoxPage.css';

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

  // Modo de Exibição do Acervo: 'grid' (grade) | 'table' (fichário)
  const [viewMode, setViewMode] = useState('grid');

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
  const [reviewFilter, setReviewFilter] = useState('all'); // 'all' | 'unreviewed' (específico de assistidos)
  const [searchQuery, setSearchQuery] = useState('');
  const isInitialLoad = useRef(!hasValidCache);

  const applyWatchedData = (data) => {
    if (!Array.isArray(data)) return;
    setWatchedList(data);
    seedActivityItems(data, 'watched');
    globalMyBoxCache.watched = data;
  };

  const applyFavoritesData = (data) => {
    if (!Array.isArray(data)) return;
    setFavoritesList(data);
    seedActivityItems(data, 'favorite');
    globalMyBoxCache.favorites = data;
  };

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
      applyWatchedData(watList);
      applyFavoritesData(favList);

      // Atualiza o cache global em nível de módulo
      globalMyBoxCache.reviews = revList;
      globalMyBoxCache.lastLoadedUser = username;
      globalMyBoxCache.lastActivityRevision = activityRevision;
      globalMyBoxCache.lastReviewRevision = reviewRevision;
      globalMyBoxCache.timestamp = Date.now();

      // Coleta e mescla pôsteres preservando os já existentes
      setPosters((prev) => {
        const next = { ...prev, ...(globalMyBoxCache.posters || {}) };
        [...revList, ...watList, ...favList].forEach((item) => {
          if (item.poster_url) {
            next[`${item.tmdb_id}_${item.media_type || 'movie'}`] = item.poster_url;
            next[item.tmdb_id] = item.poster_url;
          }
        });
        globalMyBoxCache.posters = next;
        return next;
      });

      // Backfill assíncrono atômico apenas se houver reviews sem pôster
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
        const fetchedEntries = await Promise.all(
          unique.slice(0, 5).map(async ({ id, type }) => {
            try {
              const details = await getMovieDetails(id, type);
              return details?.poster_url ? { id, type, posterUrl: details.poster_url } : null;
            } catch (e) {
              return null;
            }
          })
        );
        const validPosters = fetchedEntries.filter(Boolean);
        if (validPosters.length > 0) {
          setPosters((prev) => {
            const updated = { ...prev };
            validPosters.forEach(({ id, type, posterUrl }) => {
              updated[`${id}_${type}`] = posterUrl;
              updated[id] = posterUrl;
            });
            globalMyBoxCache.posters = updated;
            return updated;
          });
        }
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

  // Sincronização em segundo plano quando uma crítica é salva ou excluída
  useEffect(() => {
    if (reviewRevision === 0) return;
    if (isInitialLoad.current) return;
    reviewsDirtyRef.current = true;
    watchedDirtyRef.current = true;
    if (activeViewRef.current === 'reviews' || activeViewRef.current === 'watched') {
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
      getMyFavorites(1, 100).then(applyFavoritesData).catch(() => {});
    } else if (currentTab === 'favorites') {
      favoritesDirtyRef.current = true;
      getMyWatched(1, 100).then(applyWatchedData).catch(() => {});
    } else {
      Promise.all([getMyWatched(1, 100).catch(() => []), getMyFavorites(1, 100).catch(() => [])]).then(
        ([watData, favData]) => {
          applyWatchedData(watData);
          applyFavoritesData(favData);
        }
      );
    }
  }, [activityRevision]);

  // Alternância instantânea de abas via cache em memória
  const handleViewChange = (newView) => {
    setActiveView(newView);
    setActiveCategory('all');
    setReviewFilter('all');
    setSearchQuery('');

    if (newView === 'watched' && watchedDirtyRef.current) {
      watchedDirtyRef.current = false;
      getMyWatched(1, 100).then(applyWatchedData).catch(() => {});
    } else if (newView === 'favorites' && favoritesDirtyRef.current) {
      favoritesDirtyRef.current = false;
      getMyFavorites(1, 100).then(applyFavoritesData).catch(() => {});
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
    const deletedRev = reviews.find((r) => r.review_id === deletedId);
    setReviews((prev) => {
      const next = prev.filter((r) => r.review_id !== deletedId);
      globalMyBoxCache.reviews = next;
      return next;
    });

    // Ao apagar uma crítica, a obra DEVE continuar como assistida!
    // Atualiza o item em watchedList para has_review = false e user_rating = 0
    if (deletedRev) {
      setWatchedList((prev) => {
        const next = prev.map((w) => {
          if (
            Number(w.tmdb_id) === Number(deletedRev.tmdb_id) &&
            (w.media_type || 'movie') === (deletedRev.media_type || 'movie')
          ) {
            return {
              ...w,
              has_review: false,
              user_rating: 0,
              review_id: '',
            };
          }
          return w;
        });
        globalMyBoxCache.watched = next;
        return next;
      });
    }

    reviewsDirtyRef.current = true;
    watchedDirtyRef.current = true;
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
    () => filterActivityItems(watchedList, activeCategory, searchQuery, reviewFilter),
    [watchedList, activeCategory, searchQuery, reviewFilter]
  );
  const filteredFavorites = useMemo(
    () => filterActivityItems(favoritesList, activeCategory, searchQuery),
    [favoritesList, activeCategory, searchQuery]
  );

  const activeFilteredItems = useMemo(() => {
    if (activeView === 'reviews') return filteredReviews;
    if (activeView === 'watched') return filteredWatched;
    return filteredFavorites;
  }, [activeView, filteredReviews, filteredWatched, filteredFavorites]);

  // Contagem de títulos não avaliados por categoria para a aba assistidos
  const unreviewedCategoryCounts = useMemo(() => {
    let all = 0, movie = 0, tv = 0, anime = 0;
    watchedList.forEach((w) => {
      if (!w.has_review) {
        all++;
        if (isAnime(w)) anime++;
        else if (isEpisodic(w)) tv++;
        else movie++;
      }
    });
    return { all, movie, tv, anime };
  }, [watchedList]);

  // Metadados da visão ativa para os contadores das tabs
  const currentCategoryCounts = useMemo(() => {
    if (activeView === 'watched' && reviewFilter === 'unreviewed') {
      return unreviewedCategoryCounts;
    }

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
  }, [activeView, reviewFilter, unreviewedCategoryCounts, reviewStats, watchedStats, favoriteStats]);

  // Verifica se o usuário possui qualquer anime no acervo para manter a aba Animes estável
  const hasAnyAnime = useMemo(() => {
    return (
      (reviewStats.animeCount || 0) > 0 ||
      (watchedStats.animeCount || 0) > 0 ||
      (favoriteStats.animeCount || 0) > 0
    );
  }, [reviewStats, watchedStats, favoriteStats]);

  const hasAnyActivity = reviews.length > 0 || watchedList.length > 0 || favoritesList.length > 0;

  return (
    <div className="my-box-page">
      {/* CABEÇALHO DA MINHA CAIXA */}
      <header className="my-box-header">
        <div className="my-box-header-main">
          <div className="my-box-title-row">
            <h1 className="my-box-title">MINHA CAIXA</h1>
            {isLoggedIn && username && (
              <button
                type="button"
                className="my-box-dossier-link-btn"
                onClick={() => navigate(`/user/${username}`)}
                title="Ver como a comunidade enxerga suas avaliações, 4 pilares e seu dossiê público"
              >
                <span>VER MEU DOSSIÊ PÚBLICO</span>
                <ArrowUpRight size={13} />
              </button>
            )}
          </div>
          <p className="my-box-subtitle">
            Sua bancada operacional: faça triagem de pendências, edite notas e consulte seu fichário arquivístico.
          </p>
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
              <MessageSquare size={15} />
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
              <Eye size={15} />
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
              <Heart size={15} />
              <span>FAVORITOS</span>
              <span className="my-box-view-badge">{favoritesList.length}</span>
            </button>
          </div>

          {/* BARRA DE FERRAMENTAS: CATEGORIA (TODAS/FILMES/SÉRIES/ANIMES) + BUSCA + SELETOR DE MODO */}
          <div className="my-box-toolbar">
            <div className="my-box-filters-group">
              {/* SEGMENTAÇÃO DE FORMATO */}
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
                {(hasAnyAnime || currentCategoryCounts.anime > 0 || activeCategory === 'anime') && (
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

              {/* SEGMENTAÇÃO EXCLUSIVA DE ASSISTIDOS: TODOS / NÃO AVALIADOS */}
              {activeView === 'watched' && (
                <div className="my-box-segmented-tabs my-box-status-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={reviewFilter === 'all'}
                    className={`my-box-seg-btn ${reviewFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setReviewFilter('all')}
                  >
                    <span>Todos</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={reviewFilter === 'unreviewed'}
                    className={`my-box-seg-btn ${reviewFilter === 'unreviewed' ? 'active' : ''}`}
                    onClick={() => setReviewFilter('unreviewed')}
                    title="Mostrar apenas títulos assistidos que ainda não possuem avaliação"
                  >
                    <span>Não Avaliados</span>
                    <span className="my-box-tab-count">{watchedStats.unreviewedCount}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="my-box-toolbar-right">
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

              {/* ALTERNADOR DE VISUALIZAÇÃO: GRADE VS FICHÁRIO */}
              <div className="my-box-view-mode-toggle" role="group" aria-label="Modo de visualização">
                <button
                  type="button"
                  className={`my-box-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Modo Grade (Pôsteres)"
                  aria-label="Modo Grade"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  className={`my-box-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  title="Modo Fichário (Tabela Arquivística)"
                  aria-label="Modo Fichário"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* ===============================================================
              VISÃO: CRÍTICAS (REVIEWS)
              =============================================================== */}
          {activeView === 'reviews' && (
            reviews.length === 0 ? (
              <MyBoxEmptyCard
                icon={<Inbox size={22} />}
                title="SUA CAIXA DE CRÍTICAS ESTÁ VAZIA"
                description="Você ainda não registrou nenhuma avaliação crítica. Explore o catálogo para registrar suas notas e comentários."
                ctaLabel="EXPLORAR CATÁLOGO EM ALTA"
                onExplore={() => navigate('/search?filter=trending')}
              />
            ) : filteredReviews.length === 0 ? (
              <MyBoxFilterEmptyCard
                title="NENHUMA CRÍTICA ENCONTRADA"
                description="Nenhuma avaliação corresponde aos filtros ou ao termo pesquisado."
                onReset={() => {
                  setActiveCategory('all');
                  setSearchQuery('');
                }}
              />
            ) : viewMode === 'table' ? (
              <MyBoxArchiveTable
                items={filteredReviews}
                activeView="reviews"
                posters={posters}
                onDeleteReview={handleDeleteReview}
              />
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
              <MyBoxEmptyCard
                icon={<Eye size={22} />}
                title="NENHUM TÍTULO MARCADO COMO ASSISTIDO"
                description="Marque filmes, séries e animes que você já assistiu pelo catálogo ou pela página do filme para manter seu histórico de cinema. Lembre-se: qualquer filme que você avaliar vira automaticamente assistido!"
                ctaLabel="EXPLORAR CATÁLOGO PARA MARCAR"
                onExplore={() => navigate('/search?filter=trending')}
              />
            ) : filteredWatched.length === 0 ? (
              <MyBoxFilterEmptyCard
                title={
                  reviewFilter === 'unreviewed'
                    ? 'NENHUM TÍTULO PENDENTE DE CRÍTICA'
                    : 'NENHUM TÍTULO ENCONTRADO NOS ASSISTIDOS'
                }
                description={
                  reviewFilter === 'unreviewed'
                    ? 'Parabéns! Todas as obras assistidas correspondentes aos filtros ativos já possuem uma crítica registrada.'
                    : 'Nenhum título corresponde aos filtros ativos ou ao termo pesquisado.'
                }
                onReset={() => {
                  setActiveCategory('all');
                  setReviewFilter('all');
                  setSearchQuery('');
                }}
              />
            ) : viewMode === 'table' ? (
              <MyBoxArchiveTable
                items={filteredWatched}
                activeView="watched"
                posters={posters}
              />
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
              <MyBoxEmptyCard
                icon={<Heart size={22} fill="currentColor" />}
                iconStyle={{ borderColor: 'rgba(255, 51, 102, 0.3)', color: '#ff3366' }}
                title="NENHUM TÍTULO FAVORITADO"
                description="Favorite as obras que marcaram sua trajetória no cinema. Ao passar o mouse sobre qualquer pôster no catálogo ou na página de detalhes, clique no coração para adicionar aos favoritos."
                ctaLabel="EXPLORAR CATÁLOGO EM ALTA"
                onExplore={() => navigate('/search?filter=trending')}
              />
            ) : filteredFavorites.length === 0 ? (
              <MyBoxFilterEmptyCard
                title="NENHUM FAVORITO ENCONTRADO"
                description="Nenhum favorito corresponde aos filtros ou termo pesquisado."
                onReset={() => {
                  setActiveCategory('all');
                  setSearchQuery('');
                }}
              />
            ) : viewMode === 'table' ? (
              <MyBoxArchiveTable
                items={filteredFavorites}
                activeView="favorites"
                posters={posters}
              />
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

function MyBoxEmptyCard({ icon, iconStyle, title, description, ctaLabel, onExplore }) {
  return (
    <div className="my-box-empty-card">
      <div className="my-box-empty-icon" style={iconStyle}>
        {icon}
      </div>
      <h2 className="my-box-empty-title">{title}</h2>
      <p className="my-box-empty-desc">{description}</p>
      <button className="nav-btn nav-btn-accent" onClick={onExplore}>
        <Compass size={14} style={{ marginRight: '8px' }} />
        {ctaLabel}
      </button>
    </div>
  );
}

function MyBoxFilterEmptyCard({ title, description, onReset }) {
  return (
    <div className="my-box-empty-card" style={{ padding: '48px 24px' }}>
      <h3 className="my-box-empty-title" style={{ fontSize: '1.15rem' }}>
        {title}
      </h3>
      <p className="my-box-empty-desc" style={{ marginBottom: '16px' }}>
        {description}
      </p>
      <button className="nav-btn nav-btn-ghost" onClick={onReset}>
        LIMPAR FILTROS
      </button>
    </div>
  );
}
