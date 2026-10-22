# Mensadux: legacy walkthrough and requirements (draft 3)

*Working name: **Mensadux**, the table companion app to Mappadux. Nothing here is set in stone.*

Sources: **GameTableWLED** (GitHub, the PC app in use today), **dynamic-map-renderer-v2 / Mappadux** (GitHub) and the **Legacy folder** (C:\Development\gamingtablev2\Legacy, read 2026-10-09). The Legacy folder turned out to hold only the 2018–2019 LED driver work, so the ESP32 puck, LDR, RFID and rules sections still rest on Alex's description and GameTableWLED.

## 1. What I understand you're building

A boardgame + RPG table that acts as an ambient "game master's assistant":

- **The table is the hub.** A Raspberry Pi (Pi 400 for dev) lives in the table and runs the brains. Everything else (phones, tablets, a small touchscreen, a GM laptop) is just a web client.
- **LEDs round the table edge** show mood (background scenes) and game state (whose turn, seat colours, timers, alerts). WLED drives them, possibly several WLED devices (table, room, ceiling), or a Pimoroni Plasma 2350 W to keep it "all Pi".
- **Each player has a tiny ESP32 puck**: battery, one LDR, one or two buttons, a light pipe so the table LED in front of the player shows through the button. It sleeps most of the time; the colour you see is the table's LED, not the puck's.
- **Seat detection:** in "position mode" the table flashes a sequence round the strip; each puck's LDR sees which LEDs are in front of it, so the table learns where every player sits.
- **Lots of ways to trigger things:** keyboard hotkeys (great on the Pi 400), RFID cards (a card = a scene/game), external hardware triggers, touchscreen/tablet/app, and the player buttons.
- **Game logic on the table:** turn order, passes, rounds, timers, reminders and scoring, configured per game rather than hard-coded.
- **Atmosphere comes from Mappadux:** it owns sound (positional soundscapes, Spotify, SFX, and Syrinscape once that moves over). The table fires home automation (Home Assistant, MQTT) alongside LED scenes and cues Mappadux.
- **Screen content later:** Mappadux (DMRv2) handles maps on an under-table screen or projector, and should be driven from the same table events.

## 2. Where things stand

### GameTableWLED (in use, C#/WPF, Windows only, last commit Nov 2021)
Works today:
- **Background scenes:** snapshot the full WLED JSON state of the main strip (plus optional support WLEDs) and save it as a `.bgscene` file. Recall from a list or by **RFID card** (ACR122U reader; `data/SceneList` maps card UID → scene). Option to keep or kill the scene when the card is lifted.
- **Scene extras:** each scene can also start a Syrinscape mood, a Spotify URL, a local looping sound effect, or a command-line program.
- Built-in StartState and BlackOut scenes.

Sketched but not finished:
- **Foreground layer** (`ForeGroundScene.cs`): reserves the top WLED segments for a table status bar + one segment per player (max 7, 20 LEDs wide, placed by LED index), overlaid on the background. Alerts use WLED effects (Heartbeat for a player, Lighthouse for clockwise "next" sweeps). Countdown bar not implemented.
- **Game model** (`Game.cs`): a rules-as-data schema. Start player (manual/random/colour), turn order (clockwise, anticlockwise, simultaneous, odd/even, random), turn end (pass, race, timer race), round start/end rules, game end, countdowns, pre/post turn and round reminders, status bars (solid/percent), colours available, BGG link, default scene. Terraforming Mars is the worked example. Game states: setup → playerPositioning → gameReady → start → preRound → preTurn → playerTurn → postTurn → postRound → gameEnd.
- **Player controls** (`InGameControls.cs`): OK/end turn, pass, KO, undo, pause timer, end round, finish game. All stubs.
- **Button hardware** (in `UISpecNotes.txt`): press to pair; press to start position detection, long press to retry; press to cycle colour, long press to confirm; in game, press = end turn (or start a delayed countdown), long press = pass. Bluetooth buttons are an empty stub.
- MQTT and TableTopAudio are stubs.
- UI spec: Config / Setup (scenes + game/player setup) / Play UI. "Highlight rule breaks, don't block them."

Limits that point at a rewrite: Windows/x86 only (because of the RFID library), test data and IPs hard-coded in `Globals.cs`, WLED's segment limit drives a lot of awkward segment juggling, no web UI or API.

