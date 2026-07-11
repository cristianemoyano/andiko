import 'server-only'

// Side-effect-only barrel: importing this file registers every built-in
// automation action. New action types are added by creating a `*.action.ts`
// file that calls `registerAutomationAction` and importing it here — the
// scheduler core (action-registry.ts, scheduled-task-runner.service.ts)
// never needs to change.
import './sales-expire-quotes.action'
import './webhook-call.action'
