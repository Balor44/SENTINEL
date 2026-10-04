import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { Activity, Bot, Plus, ShieldAlert, WalletCards } from "lucide-react";
import { money } from "@/lib/utils";
import { Badge, Button, StatCard } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { TransactionTable } from "@/components/transaction-table";


export const dynamic = "force-dynamic";


export default async function OverviewPage() {
  // 1. Initialize Secure Server Client
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );


  // 2. Verify Session
  const { data: { user } } = await supabase.auth.getUser();


  // 3. Fetch all dashboard data concurrently and securely
  const [
    { data: state },
    { data: agents },
    { data: transactions }
  ] = await Promise.all([
    supabase.from("app_state").select("treasury, walletAddress").eq("user_id", user?.id).single(),
    supabase.from("agents").select("*").eq("user_id", user?.id),
    supabase.from("transactions").select("*").eq("user_id", user?.id).order("createdAt", { ascending: false })
  ]);


  const safeAgents = agents || [];
  const safeTransactions = transactions || [];
  const treasury = state?.treasury || {};
  
  const balance = treasury.balance || 0;
  const allocated = treasury.allocated || 0;
  
  // Calculate risk purely from database ledger
  const blockedRisk = safeTransactions
    .filter((tx: any) => tx.status === "blocked")
    .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);


  return (
    <div>
      <PageHeader
        eyebrow="Workspace / Overview"
        title="Good morning, operator."
        description="Monitor how your autonomous agents use company funds."
        action={
          <Link href="/agents/new">
            <Button variant="primary">
              <Plus className="h-4 w-4" />
              Create agent
            </Button>
          </Link>
        }
      />


      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Treasury"
          value={money(balance)}
          detail={
            state?.walletAddress
              ? "Live Tempo balance"
              : "No treasury wallet connected"
          }
          icon={<WalletCards className="h-4 w-4" />}
        />


        <StatCard
          label="Agent spend"
          value={money(allocated)}
          detail={
            safeAgents.length === 0
              ? "No agents funded"
              : `${safeAgents.length} agent${safeAgents.length === 1 ? "" : "s"}`
          }
          icon={<Bot className="h-4 w-4" />}
        />


        <StatCard
          label="Blocked risk"
          value={money(blockedRisk)}
          detail={
            safeTransactions.length === 0
              ? "No blocked activity"
              : "Policy-blocked activity"
          }
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>


      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow">Agent activity</div>
              <div className="mt-2 text-xl font-semibold text-white">
                {safeTransactions.length}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Recorded transactions
              </div>
            </div>
            <Badge tone="purple">Live</Badge>
          </div>


          <div className="mt-8 flex min-h-56 flex-col items-center justify-center text-center">
            {safeTransactions.length === 0 ? (
              <>
                <Activity className="h-8 w-8 text-muted-foreground" />
                <div className="mt-4 text-sm font-medium text-white">
                  No payment activity yet
                </div>
                <div className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Sentinel will show real agent payment activity here after your first policy decision and Tempo transaction.
                </div>
              </>
            ) : (
              <div className="w-full">
                <div className="mb-4 text-left text-xs text-muted-foreground">
                  Recent activity
                </div>
                {/* Ensure your TransactionTable component handles internal fetching, or replace with the list mapped earlier */}
                <TransactionTable limit={5} />
              </div>
            )}
          </div>
        </section>


        <section className="panel p-5">
          <div className="eyebrow">Fleet</div>
          <div className="mt-2 text-xl font-semibold text-white">
            {safeAgents.length}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Registered autonomous agents
          </div>


          <div className="mt-6 space-y-3">
            {safeAgents.length === 0 ? (
              <div className="rounded-xl border border-border p-5 text-center">
                <Bot className="mx-auto h-6 w-6 text-muted-foreground" />
                <div className="mt-3 text-sm font-medium text-white">
                  No agents yet
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Create your first agent to begin assigning financial authority.
                </div>
                <Link href="/agents/new" className="mt-4 inline-flex">
                  <Button variant="secondary">Create agent</Button>
                </Link>
              </div>
            ) : (
              safeAgents.map((agent: any) => (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="block rounded-xl border border-border p-4 transition hover:border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-white">
                      {agent.name}
                    </div>
                    <Badge tone={agent.status === "active" ? "success" : "warning"}>
                      {agent.status}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Spent today {money(agent.spentToday || 0)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


