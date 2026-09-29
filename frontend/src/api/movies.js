import { apiFetch } from './client';

export async function getTrendingMovies() {
  return apiFetch('/movies/trending');
}

export async function getNowPlayingMovies() {
  return apiFetch('/movies/now-playing');
}

export async function getMovieDetails(id, mediaType = '') {
  const query = mediaType ? `?type=${mediaType}` : '';
  return apiFetch(`/movies/${id}${query}`);
}

export async function getSeriesEpisodes(id) {
  return apiFetch(`/movies/${id}/episodes`);
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
