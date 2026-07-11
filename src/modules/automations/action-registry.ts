import 'server-only'
import type { ZodType } from 'zod'

export interface AutomationActionContext {
  orgId: string
  branchId: string | null
  taskId: string
  runId: string
  /**
   * Aborted when the action exceeds its wall-clock timeout. Actions that make
   * cancellable I/O (fetch, etc.) should honor it so the underlying work actually
   * stops instead of continuing in the background after being recorded as failed.
   * Best-effort: not every operation (e.g. an in-flight DB transaction) can be
   * preempted from JS-level cancellation.
   */
  signal: AbortSignal
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
  // In dev, Next.js Fast Refresh can re-execute an action's module (and this barrel)
  // without resetting this in-memory registry, so re-registering the same type is
  // expected there. Outside dev, a duplicate type is a genuine programmer error.
  if (registry.has(def.type) && process.env.NODE_ENV !== 'development') {
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
