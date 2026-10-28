import React from 'react';
import './MyBoxLedger.css';

export default function MyBoxLedger({
  activeView = 'reviews',
  reviewStats = {},
  watchedStats = {},
  favoriteStats = {},
}) {
  return (
    <div className="my-box-ledger">
      {activeView === 'reviews' && (
        <>
          <div className="my-box-ledger-cell">
            <span className="my-box-ledger-val accent">{reviewStats.total || 0}</span>
            <span className="my-box-ledger-lbl">Críticas</span>
          </div>
          <div className="my-box-ledger-cell">
            <span className="my-box-ledger-val">
              <span className="my-box-star">★</span> {reviewStats.avg || '—'}
            </span>
            <span className="my-box-ledger-lbl">Média</span>
          </div>
          <div className="my-box-ledger-cell">
            <span className="my-box-ledger-val">{reviewStats.moviesCount || 0}</span>
            <span className="my-box-ledger-lbl">Filmes</span>
          </div>
          <div className="my-box-ledger-cell">
            <span className="my-box-ledger-val">{reviewStats.tvCount || 0}</span>
            <span className="my-box-ledger-lbl">Séries</span>
          </div>
          {(reviewStats.animeCount || 0) > 0 && (
            <div className="my-box-ledger-cell">
              <span className="my-box-ledger-val">{reviewStats.animeCount}</span>
              <span className="my-box-ledger-lbl">Animes</span>
            </div>
          )}
        </>
      )}

      {activeView === 'watched' && (
        <>
          <div className="my-box-ledger-cell">
            <span className="my-box-ledger-val accent">{watchedStats.total || 0}</span>
            <span className="my-box-ledger-lbl">Assistidos</span>
          </div>
          <div className="my-box-ledger-cell">
            <span className="my-box-ledger-val">{watchedStats.moviesCount || 0}</span>
            <span className="my-box-ledger-lbl">Filmes</span>
          </div>
          <div className="my-box-ledger-cell">
            <span className="my-box-ledger-val">{watchedStats.tvCount || 0}</span>
            <span className="my-box-ledger-lbl">Séries</span>
          </div>
          {(watchedStats.animeCount || 0) > 0 && (
            <div className="my-box-ledger-cell">
              <span className="my-box-ledger-val">{watchedStats.animeCount}</span>
              <span className="my-box-ledger-lbl">Animes</span>
            </div>
          )}
          {(watchedStats.reviewedCount || 0) > 0 && (
            <div className="my-box-ledger-cell">
              <span className="my-box-ledger-val" style={{ color: '#fbbf24' }}>
                ★ {watchedStats.reviewedCount}
              </span>
              <span className="my-box-ledger-lbl">Avaliados</span>
            </div>
          )}
        </>
      )}

      {activeView === 'favorites' && (
        <>
          <div className="my-box-ledger-cell">
            <span className="my-box-ledger-val" style={{ color: '#ff3366' }}>
              {favoriteStats.total || 0}
            </span>
            <span className="my-box-ledger-lbl">Favoritos</span>
          </div>
          <div className="my-box-ledger-cell">
            <span className="my-box-ledger-val">{favoriteStats.moviesCount || 0}</span>
            <span className="my-box-ledger-lbl">Filmes</span>
          </div>
          <div className="my-box-ledger-cell">
            <span className="my-box-ledger-val">{favoriteStats.tvCount || 0}</span>
            <span className="my-box-ledger-lbl">Séries</span>
          </div>
          {(favoriteStats.animeCount || 0) > 0 && (
            <div className="my-box-ledger-cell">
              <span className="my-box-ledger-val">{favoriteStats.animeCount}</span>
              <span className="my-box-ledger-lbl">Animes</span>
            </div>
          )}
          {(favoriteStats.reviewedCount || 0) > 0 && (
            <div className="my-box-ledger-cell">
              <span className="my-box-ledger-val" style={{ color: '#fbbf24' }}>
                ★ {favoriteStats.reviewedCount}
              </span>
              <span className="my-box-ledger-lbl">Com Crítica</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
