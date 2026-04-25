import { useState } from "react"
import { Client, Flag, FLAG_CONFIG } from "./types"
import { Badge, FilterBar } from "./components"
import { ThreadCard } from "./ThreadCard"

interface Props {
  client: Client
  onBack: () => void
}

export function ClientDetail({ client, onBack }: Props) {
  const [filter, setFilter] = useState<"all" | Flag>("all")
  const allThreads = [...client.issues, ...client.fyi, ...client.routine]
  const filtered = filter === "all" ? allThreads : allThreads.filter(t => t.flag === filter)

  const filterOptions = [
    { value: "all", label: `All (${allThreads.length})` },
    { value: "issue", label: `${FLAG_CONFIG.issue.label} (${client.issue_count})` },
    { value: "fyi", label: `${FLAG_CONFIG.fyi.label} (${client.fyi_count})` },
    { value: "routine", label: `${FLAG_CONFIG.routine.label} (${client.routine_count})` },
  ]

  return (
    <div>
      <button
        onClick={onBack}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#6B7280", padding: "0 0 20px", display: "flex", alignItems: "center", gap: 4 }}
      >
        ← Back to all clients
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 16, color: "#374151" }}>
          {client.client_name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111" }}>{client.client_name}</h2>
          <span style={{ fontSize: 13, color: "#6B7280" }}>{client.domain}</span>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Badge flag={client.flag} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {([
          { label: "Total emails", value: client.total_emails },
          { label: "Threads", value: client.total_threads },
          { label: "Issues", value: client.issue_count },
          { label: "Last activity", value: client.last_activity },
        ] as const).map(m => (
          <div key={m.label} style={{ background: "#F9FAFB", borderRadius: 10, padding: "12px 14px", border: "1px solid #F3F4F6" }}>
            <p style={{ fontSize: 10, color: "#9CA3AF", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#111", margin: 0 }}>{m.value}</p>
          </div>
        ))}
      </div>

      <FilterBar
        options={filterOptions}
        active={filter}
        onChange={(v) => setFilter(v as "all" | Flag)}
      />

      {filtered.length === 0 ? (
        <p style={{ color: "#9CA3AF", fontSize: 14, textAlign: "center", padding: "40px 0" }}>No threads in this category.</p>
      ) : (
        filtered.map(t => <ThreadCard key={t.thread_id} thread={t} />)
      )}
    </div>
  )
}