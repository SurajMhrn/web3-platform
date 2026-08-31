import request from 'supertest';
import { ethers } from 'ethers';
import app from '../src/app';
import { resetDatabase } from './testDb';

const EMAIL = 'alice@example.com';
const PASSWORD = 'correct-horse-battery';

describe('Auth flow', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('creates a user and sets accessToken + refreshToken cookies, no token in the body', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: EMAIL, password: PASSWORD });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(EMAIL);
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.token).toBeUndefined();

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
      expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
    });

    it('rejects a duplicate email', async () => {
      await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
      const res = await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
      expect(res.status).toBe(400);
    });

    it('rejects an invalid email', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: PASSWORD });
      expect(res.status).toBe(400);
    });

    it('rejects a short password', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: EMAIL, password: 'short' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
    });

    it('logs in with correct credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(EMAIL);
    });

    it('rejects an unknown email', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'nope@example.com', password: PASSWORD });
      expect(res.status).toBe(401);
    });

    it('rejects a wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: 'wrong-password' });
      expect(res.status).toBe(401);
    });
  });

  describe('Cookie-based session (profile / refresh / logout)', () => {
    it('GET /api/auth/profile works with the session cookie and fails without it', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });

      const authed = await agent.get('/api/auth/profile');
      expect(authed.status).toBe(200);
      expect(authed.body.user.email).toBe(EMAIL);

      const anonymous = await request(app).get('/api/auth/profile');
      expect(anonymous.status).toBe(401);
    });

    it('POST /api/auth/refresh rotates the session and keeps it valid', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });

      const refreshed = await agent.post('/api/auth/refresh');
      expect(refreshed.status).toBe(200);

      const stillAuthed = await agent.get('/api/auth/profile');
      expect(stillAuthed.status).toBe(200);
    });

    it('POST /api/auth/refresh fails without a refresh cookie', async () => {
      const res = await request(app).post('/api/auth/refresh');
      expect(res.status).toBe(401);
    });

    it('POST /api/auth/logout revokes the session so refresh and profile subsequently fail', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });

      const logoutRes = await agent.post('/api/auth/logout');
      expect(logoutRes.status).toBe(200);

      const refreshAfterLogout = await agent.post('/api/auth/refresh');
      expect(refreshAfterLogout.status).toBe(401);
    });
  });

  describe('Wallet linking', () => {
    it('links a wallet given a valid signed nonce, and rejects a mismatched signature', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });

      const nonceRes = await agent.post('/api/auth/nonce');
      expect(nonceRes.status).toBe(200);
      const { nonce } = nonceRes.body;

      const wallet = ethers.Wallet.createRandom();
      const message = `Please sign this message to link your wallet. Nonce: ${nonce}`;
      const signature = await wallet.signMessage(message);

      const linkRes = await agent
        .post('/api/auth/link-wallet')
        .send({ walletAddress: wallet.address, signature });
      expect(linkRes.status).toBe(200);
      expect(linkRes.body.user.wallet_address).toBe(wallet.address.toLowerCase());
    });

    it('rejects a well-formed signature that does not match the claimed address', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
      await agent.post('/api/auth/nonce');

      const signer = ethers.Wallet.createRandom();
      const impersonated = ethers.Wallet.createRandom();
      const signature = await signer.signMessage('Please sign this message to link your wallet. Nonce: whatever');

      const res = await agent
        .post('/api/auth/link-wallet')
        .send({ walletAddress: impersonated.address, signature });
      expect(res.status).toBe(401);
    });

    it('rejects an invalid wallet address format before touching signature verification', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
      await agent.post('/api/auth/nonce');

      const res = await agent
        .post('/api/auth/link-wallet')
        .send({ walletAddress: 'not-an-address', signature: '0xdeadbeef' });
      expect(res.status).toBe(400);
    });

    const linkWalletAs = async (agent: ReturnType<typeof request.agent>, wallet: ReturnType<typeof ethers.Wallet.createRandom>) => {
      const nonceRes = await agent.post('/api/auth/nonce');
      const message = `Please sign this message to link your wallet. Nonce: ${nonceRes.body.nonce}`;
      const signature = await wallet.signMessage(message);
      return agent.post('/api/auth/link-wallet').send({ walletAddress: wallet.address, signature });
    };

    it('unlinks a wallet, and rejects unlinking again when none is linked', async () => {
      const agent = request.agent(app);
      await agent.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
      const wallet = ethers.Wallet.createRandom();
      await linkWalletAs(agent, wallet);

      const unlinkRes = await agent.post('/api/auth/unlink-wallet');
      expect(unlinkRes.status).toBe(200);
      expect(unlinkRes.body.user.wallet_address).toBeFalsy();

      const secondUnlinkRes = await agent.post('/api/auth/unlink-wallet');
      expect(secondUnlinkRes.status).toBe(400);
    });

    it('requires authentication', async () => {
      const res = await request(app).post('/api/auth/unlink-wallet');
      expect(res.status).toBe(401);
    });

    it('after unlinking, the freed address can be linked to a different account, and this account can link a new wallet', async () => {
      const agentA = request.agent(app);
      await agentA.post('/api/auth/register').send({ email: EMAIL, password: PASSWORD });
      const walletOne = ethers.Wallet.createRandom();
      const walletTwo = ethers.Wallet.createRandom();
      await linkWalletAs(agentA, walletOne);

      // While walletOne is still linked to account A, account B can't claim it.
      const agentB = request.agent(app);
      await agentB.post('/api/auth/register').send({ email: 'bob@example.com', password: PASSWORD });
      const blockedRes = await linkWalletAs(agentB, walletOne);
      expect(blockedRes.status).toBe(400);

      // Account A unlinks walletOne, then links a different wallet (walletTwo).
      await agentA.post('/api/auth/unlink-wallet');
      const relinkRes = await linkWalletAs(agentA, walletTwo);
      expect(relinkRes.status).toBe(200);
      expect(relinkRes.body.user.wallet_address).toBe(walletTwo.address.toLowerCase());

      // walletOne is now free — account B can link it.
      const nowFreeRes = await linkWalletAs(agentB, walletOne);
      expect(nowFreeRes.status).toBe(200);
      expect(nowFreeRes.body.user.wallet_address).toBe(walletOne.address.toLowerCase());
    });
  });
});
