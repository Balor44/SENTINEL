import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";


export async function POST(req: Request) {
  try {
    const { walletAddress } = await req.json();
    
    // Next.js 15 requires awaiting cookies
    const cookieStore = await cookies(); 
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );


    // 1. Get the securely authenticated user from the session cookie
    const { data: { user }, error: authError } = await supabase.auth.getUser();


    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    // 2. Link the wallet to the user's app_state
    // We use user.id as the primary key 'id' to ensure 1-to-1 mapping
    const { error: dbError } = await supabase
      .from("app_state")
      .upsert({ 
        id: user.id, 
        user_id: user.id,
        walletAddress: walletAddress,
      });


    if (dbError) throw dbError;


    return NextResponse.json({ success: true, message: "Wallet linked successfully" });


  } catch (error: any) {
    console.error("Wallet link error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


