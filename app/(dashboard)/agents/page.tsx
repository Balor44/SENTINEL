import Link from "next/link";
import { ArrowRight, Bot, MoreHorizontal, Plus, ShieldAlert, WalletCards } from "lucide-react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { money } from "@/lib/utils";
import { Badge, Button, ProgressBar } from "@/components/ui";
import { PageHeader } from "@/components/page-header";


export const dynamic = "force-dynamic";


export default async function AgentsPage() {
  // 1. Initialize the authenticated Supabase client for Server Components
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        // We leave setAll empty in Server Components because they only read data
        setAll() {} 
      }
    }
  );


  // 2. Fetch live agents securely using the user's session cookie
  const { data: agentsData } = await supabase
    .from("agents")
    .select("*")
    .order("createdAt", { ascending: false });
    
  const agents = agentsData || [];


  return (
    <div>
      <PageHeader
        eyebrow="Workspace / Agents"
        title="Agents"
        description="Every agent gets a scoped identity, budget and policy."
        action={<Link href="/agents/new"><Button variant="primary"><Plus className="h-4 w-4" />Create agent</Button></Link>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <Link key={agent.id} href={`/agents/${agent.id}`} className="panel panel-hover block p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-xs font-semibold text-violet-300">
                  {agent.initials ?? agent.name.substring(0,2).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-white">{agent.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{agent.address}</div>
                </div>
              </div>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-5 min-h-10 text-sm leading-5 text-muted-foreground">{agent.description}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-black/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
                <div className="mt-1 font-medium text-white">{money(agent.balance || 0)}</div>
              </div>
              <div className="rounded-xl border border-border bg-black/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Today</div>
                <div className="mt-1 font-medium text-white">{money(agent.spentToday ?? agent.todaySpend ?? 0)}</div>
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-muted-foreground">Daily budget</span>
                <span className="text-white">
                  {Math.round(((agent.spentToday ?? agent.todaySpend ?? 0) / ((agent.dailyBudget ?? agent.dailyLimit) || 1)) * 100)}%
                </span>
              </div>
              <ProgressBar value={((agent.spentToday ?? agent.todaySpend ?? 0) / ((agent.dailyBudget ?? agent.dailyLimit) || 1)) * 100} />
            </div>
            <div className="mt-5 flex items-center justify-between">
              <Badge tone={agent.status === "active" ? "success" : agent.status === "risk" ? "danger" : "warning"}>
                {agent.status === "active" ? <WalletCards className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {agent.status}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">View agent <ArrowRight className="h-3 w-3" /></span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}


