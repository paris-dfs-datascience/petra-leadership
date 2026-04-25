import { useState, useEffect, useMemo } from "react"
import { WeeklyReport, Flag, FLAG_CONFIG } from "./types"
import { ClientRow } from "./clientrow"
import { ClientDetail } from "./Clientdetail"
import { SAMPLE_DATA } from "./sampleData"

type FilterValue = "all" | Flag

export default function App() {
  const [data, setData] = useState<WeeklyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterValue>("all")
  const [query, setQuery] = useState("")

  useEffect(() => {
    const reportUrl = import.meta.env.VITE_REPORT_URL
    if (reportUrl) {
      fetch(reportUrl)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        })
        .then((d: WeeklyReport) => { setData(d); setLoading(false) })
        .catch(err => { setError(err.message); setLoading(false) })
    } else {
      setData(SAMPLE_DATA)
      setLoading(false)
    }
  }, [])

  const filteredClients = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.clients.filter(c => {
      if (filter !== "all" && c.flag !== filter) return false
      if (q && !c.client_name.toLowerCase().includes(q) && !c.domain.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, filter, query])

  useEffect(() => {
    if (filteredClients.length === 0) {
      setSelected(null)
      return
    }
    if (!selected || !filteredClients.find(c => c.domain === selected)) {
      setSelected(filteredClients[0].domain)
    }
  }, [filteredClients, selected])

  if (loading) {
    return (
      <FullBleed>
        <p style={{ fontSize: 14, color: "#9CA3AF" }}>Loading report…</p>
      </FullBleed>
    )
  }

  if (error || !data) {
    return (
      <FullBleed>
        <p style={{ fontSize: 14, color: "#DC2626" }}>Failed to load report: {error ?? "no data"}</p>
      </FullBleed>
    )
  }

  const selectedClient = selected ? data.clients.find(c => c.domain === selected) ?? null : null

  const filterOptions: { value: FilterValue; label: string; count: number }[] = [
    { value: "all",     label: "All",                       count: data.clients.length },
    { value: "issue",   label: FLAG_CONFIG.issue.label,     count: data.clients.filter(c => c.flag === "issue").length },
    { value: "fyi",     label: FLAG_CONFIG.fyi.label,       count: data.clients.filter(c => c.flag === "fyi").length },
    { value: "routine", label: FLAG_CONFIG.routine.label,   count: data.clients.filter(c => c.flag === "routine").length },
  ]

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      width: "100vw",
      background: "#fff",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      color: "#111",
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 320,
        flexShrink: 0,
        borderRight: "1px solid #F3F4F6",
        display: "flex",
        flexDirection: "column",
        background: "#FAFAFA",
      }}>
        <div style={{ padding: "20px 20px 12px", borderBottom: "1px solid #F3F4F6" }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Client Intelligence
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9CA3AF" }}>
            {new Date(data.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {" · "}{data.date_range}
          </p>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients…"
            style={{
              marginTop: 12,
              width: "100%",
              padding: "7px 10px",
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: "#fff",
              outline: "none",
              fontFamily: "inherit",
            }}
          />

          <div style={{ display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
            {filterOptions.map(o => {
              const active = filter === o.value
              return (
                <button
                  key={o.value}
                  onClick={() => setFilter(o.value)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 14,
                    border: "1px solid",
                    borderColor: active ? "#111" : "#E5E7EB",
                    background: active ? "#111" : "#fff",
                    color: active ? "#fff" : "#555",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {o.label}
                  <span style={{ marginLeft: 5, opacity: 0.7 }}>{o.count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
          {filteredClients.length === 0 ? (
            <p style={{ color: "#9CA3AF", fontSize: 13, padding: 20, textAlign: "center" }}>
              No clients match.
            </p>
          ) : (
            filteredClients.map(c => (
              <ClientRow
                key={c.domain}
                client={c}
                active={c.domain === selected}
                onClick={() => setSelected(c.domain)}
              />
            ))
          )}
        </div>

        <div style={{
          padding: "10px 20px",
          borderTop: "1px solid #F3F4F6",
          fontSize: 11,
          color: "#9CA3AF",
          display: "flex",
          justifyContent: "space-between",
        }}>
          <span>{data.total_clients} clients</span>
          <span style={{ color: data.needs_attention > 0 ? "#DC2626" : "#9CA3AF", fontWeight: 500 }}>
            {data.needs_attention} need attention
          </span>
        </div>
      </aside>

      {/* Main panel */}
      <main style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 32px 48px" }}>
          {selectedClient ? (
            <ClientDetail client={selectedClient} />
          ) : (
            <div style={{ color: "#9CA3AF", fontSize: 14, padding: "80px 0", textAlign: "center" }}>
              Select a client on the left.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function FullBleed({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    }}>
      {children}
    </div>
  )
}
