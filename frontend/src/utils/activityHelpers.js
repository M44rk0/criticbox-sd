import { isAnime, isEpisodic } from './media';

/**
 * Calcula estatísticas agregadas para uma lista de reviews.
 */
export function computeReviewStats(reviews = []) {
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
}

/**
 * Calcula estatísticas agregadas para coleções de atividades (Assistidos ou Favoritos).
 */
export function computeActivityStats(items = []) {
  const total = items.length;
  let animeCount = 0;
  let tvCount = 0;
  let moviesCount = 0;
  let reviewedCount = 0;

  items.forEach((item) => {
    if (item.has_review) reviewedCount++;
    if (isAnime(item)) {
      animeCount++;
    } else if (isEpisodic(item)) {
      tvCount++;
    } else {
      moviesCount++;
    }
  });

  const unreviewedCount = total - reviewedCount;
  return { total, moviesCount, tvCount, animeCount, reviewedCount, unreviewedCount };
}

/**
 * Predicado puro para filtragem por categoria ('all' | 'movie' | 'tv' | 'anime'),
 * busca textual e status de avaliação ('all' | 'unreviewed' | 'reviewed').
 */
export function filterActivityItems(
  items = [],
  activeCategory = 'all',
  searchQuery = '',
  reviewFilter = 'all'
) {
  const query = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    // Filtro de status de avaliação (exclusivo para aba assistidos)
    if (reviewFilter === 'unreviewed' && item.has_review) return false;
    if (reviewFilter === 'reviewed' && !item.has_review) return false;

    const isAnimeItem = isAnime(item);
    const isEpisodicItem = isEpisodic(item);

    if (activeCategory === 'movie' && (isAnimeItem || isEpisodicItem)) return false;
    if (activeCategory === 'tv' && (isAnimeItem || !isEpisodicItem)) return false;
    if (activeCategory === 'anime' && !isAnimeItem) return false;

    if (query) {
      const titleMatch = (item.movie_title || item.title || '').toLowerCase().includes(query);
      const commentMatch = (item.comment || '').toLowerCase().includes(query);
      const idMatch = String(item.tmdb_id).includes(query);
      return titleMatch || commentMatch || idMatch;
    }

    return true;
  });
}
