// Every call to the Flask backend lives here, so the rest of the app never writes a URL.
const BASE = import.meta.env.VITE_API_BASE || '' // empty = same origin, Vite proxies /api to Flask

async function request(path, options) {
  const res = await fetch(BASE + path, options)
  if (!res.ok) {
    let msg = res.statusText
    try { msg = (await res.json()).error || msg } catch { /* not JSON */ }
    throw new Error(msg)
  }
  return res.json()
}

function qs(obj) {
  const p = new URLSearchParams()
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v)
  })
  const s = p.toString()
  return s ? '?' + s : ''
}

export const api = {
  // ---- reference data
  thresholds: () => request('/api/thresholds'),

  // ---- A) live stream replayed from the CSV
  streamWindow: (biomarkers, last = 300) =>
    request('/api/stream/window' + qs({ biomarkers: biomarkers.join(','), last })),
  streamReadings: (since, epoch, biomarkers) =>
    request('/api/stream/readings' + qs({ since, epoch, limit: 2000, biomarkers: biomarkers.join(',') })),
  control: (action, extra = {}) =>
    request('/api/stream/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    }),

  // ---- B) results written to health.db by monitor.py ;)
  alerts: (params = {}) => request('/api/alerts' + qs(params)),
  dailySummary: () => request('/api/daily/summary'),
  dailyReport: (day) => request(day === 'latest' ? '/api/daily/latest' : `/api/daily/${day}`),
  biomarkerDaily: (name) => request(`/api/biomarker/${name}/daily`),
}
