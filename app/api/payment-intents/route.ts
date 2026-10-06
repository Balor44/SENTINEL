import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { evaluatePayment } from "@/lib/policy-engine";
import { executeTempoPayment } from "@/lib/tempo";
import crypto from "crypto";


export const dynamic = "force-dynamic";
const TEMPO_TOKEN_ADDRESS = "0x20c0000000000000000000000000000000000000";


// Helper to hash events for an immutable, tamper-evident audit ledger (Review Point 15)
function generateEventHash(payload: any) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}


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


    const body = await req.json();
   
    // 1. Idempotency Enforcer: Ensure frontend passed a unique key
    const idempotencyKey = body.idempotencyKey;
    if (!idempotencyKey) {
      return NextResponse.json({ error: "Missing idempotencyKey in request" }, { status: 400 });
    }


    // 2. Check if this request was already processed (Double-Spend Protection)
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .single();


    if (existingTx) {
      return NextResponse.json({
        success: existingTx.status === "settled",
        status: existingTx.status,
        txHash: existingTx.txHash,
        message: "Returned existing idempotent result"
      });
    }


    // Fetch Agent
    const { data: agent } = await supabase
      .from("agents")
      .select("*")
      .or(`id.eq.${body.agentId},name.eq.${body.agentId}`)
      .single();


    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });


    const amount = Number(body.amount);
    const recipient = String(body.recipient ?? "").trim();


    // Fetch Global State & History
    const { data: state } = await supabase.from("app_state").select("fleetFrozen").eq("user_id", user.id).single();
    const { data: recentTxs } = await supabase.from("transactions").select("*").eq("agentId", agent.id).order("createdAt", { ascending: false }).limit(20);


    // 3. Evaluate Policy (Now using BigInt and Kill Switch)
    const decision = evaluatePayment(agent, {
      amount,
      recipient,
      transactions: recentTxs || [],
      fleetFrozen: state?.fleetFrozen || false,
    });


    // Create the immutable audit payload
    const eventPayload = { agentId: agent.id, amount, recipient, decision: decision.status, time: Date.now() };
    const eventHash = generateEventHash(eventPayload);


    // 4a. BLOCKED
    if (decision.status === "blocked") {
      // Audit: Always log blocked attempts to the ledger with the decision trace
      await supabase.from("transactions").insert({
        user_id: user.id,
        agentId: agent.id,
        amount,
        recipient,
        status: "blocked",
        idempotency_key: idempotencyKey,
        type: "payment",
        decision_reason: decision.reason,
        decision_trace: decision.trace,
        event_hash: eventHash,
        organization_id: agent.organization_id // Added the missing organization_id here
      });


      return NextResponse.json({ error: decision.reason, trace: decision.trace, status: "blocked" }, { status: 403 });
    }


    // 4b. APPROVAL REQUIRED
    if (decision.status === "approval_required") {
      // Create pending record for human approval queue with the full decision trace
      const { data: pendingTx, error: pendingError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          agentId: agent.id,
          amount,
          recipient,
          status: "approval_required",
          idempotency_key: idempotencyKey,
          type: "payment",
          decision_reason: decision.reason,
          decision_trace: decision.trace,
          event_hash: eventHash,
          organization_id: agent.organization_id, // Fixed camelCase to snake_case
        })
        .select()
        .single();


      if (pendingError) throw new Error("Failed to create pending approval record");


      return NextResponse.json({
        error: "Human approval required",
        status: "approval_required",
        message: decision.reason,
        transactionId: pendingTx?.id,
        trace: decision.trace
      }, { status: 202 });
    }


    // 4c. APPROVED -> RESERVATION: Create a 'PROCESSING' record in the DB *before* hitting the blockchain
    const { data: reservedTx, error: reserveError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        agentId: agent.id,
        amount,
        recipient,
        status: "processing",
        idempotency_key: idempotencyKey,
        organization_id: agent.organization_id, // Fixed camelCase to snake_case
        type: "payment",
        decision_reason: decision.reason,
        decision_trace: decision.trace, // Review Point 14
        event_hash: eventHash           // Review Point 15
      })
      .select()
      .single();


    if (reserveError || !reservedTx) {
      console.error("Supabase Insert Error:", reserveError);
      throw new Error("Failed to reserve transaction state");
    }


    // 5. Execute Web3 Transaction
    const execution = await executeTempoPayment(
     agent as any, amount, recipient, TEMPO_TOKEN_ADDRESS, body.memo
    );


    // 6. Settle or Rollback State Machine
    if (!execution.success) {
      // Rollback: Mark as failed so it doesn't count against their daily limit
      await supabase.from("transactions").update({ status: "failed", error: execution.error }).eq("id", reservedTx.id);
      return NextResponse.json({ error: execution.error || "Tempo execution failed" }, { status: 500 });
    }


    // Success: Update the reservation to SETTLED and update Agent balances atomically
    await Promise.all([
      supabase.from("transactions").update({
        status: "settled",
        txHash: execution.txHash
      }).eq("id", reservedTx.id),
     
      supabase.from("agents").update({
        spentToday: Number(agent.spentToday || 0) + amount,
        balance: Math.max(Number(agent.balance || 0) - amount, 0),
        payments: Number(agent.payments || 0) + 1,
      }).eq("id", agent.id)
    ]);


    return NextResponse.json({
      success: true,
      txHash: execution.txHash,
      status: "settled",
    });
  } catch (error) {
    console.error("Payment intent error:", error);
    return NextResponse.json({ error: "Internal payment error" }, { status: 500 });
  }
}


