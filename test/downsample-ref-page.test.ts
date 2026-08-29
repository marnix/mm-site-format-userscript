// @vitest-environment happy-dom
//
// Spec for the test-only `downsampleFetchedPageHtml` helper (test/helpers.ts):
// fetched theorem reference pages can be ~1.5 MB -- nearly all of it a trailing
// "This theorem is referenced by" list and per-theorem navigation -- while the
// grammar assembly only reads the statement tables and the "Syntax hints:" row
// near the top.  The helper must therefore cut the tail (cutting the nmulprop
// test's DOM-parsing time from ~19s to ~1s) while leaving every extraction
// target byte-for-byte intact, so the grammar -- and with it every assertion's
// parse -- is unchanged.
import { describe, expect, it } from "vitest";
import { extractRefUrls, extractSyntaxHintUrls } from "../src/loader";
import { downsampleFetchedPageHtml, readFixture } from "./helpers";

const PAGE_URL = "https://us.metamath.org/mpeuni/syl.html";

describe("downsampleFetchedPageHtml", () => {
  it("cuts the trailing referenced-by/navigation tail of a large ref page", () => {
    const full = readFixture("mpeuni", "syl.html");
    expect(full.length).toBeGreaterThan(1_000_000);
    const cut = downsampleFetchedPageHtml(full);
    expect(cut).not.toContain("This theorem is referenced by");
    expect(cut.length).toBeLessThan(100_000);
  });

  it("keeps the statement tables and the syntax-hints row", () => {
    const cut = downsampleFetchedPageHtml(readFixture("mpeuni", "syl.html"));
    expect(cut).toContain('SUMMARY="Hypotheses"');
    expect(cut).toContain('SUMMARY="Assertion"');
    expect(cut).toContain('SUMMARY="Proof of theorem"');
    expect(cut).toContain("<B>Syntax hints:</B>");
  });

  it("extracts the same hint and ref URLs from full and downsized HTML", () => {
    // The full 1.5 MB page takes a few seconds to parse through happy-dom.
    const fullHtml = readFixture("mpeuni", "syl.html");
    const cutHtml = downsampleFetchedPageHtml(fullHtml);
    const full = new DOMParser().parseFromString(fullHtml, "text/html");
    const cut = new DOMParser().parseFromString(cutHtml, "text/html");
    for (const extractor of [extractSyntaxHintUrls, extractRefUrls]) {
      expect(extractor(cut, PAGE_URL)).toEqual(extractor(full, PAGE_URL));
    }
  }, 60_000);

  it("leaves a page without a syntax-hints row untouched ($a |- axioms)", () => {
    const html = readFixture("mpeuni", "wcel.html");
    expect(downsampleFetchedPageHtml(html)).toBe(html);
  });
});
