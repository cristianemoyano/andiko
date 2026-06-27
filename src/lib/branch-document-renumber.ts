import type { Transaction } from 'sequelize'

export const DOCUMENT_BRANCH_NOT_CHANGEABLE = 'DOCUMENT_BRANCH_NOT_CHANGEABLE'
export const DOCUMENT_BRANCH_NOT_CHANGEABLE_MESSAGE =
  'La sucursal solo se puede cambiar en documentos en borrador.'

/** Throws when branch cannot be changed for the current document status. */
export function assertDraftBranchChange(status: string, draftStatus = 'draft'): void {
  if (status !== draftStatus) throw new Error(DOCUMENT_BRANCH_NOT_CHANGEABLE)
}

/**
 * When branch_id changes, returns a patch with the new branch and the next
 * document number for that branch. Returns {} when branch is unchanged/absent.
 */
export async function buildBranchRenumberPatch(params: {
  orgId: string
  currentBranchId: string | null
  nextBranchId: string | undefined
  numberField: string
  resolveNextNumber: (orgId: string, branchId: string, t: Transaction) => Promise<string>
  t: Transaction
}): Promise<Record<string, unknown>> {
  const { orgId, currentBranchId, nextBranchId, numberField, resolveNextNumber, t } = params
  if (!nextBranchId || nextBranchId === currentBranchId) return {}

  const nextNumber = await resolveNextNumber(orgId, nextBranchId, t)
  return { branch_id: nextBranchId, [numberField]: nextNumber }
}
