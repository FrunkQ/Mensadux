import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { registerApi } from './api.js';
import { ConfigStore } from './config-store.js';
import { Table } from './table.js';
import { startKeyboard } from './adapters/keyboard.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const settings = {
  port: Number(process.env.TABLEDUX_PORT ?? 8080),
  host: process.env.TABLEDUX_HOST ?? '0.0.0.0',
  dataDir: resolve(process.env.TABLEDUX_DATA ?? join(repoRoot, 'data')),
  keyboard: process.env.TABLEDUX_KEYBOARD ?? 'auto',
  webDir: resolve(process.env.TABLEDUX_WEB ?? join(repoRoot, 'packages/web/dist')),
};

const app = Fastify({ logger: { level: process.env.TABLEDUX_LOG ?? 'info' } });
const log = app.log;

const config = new ConfigStore(settings.dataDir);
await config.load();
log.info(`Config folder: ${settings.dataDir}`);

const table = new Table(config, { warn: (m) => log.warn(m), error: (m) => log.error(m) });
await table.start();

await app.register(fastifyWebsocket);
app.get('/ws', { websocket: true }, (socket) => {
  const send = () => socket.send(JSON.stringify({ type: 'state', state: table.snapshot() }));
  send();
  const off = table.onChange(send);
  socket.on('close', off);
});

registerApi(app, table);

if (existsSync(settings.webDir)) {
  await app.register(fastifyStatic, { root: settings.webDir });
  // Single-page app: unknown non-API paths get index.html.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' });
    return reply.sendFile('index.html');
  });
} else {
  log.warn(`Web UI not built (${settings.webDir} missing). Run "npm run build" to serve it here.`);
}

await startKeyboard(table.bus, settings.keyboard, { info: (m) => log.info(m), warn: (m) => log.warn(m) });

// Re-check devices every 30 s so the UI shows when a controller drops off or comes back.
setInterval(() => void table.refreshDevices(), 30_000).unref();

await app.listen({ port: settings.port, host: settings.host });
