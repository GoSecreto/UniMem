const BASE = '';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getProjects: () => fetchJson<string[]>('/api/projects'),
  getStatus: (project?: string) =>
    fetchJson<any>(`/api/status${project ? `?project=${encodeURIComponent(project)}` : ''}`),
  getSessions: (project: string) =>
    fetchJson<any[]>(`/api/sessions?project=${encodeURIComponent(project)}`),
  getObservations: (project: string, limit = 50) =>
    fetchJson<any[]>(`/api/observations?project=${encodeURIComponent(project)}&limit=${limit}`),
  search: (query: string, project?: string) =>
    fetchJson<any[]>(`/api/search?query=${encodeURIComponent(query)}${project ? `&project=${encodeURIComponent(project)}` : ''}`),
  getHandoffs: (project: string) =>
    fetchJson<any[]>(`/api/handoffs?project=${encodeURIComponent(project)}`),
  getSummaries: (project: string) =>
    fetchJson<any[]>(`/api/summaries?project=${encodeURIComponent(project)}`),

  // Token endpoints
  getTokenSummary: (days = 30) =>
    fetchJson<any[]>(`/api/tokens/summary?days=${days}`),
  getDailyTokens: (days = 30) =>
    fetchJson<any[]>(`/api/tokens/daily?days=${days}`),
  getTokensByCli: (cli: string, days = 30) =>
    fetchJson<any[]>(`/api/tokens/by-cli?cli=${encodeURIComponent(cli)}&days=${days}`),
  syncTokens: () => postJson<any>('/api/tokens/sync'),
};
