import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Eye,
  Heart,
  Users,
  UserCheck,
  UserPlus,
  UserX,
  Search,
  X,
  Compass,
  ArrowLeft,
  Inbox,
  Award,
  SlidersHorizontal,
  Plus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getUserProfile,
  followUser,
  unfollowUser,
  getUserFollowers,
  getUserFollowing,
} from '../api/social';
import { getUserReviews } from '../api/reviews';
import { getUserWatched, getUserFavorites } from '../api/activity';
import { getMovieDetails } from '../api/movies';
import {
  computeReviewStats,
  computeActivityStats,
  filterActivityItems,
} from '../utils/activityHelpers';
import { isAnime } from '../utils/media';
import ReviewCard from '../components/ReviewCard';
import MediaActivityGrid from '../components/MediaActivityGrid';
import './MyBoxPage.css';
import './UserProfilePage.css';

function CategorySearchToolbar({
  totalCount,
  stats,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  placeholder,
}) {
  const categories = [
    { id: 'all', label: 'Todas', count: totalCount },
    { id: 'movie', label: 'Filmes', count: stats.moviesCount },
    { id: 'tv', label: 'Séries', count: stats.tvCount },
    { id: 'anime', label: 'Animes', count: stats.animeCount },
  ];

  return (
    <div className="my-box-toolbar">
      <div className="my-box-filters-group">
        <div className="my-box-segmented-tabs" role="tablist">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`my-box-seg-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => onSelectCategory(cat.id)}
            >
              <span>{cat.label}</span>
              <span className="my-box-tab-count">{cat.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="my-box-search-field">
        <Search size={14} className="my-box-search-icon" />
        <input
          type="text"
          className="my-box-search-input"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            type="button"
            className="my-box-search-clear"
            onClick={() => onSearchChange('')}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function FilterEmptyCard({ title, description, onReset }) {
  return (
    <div className="my-box-empty-card" style={{ padding: '48px 24px' }}>
      <h3 className="my-box-empty-title" style={{ fontSize: '1.15rem' }}>
        {title}
      </h3>
      <p className="my-box-empty-desc" style={{ marginBottom: '16px' }}>
        {description}
      </p>
      <button type="button" className="nav-btn nav-btn-ghost" onClick={onReset}>
        LIMPAR FILTROS
      </button>
    </div>
  );
}

export default function UserProfilePage() {
  const { username: rawUsername } = useParams();
  const username = (rawUsername || '').replace(/^@+/, '').trim();
  const navigate = useNavigate();
  const { isLoggedIn, username: authUsername, openAuth } = useAuth();
  const cleanAuthUser = (authUsername || '').replace(/^@+/, '').trim();
  const { showToast } = useToast();

  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [watched, setWatched] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [dynamicPosters, setDynamicPosters] = useState({});
  const fetchedPostersRef = useRef(new Set());

  const [activeTab, setActiveTab] = useState('dossier');
  const [socialSubTab, setSocialSubTab] = useState('followers');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [socialLoading, setSocialLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isSelf = Boolean(
    cleanAuthUser &&
      username &&
      cleanAuthUser.toLowerCase() === username.toLowerCase()
  );

  // Reset de abas e estado ao navegar entre diferentes perfis de usuários
  useEffect(() => {
    setActiveTab('dossier');
    setSocialSubTab('followers');
    setActiveCategory('all');
    setSearchQuery('');
    setFollowers([]);
    setFollowing([]);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [username]);

  // Carregamento de dados principais do perfil
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!username) return;
      if (!profile) setLoading(true);
      try {
        const [profData, revData, watchData, favData] = await Promise.all([
          getUserProfile(username).catch(() => null),
          getUserReviews(username).catch(() => []),
          getUserWatched(username).catch(() => []),
          getUserFavorites(username).catch(() => []),
        ]);

        if (isMounted) {
          setProfile(profData);
          setReviews(Array.isArray(revData) ? revData : []);
          setWatched(Array.isArray(watchData) ? watchData : []);
          setFavorites(Array.isArray(favData) ? favData : []);
        }
      } catch {
        if (isMounted) {
          showToast('Erro ao carregar dossiê do perfil.', true);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [username]);

  // Carrega seguidores e seguindo sob demanda
  useEffect(() => {
    if (activeTab !== 'connections') return;
    let isMounted = true;
    setSocialLoading(true);
    Promise.all([
      getUserFollowers(username).catch(() => []),
      getUserFollowing(username).catch(() => []),
    ])
      .then(([followersData, followingData]) => {
        if (!isMounted) return;
        setFollowers(Array.isArray(followersData) ? followersData : []);
        setFollowing(Array.isArray(followingData) ? followingData : []);
      })
      .finally(() => {
        if (isMounted) setSocialLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [activeTab, username]);

  const handleFollowToggle = async () => {
    if (!isLoggedIn) {
      openAuth('login');
      return;
    }
    if (!profile) return;

    setActionLoading(true);
    try {
      if (profile.is_following) {
        await unfollowUser(username);
        setProfile((prev) => ({
          ...prev,
          is_following: false,
          is_mutual: false,
          followers_count: Math.max(0, (prev?.followers_count || 1) - 1),
        }));
        showToast(`Você deixou de seguir ${username}.`);
      } else {
        const res = await followUser(username);
        setProfile((prev) => ({
          ...prev,
          is_following: true,
          is_mutual: Boolean(res?.is_mutual),
          followers_count: (prev?.followers_count || 0) + 1,
        }));
        showToast(
          res?.is_mutual
            ? 'Vocês agora são amigos na rede!'
            : `Você agora está seguindo ${username}!`
        );
      }
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar conexão.', true);
    } finally {
      setActionLoading(false);
    }
  };

  const reviewStats = useMemo(() => computeReviewStats(reviews), [reviews]);
  const watchedStats = useMemo(() => computeActivityStats(watched), [watched]);
  const favoriteStats = useMemo(() => computeActivityStats(favorites), [favorites]);

  const postersMap = useMemo(() => {
    const map = { ...dynamicPosters };
    for (const list of [reviews, watched, favorites]) {
      for (const item of list) {
        if (item.poster_url) {
          map[`${item.tmdb_id}_${item.media_type || 'movie'}`] = item.poster_url;
          map[item.tmdb_id] = item.poster_url;
        }
      }
    }
    return map;
  }, [reviews, watched, favorites, dynamicPosters]);

  const resolvePoster = (item) =>
    item.poster_url ||
    postersMap[`${item.tmdb_id}_${item.media_type || 'movie'}`] ||
    postersMap[item.tmdb_id];

  // Busca pôsteres ausentes em lote atômico
  useEffect(() => {
    const missingMap = new Map();
    for (const r of reviews) {
      const key = `${r.tmdb_id}_${r.media_type || 'movie'}`;
      if (!r.poster_url && !postersMap[key] && !fetchedPostersRef.current.has(key)) {
        missingMap.set(key, { id: r.tmdb_id, type: r.media_type || 'movie', key });
      }
    }
    const batch = Array.from(missingMap.values()).slice(0, 5);
    if (batch.length === 0) return;

    batch.forEach(({ key }) => fetchedPostersRef.current.add(key));
    Promise.all(
      batch.map(async ({ id, type, key }) => {
        try {
          const details = await getMovieDetails(id, type);
          return details?.poster_url ? { id, key, url: details.poster_url } : null;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      const valid = results.filter(Boolean);
      if (valid.length > 0) {
        setDynamicPosters((prev) => {
          const next = { ...prev };
          for (const { id, key, url } of valid) {
            next[key] = url;
            next[id] = url;
          }
          return next;
        });
      }
    });
  }, [reviews, postersMap]);

  const fourPillars = useMemo(() => {
    if (profile?.four_pillars) {
      try {
        const saved = JSON.parse(profile.four_pillars);
        if (Array.isArray(saved)) {
          return saved.map((item) => ({
            ...item,
            poster_url: item.poster_url || postersMap[item.tmdb_id],
          }));
        }
      } catch {}
    }
    return [];
  }, [profile?.four_pillars, postersMap]);

  const ratingSpectrum = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let max = 0;
    for (const r of reviews) {
      const score = Number(r.rating) || 0;
      if (score > 0) {
        const star = Math.min(5, Math.max(1, Math.round(score)));
        counts[star] = (counts[star] || 0) + 1;
        if (counts[star] > max) max = counts[star];
      }
    }
    return { counts, max: max || 1 };
  }, [reviews]);

  const filteredReviews = useMemo(
    () => filterActivityItems(reviews, activeCategory, searchQuery),
    [reviews, activeCategory, searchQuery]
  );
  const filteredWatched = useMemo(
    () => filterActivityItems(watched, activeCategory, searchQuery),
    [watched, activeCategory, searchQuery]
  );
  const filteredFavorites = useMemo(
    () => filterActivityItems(favorites, activeCategory, searchQuery),
    [favorites, activeCategory, searchQuery]
  );

  const memberSinceYear =
    profile?.created_at && profile.created_at.length >= 4
      ? profile.created_at.substring(0, 4)
      : '2026';

  const switchTab = (tabId) => {
    setActiveTab(tabId);
    setActiveCategory('all');
    setSearchQuery('');
  };

  const resetFilters = () => {
    setActiveCategory('all');
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className="user-profile-page">
        <div className="my-box-loading">
          <span className="my-box-loading-indicator" />
          <span>Acessando dossiê cinematográfico de {username}...</span>
        </div>
      </div>
    );
  }

  if (!profile || profile.success === false || (!profile.username && !profile.user_id)) {
    return (
      <div className="user-profile-page">
        <div className="my-box-empty-card" style={{ padding: '80px 32px' }}>
          <div className="my-box-empty-icon">
            <UserX size={22} />
          </div>
          <h2 className="my-box-empty-title">USUÁRIO NÃO ENCONTRADO</h2>
          <p className="my-box-empty-desc" style={{ maxWidth: '420px', marginBottom: '24px' }}>
            Não encontramos nenhum perfil correspondente a <strong>{username}</strong> no Criticbox.
          </p>
          <button className="nav-btn nav-btn-accent" onClick={() => navigate('/')}>
            <ArrowLeft size={13} style={{ marginRight: '6px' }} />
            VOLTAR AO INÍCIO
          </button>
        </div>
      </div>
    );
  }

  const navTabs = [
    { id: 'dossier', label: 'DOSSIÊ PRINCIPAL', icon: Award, count: null },
    { id: 'reviews', label: 'TODAS AS CRÍTICAS', icon: MessageSquare, count: reviews.length },
    { id: 'watched', label: 'ASSISTIDOS', icon: Eye, count: watched.length },
    { id: 'favorites', label: 'FAVORITOS', icon: Heart, count: favorites.length },
    {
      id: 'connections',
      label: 'CONEXÕES',
      icon: Users,
      count: (profile.followers_count || 0) + (profile.following_count || 0),
    },
  ];

  const activeSocialList = socialSubTab === 'followers' ? followers : following;

  return (
    <div className="user-profile-page">
      {/* 1. MASTHEAD DO DOSSIÊ */}
      <header className="profile-masthead">
        <div className="profile-identity-strip">
          <div className="profile-identity-main">
            <div
              className={`profile-avatar-wrap ${isSelf ? 'profile-avatar-self' : ''}`}
              onClick={isSelf ? () => navigate('/editar-perfil') : undefined}
              title={isSelf ? 'Clique para gerenciar foto de perfil e pilares' : undefined}
              role={isSelf ? 'button' : undefined}
              tabIndex={isSelf ? 0 : undefined}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} />
              ) : (
                (profile.username || 'U')[0].toUpperCase()
              )}
            </div>

            <div className="profile-identity-info">
              <div className="profile-title-wrap">
                <h1 className="profile-username">{profile.username}</h1>
                {!isSelf && profile.is_mutual && (
                  <span className="profile-pill-badge friends" title="Vocês se seguem mutuamente!">
                    <Users size={12} strokeWidth={2.2} /> AMIGOS
                  </span>
                )}
                {!isSelf && !profile.is_mutual && profile.is_followed_by && (
                  <span className="profile-pill-badge follows-you" title={`${profile.username} segue você!`}>
                    <UserCheck size={12} strokeWidth={2.2} /> SEGUE VOCÊ
                  </span>
                )}
              </div>
              <span className="profile-bio-sub">• Perfil ativo desde {memberSinceYear}</span>
            </div>
          </div>

          <div className="profile-masthead-actions">
            {isSelf ? (
              <>
                <button
                  type="button"
                  className="nav-btn nav-btn-accent"
                  onClick={() => navigate('/editar-perfil')}
                >
                  <SlidersHorizontal size={13} style={{ marginRight: '6px' }} />
                  EDITAR PERFIL
                </button>
                <button
                  type="button"
                  className="nav-btn nav-btn-ghost"
                  onClick={() => navigate('/minha-caixa')}
                >
                  <Compass size={13} style={{ marginRight: '6px' }} />
                  MINHA CAIXA
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`nav-btn ${profile.is_following ? 'nav-btn-ghost' : 'nav-btn-accent'}`}
                onClick={handleFollowToggle}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  'PROCESSANDO...'
                ) : profile.is_following ? (
                  <>
                    <UserCheck size={13} style={{ marginRight: '6px' }} />
                    SEGUINDO
                  </>
                ) : (
                  <>
                    <UserPlus size={13} style={{ marginRight: '6px' }} />
                    SEGUIR
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. NAVEGAÇÃO DO DOSSIÊ */}
      <nav className="profile-nav-bar" role="tablist">
        {navTabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`profile-nav-tab ${activeTab === id ? 'active' : ''}`}
            onClick={() => switchTab(id)}
          >
            <Icon size={15} />
            <span>{label}</span>
            {count !== null && <span className="profile-nav-count">{count}</span>}
          </button>
        ))}
      </nav>

      {/* 3. VISÃO 1: DOSSIÊ PRINCIPAL */}
      {activeTab === 'dossier' && (
        <>
          <section className="profile-pillars-section">
            <div className="profile-section-heading">
              <div className="profile-section-title">
                <span className="profile-section-title-accent">01</span>
                <span>QUATRO PILARES DA CURADORIA</span>
              </div>
            </div>

            <div className="profile-pillars-grid">
              {fourPillars.map((item, idx) => (
                <div
                  key={item.tmdb_id || idx}
                  className="pillar-card"
                  onClick={() =>
                    navigate(`/movie/${item.tmdb_id}?type=${item.media_type || 'movie'}`)
                  }
                  title={item.title}
                >
                  <span className="pillar-rank-badge">#{String(idx + 1).padStart(2, '0')}</span>
                  <div className="pillar-poster-wrap">
                    <img
                      src={item.poster_url || 'https://via.placeholder.com/500x750?text=Sem+Poster'}
                      alt={item.title}
                      loading="lazy"
                    />
                  </div>
                  <div className="pillar-info">
                    <span className="pillar-title">{item.title}</span>
                    <div className="pillar-meta">
                      <span>{item.media_type === 'tv' ? 'SÉRIE' : 'FILME'}</span>
                      {item.rating && <span>★ {Number(item.rating).toFixed(1)}</span>}
                    </div>
                  </div>
                </div>
              ))}

              {Array.from({ length: Math.max(0, 4 - fourPillars.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="pillar-empty-card">
                  <span className="pillar-empty-icon">■</span>
                  <span className="pillar-empty-text">
                    PILAR #{String(fourPillars.length + i + 1).padStart(2, '0')} VAGO
                  </span>
                  {isSelf && (
                    <button
                      type="button"
                      className="pillar-empty-btn"
                      onClick={() => navigate('/editar-perfil')}
                    >
                      <Plus size={11} style={{ marginRight: '4px' }} />
                      DEFINIR PILAR
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="profile-editorial-layout">
            <div className="profile-critique-column">
              <div className="profile-section-heading" style={{ marginBottom: '12px' }}>
                <div className="profile-section-title">
                  <span className="profile-section-title-accent">02</span>
                  <span>CADERNO DE CRÍTICAS RECENTES</span>
                </div>
                <span className="profile-section-desc">{reviews.length} PUBLICAÇÕES</span>
              </div>

              {reviews.length === 0 ? (
                <div className="my-box-empty-card">
                  <div className="my-box-empty-icon">
                    <Inbox size={20} />
                  </div>
                  <h3 className="my-box-empty-title">CADERNO DE CRÍTICAS VAZIO</h3>
                  <p className="my-box-empty-desc">
                    Este usuário ainda não redigiu análises críticas sobre as obras assistidas.
                  </p>
                </div>
              ) : (
                <div className="profile-critiques-list">
                  {reviews.slice(0, 6).map((rev) => (
                    <ReviewCard
                      key={rev.review_id || rev.id}
                      review={rev}
                      posterUrl={resolvePoster(rev)}
                      showPoster={true}
                      canDelete={false}
                      variant="editorial"
                      context="profile"
                      isAnime={isAnime(rev)}
                    />
                  ))}

                  {reviews.length > 6 && (
                    <button
                      type="button"
                      className="profile-sidebar-view-all"
                      style={{ padding: '12px', marginTop: '8px' }}
                      onClick={() => switchTab('reviews')}
                    >
                      VER TODAS AS {reviews.length} CRÍTICAS NO ARQUIVO →
                    </button>
                  )}
                </div>
              )}
            </div>

            <aside className="profile-sidebar-column">
              <div className="profile-sidebar-card">
                <div className="profile-card-header">
                  <span className="profile-card-title">RADIOGRAFIA CRÍTICA</span>
                </div>

                <div className="profile-spectrum-list">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = ratingSpectrum.counts[star] || 0;
                    const pct = reviews.length > 0 ? (count / ratingSpectrum.max) * 100 : 0;

                    return (
                      <div key={star} className="profile-spectrum-row">
                        <span className="profile-spectrum-star">{star} ★</span>
                        <div className="profile-spectrum-bar-track">
                          <div
                            className="profile-spectrum-bar-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="profile-spectrum-count">{count}</span>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--gray-800)',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: '0.75rem',
                    color: 'var(--gray-400)',
                  }}
                >
                  <span>Média Geral</span>
                  <strong style={{ color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>
                    ★ {reviewStats.avg || '—'}
                  </strong>
                </div>
              </div>

              <div className="profile-sidebar-card">
                <div className="profile-card-header">
                  <span className="profile-card-title">DIÁRIO RECENTE</span>
                  <span className="profile-card-badge">{watched.length} VISTOS</span>
                </div>

                {watched.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', margin: 0 }}>
                    Nenhum título recente registrado.
                  </p>
                ) : (
                  <>
                    <div className="profile-recent-strip">
                      {watched.slice(0, 6).map((item) => (
                        <div
                          key={item.tmdb_id}
                          className="profile-mini-poster"
                          onClick={() =>
                            navigate(`/movie/${item.tmdb_id}?type=${item.media_type || 'movie'}`)
                          }
                          title={item.movie_title || item.title}
                        >
                          <img
                            src={
                              resolvePoster(item) ||
                              'https://via.placeholder.com/300x450?text=Poster'
                            }
                            alt={item.movie_title || item.title}
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="profile-sidebar-view-all"
                      onClick={() => switchTab('watched')}
                    >
                      VER TODOS OS {watched.length} ASSISTIDOS →
                    </button>
                  </>
                )}
              </div>

              <div className="profile-sidebar-card">
                <div className="profile-card-header">
                  <span className="profile-card-title">COMUNIDADE</span>
                  <span className="profile-card-badge">CONEXÕES</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    textAlign: 'center',
                    padding: '8px 0',
                  }}
                >
                  <div
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      switchTab('connections');
                      setSocialSubTab('followers');
                    }}
                  >
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                      {profile.followers_count || 0}
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: '0.65rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>
                      Seguidores
                    </div>
                  </div>

                  <div style={{ width: '1px', background: 'var(--gray-800)' }} />

                  <div
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      switchTab('connections');
                      setSocialSubTab('following');
                    }}
                  >
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                      {profile.following_count || 0}
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: '0.65rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>
                      Seguindo
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="profile-sidebar-view-all"
                  onClick={() => switchTab('connections')}
                >
                  EXPLORAR REDE DESTE USUÁRIO →
                </button>
              </div>
            </aside>
          </div>
        </>
      )}

      {/* 4. VISÃO 2: TODAS AS CRÍTICAS */}
      {activeTab === 'reviews' && (
        <>
          <CategorySearchToolbar
            totalCount={reviews.length}
            stats={reviewStats}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Filtrar críticas por obra ou texto..."
          />

          {reviews.length === 0 ? (
            <div className="my-box-empty-card">
              <div className="my-box-empty-icon">
                <Inbox size={22} />
              </div>
              <h2 className="my-box-empty-title">NENHUMA CRÍTICA REGISTRADA</h2>
              <p className="my-box-empty-desc">
                Este usuário ainda não publicou nenhuma avaliação no Criticbox.
              </p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <FilterEmptyCard
              title="NENHUMA CRÍTICA ENCONTRADA"
              description="Nenhuma avaliação corresponde aos filtros ou ao termo pesquisado."
              onReset={resetFilters}
            />
          ) : (
            <div className="my-box-reviews-grid">
              {filteredReviews.map((r) => (
                <ReviewCard
                  key={r.review_id || r.id}
                  review={r}
                  posterUrl={resolvePoster(r)}
                  showPoster={true}
                  canDelete={false}
                  variant="editorial"
                  context="profile"
                  isAnime={isAnime(r)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* 5. VISÃO 3 & 4: ASSISTIDOS E FAVORITOS */}
      {(activeTab === 'watched' || activeTab === 'favorites') && (() => {
        const isWatchedTab = activeTab === 'watched';
        const rawItems = isWatchedTab ? watched : favorites;
        const filteredItems = isWatchedTab ? filteredWatched : filteredFavorites;
        const stats = isWatchedTab ? watchedStats : favoriteStats;

        return (
          <>
            <CategorySearchToolbar
              totalCount={rawItems.length}
              stats={stats}
              activeCategory={activeCategory}
              onSelectCategory={setActiveCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              placeholder={
                isWatchedTab ? 'Buscar nos títulos assistidos...' : 'Buscar nos favoritos...'
              }
            />

            {rawItems.length === 0 ? (
              <div className="my-box-empty-card">
                <div
                  className="my-box-empty-icon"
                  style={
                    isWatchedTab
                      ? undefined
                      : { borderColor: 'rgba(255, 51, 102, 0.3)', color: '#ff3366' }
                  }
                >
                  {isWatchedTab ? <Eye size={22} /> : <Heart size={22} fill="currentColor" />}
                </div>
                <h2 className="my-box-empty-title">
                  {isWatchedTab ? 'NENHUM TÍTULO ASSISTIDO' : 'NENHUM TÍTULO FAVORITADO'}
                </h2>
                <p className="my-box-empty-desc">
                  {isWatchedTab
                    ? 'Este usuário ainda não registrou obras assistidas.'
                    : 'Este usuário ainda não marcou obras favoritas.'}
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <FilterEmptyCard
                title="NENHUM TÍTULO ENCONTRADO"
                description={
                  isWatchedTab
                    ? 'Nenhum título corresponde aos filtros ou ao termo pesquisado.'
                    : 'Nenhum título favorito corresponde aos filtros ou à busca.'
                }
                onReset={resetFilters}
              />
            ) : (
              <MediaActivityGrid
                items={filteredItems}
                posters={postersMap}
                onNavigate={(tmdbId, mediaType) =>
                  navigate(`/movie/${tmdbId}?type=${mediaType || 'movie'}`)
                }
                itemPrefix={isWatchedTab ? 'watched' : 'fav'}
              />
            )}
          </>
        );
      })()}

      {/* 6. VISÃO 5: CONEXÕES */}
      {activeTab === 'connections' && (
        <>
          <div className="my-box-toolbar" style={{ justifyContent: 'flex-start', gap: '16px' }}>
            <div className="my-box-segmented-tabs" role="tablist">
              <button
                type="button"
                className={`my-box-seg-btn ${socialSubTab === 'followers' ? 'active' : ''}`}
                onClick={() => setSocialSubTab('followers')}
              >
                <Users size={13} style={{ marginRight: '6px' }} />
                <span>Seguidores</span>
                <span className="my-box-tab-count">{profile.followers_count || 0}</span>
              </button>
              <button
                type="button"
                className={`my-box-seg-btn ${socialSubTab === 'following' ? 'active' : ''}`}
                onClick={() => setSocialSubTab('following')}
              >
                <UserCheck size={13} style={{ marginRight: '6px' }} />
                <span>Seguindo</span>
                <span className="my-box-tab-count">{profile.following_count || 0}</span>
              </button>
            </div>
          </div>

          {socialLoading ? (
            <div className="my-box-loading">
              <span className="my-box-loading-indicator" />
              <span>Consultando conexões da rede...</span>
            </div>
          ) : activeSocialList.length === 0 ? (
            <div className="my-box-empty-card">
              <div className="my-box-empty-icon">
                {socialSubTab === 'followers' ? <Users size={22} /> : <UserCheck size={22} />}
              </div>
              <h2 className="my-box-empty-title">
                {socialSubTab === 'followers'
                  ? 'SEM SEGUIDORES NO MOMENTO'
                  : 'NÃO SEGUE NINGUÉM AINDA'}
              </h2>
              <p className="my-box-empty-desc">
                {socialSubTab === 'followers'
                  ? 'Este usuário ainda não é acompanhado por outros membros da comunidade.'
                  : 'Este usuário ainda não acompanha outros membros da rede.'}
              </p>
            </div>
          ) : (
            <div className="user-social-grid">
              {activeSocialList.map((u) => {
                const cleanUName = (u.username || '').replace(/^@+/, '');
                return (
                  <div
                    key={u.user_id || cleanUName}
                    className="user-social-card"
                    onClick={() => navigate(`/user/${cleanUName}`)}
                  >
                    <div className="user-social-card-left">
                      <div className="user-social-card-avatar">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={cleanUName} />
                        ) : (
                          cleanUName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="user-social-card-info">
                        <span className="user-social-card-name">{cleanUName}</span>
                        <span className="user-social-card-role">Membro Criticbox</span>
                      </div>
                    </div>
                    <span className="user-social-card-arrow">→</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
