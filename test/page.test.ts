// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { parseGifExpressions } from "../src/page";
import { evaluate } from "../src/proof";
import { gifSampler, readFixture } from "./helpers";

const PAGE_URL = "https://us.metamath.org/mpegif/bitrdi.html";

describe("parseGifExpressions (mpegif/bitrdi)", () => {
  const doc = new DOMParser().parseFromString(
    readFixture("mpegif", "bitrdi.html"),
    "text/html",
  );
  const fetcher = vi.fn(async (url: string) =>
    readFixture("mpegif", url.split("/").pop()!),
  );

  it("parses every expression on the page (all are |- statements)", async () => {
    const results = await parseGifExpressions(
      doc,
      PAGE_URL,
      fetcher,
      gifSampler("mpegif"),
    );

    expect(results).toHaveLength(7); // 2 hypotheses + assertion + 4 proof steps
    expect(results.every((r) => r.proof !== null)).toBe(true);

    // The assertion is the third expression; its proof is a closed proof of it.
    const assertion = results[2];
    expect(assertion.tokens.map((t) => t.text).join(" ")).toBe(
      "|- ( ph -> ( ps <-> th ) )",
    );
    const established = evaluate(assertion.proof!);
    expect(established.assumptions).toEqual([]);
    expect(established.conclusion).toEqual([
      "$TOP", "|-", "(", "ph", "->", "(", "ps", "<->", "th", ")", ")",
    ]); // prettier-ignore
  });
});
