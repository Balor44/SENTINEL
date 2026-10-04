import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { evaluatePayment } from "@/lib/policy-engine";
import { executeTempoPayment } from "@/lib/tempo";


export const dynamic = "force-dynamic";


const TEMPO_TOKEN_ADDRESS = "0x20c0000000000000000000000000000000000000";


export async function POST(req: Request) {
  try {
    // 1. Initialize Secure Server Client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );


    // 2. Verify Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const body = await req.json();


    // 3. Fetch Agent (RLS will now allow this because we have the user session!)
    const { data: agent } = await supabase
      .from("agents")
      .select("*")
      .or(`id.eq.${body.agentId},name.eq.${body.agentId}`)
      .single();


    if (!agent) {
      return NextResponse.json({ error: "Agent not found in database" }, { status: 404 });
    }


    const amount = Number(body.amount);
    const recipient = String(body.recipient ?? "").trim();


    // 4. Evaluate policy rules
    const decision = evaluatePayment(agent, {
      amount,
      recipient,
      transactions: [],
    });


    if (decision.status === "blocked") {
      return NextResponse.json(
        { error: decision.reason || "Payment blocked by policy engine" },
        { status: 400 }
      );
    }


    // 5. Execute on Tempo Testnet
    const execution = await executeTempoPayment(
      agent,
      amount,
      recipient,
      TEMPO_TOKEN_ADDRESS,
      body.memo,
      body.authorization,
      body.treasuryWallet
    );


    if (!execution.success) {
      return NextResponse.json(
        { error: execution.error || "Tempo execution failed" },
        { status: 500 }
      );
    }


    // 6. Update agent stats in Supabase
    await supabase
      .from("agents")
      .update({
        spentToday: Number(agent.spentToday || 0) + amount,
        todaySpend: Number(agent.todaySpend || 0) + amount,
        balance: Math.max(Number(agent.balance || 0) - amount, 0),
        payments: Number(agent.payments || 0) + 1,
      })
      .eq("id", agent.id);


    return NextResponse.json({
      success: true,
      txHash: execution.txHash,
      status: "settled",
    });
  } catch (error) {
    console.error("Payment intent error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal payment error" },
      { status: 500 }
    );
  }
}


