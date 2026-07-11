import { describe, expect, it } from "vitest";
import { parseExpression, type KindOf } from "../src/parse";
import type { InferenceRule } from "../src/proof";
import { gapUnits, nodeSpans, smallestSpanContaining } from "../src/spans";

const wi: InferenceRule = {
  assumptions: [
    ["wff", "ph"],
    ["wff", "ps"],
  ],
  conclusion: ["wff", "(", "ph", "->", "ps", ")"],
};
const wb: InferenceRule = {
  assumptions: [
    ["wff", "ph"],
    ["wff", "ps"],
  ],
  conclusion: ["wff", "(", "ph", "<->", "ps", ")"],
};
const top: InferenceRule = {
  assumptions: [["wff", "chi"]],
  conclusion: ["$TOP", "|-", "chi"],
};
const rules = [top, wi, wb];
const wff = new Set(["ph", "ps", "ch", "th", "chi"]);
const kindOf: KindOf = (t) => (wff.has(t) ? "wff" : undefined);

// |- ( ph -> ( ps <-> th ) )  -- token indices:
// 0:|-  1:(  2:ph  3:->  4:(  5:ps  6:<->  7:th  8:)  9:)
const tokens = ["|-", "(", "ph", "->", "(", "ps", "<->", "th", ")", ")"];
const proof = parseExpression(tokens, "$TOP", rules, kindOf)!;

describe("nodeSpans", () => {
  it("gives each parse node its token range", () => {
    expect(new Set(nodeSpans(proof))).toEqual(
      new Set([
        [2, 3], // ph leaf
        [5, 6], // ps leaf
        [7, 8], // th leaf
        [4, 9], // wb: ( ps <-> th )
        [1, 10], // wi: ( ph -> ( ps <-> th ) )
        [0, 10], // $TOP: whole statement
      ]),
    );
  });
});

describe("smallestSpanContaining", () => {
  const spans = nodeSpans(proof);
  const at = (i: number) => smallestSpanContaining(spans, i);

  it("a variable highlights just itself", () => {
    expect(at(7)).toEqual([7, 8]); // th
  });

  it("an inner operator highlights its sub-expression", () => {
    expect(at(6)).toEqual([4, 9]); // <-> -> ( ps <-> th )
  });

  it("the outer operator highlights the whole wff", () => {
    expect(at(3)).toEqual([1, 10]); // -> -> ( ph -> ( ps <-> th ) )
  });

  it("the turnstile highlights the whole statement", () => {
    expect(at(0)).toEqual([0, 10]);
  });
});

describe("gapUnits", () => {
  it("puts space around the outer operator, none around the inner one", () => {
    // spacing: leaves -1; ( ps <-> th ) = 0; ( ph -> ... ) = 1.
    // 1 unit before "->" and before the "(" after it (symmetric around "->");
    // 0 around "<->"; nothing at brackets or the turnstile.
    expect(gapUnits(proof)).toEqual([
      0, // |-
      0, // (
      0, // ph
      1, // -> (after ph)
      1, // (  (before the inner subexpression)
      0, // ps
      0, // <->
      0, // th
      0, // )
      0, // )
    ]);
  });
});
