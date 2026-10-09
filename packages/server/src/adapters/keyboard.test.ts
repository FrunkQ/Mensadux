import { describe, expect, it } from 'vitest';
import { parseKeyEvents } from './keyboard.js';

function event(type: number, code: number, value: number): Buffer {
  const b = Buffer.alloc(24);
  b.writeUInt16LE(type, 16);
  b.writeUInt16LE(code, 18);
  b.writeInt32LE(value, 20);
  return b;
}

describe('parseKeyEvents', () => {
  it('reports presses only, with names', () => {
    const buf = Buffer.concat([
      event(4, 4, 30), // EV_MSC scan code noise
      event(1, 63, 1), // F5 down
      event(0, 0, 0), // EV_SYN
      event(1, 63, 2), // F5 auto-repeat
      event(1, 63, 0), // F5 up
      event(1, 999, 1), // unknown key
    ]);
    expect(parseKeyEvents(buf)).toEqual([
      { code: 63, key: 'F5' },
      { code: 999, key: 'Key999' },
    ]);
  });
});
