import request from 'supertest';
import app from '../src/app';
import { resetDatabase } from './testDb';

describe('Security headers (helmet)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('sets standard hardening headers on every response', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    // CSP is intentionally disabled — Swagger UI (mounted on this same app)
    // needs inline styles/scripts to render.
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  it('rejects an oversized JSON body', async () => {
    const hugeBio = 'x'.repeat(200 * 1024); // over the 100kb limit
    const res = await request(app)
      .post('/api/auth/setup-profile')
      .send({ username: 'someone', bio: hugeBio });
    expect(res.status).toBe(413);
  });

  it('still serves Swagger UI with CSP disabled', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
