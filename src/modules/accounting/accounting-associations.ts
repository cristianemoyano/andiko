import 'server-only'
import Branch from '@/modules/auth/branch.model'
import JournalEntryLine from './journal-entry-line.model'

let registered = false

/** Lazily registers cross-module associations used by accounting includes. */
export function ensureAccountingAssociations(): void {
  if (registered) return
  registered = true
  if (!JournalEntryLine.associations.branch) {
    JournalEntryLine.belongsTo(Branch, { foreignKey: 'branch_id', as: 'branch' })
  }
}
