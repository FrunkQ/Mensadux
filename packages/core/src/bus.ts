import { EventEmitter } from 'node:events';
import type { TableEvent } from './schema.js';

type Listener = (event: TableEvent) => void;

/** One stream of events from every input. Listeners must not throw; errors are reported, not propagated. */
export class EventBus {
  private emitter = new EventEmitter();

  constructor(private onListenerError: (err: unknown, event: TableEvent) => void = () => {}) {
    this.emitter.setMaxListeners(50);
  }

  emit(event: Omit<TableEvent, 'ts'> & { ts?: number }): TableEvent {
    const full: TableEvent = { ...event, ts: event.ts ?? Date.now() };
    for (const l of this.emitter.listeners('event') as Listener[]) {
      try {
        l(full);
      } catch (err) {
        this.onListenerError(err, full);
      }
    }
    return full;
  }

  on(listener: Listener): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }
}
