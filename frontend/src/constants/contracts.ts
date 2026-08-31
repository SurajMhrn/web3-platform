/**
 * contracts.ts
 *
 * Re-exports contract addresses and ABIs from the auto-generated deployments.json.
 * This file is the single import point for all contract-related constants in the frontend.
 *
 * deployments.json is regenerated every time `npm run deploy` is run in the
 * blockchain workspace — no manual address updates needed.
 */

import deployments from "./deployments.json";

export type { OnChainUser } from "../services/web3Service";

// ─── Network → Chain ID map ────────────────────────────────────────────────

export const SUPPORTED_CHAINS = {
  localhost: 31337,
  sepolia:   11155111,
} as const;

// ─── Deployment accessors ─────────────────────────────────────────────────

export const getLocalhostDeployment = () =>
  (deployments as any).localhost ?? null;

export const getSepoliaDeployment = () =>
  (deployments as any).sepolia ?? null;

// ─── Quick-access addresses (localhost for dev) ───────────────────────────

const localDeploy = (deployments as any).localhost;

export const USER_REGISTRY_ADDRESS: string =
  localDeploy?.contracts?.UserRegistry?.address ?? "";

export const PLATFORM_REGISTRY_ADDRESS: string =
  localDeploy?.contracts?.PlatformRegistry?.address ?? "";

export const USER_REGISTRY_ABI: any[] =
  localDeploy?.contracts?.UserRegistry?.abi ?? [];

export const PLATFORM_REGISTRY_ABI: any[] =
  localDeploy?.contracts?.PlatformRegistry?.abi ?? [];
