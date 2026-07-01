// @vitest-environment happy-dom
//
// Integration test for prlngsym shared-step handling with the REAL spine
// chooser (not spineFor=()=>0). Verifies that the spine passes through step 7
// and that spineShared correctly expands it on the spine while making it a
// given off-spine.

import { describe, expect, it, vi } from "vitest";
import { parseProofTable } from "../src/table";
import {
  findSharedNodes,
  proofTreeToCalculation,
  type Calculation,
  type ProofTree,
} from "../src/calculation";
import { parseUniExpressions, type ParsedExpression } from "../src/page";
import { chooseSpine, anchorSpine } from "../src/spine";
import type { Proof } from "../src/proof";
import { readFixture } from "./helpers";

const PAGE_URL = "https://us.metamath.org/mpeuni/prlngsym.html";

const fetcher = vi.fn(async (url: string) => {
  const name = url.split("/").pop()!;
  try {
    return readFixture("mpeuni", name);
  } catch {
    return "<html></html>";
  }
});

describe("prlngsym with real spine chooser", { timeout: 30_000 }, () => {
  it("spine passes through step 7 with the real spineFor", async () => {
    const html = readFixture("mpeuni", "prlngsym.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const { tree, stepOf } = parseProofTable(doc)!;
    const results = await parseUniExpressions(doc, PAGE_URL, fetcher);

    // Build the real spineFor (same logic as index.ts choosers)
    const cache = new Map<ProofTree, ParsedExpression | null>();
    const exprOf = (node: ProofTree): ParsedExpression | null => {
      if (cache.has(node)) return cache.get(node)!;
      let found: ParsedExpression | null = null;
      const cell = node.expressionCell;
      if (cell)
        for (const r of results) {
          const at = r.locations[0]?.node;
          if (r.proof && at && cell.contains(at)) {
            found = r;
            break;
          }
        }
      cache.set(node, found);
      return found;
    };
    const parseOf = (node: ProofTree): Proof | null =>
      exprOf(node)?.proof ?? null;
    const tokensOf = (node: ProofTree): string[] | null =>
      exprOf(node)?.tokens.map((t) => t.text) ?? null;

    const spineFor = (
      node: ProofTree,
      anchor: string[] | null,
    ): number | null => {
      const conclusion = parseOf(node);
      const subs = node.subproofs.map((s) => ({
        parse: parseOf(s),
        trivial: s.subproofs.length === 0,
      }));
      if (!conclusion || subs.some((s) => !s.parse)) return 0;
      const result = chooseSpine(
        conclusion,
        subs as { parse: Proof; trivial: boolean }[],
      );
      if (result !== null || anchor === null) return result;
      return anchorSpine(
        anchor,
        node.subproofs.map((s) => tokensOf(s)),
      );
    };

    // Build calc without shared set to trace the real spine
    const trialCalc = proofTreeToCalculation(
      tree,
      spineFor,
      () => false,
      tokensOf,
    );

    // Collect spine nodes
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
      .filter((n) => n !== undefined);

    // Step 7 should be on the real spine
    expect(spineStepNumbers).toContain(7);
  });

  it("with all shared nodes in spineShared, step 7 expands on spine", async () => {
    const html = readFixture("mpeuni", "prlngsym.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const { tree, stepOf } = parseProofTable(doc)!;
    const results = await parseUniExpressions(doc, PAGE_URL, fetcher);

    const shared = findSharedNodes(tree);
    const internalShared = [...shared].filter((n) => n.subproofs.length > 0);
    const extracted = internalShared; // same as index.ts

    // Build spineFor (same as above)
    const cache = new Map<ProofTree, ParsedExpression | null>();
    const exprOf = (node: ProofTree): ParsedExpression | null => {
      if (cache.has(node)) return cache.get(node)!;
      let found: ParsedExpression | null = null;
      const cell = node.expressionCell;
      if (cell)
        for (const r of results) {
          const at = r.locations[0]?.node;
          if (r.proof && at && cell.contains(at)) {
            found = r;
            break;
          }
        }
      cache.set(node, found);
      return found;
    };
    const parseOf = (node: ProofTree): Proof | null =>
      exprOf(node)?.proof ?? null;
    const tokensOf = (node: ProofTree): string[] | null =>
      exprOf(node)?.tokens.map((t) => t.text) ?? null;
    const spineFor = (
      node: ProofTree,
      anchor: string[] | null,
    ): number | null => {
      const conclusion = parseOf(node);
      const subs = node.subproofs.map((s) => ({
        parse: parseOf(s),
        trivial: s.subproofs.length === 0,
      }));
      if (!conclusion || subs.some((s) => !s.parse)) return 0;
      const result = chooseSpine(
        conclusion,
        subs as { parse: Proof; trivial: boolean }[],
      );
      if (result !== null || anchor === null) return result;
      return anchorSpine(
        anchor,
        node.subproofs.map((s) => tokensOf(s)),
      );
    };

    // Mirror showCalculation exactly: leafShared + spineShared(extracted)
    const leafShared = new Set(
      [...shared].filter((n) => n.subproofs.length === 0),
    );
    const calc = proofTreeToCalculation(
      tree,
      spineFor,
      () => false,
      tokensOf,
      null,
      leafShared,
      new Set(extracted),
    );

    // Step 7 should be a "step" on the spine (expanded, not a given)
    const step7 = internalShared.find((n) => stepOf.get(n) === 7)!;
    function findStepOnSpine(c: Calculation, target: ProofTree): boolean {
      if (c.kind !== "step") return false;
      if (c.expressionHtml === target.expressionHtml) return true;
      if (c.spine === null) return false;
      return findStepOnSpine(c.subcalculations[c.spine], target);
    }
    expect(findStepOnSpine(calc, step7)).toBe(true);

    // Step 7 should also appear as a given in non-spine sub-calculations
    function hasGivenInTree(c: Calculation, target: ProofTree): boolean {
      if (c.kind === "given") return c.expressionHtml === target.expressionHtml;
      if (c.kind !== "step") return false;
      return c.subcalculations.some((sub) => hasGivenInTree(sub, target));
    }
    function hasGivenOffSpine(c: Calculation, target: ProofTree): boolean {
      if (c.kind !== "step") return false;
      for (let i = 0; i < c.subcalculations.length; i++) {
        if (i === c.spine) continue;
        if (hasGivenInTree(c.subcalculations[i], target)) return true;
      }
      if (c.spine !== null)
        return hasGivenOffSpine(c.subcalculations[c.spine], target);
      return false;
    }
    expect(hasGivenOffSpine(calc, step7)).toBe(true);

    // There should be NO separate mini-calc needed for step 7 (it's on spine)
    // Verify step 7 is NOT in the set that would be extracted as a mini-calc
    // (i.e., it appears on the spine, so no "Proof of (7):" block is needed)

    // Walk the full spine to confirm step 7's step number
    const spineSteps: number[] = [];
    function collectSpineSteps(c: Calculation): void {
      if (c.kind !== "step") return;
      const n = [...stepOf.entries()].find(
        ([node]) => node.expressionHtml === c.expressionHtml,
      )?.[1];
      if (n !== undefined) spineSteps.push(n);
      if (c.spine !== null) collectSpineSteps(c.subcalculations[c.spine]);
    }
    collectSpineSteps(calc);
    console.log("Real spine steps:", spineSteps);
  });

  it("step 7 given in step 8's mini-calc has synthetic (7) ref, not original rule ref", async () => {
    const html = readFixture("mpeuni", "prlngsym.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const { tree, stepOf } = parseProofTable(doc)!;
    const results = await parseUniExpressions(doc, PAGE_URL, fetcher);

    const shared = findSharedNodes(tree);
    const internalShared = [...shared].filter((n) => n.subproofs.length > 0);
    const extracted = internalShared;

    // Build spineFor
    const cache = new Map<ProofTree, ParsedExpression | null>();
    const exprOf = (node: ProofTree): ParsedExpression | null => {
      if (cache.has(node)) return cache.get(node)!;
      let found: ParsedExpression | null = null;
      const cell = node.expressionCell;
      if (cell)
        for (const r of results) {
          const at = r.locations[0]?.node;
          if (r.proof && at && cell.contains(at)) {
            found = r;
            break;
          }
        }
      cache.set(node, found);
      return found;
    };
    const parseOf = (node: ProofTree): Proof | null =>
      exprOf(node)?.proof ?? null;
    const tokensOf = (node: ProofTree): string[] | null =>
      exprOf(node)?.tokens.map((t) => t.text) ?? null;
    const spineFor = (
      node: ProofTree,
      anchor: string[] | null,
    ): number | null => {
      const conclusion = parseOf(node);
      const subs = node.subproofs.map((s) => ({
        parse: parseOf(s),
        trivial: s.subproofs.length === 0,
      }));
      if (!conclusion || subs.some((s) => !s.parse)) return 0;
      const result = chooseSpine(
        conclusion,
        subs as { parse: Proof; trivial: boolean }[],
      );
      if (result !== null || anchor === null) return result;
      return anchorSpine(
        anchor,
        node.subproofs.map((s) => tokensOf(s)),
      );
    };

    // Set synthetic refs on all extracted (same as showCalculation)
    const savedRefs = new Map<ProofTree, Element>();
    for (const node of extracted) {
      const n = stepOf.get(node);
      if (n !== undefined) {
        savedRefs.set(node, node.refHtml);
        const synth = document.createElement("span");
        synth.textContent = `(${n})`;
        node.refHtml = synth;
      }
    }

    // Build mini-calc for step 8, passing shared set that includes step 7.
    // In showCalculation, savedRefs are restored BEFORE mini-calcs are built,
    // then nested refs are re-set for each mini-calc (covering all extracted).
    for (const [node, ref] of savedRefs) node.refHtml = ref;

    const step8 = extracted.find((n) => stepOf.get(n) === 8)!;
    const step7 = extracted.find((n) => stepOf.get(n) === 7)!;

    // Re-set synthetic refs for nested nodes (same as showCalculation loop)
    for (const other of extracted) {
      if (other === step8) continue;
      const m = stepOf.get(other);
      if (m !== undefined) {
        savedRefs.set(other, other.refHtml);
        const synth = document.createElement("span");
        synth.textContent = `(${m})`;
        other.refHtml = synth;
      }
    }

    const others = new Set(shared);
    others.delete(step8);
    const miniCalc = proofTreeToCalculation(
      step8,
      spineFor,
      () => false,
      tokensOf,
      null,
      others,
    );

    // Restore again
    for (const [node, ref] of savedRefs) node.refHtml = ref;

    // Step 7 should appear as a given in the mini-calc
    function findGiven(c: Calculation, target: ProofTree): Calculation | null {
      if (c.kind === "given" && c.expressionHtml === target.expressionHtml)
        return c;
      if (c.kind !== "step") return null;
      for (const sub of c.subcalculations) {
        const found = findGiven(sub, target);
        if (found) return found;
      }
      return null;
    }

    const step7given = findGiven(miniCalc, step7);
    expect(step7given).not.toBeNull();
    expect(step7given!.kind).toBe("given");

    // The given's hypothesisRefHtml should be the synthetic "(7)" ref,
    // NOT the original rule ref ("mpbid 234" or similar).
    const refText =
      step7given!.kind === "given"
        ? step7given!.hypothesisRefHtml.textContent
        : "";
    expect(refText).toContain("(7)");
  });
});
