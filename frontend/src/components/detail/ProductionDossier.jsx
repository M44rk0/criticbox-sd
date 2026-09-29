import React from 'react';
import { Users, Sparkles, DollarSign, User, ChevronDown, ChevronUp } from 'lucide-react';
import { formatReleaseDate } from '../../utils/date';

export default function ProductionDossier({
  movie,
  activeInfoTab,
  setActiveInfoTab,
  castList = [],
  visibleCast = [],
  showAllCast,
  setShowAllCast,
  hasMoreCast,
  INITIAL_CAST_COUNT,
  runtimeStr,
  hasAnyProviders,
  allProviders = [],
}) {
  const formatCurrency = (val) => {
    if (!val || val === 0) return null;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const translateStatus = (s) => {
    if (!s) return '';
    const map = {
      Released: 'Lançado',
      'Post Production': 'Pós-Produção',
      'In Production': 'Em Produção',
      Planned: 'Planejado',
      Canceled: 'Cancelado',
      'Returning Series': 'Renovada (Em Exibição)',
      Ended: 'Encerrada',
    };
    return map[s] || s;
  };

  // Renderização da aba Ficha Técnica (Dossiê Industrial - Máx 6 itens)
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
        <div className="dossier-grid">{cards.slice(0, 6)}</div>
      </div>
    );
  };

  // Renderização da aba Mercado
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
                {movie.number_of_seasons} TEMPORADA{movie.number_of_seasons > 1 ? 'S' : ''} (
                {movie.number_of_episodes || 0} EPS)
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
            <div className="watch-providers-empty">Elenco não informado para este título.</div>
          )}
        </div>
      )}

      {activeInfoTab === 'crew' && renderCrewTab()}
      {activeInfoTab === 'market' && renderMarketTab()}
    </section>
  );
}
