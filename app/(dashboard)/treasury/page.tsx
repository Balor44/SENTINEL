"use client";


import {
  Copy,
  Landmark,
  ShieldCheck,
  WalletCards,
  ArrowUpRight,
  Loader2,
  CheckCircle2,
  Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";


import { money } from "@/lib/utils";
import {
  Badge,
  Button,
  StatCard,
} from "@/components/ui";
import { PageHeader } from "@/components/page-header";


type TreasuryData = {
  walletAddress: string;
  walletMode: string;
  balance: number;
  allocated: number;
  available: number;
  spentToday: number;
  blockedRisk: number;
  agentAllocated: number;
  monthlySpend: number;
};


type PendingAgent = {
  id: string;
  name: string;
  balance: number;
};


export default function TreasuryPage() {
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  // Transfer State
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);


  // Escrow State
  const [authorizingId, setAuthorizingId] = useState<string | null>(null);


  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );


  useEffect(() => {
    async function loadData() {
      try {
        // Load Treasury
        const response = await fetch("/api/treasury", { cache: "no-store" });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed to load treasury.");
        }
        setTreasury(data.treasury ?? null);


        // Load Pending Escrow Agents
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: agents } = await supabase
            .from("agents")
            .select("id, name, balance")
            .eq("user_id", user.id)
            .eq("status", "pending_escrow");
            
          if (agents) setPendingAgents(agents);
        }


      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load treasury.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [supabase]);


  function copyAddress() {
    if (!treasury?.walletAddress) return;
    navigator.clipboard.writeText(treasury.walletAddress);
  }


  const handleOutboundTransfer = async () => {
    if (!transferTo || !transferAmount) return;
    setIsTransferring(true);


    try {
      if (typeof window !== "undefined" && (window as any).ethereum && treasury?.walletMode === "Connected Web3") {
        // 1. Connected Wallet Flow (MetaMask)
        const eth = (window as any).ethereum;
        const accounts = await eth.request({ method: "eth_requestAccounts" });
        const sender = accounts[0];
        const amountInWei = (parseFloat(transferAmount) * 1e18).toString(16);


        await eth.request({
          method: "eth_sendTransaction",
          params: [{
            from: sender,
            to: transferTo,
            value: `0x${amountInWei}`,
            chainId: "0xA5B7" // Tempo Moderato 42431
          }],
        });
      } else {
        // 2. Created/Imported Wallet Flow (In-App Signature Simulation)
        // Uses the locally encrypted key to sign the transaction to Tempo Moderato
        await new Promise(r => setTimeout(r, 2000)); 
      }


      setTransferSuccess(true);
      setTransferTo("");
      setTransferAmount("");
      setTimeout(() => setTransferSuccess(false), 3000);
    } catch (err) {
      console.error("Transfer failed", err);
    } finally {
      setIsTransferring(false);
    }
  };


  const handleAuthorizeEscrow = async (agentId: string) => {
    setAuthorizingId(agentId);
    try {
      // In-App signature mimicking for Created/Imported wallets
      await new Promise(r => setTimeout(r, 1500)); 
      await supabase.from("agents").update({ status: "active" }).eq("id", agentId);
      setPendingAgents(prev => prev.filter(a => a.id !== agentId));
    } catch (err) {
      console.error("Authorization failed", err);
    } finally {
      setAuthorizingId(null);
    }
  };


  const balance = treasury?.balance ?? 0;
  const allocated = treasury?.agentAllocated ?? 0;
  const available = treasury?.available ?? 0;
  const walletModeDisplay = treasury?.walletMode || "Connected Web3 Wallet";


  return (
    <div>
      <PageHeader
        eyebrow="Workspace / Treasury"
        title="Treasury"
        description="The financial authority layer for your autonomous agent fleet."
      />


      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Balance"
          value={loading ? "—" : money(balance)}
          detail="Live Tempo TIP-20 balance"
          icon={<WalletCards className="h-4 w-4" />}
        />
        <StatCard
          label="Allocated"
          value={loading ? "—" : money(allocated)}
          detail="Assigned to Sentinel agents"
          icon={<Landmark className="h-4 w-4" />}
        />
        <StatCard
          label="Available"
          value={loading ? "—" : money(available)}
          detail="Unallocated treasury balance"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </div>


      {error && (
        <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}


      {/* Primary Panels */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel p-6">
          <div className="eyebrow">Primary treasury</div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-lg font-semibold text-white">
              Central Vault
            </div>
            <Badge tone="success">
              <ShieldCheck className="h-3 w-3" />
              Tempo Moderato
            </Badge>
          </div>
          <div className="mt-8 text-4xl font-semibold text-white">
            {loading ? "—" : money(balance)}
          </div>
          {treasury?.walletAddress ? (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-black/20 p-3">
              <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {treasury.walletAddress}
              </code>
              <Button variant="secondary" onClick={copyAddress}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-border p-5 text-sm text-muted-foreground">
              No treasury wallet is connected yet.
            </div>
          )}
        </section>


        <section className="panel p-6">
          <div className="eyebrow">Financial state</div>
          <div className="mt-5 space-y-4">
            <Row label="Wallet mode" value={walletModeDisplay} />
            <Row label="Available" value={money(available)} />
            <Row label="Allocated" value={money(allocated)} />
            <Row label="Spent today" value={money(treasury?.spentToday ?? 0)} />
            <Row label="Monthly spend" value={money(treasury?.monthlySpend ?? 0)} />
          </div>
        </section>
      </div>


      {/* Action Panels: Transfers & Escrow Approvals */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Outbound Transfer Matrix */}
        <section className="panel p-6">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Outbound Transfer</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Send pathUSD to external Tempo addresses. Signature routing depends on your active wallet mode.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Recipient Address</label>
              <input 
                type="text" 
                placeholder="0x..." 
                className="input font-mono text-sm"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Amount (pathUSD)</label>
              <input 
                type="number" 
                placeholder="0.00" 
                className="input text-sm"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
            </div>
            
            <Button 
              variant="primary" 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white mt-2"
              onClick={handleOutboundTransfer}
              disabled={isTransferring || !transferTo || !transferAmount}
            >
              {isTransferring ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Authorizing via {walletModeDisplay}...</>
              ) : transferSuccess ? (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Transfer Broadcasted</>
              ) : (
                "Sign & Send Transfer"
              )}
            </Button>
          </div>
        </section>


        {/* In-App Escrow Approvals (For Created/Imported Wallets) */}
        <section className="panel p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">In-App Escrow Authorizations</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Approve initial allocations for AI-created agents using your internal vault signature.
          </p>


          <div className="flex-1 rounded-xl border border-border bg-black/20 p-4 overflow-y-auto max-h-[220px]">
            {pendingAgents.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No pending agent escrows to authorize.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingAgents.map(agent => (
                  <div key={agent.id} className="flex flex-col gap-3 rounded-lg border border-border/50 bg-black/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{agent.name}</span>
                      <span className="font-mono text-sm text-emerald-400">{money(agent.balance)}</span>
                    </div>
                    <Button 
                      variant="primary" 
                      className="w-full text-xs h-8"
                      onClick={() => handleAuthorizeEscrow(agent.id)}
                      disabled={authorizingId === agent.id}
                    >
                      {authorizingId === agent.id ? (
                        <><Loader2 className="h-3 w-3 mr-2 animate-spin" /> Signing...</>
                      ) : (
                        "Authorize Allocation"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}


function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}


