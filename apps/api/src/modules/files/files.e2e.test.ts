import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { filesRoutes } from './files.routes.js';
import { listExpired, deleteFile } from '../../shared/storage.js';

function base64(str: string) {
  return Buffer.from(str).toString('base64');
}

describe('Files E2E', () => {
  it('upload -> download -> ttl cleanup', async () => {
    const server = Fastify();
    await server.register(filesRoutes as any);

    const payload = { filename: 'e2e.txt', content: base64('e2e-content'), ttlSeconds: 1 };
    const res = await server.inject({ method: 'POST', url: '/api/files', payload });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty('code');

    const get1 = await server.inject({ method: 'GET', url: `/files/${body.code}` });
    expect(get1.statusCode).toBe(200);
    expect(get1.body).toBe('e2e-content');

    // wait for TTL to expire
    await new Promise((r) => setTimeout(r, 1500));

    // run cleanup logic (simulate worker)
    const expired = await listExpired();
    for (const code of expired) {
      await deleteFile(code);
    }

    const get2 = await server.inject({ method: 'GET', url: `/files/${body.code}` });
    expect(get2.statusCode).toBe(404);

    await server.close();
  }, 10000);
});
