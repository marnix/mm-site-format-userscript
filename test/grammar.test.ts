// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createCache } from "../src/cache";
import {
  assembleGifGrammar,
  assembleUniGrammar,
  GRAMMAR_CACHE_VERSION,
} from "../src/grammar";
import { GIF_TOP_RULE } from "../src/database-assumptions";
import { parseExpression, type KindOf } from "../src/parse";
import { evaluate } from "../src/proof";
import { readFixture } from "./helpers";

// GRAMMAR_CACHE_VERSION must be bumped whenever the grammar extraction logic
// changes (e.g. splitConstants regex, sort order) so stale sessionStorage
// caches from older builds do not cause parse failures in the browser.
it("GRAMMAR_CACHE_VERSION is at least 3 (bumped after splitConstants fix)", () => {
  expect(Number(GRAMMAR_CACHE_VERSION)).toBeGreaterThanOrEqual(3);
});

const PAGE_URL = "https://us.metamath.org/mpegif/bitrdi.html";

const doc = new DOMParser().parseFromString(
  readFixture("mpegif", "bitrdi.html"),
  "text/html",
);

// Fetcher backed by the fixtures: resolves a URL to its mpegif fixture file.
const fetcher = vi.fn(async (url: string) =>
  readFixture("mpegif", url.split("/").pop()!),
);

describe("assembleUniGrammar: rule ordering (longer patterns first)", () => {
  // cuni (union A, len 3) and ciun (union x in A B, len 6) share the "union" prefix.
  // nmulprop's syntax hints list cuni before ciun, so without a sort they appear
  // in that order.  The packrat parser takes the first matching rule; with cuni
  // first it greedily picks cuni(cv(x)) and leaves the rest of the indexed-union
  // expression unconsumed.  assembleUniGrammar must sort rules by conclusion
  // length (desc) so ciun (more specific) is tried before cuni.
  const PAGE_URL = "https://us.metamath.org/mpeuni/ciun-ordering-test.html";

  // Minimal page declaring cuni before ciun as syntax hints.
  const pageHtml = `<html><body>
    <table><tr><td><b>Syntax hints:</b>
      <a href="cuni.html">cuni</a>
      <a href="ciun.html">ciun</a>
    </td></tr></table>
  </body></html>`;

  const fetcher = async (url: string): Promise<string> => {
    const name = url.split("/").pop()!;
    try {
      return readFixture("mpeuni", name);
    } catch {
      return "<html></html>"; // primitives with no fixture -> skipped
    }
  };

  it("places ciun (len 6) before cuni (len 3) even when cuni is listed first in syntax hints", async () => {
    const doc = new DOMParser().parseFromString(pageHtml, "text/html");
    const rules = await assembleUniGrammar(doc, PAGE_URL, fetcher);
    const ciunIdx = rules.findIndex((r) => r.label === "ciun");
    const cuniIdx = rules.findIndex((r) => r.label === "cuni");
    expect(ciunIdx).toBeGreaterThanOrEqual(0); // ciun must be present
    expect(cuniIdx).toBeGreaterThanOrEqual(0); // cuni must be present
    expect(ciunIdx).toBeLessThan(cuniIdx); // ciun before cuni
  });
});

