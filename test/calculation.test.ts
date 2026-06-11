import { describe, expect, it } from "vitest";
import { evaluateCalculation, type Calculation } from "../src/calculation";
import { evaluate, type InferenceRule, type Proof } from "../src/proof";

// bitrdi expressions (full, top-level statements).
const hyp1 = ["|-", "(", "ph", "->", "(", "ps", "<->", "ch", ")", ")"]; // bitrdi.1
const hyp2 = ["|-", "(", "ch", "<->", "th", ")"]; // bitrdi.2
const step3 = ["|-", "(", "ph", "->", "(", "ch", "<->", "th", ")", ")"]; // a1i
const goal = ["|-", "(", "ph", "->", "(", "ps", "<->", "th", ")", ")"]; // bitrd

// The inference rules used, as ground instances.
const a1i: InferenceRule = { assumptions: [hyp2], conclusion: step3 };
const bitrd: InferenceRule = { assumptions: [hyp1, step3], conclusion: goal };

// The proof tree the "Proof of Theorem" table shows: bitrd over bitrdi.1 and
// a1i-of-bitrdi.2.
const apply = (rule: InferenceRule, subproofs: Proof[]): Proof => ({
  rule,
  subst: new Map(),
  subproofs,
});
const leaf = (...e: string[]): Proof =>
  apply({ assumptions: [], conclusion: e }, []);
const bitrdiProofTree = apply(bitrd, [
  leaf(...hyp1),
  apply(a1i, [leaf(...hyp2)]),
]);

// The a1i sub-derivation, shared by both examples: |- ( ch <-> th ) (bitrdi.2)
// gives |- ( ph -> ( ch <-> th ) ) via a1i.
const a1iSub: Calculation = {
  kind: "step",
  first: step3,
  rule: a1i, // assumptions [bitrdi.2]
  subcalculations: [{ kind: "given", hypothesis: hyp2 }], // bitrdi.2
  spine: 0,
};

// Both examples are the same <== proof of the page's assertion; they differ only
// in which subcalculation is the spine (the main line), which changes nothing in
// the evaluated proof tree.

// Example 1a: the spine runs through bitrdi.1; the a1i sub-derivation is the
// side assumption.
//    |- ( ph -> ( ps <-> th ) )                     <- first
// <==  { bitrd }
//          |- ( ph -> ( ch <-> th ) )
//       <==  { a1i }
//          |- ( ch <-> th )                         (bitrdi.2)
//    |- ( ph -> ( ps <-> ch ) )                     <- spine (second expression) = bitrdi.1
const example1a: Calculation = {
  kind: "step",
  first: goal,
  rule: bitrd, // assumptions [bitrdi.1, step3]
  subcalculations: [{ kind: "given", hypothesis: hyp1 }, a1iSub], // bitrdi.1, then the a1i sub
  spine: 0, // bitrdi.1 is the spine
};

// Example 1b: the spine runs through the a1i sub-derivation; bitrdi.1 is the
// side assumption.
//    |- ( ph -> ( ps <-> th ) )                     <- first
// <==  { bitrd, side: bitrdi.1 }
//    |- ( ph -> ( ch <-> th ) )                     <- spine (second expression)
// <==  { a1i }
//    |- ( ch <-> th )                               (bitrdi.2)
const example1b: Calculation = {
  kind: "step",
  first: goal,
  rule: bitrd,
  subcalculations: [{ kind: "given", hypothesis: hyp1 }, a1iSub],
  spine: 1, // the a1i sub-derivation is the spine
};

describe("evaluateCalculation", () => {
  it("reconstructs the bitrdi proof tree from example 1a (spine through bitrdi.1)", () => {
    expect(evaluateCalculation(example1a)).toEqual(bitrdiProofTree);
  });

  it("reconstructs the bitrdi proof tree from example 1b (spine through a1i)", () => {
    expect(evaluateCalculation(example1b)).toEqual(bitrdiProofTree);
  });

  it("the reconstructed proof establishes the page's main assertion", () => {
    const established = evaluate(evaluateCalculation(example1b));
    expect(established.conclusion).toEqual(goal);
    expect(established.assumptions).toEqual([]); // hypotheses are ground leaves
  });
});
