import { parseUnits, pad, stringToHex, defineChain, http, createPublicClient, parseAbi } from "viem";
import { Account, createClient } from "viem/tempo";
import type { Agent } from "@/types";


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


// ==========================================
// 1. Core Architecture Interfaces
// ==========================================


export interface SettlementProvider {
  executePayment(params: {
    amount: number;
    recipient: string;
    assetAddress?: string;
    memoString?: string;
  }): Promise<{ success: boolean; txHash?: string; error?: string; status: "settled" | "failed" }>;
  
  getBalance(walletAddress: string, tokenAddress?: string): Promise<number>;
}


export interface SignerProvider {
  getAccount(): any;
}


// ==========================================
// 2. Isolated Signer (Fixes Security Point #9)
// ==========================================
// In a production environment, this would be replaced by an HSM, 
// Fireblocks, or MPC wallet provider. For now, it isolates the env key.
class LocalEnvironmentSigner implements SignerProvider {
  getAccount() {
    const raw = process.env.TEMPO_PRIVATE_KEY?.trim();
    if (!raw || !/^0x[0-9a-fA-F]{64}$/.test(raw)) {
      throw new Error("Signer Error: Missing or invalid private key.");
    }
    // Bypasses the buggy `access` delegation wrapper
    return Account.fromSecp256k1(raw as `0x${string}`);
  }
}


// ==========================================
// 3. Tempo Settlement Implementation
// ==========================================


export class TempoSettlementProvider implements SettlementProvider {
  private signer: SignerProvider;
  private publicClient;


  constructor(signer: SignerProvider) {
    this.signer = signer;
    this.publicClient = createPublicClient({
      chain: tempoTestnet,
      transport: http()
    });
  }


  private getTempoClient() {
    return createClient({
      account: this.signer.getAccount(),
      chain: tempoTestnet,
      transport: http()
    });
  }


  async executePayment({ amount, recipient, assetAddress = DEFAULT_TOKEN, memoString }: {
    amount: number;
    recipient: string;
    assetAddress?: string;
    memoString?: string;
  }) {
    try {
      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) throw new Error("Invalid recipient address.");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount.");


      const client = this.getTempoClient();
      const memo = memoString ? pad(stringToHex(memoString.slice(0, 32)), { size: 32 }) : undefined;


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


  async getBalance(walletAddress: string, tokenAddress: string = DEFAULT_TOKEN) {
    try {
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) return 0;


      const balance = await this.publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [walletAddress as `0x${string}`]
      });


      return Number(balance) / 1e18;
    } catch (error) {
      console.error("Failed to fetch live balance:", error);
      return 0;
    }
  }
}


// ==========================================
// 4. API Backward Compatibility Wrapper
// ==========================================
// Ensures we don't break existing API endpoints while adopting the new architecture.


const defaultSigner = new LocalEnvironmentSigner();
const defaultProvider = new TempoSettlementProvider(defaultSigner);


export async function executeTempoPayment(
  agent: Agent,
  amount: number,
  recipient: string,
  assetAddress: string = DEFAULT_TOKEN,
  memoString?: string,
) {
  return defaultProvider.executePayment({ amount, recipient, assetAddress, memoString });
}


export async function getLiveBalance(walletAddress: string, tokenAddress: string = DEFAULT_TOKEN) {
  return defaultProvider.getBalance(walletAddress, tokenAddress);
}


