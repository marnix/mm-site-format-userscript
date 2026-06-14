// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createCache } from "../src/cache";
import { assembleGifGrammar } from "../src/grammar";
import { GIF_TOP_RULE } from "../src/database-assumptions";
import { parseExpression, type KindOf } from "../src/parse";
import { evaluate } from "../src/proof";
import { readFixture } from "./helpers";

const PAGE_URL = "https://us.metamath.org/mpegif/bitrdi.html";

const doc = new DOMParser().parseFromString(
  readFixture("mpegif", "bitrdi.html"),
  "text/html",
);

// Fetcher backed by the fixtures: resolves a URL to its mpegif fixture file.
const fetcher = vi.fn(async (url: string) =>
  readFixture("mpegif", url.split("/").pop()!),
);

describe("assembleGifGrammar", () => {
  it("collects the $TOP rule plus a rule per syntax-hint page (wi, wb)", async () => {
    const rules = await assembleGifGrammar(doc, PAGE_URL, fetcher);

    expect(rules[0]).toEqual(GIF_TOP_RULE);
    const conclusions = rules.map((r) => r.conclusion.join(" "));
    expect(conclusions).toContain("wff ( ph -> ps )"); // wi
    expect(conclusions).toContain("wff ( ph <-> ps )"); // wb
    expect(conclusions).toContain("class x"); // cv, always read
    // $TOP + the page's hints (wi, wb) + cv. wcel/wceq are also always
    // requested but have no fixture here, so they are skipped.
    expect(
      rules
        .map((r) => r.label)
        .filter(Boolean)
        .sort(),
    ).toEqual(["cv", "wb", "wi"]);
  });

  it("also loads syntax-hint pages reached via the Ref column", async () => {
    // A page with no syntax hints of its own, whose proof cites `thm`; `thm`'s
    // syntax hints reach `deepop`, which is therefore only reachable via the Ref
    // page.
    const main = new DOMParser().parseFromString(
      `<table summary="Proof of theorem">
         <tr><th>Step</th><th>Hyp</th><th>Ref</th><th>Expression</th></tr>
         <tr><td>1</td><td>&nbsp;</td><td><a href="thm.html">thm</a></td><td></td></tr>
       </table>`,
      "text/html",
    );
    const pages: Record<string, string> = {
      "thm.html": `<table><tr><td><b>Syntax hints:</b>
                     <a href="deepop.html">deepop</a></td></tr></table>`,
      "deepop.html": "<html></html>", // no Assertion table; just needs fetching
      "cv.html": "<html></html>",
    };
    const seen: string[] = [];
    const trackingFetcher = async (url: string) => {
      const name = url.split("/").pop()!;
      seen.push(name);
      if (name in pages) return pages[name];
      throw new Error(`no fixture for ${name}`);
    };

    await assembleGifGrammar(main, PAGE_URL, trackingFetcher);

    expect(seen).toContain("thm.html"); // the Ref-linked page
    expect(seen).toContain("deepop.html"); // reachable only via thm's syntax hints
  });

  it("always loads the primitive syntax pages (cv, wcel, wceq), even unhinted", async () => {
    const main = new DOMParser().parseFromString(
      `<table summary="Proof of theorem">
         <tr><th>Step</th><th>Hyp</th><th>Ref</th><th>Expression</th></tr>
       </table>`, // no syntax hints, no Ref links
      "text/html",
    );
    const seen: string[] = [];
    const fetcher = async (url: string) => {
      seen.push(url.split("/").pop()!);
      return "<html></html>";
    };

    await assembleGifGrammar(main, PAGE_URL, fetcher);

    expect(seen).toContain("cv.html");
    expect(seen).toContain("wcel.html");
    expect(seen).toContain("wceq.html");
  });

  it("a second assembly sharing a cache (store) skips every fetch", async () => {
    const map = new Map<string, string>();
    const store = {
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
    const counting = vi.fn(async (url: string) => {
      const name = url.split("/").pop()!;
      // wcel/wceq are always requested but have no fixture here; stub them so
      // the fetch succeeds and caches (in reality those pages exist).
      try {
        return readFixture("mpegif", name);
      } catch {
        return "<html></html>";
      }
    });

    const first = await assembleGifGrammar(
      doc,
      PAGE_URL,
      counting,
      createCache(store, "1"),
    );
    expect(counting.mock.calls.length).toBeGreaterThan(0);
    const afterFirst = counting.mock.calls.length;

    // A fresh cache instance over the same store (a new page load) reuses the
    // stored extraction results, so no page is fetched/parsed again.
    const second = await assembleGifGrammar(
      doc,
      PAGE_URL,
      counting,
      createCache(store, "1"),
    );
    expect(counting.mock.calls.length).toBe(afterFirst); // no new fetches
    expect(second).toEqual(first);
  });

  it("the assembled grammar parses the bitrdi assertion end to end", async () => {
    const rules = await assembleGifGrammar(doc, PAGE_URL, fetcher);
    const wff = new Set(["ph", "ps", "ch", "th", "chi"]);
    const kindOf: KindOf = (t) => (wff.has(t) ? "wff" : undefined);

    const tokens = ["|-", "(", "ph", "->", "(", "ps", "<->", "th", ")", ")"];
    const proof = parseExpression(tokens, "$TOP", rules, kindOf);
    expect(proof).not.toBeNull();
    expect(evaluate(proof!).conclusion).toEqual([
      "$TOP", "|-", "(", "ph", "->", "(", "ps", "<->", "th", ")", ")",
    ]); // prettier-ignore
    expect(evaluate(proof!).assumptions).toEqual([]);
  });
});
