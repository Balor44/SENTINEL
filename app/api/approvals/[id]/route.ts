import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { executeTempoPayment } from "@/lib/tempo";


export const dynamic = "force-dynamic";


const TEMPO_TOKEN_ADDRESS = "0x20c0000000000000000000000000000000000000";


export async function POST(
  req: Request, 
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: txId } = await context.params;


    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );


    // 1. Authenticate Human Operator
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const body = await req.json();
    const decision = body.decision; // "approved" | "rejected"
    const reason = body.reason || "Manual operator decision";


    if (decision !== "approved" && decision !== "rejected") {
      return NextResponse.json({ error: "Invalid decision. Must be 'approved' or 'rejected'." }, { status: 400 });
    }


    // 2. Fetch Transaction with strict Ownership & State Check
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .select("*, agents(*)")
      .eq("id", txId)
      .eq("user_id", user.id)
      .single();


    if (txError || !tx) {
      return NextResponse.json({ error: "Transaction not found or unauthorized access." }, { status: 404 });
    }


    // Prevent double approval / re-execution
    if (tx.status !== "approval_required" && tx.status !== "pending") {
      return NextResponse.json({ 
        error: `Cannot process approval. Transaction is already in '${tx.status}' state.` 
      }, { status: 409 });
    }


    const now = new Date().toISOString();


    // 3. Handle Rejection
    if (decision === "rejected") {
      await supabase
        .from("transactions")
        .update({
          status: "rejected",
          approved_by: user.id,
          approved_at: now,
          decision_reason: reason,
        })
        .eq("id", txId);


      return NextResponse.json({ success: true, status: "rejected" });
    }


    // 4. Handle Approval -> Atomic Lock to 'processing'
    await supabase
      .from("transactions")
      .update({
        status: "processing",
        approved_by: user.id,
        approved_at: now,
        decision_reason: reason,
      })
      .eq("id", txId);


    // 5. Execute On-Chain Settlement via Provider
    const execution = await executeTempoPayment(
      tx.agents,
      Number(tx.amount),
      tx.recipient,
      TEMPO_TOKEN_ADDRESS,
      `Approved by ${user.email ?? user.id}`
    );


    if (!execution.success) {
      await supabase
        .from("transactions")
        .update({ status: "failed", error: execution.error })
        .eq("id", txId);


      return NextResponse.json({ 
        error: execution.error || "Blockchain settlement failed after approval." 
      }, { status: 500 });
    }


    // 6. Finalize Ledger & Update Agent Spent Counters
    await Promise.all([
      supabase.from("transactions").update({
        status: "settled",
        txHash: execution.txHash,
      }).eq("id", txId),


      supabase.from("agents").update({
        spentToday: Number(tx.agents.spentToday || 0) + Number(tx.amount),
        balance: Math.max(Number(tx.agents.balance || 0) - Number(tx.amount), 0),
        payments: Number(tx.agents.payments || 0) + 1,
      }).eq("id", tx.agentId)
    ]);


    return NextResponse.json({
      success: true,
      status: "settled",
      txHash: execution.txHash,
    });
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json({ error: "Internal approval processing error" }, { status: 500 });
  }
}


