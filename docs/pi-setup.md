# Running Mensadux on a Raspberry Pi

Target: Raspberry Pi 400 / Pi 4 / Pi 5 with Raspberry Pi OS (64-bit, Bookworm or later).

## 1. Install Node.js 22

```sh
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v   # v22.x
```

## 2. Get and build Mensadux

```sh
sudo git clone https://github.com/FrunkQ/Tabledux.git /opt/mensadux
sudo chown -R $USER /opt/mensadux
cd /opt/mensadux
npm ci
npm run build
```

## 3. Try it by hand

```sh
MENSADUX_DATA=./data npm start
```

Open `http://<pi-address>:8080` from any phone or laptop on the same network. On the Pi 400 itself, press a key: it should show under **Status → Recent events**. If it doesn't, your user needs to be in the `input` group (`sudo usermod -aG input $USER`, then log out and back in).

## 4. Run it at boot

```sh
sudo useradd --system --no-create-home --groups input mensadux
sudo chown -R mensadux /opt/mensadux
sudo cp deploy/mensadux.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mensadux
journalctl -u mensadux -f    # logs
```

Config lives in `/var/lib/mensadux` (`devices.json`, `scenes.json`, `bindings.json`). Back that folder up and you've backed up the table. Access tokens (Home Assistant) are kept separately in `secrets.json` in the same folder, readable only by the service user, and are never sent to the web UI.

## Settings

All optional, set as environment variables (in the service file or your shell):

| Variable | Default | Meaning |
|---|---|---|
| `MENSADUX_PORT` | `8080` | Web UI and API port |
| `MENSADUX_HOST` | `0.0.0.0` | Interface to listen on |
| `MENSADUX_DATA` | `./data` | Config folder |
| `MENSADUX_KEYBOARD` | `auto` | `auto` finds keyboards under `/dev/input/by-id`; a device path picks one; `off` disables hotkeys |
| `MENSADUX_LOG` | `info` | Log level |

## Updating

```sh
cd /opt/mensadux && git pull && npm ci && npm run build && sudo systemctl restart mensadux
```
