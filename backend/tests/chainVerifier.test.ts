import request from 'supertest';
import { ethers } from 'ethers';
import app from '../src/app';
import { resetDatabase } from './testDb';
import { verifyTokenCreation, verifyTokenTransfer } from '../src/services/chainVerifier';

/**
 * Exercises the real verifier — no module mock here, unlike the suites that
 * merely need recording to succeed. The chain read itself is stubbed at the
 * provider so these stay offline while the matching logic runs for real.
 */

const tokenCreatedInterface = new ethers.Interface([
  'event TokenCreated(address indexed tokenAddress, address indexed creator, string name, string symbol, uint256 initialSupply)',
]);
const erc20Interface = new ethers.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

const CHAIN_ID = '31337';
const TX_HASH = '0x' + 'a'.repeat(64);

const CREATOR = ethers.Wallet.createRandom().address;
const OTHER_WALLET = ethers.Wallet.createRandom().address;
const TOKEN_ADDRESS = ethers.Wallet.createRandom().address;
const RECIPIENT = ethers.Wallet.createRandom().address;

const tokenCreatedLog = (tokenAddress: string, creator: string, name = 'My Token', symbol = 'MYT') => {
  const { data, topics } = tokenCreatedInterface.encodeEventLog('TokenCreated', [
    tokenAddress,
    creator,
    name,
    symbol,
    1000n,
  ]);
  return { address: TOKEN_ADDRESS, topics, data };
};

const transferLog = (from: string, to: string, emittedBy = TOKEN_ADDRESS) => {
  const { data, topics } = erc20Interface.encodeEventLog('Transfer', [from, to, 500n]);
  return { address: emittedBy, topics, data };
};

/** Stubs the next chain read with a receipt-shaped object (or null). */
const stubReceipt = (receipt: unknown) =>
  jest
    .spyOn(ethers.JsonRpcProvider.prototype, 'getTransactionReceipt')
    .mockResolvedValue(receipt as never);

const validCreationClaim = {
  txHash: TX_HASH,
  chainId: CHAIN_ID,
  creator: CREATOR,
  contractAddress: TOKEN_ADDRESS,
  name: 'My Token',
  symbol: 'MYT',
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('chain verification — token creation', () => {
  it('accepts a transaction that really created the reported token', async () => {
    stubReceipt({ status: 1, from: CREATOR, logs: [tokenCreatedLog(TOKEN_ADDRESS, CREATOR)] });
    await expect(verifyTokenCreation(validCreationClaim)).resolves.toBeUndefined();
  });

  it('accepts regardless of address casing', async () => {
    stubReceipt({ status: 1, from: CREATOR.toLowerCase(), logs: [tokenCreatedLog(TOKEN_ADDRESS, CREATOR)] });
    await expect(
      verifyTokenCreation({ ...validCreationClaim, contractAddress: TOKEN_ADDRESS.toUpperCase().replace('0X', '0x') })
    ).resolves.toBeUndefined();
  });

  it('rejects a transaction that does not exist on chain', async () => {
    stubReceipt(null);
    await expect(verifyTokenCreation(validCreationClaim)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a transaction that reverted', async () => {
    stubReceipt({ status: 0, from: CREATOR, logs: [] });
    await expect(verifyTokenCreation(validCreationClaim)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a transaction sent by someone else', async () => {
    stubReceipt({ status: 1, from: OTHER_WALLET, logs: [tokenCreatedLog(TOKEN_ADDRESS, OTHER_WALLET)] });
    await expect(verifyTokenCreation(validCreationClaim)).rejects.toThrow(
      /not sent by the wallet linked to your account/i
    );
  });

  it('rejects a transaction that created no token at all', async () => {
    stubReceipt({ status: 1, from: CREATOR, logs: [] });
    await expect(verifyTokenCreation(validCreationClaim)).rejects.toThrow(/did not create a token/i);
  });

  it('rejects a claim naming a different contract than the chain shows', async () => {
    const someoneElsesToken = ethers.Wallet.createRandom().address;
    stubReceipt({ status: 1, from: CREATOR, logs: [tokenCreatedLog(someoneElsesToken, CREATOR)] });
    await expect(verifyTokenCreation(validCreationClaim)).rejects.toThrow(/different token/i);
  });

  it('rejects forged token metadata', async () => {
    stubReceipt({ status: 1, from: CREATOR, logs: [tokenCreatedLog(TOKEN_ADDRESS, CREATOR, 'Real Name', 'REAL')] });
    await expect(verifyTokenCreation(validCreationClaim)).rejects.toThrow(/does not match the chain/i);
  });

  it('rejects an unsupported chain rather than trusting it', async () => {
    await expect(
      verifyTokenCreation({ ...validCreationClaim, chainId: '999999' })
    ).rejects.toThrow(/cannot be verified/i);
  });
});

describe('chain verification — token transfer', () => {
  const validTransferClaim = {
    txHash: TX_HASH,
    chainId: CHAIN_ID,
    from: CREATOR,
    to: RECIPIENT,
    contractAddress: TOKEN_ADDRESS,
  };

  it('accepts a real transfer of the reported token', async () => {
    stubReceipt({ status: 1, from: CREATOR, logs: [transferLog(CREATOR, RECIPIENT)] });
    await expect(verifyTokenTransfer(validTransferClaim)).resolves.toBeUndefined();
  });

  it('rejects a transfer of a different token contract', async () => {
    const otherToken = ethers.Wallet.createRandom().address;
    stubReceipt({ status: 1, from: CREATOR, logs: [transferLog(CREATOR, RECIPIENT, otherToken)] });
    await expect(verifyTokenTransfer(validTransferClaim)).rejects.toThrow(/no transfer of the reported token/i);
  });

  it('rejects a forged recipient', async () => {
    stubReceipt({ status: 1, from: CREATOR, logs: [transferLog(CREATOR, OTHER_WALLET)] });
    await expect(verifyTokenTransfer(validTransferClaim)).rejects.toThrow(/sender or recipient does not match/i);
  });
});

describe('recording requires a proven wallet', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('refuses to record on-chain activity for an account with no linked wallet', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email: 'nowallet@example.com', password: 'password123' });

    const res = await agent.post('/api/tokens/record').send({
      name: 'My Token',
      symbol: 'MYT',
      initialSupply: 1000,
      contractAddress: TOKEN_ADDRESS,
      txHash: TX_HASH,
      chainId: CHAIN_ID,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/link a wallet/i);
  });
});
