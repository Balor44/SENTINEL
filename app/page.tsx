"use client";


import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Shield,
  Zap,
  Plus,
  Wallet,
  Loader2,
  KeyRound,
  ArrowLeft,
  Copy,
  Check,
  Lock,
  Unlock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useAccount } from "wagmi";
import { WalletConnection } from "@/components/wallet-connection";
import { useEffect, useState } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";


// ============================================================================
// ENTERPRISE CRYPTOGRAPHY: AES-GCM + PBKDF2 Web Crypto Implementation
// ============================================================================
async function deriveKey(password: string, salt: Uint8Array) {
  const enc = new TextEncoder();


  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );


  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}


async function encryptData(text: string, password: string) {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);


  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );


  return {
    ciphertext: Array.from(new Uint8Array(encrypted)),
    salt: Array.from(salt),
    iv: Array.from(iv),
  };
}


async function decryptData(encryptedObj: any, password: string) {
  const dec = new TextDecoder();
  const salt = new Uint8Array(encryptedObj.salt);
  const iv = new Uint8Array(encryptedObj.iv);
  const key = await deriveKey(password, salt);


  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    new Uint8Array(encryptedObj.ciphertext)
  );


  return dec.decode(decrypted);
}


// ============================================================================


export default function LandingPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);


  // Navigation & Loading States
  const [activeView, setActiveView] = useState<
    "checking" | "default" | "create" | "import" | "handoff" | "unlock"
  >("checking");
  const [isRedirecting, setIsRedirecting] = useState(false); // <-- The Redirect Lock


  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");


  // Data States
  const [password, setPassword] = useState("");
  const [importKey, setImportKey] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);


  // Vault State
  const [encryptedVault, setEncryptedVault] = useState<any | null>(null);
  const [unlockedAddress, setUnlockedAddress] = useState<string | null>(null);


  useEffect(() => {
    setMounted(true);
    let cancelled = false;


    async function checkSetup() {
      try {
        const response = await fetch("/api/setup", {
          cache: "no-store",
        });


        if (!response.ok) throw new Error("Setup check failed");
        
        const data = await response.json();
        if (cancelled) return;


        // First-run users always go to onboarding. Lock the UI during transition.
        if (!data?.setup?.onboardingComplete) {
          setIsRedirecting(true);
          router.replace("/onboarding");
          return;
        }


        // Only inspect the encrypted vault after onboarding is complete.
        const vault = localStorage.getItem("sentinel_secure_vault");


        if (vault) {
          try {
            setEncryptedVault(JSON.parse(vault));
            setActiveView("unlock");
          } catch {
            localStorage.removeItem("sentinel_secure_vault");
            setActiveView("default");
          }
        } else {
          setActiveView("default");
        }
      } catch (error) {
        console.error("Failed to determine Sentinel setup state:", error);
        if (!cancelled) {
          setIsRedirecting(true);
          router.replace("/onboarding");
        }
      }
    }


    checkSetup();


    return () => {
      cancelled = true;
    };
  }, [router]);


  const handleCreateWallet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (password.length < 6) return setErrorMsg("Password must be at least 6 characters.");


    setErrorMsg("");
    setIsProcessing(true);


    try {
      const pk = generatePrivateKey();
      const account = privateKeyToAccount(pk);
      const encryptedPayload = await encryptData(pk, password);
      
      const vaultData = {
        address: account.address,
        crypto: encryptedPayload,
      };


      localStorage.setItem("sentinel_secure_vault", JSON.stringify(vaultData));
      setGeneratedKey(pk);
      setUnlockedAddress(account.address);
      setActiveView("handoff");
    } catch (e) {
      setErrorMsg("Encryption failed.");
    } finally {
      setIsProcessing(false);
    }
  };


  const handleImportWallet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (password.length < 6) return setErrorMsg("Password must be at least 6 characters.");


    setErrorMsg("");
    setIsProcessing(true);


    try {
      const formattedKey = importKey.startsWith("0x") ? importKey : `0x${importKey}`;
      const account = privateKeyToAccount(formattedKey as `0x${string}`);
      const encryptedPayload = await encryptData(formattedKey, password);
      
      const vaultData = {
        address: account.address,
        crypto: encryptedPayload,
      };


      localStorage.setItem("sentinel_secure_vault", JSON.stringify(vaultData));
      setUnlockedAddress(account.address);
      setActiveView("default"); 
    } catch (e) {
      setErrorMsg("Invalid Private Key format.");
    } finally {
      setIsProcessing(false);
    }
  };


  const handleUnlockVault = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg("");
    setIsProcessing(true);


    try {
      await decryptData(encryptedVault.crypto, password);
      setUnlockedAddress(encryptedVault.address);
      setActiveView("default"); 
    } catch (e) {
      setErrorMsg("Incorrect password. Decryption failed.");
    } finally {
      setIsProcessing(false);
    }
  };


  const copyToClipboard = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  const renderView = () => {
    // FIX: Refuse to render the vault/action menu if we are routing
    if (activeView === "checking" || isRedirecting) {
      return (
        <div className="flex min-h-[280px] flex-col items-center justify-center gap-4">
          <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
          <div className="text-sm text-muted-foreground">
            {isRedirecting ? "Routing to Onboarding..." : "Preparing your Sentinel workspace…"}
          </div>
        </div>
      );
    }


    if (activeView === "unlock") {
      return (
        <form onSubmit={handleUnlockVault} className="flex flex-col text-left animate-in fade-in">
          <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-400 border border-emerald-500/20">
            <Lock className="h-4 w-4 shrink-0" />
            <span className="font-medium">AES-GCM Encrypted Vault Found</span>
          </div>


          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Session Password</label>
          <input
            type="password"
            placeholder="Enter password to decrypt"
            className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none mb-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />


          {errorMsg && <p className="mb-3 text-xs text-red-400">{errorMsg}</p>}


          <Button type="submit" variant="primary" className="h-11 w-full" disabled={isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
            Decrypt Vault & Enter
          </Button>
        </form>
      );
    }


    if (activeView === "handoff" && generatedKey) {
      return (
        <div className="flex flex-col text-left animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>Vault encrypted. Back up your raw key now. It cannot be recovered if you lose your password.</p>
          </div>


          <div className="mb-6">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Private Key (Keep Secret)</label>
            <div className="group relative">
              <input
                readOnly
                type="text"
                value={generatedKey}
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-3 pr-10 font-mono text-xs text-white focus:outline-none"
              />
              <button
                onClick={copyToClipboard}
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>


          <Link href="/agents" className="w-full">
            <Button variant="primary" className="h-11 w-full bg-emerald-600 hover:bg-emerald-500 text-white">
              I have saved this safely
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      );
    }


    if (activeView === "create") {
      return (
        <form onSubmit={handleCreateWallet} className="flex flex-col text-left animate-in fade-in slide-in-from-right-4">
          <button
            type="button"
            onClick={() => { setActiveView("default"); setErrorMsg(""); }}
            className="flex w-fit items-center mb-4 text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft className="mr-1 h-3 w-3" /> Back
          </button>


          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-medium text-white">Set Encryption Password</label>
            <input
              type="password"
              placeholder="Min 6 characters"
              className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>


          {errorMsg && <p className="mb-3 text-xs text-red-400">{errorMsg}</p>}


          <Button type="submit" variant="primary" className="h-11 w-full" disabled={isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
            Generate & Encrypt Key
          </Button>
        </form>
      );
    }


    if (activeView === "import") {
      return (
        <form onSubmit={handleImportWallet} className="flex flex-col text-left animate-in fade-in slide-in-from-right-4">
          <button
            type="button"
            onClick={() => { setActiveView("default"); setErrorMsg(""); }}
            className="flex w-fit items-center mb-4 text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft className="mr-1 h-3 w-3" /> Back
          </button>


          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-medium text-white">Paste Private Key</label>
            <input
              type="password"
              placeholder="0x..."
              className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm font-mono text-white focus:border-violet-500 focus:outline-none"
              value={importKey}
              onChange={(e) => setImportKey(e.target.value)}
            />
          </div>


          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-medium text-white">Set Encryption Password</label>
            <input
              type="password"
              placeholder="Min 6 characters"
              className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>


          {errorMsg && <p className="mb-3 text-xs text-red-400">{errorMsg}</p>}


          <Button type="submit" variant="primary" className="h-11 w-full" disabled={isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
            Encrypt & Vault Key
          </Button>
        </form>
      );
    }


    // Success / Connected State
    if (mounted && (isConnected || unlockedAddress)) {
      return (
        <div className="flex flex-col items-center gap-4 animate-in fade-in">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <Shield className="h-4 w-4" />
            {unlockedAddress ? "Encrypted Vault Unlocked" : "Web3 Wallet Connected"}
          </div>


          <Link href="/agents" className="w-full">
            <Button variant="primary" className="h-12 w-full text-base shadow-[0_0_40px_-10px_rgba(139,92,246,0.5)]">
              Enter Workspace
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      );
    }


    // Default Action Menu
    return (
      <div className="flex w-full flex-col gap-3 animate-in fade-in">
        <Button
          variant="primary"
          className="h-11 w-full justify-start px-4 transition-transform active:scale-[0.98]"
          onClick={() => setActiveView("create")}
        >
          <Plus className="mr-3 h-5 w-5" />
          Create Encrypted Vault
        </Button>


        <Button
          variant="ghost"
          className="h-11 w-full justify-start border border-white/5 bg-white/5 px-4 hover:bg-white/10 transition-transform active:scale-[0.98]"
          onClick={() => setActiveView("import")}
        >
          <KeyRound className="mr-3 h-5 w-5 text-muted-foreground" />
          Import & Encrypt Key
        </Button>


        <WalletConnection />
      </div>
    );
  };


  return (
    <div className="flex min-h-screen flex-col items-center pt-24 pb-12 bg-[#0a0a0a] bg-[url('/grid.svg')] bg-center px-4 text-center overflow-y-auto">
      <div className="fixed inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent pointer-events-none" />


      <div className="z-10 max-w-3xl">
        <div className="mb-6 inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-sm text-violet-300">
          <span className="mb-[1px] mr-2 flex h-2 w-2 animate-pulse rounded-full bg-violet-500" />
          Tempo Testnet Live
        </div>


        <h1 className="mb-6 text-5xl font-bold tracking-tight text-white sm:text-7xl">
          Financial control for <br />
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            autonomous agents.
          </span>
        </h1>


        <p className="mb-10 text-lg text-muted-foreground sm:text-xl">
          Sentinel provides secure treasuries, dynamic spending policies,
          and human-in-the-loop approvals for AI agents operating on the
          Tempo blockchain.
        </p>


        <div className="mx-auto flex min-h-[280px] max-w-md flex-col justify-center rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl transition-all duration-300">
          {renderView()}
        </div>
      </div>
    </div>
  );
}


