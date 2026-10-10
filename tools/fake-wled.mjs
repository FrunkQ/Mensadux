#!/usr/bin/env node
// A pretend WLED controller for developing without hardware.
// Usage: node tools/fake-wled.mjs [port]   (default 8090)
// Then add "localhost:8090" as a device in Tabledux.
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? 8090);
let state = {
  on: true,
  bri: 128,
  transition: 7,
  mainseg: 0,
  nl: { on: false, dur: 60 },
  udpn: { send: false, recv: true },
  seg: [{ id: 0, start: 0, stop: 854, len: 854, on: true, bri: 255, col: [[255, 160, 60], [0, 0, 0], [0, 0, 0]], fx: 0, sx: 128, ix: 128, pal: 0 }],
};
const presets = { 0: {}, 1: { n: 'Warm white' }, 2: { n: 'Lava' }, 3: { n: 'Ocean' } };

function merge(update) {
  if ('ps' in update) {
    console.log(`preset ${update.ps}`);
    return;
  }
  const { seg, ...rest } = update;
  state = { ...state, ...rest };
  if (Array.isArray(seg)) {
    for (const s of seg) {
      const i = state.seg.findIndex((x) => x.id === s.id);
      if (s.stop === 0) {
        if (i >= 0) state.seg.splice(i, 1);
      } else if (i >= 0) state.seg[i] = { ...state.seg[i], ...s };
      else state.seg.push({ ...s });
    }
  }
}

createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const send = (obj) => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(obj));
    };
    if (req.url === '/json/info') return send({ name: 'Fake WLED', ver: '0.15.0', leds: { count: 854 } });
    if (req.url === '/json/state' && req.method === 'GET') return send(state);
    if (req.url === '/presets.json') return send(presets);
    if (req.url === '/json/state' && req.method === 'POST') {
      merge(JSON.parse(body || '{}'));
      console.log('state <-', body);
      return send({ success: true });
    }
    res.writeHead(404).end();
  });
}).listen(port, () => console.log(`Fake WLED on http://localhost:${port}`));
