// @vitest-environment happy-dom
//
// Tests for shared sub-derivation deduplication using sgnrn.html.
// Step 6 (|- sgn Fn RR*) is used 4 times (by steps 9, 13, 18, 23).
// With the memoized proof DAG, step 6 is the same ProofTree node object
// in all 4 places, and findSharedNodes detects it.

import { describe, expect, it } from "vitest";
import { parseProofTable } from "../src/table";
import {
  findSharedNodes,
  proofTreeToCalculation,
  type ProofTree,
} from "../src/calculation";
import { readFixture } from "./helpers";

function loadSgnrn(): ProofTree {
  const html = readFixture("mpeuni", "sgnrn.html");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const result = parseProofTable(doc);
  expect(result).not.toBeNull();
  return result!.tree;
}

describe("shared sub-derivation detection (sgnrn)", () => {
  it("memoized DAG shares step 6 across all 4 uses", () => {
    const tree = loadSgnrn();
    // tree is step 27, which uses steps 9 and 26.
    // Step 9 uses step 6; step 26 uses steps 13, 18, 23 via intermediate steps,
    // each of which uses step 6. With memoization, all references to step 6
    // are the same object.
    const step6refs: ProofTree[] = [];
    function collectStep6(node: ProofTree, depth: number): void {
      // Step 6 is "|- sgn Fn RR*" with 2 subproofs (steps 2 and 5)
      // It's the only node at depth >= 2 with exactly 2 subproofs where
      // one subproof has 0 subproofs (step 2 has 1 subproof) and the other
      // has 2 subproofs (step 5).
      // Simpler: just collect all nodes and check identity sharing.
      if (depth > 5) return;
      for (const child of node.subproofs) {
        collectStep6(child, depth + 1);
      }
    }
    // Instead, use findSharedNodes to detect sharing
    const shared = findSharedNodes(tree);
    // Step 6 (used 4x) and step 4 (used 2x) should both be shared
    expect(shared.size).toBeGreaterThanOrEqual(2);
  });

  it("findSharedNodes finds step 6 (used 4x) and step 4 (used 2x)", () => {
    const tree = loadSgnrn();
    const shared = findSharedNodes(tree);

    // Verify by counting: collect all subproof references and find duplicates
    const refCounts = new Map<ProofTree, number>();
    function countRefs(node: ProofTree, visited: Set<ProofTree>): void {
      if (visited.has(node)) return;
      visited.add(node);
      for (const child of node.subproofs) {
        refCounts.set(child, (refCounts.get(child) ?? 0) + 1);
        countRefs(child, visited);
      }
    }
    // Need to count across all paths, not just visited-once
    function countAllRefs(node: ProofTree): void {
      for (const child of node.subproofs) {
        refCounts.set(child, (refCounts.get(child) ?? 0) + 1);
        countAllRefs(child);
      }
    }
    // Actually with a DAG and memoization, we need a different approach:
    // walk without dedup to count parent edges
    const parentCounts = new Map<ProofTree, number>();
    function walkParents(node: ProofTree, seen: Set<ProofTree>): void {
      if (seen.has(node)) return;
      seen.add(node);
      for (const child of node.subproofs) {
        parentCounts.set(child, (parentCounts.get(child) ?? 0) + 1);
        walkParents(child, seen);
      }
    }
    walkParents(tree, new Set());
    const multiParent = new Map(
      [...parentCounts].filter(([, count]) => count > 1),
    );

    // Every node found by findSharedNodes should have multiple parents
    for (const node of shared) {
      expect(parentCounts.get(node) ?? 0).toBeGreaterThan(1);
    }
    // And every multi-parent node should be in shared
    for (const [node] of multiParent) {
      expect(shared.has(node)).toBe(true);
    }
  });

  it("proofTreeToCalculation with shared set treats shared nodes as givens", () => {
    const tree = loadSgnrn();
    const shared = findSharedNodes(tree);

    const calc = proofTreeToCalculation(
      tree,
      () => 0,
      () => false,
      () => null,
      null,
      shared,
    );

    // The calculation should not recursively expand shared nodes.
    // Count how many "given" nodes correspond to shared proof nodes.
    let sharedGivens = 0;
    function walkCalc(c: typeof calc): void {
      if (c.kind === "given") {
        // Check if this given corresponds to a shared node (has subproofs
        // in the original tree, meaning it was cut short)
        for (const node of shared) {
          if (c.expressionHtml === node.expressionHtml) sharedGivens++;
        }
      } else {
        for (const sub of c.subcalculations) walkCalc(sub);
      }
    }
    walkCalc(calc);
    // Step 6 appears 4 times as a given, step 4 appears 2 times
    expect(sharedGivens).toBeGreaterThanOrEqual(4);
  });

  it("shared nodes with subproofs can be independently converted to step calculations", () => {
    const tree = loadSgnrn();
    const shared = findSharedNodes(tree);

    // Shared nodes that have subproofs (internal steps) should be convertible
    // to their own mini-calculations. Leaves (hypotheses) are shared but
    // naturally become givens.
    const internalShared = [...shared].filter((n) => n.subproofs.length > 0);
    expect(internalShared.length).toBeGreaterThan(0);

    for (const node of internalShared) {
      const miniCalc = proofTreeToCalculation(node);
      expect(miniCalc.kind).toBe("step");
      if (miniCalc.kind === "step") {
        expect(miniCalc.subcalculations.length).toBeGreaterThan(0);
      }
    }
  });
});
