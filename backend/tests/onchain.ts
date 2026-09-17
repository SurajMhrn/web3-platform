import { ethers } from 'ethers';
import type request from 'supertest';

/**
 * Helpers for suites that record on-chain activity.
 *
 * Recording now requires two things that used to be assumed: a wallet the
 * account has proven it controls, and a transaction that actually exists on
 * chain. Tests must stay offline, so the chain lookup is stubbed — but the
 * wallet link is performed for real, through the same nonce-and-signature
 * flow a user goes through, so these suites still exercise it.
 */

/** Stub the chain reads. Call at module scope, before importing the app. */
export const mockChainVerifier = () => {
  jest.mock('../src/services/chainVerifier', () => ({
    verifyTokenCreation: jest.fn().mockResolvedValue(undefined),
    verifyTokenTransfer: jest.fn().mockResolvedValue(undefined),
  }));
};

/**
 * Links a freshly generated wallet to the agent's account and returns its
 * address, so a test can assert against the same wallet the API now expects.
 */
export const linkWallet = async (agent: ReturnType<typeof request.agent>): Promise<string> => {
  const nonceRes = await agent.post('/api/auth/nonce');
  const nonce = nonceRes.body.nonce;

  const wallet = ethers.Wallet.createRandom();
  const signature = await wallet.signMessage(
    `Please sign this message to link your wallet. Nonce: ${nonce}`
  );

  await agent.post('/api/auth/link-wallet').send({ walletAddress: wallet.address, signature });
  return wallet.address;
};
