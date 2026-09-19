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

  it('resolves the Sepolia deployment for chain 11155111', () => {
    // Sepolia used to have no entry, and this test asserted the failure was
    // loud. The contracts are deployed there now, so it asserts the addresses
    // are actually present instead.
    const deployment = getDeploymentForChain('11155111');
    expect(deployment.contracts.PlatformRegistry.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(deployment.contracts.UserRegistry.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(deployment.contracts.TokenFactory.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('exposes the post-fix UserRegistry ABI on every deployed chain', () => {
    // Guards the privilege-escalation fix: a chain still carrying the old
    // three-argument registerUser would let callers name their own role.
    for (const chainId of ['31337', '11155111']) {
      const abi = getDeploymentForChain(chainId).contracts.UserRegistry.abi;
      const registerUser = abi.find((entry: { name?: string }) => entry.name === 'registerUser');
      expect(registerUser.inputs).toHaveLength(2);
      expect(abi.some((entry: { name?: string }) => entry.name === 'setUserRole')).toBe(true);
    }
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
