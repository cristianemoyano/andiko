import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth']

export const proxy = auth((req) => {
  const isPublic = PUBLIC_PATHS.some((path) => req.nextUrl.pathname.startsWith(path))
  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
