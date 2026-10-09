import type { Action, Binding, TableEvent } from './schema.js';

export type ActionHandler = (params: Record<string, unknown>, event: TableEvent) => Promise<void> | void;

export interface ActionResult {
  bindingId: string;
  action: Action;
  ok: boolean;
  error?: string;
}

export function bindingMatches(binding: Binding, event: TableEvent, mode: string): boolean {
  if (!binding.enabled) return false;
  if (binding.modes.length > 0 && !binding.modes.includes(mode)) return false;
  if (binding.when.type !== event.type) return false;
  for (const [key, expected] of Object.entries(binding.when.match)) {
    if (!valuesEqual(event.data[key], expected)) return false;
  }
  return true;
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
  // Case-insensitive for strings so "f5" and "F5", or card UIDs in either case, both match.
  if (typeof actual === 'string' && typeof expected === 'string') {
    return actual.toLowerCase() === expected.toLowerCase();
  }
  return actual === expected;
}

/**
 * Turns events into actions. Knows nothing about specific inputs or outputs:
 * adapters emit events, drivers register action handlers, bindings join them.
 */
export class BindingsEngine {
  private handlers = new Map<string, ActionHandler>();
  private bindings: Binding[] = [];

  constructor(private getMode: () => string) {}

  registerAction(type: string, handler: ActionHandler): void {
    this.handlers.set(type, handler);
  }

  actionTypes(): string[] {
    return [...this.handlers.keys()].sort();
  }

  setBindings(bindings: Binding[]): void {
    this.bindings = bindings;
  }

  /** Runs every matching binding's actions in order. One failing action doesn't stop the rest. */
  async handle(event: TableEvent): Promise<ActionResult[]> {
    const mode = this.getMode();
    const results: ActionResult[] = [];
    for (const binding of this.bindings) {
      if (!bindingMatches(binding, event, mode)) continue;
      for (const action of binding.do) {
        results.push(await this.run(binding.id, action, event));
      }
    }
    return results;
  }

  /** Runs one action directly, e.g. from the UI. */
  async run(bindingId: string, action: Action, event: TableEvent): Promise<ActionResult> {
    const handler = this.handlers.get(action.type);
    if (!handler) {
      return { bindingId, action, ok: false, error: `No handler for action "${action.type}"` };
    }
    try {
      await handler(action.params, event);
      return { bindingId, action, ok: true };
    } catch (err) {
      return { bindingId, action, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
