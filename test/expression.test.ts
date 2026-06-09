// @vitest-environment happy-dom
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { extractGifExpressions, extractMathText } from "../src/expression";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFixture(variant: string, name: string): string {
  return readFileSync(join(__dirname, "fixtures", variant, name), "utf-8");
}

describe("extractMathText (mpeuni)", () => {
  const doc = new DOMParser().parseFromString(
    readFixture("mpeuni", "bitrdi.html"),
    "text/html",
  );

  const hypSpans = [
    ...doc.querySelectorAll('table[summary="Hypotheses"] span.math'),
  ];
  const assertionSpan = doc.querySelector(
    'table[summary="Assertion"] span.math',
  )!;

  it("extracts hypothesis 1", () => {
    expect(extractMathText(hypSpans[0])).toBe("⊢ ( 𝜑 → ( 𝜓 ↔ 𝜒 ))");
  });

  it("extracts hypothesis 2", () => {
    expect(extractMathText(hypSpans[1])).toBe("⊢ ( 𝜒 ↔ 𝜃 )");
  });

  it("extracts the assertion", () => {
    expect(extractMathText(assertionSpan)).toBe("⊢ ( 𝜑 → ( 𝜓 ↔ 𝜃 ))");
  });
});

describe("extractGifExpressions (mpegif)", () => {
  const doc = new DOMParser().parseFromString(
    readFixture("mpegif", "bitrdi.html"),
    "text/html",
  );
  const exprs = extractGifExpressions(doc);

  it("includes hypothesis 1", () => {
    expect(exprs).toContain("|- ( ph -> ( ps <-> ch ) )");
  });

  it("includes hypothesis 2", () => {
    expect(exprs).toContain("|- ( ch <-> th )");
  });

  it("includes the assertion", () => {
    expect(exprs).toContain("|- ( ph -> ( ps <-> th ) )");
  });
});
