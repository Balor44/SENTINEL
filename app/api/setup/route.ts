import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { id } from "@/lib/utils";


export const dynamic = "force-dynamic";


export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );


  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ organization: {}, setup: {}, treasury: {}, agents: [], policies: [] });


  const { data: agents } = await supabase.from("agents").select("*");
  const { data: policies } = await supabase.from("policies").select("*");
  // Fetch specifically this user's state, not the "singleton"
  const { data: state } = await supabase.from("app_state").select("*").eq("user_id", user.id).single();


  const appState = state || { organization: {}, setup: {}, treasury: {} };


  return NextResponse.json({
    organization: appState.organization || {},
    setup: appState.setup || {},
    treasury: appState.treasury || {},
    agents: agents || [],
    policies: policies || []
  });
}


export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );


  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


  const body = await req.json();


  // 1. Load user's actual state
  const { data: stateData } = await supabase.from("app_state").select("*").eq("user_id", user.id).single();
  let state = stateData || {
    organization: {},
    setup: {},
    treasury: { balance: 0, allocated: 0, available: 0 },
    walletAddress: null
  };
  let stateUpdated = false;


  // 2. Organization Update
  if (body.organizationName) {
    state.organization = state.organization || {};
    state.organization.name = String(body.organizationName).trim() || state.organization.name;
    stateUpdated = true;
  }


  // 3. Treasury / Setup Update
  if (body.treasuryWallet) {
    const wallet = String(body.treasuryWallet).trim();
    state.setup = state.setup || {};
    state.treasury = state.treasury || {};
    state.setup.treasuryWallet = wallet;
    state.setup.walletMode = ["created", "imported", "connected"].includes(body.walletMode) ? body.walletMode : "connected";
    state.treasury.walletAddress = wallet;
    state.treasury.walletMode = state.setup.walletMode;
    state.walletAddress = wallet; // Syncs to the top-level column we added earlier
    stateUpdated = true;
  }


  if (body.treasuryReady) {
    state.setup = state.setup || {};
    state.setup.treasuryReady = true;
    stateUpdated = true;
  }
 
  if (body.complete) {
    state.setup = state.setup || {};
    state.setup.onboardingComplete = true;
    stateUpdated = true;
  }


  // 4. Fund Agent
  if (body.fundAgentId) {
    const { data: target } = await supabase.from("agents").select("*").eq("id", body.fundAgentId).single();
    const value = Number(body.amount || 0);
   
    if (target && Number.isFinite(value) && value > 0) {
      await supabase.from("agents").update({ balance: (target.balance || 0) + value }).eq("id", body.fundAgentId);
      state.treasury = state.treasury || {};
      state.treasury.allocated = (state.treasury.allocated || 0) + value;
      state.treasury.available = Math.max((state.treasury.balance || 0) - state.treasury.allocated, 0);
      stateUpdated = true;
    }
  }


  // 5. Policy Update
  if (body.policyUpdate) {
    const { agentId, dailyBudget, transactionLimit, approvalThreshold, recipient } = body.policyUpdate;
   
    const { data: targetAgent } = await supabase
      .from("agents")
      .select("*")
      .or(`id.eq.${agentId},name.eq.${agentId}`)
      .single();
   
    if (targetAgent) {
      const agentUpdate: any = {};
      if (Number.isFinite(dailyBudget)) {
        agentUpdate.dailyBudget = Number(dailyBudget);
        agentUpdate.dailyLimit = Number(dailyBudget);
      }
      if (Number.isFinite(transactionLimit)) {
        agentUpdate.transactionLimit = Number(transactionLimit);
        agentUpdate.txLimit = Number(transactionLimit);
      }
      if (Number.isFinite(approvalThreshold)) {
        agentUpdate.approvalThreshold = Number(approvalThreshold);
      }
      if (recipient) {
        const cleanRecipient = String(recipient).trim();
        agentUpdate.recipientAllowlist = [cleanRecipient];
        agentUpdate.recipients = [cleanRecipient];
      }
      await supabase.from("agents").update(agentUpdate).eq("id", targetAgent.id);


      const { data: policy } = await supabase.from("policies").select("*").eq("agentId", targetAgent.id).single();
      if (policy) {
        const policyUpdate: any = {};
        if (Number.isFinite(dailyBudget)) {
          policyUpdate.dailyBudget = Number(dailyBudget);
          policyUpdate.dailyLimit = Number(dailyBudget);
        }
        if (Number.isFinite(transactionLimit)) {
          policyUpdate.transactionLimit = Number(transactionLimit);
          policyUpdate.txLimit = Number(transactionLimit);
        }
        if (Number.isFinite(approvalThreshold)) {
          policyUpdate.approvalThreshold = Number(approvalThreshold);
        }
        if (recipient) {
          policyUpdate.allowlistedRecipients = [String(recipient).trim()];
          policyUpdate.recipients = [String(recipient).trim()];
        }
        await supabase.from("policies").update(policyUpdate).eq("id", policy.id);
      }
    }
  }


  // 6. Agent Creation
  if (body.agent) {
    const a = body.agent;
    const agentName = (a.name || "ResearchBot").trim();
   
    // Check if agent already exists by name for THIS user
    const { data: existingAgent } = await supabase.from("agents").select("id").eq("name", agentName).single();
   
    if (!existingAgent) {
      const agentId = a.id || id("agent");
      const recipients = Array.isArray(a.recipients) ? a.recipients : [];
     
      const { error: insertErr } = await supabase.from("agents").insert({
        id: agentId,
        user_id: user.id, // CRITICAL FIX: Links to your account
        name: agentName,
        description: a.description || "Autonomous research and data acquisition agent.",
        status: "active",
        walletAddress: a.walletAddress || null,
        address: a.walletAddress || null,
        balance: Number(a.initialFunding || 0),
        dailyBudget: Number(a.dailyBudget || 100),
        dailyLimit: Number(a.dailyBudget || 100),
        spentToday: 0,
        todaySpend: 0,
        transactionLimit: Number(a.transactionLimit || 10),
        txLimit: Number(a.transactionLimit || 10),
        approvalThreshold: Number(a.approvalThreshold || 25),
        recipientAllowlist: recipients,
        recipients: recipients,
        payments: 0,
      });


      if (insertErr) {
        console.error("Supabase Agent Insert Error:", insertErr);
        return NextResponse.json({ error: `Database Error: ${insertErr.message}` }, { status: 500 });
      }


      await supabase.from("policies").insert({
        id: id("policy"),
        user_id: user.id, // CRITICAL FIX: Links to your account
        name: `${agentName} Financial Policy`,
        description: "Initial autonomous spending authority.",
        enabled: true,
        active: true,
        agentId: agentId,
        dailyBudget: Number(a.dailyBudget || 100),
        dailyLimit: Number(a.dailyBudget || 100),
        transactionLimit: Number(a.transactionLimit || 10),
        txLimit: Number(a.transactionLimit || 10),
        approvalThreshold: Number(a.approvalThreshold || 25),
        allowlistedRecipients: recipients,
        recipients: recipients,
      });
    }
  }


  // 7. Persist Global State to user's row
  if (stateUpdated) {
    await supabase.from("app_state").upsert({
      id: user.id, // No more singleton!
      user_id: user.id,
      organization: state.organization,
      setup: state.setup,
      treasury: state.treasury,
      walletAddress: state.walletAddress || null
    });
  }


  const { data: finalAgents } = await supabase.from("agents").select("*");
  const { data: finalPolicies } = await supabase.from("policies").select("*");
  const { data: finalStateData } = await supabase.from("app_state").select("*").eq("user_id", user.id).single();
 
  const finalState = finalStateData || { organization: {}, setup: {}, treasury: {} };


  return NextResponse.json({
    organization: finalState.organization || {},
    setup: finalState.setup || {},
    treasury: finalState.treasury || {},
    agents: finalAgents || [],
    policies: finalPolicies || []
  });
}


