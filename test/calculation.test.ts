// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  evaluateCalculation,
  findSharedNodes,
  missingCalcRefs,
  proofTreeToCalculation,
  type Calculation,
  type ProofTree,
} from "../src/calculation";
import { parseProofTable } from "../src/table";
import { readFixture } from "./helpers";

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

// Expression-column fragments, likewise shared distinct elements.
const exprGoal = ref("|- ( ph -> ( ps <-> th ) )");
const exprHyp1 = ref("|- ( ph -> ( ps <-> ch ) )");
const exprHyp2 = ref("|- ( ch <-> th )");
const exprStep3 = ref("|- ( ph -> ( ch <-> th ) )");

// The proof tree the table yields: bitrd over bitrdi.1 and a1i-of-bitrdi.2.
const bitrdiProofTree: ProofTree = {
  refHtml: bitrd,
  expressionHtml: exprGoal,
  subproofs: [
    { refHtml: bitrdi1, expressionHtml: exprHyp1, subproofs: [] },
    {
      refHtml: a1i,
      expressionHtml: exprStep3,
      subproofs: [
        { refHtml: bitrdi2, expressionHtml: exprHyp2, subproofs: [] },
      ],
    },
  ],
};

// The a1i sub-derivation: depth-1 (one rule application on a leaf), folded
// into a given with leafRefHtmls carrying the leaf's ref.
const a1iSub: Calculation = {
  kind: "given",
  hypothesisRefHtml: a1i,
  expressionHtml: exprStep3,
  leafRefHtmls: [bitrdi2],
};

// Both examples are the same <== proof; they differ only in which subcalculation
// is the spine (the main line), which evaluateCalculation ignores.

// Example 1a: the spine runs through bitrdi.1; the a1i sub-derivation is the side.
const example1a: Calculation = {
  kind: "step",
  inferenceRuleRefHtml: bitrd,
  expressionHtml: exprGoal,
  subcalculations: [
    { kind: "given", hypothesisRefHtml: bitrdi1, expressionHtml: exprHyp1 },
    a1iSub,
  ],
  spine: 0,
};

// Example 1b: the spine runs through the a1i sub-derivation; bitrdi.1 is the side.
const example1b: Calculation = {
  kind: "step",
  inferenceRuleRefHtml: bitrd,
  expressionHtml: exprGoal,
  subcalculations: [
    { kind: "given", hypothesisRefHtml: bitrdi1, expressionHtml: exprHyp1 },
    a1iSub,
  ],
  spine: 1,
};

// The evaluated tree loses the a1i node's children (depth-1 nodes are folded
// to givens, so evaluateCalculation sees them as leaves).
const evaluatedTree: ProofTree = {
  refHtml: bitrd,
  expressionHtml: exprGoal,
  subproofs: [
    { refHtml: bitrdi1, expressionHtml: exprHyp1, subproofs: [] },
    { refHtml: a1i, expressionHtml: exprStep3, subproofs: [] },
  ],
};

describe("evaluateCalculation", () => {
  it("reconstructs the proof tree from example 1a (depth-1 nodes become leaves)", () => {
    expect(evaluateCalculation(example1a)).toEqual(evaluatedTree);
  });

  it("reconstructs the proof tree from example 1b (depth-1 nodes become leaves)", () => {
    expect(evaluateCalculation(example1b)).toEqual(evaluatedTree);
  });
});

describe("proofTreeToCalculation", () => {
  it("replicates the tree with spine 0 everywhere (= example 1a)", () => {
    expect(proofTreeToCalculation(bitrdiProofTree)).toEqual(example1a);
  });

  it("round-trips: evaluate(convert(tree)) equals the lossy tree", () => {
    expect(
      evaluateCalculation(proofTreeToCalculation(bitrdiProofTree)),
    ).toEqual(evaluatedTree);
  });

  it("threads the parent's tokens as anchor to the spine child only", () => {
    // bitrdiProofTree: root (bitrd) -> [child0=bitrdi1(leaf), child1=a1i->[bitrdi2(leaf)]]
    // spineFor always returns 0, so child0 is the spine child at the root.
    // child0 is a leaf, so spineFor is never called for it.
    // child1 is non-spine, so it gets anchor=null.
    // To expose anchor threading to the non-leaf spine child, we need a tree
    // where the spine child itself has subproofs that are NOT all leaves.
    //   root -> [mid(spine) -> [inner -> [leaf1]], leaf2(non-spine)]
    const leaf1: ProofTree = {
      refHtml: ref("ref1"),
      expressionHtml: ref("L1"),
      subproofs: [],
    };
    const leaf2: ProofTree = {
      refHtml: ref("ref2"),
      expressionHtml: ref("L2"),
      subproofs: [],
    };
    const inner: ProofTree = {
      refHtml: ref("inner"),
      expressionHtml: ref("I"),
      subproofs: [leaf1],
    };
    const mid: ProofTree = {
      refHtml: ref("mid"),
      expressionHtml: ref("M"),
      subproofs: [inner],
    };
    const root: ProofTree = {
      refHtml: ref("root"),
      expressionHtml: ref("R"),
      subproofs: [mid, leaf2],
    };

    // Spy: record (node label, anchor) for each spineFor call.
    const calls: [string, string[] | null][] = [];
    const spySpineFor = (
      node: ProofTree,
      anchor: string[] | null,
    ): number | null => {
      calls.push([node.expressionHtml.textContent ?? "", anchor]);
      return 0;
    };
    const tokensFor = (node: ProofTree): string[] | null =>
      node.expressionHtml.textContent?.split("") ?? null;

    proofTreeToCalculation(root, spySpineFor, () => false, tokensFor, null);

    // spineFor is called for root, mid, and inner (all on the spine chain).
    // leaf1 and leaf2 are leaves; spineFor is never called for them.
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual(["R", null]); // root: no parent anchor
    expect(calls[1]).toEqual(["M", tokensFor(root)]); // mid: spine child, gets root's tokens
    expect(calls[2]).toEqual(["I", tokensFor(mid)]); // inner: spine child of mid
  });
});

