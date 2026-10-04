// app/(dashboard)/agents/[agentid]/page.tsx
"use client";


import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Bot, Copy, MoreHorizontal, Pause, Play, ShieldCheck, WalletCards, Loader2, Save, X } from "lucide-react";
import { use, useState, useEffect } from "react";
import { money } from "@/lib/utils";
import { Badge, Button, ProgressBar, StatCard } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import type { Agent, Transaction } from "@/types"; 
import { WalletConnection } from "@/components/wallet-connection";
import { useSendTransaction } from "wagmi";
import { parseEther } from "viem";


export default function AgentDetailPage({ params }: { params: Promise<{ agentid: string }> }) {
  // Extract the lowercase agentid mapped from the folder structure
  const { agentid } = use(params);
  const agentId = agentid; 
 
  const [agent, setAgent] = useState<Agent | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
 
  // Form and Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editBudget, setEditBudget] = useState("");
  const [editThreshold, setEditThreshold] = useState("");
  const [editAllowlist, setEditAllowlist] = useState("");


  // Wagmi hook for sending native testnet tokens
  const { sendTransaction, isPending } = useSendTransaction();


  useEffect(() => {
    // Fetch live agent and transaction data
    Promise.all([
      fetch(`/api/agents/${agentId}`, { cache: "no-store" }).then(res => res.json()),
      fetch("/api/transactions", { cache: "no-store" }).then(res => res.json())
    ]).then(([agentData, txData]) => {
      if (agentData.agent) {
        setAgent(agentData.agent);
        // Pre-fill the form state with current live data
        setEditBudget(String(agentData.agent.dailyBudget));
        setEditThreshold(String(agentData.agent.approvalThreshold));
        setEditAllowlist((agentData.agent.recipientAllowlist || []).join(", "));
      }
      if (txData.transactions) {
        setTransactions(txData.transactions.filter((t: Transaction) => t.agentId === agentId));
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
          // Clean up the comma-separated string into a clean array
          recipientAllowlist: editAllowlist.split(",").map(s => s.trim()).filter(Boolean)
        })
      });


      if (res.ok) {
        // Force the page to refresh and pull the new limits from the server
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


  const handleDeposit = () => {
    if (!agent || !agent.walletAddress) return;
    
    // Sends 100 native tokens (TMP) to the Agent's wallet address
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
            {/* Native Wagmi connection modal */}
            <WalletConnection compact />
            
            <Button 
              variant="primary" 
              onClick={handleDeposit}
              disabled={isPending}
            >
              <WalletCards className="mr-2 h-4 w-4" />
              {isPending ? "Confirm in Wallet..." : "Deposit 100 TMP"}
            </Button>
            
            <Button variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        }
      />


      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Balance" value={money(agent.balance)} detail="Available to spend" icon={<WalletCards className="h-4 w-4" />} />
        <StatCard label="Today’s spend" value={money(agent.spentToday ?? 0)} detail={`of ${money(agent.dailyBudget)} daily limit`} icon={<Bot className="h-4 w-4" />} />
        <StatCard label="Payments" value={String(agent.payments ?? 0)} detail="Successful payments" icon={<ShieldCheck className="h-4 w-4" />} />
      </div>


      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        {/* Dynamic Policy Editor Section */}
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Policy controls</div>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="h-7 px-2 text-xs">Edit</Button>
            ) : (
              <Button onClick={() => setIsEditing(false)} className="h-7 px-2 text-xs" variant="ghost">Cancel</Button>
            )}
          </div>
         
          <div className="mt-5 space-y-5">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Daily budget tracking</span>
                <span className="text-white">{money(agent.spentToday ?? 0)} / {money(agent.dailyBudget)}</span>
              </div>
              <ProgressBar value={((agent.spentToday ?? 0) / agent.dailyBudget) * 100} />
            </div>


            {isEditing ? (
              <div className="space-y-4 rounded-xl border border-border bg-black/20 p-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Daily Budget ($)</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={editBudget}
                    onChange={(e) => setEditBudget(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Approval Threshold ($)</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={editThreshold}
                    onChange={(e) => setEditThreshold(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Recipient Allowlist (Comma separated)</label>
                  <textarea
                    className="input min-h-20 w-full resize-none"
                    value={editAllowlist}
                    onChange={(e) => setEditAllowlist(e.target.value)}
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
                <Rule label="Max transaction" value={money(agent.transactionLimit ?? agent.txLimit)} />
                <Rule label="Approval threshold" value={money(agent.approvalThreshold)} />
                <Rule label="Allowed token" value="USD" />
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
                {agent.walletAddress ?? agent.address}
                <Copy className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-white" />
              </div>
            </div>
          </div>
         
          <div className="mt-6 eyebrow">Recipient allowlist</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(agent.recipientAllowlist ?? agent.recipients)?.map((recipient) => (
              <Badge key={recipient} tone="purple">{recipient}</Badge>
            ))}
          </div>
        </section>
      </div>


      <section className="panel mt-4">
        <div className="border-b border-border p-5">
          <div className="eyebrow">Activity</div>
          <h2 className="mt-1 text-base font-semibold text-white">Recent payments</h2>
        </div>
        <div className="divide-y divide-border/70">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No recent payments for this agent.</div>
          ) : (
            transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{tx.purpose ?? tx.reason ?? "Agent transfer"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{tx.recipient} · {tx.time ?? new Date(tx.createdAt).toLocaleTimeString()}</div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge tone={tx.status === "settled" ? "success" : tx.status === "blocked" ? "danger" : "warning"}>
                    {tx.status}
                  </Badge>
                  <span className="text-sm font-medium text-white">{money(tx.amount)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}


function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/70 pb-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}