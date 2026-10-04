"use client";


import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors/injected";
import { walletConnect } from "wagmi/connectors/walletConnect";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";


export const tempoTestnet = {
  id: 42431,
  name: "Tempo Moderato Testnet",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.moderato.tempo.xyz"] } },
  blockExplorers: { default: { name: "Tempo Explorer", url: "https://explorer.moderato.tempo.xyz" } },
  testnet: true,
} as const;


const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();


const connectors = [
  injected({ shimDisconnect: true }),
  ...(projectId ? [walletConnect({ projectId, showQrModal: true })] : []),
];


export const config = createConfig({
  chains: [tempoTestnet],
  connectors,
  transports: { [tempoTestnet.id]: http(tempoTestnet.rpcUrls.default.http[0]) },
  // FIX 1: Stops Wagmi from eagerly scanning for wallet extensions on load
  multiInjectedProviderDiscovery: false,
  ssr: true,
});


const queryClient = new QueryClient();


export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    // FIX 2: explicitly stops Wagmi from auto-reconnecting on page mount
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}


