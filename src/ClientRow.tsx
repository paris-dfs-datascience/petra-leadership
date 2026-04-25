import { useState } from "react"
import { Client } from "./types"
import { Badge } from "./components"

interface Props {
  client: Client
  onClick: () => void
}

export function ClientRow({ client, onClick }: Props) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
        borderRadius: 12, border: `1px solid ${hovered ? "#E5E7EB" : "#F3F4F6"}`,
        background: "#fff", cursor: "pointer",
        boxShadow: hovered ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
        marginBottom: 8, transition: "all 0.15s"
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 9, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, color: "#374151", flexShrink: 0 }}>
        {client.client_name.slice(0, 2).toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{client.client_name}</span>
          <Badge flag={client.flag} />
        </div>
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>{client.domain}</span>
      </div>

      <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
        {([
          { val: client.issue_count, label: "Issues", color: client.issue_count > 0 ? "#DC2626" : "#9CA3AF" },
          { val: client.fyi_count,   label: "FYI",    color: client.fyi_count   > 0 ? "#D97706" : "#9CA3AF" },
          { val: client.total_emails, label: "Emails", color: "#9CA3AF" },
        ] as const).map(m => (
          <div key={m.label} style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: m.color }}>{m.val}</p>
            <p style={{ margin: 0, fontSize: 10, color: "#9CA3AF" }}>{m.label}</p>
          </div>
        ))}
        <div style={{ textAlign: "center", minWidth: 72 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{client.last_activity}</p>
          <p style={{ margin: 0, fontSize: 10, color: "#9CA3AF" }}>Last active</p>
        </div>
      </div>

      <span style={{ color: "#D1D5DB", fontSize: 18 }}>›</span>
    </div>
  )
}