import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, ChevronLeft, ChevronRight, Film, TrendingUp, Sparkles, Tv } from 'lucide-react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getMediaTypeLabel } from '../utils/media';

export default function SearchPage() {
  const navigate = useNavigate();
  const { username } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const filterParam = searchParams.get('filter') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [results, setResults] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchCatalog = async (q, filter, page) => {
    setLoading(true);
    try {
      let endpoint = '';
      if (q && q.trim()) {
        endpoint = `/movies?query=${encodeURIComponent(q.trim())}&page=${page}`;
      } else if (filter === 'trending') {
        endpoint = `/movies/trending?page=${page}`;
      } else if (filter === 'now_playing') {
        endpoint = `/movies/now-playing?page=${page}`;
      } else if (filter === 'series') {
        endpoint = `/movies/trending-tv?page=${page}`;
      } else if (filter === 'recommended') {
        if (!username) {
          setResults([]);
          setTotalPages(1);
          setTotalResults(0);
          setLoading(false);
          return;
        }
        endpoint = `/movies/recommendations?page=${page}&user_id=${encodeURIComponent(username)}`;
      } else {
        setResults([]);
        setTotalPages(1);
        setTotalResults(0);
        setLoading(false);
        return;
      }

      const data = await apiFetch(endpoint);
      const list = (data.movies || []).filter((m) => m.poster_url && !m.poster_url.includes('placeholder'));
      setResults(list);
      setTotalPages(Math.min(data.total_pages || 1, 50));
      setTotalResults(data.total_results || list.length);
    } catch (err) {
      console.error('Erro na busca do catálogo:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearchTerm(queryParam);
    if (queryParam || filterParam) {
      fetchCatalog(queryParam, filterParam, pageParam);
    } else {
      setResults([]);
      setTotalPages(1);
      setTotalResults(0);
    }
  }, [queryParam, filterParam, pageParam, username]);

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
    const params = {};
    if (queryParam) params.q = queryParam;
    if (filterParam) params.filter = filterParam;
    params.page = newPage;
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = (current, total) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    let start = Math.max(1, current - 3);
    let end = Math.min(total, start + 6);
    if (end - start < 6) {
      start = Math.max(1, end - 6);
    }
    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  let activeTitle = 'Busca de Títulos (Filmes, Séries & Animes)';
  let filterBadge = null;
  let filterIcon = <Search size={18} />;

  if (queryParam) {
    activeTitle = `Busca: "${queryParam}"`;
    filterBadge = 'BUSCA';
    filterIcon = <Search size={18} />;
  } else if (filterParam === 'trending') {
    activeTitle = 'Catálogo: Em Alta Esta Semana';
    filterBadge = 'EM ALTA';
    filterIcon = <TrendingUp size={18} />;
  } else if (filterParam === 'now_playing') {
    activeTitle = 'Catálogo: Em Cartaz nos Cinemas';
    filterBadge = 'EM CARTAZ';
    filterIcon = <Film size={18} />;
  } else if (filterParam === 'series') {
    activeTitle = 'Catálogo: Séries em Alta';
    filterBadge = 'SÉRIES';
    filterIcon = <Tv size={18} />;
  } else if (filterParam === 'recommended') {
    activeTitle = 'Catálogo: Recomendados para Você';
    filterBadge = 'RECOMENDADOS';
    filterIcon = <Sparkles size={18} />;
  }

  return (
    <div className="search-page-container">
      <div className="search-page-header">
        <div className="section-title-group" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span className="section-num">
            {filterIcon}
          </span>
          <h1 className="section-title">{activeTitle}</h1>
          {filterBadge && (
            <span
              className="active-genre-tag"
              onClick={clearFilters}
              title="Limpar filtro e voltar"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            >
              {filterBadge}
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
          {(searchTerm || filterParam) && (
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
        {!queryParam && filterParam && (
          <p style={{ marginTop: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--gray-400)' }}>
            Exibindo filtro <strong style={{ color: 'var(--accent)' }}>{activeTitle}</strong> • {totalResults} títulos catalogados (Página {pageParam} de {totalPages})
          </p>
        )}
      </div>

      <div className="section">
        {loading ? (
          <div className="loading-pulse">Sincronizando acervo de títulos...</div>
        ) : !queryParam && !filterParam ? (
          <div className="detail-reviews-empty">
            <h3 className="detail-reviews-empty-title">
              Navegue pelo Acervo do Criticbox
            </h3>
            <p className="detail-reviews-empty-desc">
              Digite o nome de um filme, série ou anime na barra de busca acima ou explore pelas seções de destaques na página inicial.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="detail-reviews-empty">
            <h3 className="detail-reviews-empty-title">
              {filterParam === 'recommended' && !username
                ? 'Faça login para ver suas recomendações'
                : 'Nenhum título encontrado'}
            </h3>
            <p className="detail-reviews-empty-desc">
              {filterParam === 'recommended' && !username
                ? 'As recomendações personalizadas são geradas com base nas suas avaliações registradas na plataforma.'
                : 'Tente buscar por termos mais genéricos ou limpe os filtros ativos.'}
            </p>
            <button className="nav-btn nav-btn-ghost" onClick={clearFilters} style={{ marginTop: '12px' }}>
              LIMPAR BUSCA
            </button>
          </div>
        ) : (
          <>
            <div className="movies-grid">
              {results.map((m, idx) => (
                <div
                  key={m.tmdb_id || m.id}
                  className="movie-card"
                  onClick={() => navigate(`/movie/${m.tmdb_id || m.id}?type=${m.media_type || 'movie'}`)}
                  title={`Ver detalhes de ${m.title}`}
                >
                  <div className="movie-card-poster">
                    <img src={m.poster_url || 'https://via.placeholder.com/500x750?text=Sem+Poster'} alt={m.title} loading="lazy" />
                    <span className="movie-card-rank">#{(pageParam - 1) * 20 + idx + 1}</span>
                  </div>
                  <div className="movie-card-info">
                    <div className="movie-card-topline">
                      <span className="movie-card-tag">
                        {m.release_date ? m.release_date.substring(0, 4) : '2026'} • {getMediaTypeLabel(m)}
                      </span>
                      <span className="movie-card-score-pill">
                        ★ {m.tmdb_vote_average ? m.tmdb_vote_average.toFixed(1) : '-'}
                      </span>
                    </div>
                    <h3 className="movie-card-title">{m.title}</h3>
                    <div className="movie-card-meta">
                      {m.criticbox_rating > 0 ? (
                        <span className="movie-card-cb-score">CRITICBOX: <strong>{m.criticbox_rating.toFixed(1)}</strong></span>
                      ) : (
                        <span className="movie-card-cb-empty">SEM CRÍTICAS</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* BARRA DE PAGINAÇÃO PADRONIZADA NO ESTILO REVIEWS */}
            {totalPages > 1 && (
              <div className="reviews-pagination" style={{ marginTop: '36px' }}>
                <button
                  type="button"
                  className="pagination-square-btn"
                  disabled={pageParam <= 1 || loading}
                  onClick={() => goToPage(pageParam - 1)}
                  aria-label="Página anterior"
                  title="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>

                {getPageNumbers(pageParam, totalPages).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`pagination-square-btn ${pageParam === p ? 'active' : ''}`}
                    onClick={() => goToPage(p)}
                    disabled={loading}
                    title={`Página ${p}`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  className="pagination-square-btn"
                  disabled={pageParam >= totalPages || loading}
                  onClick={() => goToPage(pageParam + 1)}
                  aria-label="Próxima página"
                  title="Próxima página"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
