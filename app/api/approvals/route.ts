import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";


export const dynamic = "force-dynamic";


export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );


    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    // Fetch pending transactions requiring approval for this specific user
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["approval_required", "pending"])
      .order("createdAt", { ascending: false });


    if (error) throw error;


    return NextResponse.json({ approvals: data || [] });
  } catch (error) {
    console.error("Failed to fetch approvals:", error);
    return NextResponse.json({ approvals: [] });
  }
}


