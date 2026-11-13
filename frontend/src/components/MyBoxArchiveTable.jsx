import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, Eye, Heart, Star, ArrowUpRight } from 'lucide-react';
import { formatReviewDate } from '../utils/date';
import { isAnime, isEpisodic, getMediaTypeLabel } from '../utils/media';
import { useReviewModal } from '../context/ReviewModalContext';
import { useActivity } from '../context/ActivityContext';
import { useToast } from '../context/ToastContext';
import { deleteReview } from '../api/reviews';
import './MyBoxArchiveTable.css';

export default function MyBoxArchiveTable({
  items = [],
  activeView = 'reviews',
  posters = {},
  onDeleteReview = null,
}) {
  const navigate = useNavigate();
  const { openReviewModal, triggerReviewUpdate } = useReviewModal();
  const { toggleWatched, toggleFavorite } = useActivity();
  const { showToast } = useToast();

  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const resolvePosterUrl = (item) => {
    const tmdbId = item.tmdb_id;
    const mediaType = item.media_type || 'movie';
    return (
      item.poster_url ||
      posters[`${tmdbId}_${mediaType}`] ||
      posters[tmdbId] ||
      'https://via.placeholder.com/100x150?text=Poster'
    );
  };

  const handleOpenReview = (e, item) => {
    e?.stopPropagation();
    openReviewModal({
      tmdb_id: item.tmdb_id,
      media_type: item.media_type || 'movie',
      title: item.movie_title || item.title || `Título #${item.tmdb_id}`,
      poster_url: resolvePosterUrl(item),
      rating: Number(item.rating || item.user_rating) || 5.0,
      comment: item.comment || item.user_comment || '',
      contains_spoilers: Boolean(item.contains_spoilers),
      custom_rating: item.custom_rating,
      watched_with: item.watched_with,
      viewing_venue: item.viewing_venue,
    });
  };

  const handleDelete = async (e, reviewId) => {
    e?.stopPropagation();
    setDeletingId(reviewId);
    try {
      await deleteReview(reviewId);
      showToast('Avaliação removida do arquivo.', false);
      triggerReviewUpdate();
      if (onDeleteReview) {
        onDeleteReview(reviewId);
      }
    } catch (err) {
      showToast(err.message || 'Erro ao remover avaliação.', true);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleUnmarkWatched = async (e, item) => {
    e?.stopPropagation();
    if (item.has_review) {
      showToast('Esta obra possui avaliação registrada. Exclua a crítica antes de desmarcar.', true);
      return;
    }
    await toggleWatched({
      tmdbId: item.tmdb_id,
      mediaType: item.media_type || 'movie',
      title: item.movie_title || item.title,
      posterUrl: resolvePosterUrl(item),
    });
  };

  const handleUnmarkFavorite = async (e, item) => {
    e?.stopPropagation();
    await toggleFavorite({
      tmdbId: item.tmdb_id,
      mediaType: item.media_type || 'movie',
      title: item.movie_title || item.title,
      posterUrl: resolvePosterUrl(item),
    });
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="my-box-table-container">
      <table className="my-box-archive-table">
        <thead>
          <tr>
            <th className="col-poster">PÔSTER</th>
            <th className="col-title">TÍTULO DA OBRA</th>
            <th className="col-format">FORMATO</th>
            <th className="col-date">REGISTRO</th>
            <th className="col-rating">AVALIAÇÃO</th>
            <th className="col-review">CADERNO / CRÍTICA</th>
            <th className="col-actions">AÇÕES DIRETAS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const tmdbId = item.tmdb_id;
            const mediaType = item.media_type || 'movie';
            const title = item.movie_title || item.title || `Título #${tmdbId}`;
            const posterUrl = resolvePosterUrl(item);
            const isAnimeItem = isAnime(item);
            const isEpisodicItem = isEpisodic(item);
            const formatLabel = isAnimeItem ? 'ANIME' : isEpisodicItem ? 'SÉRIE' : 'FILME';
            const reviewId = item.review_id || item.id;
            const ratingVal = Number(item.rating || item.user_rating) || 0;
            const hasReview = Boolean(item.has_review || activeView === 'reviews' || ratingVal > 0);
            const comment = item.comment || '';
            const rowKey = `${reviewId || tmdbId}_${mediaType}_${idx}`;

            return (
              <tr key={rowKey} className="my-box-table-row">
                {/* 1. PÔSTER MINIATURA */}
                <td className="col-poster">
                  <div
                    className="table-poster-thumb"
                    onClick={() => navigate(`/movie/${tmdbId}?type=${mediaType}`)}
                    title={`Ver detalhes de ${title}`}
                  >
                    <img src={posterUrl} alt={title} loading="lazy" />
                  </div>
                </td>

                {/* 2. TÍTULO E NAVEGAÇÃO */}
                <td className="col-title">
                  <div className="table-title-wrap">
                    <span
                      className="table-title-link"
                      onClick={() => navigate(`/movie/${tmdbId}?type=${mediaType}`)}
                      title={title}
                    >
                      {title}
                    </span>
                    {item.release_date && (
                      <span className="table-title-year">
                        {String(item.release_date).substring(0, 4)}
                      </span>
                    )}
                  </div>
                </td>

                {/* 3. FORMATO */}
                <td className="col-format">
                  <span className={`table-format-tag ${isAnimeItem ? 'anime' : isEpisodicItem ? 'tv' : 'movie'}`}>
                    {formatLabel}
                  </span>
                </td>

                {/* 4. DATA */}
                <td className="col-date">
                  <span className="table-date-cell">
                    {item.created_at ? formatReviewDate(item.created_at) : '—'}
                  </span>
                </td>

                {/* 5. AVALIAÇÃO / STATUS */}
                <td className="col-rating">
                  {hasReview && ratingVal > 0 ? (
                    <span className="table-score-badge">
                      <span className="table-score-star">★</span>
                      <span>{ratingVal.toFixed(1)}</span>
                    </span>
                  ) : !hasReview ? (
                    <span className="table-pending-badge">SEM CRÍTICA</span>
                  ) : (
                    <span className="table-empty-cell">—</span>
                  )}
                </td>

                {/* 6. COMENTÁRIO RESUMIDO */}
                <td className="col-review">
                  {comment ? (
                    <span className="table-comment-snippet" title={comment}>
                      "{comment.length > 55 ? comment.substring(0, 55) + '...' : comment}"
                    </span>
                  ) : (
                    <span className="table-empty-cell">—</span>
                  )}
                </td>

                {/* 7. AÇÕES DIRETAS */}
                <td className="col-actions">
                  <div className="table-actions-cell">
                    {/* Ação 1: Avaliar ou Editar */}
                    {activeView === 'reviews' ? (
                      <button
                        type="button"
                        className="table-btn table-btn-ghost"
                        onClick={(e) => handleOpenReview(e, item)}
                        title="Editar avaliação crítica"
                      >
                        <Pencil size={12} />
                        <span>EDITAR</span>
                      </button>
                    ) : !hasReview ? (
                      <button
                        type="button"
                        className="table-btn table-btn-accent"
                        onClick={(e) => handleOpenReview(e, item)}
                        title="Avaliar esta obra com 1 clique"
                      >
                        <Star size={12} fill="currentColor" />
                        <span>AVALIAR</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="table-btn table-btn-ghost"
                        onClick={(e) => handleOpenReview(e, item)}
                        title="Revisar avaliação existente"
                      >
                        <Pencil size={12} />
                        <span>EDITAR</span>
                      </button>
                    )}

                    {/* Ação 2: Excluir Crítica (com confirmação) */}
                    {activeView === 'reviews' && reviewId && (
                      confirmDeleteId === reviewId ? (
                        <div className="table-delete-confirm-box" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="table-delete-confirm-btn yes"
                            disabled={deletingId === reviewId}
                            onClick={(e) => handleDelete(e, reviewId)}
                          >
                            {deletingId === reviewId ? '...' : 'SIM'}
                          </button>
                          <button
                            type="button"
                            className="table-delete-confirm-btn no"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                          >
                            NÃO
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="table-icon-btn table-icon-delete"
                          title="Excluir avaliação do arquivo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(reviewId);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )
                    )}

                    {/* Ação 3: Desmarcar Assistido */}
                    {activeView === 'watched' && (
                      <button
                        type="button"
                        className="table-icon-btn"
                        title={hasReview ? 'Não é possível desmarcar obra com crítica' : 'Remover dos assistidos'}
                        disabled={hasReview}
                        onClick={(e) => handleUnmarkWatched(e, item)}
                      >
                        <Eye size={13} />
                      </button>
                    )}

                    {/* Ação 4: Desfavoritar */}
                    {activeView === 'favorites' && (
                      <button
                        type="button"
                        className="table-icon-btn table-icon-fav"
                        title="Remover dos favoritos"
                        onClick={(e) => handleUnmarkFavorite(e, item)}
                      >
                        <Heart size={13} fill="currentColor" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
