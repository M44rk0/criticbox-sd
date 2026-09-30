import { API_BASE } from '../utils/constants';

const _inflight = new Map();

async function _doFetch(url, options, headers) {
  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('criticbox_token');
    localStorage.removeItem('criticbox_user');
    window.dispatchEvent(new CustomEvent('criticbox:unauthorized'));
  }

  let data = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  }

  if (!res.ok) {
    const errorMsg =
      data?.detail ||
      (data?.erros ? data.erros.map((e) => e.mensagem).join(', ') : null) ||
      `Erro na requisição (${res.status})`;
    const error = new Error(errorMsg);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function apiFetch(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const url = `${API_BASE}${endpoint}`;
  const headers = { ...options.headers };

  const token = localStorage.getItem('criticbox_token');
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  // Deduplica requisições GET simultâneas em trânsito
  if (method === 'GET') {
    const key = `${url}::${token || ''}`;
    if (_inflight.has(key)) {
      return _inflight.get(key);
    }
    const promise = _doFetch(url, options, headers).finally(() => {
      _inflight.delete(key);
    });
    _inflight.set(key, promise);
    return promise;
  }

  return _doFetch(url, options, headers);
}
