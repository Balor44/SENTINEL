"use client";


import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import Link from "next/link";


type AgentMin = {
  id: string;
  name: string;
  balance: number;
  dailyLimit: number;
  spentToday: number;
};


export default function TransactionForm({ agents }: { agents: AgentMin[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [description, setDescription] = useState("Autonomous test execution");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ hash: string; message: string } | null>(null);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);


    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          amount: Number(amount),
          recipient,
          description,
        }),
      });


      const data = await res.json();


      if (!res.ok) {
        throw new Error(data.error || "Transaction failed");
      }


      setSuccess({
        hash: data.txHash,
        message: data.message,
      });
      
      // Clear form on success
      setAmount("");
      setRecipient("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }


  if (agents.length === 0) {
    return (
      <div className="panel p-10 text-center text-muted-foreground">
        You need to create an active agent before you can execute a transaction.
      </div>
    );
  }


  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div className="panel p-6 space-y-6">
        
        {/* Error State - This is where Policy Engine rejections appear */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div className="text-sm">{error}</div>
          </div>
        )}


        {/* Success State */}
        {success && (
          <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-200">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div className="text-sm font-medium">{success.message}</div>
            </div>
            <div className="text-xs text-emerald-200/70 font-mono break-all pl-8">
              Tx Hash: {success.hash}
            </div>
          </div>
        )}


        <div>
          <label className="text-sm font-medium text-white">Select Agent</label>
          <p className="text-xs text-muted-foreground mb-2">The autonomous agent authorizing this spend.</p>
          <select 
            className="input w-full bg-black/20"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            required
          >
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} (Available: ${(a.dailyLimit || 0) - (a.spentToday || 0)} today)
              </option>
            ))}
          </select>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-white">Amount (pathUSD)</label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
              <input 
                type="number"
                step="0.01"
                min="0.01"
                required
                className="input pl-7 w-full"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>


          <div>
            <label className="text-sm font-medium text-white">Recipient Address</label>
            <div className="mt-2">
              <input 
                type="text"
                required
                placeholder="0x..."
                className="input w-full"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
          </div>
        </div>


        <div>
          <label className="text-sm font-medium text-white">Description</label>
          <div className="mt-2">
            <input 
              type="text"
              className="input w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>


        <div className="pt-4 flex items-center justify-between border-t border-border">
          <Link href="/transactions" className="text-sm text-muted-foreground hover:text-white transition-colors">
            Cancel
          </Link>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? "Executing..." : "Execute on Tempo"}
          </Button>
        </div>
      </div>
    </form>
  );
}


