import 'server-only'
import type { ZodType } from 'zod'

export interface AutomationActionContext {
  orgId: string
  branchId: string | null
  taskId: string
  runId: string
}

export interface AutomationActionResult {
  summary?: string
  data?: Record<string, unknown>
}

export interface AutomationActionDef<TPayload = unknown> {
  /** Registry key, e.g. 'sales.expire_overdue_quotes'. Stored verbatim in scheduled_tasks.action_type. */
  type: string
  /** UI display name. */
  label: string
  /** Validated against scheduled_tasks.payload before every run. */
  payloadSchema: ZodType<TPayload>
  run: (ctx: AutomationActionContext, payload: TPayload) => Promise<AutomationActionResult>
}

const registry = new Map<string, AutomationActionDef>()

export function registerAutomationAction<TPayload>(def: AutomationActionDef<TPayload>): void {
  if (registry.has(def.type)) {
    throw new Error(`Automation action already registered: ${def.type}`)
  }
  registry.set(def.type, def as AutomationActionDef)
}

export function getAutomationAction(type: string): AutomationActionDef | undefined {
  return registry.get(type)
}

export function listAutomationActions(): AutomationActionDef[] {
  return Array.from(registry.values())
}
