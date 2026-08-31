import request from 'supertest';
import { ethers } from 'ethers';
import app from '../src/app';
import { resetDatabase } from './testDb';

const registerAndLogin = async (email: string) => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
};

const createTokenAs = async (agent: request.Agent) => {
  await agent.post('/api/tokens/record').send({
    name: 'Token',
    symbol: 'TKN',
    initialSupply: 100,
    contractAddress: ethers.Wallet.createRandom().address,
    txHash: '0x' + '2'.repeat(64),
    chainId: '31337',
  });
};

describe('Per-user scoping: transactions & notifications', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('a user only ever sees their own transactions', async () => {
    const alice = await registerAndLogin('alice@example.com');
    const bob = await registerAndLogin('bob@example.com');

    await createTokenAs(alice);

    const aliceTxs = await alice.get('/api/transactions');
    expect(aliceTxs.body.transactions).toHaveLength(1);

    const bobTxs = await bob.get('/api/transactions');
    expect(bobTxs.body.transactions).toHaveLength(0);
  });

  it('a user only ever sees their own notifications, and cannot mark another user\'s as read', async () => {
    const alice = await registerAndLogin('alice@example.com');
    const bob = await registerAndLogin('bob@example.com');

    await createTokenAs(alice);

    const aliceNotifs = await alice.get('/api/notifications');
    expect(aliceNotifs.body.notifications).toHaveLength(1);
    const notificationId = aliceNotifs.body.notifications[0].id;

    const bobNotifs = await bob.get('/api/notifications');
    expect(bobNotifs.body.notifications).toHaveLength(0);

    // Bob attempts to mark Alice's notification as read — scoped by user_id
    // in the model layer, so this is a silent no-op rather than an error.
    const markRes = await bob.patch(`/api/notifications/${notificationId}/read`);
    expect(markRes.status).toBe(200);

    const aliceNotifsAfter = await alice.get('/api/notifications');
    expect(aliceNotifsAfter.body.notifications[0].is_read).toBe(0);
  });

  it('clamps transaction pagination limit to the max', async () => {
    const alice = await registerAndLogin('alice@example.com');
    const res = await alice.get('/api/transactions?limit=99999');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });

  it('unread-count reflects only the current user\'s unread notifications', async () => {
    const alice = await registerAndLogin('alice@example.com');
    await createTokenAs(alice);

    const before = await alice.get('/api/notifications/unread-count');
    expect(before.body.count).toBe(1);

    await alice.patch('/api/notifications/read-all');

    const after = await alice.get('/api/notifications/unread-count');
    expect(after.body.count).toBe(0);
  });

  it('admin transaction/notification-adjacent admin route requires admin role', async () => {
    const alice = await registerAndLogin('alice@example.com');
    const res = await alice.get('/api/transactions/admin');
    expect(res.status).toBe(403);
  });
});
