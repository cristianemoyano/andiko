import NextAuth from 'next-auth'
import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'
import { flushPostHogLogs } from '../instrumentation'

const { auth } = NextAuth(authConfig)

export const proxy = auth((req) => {
  after(async () => {
    await flushPostHogLogs()
  })

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', req.nextUrl.pathname)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
