# Blockchain — Smart Contracts Workspace

Hardhat + Solidity + TypeScript workspace for the Web3 Platform (Phase 1). Single-chain
Ethereum (deployable to a local Hardhat node or Sepolia testnet).

## Contracts

```
PlatformRegistry          — on-chain directory of contract addresses
        │
        ├── UserRegistry  — user registration, profile, RBAC role string
        │
        └── TokenFactory  — deploys CustomToken instances on demand
                    │
                    └── CustomToken  — ERC20 + Burnable + Permit, one per created token
```

- **PlatformRegistry** is the single source of truth for contract discovery. Instead of
  hardcoding addresses in the frontend/backend, `UserRegistry` and `TokenFactory` are
  registered here by name (`setContract("UserRegistry", <address>)`) after deployment.
  Off-chain consumers resolve addresses via `getContract(name)`.
- **UserRegistry** lets a connected wallet self-register (`registerUser`) and update its
  own profile (`updateUser`). The contract owner (platform admin) can `deactivateUser`
  or `pause`/`unpause` the contract. Roles are free-form strings (`"user"`, `"admin"`);
  actual authorization enforcement happens in the backend/off-chain, this contract is a
  verifiable, auditable record of who registered and with what role.
- **TokenFactory** is permissionless — any wallet can call `createToken(name, symbol,
  initialSupply)` to deploy a new `CustomToken`, minted entirely to the caller with the
  caller as owner. The factory always deploys tokens with `maxSupply = 0` (unlimited —
  the creator can mint more later); the cap mechanism in `CustomToken` exists for future
  use cases where a hard cap is desired.
- **CustomToken** is a standard OpenZeppelin ERC20 with `ERC20Burnable` (holders can burn
  their own tokens) and `ERC20Permit`/EIP-2612 (gasless approvals via signature) support.
  Only the token's owner (the creator) can `mint()` more supply, capped by `maxSupply`
  when non-zero.

There is no on-chain upgrade path (no proxies) in Phase 1 — the implicit "upgrade" flow
is: deploy a new contract version, then re-register it in `PlatformRegistry` under the
same name so consumers pick up the new address automatically.

## Deployment flow

```
scripts/deploy.ts
  1. Deploy PlatformRegistry, UserRegistry, TokenFactory
  2. Register UserRegistry + TokenFactory in PlatformRegistry
  3. Write addresses + ABIs to ../frontend/src/constants/deployments.json,
     keyed by network name (e.g. "localhost", "sepolia")
```

```bash
# Local dev node (in one terminal)
npx hardhat node

# Deploy to it (in another terminal)
npx hardhat run scripts/deploy.ts --network localhost

# Deploy to Sepolia (requires SEPOLIA_RPC_URL + PRIVATE_KEY in .env)
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat run scripts/verify.ts --network sepolia
```

`scripts/forceRegister.ts` is a local-dev-only convenience script that impersonates a
given address on a Hardhat node to register it as a user without needing a real signer;
it refuses to run against anything other than `hardhat`/`localhost`.

## Testing

```bash
npx hardhat test          # run the full suite
REPORT_GAS=true npx hardhat test   # with gas report
```

Coverage: `CustomToken.test.ts`, `TokenFactory.test.ts`, `PlatformRegistry.test.ts`,
`UserRegistry.test.ts` — deployment invariants, access control, pausability, pagination
edge cases, and exact event argument assertions for every state-changing function.

## Environment

See `.env.example`: `SEPOLIA_RPC_URL`, `PRIVATE_KEY` (deployer key, Sepolia only),
`ETHERSCAN_API_KEY` (for `scripts/verify.ts`).
