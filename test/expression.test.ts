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
      "\u22a2 ( \u{1d711} \u2192 ( \u{1d713} \u2194 \u{1d712} ))", // hypothesis 1
      "\u22a2 ( \u{1d712} \u2194 \u{1d703} )", // hypothesis 2
      "\u22a2 ( \u{1d711} \u2192 ( \u{1d713} \u2194 \u{1d703} ))", // assertion
      "\u22a2 ( \u{1d711} \u2192 ( \u{1d713} \u2194 \u{1d712} ))", // proof step 1
      "\u22a2 ( \u{1d712} \u2194 \u{1d703} )", // proof step 2
      "\u22a2 ( \u{1d711} \u2192 ( \u{1d712} \u2194 \u{1d703} ))", // proof step 3
      "\u22a2 ( \u{1d711} \u2192 ( \u{1d713} \u2194 \u{1d703} ))", // proof step 4
      "\u2192", // syntax-hint operator
      "\u2194", // syntax-hint operator
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
    // These have only two img tags, so they require the >=2 (not >=3) threshold.
    expect(exprs).toContain("wff ph");
    expect(exprs).toContain("wff ps");
  });

  it("includes plain-text tokens interleaved with images", () => {
    // Disjs and Rels are text, not images, on this page.
    const exprs = findGifRuns(parse("mpegif", "eldisjsim2.html")).map(
      extractGifText,
    );
    expect(exprs).toContain("|- ( R e. Disjs -> R e. Rels )");
  });

  it("captures a one-image expression with a text constant (class Rels)", () => {
    // "class Rels" is one image (the typecode) plus a text token.
    const exprs = findGifRuns(parse("mpegif", "crels.html")).map(
      extractGifText,
    );
    expect(exprs).toContain("class Rels");
  });

  it("does not flush a run on an imageless inline element mid-run (e.g. <small>DECID</small> in ilegif)", () => {
    // ilegif pages render the decidability predicate DECID as <small>DECID</small>
    // inline within an expression row, splitting the img run.  The full expression
    // should still be returned as one run.
    const td = document.createElement("td");
    td.innerHTML =
      '<img alt=" |-">' +
      '<img alt=" (">' +
      '<img alt=" z">' +
      '<img alt=" e.">' +
      '<img alt=" ZZ">' +
      '<img alt=" ->">' +
      "<small>DECID</small>" +
      '<img alt=" z">' +
      '<img alt=" =">' +
      '<img alt=" 1">' +
      '<img alt=" )">';
    const runs = findGifRuns(td);
    expect(runs).toHaveLength(1);
    expect(extractGifText(runs[0])).toBe("|- ( z e. ZZ -> DECID z = 1 )");
  });
});
