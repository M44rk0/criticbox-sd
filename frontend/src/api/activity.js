import { apiFetch } from './client';

export async function toggleWatched({ tmdb_id, media_type, movie_title, poster_url }) {
  return await apiFetch('/activity/watched/toggle', {
    method: 'POST',
    body: {
      tmdb_id: Number(tmdb_id),
      media_type: media_type || 'movie',
      movie_title: movie_title || '',
      poster_url: poster_url || '',
    },
  });
}

export async function toggleFavorite({ tmdb_id, media_type, movie_title, poster_url }) {
  return await apiFetch('/activity/favorites/toggle', {
    method: 'POST',
    body: {
      tmdb_id: Number(tmdb_id),
      media_type: media_type || 'movie',
      movie_title: movie_title || '',
      poster_url: poster_url || '',
    },
  });
}

export async function getMediaStatus(tmdbId, mediaType = 'movie') {
  return await apiFetch(`/activity/status/${tmdbId}?media_type=${encodeURIComponent(mediaType || 'movie')}`);
}

export async function getMyWatched(page = 1, pageSize = 40) {
  return await apiFetch(`/activity/watched?page=${page}&page_size=${pageSize}`);
}

export async function getMyFavorites(page = 1, pageSize = 40) {
  return await apiFetch(`/activity/favorites?page=${page}&page_size=${pageSize}`);
}

export async function getUserWatched(username, page = 1, pageSize = 40) {
  return await apiFetch(`/activity/user/${encodeURIComponent(username)}/watched?page=${page}&page_size=${pageSize}`);
}

export async function getUserFavorites(username, page = 1, pageSize = 40) {
  return await apiFetch(`/activity/user/${encodeURIComponent(username)}/favorites?page=${page}&page_size=${pageSize}`);
}
