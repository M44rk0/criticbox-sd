const CACHE_KEY = 'cb_media_meta';

export function getCachedMediaMeta(tmdbId) {
  if (!tmdbId) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[String(tmdbId)] || null;
  } catch (e) {
    return null;
  }
}

export function saveCachedMediaMeta(tmdbId, meta) {
  if (!tmdbId || !meta) return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[String(tmdbId)] = { ...(map[String(tmdbId)] || {}), ...meta };
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch (e) {}
}

/**
 * Identifica se a obra possui estrutura episódica (séries de TV, animes seriais ou episódios avaliados)
 * ou se é uma obra de formato unitário (longas-metragens/filmes).
 */
export function isEpisodic(item) {
  if (!item) return false;
  if (item.media_type === 'tv') return true;
  if (item.season_number !== undefined && item.season_number !== null && Number(item.season_number) > 0) {
    return true;
  }
  if (item.number_of_seasons !== undefined && Number(item.number_of_seasons) > 0) {
    return true;
  }
  if (Array.isArray(item.seasons) && item.seasons.length > 0) {
    return true;
  }
  return false;
}

/**
 * Identifica puramente se a obra é um Anime (japonês + animação), sem efeitos colaterais de render.
 */
export function isAnime(item) {
  if (!item) return false;

  // Se já foi previamente identificado no backend ou contrato de dados
  if (item.media_type === 'anime' || item.isAnime === true || item.is_anime === true) {
    return true;
  }

  const id = item.tmdb_id || item.id;
  if (id) {
    const cached = getCachedMediaMeta(id);
    if (cached && typeof cached.isAnime === 'boolean') {
      return cached.isAnime;
    }
  }

  const genres = item.genres || [];
  const genreIds = item.genre_ids || [];

  const hasAnimationGenre =
    genreIds.includes(16) ||
    genres.includes(16) ||
    genres.some((g) => {
      const gName = (typeof g === 'string' ? g : g.name || '').toLowerCase();
      return gName.includes('animação') || gName.includes('animation');
    });

  const isJapanese =
    item.original_language === 'ja' ||
    (Array.isArray(item.origin_country) && item.origin_country.includes('JP')) ||
    (Array.isArray(item.production_countries) &&
      item.production_countries.some((c) => {
        const cName = (typeof c === 'string' ? c : c.name || '').toLowerCase();
        return cName.includes('japan') || cName.includes('japão');
      }));

  return Boolean(hasAnimationGenre && isJapanese);
}

/**
 * Retorna o rótulo visual canônico para exibição em badges e tags ('ANIME' | 'SÉRIE' | 'FILME').
 */
export function getMediaTypeLabel(item) {
  if (!item) return 'FILME';
  if (isAnime(item)) {
    return 'ANIME';
  }
  return isEpisodic(item) ? 'SÉRIE' : 'FILME';
}


