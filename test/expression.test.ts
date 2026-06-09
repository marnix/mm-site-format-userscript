// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  extractGifText,
  extractMathText,
  findGifRuns,
  findMathSpans,
} from "../src/expression";
import { readFixture } from "./helpers";

function parse(variant: string, name = "bitrdi.html"): Document {
  return new DOMParser().parseFromString(
    readFixture(variant, name),
    "text/html",
  );
}

describe("findMathSpans + extractMathText (mpeuni)", () => {
  const doc = parse("mpeuni");

  it("extracts every span.math expression in document order", () => {
    const exprs = findMathSpans(doc).map(extractMathText);
    expect(exprs).toEqual([
      "⊢ ( 𝜑 → ( 𝜓 ↔ 𝜒 ))", // hypothesis 1
      "⊢ ( 𝜒 ↔ 𝜃 )", // hypothesis 2
      "⊢ ( 𝜑 → ( 𝜓 ↔ 𝜃 ))", // assertion
      "⊢ ( 𝜑 → ( 𝜓 ↔ 𝜒 ))", // proof step 1
      "⊢ ( 𝜒 ↔ 𝜃 )", // proof step 2
      "⊢ ( 𝜑 → ( 𝜒 ↔ 𝜃 ))", // proof step 3
      "⊢ ( 𝜑 → ( 𝜓 ↔ 𝜃 ))", // proof step 4
      "→", // syntax-hint operator
      "↔", // syntax-hint operator
    ]);
  });
});

describe("findGifRuns + extractGifText (mpegif)", () => {
  const doc = parse("mpegif");

  it("extracts every img-run expression in document order", () => {
    const exprs = findGifRuns(doc).map(extractGifText);
    expect(exprs).toEqual([
      "|- ( ph -> ( ps <-> ch ) )", // hypothesis 1
      "|- ( ch <-> th )", // hypothesis 2
      "|- ( ph -> ( ps <-> th ) )", // assertion
      "|- ( ph -> ( ps <-> ch ) )", // proof step 1
      "|- ( ch <-> th )", // proof step 2
      "|- ( ph -> ( ch <-> th ) )", // proof step 3
      "|- ( ph -> ( ps <-> th ) )", // proof step 4
    ]);
  });

  it("captures two-token expressions (e.g. 'wff ph') on a definition page", () => {
    const exprs = findGifRuns(parse("mpegif", "wi.html")).map(extractGifText);
    // These have only two img tags, so they require the ≥2 (not ≥3) threshold.
    expect(exprs).toContain("wff ph");
    expect(exprs).toContain("wff ps");
  });
});
