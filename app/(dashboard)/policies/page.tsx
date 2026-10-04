import Link from "next/link";
import { ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { money } from "@/lib/utils";
import { Badge, Button } from "@/components/ui";
import { PageHeader } from "@/components/page-header";


export const dynamic = "force-dynamic";


export default async function PoliciesPage() {
  // 1. Initialize the authenticated Supabase client for Server Components
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { 
          return cookieStore.getAll(); 
        },
        // We leave setAll empty in Server Components because they only read data
        setAll() {} 
      }
    }
  );


  // 2. Fetch live policies securely using the user's session cookie
  const { data: policiesData } = await supabase
    .from("policies")
    .select("*")
    .order("createdAt", { ascending: false });


  const policies = policiesData || [];


  return (
    <div>
      <PageHeader
        eyebrow="Workspace / Policies"
        title="Policies"
        description="The financial authority layer between agent intent and company funds."
        action={<Link href="/agents/new"><Button variant="primary"><Plus className="h-4 w-4"/>Create controlled agent</Button></Link>}
      />
      <div className="grid gap-4">
        {policies.map((policy) => (
          <Link key={policy.id} href={`/policies/${policy.id}`} className="panel panel-hover p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
              <div className="flex min-w-[240px] items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <ShieldCheck className="h-5 w-5 text-violet-300"/>
                </div>
                <div>
                  <div className="font-medium text-white">{policy.name}</div>
                  <div className="text-xs text-muted-foreground">{policy.agent ?? policy.agentId}</div>
                </div>
              </div>
              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                <Metric label="Daily limit" value={money(policy.dailyBudget ?? policy.dailyLimit)}/>
                <Metric label="Max transaction" value={money(policy.transactionLimit ?? policy.txLimit)}/>
                <Metric label="Approval threshold" value={money(policy.approvalThreshold)}/>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Badge tone={policy.active ? "success" : "warning"}>{policy.active ? "Active" : "Paused"}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground"/>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}


function Metric({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-xl border border-border bg-black/10 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}