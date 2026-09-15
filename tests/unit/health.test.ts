import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { startHealthServer } from '../../src/ops/health.ts';
async function withServer(ready: () => Promise<boolean>, verify: (url: string) => Promise<void>) {
  const server = await startHealthServer({ healthHost: '127.0.0.1', healthPort: 0 }, ready);
  try {
    const address = server.address() as AddressInfo;
    await verify(`http://127.0.0.1:${address.port}`);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}
test('health: liveness stays separate from failed readiness', async () => {
  await withServer(async () => false, async (url) => {
    assert.equal((await fetch(`${url}/healthz`)).status, 200);
    const response = await fetch(`${url}/readyz`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
  });
});
test('health: dependency exceptions fail closed without exposing details', async () => {
  await withServer(async () => { throw new Error('database-url=secret'); }, async (url) => {
    const response = await fetch(`${url}/readyz`);
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes('secret'));
  });
});
test('health: readiness success, unknown route and wrong method', async () => {
  await withServer(async () => true, async (url) => {
    assert.equal((await fetch(`${url}/readyz`)).status, 200);
    assert.equal((await fetch(`${url}/other`)).status, 404);
    assert.equal((await fetch(`${url}/healthz`, { method: 'POST' })).status, 405);
  });
});
