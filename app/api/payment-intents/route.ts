import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { evaluatePayment } from "@/lib/policy-engine";
import { executeTempoPayment } from "@/lib/tempo";
import crypto from "crypto";


export const dynamic = "force-dynamic";
const TEMPO_TOKEN_ADDRESS = "0x20c0000000000000000000000000000000000000";


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
   
    const idempotencyKey = body.idempotencyKey;
    if (!idempotencyKey) {
      return NextResponse.json({ error: "Missing idempotencyKey in request" }, { status: 400 });
    }


    const { data: existingTx } = await supabase
      .from("transactions")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .single();


    if (existingTx) {
      return NextResponse.json({
        success: existingTx.status === "settled",
        status: existingTx.status,
        txHash: existingTx.tx_hash || existingTx.txHash,
        message: "Returned existing idempotent result"
      });
    }


    const { data: agent } = await supabase
      .from("agents")
      .select("*")
      .or(`id.eq.${body.agentId},name.eq.${body.agentId}`)
      .single();


    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });


    const amount = Number(body.amount);
    const recipient = String(body.recipient ?? "").trim();


    const { data: state } = await supabase.from("app_state").select("fleetFrozen").eq("user_id", user.id).single();
    
    // Strict snake_case queries
    const { data: recentTxs } = await supabase.from("transactions").select("*").eq("agent_id", agent.id).order("created_at", { ascending: false }).limit(20);


    const decision = evaluatePayment(agent, {
      amount,
      recipient,
      transactions: recentTxs || [],
      fleetFrozen: state?.fleetFrozen || false,
    });


    const eventPayload = { agentId: agent.id, amount, recipient, decision: decision.status, time: Date.now() };
    const eventHash = generateEventHash(eventPayload);


    if (decision.status === "blocked") {
      await supabase.from("transactions").insert({
        user_id: user.id,
        agent_id: agent.id,
        amount,
        recipient,
        status: "blocked",
        idempotency_key: idempotencyKey,
        type: "payment",
        decision_reason: decision.reason,
        decision_trace: decision.trace,
        event_hash: eventHash,
        organization_id: agent.organization_id || agent.organizationId 
      });


      return NextResponse.json({ error: decision.reason, trace: decision.trace, status: "blocked" }, { status: 403 });
    }


    if (decision.status === "approval_required") {
      const { data: pendingTx, error: pendingError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          agent_id: agent.id,
          amount,
          recipient,
          status: "approval_required",
          idempotency_key: idempotencyKey,
          type: "payment",
          decision_reason: decision.reason,
          decision_trace: decision.trace,
          event_hash: eventHash,
          organization_id: agent.organization_id || agent.organizationId, 
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


    const { data: reservedTx, error: reserveError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        agent_id: agent.id,
        amount,
        recipient,
        status: "processing",
        idempotency_key: idempotencyKey,
        organization_id: agent.organization_id || agent.organizationId, 
        type: "payment",
        decision_reason: decision.reason,
        decision_trace: decision.trace, 
        event_hash: eventHash           
      })
      .select()
      .single();


    if (reserveError || !reservedTx) {
      console.error("Supabase Insert Error:", reserveError);
      throw new Error("Failed to reserve transaction state");
    }


    const execution = await executeTempoPayment(
     agent as any, amount, recipient, TEMPO_TOKEN_ADDRESS, body.memo
    );


    if (!execution.success) {
      await supabase.from("transactions").update({ status: "failed", error: execution.error }).eq("id", reservedTx.id);
      return NextResponse.json({ error: execution.error || "Tempo execution failed" }, { status: 500 });
    }


    // Strict snake_case updates for tx_hash and spent_today
    await Promise.all([
      supabase.from("transactions").update({
        status: "settled",
        tx_hash: execution.txHash
      }).eq("id", reservedTx.id),
     
      supabase.from("agents").update({
        spent_today: Number(agent.spent_today || agent.spentToday || 0) + amount,
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


