import { apiFetch } from './client';

export async function getTrendingMovies(page = 1) {
  return apiFetch(`/movies/trending?page=${page}`);
}

export async function getTrendingTV(page = 1) {
  return apiFetch(`/movies/trending-tv?page=${page}`);
}

export async function getNowPlayingMovies(page = 1) {
  return apiFetch(`/movies/now-playing?page=${page}`);
}

export async function getRecommendations(userId = '', page = 1) {
  const query = userId ? `?user_id=${encodeURIComponent(userId)}&page=${page}` : `?page=${page}`;
  return apiFetch(`/movies/recommendations${query}`);
}

export async function getMovieDetails(id, mediaType = '') {
  const query = mediaType ? `?type=${mediaType}` : '';
  return apiFetch(`/movies/${id}${query}`);
}

export async function getSeriesEpisodes(id) {
  return apiFetch(`/movies/${id}/episodes`);
}

export async function getSeasonEpisodes(id, seasonNumber) {
  return apiFetch(`/movies/${id}/season/${seasonNumber}`);
}

export async function searchMovies({ query = '', page = 1, genre = '', mediaType = '', minRating = 0 }) {
  const params = new URLSearchParams();
  if (query) params.append('query', query);
  params.append('page', page);
  if (genre) params.append('genre', genre);
  if (mediaType) params.append('type', mediaType);
  if (minRating > 0) params.append('min_rating', minRating);

  return apiFetch(`/movies/search?${params.toString()}`);
}

export async function getMovieGenres(mediaType = '') {
  const query = mediaType ? `?type=${mediaType}` : '';
  return apiFetch(`/movies/genres${query}`);
}