describe("missingCalcRefs", () => {
  it("returns empty when all steps are accounted for", () => {
    const { tree, stepOf } = parseProofTable(
      new DOMParser().parseFromString(
        readFixture("mpeuni", "bitrdi.html"),
        "text/html",
      ),
    )!;
    const shared = findSharedNodes(tree);
    const calc = proofTreeToCalculation(tree);
    expect(missingCalcRefs(tree, stepOf, calc, shared)).toEqual([]);
  });

  it("reports a missing step when a ref is not in the calc or shared", () => {
    // Build a simple tree: root -> [child1, child2(leaf)]
    const child1Ref = document.createElement("td");
    child1Ref.textContent = "child1";
    const child2Ref = document.createElement("td");
    child2Ref.textContent = "child2";
    const rootRef = document.createElement("td");
    rootRef.textContent = "root";

    const child1: ProofTree = {
      refHtml: child1Ref,
      expressionHtml: document.createElement("td"),
      subproofs: [],
    };
    const child2: ProofTree = {
      refHtml: child2Ref,
      expressionHtml: document.createElement("td"),
      subproofs: [],
    };
    const root: ProofTree = {
      refHtml: rootRef,
      expressionHtml: document.createElement("td"),
      subproofs: [child1, child2],
    };
    const stepOf = new Map<ProofTree, number>([
      [root, 3],
      [child1, 1],
      [child2, 2],
    ]);

    // Build a calc that only includes root and child1 (child2 missing).
    const calc: Calculation = {
      kind: "step",
      inferenceRuleRefHtml: rootRef,
      expressionHtml: document.createElement("td"),
      subcalculations: [
        {
          kind: "given",
          hypothesisRefHtml: child1Ref,
          expressionHtml: document.createElement("td"),
        },
      ],
      spine: 0,
    };
    const shared = new Set<ProofTree>();
    expect(missingCalcRefs(root, stepOf, calc, shared)).toEqual([2]);
  });

  it("does not report shared nodes as missing", () => {
    const child1Ref = document.createElement("td");
    const rootRef = document.createElement("td");
    const child1: ProofTree = {
      refHtml: child1Ref,
      expressionHtml: document.createElement("td"),
      subproofs: [],
    };
    const root: ProofTree = {
      refHtml: rootRef,
      expressionHtml: document.createElement("td"),
      subproofs: [child1],
    };
    const stepOf = new Map<ProofTree, number>([
      [root, 2],
      [child1, 1],
    ]);
    // calc only has root (child1 not referenced), but child1 is shared.
    const calc: Calculation = {
      kind: "step",
      inferenceRuleRefHtml: rootRef,
      expressionHtml: document.createElement("td"),
      subcalculations: [],
      spine: null,
    };
    const shared = new Set<ProofTree>([child1]);
    expect(missingCalcRefs(root, stepOf, calc, shared)).toEqual([]);
  });
});

describe("missingCalcRefs (cniccbdd)", () => {
  it("all steps are accounted for in the calculation", () => {
    const html = readFixture("mpeuni", "cniccbdd.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const result = parseProofTable(doc)!;
    const { tree, stepOf } = result;
    const shared = findSharedNodes(tree);
    // Try with null spine (no spine chosen -- everything is a subcalc):
    const calcNull = proofTreeToCalculation(
      tree,
      () => null,
      () => false,
      () => null,
      null,
      new Set(),
      new Set(),
      false,
    );
    const missingNull = missingCalcRefs(tree, stepOf, calcNull, shared);
    expect(missingNull).toEqual([]);
  });
});
