import { useEffect, useState } from 'react'
import { api } from './api'

// Calls fn() now and then every intervalMs. Returns { data, error }.
// Pass `deps` = values that, when changed, should restart the polling (like a day number).
export function usePolling(fn, intervalMs, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const d = await fn()
        if (alive) { setData(d); setError(null) }
      } catch (e) {
        if (alive) setError(e)
      }
    }
    tick()
    const id = setInterval(tick, intervalMs)
    return () => { alive = false; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { data, error }
}

// Live readings: first fills the charts with the recent past, then every second asks
// the server and appends it.
export function useLiveStream(biomarkers, keep = 300) {
  const [series, setSeries] = useState({}) // { biomarker: [{i, t, day, value}, ...] }
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const key = biomarkers.join(',')

  useEffect(() => {
    if (!biomarkers.length) { setSeries({}); return undefined }
    let alive = true
    let cursor = 0
    let epoch = null
    const toPoint = (r) => ({ i: r.i, t: r.timestamp_utc, day: r.mission_day, value: r.value })

    const load = async () => {
      const w = await api.streamWindow(biomarkers, keep)
      if (!alive) return
      const s = {}
      biomarkers.forEach((b) => { s[b] = (w.series[b] || []).map(toPoint) })
      setSeries(s)
      setStatus(w)
      cursor = w.next_cursor
      epoch = w.epoch
    }

    const tick = async () => {
      try {
        if (epoch === null) { await load(); setError(null); return }
        const r = await api.streamReadings(cursor, epoch, biomarkers)
        if (!alive) return
        setStatus(r)
        setError(null)
        if (r.restarted) { await load(); return } // tape rewound / jumped: start the charts over
        cursor = r.next_cursor
        if (r.rows.length) {
          setSeries((prev) => {
            const next = { ...prev }
            const grouped = {}
            r.rows.forEach((row) => { (grouped[row.biomarker] ||= []).push(toPoint(row)) })
            Object.entries(grouped).forEach(([b, pts]) => { next[b] = (next[b] || []).concat(pts).slice(-keep) })
            return next
          })
        }
      } catch (e) {
        if (alive) setError(e)
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => { alive = false; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, keep])

  return { series, status, error }
}
