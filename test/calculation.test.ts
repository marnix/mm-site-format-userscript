// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  evaluateCalculation,
  proofTreeToCalculation,
  type Calculation,
  type ProofTree,
} from "../src/calculation";

// Ref-column HTML fragments, as distinct elements (the same instances are shared
// between the calculations and the expected tree, so toEqual compares them by
// identity rather than traversing the DOM).
const ref = (html: string): Element => {
  const td = document.createElement("td");
  td.innerHTML = html;
  return td;
};
const bitrd = ref('<a href="bitrd.html">bitrd</a>');
const a1i = ref('<a href="a1i.html">a1i</a>');
const bitrdi1 = ref("bitrdi.1");
const bitrdi2 = ref("bitrdi.2");

// The proof tree the table yields: bitrd over bitrdi.1 and a1i-of-bitrdi.2.
const bitrdiProofTree: ProofTree = {
  refHtml: bitrd,
  subproofs: [
    { refHtml: bitrdi1, subproofs: [] },
    { refHtml: a1i, subproofs: [{ refHtml: bitrdi2, subproofs: [] }] },
  ],
};

// The a1i sub-derivation, shared by both examples.
const a1iSub: Calculation = {
  kind: "step",
  inferenceRuleRefHtml: a1i,
  subcalculations: [{ kind: "given", hypothesisRefHtml: bitrdi2 }],
  spine: 0,
};

// Both examples are the same <== proof; they differ only in which subcalculation
// is the spine (the main line), which evaluateCalculation ignores.

// Example 1a: the spine runs through bitrdi.1; the a1i sub-derivation is the side.
const example1a: Calculation = {
  kind: "step",
  inferenceRuleRefHtml: bitrd,
  subcalculations: [{ kind: "given", hypothesisRefHtml: bitrdi1 }, a1iSub],
  spine: 0,
};

// Example 1b: the spine runs through the a1i sub-derivation; bitrdi.1 is the side.
const example1b: Calculation = {
  kind: "step",
  inferenceRuleRefHtml: bitrd,
  subcalculations: [{ kind: "given", hypothesisRefHtml: bitrdi1 }, a1iSub],
  spine: 1,
};

describe("evaluateCalculation", () => {
  it("reconstructs the proof tree from example 1a (spine through bitrdi.1)", () => {
    expect(evaluateCalculation(example1a)).toEqual(bitrdiProofTree);
  });

  it("reconstructs the proof tree from example 1b (spine through a1i)", () => {
    expect(evaluateCalculation(example1b)).toEqual(bitrdiProofTree);
  });
});

describe("proofTreeToCalculation", () => {
  it("replicates the tree with spine 0 everywhere (= example 1a)", () => {
    expect(proofTreeToCalculation(bitrdiProofTree)).toEqual(example1a);
  });

  it("round-trips: evaluate(convert(tree)) equals the tree", () => {
    expect(
      evaluateCalculation(proofTreeToCalculation(bitrdiProofTree)),
    ).toEqual(bitrdiProofTree);
  });
});