describe("assembleGifGrammar", () => {
  it("collects the $TOP rule plus a rule per syntax-hint page (wi, wb)", async () => {
    const rules = await assembleGifGrammar(doc, PAGE_URL, fetcher);

    expect(rules[0]).toEqual(GIF_TOP_RULE);
    const conclusions = rules.map((r) => r.conclusion.join(" "));
    expect(conclusions).toContain("wff ( ph -> ps )"); // wi
    expect(conclusions).toContain("wff ( ph <-> ps )"); // wb
    expect(conclusions).toContain("class x"); // cv, always read
    // $TOP + the page's hints (wi, wb) + cv. wcel/wceq/weq/wel are also always
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

  it("falls back to the breakdown table for $a definition Ref pages that have no syntax hints", async () => {
    // A page whose proof cites df-thing ($a |- definition, no syntax hints);
    // df-thing's breakdown table links to wo, so wo must be loaded.
    const main = new DOMParser().parseFromString(
      `<table summary="Proof of theorem">
         <tr><th>Step</th><th>Hyp</th><th>Ref</th><th>Expression</th></tr>
         <tr><td>1</td><td>&nbsp;</td><td><a href="df-thing.html">df-thing</a></td><td></td></tr>
       </table>`,
      "text/html",
    );
    const pages: Record<string, string> = {
      "df-thing.html": `<table summary="Detailed syntax breakdown of definition">
                          <tr><th>Step</th><th>Hyp</th><th>Ref</th><th>Expression</th></tr>
                          <tr><td>1</td><td>&nbsp;</td><td><a href="wo.html">wo</a></td><td></td></tr>
                        </table>`,
      "wo.html": "<html></html>",
      "cv.html": "<html></html>",
      "wcel.html": "<html></html>",
      "wceq.html": "<html></html>",
      "weq.html": "<html></html>",
      "wel.html": "<html></html>",
    };
    const seen: string[] = [];
    const trackingFetcher = async (url: string) => {
      const name = url.split("/").pop()!;
      seen.push(name);
      if (name in pages) return pages[name];
      throw new Error(`no fixture for ${name}`);
    };

    await assembleGifGrammar(main, PAGE_URL, trackingFetcher);

    expect(seen).toContain("df-thing.html");
    expect(seen).toContain("wo.html"); // reachable only via df-thing's breakdown table
  });

  it("breakdown fallback produces usable grammar rules from the $a definition's constructors", async () => {
    // Simulates nmulprop: main page has no syntax hints, proof cites df-nmul
    // (a $a |- definition) whose breakdown table links to wo.  The assembled
    // grammar must include wo's rule so expressions using \/ can be parsed.
    //
    // wo assertion: wff ( ph \/ ps )  with wff ph, wff ps hypotheses.
    // findGifRuns needs >= 1 img and >= 2 tokens; each row uses one img (the
    // type code) plus a text node (the rest) so both conditions are met.
    const woHtml = `<table summary="Hypotheses">
                      <tr><td><img alt=" wff"> ph</td></tr>
                      <tr><td><img alt=" wff"> ps</td></tr>
                    </table>
                    <table summary="Assertion">
                      <tr><td><img alt=" wff"> ( ph \\/ ps )</td></tr>
                    </table>`;
    const main = new DOMParser().parseFromString(
      `<table summary="Proof of theorem">
         <tr><th>Step</th><th>Hyp</th><th>Ref</th><th>Expression</th></tr>
         <tr><td>1</td><td>&nbsp;</td><td><a href="df-nmul.html">df-nmul</a></td><td></td></tr>
       </table>`,
      "text/html",
    );
    const pages: Record<string, string> = {
      "df-nmul.html": `<table summary="Detailed syntax breakdown of definition">
                         <tr><th>Step</th><th>Hyp</th><th>Ref</th><th>Expression</th></tr>
                         <tr><td>1</td><td>&nbsp;</td><td><a href="wo.html">wo</a></td><td></td></tr>
                       </table>`,
      "wo.html": woHtml,
      "cv.html": "<html></html>",
      "wcel.html": "<html></html>",
      "wceq.html": "<html></html>",
      "weq.html": "<html></html>",
      "wel.html": "<html></html>",
    };
    const fetcher = async (url: string) => {
      const name = url.split("/").pop()!;
      if (name in pages) return pages[name];
      throw new Error(`no fixture for ${name}`);
    };

    const rules = await assembleGifGrammar(main, PAGE_URL, fetcher);

    const conclusions = rules.map((r) => r.conclusion.join(" "));
    expect(conclusions).toContain("wff ( ph \\/ ps )"); // wo rule present
    expect(rules.map((r) => r.label).filter(Boolean)).toContain("wo");
  });

  it("always loads the primitive syntax pages (cv, wcel, wceq, weq, wel), even unhinted", async () => {
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
    expect(seen).toContain("weq.html");
    expect(seen).toContain("wel.html");
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
