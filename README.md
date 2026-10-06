# 🛡️ SENTINEL


> **A Cryptographically Secure Financial Control Plane for Autonomous Agents.**


[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Multi--Tenant-45B079?logo=supabase)](https://supabase.com/)
[![Tempo](https://img.shields.io/badge/Network-Tempo_Testnet-blue)](#)
[![Security](https://img.shields.io/badge/Security-Institutional_Grade-red)](#)
[![License](https://img.shields.io/badge/License-MIT-gray)](#)


While most Web3 tools focus on giving AI agents a wallet, Sentinel focuses on giving organizations a **firewall**. Sentinel is an institutional-grade authorization layer that sits between your autonomous AI workforce and your treasury funds. It determines not just *how* an agent pays, but whether it has the *authority* to do so.


---


## 📑 Table of Contents
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Threat Model & Mitigations](#-threat-model--security-mitigations)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Testing & Validation](#-testing--validation)
- [License](#-license)


---


## ✨ Key Features


* **Multi-Tenant Architecture:** Built for enterprise fleets. All agents, policies, and transactions are strictly isolated by `organization_id` with Supabase Row-Level Security (RLS).
* **Idempotent Execution Pipeline:** Prevents double-spends and network race-conditions through atomic database locks and UUID-based idempotency keys.
* **Cryptographic Policy Engine:** Rules evaluated using atomic minor units (BigInt) to prevent floating-point exploits, with `viem` checksum enforcement on all recipient allowlists.
* **Immutable Audit Ledger:** Every policy decision—including blocked transactions—is logged with a full `decision_trace` and an `event_hash`, making the ledger tamper-evident.
* **Agnostic Settlement:** Blockchain execution is abstracted behind a `SettlementProvider` interface with isolated private key signing, making it instantly adaptable to Tempo, Base, Ethereum, or Solana.
* **Behavioral Anomaly Detection:** Autonomously flags and blocks spending velocity that deviates from an agent's historical baseline.
* **Global Fleet Kill Switch:** Allows organization owners to instantly freeze all autonomous spending across the entire fleet in one click.


---


## 🏗️ Architecture


Sentinel strictly enforces a unidirectional, idempotent state machine. All payment execution flows through a single canonical pipeline.


                        ┌─────────────────────────┐
                        │      AI Agent Fleet     │
                        └────────────┬────────────┘
                                     │
                     (Idempotent Payment Request)
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │   Policy Engine (RLS)   │
                        │   - BigInt Math         │
                        │   - Crypto Allowlist    │
                        │   - Anomaly Detection   │
                        │   - Global Kill Switch  │
                        └────────────┬────────────┘
                                     │
                   ┌─────────────────┼─────────────────┐
                   ▼                 ▼                 ▼
             [ BLOCKED ]   [ APPROVAL_REQUIRED ]   [ APPROVED ]
                   │                 │                 │
                   │                 ▼                 │
                   │          Human Operator           │
                   │                 │                 │
                   └─────────────────┼─────────────────┘
                                     ▼
                        ┌─────────────────────────┐
                        │   Atomic Reservation    │
                        │   (Double-Spend Lock)   │
                        └────────────┬────────────┘
                                     ▼
                        ┌─────────────────────────┐
                        │   SettlementProvider    │
                        │   (Tempo / EVM / SVM)   │
                        └────────────┬────────────┘
                                     ▼
                        ┌─────────────────────────┐
                        │  Immutable Audit Ledger │
                        │  (Hash-Chained Events)  │
                        └─────────────────────────┘


---


## 🛡️ Threat Model & Security Mitigations


Sentinel is designed with the assumption that AI agents **will** be compromised, prompt-injected, or hallucinate. The platform is hardened against the following critical attack vectors:


| Threat Actor / Vector | Description | Sentinel Mitigation |
| :--- | :--- | :--- |
| **Compromised AI Agent** | An agent attempts to drain treasury funds or send funds to an attacker. | **Strict Policy Engine:** Enforces cryptographically verified recipient allowlists, integer-based daily budgets, and transaction limits. Transactions exceeding thresholds trigger mandatory human approval. |
| **Network Race Conditions** | An agent retries a request during a network timeout, attempting to bypass daily limits. | **Atomic Idempotency:** Every intent requires a UUID. Sentinel locks the request in a `processing` state before touching the blockchain, physically preventing double-spends. |
| **Floating-Point Exploits** | Attackers use JavaScript precision rounding to bypass decimal-based financial limits. | **BigInt Standardization:** All financial comparisons in the policy engine are converted to atomic minor units (cents/wei) before evaluation. |
| **Fleet-Wide Compromise** | Multiple agents exhibit anomalous behavior simultaneously. | **Global Kill Switch & Anomaly Detection:** Operators can instantly freeze all fleet transactions. The engine autonomously flags and blocks spending velocity that deviates from historical averages. |
| **Unauthorized Operators** | A malicious internal user attempts to approve their own transactions. | **Organization-Centric RBAC:** Only authenticated `Owner` and `Admin` roles can modify policies or approve pending transactions via Supabase RLS. |
| **Private Key Exposure** | The application server is compromised, risking treasury keys. | **Isolated SignerProvider:** Blockchain execution is abstracted behind a `SettlementProvider`. The `Signer` is isolated, paving the path for seamless integration with HSMs or MPC wallets. |


---


## 💻 Tech Stack


* **Frontend:** Next.js 15 (App Router), React, TailwindCSS, Lucide Icons
* **Backend:** Next.js Route Handlers
* **Database & Auth:** Supabase (PostgreSQL, Row-Level Security, GoTrue Auth)
* **Web3 Integration:** Viem (Cryptographic validation & Settlement), Wagmi
* **Testing:** Vitest


---


## 🚀 Getting Started


### 1. Prerequisites
* Node.js 18+
* Supabase (Local or Cloud)
* Tempo Testnet Wallet


### 2. Clone & Install
```bash
git clone [https://github.com/your-org/sentinel.git](https://github.com/your-org/sentinel.git)
cd sentinel
npm install


### 3. Environment Configuration
create a .env.local file in the root directory:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
TEMPO_PRIVATE_KEY=your_0x_testnet_private_key

### 4. Database Setup
Execute the multi-tenant migration script provided in the repository against your Supabase SQL editor to create the necessary schemas, tables, and RLS policies.

### 5. Start the Dashboard
```Bash
npm run dev


Navigate to http://localhost:3000 to access the Sentinel control plane.


### 🧪 Testing & Validation
To prove the architectural security to auditors and hackathon judges, Sentinel includes a deterministic test suite.


1. Verify the Financial Policy Engine (Unit Tests):

```Bash
npx vitest __tests__/policy-engine.test.ts

2. Verify Double-Spend / Concurrency Protections (Load Test):
```Bash
npx tsx scripts/concurrency-test.ts

### 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
