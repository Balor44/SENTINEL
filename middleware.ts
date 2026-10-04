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


  const isPublicRoute = request.nextUrl.pathname === '/login';


  // If there's no user and the route isn't /login, kick them to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }


  // If they are logged in but try to view the login page, send them to the dashboard
  if (user && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/overview';
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


