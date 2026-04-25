import { useState } from "react"
import { Client, FLAG_CONFIG } from "./types"

interface Props {
  client: Client
  active: boolean
  onClick: () => void
}

export function ClientRow({ client, active, onClick }: Props) {
  const [hovered, setHovered] = useState(false)
  const flagCfg = FLAG_CONFIG[client.flag]

  const background = active ? "#fff" : hovered ? "#F3F4F6" : "transparent"
  const border = active ? "#E5E7EB" : "transparent"

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        border: `1px solid ${border}`,
        background,
        cursor: "pointer",
        marginBottom: 2,
        transition: "background 0.12s",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
      }}
    >
      <span
        title={flagCfg.label}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: flagCfg.color,
          flexShrink: 0,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: active ? 600 : 500,
          color: "#111",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {client.client_name}
        </div>
        <div style={{
          fontSize: 11,
          color: "#9CA3AF",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          {client.domain}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
        {client.issue_count > 0 && (
          <Pill color={FLAG_CONFIG.issue.color} bg={FLAG_CONFIG.issue.bg} border={FLAG_CONFIG.issue.border}>
            {client.issue_count}
          </Pill>
        )}
        {client.fyi_count > 0 && (
          <Pill color={FLAG_CONFIG.fyi.color} bg={FLAG_CONFIG.fyi.bg} border={FLAG_CONFIG.fyi.border}>
            {client.fyi_count}
          </Pill>
        )}
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>{client.total_emails}</span>
      </div>
    </div>
  )
}

function Pill({ color, bg, border, children }: {
  color: string
  bg: string
  border: string
  children: React.ReactNode
}) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      padding: "1px 6px",
      borderRadius: 10,
      color,
      background: bg,
      border: `1px solid ${border}`,
      minWidth: 18,
      textAlign: "center",
    }}>
      {children}
    </span>
  )
}
