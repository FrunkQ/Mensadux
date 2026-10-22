#!/usr/bin/env node
// A pretend Home Assistant for developing without one.
// Usage: node tools/fake-ha.mjs [port]   (default 8123). The token is "dev-token".
// Add "localhost:8123" as a Home Assistant device in Mensadux and paste dev-token.
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 8123);
const TOKEN = 'dev-token';
const states = [
  { entity_id: 'scene.tavern', attributes: { friendly_name: 'Tavern' } },
  { entity_id: 'scene.movie_night', attributes: { friendly_name: 'Movie night' } },
  { entity_id: 'script.thunder', attributes: { friendly_name: 'Thunder flash' } },
  { entity_id: 'light.ceiling', attributes: { friendly_name: 'Ceiling' } },
  { entity_id: 'sensor.temperature', attributes: { friendly_name: 'Temperature' } },
];

createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = (status, obj) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(obj === undefined ? '' : JSON.stringify(obj));
    };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(401, { message: 'Unauthorized' });
    if (req.url === '/api/') return json(200, { message: 'API running.' });
    if (req.url === '/api/states') return json(200, states);
    const m = req.url?.match(/^\/api\/services\/([^/]+)\/([^/]+)$/);
    if (m && req.method === 'POST') {
      console.log(`service ${m[1]}.${m[2]} ${body}`);
      return json(200, []);
    }
    json(404, { message: 'Not found' });
  });
}).listen(port, () => console.log(`Fake Home Assistant on http://localhost:${port} (token: ${TOKEN})`));
