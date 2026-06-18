import { describe, expect, it } from "vitest";
import { missingSyntaxHints } from "../src/grammar";
import type { InferenceRule, Proof } from "../src/proof";

const rule = (
  label: string | undefined,
  conclusion: string[],
): InferenceRule =>
  label === undefined
    ? { assumptions: [], conclusion }
    : { assumptions: [], conclusion, label };
const node = (r: InferenceRule, ...subproofs: Proof[]): Proof => ({
  rule: r,
  subst: new Map(),
  subproofs,
});

describe("missingSyntaxHints", () => {
  // \u00ac ( x \u2208 x ): wn over wcel over cv-coerced setvars -- the elirrv shape.
  const cvx = () => node(rule("cv", ["class", "x"]));
  const wcel = node(rule("wcel", ["wff", "A", "\u2208", "B"]), cvx(), cvx());
  const wn = node(rule("wn", ["wff", "\u00ac", "ph"]), wcel);

  it("reports constructors used in the proofs but not declared", () => {
    expect(missingSyntaxHints([wn], new Set(["wn"]))).toEqual(["wcel"]);
  });

  it("excludes cv (always loaded, categorically omitted upstream)", () => {
    // cv is used (the setvar coercions) but must never be reported.
    expect(missingSyntaxHints([wn], new Set(["wn", "wcel"]))).toEqual([]);
  });

  it("is empty when every used constructor is declared", () => {
    expect(missingSyntaxHints([wn], new Set(["wn", "wcel"]))).toEqual([]);
  });

  it("ignores unlabeled rules (the $TOP rule, variable-typing leaves)", () => {
    const top = node(rule(undefined, ["$TOP", "\u22a2", "chi"]), wn);
    expect(missingSyntaxHints([top], new Set(["wn", "wcel"]))).toEqual([]);
  });
});
