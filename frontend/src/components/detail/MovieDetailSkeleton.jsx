import React from 'react';
import './MovieDetailSkeleton.css';

export default function MovieDetailSkeleton() {
  return (
    <div
      className="movie-skeleton-page"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Carregando catálogo e ficha técnica do título..."
    >
      <span className="sr-only">Carregando catálogo e ficha técnica do título...</span>

      {/* HERO BANNER SKELETON */}
      <section className="movie-detail-hero movie-skeleton-hero">
        <div className="movie-detail-bg movie-skeleton-bg" />

        <div className="movie-detail-content">
          {/* COLUNA ESQUERDA: PÔSTER + AVALIAR + STREAMING */}
          <div className="movie-detail-poster-col">
            <div className="movie-detail-poster movie-skeleton-box movie-skeleton-poster" />

            {/* BARRA DE ATIVIDADE: ASSISTIDO & FAVORITO */}
            <div className="movie-skeleton-activity-bar">
              <div className="movie-skeleton-box movie-skeleton-act-btn" />
              <div className="movie-skeleton-box movie-skeleton-act-btn" />
            </div>

            {/* BOTÃO AVALIAR TÍTULO */}
            <div className="movie-skeleton-box movie-skeleton-eval-btn" />

            {/* PREVIEW COMPACTO DE STREAMING */}
            <div className="movie-skeleton-streaming-preview">
              <div className="movie-skeleton-box movie-skeleton-streaming-label" />
              <div className="movie-skeleton-streaming-chips">
                <div className="movie-skeleton-box movie-skeleton-provider-logo" />
                <div className="movie-skeleton-box movie-skeleton-provider-logo" />
                <div className="movie-skeleton-box movie-skeleton-provider-logo" />
                <div className="movie-skeleton-box movie-skeleton-provider-logo" />
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: INFORMAÇÕES DETALHADAS */}
          <div className="movie-detail-info-col">
            {/* VOLTAR */}
            <div className="movie-skeleton-box movie-skeleton-back-btn" />

            {/* KICKER DE CABEÇALHO */}
            <div className="movie-skeleton-kicker">
              <div className="movie-skeleton-box movie-skeleton-chip-sm" />
              <div className="movie-skeleton-box movie-skeleton-chip-cert" />
              <div className="movie-skeleton-box movie-skeleton-chip-md" />
            </div>

            {/* TÍTULO PRINCIPAL (BRUTALIST DISPLAY) */}
            <div className="movie-skeleton-title-group">
              <div className="movie-skeleton-box movie-skeleton-title-line-1" />
              <div className="movie-skeleton-box movie-skeleton-title-line-2" />
            </div>

            {/* TAGLINE EDITORIAL */}
            <div className="movie-skeleton-box movie-skeleton-tagline" />

            {/* METADADOS ESSENCIAIS: ANO • TEMPO • IDIOMAS */}
            <div className="movie-skeleton-box movie-skeleton-meta" />

            {/* CRIAÇÃO & DIREÇÃO */}
            <div className="movie-skeleton-box movie-skeleton-director" />

            {/* SINOPSE */}
            <div className="movie-skeleton-synopsis">
              <div className="movie-skeleton-box movie-skeleton-line" style={{ width: '100%' }} />
              <div className="movie-skeleton-box movie-skeleton-line" style={{ width: '96%' }} />
              <div className="movie-skeleton-box movie-skeleton-line" style={{ width: '88%' }} />
              <div className="movie-skeleton-box movie-skeleton-line" style={{ width: '54%' }} />
            </div>

            {/* LEDGER DE AVALIAÇÃO (TMDB & CRITICBOX) */}
            <div className="movie-skeleton-ledger">
              <div className="movie-skeleton-ledger-item">
                <div className="movie-skeleton-box movie-skeleton-score-box" />
                <div className="movie-skeleton-ledger-meta">
                  <div className="movie-skeleton-box movie-skeleton-line-sm" style={{ width: '70px' }} />
                  <div className="movie-skeleton-box movie-skeleton-line-xs" style={{ width: '95px' }} />
                </div>
              </div>

              <div className="movie-skeleton-ledger-divider" />

              <div className="movie-skeleton-ledger-item">
                <div className="movie-skeleton-box movie-skeleton-score-box" />
                <div className="movie-skeleton-ledger-meta">
                  <div className="movie-skeleton-box movie-skeleton-line-sm" style={{ width: '85px' }} />
                  <div className="movie-skeleton-box movie-skeleton-line-xs" style={{ width: '80px' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO INFERIOR SIMPLES: PRÉVIA ESTRUTURAL DE DOSSIER & ELENCO */}
      <section className="movie-skeleton-lower-section">
        <div className="movie-skeleton-tabs-bar">
          <div className="movie-skeleton-box movie-skeleton-tab active" style={{ width: '110px' }} />
          <div className="movie-skeleton-box movie-skeleton-tab" style={{ width: '140px' }} />
          <div className="movie-skeleton-box movie-skeleton-tab" style={{ width: '130px' }} />
        </div>

        <div className="movie-skeleton-cast-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="movie-skeleton-cast-card">
              <div className="movie-skeleton-box movie-skeleton-cast-photo" />
              <div className="movie-skeleton-cast-info">
                <div className="movie-skeleton-box movie-skeleton-line-sm" style={{ width: '75%' }} />
                <div className="movie-skeleton-box movie-skeleton-line-xs" style={{ width: '50%' }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

