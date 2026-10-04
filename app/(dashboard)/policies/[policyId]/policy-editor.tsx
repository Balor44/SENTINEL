"use client";


import { ArrowLeft, Check, Save } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Policy } from "@/types";
import { Button, Badge } from "@/components/ui";


export default function PolicyEditor({ policy }: { policy: Policy }) {
  const [daily, setDaily] = useState(String(policy.dailyBudget ?? policy.dailyLimit ?? 0));
  const [tx, setTx] = useState(String(policy.transactionLimit ?? policy.txLimit ?? 0));
  const [approval, setApproval] = useState(String(policy.approvalThreshold ?? 0));
  const [saved, setSaved] = useState(false);


  async function save() {
    if (!policy) return;


    // Pointing to your /api/setup route because it safely updates BOTH 
    // the agents table and the policies table in one secure backend transaction
    await fetch(`/api/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        policyUpdate: {
          agentId: policy.agentId,
          dailyBudget: Number(daily),
          transactionLimit: Number(tx),
          approvalThreshold: Number(approval),
        }
      }),
    });


    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }


  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/policies" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white">
        <ArrowLeft className="h-4 w-4"/>Back to policies
      </Link>
      
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">Policy editor</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">{policy.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Applied to {policy.agent ?? policy.agentId}</p>
        </div>
        <Button variant="primary" onClick={save}>
          <Save className="h-4 w-4"/>Save policy
        </Button>
      </div>


      {saved && (
        <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          <Check className="mr-2 inline h-4 w-4"/>Policy saved.
        </div>
      )}


      <div className="mt-6 space-y-4">
        <section className="panel p-5">
          <div className="font-medium text-white">Spending limits</div>
          <div className="mt-1 text-sm text-muted-foreground">Hard limits are evaluated before transaction execution.</div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Field label="Daily spend limit" value={daily} setValue={setDaily}/>
            <Field label="Max transaction" value={tx} setValue={setTx}/>
            <Field label="Approval threshold" value={approval} setValue={setApproval}/>
          </div>
        </section>


        <section className="panel p-5">
          <div className="font-medium text-white">Recipient allowlist</div>
          <div className="mt-1 text-sm text-muted-foreground">Only these destinations can settle automatically.</div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(policy.allowlistedRecipients ?? policy.recipients ?? []).map((r: string) => (
              <Badge key={r} tone="purple">{r}</Badge>
            ))}
            {(policy.allowlistedRecipients ?? policy.recipients ?? []).length === 0 && (
              <span className="text-xs text-muted-foreground">No allowed recipients configured.</span>
            )}
          </div>
        </section>


        <section className="panel p-5">
          <div className="font-medium text-white">Defense in depth</div>
          <p className="mt-1 text-sm text-muted-foreground">Sentinel evaluates organizational policy first; Tempo settlement is the execution layer.</p>
        </section>
      </div>
    </div>
  );
}


function Field({ label, value, setValue }: { label: string; value: string; setValue: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative mt-2">
        <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
        <input 
          className="input pl-7" 
          value={value} 
          onChange={(e) => setValue(e.target.value)} 
          type="number" 
        />
      </div>
    </div>
  );
}


