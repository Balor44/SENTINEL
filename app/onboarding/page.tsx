"use client";


import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bot, Check, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { useAccount, useSignTypedData, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui";
import { WalletConnection } from "@/components/wallet-connection";


const steps = ["Organization", "Wallet", "Agent", "Policy", "Fund", "Test payment"];
const DRAFT_KEY = "sentinel_onboarding_draft";


type WalletMode = "created" | "imported" | "connected" | "";


type Draft = {
  step: number; org: string; agent: string; purpose: string;
  daily: string; tx: string; approval: string; fund: string;
  recipient: string; walletMode: WalletMode; walletAddress: string;
};


export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);


  const [org, setOrg] = useState("");
  const [agent, setAgent] = useState("");
  const [purpose, setPurpose] = useState("");


  const [daily, setDaily] = useState("100");
  const [tx, setTx] = useState("10");
  const [approval, setApproval] = useState("25");


  const [fund, setFund] = useState("");
  const [recipient, setRecipient] = useState("");


  const [walletMode, setWalletMode] = useState<WalletMode>("");
  const [walletAddress, setWalletAddress] = useState("");


  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);


  const { isConnected, address, chain } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();


  useEffect(() => {
    let cancelled = false;


    async function loadSetup() {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          try {
            const draft = JSON.parse(saved) as Draft;
            if (cancelled) return;


            setStep(Math.min(Math.max(Number(draft.step) || 0, 0), 5));
            setOrg(draft.org || "");
            setAgent(draft.agent || "");
            setPurpose(draft.purpose || "");
            setDaily(draft.daily || "100");
            setTx(draft.tx || "10");
            setApproval(draft.approval || "25");
            setFund(draft.fund || "");
            setRecipient(draft.recipient || "");
            setWalletMode(draft.walletMode || "");
            setWalletAddress(draft.walletAddress || "");
          } catch {
            localStorage.removeItem(DRAFT_KEY);
          }
        }


        const response = await fetch("/api/setup", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load Sentinel setup.");

        const data = await response.json();
        if (cancelled) return;


        if (data?.setup?.onboardingComplete) {
          setIsRedirecting(true);
          router.replace("/overview");
          return;
        }


        if (data?.setup?.treasuryWallet) setWalletAddress(data.setup.treasuryWallet);
        if (data?.setup?.walletMode) setWalletMode(data.setup.walletMode);


        setReady(true);
      } catch (error) {
        console.error("Failed to load Sentinel setup:", error);
        if (!cancelled) setReady(true);
      }
    }


    loadSetup();
    return () => { cancelled = true; };
  }, [router]);


  useEffect(() => {
    if (isConnected && address && !walletMode) {
      setWalletAddress(address);
      setWalletMode("connected");
    }
  }, [isConnected, address, walletMode]);


  useEffect(() => {
    if (!ready) return;
    const draft: Draft = { step, org, agent, purpose, daily, tx, approval, fund, recipient, walletMode, walletAddress };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [ready, step, org, agent, purpose, daily, tx, approval, fund, recipient, walletMode, walletAddress]);


  async function post(body: any) {
    const response = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "Setup failed.");
    return data;
  }


  function validateStep() {
    if (step === 0 && !org.trim()) return "Enter your organization name.";
    if (step === 1) {
      const effectiveAddress = walletAddress || address || "";
      if (!effectiveAddress) return "Choose Create wallet, Import wallet, or Connect wallet.";
      if (!walletMode) return "Choose how Sentinel should use your treasury wallet.";
    }
    if (step === 2) {
      if (!agent.trim()) return "Enter an agent name.";
      if (!purpose.trim()) return "Describe what this agent is for.";
    }
    if (step === 3) {
      const dailyValue = Number(daily);
      const txValue = Number(tx);
      const approvalValue = Number(approval);
      if (!Number.isFinite(dailyValue) || dailyValue <= 0) return "Enter a valid daily spending limit.";
      if (!Number.isFinite(txValue) || txValue <= 0) return "Enter a valid transaction limit.";
      if (!Number.isFinite(approvalValue) || approvalValue <= 0) return "Enter a valid approval threshold.";
      if (!recipient.trim()) return "Enter an allowed recipient address.";
    }
    if (step === 4) {
      const amount = Number(fund);
      if (!Number.isFinite(amount) || amount <= 0) return "Enter an initial allocation greater than zero.";
    }
    return null;
  }


  async function next() {
    setStatus("");
    const validationError = validateStep();
    if (validationError) {
      setStatus(validationError);
      return;
    }


    setIsSaving(true);


    try {
      // --- AUTO-HEAL: If the server RAM wiped, quietly rebuild it using the browser draft ---
      if (step >= 3) {
        let checkRes = await fetch("/api/setup", { cache: "no-store" });
        let checkData = await checkRes.json();
        let exists = checkData.agents?.find((item: any) => item.name === agent);

        if (!exists?.id) {
          console.log("Server memory wipe detected. Auto-healing agent state...");
          await post({ organizationName: org.trim() });
          await post({ treasuryReady: true, treasuryWallet: walletAddress || address || "", walletMode: walletMode || "connected" });
          await post({
            agent: {
              name: agent.trim(),
              description: purpose.trim(),
              dailyBudget: Number(daily),
              transactionLimit: Number(tx),
              approvalThreshold: Number(approval),
              initialFunding: 0,
              recipients: [],
            },
          });
        }
      }
      // -------------------------------------------------------------------------------------


      if (step === 0) await post({ organizationName: org.trim() });
      if (step === 1) await post({ treasuryReady: true, treasuryWallet: walletAddress || address || "", walletMode });

      if (step === 2) {
        await post({
          agent: {
            name: agent.trim(),
            description: purpose.trim(),
            dailyBudget: Number(daily),
            transactionLimit: Number(tx),
            approvalThreshold: Number(approval),
            initialFunding: 0,
            recipients: [],
          },
        });
      }


      if (step === 3) {
        const setupResponse = await fetch("/api/setup", { cache: "no-store" });
        const setupData = await setupResponse.json();
        const first = setupData.agents?.find((item: any) => item.name.toLowerCase() === agent.trim().toLowerCase());
        if (!first?.id) throw new Error("Agent missing. Please refresh and try again.");
        await post({
          policyUpdate: {
            agentId: first.id, dailyBudget: Number(daily), transactionLimit: Number(tx),
            approvalThreshold: Number(approval), recipient: recipient.trim(),
          },
        });
      }


      if (step === 4) {
        const setupResponse = await fetch("/api/setup", { cache: "no-store" });
        const setupData = await setupResponse.json();
        const first = setupData.agents?.find((item: any) => item.name.toLowerCase() === agent.trim().toLowerCase());
        if (!first?.id) throw new Error("Agent missing. Please refresh and try again.");
        await post({ fundAgentId: first.id, amount: Number(fund) });
      }


      if (step === 5) {
        const setupResponse = await fetch("/api/setup", { cache: "no-store" });
        const setupData = await setupResponse.json();
        const first = setupData.agents?.find((item: any) => item.name.toLowerCase() === agent.trim().toLowerCase());
        if (!first?.id) throw new Error("Agent missing. Please refresh and try again.");


        let authorization = null;
        if (walletMode === "connected") {
          if (!isConnected) throw new Error("Your Web3 wallet was disconnected. Please reconnect.");
          const serviceAddress = process.env.NEXT_PUBLIC_SERVICE_ADDRESS;
          if (!serviceAddress) throw new Error("Backend service address is not configured.");
          if (chain?.id !== 42431) await switchChainAsync({ chainId: 42431 });


          authorization = await signTypedDataAsync({
            domain: { name: "Tempo", version: "1", chainId: 42431 },
            types: { Authorization: [{ name: "delegate", type: "address" }, { name: "expiry", type: "uint256" }] },
            primaryType: "Authorization",
            message: { delegate: serviceAddress as `0x${string}`, expiry: BigInt(Math.floor(Date.now() / 1000) + 31536000) },
          });
        }


        const payment = await fetch("/api/payment-intents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: first.id, recipient: recipient.trim(), recipientName: recipient.trim(),
            amount: 0.05, asset: "USD", memo: "Sentinel onboarding verification",
            authorization, treasuryWallet: walletAddress,
          }),
        });


        const data = await payment.json().catch(() => ({}));
        if (!payment.ok) throw new Error(data?.intent?.reason || data?.error || "Tempo payment failed.");


        await post({ complete: true });
        document.cookie = "sentinel_onboarding_complete=true; path=/; max-age=31536000; samesite=lax";
        localStorage.removeItem(DRAFT_KEY);

        setIsRedirecting(true);
        router.replace("/overview");
        return;
      }


      setStep((current) => Math.min(current + 1, 5));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Setup could not be saved. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }


  function back() {
    if (isSaving) return;
    setStatus("");
    setStep((current) => Math.max(current - 1, 0));
  }


  if (!ready || isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">{isRedirecting ? "Routing to your workspace..." : "Preparing your Sentinel workspace…"}</div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-glow"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <div className="font-bold tracking-[0.18em] text-white">SENTINEL</div>
            <div className="text-xs text-muted-foreground">Financial control for autonomous agents</div>
          </div>
        </div>
        <div className="panel">
          <div className="border-b border-border p-6">
            <div className="eyebrow">Set up your Sentinel</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Give your agents money. Keep the authority.</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">Create a Sentinel wallet, import one you control, or connect an external wallet — then place your first agent behind a financial policy.</p>
            <div className="mt-6 grid grid-cols-6 gap-2">
              {steps.map((label, index) => {
                const completed = index < step; const current = index === step; const available = index <= step;
                return (
                  <button key={label} type="button" disabled={!available} onClick={() => { if (!available) return; setStatus(""); setStep(index); }} className="text-left disabled:cursor-not-allowed">
                    <div className={`h-1.5 rounded-full ${completed || current ? "bg-primary" : "bg-white/10"}`} />
                    <div className={`mt-2 hidden text-[10px] sm:block ${current ? "text-white" : "text-muted-foreground"}`}>{label}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-6 sm:p-8">
            {step === 0 && (
              <Step icon={<LockKeyhole />} title="Create your organization" text="This is the operating boundary for your agent fleet.">
                <label className="text-xs text-muted-foreground">Organization name</label>
                <input className="input mt-2" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Your company" />
              </Step>
            )}
            {step === 1 && (
              <Step icon={<WalletCards />} title="Choose your treasury wallet" text="Sentinel can create a self-custody wallet, import one you control, or connect an external wallet.">
                <WalletConnection onWalletReady={(addr, mode) => { setWalletAddress(addr); setWalletMode(mode); }} />
                <div className="mt-5 rounded-2xl border border-border bg-white/[0.02] p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Treasury identity</div>
                  {walletAddress ? (
                    <>
                      <div className="mt-2 break-all font-mono text-xs text-white">{walletAddress}</div>
                      <div className="mt-2 text-xs text-emerald-200">Mode: {walletMode === "created" ? "Sentinel self-custody" : walletMode === "imported" ? "Imported self-custody" : "External wallet connection"}</div>
                    </>
                  ) : <div className="mt-2 text-sm text-muted-foreground">No wallet selected yet.</div>}
                </div>
              </Step>
            )}
            {step === 2 && (
              <Step icon={<Bot />} title="Create your first agent" text="Define what this autonomous worker is for.">
                <label className="text-xs text-muted-foreground">Agent name</label>
                <input className="input mt-2" value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="ResearchBot" />
                <label className="mt-5 block text-xs text-muted-foreground">Purpose</label>
                <textarea className="input mt-2 min-h-24 py-3" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What is this agent allowed to purchase?" />
              </Step>
            )}
            {step === 3 && (
              <Step icon={<ShieldCheck />} title="Set financial authority" text="These rules are evaluated before any payment reaches Tempo.">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Daily limit" value={daily} set={setDaily} />
                  <Field label="Max transaction" value={tx} set={setTx} />
                  <Field label="Approval above" value={approval} set={setApproval} />
                </div>
                <label className="mt-5 block text-xs text-muted-foreground">Allowed recipient address</label>
                <input className="input mt-2 font-mono text-xs" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x..." />
              </Step>
            )}
            {step === 4 && (
              <Step icon={<WalletCards />} title="Fund the agent" text="Allocate a controlled balance. You can replenish it later from the treasury.">
                <label className="text-xs text-muted-foreground">Initial allocation</label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
                  <input className="input pl-7" type="number" min="0" step="0.01" value={fund} onChange={(e) => setFund(e.target.value)} />
                </div>
                <div className="mt-4 rounded-xl border border-border bg-black/10 p-4 text-sm text-muted-foreground">Sentinel records the allocation against the treasury. Agent spending remains subject to the policy you just created.</div>
              </Step>
            )}
            {step === 5 && (
              <Step icon={<Check />} title="Run the first controlled payment" text="Your first payment is allowlisted, policy-compliant, and settled through the same execution path as an autonomous payment.">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Payment intent</div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-white">{agent}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="max-w-[180px] truncate font-mono text-xs text-white">{recipient}</span>
                    <span className="font-semibold text-white">$0.05</span>
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                    <div>✓ Agent authorized</div>
                    <div>✓ Recipient allowlisted</div>
                    <div>✓ Within transaction limit</div>
                    <div>✓ Within daily budget</div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">Sentinel will ask you to authorize your agent&apos;s background transactions securely.</div>
              </Step>
            )}
            {status && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{status}</div>}
            <div className="mt-8 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={back} disabled={step === 0 || isSaving}><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button variant="primary" onClick={next} disabled={isSaving}>{isSaving ? "Saving..." : step === 5 ? "Enter Sentinel" : "Continue"}{!isSaving && <ArrowRight className="h-4 w-4" />}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function Step({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3"><div className="text-violet-300">{icon}</div><div><h2 className="text-xl font-semibold text-white">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{text}</p></div></div>
      <div className="mt-7">{children}</div>
    </div>
  );
}
function Field({ label, value, set }: { label: string; value: string; set: (value: string) => void }) {
  return (<div><label className="text-xs text-muted-foreground">{label}</label><input className="input mt-2" type="number" min="0" step="0.01" value={value} onChange={(e) => set(e.target.value)} /></div>);
}


