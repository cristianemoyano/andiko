import 'server-only'
import { NextResponse } from 'next/server'
import { BranchWarehouseResolutionError } from '@/modules/inventory/branch-warehouse.resolution'

export function branchWarehouseResolutionResponse(err: unknown): NextResponse | null {
  if (!(err instanceof BranchWarehouseResolutionError)) return null
  return NextResponse.json(
    { error: err.message, code: err.code },
    { status: 422 },
  )
}
