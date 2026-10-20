import { apiFetch } from './client';

export async function getRecentReviews(limit = 100) {
  return apiFetch(`/reviews?limit=${limit}`);
}

export async function getMovieReviews(movieId) {
  return apiFetch(`/reviews/movie/${movieId}`);
}

export async function getUserReviews(userId) {
  return apiFetch(`/reviews/user/${userId}`);
}

export async function getMyReviews() {
  return apiFetch('/reviews/me');
}

export async function createReview(payload) {
  return apiFetch('/reviews', {
    method: 'POST',
    body: payload,
  });
}

export async function deleteReview(reviewId) {
  return apiFetch(`/reviews/${reviewId}`, {
    method: 'DELETE',
  });
}

