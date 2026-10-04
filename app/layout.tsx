import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/components/web3-provider";


export const metadata: Metadata = {
  title: "Sentinel — Financial control for autonomous agents",
  description: "Prototype control plane for AI agent treasury and payments.",
};


export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}