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


    const { data: state, error: stateError } = await supabase.from("app_state").select("fleet_frozen").eq("user_id", user.id).single();
    if (stateError && stateError.code !== 'PGRST116') {
      console.warn("App State Error (Safe to ignore if app_state table is empty):", stateError.message);
    }
    
    const { data: recentTxs, error: txError } = await supabase.from("transactions").select("*").eq("agentName", agent.name).order("created_at", { ascending: false }).limit(20);
    if (txError) {
      console.error("Supabase GET Transactions Error:", txError.message);
    }


    const decision = evaluatePayment(agent, {
      amount,
      recipient,
      transactions: recentTxs || [],
      fleetFrozen: state?.fleet_frozen || false,
    });


    const eventPayload = { agentId: agent.id, amount, recipient, decision: decision.status, time: Date.now() };
    const eventHash = generateEventHash(eventPayload);


    if (decision.status === "blocked") {
      const { error: blockInsertError } = await supabase.from("transactions").insert({
        id: crypto.randomUUID(), // 👈 FIX: Explicitly generate ID
        user_id: user.id,
        "agentName": agent.name, 
        amount,
        recipient,
        status: "blocked",
        idempotency_key: idempotencyKey,
        decision_reason: decision.reason,
        decision_trace: decision.trace,
        event_hash: eventHash,
        organization_id: agent.organization_id || agent.organizationId 
      });


      if (blockInsertError) {
         console.error("BLOCKED INSERT ERROR:", blockInsertError.message);
      }


      return NextResponse.json({ error: decision.reason, trace: decision.trace, status: "blocked" }, { status: 403 });
    }


    if (decision.status === "approval_required") {
      const { data: pendingTx, error: pendingError } = await supabase
        .from("transactions")
        .insert({
          id: crypto.randomUUID(), // 👈 FIX: Explicitly generate ID
          user_id: user.id,
          "agentName": agent.name, 
          amount,
          recipient,
          status: "approval_required",
          idempotency_key: idempotencyKey,
          decision_reason: decision.reason,
          decision_trace: decision.trace,
          event_hash: eventHash,
          organization_id: agent.organization_id || agent.organizationId, 
        })
        .select()
        .single();


      if (pendingError) {
        console.error("APPROVAL INSERT ERROR:", pendingError.message);
        throw new Error(`DB Error: ${pendingError.message}`);
      }


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
        id: crypto.randomUUID(), // 👈 FIX: Explicitly generate ID
        user_id: user.id,
        "agentName": agent.name, 
        amount,
        recipient,
        status: "processing",
        idempotency_key: idempotencyKey,
        organization_id: agent.organization_id || agent.organizationId, 
        decision_reason: decision.reason,
        decision_trace: decision.trace, 
        event_hash: eventHash           
      })
      .select()
      .single();


    if (reserveError || !reservedTx) {
      console.error("RESERVATION INSERT ERROR:", reserveError?.message);
      return NextResponse.json({ error: `Supabase Insert Failed: ${reserveError?.message}` }, { status: 500 });
    }


    const execution = await executeTempoPayment(
     agent as any, amount, recipient, TEMPO_TOKEN_ADDRESS, body.memo
    );


    if (!execution.success) {
      await supabase.from("transactions").update({ status: "failed", error: execution.error }).eq("id", reservedTx.id);
      return NextResponse.json({ error: execution.error || "Tempo execution failed" }, { status: 500 });
    }


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
  } catch (error: any) {
    console.error("Payment intent error:", error);
    return NextResponse.json({ error: error.message || "Internal payment error" }, { status: 500 });
  }
}


