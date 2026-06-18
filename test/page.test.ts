// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  parseGifExpressions,
  parseUniExpressions,
  type ParsedExpression,
} from "../src/page";
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

describe("parseGifExpressions (mpegif/disjrel)", () => {
  const doc = new DOMParser().parseFromString(
    readFixture("mpegif", "disjrel.html"),
    "text/html",
  );
  const fetcher = vi.fn(async (url: string) =>
    readFixture("mpegif", url.split("/").pop()!),
  );

  const find = (results: ParsedExpression[], prefix: string) =>
    results.find((r) =>
      r.tokens
        .map((t) => t.text)
        .join(" ")
        .startsWith(prefix),
    );

  it("parses ( Disj R -> Rel R ) -- single-hypothesis rules (Rel, Disj)", async () => {
    const results = await parseGifExpressions(
      doc,
      "https://us.metamath.org/mpegif/disjrel.html",
      fetcher,
      gifSampler("mpegif"),
    );

    const stmt = find(results, "|- ( Disj R -> Rel R )");
    expect(stmt?.proof).not.toBeNull();
    expect(evaluate(stmt!.proof!).conclusion).toEqual([
      "$TOP", "|-", "(", "Disj", "R", "->", "Rel", "R", ")",
    ]); // prettier-ignore

    // The "<->" definitional cross-reference uses constructors (wb, cin) that
    // are not among this theorem's syntax hints, so it is out of grammar.
    const def = find(results, "|- ( Disj R <->");
    expect(def?.proof).toBeNull();
  });
});

describe("parseGifExpressions (ilegif/speano5)", () => {
  const doc = new DOMParser().parseFromString(
    readFixture("ilegif", "speano5.html"),
    "text/html",
  );
  const fetcher = vi.fn(async (url: string) =>
    readFixture("ilegif", url.split("/").pop()!),
  );

  it("parses a statement with a class variable V (old <FONT> legend)", async () => {
    const results = await parseGifExpressions(
      doc,
      "https://us.metamath.org/ilegif/speano5.html",
      fetcher,
      gifSampler("ilegif"),
    );
    const stmt = results.find((r) =>
      r.tokens
        .map((t) => t.text)
        .join(" ")
        .startsWith("|- ( ( A e. V"),
    );
    expect(stmt?.proof).not.toBeNull();
  });
});

describe("parseUniExpressions (mpeuni/bitrdi)", () => {
  const doc = new DOMParser().parseFromString(
    readFixture("mpeuni", "bitrdi.html"),
    "text/html",
  );
  const fetcher = vi.fn(async (url: string) =>
    readFixture("mpeuni", url.split("/").pop()!),
  );

  it("parses the real expressions (the 2 syntax-hint operators do not)", async () => {
    const results = await parseUniExpressions(
      doc,
      "https://us.metamath.org/mpeuni/bitrdi.html",
      fetcher,
    );

    // 9 span.math: 7 real expressions + the "->"/"<->" syntax-hint operator spans.
    expect(results.filter((r) => r.proof !== null)).toHaveLength(7);

    const assertion = results[2];
    expect(assertion.tokens.map((t) => t.text).join(" ")).toBe(
      "\u22a2 ( \u{1d711} \u2192 ( \u{1d713} \u2194 \u{1d703} ) )",
    );
    expect(evaluate(assertion.proof!).conclusion).toEqual([
      "$TOP", "\u22a2", "(", "\u{1d711}", "\u2192", "(", "\u{1d713}", "\u2194", "\u{1d703}", ")", ")",
    ]); // prettier-ignore
  });
});
