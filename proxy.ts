import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { AUTH_ROUTE_PREFIXES, PLATFORM_ROUTE_PREFIXES, ROUTES } from '@/lib/constants/routes'

function isPlatformRoute(pathname: string): boolean {
  return PLATFORM_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (!user && isPlatformRoute(pathname)) {
    const loginUrl = new URL(ROUTES.AUTH.LOGIN, request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && isAuthRoute(pathname)) {
    return NextResponse.redirect(new URL(ROUTES.DASHBOARD, request.url))
  }

  if (pathname === ROUTES.ROOT) {
    if (user) {
      return NextResponse.redirect(new URL(ROUTES.DASHBOARD, request.url))
    }
    return NextResponse.redirect(new URL(ROUTES.AUTH.LOGIN, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
}
