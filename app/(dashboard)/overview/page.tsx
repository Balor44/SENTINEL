"use client";


import { useState, useEffect } from "react";
import { useConnect, useDisconnect, useAccount } from "wagmi";
import { generatePrivateKey, privateKeyToAccount, mnemonicToAccount } from "viem/accounts";
import { Button } from "@/components/ui";
import { QrCode, Shield, Wallet, Lock, Key, Loader2, Trash2 } from "lucide-react";
import { SecureVault } from "@/lib/secure-vault";


type WalletMode = "created" | "imported" | "connected" | "";


export function WalletConnection({ onWalletReady, compact }: { onWalletReady?: (address: string, mode: WalletMode) => void, compact?: boolean }) {
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { isConnected, address } = useAccount();


  // Core State
  const [activeTab, setActiveTab] = useState<"connect" | "create" | "import" | "unlock">("connect");
  const [localAccount, setLocalAccount] = useState<any>(null); // Functional wallet in memory
  const [hasEncryptedWallet, setHasEncryptedWallet] = useState(false);
  
  // Form State
  const [password, setPassword] = useState("");
  const [importKey, setImportKey] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Display State (Shown only once upon creation)
  const [newWalletData, setNewWalletData] = useState<{ pk: string, address: string } | null>(null);


  // Check localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sentinel_encrypted_wallet");
    if (saved) {
      setHasEncryptedWallet(true);
      setActiveTab("unlock");
    }
  }, []);


  // STATE 1: UNLOCK WALLET
  const handleUnlock = async () => {
    setIsProcessing(true);
    setError("");
    try {
      const encryptedData = localStorage.getItem("sentinel_encrypted_wallet");
      if (!encryptedData) throw new Error("No wallet found");
      
      const decryptedString = await SecureVault.decrypt(encryptedData, password);
      const parsed = JSON.parse(decryptedString);
      
      setLocalAccount(parsed);
      setPassword("");
      if (onWalletReady) onWalletReady(parsed.address, parsed.isSeed ? "imported" : "created");
    } catch (e) {
      setError("Incorrect password or corrupted wallet data.");
    }
    setIsProcessing(false);
  };


  // STATE 2: CREATE WALLET (With Encryption)
  const handleCreateWallet = async () => {
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setIsProcessing(true);
    setError("");
    try {
      // 1. Generate Raw Key
      const pk = generatePrivateKey();
      const account = privateKeyToAccount(pk);
      
      const walletPayload = { address: account.address, privateKey: pk, isSeed: false };
      
      // 2. Encrypt & Save
      const encrypted = await SecureVault.encrypt(JSON.stringify(walletPayload), password);
      localStorage.setItem("sentinel_encrypted_wallet", encrypted);
      
      // 3. Set State & Show Backup Screen
      setHasEncryptedWallet(true);
      setLocalAccount(walletPayload);
      setNewWalletData({ pk, address: account.address });
      setPassword("");
      if (onWalletReady) onWalletReady(account.address, "created");
    } catch (e) {
      setError("Failed to generate and encrypt wallet.");
    }
    setIsProcessing(false);
  };


  // STATE 3: IMPORT WALLET (With Encryption)
  const handleImportWallet = async () => {
    if (!password || password.length < 6) {
      setError("Please set a password (min 6 characters) to encrypt this key.");
      return;
    }
    setIsProcessing(true);
    setError("");
    try {
      const input = importKey.trim();
      let account;
      let pkToSave = "";
      let isSeed = false;


      if (input.includes(" ")) {
         account = mnemonicToAccount(input);
         pkToSave = input; // Save the raw mnemonic string securely
         isSeed = true;
      } else {
         const formattedKey = input.startsWith("0x") ? input : `0x${input}`;
         account = privateKeyToAccount(formattedKey as `0x${string}`);
         pkToSave = formattedKey;
      }


      const walletPayload = { address: account.address, privateKey: pkToSave, isSeed };
      
      // Encrypt & Save
      const encrypted = await SecureVault.encrypt(JSON.stringify(walletPayload), password);
      localStorage.setItem("sentinel_encrypted_wallet", encrypted);
      
      setHasEncryptedWallet(true);
      setLocalAccount(walletPayload);
      setPassword("");
      setImportKey("");
      if (onWalletReady) onWalletReady(account.address, "imported");
    } catch (e) {
      setError("Invalid Private Key / Phrase format.");
    }
    setIsProcessing(false);
  };


  const clearLocalWallet = () => {
    if(confirm("This will permanently remove the encrypted wallet from this browser. Continue?")) {
      localStorage.removeItem("sentinel_encrypted_wallet");
      setLocalAccount(null);
      setHasEncryptedWallet(false);
      setActiveTab("connect");
      if (onWalletReady) onWalletReady("", "");
    }
  };


  const handleDisconnect = () => {
    disconnect();
    setLocalAccount(null);
    setNewWalletData(null);
    if (hasEncryptedWallet) setActiveTab("unlock");
    if (onWalletReady) onWalletReady("", "");
  };


  // ACTIVE / CONNECTED UI
  if (isConnected || localAccount) {
    if (newWalletData) {
      return (
        <div className="mt-4 overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
           <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
             <Shield className="h-4 w-4" /> Wallet Secured & Encrypted
           </div>
           <div className="mt-4 text-xs text-muted-foreground uppercase tracking-wider">Your Private Key (Save this offline now!)</div>
           <div className="mt-1 text-xs text-white font-mono break-all bg-black/40 p-3 rounded border border-border/50 select-all">
             {newWalletData.pk}
           </div>
           <Button variant="primary" className="mt-4 w-full" onClick={() => setNewWalletData(null)}>
             I have safely stored my key
           </Button>
        </div>
      );
    }


    const activeAddress = localAccount?.address || address;
    const mode = localAccount ? (localAccount.isSeed ? "Imported Phrase" : "Sentinel Encrypted") : "Web3 Connected";


    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-white/[0.02] p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
          <Shield className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">{mode} Wallet</div>
          <div className="font-mono text-sm text-white">{activeAddress?.slice(0, 6)}...{activeAddress?.slice(-4)}</div>
        </div>
        <Button variant="ghost" className="h-8 px-2 text-xs" onClick={handleDisconnect}>Lock / Disconnect</Button>
      </div>
    );
  }


  if (compact) return null;


  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-black/20">
      <div className="flex border-b border-border/50 text-sm">
        {hasEncryptedWallet && (
           <button className={`flex-1 py-3 font-medium transition-colors ${activeTab === "unlock" ? "bg-white/5 text-white" : "text-muted-foreground hover:bg-white/5"}`} onClick={() => setActiveTab("unlock")}>Unlock Wallet</button>
        )}
        <button className={`flex-1 py-3 font-medium transition-colors ${activeTab === "connect" ? "bg-white/5 text-white" : "text-muted-foreground hover:bg-white/5"}`} onClick={() => setActiveTab("connect")}>Connect Web3</button>
        <button className={`flex-1 py-3 font-medium transition-colors ${activeTab === "create" ? "bg-white/5 text-white" : "text-muted-foreground hover:bg-white/5"}`} onClick={() => setActiveTab("create")}>Create Wallet</button>
        <button className={`flex-1 py-3 font-medium transition-colors ${activeTab === "import" ? "bg-white/5 text-white" : "text-muted-foreground hover:bg-white/5"}`} onClick={() => setActiveTab("import")}>Import Key</button>
      </div>


      <div className="p-5">
        
        {/* UNLOCK STATE */}
        {activeTab === "unlock" && hasEncryptedWallet && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-white"><Lock className="h-4 w-4 text-emerald-400"/> Local Wallet Detected</div>
            <div className="text-xs text-muted-foreground">Enter your Sentinel password to decrypt your self-custody wallet for this session.</div>
            <input 
              type="password" placeholder="Enter password" 
              className="input w-full"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            />
            {error && <div className="text-xs text-red-400">{error}</div>}
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={handleUnlock} disabled={isProcessing || !password}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock Wallet"}
              </Button>
              <Button variant="ghost" onClick={clearLocalWallet}><Trash2 className="h-4 w-4 text-red-400" /></Button>
            </div>
          </div>
        )}


        {/* CONNECT WEB3 (WalletConnect) */}
        {activeTab === "connect" && (
          <div className="flex flex-col gap-3">
            <div className="mb-2 text-xs text-muted-foreground">Connect an existing Web3 wallet via browser extension or WalletConnect QR code.</div>
            {connectors.map((connector) => (
              <Button key={connector.uid} variant="secondary" className="justify-start gap-3" onClick={() => connect({ connector })}>
                {connector.name.includes("WalletConnect") ? <QrCode className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                {connector.name}
              </Button>
            ))}
          </div>
        )}


        {/* CREATE WALLET */}
        {activeTab === "create" && (
          <div className="flex flex-col gap-4">
            <div className="text-xs text-muted-foreground">Generate a secure Sentinel self-custody wallet. It will be AES-GCM encrypted and stored locally in this browser.</div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-white flex items-center gap-2"><Key className="h-3 w-3"/> Create a Encryption Password</label>
              <input 
                type="password" placeholder="Minimum 6 characters" 
                className="input w-full"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <div className="text-xs text-red-400">{error}</div>}
            <Button variant="primary" onClick={handleCreateWallet} disabled={isProcessing || password.length < 6}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate & Encrypt Wallet"}
            </Button>
          </div>
        )}


        {/* IMPORT WALLET */}
        {activeTab === "import" && (
          <div className="flex flex-col gap-4">
            <div className="text-xs text-muted-foreground">Import an existing Seed Phrase (12/24 words) or Private Key.</div>
            <textarea 
              placeholder="Enter your Seed Phrase or 0x..." 
              className="input font-mono text-sm min-h-[60px] resize-none"
              value={importKey} onChange={(e) => setImportKey(e.target.value)}
            />
            <div className="space-y-2 mt-2">
              <label className="text-xs font-medium text-white flex items-center gap-2"><Lock className="h-3 w-3"/> Set Encryption Password</label>
              <input 
                type="password" placeholder="Password to secure this key locally" 
                className="input w-full"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <div className="text-xs font-medium text-red-400">{error}</div>}
            <Button variant="primary" onClick={handleImportWallet} disabled={isProcessing || !importKey || password.length < 6}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import & Encrypt Wallet"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}


