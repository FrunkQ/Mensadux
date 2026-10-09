import { connectState } from './api';
import type { TableSnapshot } from './types';

/** Shared live table state, updated from the server websocket. */
export const live = $state<{ connected: boolean; state: TableSnapshot | null }>({ connected: false, state: null });

connectState(
  (s) => (live.state = s),
  (c) => (live.connected = c),
);
