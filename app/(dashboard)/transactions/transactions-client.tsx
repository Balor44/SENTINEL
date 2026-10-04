"use client";


import { Download, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Badge } from "@/components/ui";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { money } from "@/lib/utils";
import type { Transaction } from "@/types";


export default function TransactionsClient({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");


  const rows = useMemo(() => initialTransactions.filter((tx) => {
    // Added tx.description to the search string to match the backend POST route
    const searchString = [tx.id, tx.agent ?? tx.agentName ?? (tx as any).agentId, tx.recipient, tx.purpose ?? (tx as any).description].join(" ").toLowerCase();
    const matchesQuery = searchString.includes(query.toLowerCase());
    return matchesQuery && (status === "all" || tx.status === status);
  }), [initialTransactions, query, status]);


  return (
    <div>
      <PageHeader
        eyebrow="Workspace / Transactions"
        title="Transactions"
        description="Auditable payment activity across the agent fleet."
        action={<Button><Download className="h-4 w-4" />Export</Button>}
      />
      <div className="panel mb-4 p-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              className="input pl-9 w-full"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agent, recipient, purpose..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select className="input w-auto min-w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="completed">Completed</option>
              <option value="settled">Settled</option>
              <option value="approved">Approved</option>
              <option value="blocked">Blocked</option>
              <option value="approval_required">Approval Required</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Agent</th>
              <th className="px-5 py-3">Recipient</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">
                  No transactions match your filters.
                </td>
              </tr>
            ) : (
              rows.map((tx) => (
                <tr key={tx.id} className="border-b border-border/70 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <Link href={`/transactions/${tx.id}`} className="text-violet-300 hover:text-violet-200">
                      {tx.id.replace("tx_", "").substring(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-white font-mono">
                    {tx.agent ?? tx.agentName ?? tx.agentId?.substring(0, 8)}
                  </td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">
                    <span className="font-mono">{tx.recipient?.substring(0, 12)}...</span>
                    <div className="text-xs mt-1">{tx.purpose ?? (tx as any).description}</div>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-white">{money(tx.amount)}</td>
                  <td className="px-5 py-4">
                    <Badge tone={["settled", "approved", "completed"].includes(tx.status as string) ? "success" : ["blocked", "failed"].includes(tx.status as string) ? "danger" : "warning"}>
                      {tx.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {tx.time ?? new Date(tx.createdAt || Date.now()).toLocaleTimeString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


