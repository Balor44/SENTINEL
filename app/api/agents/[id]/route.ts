import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";


export const dynamic = "force-dynamic";


export async function GET(req: Request, context: { params: Promise<any> }) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );


    const resolvedParams = await context.params;
    const agentId = Object.values(resolvedParams)[0] as string;


    if (!agentId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });


    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


    const { data: agent, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      // Extra safety check alongside RLS
      .eq("user_id", user.id)
      .single();


    if (error || !agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });


    return NextResponse.json({ agent });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


export async function PATCH(req: Request, context: { params: Promise<any> }) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );


    const resolvedParams = await context.params;
    const agentId = Object.values(resolvedParams)[0] as string;
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


    const body = await req.json();


    const updateData: any = {};
    if (typeof body.dailyBudget === "number") {
      updateData.dailyBudget = body.dailyBudget;
      updateData.dailyLimit = body.dailyBudget;
    }
    if (typeof body.approvalThreshold === "number") {
      updateData.approvalThreshold = body.approvalThreshold;
    }
    if (Array.isArray(body.recipientAllowlist)) {
      updateData.recipientAllowlist = body.recipientAllowlist;
      updateData.recipients = body.recipientAllowlist;
    }


    const { error } = await supabase
      .from("agents")
      .update(updateData)
      .eq("id", agentId)
      .eq("user_id", user.id);


    if (error) throw error;


    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}


