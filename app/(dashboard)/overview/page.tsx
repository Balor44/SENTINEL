import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { Activity, Bot, Plus, ShieldAlert, WalletCards } from "lucide-react";
import { money } from "@/lib/utils";
import { Badge, Button, StatCard } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import { TransactionTable } from "@/components/transaction-table";
import { KillSwitch } from "@/components/kill-switch";


export const dynamic = "force-dynamic";


export default async function OverviewPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );


  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;


  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .single();


  const orgId = member?.organization_id;
  const canEdit = member?.role === "owner" || member?.role === "admin";


  const agentsQuery = orgId 
    ? supabase.from("agents").select("*").eq("organization_id", orgId)
    : supabase.from("agents").select("*").eq("user_id", user.id);


  const txQuery = orgId 
    ? supabase.from("transactions").select("*").eq("organization_id", orgId)
    : supabase.from("transactions").select("*").eq("user_id", user.id);


  const [
    { data: state },
    { data: agents },
    { data: transactions }
  ] = await Promise.all([
    supabase.from("app_state").select("*").eq("user_id", user.id).single(),
    agentsQuery,
    txQuery 
  ]);


  const safeAgents = agents || [];
  
  const safeTransactions = (transactions || []).sort((a: any, b: any) => {
    const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
    const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
  
  const isFrozen = state?.fleet_frozen || state?.fleetFrozen || false;
 
  // 🚨 BULLETPROOF AGENT SPEND: 
  // Calculate directly from today's successful transactions rather than relying on the agent table
  const todayStr = new Date().toDateString();
  const todayLedgerSpend = safeTransactions
    .filter((tx: any) => {
       const isToday = new Date(tx.created_at || tx.createdAt || 0).toDateString() === todayStr;
       const isSpent = ["settled", "processing", "approval_required", "approved"].includes(tx.status);
       return isToday && isSpent;
    })
    .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);


  // Fallback to table fields just in case
  const fallbackAgentSpend = safeAgents.reduce((sum: number, a: any) => sum + Number(a.spent_today || a.spentToday || a.todaySpend || a.dailySpent || 0), 0);
  
  // Use whichever is higher to guarantee it doesn't show $0 if money moved
  const allocated = Math.max(todayLedgerSpend, fallbackAgentSpend);
  const balance = state?.treasury?.balance || safeAgents.reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);
 
  const blockedRisk = safeTransactions
    .filter((tx: any) => tx.status === "blocked")
    .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);


  return (
    <div>
      {isFrozen && (
        <div className="mb-6 flex items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm font-medium text-red-400">
          <ShieldAlert className="h-4 w-4" />
          FLEET LOCKDOWN ACTIVE: All autonomous agent payments are currently suspended.
        </div>
      )}


      <PageHeader
        eyebrow="Workspace / Overview"
        title="Good morning, operator."
        description="Monitor how your autonomous agents use company funds."
        action={
          <div className="flex items-center gap-3">
            <KillSwitch isFrozen={isFrozen} canEdit={canEdit} />
            <Link href="/agents/new">
              <Button variant="primary">
                <Plus className="h-4 w-4" />
                Create agent
              </Button>
            </Link>
          </div>
        }
      />


      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Treasury"
          value={money(balance)}
          detail={state?.walletAddress ? "Live Tempo balance" : "Total combined agent balances"}
          icon={<WalletCards className="h-4 w-4" />}
        />
        <StatCard
          label="Agent spend (Today)"
          value={money(allocated)}
          detail={safeAgents.length === 0 ? "No agents funded" : `${safeAgents.length} agent${safeAgents.length === 1 ? "" : "s"} active`}
          icon={<Bot className="h-4 w-4" />}
        />
        <StatCard
          label="Blocked risk"
          value={money(blockedRisk)}
          detail={safeTransactions.length === 0 ? "No blocked activity" : "Policy-blocked activity"}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
      </div>


      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="panel p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="eyebrow">Agent activity</div>
              <div className="mt-2 text-xl font-semibold text-white">{safeTransactions.length}</div>
              <div className="mt-1 text-xs text-muted-foreground">Recorded transactions</div>
            </div>
            <Badge tone={isFrozen ? "danger" : "purple"}>{isFrozen ? "Locked" : "Live"}</Badge>
          </div>


          <div className="mt-6 flex flex-col w-full">
            {safeTransactions.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center text-center">
                <Activity className="h-8 w-8 text-muted-foreground" />
                <div className="mt-4 text-sm font-medium text-white">No payment activity yet</div>
                <div className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Sentinel will show real agent payment activity here after your first policy decision.
                </div>
              </div>
            ) : (
              <div className="w-full">
                {/* 🔥 NEW: Activity Bar Chart */}
                <ActivityChart transactions={safeTransactions} />
                
                <div className="mt-8 mb-4 text-left text-xs text-muted-foreground">Recent transactions</div>
                <TransactionTable limit={5} />
              </div>
            )}
          </div>
        </section>


        <section className="panel p-5">
          <div className="eyebrow">Fleet</div>
          <div className="mt-2 text-xl font-semibold text-white">{safeAgents.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">Registered autonomous agents</div>


          <div className="mt-6 space-y-3">
            {safeAgents.length === 0 ? (
              <div className="rounded-xl border border-border p-5 text-center">
                <Bot className="mx-auto h-6 w-6 text-muted-foreground" />
                <div className="mt-3 text-sm font-medium text-white">No agents yet</div>
                <div className="mt-1 text-xs text-muted-foreground">Create your first agent to begin assigning financial authority.</div>
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
                    <div className="text-sm font-medium text-white">{agent.name}</div>
                    <Badge tone={agent.status === "active" ? "success" : "warning"}>{agent.status}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Spent today {money(agent.spent_today || agent.spentToday || agent.todaySpend || agent.dailySpent || 0)}</div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


// 🔥 INLINE CHART COMPONENT: Beautiful Tailwind CSS Bar Chart
function ActivityChart({ transactions }: { transactions: any[] }) {
  // Generate last 7 days
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });


  // Map transactions to days
  const data = days.map(day => {
    const dayTxs = transactions.filter(tx => {
      const txDate = new Date(tx.created_at || tx.createdAt || 0);
      return txDate.getDate() === day.getDate() && 
             txDate.getMonth() === day.getMonth() && 
             txDate.getFullYear() === day.getFullYear() &&
             tx.status !== "failed" && tx.status !== "blocked"; // Only count successful/pending spend
    });
    const total = dayTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    return { 
      label: day.toLocaleDateString('en-US', { weekday: 'short' }), 
      total 
    };
  });


  const maxTotal = Math.max(...data.map(d => d.total), 1); // Prevent division by zero


  return (
    <div className="mt-4 flex h-40 w-full items-end justify-between gap-2 border-b border-border/50 pb-4">
      {data.map((d, i) => (
        <div key={i} className="group relative flex h-full w-full flex-col items-center justify-end">
          <div 
            className="w-full rounded-t-sm bg-purple-500/80 transition-all hover:bg-purple-400" 
            style={{ 
              height: `${(d.total / maxTotal) * 100}%`, 
              minHeight: d.total > 0 ? '4px' : '0' 
            }}
          >
            {/* Hover Tooltip */}
            <div className="absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white border border-border group-hover:block">
              {money(d.total)}
            </div>
          </div>
          <div className="mt-2 text-[10px] uppercase text-muted-foreground">{d.label}</div>
        </div>
      ))}
    </div>
  );
}


