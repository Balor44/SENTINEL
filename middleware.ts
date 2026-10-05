import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';


export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });


  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );


  // Check if the user is authenticated
  const { data: { user } } = await supabase.auth.getUser();


  // 1. Expanded Public Routes List
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = 
    pathname === '/' || 
    pathname.startsWith('/login') || 
    pathname.startsWith('/auth') || 
    pathname.startsWith('/api/auth');


  // 2. Unauthenticated user trying to access protected routes -> send to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Save the route they were trying to access so we can send them there after login
    url.searchParams.set('redirect', pathname); 
    return NextResponse.redirect(url);
  }


  // 3. Logged-in user visiting /login -> send them to the app
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    // Defaulting to /setup so first-time users finish onboarding. 
    // Your setup route should automatically forward them to /overview if they are already onboarded!
    url.pathname = '/setup'; 
    return NextResponse.redirect(url);
  }


  return supabaseResponse;
}


// Ensure middleware runs on all pages except static files and images
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};


