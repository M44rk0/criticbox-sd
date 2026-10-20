import { API_BASE } from '../utils/constants';

const _inflight = new Map();
let _inMemoryToken = '';

try {
  _inMemoryToken = localStorage.getItem('criticbox_token') || '';
} catch (e) {}

export function setClientToken(token) {
  _inMemoryToken = token || '';
  try {
    if (token) {
      localStorage.setItem('criticbox_token', token);
    } else {
      localStorage.removeItem('criticbox_token');
    }
  } catch (e) {}
}

export function getClientToken() {
  if (_inMemoryToken) return _inMemoryToken;
  try {
    _inMemoryToken = localStorage.getItem('criticbox_token') || '';
    return _inMemoryToken;
  } catch (e) {
    return '';
  }
}

async function _doFetch(url, options, headers) {
  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    console.warn('[Criticbox:API] 401 Não autorizado em:', url);
    setClientToken('');
    try {
      localStorage.removeItem('criticbox_user');
      localStorage.removeItem('criticbox_user_id');
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('criticbox:unauthorized'));
  }

  let data = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  }

  if (!res.ok) {
    console.error(`[Criticbox:API] Falha HTTP ${res.status} em ${url}:`, data);
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

  const token = getClientToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log(`[Criticbox:API] ${method} ${url}`, { hasToken: Boolean(token) });

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
