export const API_BASE = '';

export const CACHE_KEY_TRENDING = 'criticbox_cache_trending_v2';
export const CACHE_KEY_TRENDING_TV = 'criticbox_cache_trending_tv_v2';
export const CACHE_KEY_RECOMMENDED = 'criticbox_cache_recommended_v2';
export const CACHE_KEY_REVIEWS = 'criticbox_cache_reviews_v2';
export const CACHE_KEY_NOW_PLAYING = 'criticbox_cache_now_playing_v2';
export const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

export const SERIES_EPISODES_CACHE = {};

export function readSessionCache(key, ttlMs = CACHE_TTL_MS) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - (parsed?.timestamp || 0) < ttlMs) {
      return parsed;
    }
  } catch (e) {}
  return null;
}
