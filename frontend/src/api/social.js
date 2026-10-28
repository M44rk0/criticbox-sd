import { apiFetch } from './client';

const avatarMemoryCache = new Map();

async function hydrateMissingAvatars(users) {
  const list = Array.isArray(users) ? users : [];
  const missingUsernames = [];

  for (const u of list) {
    const uname = (u?.username || '').replace(/^@+/, '').trim();
    if (!uname) continue;
    if (u.avatar_url) {
      avatarMemoryCache.set(uname.toLowerCase(), u.avatar_url);
    } else if (!avatarMemoryCache.has(uname.toLowerCase())) {
      missingUsernames.push(uname);
    }
  }

  if (missingUsernames.length > 0) {
    const uniqueNames = Array.from(new Set(missingUsernames));
    await Promise.all(
      uniqueNames.map(async (uname) => {
        try {
          const prof = await getUserProfile(uname);
          avatarMemoryCache.set(uname.toLowerCase(), prof?.avatar_url || '');
        } catch {
          // Não bloqueia listagem caso o perfil falhe
        }
      })
    );
  }

  return list.map((u) => {
    if (u?.avatar_url) return u;
    const uname = (u?.username || '').replace(/^@+/, '').trim().toLowerCase();
    const cachedAvatar = avatarMemoryCache.get(uname);
    return cachedAvatar ? { ...u, avatar_url: cachedAvatar } : u;
  });
}

export async function searchUsers(query, limit = 10) {
  if (!query || !query.trim()) return [];
  const encoded = encodeURIComponent(query.trim());
  const res = await apiFetch(`/users/search?q=${encoded}&limit=${limit}`);
  return hydrateMissingAvatars(res);
}

export async function getUserProfile(username) {
  if (!username) return null;
  const clean = username.replace(/^@+/, '').trim();
  const encoded = encodeURIComponent(clean);
  const profile = await apiFetch(`/users/${encoded}/profile`);
  if (profile?.username && profile.avatar_url !== undefined) {
    avatarMemoryCache.set(profile.username.toLowerCase(), profile.avatar_url || '');
  }
  return profile;
}

export async function followUser(targetIdOrUsername) {
  const encoded = encodeURIComponent(targetIdOrUsername.trim());
  return apiFetch(`/users/${encoded}/follow`, {
    method: 'POST',
  });
}

export async function unfollowUser(targetIdOrUsername) {
  const encoded = encodeURIComponent(targetIdOrUsername.trim());
  return apiFetch(`/users/${encoded}/follow`, {
    method: 'DELETE',
  });
}

export async function getUserFollowers(username) {
  const clean = (username || '').replace(/^@+/, '').trim();
  const encoded = encodeURIComponent(clean);
  const res = await apiFetch(`/users/${encoded}/followers`);
  return hydrateMissingAvatars(res);
}

export async function getUserFollowing(username) {
  const clean = (username || '').replace(/^@+/, '').trim();
  const encoded = encodeURIComponent(clean);
  const res = await apiFetch(`/users/${encoded}/following`);
  return hydrateMissingAvatars(res);
}

export async function updateUserProfile({ avatar_url, four_pillars }) {
  avatarMemoryCache.clear();
  return apiFetch('/users/profile', {
    method: 'PUT',
    body: JSON.stringify({
      avatar_url: avatar_url || '',
      four_pillars: four_pillars ?? '',
    }),
  });
}
