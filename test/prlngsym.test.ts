// @vitest-environment happy-dom
//
// Test that prlngsym.html's shared steps (7 and 8) are correctly detected.

import { describe, expect, it } from "vitest";
import { parseProofTable } from "../src/table";
import {
  findSharedNodes,
  proofTreeToCalculation,
  type Calculation,
  type ProofTree,
} from "../src/calculation";
import { readFixture } from "./helpers";

function loadPrlngsym() {
  const html = readFixture("mpeuni", "prlngsym.html");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const result = parseProofTable(doc)!;
  return result;
}

describe("prlngsym shared step detection", () => {
  it("step 7 and step 8 are detected as shared", () => {
    const { tree, stepOf } = loadPrlngsym();
    const shared = findSharedNodes(tree);
    const internalShared = [...shared].filter((n) => n.subproofs.length > 0);
    const sharedStepNumbers = internalShared
      .map((n) => stepOf.get(n))
      .sort((a, b) => a! - b!);
    expect(sharedStepNumbers).toContain(7);
    expect(sharedStepNumbers).toContain(8);
  });

  it("with spineFor=()=>0, spine passes through steps 7 and 8", () => {
    const { tree, stepOf } = loadPrlngsym();

    const trialCalc = proofTreeToCalculation(tree);

    const spineNodes = new Set<ProofTree>();
    function collectSpine(c: Calculation, t: ProofTree): void {
      if (c.kind !== "step") return;
      const spineIdx = c.spine;
      if (spineIdx === null) return;
      const spineChild = t.subproofs[spineIdx];
      if (spineChild) {
        spineNodes.add(spineChild);
        collectSpine(c.subcalculations[spineIdx], spineChild);
      }
    }
    collectSpine(trialCalc, tree);

    const spineStepNumbers = [...spineNodes]
      .map((n) => stepOf.get(n))
      .filter((n) => n !== undefined)
      .sort((a, b) => a! - b!);

    // With spineFor=()=>0, the spine from step 25 follows:
    // 25 -> subproofs[0] = step 23
    // 23 -> subproofs[0] = step 9
    // 9  -> subproofs[0] = step 8
    // 8  -> subproofs[0] = step 7
    // 7  -> subproofs[0] = step 1 (leaf)
    expect(spineStepNumbers).toContain(7);
    expect(spineStepNumbers).toContain(8);
  });

  it("shared nodes become givens in the calculation", () => {
    const { tree, stepOf } = loadPrlngsym();
    const shared = findSharedNodes(tree);

    const calc = proofTreeToCalculation(
      tree,
      () => 0,
      () => false,
      () => null,
      null,
      shared,
    );

    // Step 7 should appear as a given (not expanded) somewhere in the calc
    const step7 = [...shared].find(
      (n) => stepOf.get(n) === 7 && n.subproofs.length > 0,
    )!;
    function hasGiven(c: Calculation, target: ProofTree): boolean {
      if (c.kind === "given") return c.expressionHtml === target.expressionHtml;
      return c.subcalculations.some((sub) => hasGiven(sub, target));
    }
    expect(hasGiven(calc, step7)).toBe(true);
  });
});
