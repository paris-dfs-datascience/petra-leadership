import { Flag, Severity, FLAG_CONFIG, SEVERITY_CONFIG } from "./types"

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0 }} />
  )
}

export function Badge({ flag }: { flag: Flag }) {
  const cfg = FLAG_CONFIG[flag]
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, letterSpacing: "0.02em" }}>
      {cfg.label}
    </span>
  )
}

export function SeverityDot({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity]
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: cfg.color, fontWeight: 500 }}>
      <Dot color={cfg.color} size={6} />
      {cfg.label}
    </span>
  )
}

export function Avatar({ name }: { name: string }) {
  return (
    <div style={{ width: 38, height: 38, borderRadius: 9, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, color: "#374151", flexShrink: 0 }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

export function MetricCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{ background: accent ? "#FEF2F2" : "#F9FAFB", border: `1px solid ${accent ? "#FECACA" : "#F3F4F6"}`, borderRadius: 12, padding: "14px 18px" }}>
      <p style={{ margin: "0 0 4px", fontSize: 10, color: accent ? "#DC2626" : "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 30, fontWeight: 700, color: accent ? "#DC2626" : "#111" }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  )
}

export function FilterBar({ options, active, onChange }: { options: { value: string; label: string }[]; active: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid", fontSize: 12, fontWeight: 500, cursor: "pointer", borderColor: active === o.value ? "#111" : "#E5E7EB", background: active === o.value ? "#111" : "#fff", color: active === o.value ? "#fff" : "#555", transition: "all 0.15s" }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}