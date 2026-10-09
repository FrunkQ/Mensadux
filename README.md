# Tabledux

The table companion to [Mappadux](https://github.com/FrunkQ/dynamic-map-renderer-v2).

Tabledux runs on a Raspberry Pi built into a boardgame/RPG table. It drives the table's LEDs (via WLED) and home automation, and it takes input from hotkeys, RFID cards, per-player one-button "pucks", a touchscreen and phones. Mappadux handles screens and sound. Tabledux handles the table.

- [docs/requirements.md](docs/requirements.md): what the old projects tell us and what Tabledux must do
- [docs/architecture.md](docs/architecture.md): architecture and build order
- [docs/pi-setup.md](docs/pi-setup.md): installing on the Pi

## What works today (step 1, walking skeleton)

- Add WLED controllers and see whether they're online.
- **Scenes:** capture whatever the lights are showing as a named scene, then show it again with one click.
- **Bindings:** "when this happens, do that". Record a hotkey from the table keyboard and bind it to a scene, a WLED preset, all-off or a mode change.
- **Hotkeys** read straight from the Pi's keyboard, with no window needed.
- **API** for anything else: `POST /api/events` with `{"type":"key.down","data":{"key":"F5"}}`, or any custom event type, triggers bindings the same way.
- A live event log showing every input and what it triggered.

## Developing

```sh
npm install
npm run fake-wled          # a pretend WLED on localhost:8090 if you have no hardware handy
npm run build && npm start # server + built UI on http://localhost:8080
# or, for UI work with hot reload:
npm run dev                # server (one terminal)
npm run dev:web            # UI on Vite's port, proxied to the server
npm test
```

Layout:

```
packages/core     events, bindings engine, config schemas (no I/O)
packages/wled     WLED JSON API client and light driver
packages/server   Fastify server, config store, adapters (keyboard), REST + websocket
packages/web      Svelte UI
tools/            fake-wled.mjs
deploy/           systemd unit
```