> **Heads-up:** `Globals.cs` in that repo has a Syrinscape API token and a Home Assistant/MQTT password in plain text. It's private, but I'd rotate those and keep secrets out of the new project.

### Mappadux / DMRv2 (active, TypeScript, v2.19)
- Browser-only VTT: GM view, player phones (QR/room code), calibrated projector/under-table screen. Peer-to-peer over WebRTC (PeerJS) with the GM browser as the authority. No backend; state lives in the GM's browser.
- **"Stagecraft"** (behind an in-progress flag, `src/stagecraft/`): per map, fire a WLED preset, a Home Assistant scene/script/service, or a QLC+ function when the map loads. The WLED and HA clients are small and self-contained, so they're easy to lift into the table. **Never tested against real hardware** (Alex, 2026-10-09), so treat it as reference code, not proven code. Lighting and home-automation control now lives in the table project.
- Players have names and colours (12-colour palette) but **no physical seat concept**.
- **No inbound API.** Nothing outside the GM browser can tell it to change map. Integration needs a new message in the GM app, or a table service joining as a peer.

### Legacy folder (2018–2019 Pi LED work, read-only survey)
No notes, wishlists, puck firmware, LDR code, RFID or rules live here. What's there:
- **Hardware facts:** the real table strip is **854 LEDs** (273 + 154 + 273 + 154 at 144/m, so a table edge of about 1.9 m × 1.07 m). It is driven over **SPI with a 5-bit global brightness**, which points to **APA102/DotStar-type LEDs**, not WS2812. Brightness was capped at 16/31 to limit power. There's also a 248-LED test strip.
- **`Table\table\` (C++ on Raspbian, 2018, much of it by Peter):** render primitives (gradients, images, fades, gamma) and `Regions.cpp`, which splits the edge into seat zones. The modes are Table (4 seats) and RPG (6 seats, 20 px each), plus a Boardgame enum value. Default palette: red, blue, white, orange, green, brown. Commented-out code holds hand-measured seat fractions (0.090/0.314/0.437/0.590/0.741/0.864). There's also a TCP server skeleton.
- **`TableController` / `LEDControlTest` (C# Windows 10 IoT Core, 2019):** an HTTP "lamp" API on port 80 (`?colour`, `?rgb`, `?brightness`, `?rainbow`, `?off`). Its web page, TableColourSelect.html, isn't in the folder.
- **`Table2019\` (Oct 2019, the most advanced):** a 50 fps render loop with a command queue and composable scenes (Static, Sequence, RandomNoise), plus the **position-detection transmitter**. Every 10 s it flashes 4 sync frames (black/white/black/white), then 7 binary stripe frames (1…64 repeats, about 182 ms each) across all 854 LEDs, then 8 s of black. A sensor at a seat would read 7 bits, which is 1 of 128 positions, about 6–7 LEDs or roughly 4.6 cm. **The receiving side was never written** (no LDR decode, no recorded results). The code uses plain binary, not Gray code, so a sensor sitting on a stripe edge can be badly wrong.
- **`ESP32Test\` (Jan 2019):** Espressif's stock BLE SPP server example, unchanged. This is the only radio experiment.
- **`WLED\` (2021):** an unmodified clone of WLED 0.12.1, so the plan had moved to driving the strip from an ESP running WLED instead of the Pi.

## 3. Broad requirements I take from this

**Core platform**
1. Headless table server on the Pi, always on, boots straight into a ready state, survives power cuts.
2. Everything else is a web client (phone, tablet, touchscreen kiosk, GM laptop). No install for players.
3. One event bus: every input (hotkey, RFID, button puck, touchscreen, external trigger, API call, Mappadux) becomes the same kind of event, and every output listens to it.
4. A local HTTP/WebSocket API so StreamDeck, Home Assistant, Node-RED and Mappadux can drive it and listen to it.
5. Config, scenes, games and players stored as plain files (JSON/YAML), editable from the UI, no secrets in the repo.

**Lighting**
6. Two layers: a **background scene** (mood) and a **foreground overlay** (seats, turn, timers, alerts) that sits on top without destroying the background.
7. Support several WLED outputs (table plus room) and treat each as a target; keep the door open to a Plasma 2350 W driven directly.
8. Seat zones defined by LED range, ideally learned automatically from position detection. Support the real strip: 854 APA102-style LEDs, with a power-aware brightness cap.

**Player pucks (ESP32)**
9. Pair a puck to the table, then to a player/seat.
10. Position detection: table flashes a code, puck's LDR reports what it saw, table assigns the seat. Build on the Table2019 stripe scheme, but use Gray code plus a sync/checksum frame, and run it per puck on demand rather than on a 10 s loop. The table needs direct per-LED control for this, which WLED gives through its realtime (DDP/UDP) mode.
11. Short press / long press (maybe a second button) mapped to context actions depending on game state.
12. Deep sleep by default, wake on button; battery life measured in months; report battery level.
13. Wireless link that is low power and low latency (likely ESP-NOW to a table-side receiver, or BLE; Wi-Fi is the power hog). To be decided.

**Game engine**
14. Rules as data: turn order, passing, rounds, timers, reminders, start player, simultaneous play, per game, with the TM-style schema as a starting point.
15. Game state machine from setup → seating → colour pick → play → end, with undo.
16. Per-player status (score/HP) shown on the LEDs and on screens; session stats (turn times, game time).
17. Soft enforcement: highlight odd things, never block.

**Scenes**
18. Table scene = LEDs + home automation (HA/MQTT) + a cue to Mappadux. **Sound and atmosphere belong to Mappadux** (decided 2026-10-09). It already does positional soundscapes, soundboards and Spotify, so the table doesn't duplicate any of that.
19. Triggered by RFID card, hotkey, UI, API or game state ("music during setup, chime at end of turn").

**Screens**
20. Mappadux stays the screen/map app; the table and Mappadux exchange events (map loaded → scene; scene/card → map). Move Stagecraft's WLED/HA control into the table so there is one owner of the lights. In the other direction, **Syrinscape moves into Mappadux**: GameTableWLED's online-player calls (mood play/stop and global volume via `syrinscape.com/online/frontend-api/...` with an auth token, plus the moods CSV export) become a Mappadux soundtrack source. Before building it, check whether that API allows browser (CORS) calls, because Mappadux has no backend; if it doesn't, the table server can proxy the calls.
21. A small touchscreen on the table for the GM/host with minimal distraction.
22. **Initiative link with Mappadux:** Mappadux owns initiative order. Mensadux lights the seat of whoever's turn it is in initiative (and dims the rest). A puck press of "done" from the current player or the GM tells Mappadux to advance. This needs Mappadux to accept inbound messages (it has none today): either Mensadux joins the session as a PeerJS guest, or a small local WebSocket bridge does.
23. **GM puck:** a puck with a GM role, not tied to a player seat. It can advance initiative or turns, and its button actions differ from a player's (pause, override, skip).

**Preset / scene editor (a first-class UI, not an afterthought)**
24. A proper scene editor in the web UI: live preview on the table as you edit, capture the current WLED state as a starting point, name and tag scenes, and set per-WLED / per-segment settings across several controllers.
25. Assign any scene to an RFID card, a hotkey, a puck action or a game state from the same screen ("tap card to assign" flow).
26. Scene library with thumbnails/colour swatches, quick recall, and import/export as files.

## 4. Answers so far (Alex, 2026-10-09)
- Puck: never built, only feasibility tests. Clean-slate design.
- The strip runs on **WLED now**. There's **1 WLED controller** today, with a few more planned.
- RPG needs beyond Mappadux: mostly the initiative link above, plus a GM puck.
- Sound and atmosphere: Mappadux. Stagecraft was never tested, and lights and home automation move to Mensadux.
- Scene editing UI should be good this time (req. 24–26).

## 5. Ideas to consider (not decisions)
- **Seat-aware everything:** once pucks know their seat, Mappadux could rotate a player's handouts or pings toward their side of the table, and Mensadux could flash a seat when Mappadux messages that player.
- **"Who's holding us up" timer:** per-seat turn timers shown as a slowly filling bar on that seat's LEDs, with stats at the end of the game.
- **Puck as the only input most nights:** long-press = menu mode, where the table LEDs become a radial menu around your seat and short presses step through it. That gives a lot of actions from one button without a phone.
- **Game presets from BoardGameGeek:** start a game definition from a BGG id (player counts, name, art) and only fill in the turn rules by hand.
- **Fallback with no pucks:** every puck action is also a phone button and a hotkey, so a game never stalls on a flat battery.
