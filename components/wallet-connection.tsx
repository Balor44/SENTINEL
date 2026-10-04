"use client";


import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Smartphone, WalletCards, X } from "lucide-react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui";


function shortAddress(address?: string) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
}


export function WalletConnection({ compact = false, onWalletReady }: { compact?: boolean; onWalletReady?: (address: string, mode: "created" | "imported" | "connected") => void }) {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "create" | "import" | "connect">("menu");
  const [privateKey, setPrivateKey] = useState("");
  const [createdKey, setCreatedKey] = useState("");
  const [walletError, setWalletError] = useState("");


  const wc = connectors.find((c) => c.name.toLowerCase().includes("walletconnect"));
  const injectedConnectors = connectors.filter((c) => !c.name.toLowerCase().includes("walletconnect"));


  // The database sync function
  async function syncWalletToDatabase(walletAddress: string) {
    try {
      await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
    } catch (err) {
      console.error("Failed to sync wallet to account:", err);
    }
  }


  // 1. Trigger sync when an external wallet connects via Wagmi
  useEffect(() => {
    if (isConnected && address) {
      setOpen(false);
      syncWalletToDatabase(address);
      onWalletReady?.(address, "connected");
    }
  }, [isConnected, address, onWalletReady]);


  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="font-medium text-white">{shortAddress(address)}</span>
          {!compact && <span className="text-muted-foreground">{chain?.name ?? "Wallet"}</span>}
        </div>
        <Button variant="ghost" onClick={() => disconnect()} className="text-xs">Disconnect</Button>
      </div>
    );
  }


  // 2. Trigger sync when a fresh wallet is generated locally
  function createWallet() {
    setWalletError("");
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    setCreatedKey(key);
    syncWalletToDatabase(account.address);
    onWalletReady?.(account.address, "created");
  }


  // 3. Trigger sync when an existing private key is imported
  function importWallet() {
    try {
      setWalletError("");
      const normalized = privateKey.trim() as `0x${string}`;
      const account = privateKeyToAccount(normalized);
      syncWalletToDatabase(account.address);
      onWalletReady?.(account.address, "imported");
    } catch {
      setWalletError("That private key is invalid. It must be a 32-byte 0x-prefixed key.");
    }
  }


  return (
    <div className="relative">
      <Button variant="primary" onClick={() => { setOpen((v) => !v); setMode("menu"); }} disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WalletCards className="mr-2 h-4 w-4" />}
        {compact ? "Wallet" : "Set up treasury wallet"}
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-[#0b0b12] p-4 shadow-2xl">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-white">How do you want to manage the treasury?</div>
              <div className="mt-1 text-xs text-muted-foreground">Sentinel supports self-custody and external wallets.</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-white"><X className="h-4 w-4" /></button>
          </div>


          {mode === "menu" && (
            <div className="space-y-2">
              <button onClick={() => { setMode("create"); createWallet(); }} className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-left hover:bg-primary/15">
                <WalletCards className="h-5 w-5 text-primary" />
                <span><b className="block text-sm text-white">Create a Sentinel wallet</b><small className="text-xs text-muted-foreground">Generate a self-custody wallet in your browser.</small></span>
              </button>
              <button onClick={() => setMode("import")} className="flex w-full items-center gap-3 rounded-xl border border-border bg-white/[0.03] p-3 text-left hover:bg-white/[0.07]">
                <KeyRound className="h-5 w-5 text-white" />
                <span><b className="block text-sm text-white">Import existing wallet</b><small className="text-xs text-muted-foreground">Use a private key you already control.</small></span>
              </button>
              <button onClick={() => setMode("connect")} className="flex w-full items-center gap-3 rounded-xl border border-border bg-white/[0.03] p-3 text-left hover:bg-white/[0.07]">
                <Smartphone className="h-5 w-5 text-white" />
                <span><b className="block text-sm text-white">Connect external wallet</b><small className="text-xs text-muted-foreground">WalletConnect, MetaMask and other browser wallets.</small></span>
              </button>
              {!wc && <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">WalletConnect will appear as a selectable QR option after you add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to .env.local.</div>}
            </div>
          )}


          {mode === "connect" && <div className="space-y-2">
            <button onClick={() => setMode("menu")} className="mb-2 text-xs text-muted-foreground hover:text-white">← Back</button>
            {injectedConnectors.map((connector) => <button key={connector.uid} onClick={() => connect({ connector })} className="flex w-full items-center justify-between rounded-xl border border-border bg-white/[0.03] px-3 py-3 text-left text-sm text-white hover:bg-white/[0.07]"><span>{connector.name}</span><span className="text-[10px] text-muted-foreground">Browser</span></button>)}
            {wc && <button onClick={() => connect({ connector: wc })} className="flex w-full items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 text-left text-sm text-white hover:bg-primary/15"><span>WalletConnect</span><span className="text-[10px] text-muted-foreground">QR / mobile</span></button>}
            {!wc && <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200"><div className="font-medium text-amber-100">WalletConnect QR</div><div className="mt-1">Add a WalletConnect Cloud Project ID to enable QR/mobile pairing.</div></div>}
          </div>}


          {mode === "create" && <div className="space-y-3">
            <button onClick={() => setMode("menu")} className="text-xs text-muted-foreground hover:text-white">← Back</button>
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-100">Your private key is generated locally. Sentinel does not receive it. Save the backup before continuing.</div>
            <div className="rounded-xl border border-border bg-black/20 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Private key backup</div><div className="mt-2 break-all font-mono text-[11px] text-white">{createdKey}</div></div>
            <button onClick={() => navigator.clipboard?.writeText(createdKey)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs text-white hover:bg-white/[0.05]"><Copy className="h-3 w-3" /> Copy backup</button>
            <div className="text-xs text-emerald-200">Wallet created. Address: {shortAddress(privateKeyToAccount(createdKey as `0x${string}`).address)}</div>
          </div>}


          {mode === "import" && <div className="space-y-3">
            <button onClick={() => setMode("menu")} className="text-xs text-muted-foreground hover:text-white">← Back</button>
            <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-200">Never paste a wallet key into a website you do not trust. For this demo, the key stays in browser memory and is not sent to Sentinel.</div>
            <input className="input font-mono text-xs" type="password" placeholder="0x… private key" value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} />
            {walletError && <div className="text-xs text-red-300">{walletError}</div>}
            <Button variant="primary" className="w-full" onClick={importWallet}>Import wallet</Button>
          </div>}


          {error && <div className="mt-3 rounded-lg bg-red-400/10 p-2 text-xs text-red-300">{error.message}</div>}
          <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground"><Check className="h-3 w-3" /> Sentinel never asks an external wallet for its private key.</div>
        </div>
      )}
    </div>
  );
}


