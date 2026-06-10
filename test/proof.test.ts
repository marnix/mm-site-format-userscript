import { describe, expect, it } from "vitest";
import {
  evaluate,
  substitute,
  type InferenceRule,
  type Proof,
  type Substitution,
} from "../src/proof";

// Hardcoded rules (these will later be extracted from syntax-definition pages).
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
// The single built-in config rule: "wff chi" ==> "$TOP |- chi".
const top: InferenceRule = {
  assumptions: [["wff", "chi"]],
  conclusion: ["$TOP", "|-", "chi"],
};

const hyp = (expr: string[]): Proof => ({ tag: "hyp", expr });
const apply = (
  rule: InferenceRule,
  subst: Substitution,
  subproofs: Proof[],
): Proof => ({ tag: "apply", rule, subst, subproofs });
const sub = (pairs: [string, string[]][]): Substitution => new Map(pairs);

const assumptionSet = (rule: InferenceRule): Set<string> =>
  new Set(rule.assumptions.map((a) => a.join(" ")));

// Parse tree of  ( ph -> ( ps <-> th ) )  wrapped as a $TOP statement,
// matching the tree the metamath binary produces: wi(wph, wb(wps, wth)).
const wbStep = apply(
  wb,
  sub([
    ["ph", ["ps"]],
    ["ps", ["th"]],
  ]),
  [hyp(["wff", "ps"]), hyp(["wff", "th"])],
);
const wiStep = apply(
  wi,
  sub([
    ["ph", ["ph"]],
    ["ps", ["(", "ps", "<->", "th", ")"]],
  ]),
  [hyp(["wff", "ph"]), wbStep],
);
const bitrdiProof = apply(
  top,
  sub([["chi", ["(", "ph", "->", "(", "ps", "<->", "th", ")", ")"]]]),
  [wiStep],
);

describe("evaluate (bitrdi parse tree)", () => {
  it("establishes $TOP |- ( ph -> ( ps <-> th ) )", () => {
    expect(evaluate(bitrdiProof).conclusion).toEqual([
      "$TOP", "|-", "(", "ph", "->", "(", "ps", "<->", "th", ")", ")",
    ]); // prettier-ignore
  });

  it("has exactly the variable kind-typings as assumptions", () => {
    expect(assumptionSet(evaluate(bitrdiProof))).toEqual(
      new Set(["wff ph", "wff ps", "wff th"]),
    );
  });
});

describe("evaluate (assumption matching)", () => {
  it("is order-independent: sub-proofs may be in any order", () => {
    const swapped = apply(
      wb,
      sub([
        ["ph", ["ps"]],
        ["ps", ["th"]],
      ]),
      [hyp(["wff", "th"]), hyp(["wff", "ps"])], // reversed
    );
    expect(evaluate(swapped).conclusion).toEqual([
      "wff", "(", "ps", "<->", "th", ")",
    ]); // prettier-ignore
  });

  it("rejects a sub-proof whose conclusion is not an assumption", () => {
    const bad = apply(
      wb,
      sub([
        ["ph", ["ps"]],
        ["ps", ["th"]],
      ]),
      [hyp(["wff", "ps"]), hyp(["wff", "ch"])], // ch, not th
    );
    expect(() => evaluate(bad)).toThrow();
  });
});

describe("substitute", () => {
  it("replaces all variables simultaneously", () => {
    expect(
      substitute(
        sub([
          ["ph", ["ps"]],
          ["ps", ["th"]],
        ]),
        wb,
      ).conclusion,
    ).toEqual(["wff", "(", "ps", "<->", "th", ")"]);
  });
});
