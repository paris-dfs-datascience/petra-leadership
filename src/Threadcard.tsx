import { useState } from "react"
import { Thread, FLAG_CONFIG } from "./types"
import { Dot, SeverityDot } from "./components"

interface Props {
  thread: Thread
}

export function ThreadCard({ thread }: Props) {
  const [open, setOpen] = useState(false)
  const flagCfg = FLAG_CONFIG[thread.flag]

  return (
    <div style={{ border: `1px solid ${flagCfg.border}`, borderRadius: 10, background: flagCfg.bg, marginBottom: 8, overflow: "hidden" }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ marginTop: 5 }}>
          <Dot color={flagCfg.color} size={8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{thread.subject}</span>
            <SeverityDot severity={thread.severity} />
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#555", lineHeight: 1.5 }}>{thread.summary}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "#888" }}>{thread.email_count} emails</span>
          <span style={{ fontSize: 12, color: "#999", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▾</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: "0 14px 12px", borderTop: `1px solid ${flagCfg.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            <div>
              <p style={{ fontSize: 11, color: "#888", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date range</p>
              <p style={{ fontSize: 13, color: "#333", margin: 0 }}>{thread.date_range}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#888", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Participants</p>
              <p style={{ fontSize: 12, color: "#333", margin: 0 }}>{thread.participants.join(", ") || "—"}</p>
            </div>
          </div>

          {thread.action_required && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #E5E7EB" }}>
              <p style={{ fontSize: 11, color: "#888", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Action required</p>
              <p style={{ fontSize: 13, color: "#111", margin: 0, fontWeight: 500 }}>{thread.action_required}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}