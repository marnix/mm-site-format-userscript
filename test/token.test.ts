// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { extractGifText, findGifRuns, findMathSpans } from "../src/expression";
import { parseKindColors, parseKindNames } from "../src/kind";
import {
  formatTokens,
  locateGifRun,
  locateMathSpan,
  tokenizeGifRun,
  tokenizeMathSpan,
} from "../src/token";
import { gifSampler, readFixture } from "./helpers";

function parse(variant: string, name = "bitrdi.html"): Document {
  return new DOMParser().parseFromString(
    readFixture(variant, name),
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
      { kind: null, text: ")" },
      { kind: null, text: ")" },
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

describe("tokenizeGifRun with text tokens (mpegif)", () => {
  const doc = parse("mpegif", "eldisjsim2.html");
  const colors = parseKindColors(doc);
  const sample = gifSampler("mpegif");
  // The assertion: |- ( R e. Disjs -> R e. Rels )
  const assertion = findGifRuns(doc).find((run) =>
    extractGifText(run).startsWith("|- ( R e. Disjs"),
  )!;

  it("treats text class-constants as constants and R as a class variable", () => {
    expect(tokenizeGifRun(assertion, colors, sample)).toEqual([
      { kind: null, text: "|-" },
      { kind: null, text: "(" },
      { kind: "class", text: "R" },
      { kind: null, text: "e." },
      { kind: null, text: "Disjs" },
      { kind: null, text: "->" },
      { kind: "class", text: "R" },
      { kind: null, text: "e." },
      { kind: null, text: "Rels" },
      { kind: null, text: ")" },
    ]);
  });
});

describe("locateMathSpan (mpeuni)", () => {
  const doc = parse("mpeuni");
  const kinds = parseKindNames(doc);
  const assertion = findMathSpans(doc)[2];
  const located = locateMathSpan(assertion, kinds);

  it("stays aligned with tokenizeMathSpan", () => {
    expect(located.map((lt) => lt.token)).toEqual(
      tokenizeMathSpan(assertion, kinds),
    );
  });

  it("locates a variable at its span element", () => {
    const phi = located[2]; // 𝜑
    expect(phi.token).toEqual({ kind: "wff", text: "𝜑" });
    expect(phi.location.type).toBe("element");
  });

  it("locates the merged ')' ')' as two substrings of one text node", () => {
    const a = located[8];
    const b = located[9];
    expect(a.location).toMatchObject({ type: "text" });
    expect(b.location).toMatchObject({ type: "text" });
    if (a.location.type === "text" && b.location.type === "text") {
      expect(b.location.node).toBe(a.location.node); // same text node
      expect(b.location.start).toBe(a.location.end); // consecutive offsets
    }
  });
});

describe("locateGifRun (mpegif)", () => {
  const doc = parse("mpegif");
  const colors = parseKindColors(doc);
  const sample = gifSampler("mpegif");
  const run = findGifRuns(doc)[2];
  const located = locateGifRun(run, colors, sample);

  it("stays aligned with tokenizeGifRun", () => {
    expect(located.map((lt) => lt.token)).toEqual(
      tokenizeGifRun(run, colors, sample),
    );
  });

  it("locates each img token at its element", () => {
    expect(located.every((lt) => lt.location.type === "element")).toBe(true);
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
