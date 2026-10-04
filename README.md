# Sentinel

Sentinel is the financial control plane for autonomous AI agents.

The product flow is:

**Organization → Treasury → Agent Fleet → Policies → Payments → Audit → Intelligence**

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. New workspaces enter the Sentinel onboarding flow before the dashboard.

## Core controls

- Organization and treasury setup
- Controlled agent financial identities
- Per-agent daily and transaction limits
- Recipient allowlists
- Human approval thresholds
- Behavioral spending anomaly checks
- Fleet-wide financial kill switch
- Decision traces for every payment intent
- Live Tempo testnet settlement for approved intents
- Transaction/audit ledger

## API

- `GET/POST /api/setup`
- `GET/POST /api/fleet`
- `GET/POST /api/agents`
- `GET/PATCH /api/agents/:id`
- `GET/POST /api/policies`
- `GET/POST /api/treasury`
- `GET /api/transactions`
- `GET /api/approvals`
- `POST /api/approvals/:id`
- `GET/POST /api/payment-intents`

Tempo is the execution layer. Sentinel evaluates organizational financial authority before execution and records the resulting decision trace and settlement hash.

> Hackathon note: the current store is in-memory and should be replaced with a persistent database and production key-management system before handling real funds.

## Wallet connection

Sentinel uses Wagmi for wallet connectivity. Injected wallets (for example MetaMask-compatible wallets) work immediately. WalletConnect QR/mobile sessions are enabled when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set in `.env.local`.

Copy `.env.example` to `.env.local` and add your WalletConnect Cloud project ID. The connected operator wallet is recorded as the Sentinel treasury identity during onboarding; Sentinel's agent payment policy remains a separate authorization layer.
