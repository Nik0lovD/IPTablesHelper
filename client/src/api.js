const API = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export const api = {
  login: (username, password) =>
    request('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request('/logout', { method: 'POST' }),
  me: () => request('/me'),
  status: () => request('/status'),
  getForwards: () => request('/forwards'),
  createForward: (body) =>
    request('/forwards', { method: 'POST', body: JSON.stringify(body) }),
  updateForward: (id, body) =>
    request(`/forwards/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteForward: (id) => request(`/forwards/${id}`, { method: 'DELETE' }),
  getSettings: () => request('/settings'),
  updateSettings: (body) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(body) }),
  updateCredentials: (body) =>
    request('/credentials', { method: 'PUT', body: JSON.stringify(body) }),
  resync: () => request('/resync', { method: 'POST' }),
};
