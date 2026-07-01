// @vitest-environment happy-dom
//
// Integration tests for prlngsym.html shared-step handling. Covers both basic
// detection (fast, no parsing) and the real spine chooser (parse-tree-based).

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

/** Builds the real spineFor/tokensOf from parsed results (same logic as index.ts). */
function buildChoosers(results: ParsedExpression[]) {
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
  return { spineFor, tokensOf };
}

/** Walks a calc+tree in parallel collecting spine ProofTree nodes. */
function collectSpineNodes(c: Calculation, t: ProofTree): Set<ProofTree> {
  const nodes = new Set<ProofTree>();
  let calc = c;
  let tree = t;
  while (calc.kind === "step" && calc.spine !== null) {
    tree = tree.subproofs[calc.spine];
    nodes.add(tree);
    calc = calc.subcalculations[calc.spine];
  }
  return nodes;
}

describe("prlngsym shared step detection", () => {
  it("steps 7 and 8 are detected as shared internal nodes", () => {
    const html = readFixture("mpeuni", "prlngsym.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const { tree, stepOf } = parseProofTable(doc)!;
    const shared = findSharedNodes(tree);
    const internalShared = [...shared].filter((n) => n.subproofs.length > 0);
    const numbers = internalShared.map((n) => stepOf.get(n)).sort();
    expect(numbers).toContain(7);
    expect(numbers).toContain(8);
  });
});

describe("prlngsym with real spine chooser", { timeout: 30_000 }, () => {
  it("real spine passes through step 7; spineShared expands it there and gives it off-spine", async () => {
    const html = readFixture("mpeuni", "prlngsym.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const { tree, stepOf } = parseProofTable(doc)!;
    const results = await parseUniExpressions(doc, PAGE_URL, fetcher);
    const { spineFor, tokensOf } = buildChoosers(results);

    const shared = findSharedNodes(tree);
    const internalShared = [...shared].filter((n) => n.subproofs.length > 0);

    // Build with spineShared (same as showCalculation)
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
      new Set(internalShared),
    );

    // Step 7 is on the spine
    const spineNodes = collectSpineNodes(calc, tree);
    expect([...spineNodes].map((n) => stepOf.get(n))).toContain(7);

    // Step 7 is a "step" on the spine (expanded, not a given)
    const step7 = internalShared.find((n) => stepOf.get(n) === 7)!;
    function findStepOnSpine(c: Calculation, target: ProofTree): boolean {
      if (c.kind !== "step") return false;
      if (c.expressionHtml === target.expressionHtml) return true;
      if (c.spine === null) return false;
      return findStepOnSpine(c.subcalculations[c.spine], target);
    }
    expect(findStepOnSpine(calc, step7)).toBe(true);

    // Step 7 also appears as a given in a non-spine sub-calculation
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
  });

  it("step 7 given in step 8's mini-calc has synthetic (7) ref", async () => {
    const html = readFixture("mpeuni", "prlngsym.html");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const { tree, stepOf } = parseProofTable(doc)!;
    const results = await parseUniExpressions(doc, PAGE_URL, fetcher);
    const { spineFor, tokensOf } = buildChoosers(results);

    const shared = findSharedNodes(tree);
    const internalShared = [...shared].filter((n) => n.subproofs.length > 0);
    const step8 = internalShared.find((n) => stepOf.get(n) === 8)!;
    const step7 = internalShared.find((n) => stepOf.get(n) === 7)!;

    // Set synthetic ref on step 7 (as showCalculation's nested-ref loop does)
    const origRef = step7.refHtml;
    const synth = document.createElement("span");
    synth.textContent = "(7)";
    step7.refHtml = synth;

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

    step7.refHtml = origRef; // restore

    // Step 7 appears as a given with the synthetic ref
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
    const refText =
      step7given!.kind === "given"
        ? step7given!.hypothesisRefHtml.textContent
        : "";
    expect(refText).toContain("(7)");
  });
});
