import request from 'supertest';
import { ethers } from 'ethers';
import app from '../src/app';
import { resetDatabase } from './testDb';
import { env } from '../src/config/env';

const ADMIN_CREDS = { email: env.adminEmail, password: env.adminPassword! };

const loginAsAdmin = async () => {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send(ADMIN_CREDS);
  expect(res.status).toBe(200);
  return agent;
};

const registerUser = async (email: string) => {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  return { agent, id: res.body.user.id as string };
};

describe('Admin routes', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('rejects a non-admin with 403', async () => {
    const { agent } = await registerUser('bob@example.com');
    const res = await agent.get('/api/admin/users');
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('lists users with pagination defaults and honors the max limit clamp', async () => {
    await registerUser('bob@example.com');
    await registerUser('carol@example.com');

    const admin = await loginAsAdmin();
    const res = await admin.get('/api/admin/users?limit=9999');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100); // clamped to maxLimit
    expect(res.body.total).toBeGreaterThanOrEqual(3); // 2 users + seeded admin
  });

  it('returns aggregate stats', async () => {
    await registerUser('bob@example.com');
    const admin = await loginAsAdmin();
    const res = await admin.get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.stats.totalUsers).toBeGreaterThanOrEqual(2);
    expect(res.body.stats.totalAdmins).toBeGreaterThanOrEqual(1);
  });

  describe('GET /api/admin/analytics', () => {
    it('rejects a non-admin with 403', async () => {
      const { agent } = await registerUser('bob@example.com');
      const res = await agent.get('/api/admin/analytics');
      expect(res.status).toBe(403);
    });

    it('returns today\'s signup/token/transaction counts and the top creator', async () => {
      const { agent: bob } = await registerUser('bob@example.com');
      await bob.post('/api/tokens/record').send({
        name: 'Analytics Token',
        symbol: 'ANL',
        initialSupply: 100,
        contractAddress: ethers.Wallet.createRandom().address,
        txHash: '0x' + '3'.repeat(64),
        chainId: '31337',
      });

      const admin = await loginAsAdmin();
      const res = await admin.get('/api/admin/analytics');
      expect(res.status).toBe(200);
      expect(res.body.days).toBe(14);

      const today = new Date().toISOString().slice(0, 10);
      const todaySignups = res.body.signups.find((d: { day: string }) => d.day === today);
      const todayTokens = res.body.tokensCreated.find((d: { day: string }) => d.day === today);
      const todayTx = res.body.transactions.find((d: { day: string }) => d.day === today);

      expect(todaySignups.count).toBeGreaterThanOrEqual(2); // bob + seeded admin
      expect(todayTokens.count).toBe(1);
      expect(todayTx.count).toBe(1); // token_creation transaction

      expect(res.body.topCreators).toHaveLength(1);
      expect(res.body.topCreators[0]).toMatchObject({ email: 'bob@example.com', token_count: 1 });
    });

    it('clamps the days parameter to [1, 90]', async () => {
      const admin = await loginAsAdmin();
      const tooMany = await admin.get('/api/admin/analytics?days=9999');
      expect(tooMany.body.days).toBe(90);

      const tooFew = await admin.get('/api/admin/analytics?days=0');
      expect(tooFew.body.days).toBe(14); // invalid -> falls back to default
    });
  });

  describe('PATCH /api/admin/users/:id/role', () => {
    it('rejects an invalid role', async () => {
      const { id } = await registerUser('bob@example.com');
      const admin = await loginAsAdmin();
      const res = await admin.patch(`/api/admin/users/${id}/role`).send({ role: 'superadmin' });
      expect(res.status).toBe(400);
    });

    it('updates a user role', async () => {
      const { id } = await registerUser('bob@example.com');
      const admin = await loginAsAdmin();
      const res = await admin.patch(`/api/admin/users/${id}/role`).send({ role: 'moderator' });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('moderator');
    });

    it('404s for a non-existent user', async () => {
      const admin = await loginAsAdmin();
      const res = await admin.patch('/api/admin/users/does-not-exist/role').send({ role: 'user' });
      expect(res.status).toBe(404);
    });

    it('blocks an admin from demoting themselves', async () => {
      const admin = await loginAsAdmin();
      const profile = await admin.get('/api/auth/profile');
      const adminId = profile.body.user.id;

      const res = await admin.patch(`/api/admin/users/${adminId}/role`).send({ role: 'user' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('deletes a user', async () => {
      const { id } = await registerUser('bob@example.com');
      const admin = await loginAsAdmin();
      const res = await admin.delete(`/api/admin/users/${id}`);
      expect(res.status).toBe(200);
    });

    it('404s for a non-existent user', async () => {
      const admin = await loginAsAdmin();
      const res = await admin.delete('/api/admin/users/does-not-exist');
      expect(res.status).toBe(404);
    });

    it('blocks an admin from deleting their own account', async () => {
      const admin = await loginAsAdmin();
      const profile = await admin.get('/api/auth/profile');
      const adminId = profile.body.user.id;

      const res = await admin.delete(`/api/admin/users/${adminId}`);
      expect(res.status).toBe(400);
    });
  });
});
