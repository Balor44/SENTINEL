import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";


export const dynamic = "force-dynamic";


export async function GET() {
  try {
    // Approvals are simply transactions that were flagged as 'pending'
    const { data } = await supabase.from("transactions").select("*").eq("status", "pending");
    return NextResponse.json({ approvals: data || [] });
  } catch (error) {
    return NextResponse.json({ approvals: [] });
  }
}


