// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { assembleGifGrammar, TOP_RULE } from "../src/grammar";
import { parseExpression, type KindOf } from "../src/parse";
import { evaluate } from "../src/proof";
import { gifSampler, readFixture } from "./helpers";

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
    const rules = await assembleGifGrammar(
      doc,
      PAGE_URL,
      fetcher,
      gifSampler("mpegif"),
    );

    expect(rules[0]).toEqual(TOP_RULE);
    const conclusions = rules.map((r) => r.conclusion.join(" "));
    expect(conclusions).toContain("wff ( ph -> ps )"); // wi
    expect(conclusions).toContain("wff ( ph <-> ps )"); // wb
    expect(rules).toHaveLength(3);
  });

  it("the assembled grammar parses the bitrdi assertion end to end", async () => {
    const rules = await assembleGifGrammar(
      doc,
      PAGE_URL,
      fetcher,
      gifSampler("mpegif"),
    );
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
