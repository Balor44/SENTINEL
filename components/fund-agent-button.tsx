"use client";


import { useState } from "react";
import { Zap, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";


export function FundAgentButton({ 
  agentId, 
  amount 
}: { 
  agentId: string; 
  amount: number;
}) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();


  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );


  const handleFund = async () => {
    setLoading(true);


    try {
      // 1. Check for Connected Browser Wallet (e.g., MetaMask, Rabby)
      if (typeof window !== "undefined" && (window as any).ethereum) {
        const eth = (window as any).ethereum;
        
        // Request account connection
        const accounts = await eth.request({ method: "eth_requestAccounts" });
        const sender = accounts[0];


        // Convert pathUSD amount to Wei (mocking a standard 18 decimal ERC20/Native token)
        const amountInWei = (amount * 1e18).toString(16);


        // Trigger the actual Web3 Wallet Prompt!
        await eth.request({
          method: "eth_sendTransaction",
          params: [{
            from: sender,
            to: "0x0000000000000000000000000000000000000000", // The Agent's target address
            value: `0x${amountInWei}`,
            chainId: "0xA5B7" // 42431 in Hex (Tempo Moderato)
          }],
        });
      } else {
        // 2. Fallback for "Created Wallet" / No Extension detected
        // In a full build, this opens your custom in-app approval modal.
        // For now, we simulate the internal ledger approval delay.
        await new Promise(resolve => setTimeout(resolve, 1500));
      }


      // 3. Transaction approved! Now we tell Supabase to activate the agent
      const { error } = await supabase
        .from("agents")
        .update({ status: "active" })
        .eq("id", agentId);


      if (error) throw error;


      setSuccess(true);
      
      // Refresh the page to move the agent into the active grid
      setTimeout(() => {
        router.refresh();
      }, 1000);


    } catch (err) {
      console.error("Funding failed or rejected by user:", err);
      // Handle user rejecting the transaction in their wallet
    } finally {
      if (!success) setLoading(false);
    }
  };


  if (success) {
    return (
      <Button variant="primary" disabled className="bg-emerald-600/50 text-white cursor-not-allowed">
        <CheckCircle2 className="h-4 w-4 mr-2" /> Funded
      </Button>
    );
  }


  return (
    <Button 
      variant="primary" 
      onClick={handleFund} 
      disabled={loading}
      className="bg-emerald-600 text-white hover:bg-emerald-500 min-w-[160px]"
    >
      {loading ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Awaiting Wallet...</>
      ) : (
        <><Zap className="h-4 w-4 mr-2" /> Sign & Fund via Tempo</>
      )}
    </Button>
  );
}


