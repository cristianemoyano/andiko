export interface ScheduledTaskRow {
  id: string
  name: string
  description: string | null
  branch_id: string | null
  action_type: string
  payload: Record<string, unknown>
  cron_expression: string
  timezone: string
  status: 'active' | 'paused' | 'disabled'
  next_run_at: string
  last_run_at: string | null
  last_run_status: 'success' | 'failed' | 'skipped' | null
  consecutive_failures: number
  max_consecutive_failures: number
}

export interface ScheduledTaskRunRow {
  id: string
  status: 'running' | 'success' | 'failed' | 'skipped'
  trigger_kind: 'scheduled' | 'manual'
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  result: Record<string, unknown> | null
  error: string | null
}

export interface AutomationActionOption {
  type: string
  label: string
}
