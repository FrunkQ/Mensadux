import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BindingsFileSchema,
  DevicesFileSchema,
  ScenesFileSchema,
  type Binding,
  type Device,
  type Scene,
} from '@tabledux/core';
import type { z } from 'zod';

/**
 * All user configuration lives as plain JSON files in one data folder,
 * so it can be backed up, diffed and hand-edited. Each file is validated
 * on load; a broken file stops startup with a clear message rather than
 * being silently replaced.
 */
export class ConfigStore {
  devices: Device[] = [];
  scenes: Scene[] = [];
  bindings: Binding[] = [];

  constructor(readonly dir: string) {}

  async load(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    this.devices = (await this.read('devices.json', DevicesFileSchema, { devices: [] })).devices;
    this.scenes = (await this.read('scenes.json', ScenesFileSchema, { scenes: [] })).scenes;
    this.bindings = (await this.read('bindings.json', BindingsFileSchema, { bindings: [] })).bindings;
  }

  saveDevices(devices: Device[]): Promise<void> {
    this.devices = DevicesFileSchema.parse({ devices }).devices;
    return this.write('devices.json', { devices: this.devices });
  }

  saveScenes(scenes: Scene[]): Promise<void> {
    this.scenes = ScenesFileSchema.parse({ scenes }).scenes;
    return this.write('scenes.json', { scenes: this.scenes });
  }

  saveBindings(bindings: Binding[]): Promise<void> {
    this.bindings = BindingsFileSchema.parse({ bindings }).bindings;
    return this.write('bindings.json', { bindings: this.bindings });
  }

  private async read<S extends z.ZodType>(file: string, schema: S, fallback: z.input<S>): Promise<z.output<S>> {
    const path = join(this.dir, file);
    let text: string;
    try {
      text = await readFile(path, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      const value = schema.parse(fallback);
      await this.write(file, value);
      return value;
    }
    const result = schema.safeParse(JSON.parse(text));
    if (!result.success) {
      throw new Error(`${path} is not valid:\n${result.error.message}`);
    }
    return result.data;
  }

  /** Write to a temp file then rename, so a power cut never leaves half a file. */
  private async write(file: string, value: unknown): Promise<void> {
    const path = join(this.dir, file);
    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8');
    await rename(tmp, path);
  }
}
