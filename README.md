# Web3 Platform — Phase 1

A full-stack Web3 platform: email/wallet-linked accounts, role-based admin control, a
single-chain ERC20 token factory, transaction history, notifications, and basic
analytics — built as Phase 1 of a 90-day internship, ahead of the Phase 2 Real Estate
Tokenization MVP.

## Status: Phase 1 complete

Every feature from the original brief is implemented, tested, and hardened:

| Feature | Status | Where |
|---|---|---|
| User Registration & Login | ✅ | [backend/src/controllers/auth.controller.ts](backend/src/controllers/auth.controller.ts) |
| Wallet Connect | ✅ | [frontend/src/providers/Web3Provider.tsx](frontend/src/providers/Web3Provider.tsx) (Reown AppKit) |
| Single-Chain Support | ✅ | Hardhat localhost (31337) + Sepolia testnet |
| Smart Contract Integration | ✅ | [blockchain/contracts/](blockchain/contracts/) — `UserRegistry`, `TokenFactory`, `CustomToken`, `PlatformRegistry` |
| Token Creation & Management | ✅ | `/tokens` page + `TokenFactory.createToken()` |
| Token Transfer | ✅ | `/tokens` page + direct ERC20 `transfer()` |
| Transaction History | ✅ | `/transactions` page |
| Dashboard | ✅ | `/dashboard` |
| Admin Dashboard | ✅ | `/admin` |
| Basic Analytics | ✅ | Admin Dashboard → signup/token/transaction trends, top token creators |
| Role-Based Access Control | ✅ | `user` / `moderator` / `admin`, enforced server-side on every route |
| Notification System | ✅ | Bell icon, polled every 30s |

## Architecture

```
┌─────────────┐      cookies (httpOnly)      ┌─────────────┐
│  Frontend   │ ───────────────────────────► │   Backend   │
│  React+Vite │ ◄─────────────────────────── │  Express+TS │
└──────┬──────┘         REST API             └──────┬──────┘
       │                                             │
       │ ethers.js (wallet-signed tx)                │ SQLite
       ▼                                             ▼
┌─────────────┐                              ┌─────────────┐
│  Blockchain │                              │  web3_db    │
│  (Hardhat / │                              │  .sqlite    │
│   Sepolia)  │                              └─────────────┘
└─────────────┘
```

The frontend talks to the backend for everything account-related (auth, profile,
transaction/notification history) and talks *directly* to the blockchain (via the
connected wallet) for anything on-chain (token deploy/transfer, on-chain registration) —
the backend only records the result afterward for history, it's never in the transaction
path itself.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + TypeScript, react-hook-form + zod, Reown AppKit |
| Backend | Express + TypeScript, SQLite (see [backend/README.md](backend/README.md#database) for why not the Postgres in `docker-compose.yml`), zod, JWT via httpOnly cookies |
| Blockchain | Hardhat + Solidity 0.8 + OpenZeppelin + ethers v6 |
| Auth | Cookie-based JWT (access + refresh), no token ever touches client-side JS |
| Docs | Swagger/OpenAPI at `/api/docs`, generated from route JSDoc |

## Project structure

- [`/frontend`](frontend/README.md) — React application
- [`/backend`](backend/README.md) — Express API
- [`/blockchain`](blockchain/README.md) — Hardhat smart contracts workspace

Each has its own README with setup, architecture, and testing details specific to that
part — this file is the map, not a replacement for them.

## Quick start

```bash
# 1. Install everything
npm run install:all

# 2. Configure env vars (see backend/.env.example and frontend/.env.example)
cp backend/.env.example backend/.env      # fill in JWT_SECRET / REFRESH_SECRET
cp frontend/.env.example frontend/.env    # fill in VITE_WALLET_CONNECT_PROJECT_ID

# 3. Start a local blockchain and deploy the contracts to it
cd blockchain
npx hardhat node                                          # keep running, separate terminal
npx hardhat run scripts/deploy.ts --network localhost      # writes frontend/src/constants/deployments.json

# 4. Start the backend and frontend (separate terminals)
npm run dev --prefix backend     # http://localhost:5000
npm run dev --prefix frontend    # http://localhost:5173
```

No Docker/Postgres needed for local dev — the backend runs on a self-contained SQLite
file created automatically on first start. Import one of the Hardhat node's printed test
accounts into MetaMask (chain ID `31337`, RPC `http://127.0.0.1:8545`) to interact with
the token features.

## Testing

```bash
cd blockchain && npx hardhat test    # 82 tests — contract logic, access control, events
cd backend && npm test                # 54 tests — auth, RBAC, validation, security headers
cd frontend && npm test               # 44 tests — forms, auth context, admin analytics, wallet flows
```

## Security highlights

- Access + refresh tokens as httpOnly cookies — never readable by page JavaScript
- Every route validated with zod, rate-limited, and RBAC-checked server-side (never trust the client)
- `helmet` security headers, request body size limits, audit logging on admin actions and failed logins
- See [backend/README.md#security](backend/README.md#security) for the full rundown

## Known limitations

- Real wallet-popup end-to-end testing (a live MetaMask/WalletConnect flow) isn't automated —
  it needs a browser-automation tool driving an actual wallet extension. Covered instead by
  unit tests with `ethers` mocked, plus manual verification.
- Sepolia is configured (`blockchain/hardhat.config.ts`) but nothing is deployed there yet —
  only the local Hardhat network has a live deployment today.
- `'moderator'` is a defined role with no dedicated routes yet — reserved for Phase 2.
