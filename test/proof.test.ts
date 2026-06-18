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

  it("is a closed proof -- no open assumptions left", () => {
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

// The logical proof tree of the bitrdi page (the "Proof of Theorem" table),
// rooted at the main |- assertion: bitrd applied to bitrdi.1 and (a1i applied
// to bitrdi.2). This is the target a calculation will evaluate to (phase 2).
// Each step is a ground instance read off the table -- its rule's assumptions
// are the cited steps' expressions and its conclusion is the step's expression
// -- and the hypotheses are ground leaves, so the proof is closed.
describe("evaluate (bitrdi logical proof -- the table's proof tree)", () => {
  const hyp1 = ["|-", "(", "ph", "->", "(", "ps", "<->", "ch", ")", ")"]; // bitrdi.1
  const hyp2 = ["|-", "(", "ch", "<->", "th", ")"]; // bitrdi.2
  const step3 = ["|-", "(", "ph", "->", "(", "ch", "<->", "th", ")", ")"]; // a1i
  const goal = ["|-", "(", "ph", "->", "(", "ps", "<->", "th", ")", ")"]; // bitrd

  const a1iStep = apply({ assumptions: [hyp2], conclusion: step3 }, new Map(), [
    leaf(...hyp2),
  ]);
  const bitrdStep = apply(
    { assumptions: [hyp1, step3], conclusion: goal },
    new Map(),
    [leaf(...hyp1), a1iStep],
  );

  it("evaluates to the main assertion", () => {
    const established = evaluate(bitrdStep);
    expect(established.conclusion).toEqual(goal);
    expect(established.assumptions).toEqual([]); // hypotheses are ground leaves
  });
});
