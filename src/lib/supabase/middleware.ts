import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_AUTH_COOKIE_NAME } from './config';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: SUPABASE_AUTH_COOKIE_NAME,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() verifies the JWT locally against the project's public
  // signing key (fetched once and cached) instead of calling the Supabase
  // Auth server on every request the way getUser() does — this removes a
  // network round trip from every single page load and prefetch. The
  // trade-off: a session revoked server-side (e.g. password change,
  // manual revoke) stays technically valid here until the access token
  // itself expires (~1h), rather than being caught on the very next
  // request. The user_sessions expiry check right below is unaffected —
  // it still hits the DB and remains the authoritative, un-spoofable cap
  // for both public-device (15 min) and trusted (30 day) sessions.
  const {
    data: claims,
  } = await supabase.auth.getClaims();
  const user = claims ? { id: claims.claims.sub } : null;

  // --- Server-enforced session expiry ---
  // Read the authoritative expires_at from public.user_sessions (RLS lets the
  // user SELECT their own row only). Both public-device (15 min) and trusted
  // (30 day) session caps live there — no user_metadata involvement, so a
  // client can't tamper with their own expiry.
  //
  // If the row is missing (legacy users from before this migration) we leave
  // the user signed in — the next login pass will populate the row. If it
  // exists and is past, we force a sign-out.
  if (user) {
    const { data: sessionRow } = await supabase
      .from('user_sessions')
      .select('expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (sessionRow?.expires_at && new Date(sessionRow.expires_at).getTime() < Date.now()) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('reason', 'session_expired');
      const redirectResponse = NextResponse.redirect(url);
      redirectResponse.cookies.set(SUPABASE_AUTH_COOKIE_NAME, '', {
        maxAge: 0,
        path: '/',
      });
      return redirectResponse;
    }
  }

  // Protected routes – redirect to login if not authenticated
  // Public exceptions: /login, /auth, and /api/profile (visitor-facing profile card)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/api/profile')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
