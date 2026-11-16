import { useMemo, useState } from 'react'
import { api } from './api'
import { usePolling, useLiveStream } from './hooks'
import Controls from './components/Controls'
import LiveCharts from './components/LiveCharts'
import BodyMap from './components/BodyMap'
import ConditionDetail from './components/ConditionDetail'
import AlertFeed from './components/AlertFeed'
import DailyReport from './components/DailyReport'

const DEFAULT_LIVE = ['bpm_resting', 'hrv', 'absorbed_dose_msv', 'body_temp']

export default function App() {
  const [liveBios, setLiveBios] = useState(DEFAULT_LIVE)
  const [selectedDay, setSelectedDay] = useState(null) 
  const [selectedCond, setSelectedCond] = useState(null)

  // reference data: normal / critical limits per biomarker
  const thresholds = usePolling(() => api.thresholds(), 60000, []).data
  const limits = useMemo(() => Object.fromEntries((thresholds || []).map((t) => [t.name, t])), [thresholds])

  // A) live readings from the CSV
  const { series, status, error: liveError } = useLiveStream(liveBios)

  // B) results from health.db
  const summary = usePolling(() => api.dailySummary(), 4000, []).data
  const { data: report, error: reportError } = usePolling(
    () => api.dailyReport(selectedDay === null ? 'latest' : selectedDay), 3000, [selectedDay],
  )

  // condition -> level for the body map (a forecast alert upgrades NORMAL to WATCH)
  const levels = useMemo(() => {
    const out = {}
    ;(report?.conditions || []).forEach((c) => { out[c.condition] = c.level })
    ;(report?.alerts || []).forEach((a) => {
      if (a.kind === 'RISK_FORECAST' && out[a.subject] === 'NORMAL') out[a.subject] = 'WATCH'
    })
    return out
  }, [report])

  const toggleBio = (name) => setLiveBios((cur) => (cur.includes(name) ? cur.filter((b) => b !== name) : [...cur, name]))
  const control = (action, extra) => api.control(action, extra).catch(() => {})

  return (
    <div className="app">
      <header>
        <h1>Astronaut Health Monitor</h1>
        <Controls status={status} onAction={control} />
      </header>
      {liveError && <div className="banner">Cannot reach the API ({liveError.message}). Is <code>python api.py</code> running?</div>}

      <section className="panel body">
        <h2>Body map</h2>
        <BodyMap levels={levels} selected={selectedCond} onSelect={setSelectedCond} />
        <ConditionDetail cond={selectedCond} level={levels[selectedCond]} report={report} />
      </section>

      <section className="panel live">
        <h2>Live sensors <span className="muted">(replayed from the CSV)</span></h2>
        <div className="picker">
          {(thresholds || []).map((t) => (
            <button key={t.name} className={'chip' + (liveBios.includes(t.name) ? ' chip-on' : '')} onClick={() => toggleBio(t.name)}>{t.name}</button>
          ))}
        </div>
        <LiveCharts biomarkers={liveBios} series={series} limits={limits} />
      </section>

      <section className="panel feed-panel">
        <h2>Alerts <span className="muted">(from the database)</span></h2>
        <AlertFeed />
      </section>

      <section className="panel daily">
        <DailyReport
          summary={summary}
          report={report}
          error={reportError}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onSelectCondition={setSelectedCond}
        />
      </section>
    </div>
  )
}
