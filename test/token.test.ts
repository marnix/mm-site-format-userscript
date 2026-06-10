// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { findGifRuns, findMathSpans } from "../src/expression";
import { parseKindColors, parseKindNames } from "../src/kind";
import { formatTokens, tokenizeGifRun, tokenizeMathSpan } from "../src/token";
import { gifSampler, readFixture } from "./helpers";

function parse(variant: string): Document {
  return new DOMParser().parseFromString(
    readFixture(variant, "bitrdi.html"),
    "text/html",
  );
}

describe("tokenizeMathSpan (mpeuni)", () => {
  const doc = parse("mpeuni");
  const kinds = parseKindNames(doc);
  const assertion = findMathSpans(doc)[2]; // hyp1, hyp2, assertion

  it("tags variables with their kind and leaves constants untyped", () => {
    expect(tokenizeMathSpan(assertion, kinds)).toEqual([
      { kind: null, text: "⊢" },
      { kind: null, text: "(" },
      { kind: "wff", text: "𝜑" },
      { kind: null, text: "→" },
      { kind: null, text: "(" },
      { kind: "wff", text: "𝜓" },
      { kind: null, text: "↔" },
      { kind: "wff", text: "𝜃" },
      { kind: null, text: "))" },
    ]);
  });
});

describe("tokenizeGifRun (mpegif)", () => {
  const doc = parse("mpegif");
  const colors = parseKindColors(doc);
  const sample = gifSampler("mpegif");
  const assertion = findGifRuns(doc)[2];

  it("tags variables by colour and leaves constants untyped", () => {
    expect(tokenizeGifRun(assertion, colors, sample)).toEqual([
      { kind: null, text: "|-" },
      { kind: null, text: "(" },
      { kind: "wff", text: "ph" },
      { kind: null, text: "->" },
      { kind: null, text: "(" },
      { kind: "wff", text: "ps" },
      { kind: null, text: "<->" },
      { kind: "wff", text: "th" },
      { kind: null, text: ")" },
      { kind: null, text: ")" },
    ]);
  });
});

describe("formatTokens", () => {
  it("annotates typed variables as text:kind", () => {
    expect(
      formatTokens([
        { kind: null, text: "(" },
        { kind: "wff", text: "ph" },
        { kind: null, text: ")" },
      ]),
    ).toBe("( ph:wff )");
  });
});
