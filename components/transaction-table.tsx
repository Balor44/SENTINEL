"use client";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "./ui";
import { money } from "@/lib/utils";
import type { Transaction } from "@/types";


function statusBadge(status: string) {
  if (status === "settled") return <Badge tone="success"><CheckCircle2 className="h-3 w-3" />Settled</Badge>;
  if (status === "blocked") return <Badge tone="danger"><ShieldAlert className="h-3 w-3" />Blocked</Badge>;
  if (status === "approval_required" || status === "approval") return <Badge tone="warning"><Clock3 className="h-3 w-3" />Approval</Badge>;
  return <Badge><Clock3 className="h-3 w-3" />Pending</Badge>;
}


export function TransactionTable({ limit }: { limit?: number }) {
  const [rows, setRows] = useState<Transaction[]>([]);
  
  useEffect(() => {
    fetch("/api/transactions", { cache: "no-store" })
      .then(r => r.json())
      .then(d => setRows(d.transactions || []));
  }, []);
  
  const visible = limit ? rows.slice(0, limit) : rows;
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-left">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <th className="px-5 py-3 font-medium">Payment</th>
            <th className="px-5 py-3 font-medium">Agent</th>
            <th className="px-5 py-3 font-medium">Amount</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Time</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {visible.map((tx: any) => (
            <tr key={tx.id} className="border-b border-border/70 last:border-0">
              <td className="px-5 py-4">
                <div className="font-medium text-white">{tx.purpose || tx.reason || "Payment intent"}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{tx.recipient}</div>
              </td>
              {/* FIX: Ensure agentName maps correctly and has a fallback */}
              <td className="px-5 py-4 text-sm text-muted-foreground">{tx.agentName || tx.agent_name || "Unknown"}</td>
              <td className="px-5 py-4 text-sm font-medium text-white">{money(tx.amount)}</td>
              <td className="px-5 py-4">{statusBadge(tx.status)}</td>
              {/* FIX: Use snake_case created_at to avoid Invalid Date crash */}
              <td className="px-5 py-4 text-xs text-muted-foreground">
                {tx.time || new Date(tx.created_at || tx.createdAt || Date.now()).toLocaleString()}
              </td>
              <td className="px-3 py-4 text-right">
                <Link href={`/transactions/${tx.id}`} className="inline-flex rounded-lg p-2 text-muted-foreground hover:bg-white/[0.05] hover:text-white">
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


