"use client";


import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  Activity,
  Bot,
  CircleDollarSign,
  FileCheck2,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  WalletCards,
  X,
  UserRound,
  Layers,
  Coins,
} from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { WalletConnection } from "@/components/wallet-connection";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";


const nav = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/treasury", label: "Treasury", icon: WalletCards },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/policies", label: "Policies", icon: ShieldCheck },
  { href: "/approvals", label: "Approvals", icon: FileCheck2 },
  { href: "/transactions", label: "Transactions", icon: Activity },
];


function Sidebar({ mobile = false, close }: { mobile?: boolean; close?: () => void }) {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);


  useEffect(() => {
    let cancelled = false;


    async function checkApprovals() {
      try {
        const res = await fetch("/api/approvals");
        const data = await res.json();
       
        if (!cancelled && data.approvals) {
          setPendingCount(data.approvals.length);
        }
      } catch (err) {
        console.error("Failed to check approvals:", err);
      }
    }


    checkApprovals();
    const interval = setInterval(checkApprovals, 10000);


    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);


  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-border bg-[#0b0b12]",
        mobile ? "fixed inset-y-0 left-0 z-50 shadow-2xl" : "hidden lg:flex"
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-border px-5">
        <Link href="/overview" className="flex items-center gap-2" onClick={close}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-glow">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-[0.18em] text-white">SENTINEL</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Agent finance control
            </div>
          </div>
        </Link>
        {mobile && (
          <button type="button" onClick={close} className="text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>


      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Workspace
        </div>
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");


            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-primary/10 text-violet-200"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-white"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {item.href === "/approvals" && pendingCount > 0 && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-violet-300">
                    {pendingCount}
                  </span>
                )}
                {item.href !== "/approvals" && (item as any).count && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-violet-300">
                    {(item as any).count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>


        <div className="mb-2 mt-8 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          System
        </div>
        <Link
          href="/settings"
          onClick={close}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
            pathname.startsWith("/settings")
              ? "bg-primary/10 text-violet-200"
              : "text-muted-foreground hover:bg-white/[0.04] hover:text-white"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>


      <div className="border-t border-border p-3">
        <div className="rounded-xl border border-border bg-white/[0.025] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white">Tempo testnet</span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Payments-first settlement layer
          </div>
        </div>
      </div>
    </aside>
  );
}


function Topbar({ openMenu }: { openMenu: () => void }) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [isOpen, setIsOpen] = useState(false);
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
  
  // Profile Telemetry State
  const [activeCount, setActiveCount] = useState(0);
  const [totalAllocation, setTotalAllocation] = useState(0);
  const [userEmail, setUserEmail] = useState("operator@sentinel.network");
  
  const dropdownRef = useRef<HTMLDivElement>(null);


  // Fetch Treasury Data
  useEffect(() => {
    let cancelled = false;
    async function loadTreasury() {
      try {
        const response = await fetch("/api/treasury", { cache: "no-store" });
        if (!response.ok) throw new Error("Treasury request failed.");
        const data = await response.json();
        if (cancelled) return;
        const value = Number(data?.treasury?.balance);
        if (Number.isFinite(value)) {
          setTreasuryBalance(value);
        } else {
          setTreasuryBalance(0);
        }
      } catch (error) {
        if (!cancelled) setTreasuryBalance(0);
      }
    }
    loadTreasury();
    const interval = window.setInterval(loadTreasury, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);


  // Fetch Operator Telemetry Data
  useEffect(() => {
    async function loadTelemetry() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);


      const { data: fleet } = await supabase.from("agents").select("status, balance");
      if (fleet) {
        setActiveCount(fleet.filter(a => a.status === "active").length);
        setTotalAllocation(fleet.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0));
      }
    }
    loadTelemetry();
  }, [supabase]);


  // Handle click outside dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };


  const displayedBalance = treasuryBalance === null ? "—" : `$${treasuryBalance.toFixed(2)}`;


  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-[#0b0b12]/80 px-4 backdrop-blur md:px-6">
      <button
        type="button"
        onClick={openMenu}
        className="rounded-lg p-2 text-muted-foreground hover:bg-white/[0.05] lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>


      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/treasury"
          className="hidden items-center gap-2 rounded-xl border border-border bg-white/[0.025] px-3 py-2 text-xs text-muted-foreground transition hover:bg-white/[0.05] hover:text-white sm:flex"
        >
          <CircleDollarSign className="h-3.5 w-3.5" />
          Treasury
          <span className="font-medium text-white">{displayedBalance}</span>
        </Link>


        <div className="relative" ref={dropdownRef}>
          {/* Replaced generic gradient with precise user button */}
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-black/40 transition-colors hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <UserRound className="h-4 w-4 text-emerald-400" />
          </button>


          {isOpen && (
            <div className="absolute right-0 z-50 mt-3 w-64 rounded-xl border border-border bg-[#0b0b12] p-4 shadow-2xl backdrop-blur-xl">
              
              {/* Operator Header */}
              <div className="mb-4 border-b border-border/50 pb-3">
                <div className="truncate text-sm font-semibold text-white">{userEmail}</div>
                <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Moderato (42431)
                </div>
              </div>


              {/* Fleet Telemetry Metrics */}
              <div className="mb-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Layers className="h-4 w-4 text-violet-400" />
                    Active Fleet
                  </div>
                  <div className="font-medium text-white">{activeCount}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Coins className="h-4 w-4 text-emerald-400" />
                    Allocation
                  </div>
                  <div className="font-mono text-white">${totalAllocation.toFixed(2)}</div>
                </div>
              </div>


              {/* Wallet Connection (Retained from original) */}
              <div className="mb-3 flex w-full justify-center">
                <WalletConnection compact />
              </div>


              <div className="my-2 h-px bg-border/50" />


              {/* Sign Out */}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}


export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);


  return (
    <div className="min-h-screen lg:flex">
      <Sidebar />
      {open && <Sidebar mobile close={() => setOpen(false)} />}
      <div className="min-w-0 flex-1">
        <Topbar openMenu={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}


