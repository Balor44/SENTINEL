"use client";


import Link from "next/link";
import {
  ArrowLeft, Bot, Copy, ShieldCheck, WalletCards,
  Loader2, Save, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, PauseCircle, PlayCircle
} from "lucide-react";
import { use, useState, useEffect } from "react";
import { money } from "@/lib/utils";
import { Badge, Button, ProgressBar, StatCard } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import type { Agent, Transaction } from "@/types";
import { WalletConnection } from "@/components/wallet-connection";
import { useSendTransaction } from "wagmi";
import { parseEther } from "viem";


export default function AgentDetailPage({ params }: { params: Promise<{ agentId?: string, agentid?: string }> }) {
  const unwrappedParams = use(params);
  const agentId = unwrappedParams.agentId || unwrappedParams.agentid;
 
  const [agent, setAgent] = useState<Agent | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
 
  const [userRole, setUserRole] = useState<"owner" | "admin" | "operator" | "viewer">("admin");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editBudget, setEditBudget] = useState("");
  const [editThreshold, setEditThreshold] = useState("");
  const [editAllowlist, setEditAllowlist] = useState("");


  const { sendTransaction, isPending } = useSendTransaction();


  useEffect(() => {
    if (!agentId) return;
    Promise.all([
      fetch(`/api/agents/${agentId}`, { cache: "no-store" }).then(res => res.json()),
      fetch("/api/transactions", { cache: "no-store" }).then(res => res.json())
    ]).then(([agentData, txData]) => {
      if (agentData.agent) {
        setAgent(agentData.agent);
        // Cast to any to bypass TS strict interface checks for snake_case db columns
        const a = agentData.agent as any;
        setEditBudget(String(a.dailyBudget || a.daily_budget || 0));
        setEditThreshold(String(a.approvalThreshold || a.approval_threshold || 0));
        
        const allowlist = a.recipientAllowlist || a.recipient_allowlist || a.recipients || [];
        setEditAllowlist(allowlist.join(", "));
       
        if (agentData.role) setUserRole(agentData.role);
      }
      if (txData.transactions) {
        setTransactions(txData.transactions.filter((t: any) => 
          t.agentName === agentData.agent?.name || t.agent_id === agentData.agent?.id
        ));
      }
      setIsLoading(false);
    }).catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  }, [agentId]);


  const handleSavePolicy = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyBudget: Number(editBudget),
          approvalThreshold: Number(editThreshold),
          recipientAllowlist: editAllowlist.split(",").map((s: string) => s.trim()).filter(Boolean)
        })
      });


      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        alert(`Failed to update policy: ${data.error}`);
        setIsSaving(false);
      }
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };


  const handleToggleStatus = async () => {
    if (!agent) return;
    const newStatus = agent.status === "active" ? "paused" : "active";
    setAgent({ ...agent, status: newStatus });
    await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
  };


  const handleDeposit = () => {
    if (!agent || !agent.walletAddress) return;
    sendTransaction({
      to: agent.walletAddress as `0x${string}`,
      value: parseEther("100"),
    });
  };


  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }


  if (!agent) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <ShieldCheck className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-white">Agent not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">The requested agent does not exist in memory.</p>
        <Link href="/agents" className="mt-4"><Button>Go back</Button></Link>
      </div>
    );
  }


  const canEdit = userRole === "owner" || userRole === "admin";
  const agentAny = agent as any; // TS bypass for snake_case values
  const dailyBudget = agentAny.dailyBudget || agentAny.daily_budget || 0;
  const spentToday = agentAny.spentToday || agentAny.spent_today || 0;


  return (
    <div>
      <Link href="/agents" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        All agents
      </Link>
     
      <PageHeader
        eyebrow={`Agents / ${agent.name}`}
        title={agent.name}
        description={agent.description}
        action={
          <div className="flex items-center gap-3">
            <Badge tone={agent.status === "active" ? "success" : "warning"}>{agent.status}</Badge>
            <WalletConnection compact />
           
            <Button variant="primary" onClick={handleDeposit} disabled={isPending}>
              <WalletCards className="mr-2 h-4 w-4" />
              {isPending ? "Confirming..." : "Deposit 100 TMP"}
            </Button>


            {canEdit && (
              <Button variant="ghost" onClick={handleToggleStatus} className={agent.status === 'active' ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'}>
                {agent.status === 'active' ? <PauseCircle className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                {agent.status === 'active' ? "Pause Agent" : "Resume Agent"}
              </Button>
            )}
          </div>
        }
      />


      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Balance" value={money(agent.balance || 0)} detail="Available to spend" icon={<WalletCards className="h-4 w-4" />} />
        <StatCard label="Today’s spend" value={money(spentToday)} detail={`of ${money(dailyBudget)} daily limit`} icon={<Bot className="h-4 w-4" />} />
        <StatCard label="Payments" value={String(agent.payments ?? 0)} detail="Successful payments" icon={<ShieldCheck className="h-4 w-4" />} />
      </div>


      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Policy controls</div>
            {canEdit && !isEditing && (
              <Button onClick={() => setIsEditing(true)} className="h-7 px-2 text-xs">Edit</Button>
            )}
            {canEdit && isEditing && (
              <Button onClick={() => setIsEditing(false)} className="h-7 px-2 text-xs" variant="ghost">Cancel</Button>
            )}
          </div>
         
          <div className="mt-5 space-y-5">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Daily budget tracking</span>
                <span className="text-white">{money(spentToday)} / {money(dailyBudget)}</span>
              </div>
              <ProgressBar value={dailyBudget > 0 ? (spentToday / dailyBudget) * 100 : 0} />
            </div>


            {isEditing ? (
              <div className="space-y-4 rounded-xl border border-border bg-black/20 p-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Daily Budget ($)</label>
                  <input
                    type="number" className="input w-full"
                    value={editBudget} onChange={(e) => setEditBudget(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Approval Threshold ($)</label>
                  <input
                    type="number" className="input w-full"
                    value={editThreshold} onChange={(e) => setEditThreshold(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Recipient Allowlist (Comma separated)</label>
                  <textarea
                    className="input min-h-20 w-full resize-none"
                    value={editAllowlist} onChange={(e) => setEditAllowlist(e.target.value)}
                    placeholder="e.g. CloudVendor, 0x123...abc"
                  />
                </div>
                <Button variant="primary" className="w-full" onClick={handleSavePolicy} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isSaving ? "Saving..." : "Save Policy"}
                </Button>
              </div>
            ) : (
              <>
                <Rule label="Max transaction" value={money(agentAny.transactionLimit ?? agentAny.txLimit ?? 0)} />
                <Rule label="Approval threshold" value={money(agentAny.approvalThreshold ?? agentAny.approval_threshold ?? 0)} />
                <Rule label="Allowed token" value="USD" />
                {!canEdit && (
                   <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                     <AlertCircle className="h-3 w-3" /> You have Viewer access.
                   </div>
                )}
              </>
            )}
          </div>
        </section>


        <section className="panel p-5">
          <div className="eyebrow">Agent identity</div>
          <div className="mt-5 grid gap-3">
            <div className="rounded-xl border border-border bg-black/10 p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tempo address</div>
              <div className="mt-2 flex items-center justify-between text-sm text-white">
                {agent.walletAddress ?? agent.address ?? "No address generated"}
                <Copy className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-white" />
              </div>
            </div>
          </div>
         
          <div className="mt-6 eyebrow">Recipient allowlist</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(agentAny.recipientAllowlist ?? agentAny.recipient_allowlist ?? agentAny.recipients ?? [])?.map((recipient: string) => (
              <Badge key={recipient} tone="purple">{recipient}</Badge>
            ))}
          </div>
        </section>
      </div>


      <section className="panel mt-4">
        <div className="border-b border-border p-5">
          <div className="eyebrow">Audit Ledger</div>
          <h2 className="mt-1 text-base font-semibold text-white">Recent payment intents</h2>
        </div>
        <div className="flex flex-col">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No recent payments for this agent.</div>
          ) : (
            transactions.slice(0, 10).map((tx) => <TransactionRow key={tx.id} tx={tx} />)
          )}
        </div>
      </section>
    </div>
  );
}


function TransactionRow({ tx }: { tx: any }) {
  const [expanded, setExpanded] = useState(false);
  const isBlocked = tx.status === "blocked";
  const hasTrace = tx.decision_trace && tx.decision_trace.length > 0;


  return (
    <div className="flex flex-col border-b border-border/70 last:border-0">
      <div
        className={`flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between transition-colors ${hasTrace ? "cursor-pointer hover:bg-white/5" : ""}`}
        onClick={() => hasTrace && setExpanded(!expanded)}
      >
        <div>
          <div className="text-sm font-medium text-white flex items-center gap-2">
            {tx.purpose ?? tx.type ?? "Agent payment intent"}
            {hasTrace && <Badge tone="purple">Trace</Badge>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{tx.recipient} · {tx.time ?? new Date(tx.createdAt || tx.created_at || Date.now()).toLocaleTimeString()}</div>
        </div>
        <div className="flex items-center gap-4">
          <Badge tone={tx.status === "settled" ? "success" : isBlocked ? "danger" : "warning"}>
            {tx.status}
          </Badge>
          <span className="text-sm font-medium text-white">{money(tx.amount)}</span>
          {hasTrace && (expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
        </div>
      </div>


      {expanded && hasTrace && (
        <div className="px-5 pb-5 pt-1">
          <div className="rounded-md bg-black/20 p-4 border border-border/50">
            <div className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-purple-400" />
              Policy Engine Evaluation Log
            </div>
           
            {tx.decision_reason && (
              <div className={`text-xs mb-3 p-2 rounded ${isBlocked ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                <span className="font-medium">Conclusion:</span> {tx.decision_reason}
              </div>
            )}
           
            <div className="flex flex-col gap-2">
              {tx.decision_trace.map((step: string, idx: number) => {
                const failed = isBlocked && idx === tx.decision_trace.length - 1;
                return (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    {failed ? <AlertCircle className="h-4 w-4 text-red-500 shrink-0" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                    <span className={failed ? "text-red-400" : "text-muted-foreground"}>{step}</span>
                  </div>
                )
              })}
             
              {tx.event_hash && (
                 <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                   <span>Cryptographic Event Hash:</span>
                   <span>{tx.event_hash}</span>
                 </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/70 pb-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}


