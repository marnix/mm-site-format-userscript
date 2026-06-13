import { describe, expect, it } from "vitest";
import { createCache } from "../src/cache";

function memStore() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

describe("createCache", () => {
  it("computes once and memoises within a session", async () => {
    let calls = 0;
    const cache = createCache(memStore(), "1");
    const compute = async () => {
      calls++;
      return { v: 42 };
    };
    expect(await cache.get("k", compute)).toEqual({ v: 42 });
    expect(await cache.get("k", compute)).toEqual({ v: 42 });
    expect(calls).toBe(1);
  });

  it("reuses a stored result in a fresh session without recomputing", async () => {
    const store = memStore();
    let calls = 0;
    const compute = async () => {
      calls++;
      return [1, 2, 3];
    };
    await createCache(store, "1").get("k", compute);
    const again = await createCache(store, "1").get("k", compute); // fresh memo
    expect(again).toEqual([1, 2, 3]);
    expect(calls).toBe(1);
  });

  it("misses when the version differs", async () => {
    const store = memStore();
    let calls = 0;
    const compute = async () => {
      calls++;
      return "x";
    };
    await createCache(store, "1").get("k", compute);
    await createCache(store, "2").get("k", compute);
    expect(calls).toBe(2);
  });

  it("does not store a failed computation", async () => {
    const store = memStore();
    const cache = createCache(store, "1");
    await expect(
      cache.get("k", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(store.map.size).toBe(0);
  });

  it("works without a store (memoises only)", async () => {
    let calls = 0;
    const cache = createCache(null, "1");
    const compute = async () => {
      calls++;
      return 1;
    };
    await cache.get("k", compute);
    await cache.get("k", compute);
    expect(calls).toBe(1);
  });
});
