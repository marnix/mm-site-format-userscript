import { describe, expect, it } from "vitest";
import { matchingOccurrences } from "../src/highlight";
import type { ParsedExpression } from "../src/page";
import { parseExpression, type KindOf } from "../src/parse";
import type { InferenceRule } from "../src/proof";
import type { TokenLocation } from "../src/token";

// A tiny grammar: the $TOP rule plus implication (wi). Enough to build proofs
// with repeated sub-expressions.
const TOP: InferenceRule = {
  assumptions: [["wff", "chi"]],
  conclusion: ["$TOP", "|-", "chi"],
};
const wi: InferenceRule = {
  assumptions: [
    ["wff", "ph"],
    ["wff", "ps"],
  ],
  conclusion: ["wff", "(", "ph", "->", "ps", ")"],
};
const rules = [TOP, wi];
const wff = new Set(["ph", "ps", "ch", "th", "chi"]);
const kindOf: KindOf = (t) => (wff.has(t) ? "wff" : undefined);

// matchingOccurrences only reads `tokens` and `locations.length`, so the
// locations are dummies of the right length.
function parsed(tokens: string[]): ParsedExpression {
  const proof = parseExpression(tokens, "$TOP", rules, kindOf);
  expect(proof).not.toBeNull();
  return {
    // matchingOccurrences only reads token text, so kind is irrelevant here.
    tokens: tokens.map((text) => ({ text, kind: null }) as const),
    locations: new Array(tokens.length).fill(null) as TokenLocation[],
    proof,
  };
}

const target = ["(", "ph", "->", "ps", ")"];

describe("matchingOccurrences", () => {
  it("finds both occurrences of a sub-expression within one expression", () => {
    const expr = parsed(
      "|- ( ( ph -> ps ) -> ( ph -> ps ) )".split(" "), // ( ph -> ps ) twice
    );
    const found = matchingOccurrences([expr], target);
    expect(found).toHaveLength(2);
    for (const occ of found) {
      expect(
        expr.tokens.slice(occ.span[0], occ.span[1]).map((t) => t.text),
      ).toEqual(target);
    }
  });

  it("finds the same sub-expression across separate expressions", () => {
    const a = parsed("|- ( ph -> ps )".split(" "));
    const b = parsed("|- ( ( ph -> ps ) -> ch )".split(" "));
    const found = matchingOccurrences([a, b], target);
    expect(found).toHaveLength(2);
    expect(found.map((o) => o.expr)).toEqual([a, b]);
  });

  it("does not match a different sub-expression", () => {
    const expr = parsed("|- ( ph -> ch )".split(" "));
    expect(matchingOccurrences([expr], target)).toHaveLength(0);
  });
});
