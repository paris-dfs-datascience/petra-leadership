export type Flag = "issue" | "fyi" | "routine"
export type Severity = "high" | "medium" | "low"

export interface Thread {
  thread_id: string
  subject: string
  flag: Flag
  severity: Severity
  summary: string
  action_required: string | null
  participants: string[]
  date_range: string
  email_count: number
}

export interface Client {
  domain: string
  client_name: string
  total_emails: number
  total_threads: number
  flag: Flag
  severity: Severity
  last_activity: string
  issue_count: number
  fyi_count: number
  routine_count: number
  issues: Thread[]
  fyi: Thread[]
  routine: Thread[]
}

export interface WeeklyReport {
  generated_at: string
  run_date: string
  date_range: string
  total_clients: number
  needs_attention: number
  clients: Client[]
}

export const FLAG_CONFIG: Record<Flag, { color: string; bg: string; border: string; label: string }> = {
  issue:   { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "Issue" },
  fyi:     { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "FYI" },
  routine: { color: "#059669", bg: "#F0FDF4", border: "#BBF7D0", label: "Routine" },
}

export const SEVERITY_CONFIG: Record<Severity, { color: string; label: string }> = {
  high:   { color: "#DC2626", label: "High" },
  medium: { color: "#D97706", label: "Medium" },
  low:    { color: "#059669", label: "Low" },
}