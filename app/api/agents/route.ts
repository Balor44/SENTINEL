import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";


export const dynamic = "force-dynamic";


// 1. Strict Zod Validation Schema
const agentSchema = z.object({
  id: z.string().min(1, "Agent ID is required"),
  name: z.string().min(1, "Agent name is required"),
  description: z.string().optional().default(""),
  address: z.string().startsWith("0x", "Must be a valid Web3 address"),
  dailyLimit: z.number().min(0, "Daily limit cannot be negative").default(0),
  status: z.enum(["active", "paused", "terminated"]).default("active"),
});


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


    // MULTI-TENANCY FIX: Fetch the user's active organization ID
    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();


    if (!member) {
      return NextResponse.json({ error: "User does not belong to any organization" }, { status: 403 });
    }


    // Now fetch agents strictly scoped to their organization
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("organization_id", member.organization_id)
      .order("createdAt", { ascending: false });
   
    if (error) throw error;
    return NextResponse.json(data || [] );
   
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch agents" }, { status: 500 });
  }
}


export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );


    // 2. Secure Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    // MULTI-TENANCY FIX: Retrieve the user's organization context & Role
    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();


    if (!member) {
      return NextResponse.json({ error: "User does not belong to any organization" }, { status: 403 });
    }
    
    // Role-Based Access Control (RBAC): Viewers cannot create agents
    if (member.role === 'viewer') {
       return NextResponse.json({ error: "Viewers cannot create agents." }, { status: 403 });
    }


    const rawBody = await req.json();
   
    // 3. Validate against the strict Zod schema
    const validatedData = agentSchema.parse(rawBody);


    // 4. Safely insert explicitly tied to the organization
    const { error: dbError } = await supabase.from("agents").insert({
      id: validatedData.id,
      name: validatedData.name,
      description: validatedData.description,
      address: validatedData.address,
      dailyLimit: validatedData.dailyLimit,
      status: validatedData.status,
      user_id: user.id, // Kept for audit trailing
      organization_id: member.organization_id, // Enforces organizational ownership
      balance: 0,
      spentToday: 0,
      payments: 0
    });


    if (dbError) throw dbError;
    return NextResponse.json({ success: true, message: "Agent created securely" });


  } catch (error: any) {
    // Catch Zod validation errors and return them cleanly
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data format", details: (error as any).errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}


