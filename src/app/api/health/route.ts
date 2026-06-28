import { NextResponse } from 'next/server'
import sequelize from '@/lib/db'

export async function GET() {
  try {
    await sequelize.authenticate()
    return NextResponse.json({ status: 'ok', db: 'connected' })
  } catch {
    return NextResponse.json({ status: 'degraded', db: 'disconnected' }, { status: 503 })
  }
}
