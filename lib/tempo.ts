import { parseUnits, pad, stringToHex, defineChain, http } from "viem";
import { Account, createClient } from "viem/tempo";
import type { Agent } from "@/types";
import { createPublicClient, parseAbi } from "viem";


const DEFAULT_TOKEN = "0x20c0000000000000000000000000000000000000" as const;


export const tempoTestnet = defineChain({
  id: 42431,
  name: 'Tempo Testnet',
  network: 'tempo-testnet',
  nativeCurrency: { decimals: 18, name: 'USD', symbol: 'USD' },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.tempo.xyz'] },
    public: { http: ['https://rpc.testnet.tempo.xyz'] },
  },
});


function getTempoClient() {
  const raw = process.env.TEMPO_PRIVATE_KEY?.trim();
  if (!raw || !/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("TEMPO_PRIVATE_KEY is missing or invalid in .env.local.");
  }


  // FIX: Initialize a standard account, completely bypassing the buggy `access` delegation wrapper
  const account = Account.fromSecp256k1(raw as `0x${string}`);


  return createClient({
    account,
    chain: tempoTestnet,
    transport: http()
  });
}


export async function executeTempoPayment(
  agent: Agent,
  amount: number,
  recipient: string,
  assetAddress: string = DEFAULT_TOKEN,
  memoString?: string,
  authorization?: any,
  treasuryAddress?: string,
) {
  try {
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) throw new Error("Invalid recipient address.");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount.");


    const client = getTempoClient();
    const memo = memoString ? pad(stringToHex(memoString.slice(0, 32)), { size: 32 }) : undefined;


    // FIX: Execute a perfectly clean transaction payload that the RPC node can actually decode
    const txConfig: any = {
      amount: parseUnits(amount.toFixed(6), 6),
      to: recipient as `0x${string}`,
      token: assetAddress as `0x${string}`,
    };


    if (memo) txConfig.memo = memo;


    const { receipt } = await client.token.transferSync(txConfig);


    return { success: true as const, txHash: receipt.transactionHash, status: "settled" as const };
  } catch (error) {
    console.error("Tempo Execution Error:", error);
    const e = error as { shortMessage?: string; message?: string };
    return {
      success: false as const,
      error: e.shortMessage || e.message || "Tempo execution failed",
      status: "failed" as const,
    };
  }
}

const publicClient = createPublicClient({
  chain: tempoTestnet,
  transport: http()
});


// 2. Read live balance from any address
export async function getLiveBalance(walletAddress: string, tokenAddress: string = DEFAULT_TOKEN) {
  try {
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) return 0;


    const balance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`]
    });


    // Convert from blockchain BigInt (18 decimals for native, adjust if your token uses 6)
    return Number(balance) / 1e18; 
  } catch (error) {
    console.error("Failed to fetch live balance:", error);
    return 0; 
  }
}
