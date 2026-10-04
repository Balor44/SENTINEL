import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";


export const dynamic = "force-dynamic";


export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await context.params;
    const txId = Object.values(resolvedParams)[0] as string;
    
    const { decision } = await req.json(); // "approved" or "rejected"


    const { error } = await supabase
      .from("transactions")
      .update({ status: decision })
      .eq("id", txId);
      
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to process decision" }, { status: 500 });
  }
}


