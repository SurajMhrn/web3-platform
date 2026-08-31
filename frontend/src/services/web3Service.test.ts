import { describe, it, expect } from 'vitest';
import { getDeploymentForChain, getExplorerUrl, getNetworkName } from './web3Service';

describe('getDeploymentForChain', () => {
  it('resolves the localhost deployment for chain 31337', () => {
    const deployment = getDeploymentForChain('31337');
    expect(deployment.contracts.PlatformRegistry.address).toMatch(/^0x/);
    expect(deployment.contracts.UserRegistry).toBeDefined();
    expect(deployment.contracts.TokenFactory).toBeDefined();
  });

  it('also resolves the localhost deployment for the MetaMask fallback chain 1337', () => {
    const deployment = getDeploymentForChain('1337');
    expect(deployment.contracts.PlatformRegistry.address).toMatch(/^0x/);
  });

  it('throws a descriptive error for an unsupported chain ID', () => {
    expect(() => getDeploymentForChain('999')).toThrow(/Unsupported chain ID: 999/);
  });

  it('throws when a supported chain has no recorded deployment', () => {
    // Sepolia is a recognized network name but this repo's deployments.json
    // only has a "localhost" entry — this must fail loudly, not silently.
    expect(() => getDeploymentForChain('11155111')).toThrow(/No deployment found for sepolia/);
  });
});

describe('getNetworkName', () => {
  it('maps known chain IDs to human-readable names', () => {
    expect(getNetworkName('31337')).toBe('Hardhat Localhost');
    expect(getNetworkName('1337')).toBe('Hardhat Localhost');
    expect(getNetworkName('11155111')).toBe('Sepolia Testnet');
    expect(getNetworkName('1')).toBe('Ethereum Mainnet');
  });

  it('falls back to a generic label for an unknown chain ID', () => {
    expect(getNetworkName('42161')).toBe('Chain 42161');
  });
});

describe('getExplorerUrl', () => {
  it('returns a Sepolia explorer link for Sepolia transactions', () => {
    const url = getExplorerUrl('11155111', '0xabc123');
    expect(url).toBe('https://sepolia.etherscan.io/tx/0xabc123');
  });

  it('returns null for a chain with no known explorer (e.g. local Hardhat)', () => {
    expect(getExplorerUrl('31337', '0xabc123')).toBeNull();
  });
});
