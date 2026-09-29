import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '../api/client';

export default function SearchPage() {
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
        endpoint = `/movies/discover?genre_id=${encodeURIComponent(gid)}&page=${page}`;
      } else if (q.trim()) {
        endpoint = `/movies?query=${encodeURIComponent(q.trim())}&page=${page}`;
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
      setTotalPages(data.total_pages || 1);
      setTotalResults(data.total_results || 0);
    } catch (err) {
      console.error('Erro na busca do catálogo:', err);
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
                      {m.release_date ? m.release_date.substring(0, 4) : '2026'} • Criticbox:{' '}
                      {m.criticbox_rating > 0 ? `${m.criticbox_rating.toFixed(1)}/5.0` : 'Sem notas'}
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
