# Running Tabledux on a Raspberry Pi

Target: Raspberry Pi 400 / Pi 4 / Pi 5 with Raspberry Pi OS (64-bit, Bookworm or later).

## 1. Install Node.js 22

```sh
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v   # v22.x
```

## 2. Get and build Tabledux

```sh
sudo git clone https://github.com/FrunkQ/Tabledux.git /opt/tabledux
sudo chown -R $USER /opt/tabledux
cd /opt/tabledux
npm ci
npm run build
```

## 3. Try it by hand

```sh
TABLEDUX_DATA=./data npm start
```

Open `http://<pi-address>:8080` from any phone or laptop on the same network. On the Pi 400 itself, press a key: it should show under **Status → Recent events**. If it doesn't, your user needs to be in the `input` group (`sudo usermod -aG input $USER`, then log out and back in).

## 4. Run it at boot

```sh
sudo useradd --system --no-create-home --groups input tabledux
sudo chown -R tabledux /opt/tabledux
sudo cp deploy/tabledux.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tabledux
journalctl -u tabledux -f    # logs
```

Config lives in `/var/lib/tabledux` (`devices.json`, `scenes.json`, `bindings.json`). Back that folder up and you've backed up the table.

## Settings

All optional, set as environment variables (in the service file or your shell):

| Variable | Default | Meaning |
|---|---|---|
| `TABLEDUX_PORT` | `8080` | Web UI and API port |
| `TABLEDUX_HOST` | `0.0.0.0` | Interface to listen on |
| `TABLEDUX_DATA` | `./data` | Config folder |
| `TABLEDUX_KEYBOARD` | `auto` | `auto` finds keyboards under `/dev/input/by-id`; a device path picks one; `off` disables hotkeys |
| `TABLEDUX_LOG` | `info` | Log level |

## Updating

```sh
cd /opt/tabledux && git pull && npm ci && npm run build && sudo systemctl restart tabledux
```
