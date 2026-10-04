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


// POST: Execute transaction with Policy Engine enforcement
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );


    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


    const rawBody = await req.json();
    const { agentId, amount, recipient, description } = txSchema.parse(rawBody);


    // Fetch Agent and Policy (RLS protects this automatically)
    const { data: agent } = await supabase.from("agents").select("*").eq("id", agentId).single();
    const { data: policy } = await supabase.from("policies").select("*").eq("agentId", agentId).single();


    if (!agent || !policy) {
      return NextResponse.json({ error: "Agent or Policy not found" }, { status: 404 });
    }


    // THE POLICY ENGINE CHECKS
    if (policy.enabled === false) {
      return NextResponse.json({ error: "Policy is disabled" }, { status: 403 });
    }


    if (amount > (policy.transactionLimit || policy.txLimit)) {
      return NextResponse.json({ error: `Amount exceeds transaction limit of ${policy.txLimit}` }, { status: 403 });
    }


    const currentSpend = agent.spentToday || agent.todaySpend || 0;
    if (currentSpend + amount > (policy.dailyBudget || policy.dailyLimit)) {
      return NextResponse.json({ error: "Amount exceeds daily budget" }, { status: 403 });
    }


    // Strict allowlist enforcement
    const allowlist = policy.allowlistedRecipients || policy.recipients || [];
    if (allowlist.length > 0 && !allowlist.includes(recipient)) {
      return NextResponse.json({ error: "Recipient not on allowlist" }, { status: 403 });
    }


    // VIEM EXECUTION (Mocked for Tempo Testnet integration)
    // Replace the mock below with the commented actual viem execution when ready.
    /* 
    const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY!);
    const client = createWalletClient({
      account,
      chain: tempoModerato, 
      transport: http(process.env.NEXT_PUBLIC_TEMPO_RPC_URL)
    });


    const txHash = await client.sendTransaction({
      to: recipient as `0x${string}`,
      value: parseEther(amount.toString()),
    }); 
    */
    const txHash = `0xmock_tempo_tx_${Math.random().toString(36).substring(7)}`;


    // UPDATE DATABASE LEDGER
    await supabase.from("transactions").insert({
      id: `tx_${Date.now()}`,
      user_id: user.id,
      agentId: agent.id,
      amount: amount,
      recipient: recipient,
      status: "completed",
      hash: txHash,
      description: description
    });


    await supabase.from("agents").update({
      spentToday: currentSpend + amount
    }).eq("id", agent.id);


    return NextResponse.json({ 
      success: true, 
      txHash, 
      message: "Transaction approved and executed" 
    });


  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data format", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Transaction failed" }, { status: 500 });
  }
}


