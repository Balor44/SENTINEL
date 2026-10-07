import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";


export const dynamic = "force-dynamic";


// 1. Zod Validation
const policyInputSchema = z.object({
  name: z.string().optional().default("Untitled policy"),
  description: z.string().optional().default(""),
  enabled: z.boolean().optional().default(true),
  agentId: z.string().optional().default(""),
  dailyBudget: z.coerce.number().min(0).optional().default(100),
  transactionLimit: z.coerce.number().min(0).optional().default(10),
  approvalThreshold: z.coerce.number().min(0).optional().default(25),
  allowlistedRecipients: z.union([z.array(z.string()), z.any()]).transform(val => 
    Array.isArray(val) ? val : []
  ),
});


export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );


    // RLS filters this to only the logged-in user
    const { data, error } = await supabase.from("policies").select("*");
    
    if (error) throw error;
    // Note: returning { policies: data } to match your frontend expectation
    return NextResponse.json({ policies: data || [] });
    
  } catch (error: any) {
    console.error("Policies GET error:", error);
    return NextResponse.json({ policies: [] });
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


    // 2. Authenticate User
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const rawBody = await req.json();
    const b = policyInputSchema.parse(rawBody);


    // 3. Map to your dual-schema fallbacks and lock to user_id
    const dbPayload = {
      name: b.name,
      description: b.description,
      enabled: b.enabled,
      active: b.enabled,
      agentId: b.agentId,
      dailyBudget: b.dailyBudget,
      dailyLimit: b.dailyBudget,
      transactionLimit: b.transactionLimit,
      txLimit: b.transactionLimit,
      approvalThreshold: b.approvalThreshold,
      allowlistedRecipients: b.allowlistedRecipients,
      recipients: b.allowlistedRecipients,
      user_id: user.id
    };


    const { data, error } = await supabase
      .from("policies")
      .insert([dbPayload])
      .select()
      .single();


    if (error) throw error;
    return NextResponse.json({ policy: data }, { status: 201 });


  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data format", details: (error as any).errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to create policy" }, { status: 500 });
  }
}


