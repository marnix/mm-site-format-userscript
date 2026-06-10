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

const apply = (
  rule: InferenceRule,
  subst: Substitution,
  subproofs: Proof[],
): Proof => ({ rule, subst, subproofs });
const sub = (pairs: [string, string[]][]): Substitution => new Map(pairs);
// A leaf: a variable's kind-typing as a zero-assumption rule, no sub-proofs.
const leaf = (...typing: string[]): Proof =>
  apply({ assumptions: [], conclusion: typing }, new Map(), []);

// Parse tree of  ( ph -> ( ps <-> th ) )  wrapped as a $TOP statement,
// matching the tree the metamath binary produces: wi(wph, wb(wps, wth)).
const wbStep = apply(
  wb,
  sub([
    ["ph", ["ps"]],
    ["ps", ["th"]],
  ]),
  [leaf("wff", "ps"), leaf("wff", "th")],
);
const wiStep = apply(
  wi,
  sub([
    ["ph", ["ph"]],
    ["ps", ["(", "ps", "<->", "th", ")"]],
  ]),
  [leaf("wff", "ph"), wbStep],
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

  it("is a closed proof — no open assumptions left", () => {
    // Each variable typing is discharged by a zero-assumption leaf rule.
    expect(evaluate(bitrdiProof).assumptions).toEqual([]);
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
      [leaf("wff", "th"), leaf("wff", "ps")], // reversed
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
      [leaf("wff", "ps"), leaf("wff", "ch")], // ch, not th
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
