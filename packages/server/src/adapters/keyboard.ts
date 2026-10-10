import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { EventBus } from '@tabledux/core';
import { KEY_NAMES } from './keycodes.js';

/**
 * Reads a Linux keyboard straight from /dev/input, so hotkeys work on a
 * headless Pi with no focused window. Emits `key.down {key, code}` on
 * each press (auto-repeat is ignored). Needs read access to the device,
 * which the `input` group gives.
 *
 * struct input_event on 64-bit Linux is 24 bytes:
 *   timeval (16) | type u16 | code u16 | value s32
 */
const EVENT_SIZE = 24;
const EV_KEY = 1;
const PRESS = 1;

export function parseKeyEvents(buf: Buffer): { code: number; key: string }[] {
  const out: { code: number; key: string }[] = [];
  for (let off = 0; off + EVENT_SIZE <= buf.length; off += EVENT_SIZE) {
    const type = buf.readUInt16LE(off + 16);
    const code = buf.readUInt16LE(off + 18);
    const value = buf.readInt32LE(off + 20);
    if (type === EV_KEY && value === PRESS) out.push({ code, key: KEY_NAMES[code] ?? `Key${code}` });
  }
  return out;
}

/** Finds keyboards by their stable /dev/input/by-id names. */
export async function findKeyboards(): Promise<string[]> {
  const dir = '/dev/input/by-id';
  try {
    return (await readdir(dir)).filter((f) => f.endsWith('-event-kbd')).map((f) => join(dir, f));
  } catch {
    return [];
  }
}

export async function startKeyboard(
  bus: EventBus,
  setting: string,
  log: { info: (m: string) => void; warn: (m: string) => void },
): Promise<void> {
  if (setting === 'off') return;
  const paths = setting === 'auto' ? await findKeyboards() : [setting];
  if (paths.length === 0) {
    log.info('Keyboard hotkeys: no keyboard found under /dev/input/by-id (set TABLEDUX_KEYBOARD to a device path)');
    return;
  }
  for (const path of paths) {
    let pending = Buffer.alloc(0);
    const stream = createReadStream(path);
    stream.on('open', () => log.info(`Keyboard hotkeys: listening on ${path}`));
    stream.on('data', (chunk) => {
      pending = Buffer.concat([pending, chunk as Buffer]);
      const whole = pending.length - (pending.length % EVENT_SIZE);
      for (const k of parseKeyEvents(pending.subarray(0, whole))) {
        bus.emit({ type: 'key.down', source: 'keyboard', data: { key: k.key, code: k.code } });
      }
      pending = pending.subarray(whole);
    });
    stream.on('error', (err) => log.warn(`Keyboard hotkeys: can't read ${path}: ${err.message}`));
  }
}
