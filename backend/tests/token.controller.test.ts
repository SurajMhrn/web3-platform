import request from 'supertest';
import { ethers } from 'ethers';
import app from '../src/app';
import { resetDatabase } from './testDb';

const VALID_TX_HASH = '0x' + '1'.repeat(64);
const VALID_ADDRESS = ethers.Wallet.createRandom().address;

const registerAndLogin = async (email = 'alice@example.com') => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
};

const validTokenPayload = {
  name: 'My Token',
  symbol: 'MYT',
  initialSupply: 1000,
  contractAddress: VALID_ADDRESS,
  txHash: VALID_TX_HASH,
  chainId: '31337',
};

describe('Token recording', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /api/tokens/record', () => {
    it('records a token and its side effects (transaction + notification) atomically', async () => {
      const agent = await registerAndLogin();

      const res = await agent.post('/api/tokens/record').send(validTokenPayload);
      expect(res.status).toBe(201);
      expect(res.body.token.contract_address).toBe(VALID_ADDRESS.toLowerCase());

      const tokens = await agent.get('/api/tokens');
      expect(tokens.body.tokens).toHaveLength(1);

      const transactions = await agent.get('/api/transactions');
      expect(transactions.body.transactions).toHaveLength(1);
      expect(transactions.body.transactions[0].type).toBe('token_creation');

      const notifications = await agent.get('/api/notifications');
      expect(notifications.body.notifications).toHaveLength(1);
      expect(notifications.body.notifications[0].type).toBe('token_created');
    });

    it('rejects an invalid contract address', async () => {
      const agent = await registerAndLogin();
      const res = await agent
        .post('/api/tokens/record')
        .send({ ...validTokenPayload, contractAddress: 'not-an-address' });
      expect(res.status).toBe(400);
    });

    it('rejects a malformed transaction hash', async () => {
      const agent = await registerAndLogin();
      const res = await agent.post('/api/tokens/record').send({ ...validTokenPayload, txHash: '0xnothex' });
      expect(res.status).toBe(400);
    });

    it('rejects a non-positive initial supply', async () => {
      const agent = await registerAndLogin();
      const res = await agent.post('/api/tokens/record').send({ ...validTokenPayload, initialSupply: 0 });
      expect(res.status).toBe(400);
    });

    it('requires authentication', async () => {
      const res = await request(app).post('/api/tokens/record').send(validTokenPayload);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/tokens/transfer-record', () => {
    it('records a transfer transaction + notification without creating a token row', async () => {
      const agent = await registerAndLogin();
      const toAddress = ethers.Wallet.createRandom().address;

      const res = await agent.post('/api/tokens/transfer-record').send({
        tokenName: 'My Token',
        tokenSymbol: 'MYT',
        contractAddress: VALID_ADDRESS,
        toAddress,
        amount: 50,
        txHash: VALID_TX_HASH,
        chainId: '31337',
      });
      expect(res.status).toBe(200);

      const tokens = await agent.get('/api/tokens');
      expect(tokens.body.tokens).toHaveLength(0);

      const transactions = await agent.get('/api/transactions');
      expect(transactions.body.transactions).toHaveLength(1);
      expect(transactions.body.transactions[0].type).toBe('token_transfer');
    });

    it('rejects an invalid recipient address', async () => {
      const agent = await registerAndLogin();
      const res = await agent.post('/api/tokens/transfer-record').send({
        contractAddress: VALID_ADDRESS,
        toAddress: 'not-an-address',
        amount: 50,
        txHash: VALID_TX_HASH,
        chainId: '31337',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/tokens/admin', () => {
    it('is scoped to admins only', async () => {
      const agent = await registerAndLogin();
      const res = await agent.get('/api/tokens/admin');
      expect(res.status).toBe(403);
    });
  });
});
