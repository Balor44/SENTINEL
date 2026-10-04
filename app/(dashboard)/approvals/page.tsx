// app/(dashboard)/approvals/page.tsx
"use client";


import { Check, Clock3, ExternalLink, ShieldAlert, X, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { money } from "@/lib/utils";
import { Badge, Button } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import type { Approval } from "@/types";


export default function ApprovalsPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);


  // Fetch the live approvals queue
  useEffect(() => {
    fetch("/api/approvals", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.approvals) {
          // Only show items that are still pending
          setItems(data.approvals.filter((a: Approval) => a.status === "pending"));
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch approvals:", err);
        setIsLoading(false);
      });
  }, []);


  // Send the decision to the Next.js API to execute the Viem transaction
  const handleDecision = async (id: string, decision: "approved" | "rejected") => {
    setProcessingId(id); // Trigger the loading spinner
    
    try {
      const res = await fetch(`/api/approvals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision })
      });


      if (res.ok) {
        // Remove the processed item from the UI queue
        setItems((current) => current.filter((item) => item.id !== id));
      } else {
        const data = await res.json();
        console.error("Execution failed:", data.error);
        alert(`Execution failed: ${data.error}`);
      }
    } catch (err) {
      console.error("Network error:", err);
    } finally {
      setProcessingId(null);
    }
  };


  return (
    <div>
      <PageHeader 
        eyebrow="Workspace / Approvals" 
        title="Approval queue" 
        description="Human review for payments that fall outside an agent’s automatic authority." 
      />
      
      {isLoading ? (
        <div className="panel flex min-h-64 items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="panel flex min-h-64 flex-col items-center justify-center p-8 text-center">
          <Check className="h-8 w-8 text-emerald-300" />
          <div className="mt-3 text-sm font-medium text-white">Queue cleared</div>
          <p className="mt-1 text-sm text-muted-foreground">No payments need human review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <section key={item.id} className="panel p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10">
                    <ShieldAlert className="h-5 w-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-white">{item.agent ?? item.agentName}</span>
                      <Badge tone="warning"><Clock3 className="h-3 w-3" />Pending</Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {item.purpose ?? "Payment request"} → {item.recipient}
                    </div>
                    <div className="mt-3 text-xs text-amber-200">{item.reason}</div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="text-xl font-semibold text-white">{money(item.amount)}</div>
                  
                  <Button 
                    disabled={processingId === item.id} 
                    onClick={() => handleDecision(item.id, "rejected")}
                  >
                    <X className="h-4 w-4" />Reject
                  </Button>
                  
                  <Button 
                    variant="primary" 
                    disabled={processingId === item.id}
                    onClick={() => handleDecision(item.id, "approved")}
                  >
                    {processingId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {processingId === item.id ? "Executing..." : "Approve"}
                  </Button>
                </div>
              </div>
              <div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()} · Review against policy · 
                <span className="cursor-pointer text-violet-300 hover:text-violet-200">
                  {" "}Open payment context <ExternalLink className="ml-1 inline h-3 w-3" />
                </span>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}