/** WLED colours are [r, g, b] or [r, g, b, w] arrays; colour inputs want #rrggbb. */
export function toHex(c: number[] | undefined): string {
  const [r = 0, g = 0, b = 0] = c ?? [];
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string, previous?: number[]): number[] {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Keep a white channel if the strip has one.
  return previous && previous.length > 3 ? [...rgb, previous[3]] : rgb;
}
