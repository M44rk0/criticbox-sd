/**
 * Utilitários para detecção e rotulagem de tipos de mídia (Filme, Série, Anime)
 */

export function isAnime(item) {
  if (!item) return false;

  const genres = item.genres || [];
  const genreIds = item.genre_ids || [];

  // Checa se o gênero contém Animação (ID 16 no TMDb ou texto 'Animação'/'Animation')
  const hasAnimationGenre =
    genres.some((g) => {
      const gName = (typeof g === 'string' ? g : g.name || '').toLowerCase();
      return gName.includes('animação') || gName.includes('animation');
    }) ||
    genreIds.includes(16) ||
    genres.includes(16);

  // Checa se a origem ou idioma original é japonês
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

export function getMediaTypeLabel(item) {
  if (!item) return 'FILME';
  if (isAnime(item)) {
    return 'ANIME';
  }
  return item.media_type === 'tv' ? 'SÉRIE' : 'FILME';
}
