// Caches the result of *processing* a page (extracted grammar rules, linked-page
// URLs), keyed by URL, so each linked page is processed once: in memory within a
// load (also shared with the calculation's second pass) and in a key-value store
// (sessionStorage) across page loads. The browser already caches the fetches
// themselves; this caches the DOM-parse + extraction on top. Results must be
// JSON-serialisable; `version` namespaces entries so a format change drops them.

/**
 * When true, the cache bypasses all storage (both in-memory memo and
 * sessionStorage): every `get()` recomputes from scratch and nothing is
 * persisted. Flip to `true` during development to always observe cold-cache
 * behaviour without manually clearing sessionStorage.
 */
export const BYPASS_CACHE = false;

/** The subset of Storage (e.g. sessionStorage) the cache uses. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Cache {
  /** The cached value for `key`, or `compute()`'d, stored, and returned. A
   *  rejected computation is neither stored nor memoised-as-resolved. */
  get<T>(key: string, compute: () => Promise<T>): Promise<T>;
}

export function createCache(
  store: KeyValueStore | null,
  version: string,
): Cache {
  if (BYPASS_CACHE) {
    // No memoisation, no storage: every get() recomputes fresh.
    return { get: <T>(_key: string, compute: () => Promise<T>) => compute() };
  }

  const memo = new Map<string, Promise<unknown>>();
  const fullKey = (key: string) => `mmsf:${version}:${key}`;

  return {
    get<T>(key: string, compute: () => Promise<T>): Promise<T> {
      const k = fullKey(key);
      const memoised = memo.get(k);
      if (memoised) return memoised as Promise<T>;

      let stored: string | null = null;
      try {
        stored = store?.getItem(k) ?? null;
      } catch {
        stored = null; // store unavailable
      }
      if (stored !== null) {
        try {
          const resolved = Promise.resolve(JSON.parse(stored) as T);
          memo.set(k, resolved);
          return resolved;
        } catch {
          // corrupt entry: fall through and recompute
        }
      }

      const result = compute().then((value) => {
        try {
          store?.setItem(k, JSON.stringify(value));
        } catch {
          // storage unavailable / over quota: keep the in-memory result
        }
        return value;
      });
      memo.set(k, result); // rejections stay memoised but are never stored
      return result;
    },
  };
}
