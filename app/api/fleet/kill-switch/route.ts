import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";


export const dynamic = "force-dynamic";


export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );


    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


    // 1. Enforce RBAC & Multi-Tenancy
    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();


    if (!member) return NextResponse.json({ error: "No organization found" }, { status: 403 });
    if (member.role === "viewer" || member.role === "operator") {
      return NextResponse.json({ error: "Only Admins/Owners can freeze the fleet." }, { status: 403 });
    }


    const { freeze } = await req.json();


    // 2. Update the organization's global app state
    const { error } = await supabase
      .from("app_state")
      .update({ fleetFrozen: freeze })
      .eq("organization_id", member.organization_id);


    if (error) throw error;


    return NextResponse.json({ success: true, fleetFrozen: freeze });
  } catch (error) {
    return NextResponse.json({ error: "Failed to toggle kill switch" }, { status: 500 });
  }
}


