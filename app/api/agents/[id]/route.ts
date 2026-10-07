import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";


// Next.js 15 requires params to be a Promise in route handlers
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const { id } = await params;
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );


  const { data: agent, error } = await supabase
    .from("agents")
    .select("*")
    .or(`id.eq.${id},name.eq.${id}`)
    .single();


  if (error || !agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });


  return NextResponse.json({ agent, role: "admin" });
}


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const { id } = await params;
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );


  const body = await req.json();
  const { data, error } = await supabase
    .from("agents")
    .update(body)
    .or(`id.eq.${id},name.eq.${id}`)
    .select()
    .single();


  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ agent: data });
}


