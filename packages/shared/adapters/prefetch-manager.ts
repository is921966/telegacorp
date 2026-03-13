/**
 * Prefetch manager adapter — platform-specific implementations must be injected.
 *
 * Web: src/lib/prefetch-manager.ts (prefetches media for visible messages)
 * Mobile: simplified or no-op
 */

export interface PrefetchManagerAdapter {
  initPrefetchManager: (client: unknown) => void;
}

let _adapter: PrefetchManagerAdapter = {
  initPrefetchManager: () => {},
};

export function setPrefetchManagerAdapter(adapter: PrefetchManagerAdapter): void {
  _adapter = adapter;
}

export function initPrefetchManager(client: unknown): void {
  _adapter.initPrefetchManager(client);
}
