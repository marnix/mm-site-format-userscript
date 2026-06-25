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
import { findTokenAt } from "../src/highlight";
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
      { kind: null, text: "\u22a2" },
      { kind: null, text: "(" },
      { kind: "wff", text: "\u{1d711}" },
      { kind: null, text: "\u2192" },
      { kind: null, text: "(" },
      { kind: "wff", text: "\u{1d713}" },
      { kind: null, text: "\u2194" },
      { kind: "wff", text: "\u{1d703}" },
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
    const phi = located[2]; // U+1D711
    expect(phi.token).toEqual({ kind: "wff", text: "\u{1d711}" });
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

describe("tokenizeMathSpan ({ and } split as individual tokens on grammar pages)", () => {
  it("splits { adjacent to non-paren char into separate tokens (no vocab)", () => {
    // Mimics copab assertion: {\u27e8 appears as raw text before the first variable
    // span. splitConstants must not collapse {\u27e8 into one token, or the parser
    // can never match csn(cop(...)) because {\u27e8 would land in the vocab and the
    // proof table would tokenize it as one opaque literal.
    const span = document.createElement("span");
    span.innerHTML = '{\u27e8<span class="setvar">x</span>\u27e9}';
    const kinds = new Set(["setvar"]);
    expect(tokenizeMathSpan(span, kinds)).toEqual([
      { kind: null, text: "{" },
      { kind: null, text: "\u27e8" }, // \u27e8
      { kind: "setvar", text: "x" },
      { kind: null, text: "\u27e9" }, // \u27e9
      { kind: null, text: "}" },
    ]);
  });
});

describe("tokenizeMathSpan (dense Unicode: subscripts and concatenated constants)", () => {
  const kinds = new Set(["setvar"]);

  it("splits run-together constants by vocabulary and folds subscripts", () => {
    // Mimics 00sr step 3: [\u27e8x, y\u27e9] ~R 0R, where the brackets are concatenated
    // with no delimiter and ~R / 0R render with the R in a <sub> element.
    const span = document.createElement("span");
    span.innerHTML =
      '([\u27e8<span class="setvar">x</span>, <span class="setvar">y</span>\u27e9] ~<i><sub><b>R</b></sub></i> 0<i><sub><b>R</b></sub></i>)';
    const vocab = new Set([
      "(",
      "[",
      "\u27e8",
      "\u27e9",
      "]",
      "~R",
      "0R",
      ",",
      ")",
    ]);

    expect(tokenizeMathSpan(span, kinds, vocab)).toEqual([
      { kind: null, text: "(" },
      { kind: null, text: "[" },
      { kind: null, text: "\u27e8" },
      { kind: "setvar", text: "x" },
      { kind: null, text: "," },
      { kind: "setvar", text: "y" },
      { kind: null, text: "\u27e9" },
      { kind: null, text: "]" },
      { kind: null, text: "~R" },
      { kind: null, text: "0R" },
      { kind: null, text: ")" },
    ]);
  });

  it("folds a subscript without a vocabulary too (syntax-definition pages)", () => {
    const span = document.createElement("span");
    span.innerHTML = "~<i><sub><b>R</b></sub></i>";
    expect(tokenizeMathSpan(span, kinds)).toEqual([{ kind: null, text: "~R" }]);
  });

  it("locates a folded token over the base char and the subscript element", () => {
    const span = document.createElement("span");
    span.innerHTML = "~<i><sub><b>R</b></sub></i>";
    const [located] = locateMathSpan(span, kinds);
    expect(located.token).toEqual({ kind: null, text: "~R" });
    // The location spans the "~" base char and the subscript element, so the
    // whole `~R` glyph highlights (not just the "~").
    expect(located.location.type).toBe("folded");
    if (located.location.type === "folded") {
      expect(located.location.node.nodeValue).toBe("~");
      expect(located.location.sub.textContent).toBe("R");
    }
  });

  it("hovering a folded token's subscript hits the token", () => {
    const span = document.createElement("span");
    span.innerHTML = "~<i><sub><b>R</b></sub></i>";
    const locations = locateMathSpan(span, kinds).map((lt) => lt.location);
    const rText = span.querySelector("b")!.firstChild!; // the "R" text node
    expect(findTokenAt(locations, rText, 0)).toBe(0);
  });

  it("folds a surrogate-pair subscript (e.g. \u2191\u{1d45f}) without running off the run", () => {
    // relexpaddg renders relation exponentiation as `\u2191` with `\u{1d45f}` (U+1D45F, a
    // surrogate pair) in a <sub>. Folding it must stay aligned with the run's
    // UTF-16 offsets, or the vocabulary munch indexes past the end and throws.
    const span = document.createElement("span");
    span.innerHTML =
      '(<span class="class">\u{1d445}</span>\u2191<sub>\u{1d45f}</sub><span class="class">\u{1d441}</span>)';
    const vocab = new Set(["(", ")", "\u2191\u{1d45f}"]);
    expect(tokenizeMathSpan(span, new Set(["class"]), vocab)).toEqual([
      { kind: null, text: "(" },
      { kind: "class", text: "\u{1d445}" },
      { kind: null, text: "\u2191\u{1d45f}" },
      { kind: "class", text: "\u{1d441}" },
      { kind: null, text: ")" },
    ]);
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
