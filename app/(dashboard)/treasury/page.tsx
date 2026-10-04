"use client";


import {
  Copy,
  Landmark,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";


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


export default function TreasuryPage() {
  const [treasury, setTreasury] =
    useState<TreasuryData | null>(null);


  const [loading, setLoading] =
    useState(true);


  const [error, setError] =
    useState("");


  useEffect(() => {
    async function loadTreasury() {
      try {
        const response = await fetch(
          "/api/treasury",
          {
            cache: "no-store",
          },
        );


        const data =
          await response.json();


        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load treasury.",
          );
        }


        setTreasury(
          data.treasury ?? null,
        );
      } catch (err) {
        console.error(err);


        setError(
          err instanceof Error
            ? err.message
            : "Failed to load treasury.",
        );
      } finally {
        setLoading(false);
      }
    }


    loadTreasury();
  }, []);


  function copyAddress() {
    if (!treasury?.walletAddress) return;


    navigator.clipboard.writeText(
      treasury.walletAddress,
    );
  }


  const balance =
    treasury?.balance ?? 0;


  const allocated =
    treasury?.agentAllocated ?? 0;


  const available =
    treasury?.available ?? 0;


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
          value={
            loading
              ? "—"
              : money(balance)
          }
          detail="Live Tempo TIP-20 balance"
          icon={
            <WalletCards className="h-4 w-4" />
          }
        />


        <StatCard
          label="Allocated"
          value={
            loading
              ? "—"
              : money(allocated)
          }
          detail="Assigned to Sentinel agents"
          icon={
            <Landmark className="h-4 w-4" />
          }
        />


        <StatCard
          label="Available"
          value={
            loading
              ? "—"
              : money(available)
          }
          detail="Unallocated treasury balance"
          icon={
            <ShieldCheck className="h-4 w-4" />
          }
        />
      </div>


      {error && (
        <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}


      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="panel p-6">
          <div className="eyebrow">
            Primary treasury
          </div>


          <div className="mt-3 flex items-center justify-between">
            <div className="text-lg font-semibold text-white">
              Connected Treasury
            </div>


            <Badge tone="success">
              <ShieldCheck className="h-3 w-3" />
              Tempo
            </Badge>
          </div>


          <div className="mt-8 text-4xl font-semibold text-white">
            {loading
              ? "—"
              : money(balance)}
          </div>


          {treasury?.walletAddress ? (
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-black/20 p-3">
              <code className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {treasury.walletAddress}
              </code>


              <Button
                variant="secondary"
                onClick={copyAddress}
              >
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
          <div className="eyebrow">
            Financial state
          </div>


          <div className="mt-5 space-y-4">
            <Row
              label="Wallet mode"
              value={
                treasury?.walletMode ||
                "Not connected"
              }
            />


            <Row
              label="Available"
              value={money(available)}
            />


            <Row
              label="Allocated"
              value={money(allocated)}
            />


            <Row
              label="Spent today"
              value={money(
                treasury?.spentToday ?? 0,
              )}
            />


            <Row
              label="Monthly spend"
              value={money(
                treasury?.monthlySpend ?? 0,
              )}
            />
          </div>
        </section>
      </div>
    </div>
  );
}


function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/70 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">
        {label}
      </span>


      <span className="text-sm font-medium text-white">
        {value}
      </span>
    </div>
  );
}


