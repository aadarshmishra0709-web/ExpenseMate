const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch {
    throw new Error('Cannot connect to ExpenseMate Java server. Start the backend on port 8080.');
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}
const json = value => JSON.stringify(value);
export const api = {
  get: resource => request('/' + resource),
  create: (resource, value) => request('/' + resource, { method: 'POST', body: json(value) }),
  update: (resource, id, value) => request('/' + resource + '/' + id, { method: 'PUT', body: json(value) }),
  remove: (resource, id) => request('/' + resource + '/' + id, { method: 'DELETE' }),
  summary: () => request('/summary'),
  contribute: (id, amount) => request('/goals/' + id + '/contribute', { method: 'POST', body: json({ amount }) }),
  exportUrl: BASE + '/transactions/export'
};
