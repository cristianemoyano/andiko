import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import PosDevice from '@/modules/pos/pos-device.model'

export type PosDeviceContext = {
  deviceId: string
  orgId: string
  branchId: string | null
  deviceRowId: string
}

export type PosRouteHandler = (
  req: NextRequest,
  ctx: PosDeviceContext,
) => Promise<NextResponse>

/** Authenticates a POS request via Bearer token in Authorization header. */
export function withPosDevice(handler: PosRouteHandler) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const auth = req.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const device = await PosDevice.findOne({
      where: { api_token: token, is_active: true, deleted_at: null },
    })

    if (!device) {
      return NextResponse.json({ error: 'Invalid device token', code: 'INVALID_TOKEN' }, { status: 401 })
    }

    // Bump last_seen_at without blocking the response
    device.update({ last_seen_at: new Date() }).catch(() => undefined)

    return handler(req, {
      deviceId: device.device_id,
      orgId: device.org_id,
      branchId: device.branch_id,
      deviceRowId: device.id,
    })
  }
}
