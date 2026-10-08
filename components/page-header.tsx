"use client";


import { ReactNode, useEffect, useState } from "react";
import { UserRound, Layers, Coins } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";


// 1. Your original PageHeader layout
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="subtle mt-2 max-w-2xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}


// 2. The new telemetry widget
export function ProfileWidget() {
  const [activeCount, setActiveCount] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);


  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );


  useEffect(() => {
    async function loadTelemetry() {
      const { data: fleet } = await supabase.from("agents").select("status, balance");
      if (fleet) {
        setActiveCount(fleet.filter(a => a.status === "active").length);
        setTotalBalance(fleet.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0));
      }
    }
    loadTelemetry();
  }, [supabase]);


  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-black/20 p-3 shadow-sm backdrop-blur-md">
      <div className="flex items-center gap-3 border-r border-border/50 pr-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
          <UserRound className="h-5 w-5" />
        </div>
        <div className="hidden text-left sm:block">
          <div className="text-xs font-medium text-white">Operator Profile</div>
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Moderato (42431)
          </div>
        </div>
      </div>


      <div className="flex items-center gap-4 pl-1">
        <div className="hidden flex-col items-end sm:flex">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-violet-400" /> Active
          </div>
          <div className="text-sm font-medium text-white">{activeCount}</div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-emerald-400" /> Allocation
          </div>
          <div className="font-mono text-sm font-medium text-white">
            ${totalBalance.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}


