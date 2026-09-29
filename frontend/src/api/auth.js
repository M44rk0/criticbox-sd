import { apiFetch } from './client';

export async function loginUser(username, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: { username: username.trim(), password },
  });
}

export async function registerUser(username, password) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: { username: username.trim(), password },
  });
}
