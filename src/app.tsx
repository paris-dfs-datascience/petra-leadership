import { useState, useEffect } from "react"
import { WeeklyReport, Flag, FLAG_CONFIG } from "./types"
import { MetricCard, FilterBar } from "./components"
import { ClientRow } from "./ClientRow"
import { ClientDetail } from "./ClientDetail"
import { SAMPLE_DATA } from "./sampleData"

export default function App() {
  const [data, setData] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | Flag>("all")

  useEffect(() => {
    const reportUrl = import.meta.env.VITE_REPORT_URL

    if (reportUrl) {
      fetch(reportUrl)
        .then(r => r.json())
        .then((d: WeeklyReport) => { setData(d); setLoading(false) })
        .catch(err => { setError(err.message); setLoading(false) })
    } else {
      // Fall back to sample data in development
      setData(SAMPLE_DATA)
      setLoading(false)
    }
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 14, color: "#9CA3AF" }}>Loading report...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 14, color: "#DC2626" }}>Failed to load report: {error}</p>
      </div>
    )
  }

  const filtered = filter === "all" ? data.clients : data.clients.filter(c => c.flag === filter)

  if (selected) {
    const client = data.clients.find(c => c.domain === selected)
    if (!client) return null
    return (
      <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px" }}>
          <ClientDetail client={client} onBack={() => setSelected(null)} />
        </div>
      </div>
    )
  }

  const filterOptions = [
    { value: "all", label: "All clients" },
    { value: "issue", label: FLAG_CONFIG.issue.label },
    { value: "fyi", label: FLAG_CONFIG.fyi.label },
    { value: "routine", label: FLAG_CONFIG.routine.label },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px" }}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" }}>
              Client Intelligence
            </h1>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>
              {new Date(data.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {data.date_range}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: "#6B7280" }}>
            Weekly digest of client communications across Teams and Outlook
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
          <MetricCard label="Needs attention" value={data.needs_attention} accent />
          <MetricCard label="Clients monitored" value={data.total_clients} />
          <MetricCard label="Emails analyzed" value={data.clients.reduce((s, c) => s + c.total_emails, 0)} />
        </div>

        <FilterBar
          options={filterOptions}
          active={filter}
          onChange={(v) => setFilter(v as "all" | Flag)}
        />

        {filtered.map(client => (
          <ClientRow key={client.domain} client={client} onClick={() => setSelected(client.domain)} />
        ))}

      </div>
    </div>
  )
}