import { createServer } from 'node:http';
import type { Config } from '../core/config.ts';
export async function startHealthServer(config: Pick<Config, 'healthHost' | 'healthPort'>, ready: () => Promise<boolean>) {
  const server = createServer((request, response) => {
    void (async () => {
      if (request.method !== 'GET') { response.writeHead(405).end(); return; }
      if (request.url !== '/healthz' && request.url !== '/readyz') { response.writeHead(404).end(); return; }
      let ok = true;
      if (request.url === '/readyz') { try { ok = await ready(); } catch { ok = false; } }
      response.writeHead(ok ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ status: ok ? 'ok' : 'unavailable' }));
    })().catch(() => { if (!response.headersSent) response.writeHead(503); response.end(); });
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.healthPort, config.healthHost, () => { server.off('error', reject); resolve(); });
  });
  return server;
}
