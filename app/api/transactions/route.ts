import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
// import { tempoModerato } from "@/lib/chains"; // Uncomment when adding Tempo chain config


export const dynamic = "force-dynamic";


// 1. Transaction Request Schema
const txSchema = z.object({
  agentId: z.string().min(1, "Agent ID is required"),
  amount: z.number().positive("Amount must be positive"),
  recipient: z.string().startsWith("0x", "Invalid Web3 address"),
  description: z.string().optional().default("Autonomous execution"),
});


// GET: Fetch transaction history securely
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
      return NextResponse.json({ transactions: [] });
    }


    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("createdAt", { ascending: false });


    if (error) throw error;


    return NextResponse.json({ transactions: transactions || [] });
  } catch (error) {
    console.error("Transactions GET error:", error);
    return NextResponse.json({ transactions: [] });
  }
}