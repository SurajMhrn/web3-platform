import { ethers, type JsonRpcSigner, type Provider } from "ethers";
import deployments from "../constants/deployments.json";

// ─── Network Helpers ──────────────────────────────────────────────────────────

type NetworkName = "localhost" | "sepolia";

const CHAIN_ID_TO_NETWORK: Record<string, NetworkName> = {
  "31337": "localhost",  // Hardhat default
  "1337":  "localhost",  // MetaMask built-in fallback
  "11155111": "sepolia",
};

/**
 * Returns the deployment entry for the currently connected chain.
 * Throws a user-friendly error if the chain is not supported.
 */
export function getDeploymentForChain(chainId: string) {
  const networkName = CHAIN_ID_TO_NETWORK[chainId];
  if (!networkName) {
    throw new Error(`Unsupported chain ID: ${chainId}. Connect to Localhost or Sepolia.`);
  }
  const deployment = (deployments as any)[networkName];
  if (!deployment) {
    throw new Error(
      `No deployment found for ${networkName}. Run the deploy script first.`
    );
  }
  return deployment;
}

// ─── Contract Factories ──────────────────────────────────────────────────────

export function getUserRegistryContract(
  signerOrProvider: JsonRpcSigner | Provider,
  chainId: string
): ethers.Contract {
  const deployment = getDeploymentForChain(chainId);
  const { address, abi } = deployment.contracts.UserRegistry;
  return new ethers.Contract(address, abi, signerOrProvider);
}

export function getPlatformRegistryContract(
  signerOrProvider: JsonRpcSigner | Provider,
  chainId: string
): ethers.Contract {
  const deployment = getDeploymentForChain(chainId);
  const { address, abi } = deployment.contracts.PlatformRegistry;
  return new ethers.Contract(address, abi, signerOrProvider);
}

// ─── Read Operations ─────────────────────────────────────────────────────────

export interface OnChainUser {
  username: string;
  email: string;
  role: string;
  registeredAt: number;
  updatedAt: number;
  isRegistered: boolean;
  isActive: boolean;
}

/**
 * Checks whether a wallet address is registered on-chain.
 */
export async function isWalletRegistered(
  provider: Provider,
  walletAddress: string,
  chainId: string
): Promise<boolean> {
  try {
    const contract = getUserRegistryContract(provider, chainId);
    return await contract.isUserRegistered(walletAddress);
  } catch {
    return false;
  }
}

/**
 * Fetches the on-chain user info for a wallet address.
 * Returns null if not registered or on error.
 */
export async function getOnChainUser(
  provider: Provider,
  walletAddress: string,
  chainId: string
): Promise<OnChainUser | null> {
  try {
    const contract = getUserRegistryContract(provider, chainId);
    const isRegistered: boolean = await contract.isUserRegistered(walletAddress);
    if (!isRegistered) return null;

    const result = await contract.getUser(walletAddress);
    return {
      username:      result.username,
      email:         result.email,
      role:          result.role,
      registeredAt:  Number(result.registeredAt),
      updatedAt:     Number(result.updatedAt),
      isRegistered:  result.isRegistered,
      isActive:      result.isActive,
    };
  } catch {
    return null;
  }
}

// ─── Write Operations ────────────────────────────────────────────────────────

export interface RegisterOnChainParams {
  signer: JsonRpcSigner;
  chainId: string;
  username: string;
  email: string;
  role: string;
}

/**
 * Calls UserRegistry.registerUser() on-chain.
 * Returns the transaction hash on success, or throws on failure.
 */
export async function registerUserOnChain(
  params: RegisterOnChainParams
): Promise<string> {
  const { signer, chainId, username, email, role } = params;
  const contract = getUserRegistryContract(signer, chainId);
  const tx = await contract.registerUser(username, email, role);
  const receipt = await tx.wait();
  return receipt.hash;
}

// ─── Network Info ─────────────────────────────────────────────────────────────

export function getNetworkName(chainId: string): string {
  const names: Record<string, string> = {
    "31337":    "Hardhat Localhost",
    "1337":     "Hardhat Localhost",
    "11155111": "Sepolia Testnet",
    "1":        "Ethereum Mainnet",
  };
  return names[chainId] ?? `Chain ${chainId}`;
}

export function getExplorerUrl(chainId: string, txHash: string): string | null {
  const explorers: Record<string, string> = {
    "11155111": `https://sepolia.etherscan.io/tx/${txHash}`,
  };
  return explorers[chainId] ?? null;
}
