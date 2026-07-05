// Calculational proof rendering. For now this is kept
// independent of the parse kernel (InferenceRule/Proof): a proof tree and a
// calculation are purely structural and carry the page's own HTML (the Ref
// column and the Expression column), so rendering can copy it into the new place
// on the page.

/**
 * A proof tree built from the "Proof of Theorem" table. Each node carries the
 * Ref column's HTML and the Expression column's HTML (with the leading
 * indentation stripped), and one subproof per Hyp entry, in order; hypotheses
 * (no Hyp entries) have no subproofs.
 */
export interface ProofTree {
  refHtml: Element;
  expressionHtml: Element;
  subproofs: ProofTree[];
  /** The original Expression cell on the page (not the stripped clone), so the
   *  node can be matched to its parsed expression for spine selection. */
  expressionCell?: Element;
}

/**
 * Initially only `<==` calculations, without any context -- every expression is
 * a full, top-level MM statement. A calculation is either a given (always a
 * hypothesis) or a `<==` step. Both carry the Ref-column HTML and the
 * Expression-column HTML, rather than an inference rule.
 */
export type Calculation = Given | Step;

export interface Given {
  kind: "given";
  hypothesisRefHtml: Element;
  expressionHtml: Element;
  // When this given was folded from a depth-1 step (a single rule application
  // on leaves), these are the leaf hypothesis refs. The renderer includes them
  // as additional items in the parent's hint series alongside hypothesisRefHtml.
  leafRefHtmls?: Element[];
  // Parallel to leafRefHtmls: the expression of each leaf hypothesis, used for
  // tooltips on page-internal (#) refs where the expression cannot be fetched.
  leafExpressionHtmls?: Element[];
}

export interface Step {
  kind: "step";
  inferenceRuleRefHtml: Element;
  expressionHtml: Element;
  subcalculations: Calculation[]; // one per assumption of the inference rule
  // index of the spine subcalculation (the next expression), or null to end the
  // spine (no clear main line) at a `<==> TRUE` terminal; render-only
  spine: number | null;
  // Rule refs folded into this step's hint from small spine continuations
  // (single-premise near-identity steps like definitional unfoldings). Built by
  // proofTreeToCalculation; the renderer appends them as "; using X" in the hint.
  foldedRuleRefs?: Element[];
}

/** Composes a calculation into the proof tree it represents. */
export function evaluateCalculation(calc: Calculation): ProofTree {
  if (calc.kind === "given")
    return {
      refHtml: calc.hypothesisRefHtml,
      expressionHtml: calc.expressionHtml,
      subproofs: [],
    };
  return {
    refHtml: calc.inferenceRuleRefHtml,
    expressionHtml: calc.expressionHtml,
    subproofs: calc.subcalculations.map(evaluateCalculation),
  };
}

/**
 * Finds nodes in the proof DAG that are referenced by more than one parent.
 * These are candidates for extraction as separate mini-calculations.
 */
export function findSharedNodes(root: ProofTree): Set<ProofTree> {
  const seen = new Set<ProofTree>();
  const shared = new Set<ProofTree>();
  function walk(node: ProofTree): void {
    if (seen.has(node)) {
      shared.add(node);
      return; // don't recurse again
    }
    seen.add(node);
    for (const child of node.subproofs) walk(child);
  }
  walk(root);
  return shared;
}

/**
 * Converts a proof tree to a calculation: a leaf (no subproofs) becomes a given;
 * any other node becomes a `<==` step over its subproofs, in order. `spineFor`
 * picks each step's spine sub-proof (defaulting to the first, `0`); `null` ends
 * the spine. `smallFor` marks a step whose transition adds little (deemphasized);
 * the flag is only attached when true.
 *
 * Nodes in the `shared` set are treated as givens (leaf references) rather than
 * being expanded inline -- their derivation is rendered separately.
 *
 * Nodes in `spineShared` are treated as givens only in non-spine branches; on
 * the spine itself they expand normally (with their full sub-derivation).
 */
export function proofTreeToCalculation(
  tree: ProofTree,
  spineFor: (node: ProofTree, anchor: string[] | null) => number | null = () =>
    0,
  smallFor: (node: ProofTree) => boolean = () => false,
  tokensFor: (node: ProofTree) => string[] | null = () => null,
  anchor: string[] | null = null,
  shared: Set<ProofTree> = new Set(),
  spineShared: Set<ProofTree> = new Set(),
  isChild = false,
): Calculation {
  if (tree.subproofs.length === 0 || shared.has(tree))
    return {
      kind: "given",
      hypothesisRefHtml: tree.refHtml,
      get expressionHtml() {
        return tree.expressionHtml;
      },
    };
  // Depth-1: a single rule application on all-leaf children. Fold into a given
  // that carries the leaf refs alongside its own rule ref. Only when this node
  // is a child of another step (not the root of the calculation).
  if (isChild && tree.subproofs.every((s) => s.subproofs.length === 0))
    return {
      kind: "given",
      hypothesisRefHtml: tree.refHtml,
      get expressionHtml() {
        return tree.expressionHtml;
      },
      leafRefHtmls: tree.subproofs.map((s) => s.refHtml),
    };
  const spineIndex = spineFor(tree, anchor);
  const nextAnchor = tokensFor(tree);
  const step: Step = {
    kind: "step",
    inferenceRuleRefHtml: tree.refHtml,
    get expressionHtml() {
      return tree.expressionHtml;
    },
    subcalculations: tree.subproofs.map((s, i) => {
      // On the spine: spineShared nodes expand normally.
      // Off the spine: spineShared nodes are treated as givens (like shared).
      const effectiveShared =
        i === spineIndex ? shared : new Set([...shared, ...spineShared]);
      return proofTreeToCalculation(
        s,
        spineFor,
        smallFor,
        tokensFor,
        i === spineIndex ? nextAnchor : null,
        effectiveShared,
        spineShared,
        i !== spineIndex, // only off-spine children can fold to givens
      );
    }),
    spine: spineIndex,
  };
  // Fold small spine continuations: walk the TREE spine (not the built
  // Calculation) collecting small steps' rule refs before their subcalculations
  // are built, so we don't conflict with child-level folding.
  // The step's spine + subcalculations are then rebuilt pointing to the
  // effective (non-small) continuation.
  const foldedRefs: Element[] = [];
  let foldNode = spineIndex !== null ? tree.subproofs[spineIndex] : null;
  while (foldNode && smallFor(foldNode)) {
    foldedRefs.push(foldNode.refHtml);
    // Advance to the small step's own spine child (always index 0 for
    // single-premise steps).
    if (foldNode.subproofs.length !== 1) break;
    foldNode = foldNode.subproofs[0];
  }
  if (foldedRefs.length > 0) {
    step.foldedRuleRefs = foldedRefs;
    // Rebuild the spine subcalculation from the effective (non-small) node.
    if (spineIndex !== null && foldNode) {
      const effectiveShared = new Set([...shared]);
      step.subcalculations[spineIndex] = proofTreeToCalculation(
        foldNode,
        spineFor,
        smallFor,
        tokensFor,
        nextAnchor,
        effectiveShared,
        spineShared,
        false, // spine continuation: must not fold to given
      );
    }
  }
  return step;
}

/**
 * Collects all ref Elements that appear in a Calculation (recursively).
 * These are the refs that end up in hints when rendered.
 */
export function collectCalcRefs(calc: Calculation): Set<Element> {
  const refs = new Set<Element>();
  const walk = (c: Calculation) => {
    if (c.kind === "given") {
      refs.add(c.hypothesisRefHtml);
      for (const leaf of c.leafRefHtmls ?? []) refs.add(leaf);
    } else {
      refs.add(c.inferenceRuleRefHtml);
      for (const folded of c.foldedRuleRefs ?? []) refs.add(folded);
      for (const sub of c.subcalculations) walk(sub);
    }
  };
  walk(calc);
  return refs;
}

/**
 * Self-check: verifies that every step in the proof tree has its refHtml appear
 * somewhere in the calculation(s), or is accounted for as a shared node (which
 * will get its own mini-calc). Returns the step numbers of any steps whose refs
 * are missing (empty array = all good).
 */
export function missingCalcRefs(
  tree: ProofTree,
  stepOf: Map<ProofTree, number>,
  mainCalc: Calculation,
  shared: Set<ProofTree>,
): number[] {
  const mainRefs = collectCalcRefs(mainCalc);
  const missing: number[] = [];
  const visited = new Set<ProofTree>();
  const walk = (node: ProofTree) => {
    if (visited.has(node)) return;
    visited.add(node);
    if (shared.has(node)) {
      // Shared nodes are accounted for via their mini-calcs; their descendants
      // are covered by the mini-calc and don't need to appear in the main calc.
      return;
    }
    if (!mainRefs.has(node.refHtml)) {
      const n = stepOf.get(node);
      if (n !== undefined) missing.push(n);
    }
    for (const sub of node.subproofs) walk(sub);
  };
  walk(tree);
  return missing;
}

/**
 * Self-check: the spine forms a valid terminating path. Each step's spine index
 * must be in-bounds for its subcalculations, and the chain must terminate at
 * either a given or a null spine (=> TRUE). Returns an error message or null.
 */
export function checkSpineValidity(calc: Calculation): string | null {
  const walk = (c: Calculation, depth: number): string | null => {
    if (depth > 10000) return "spine depth exceeds 10000 (likely cycle)";
    if (c.kind === "given") return null; // valid termination
    if (c.spine === null) return null; // valid termination (=> TRUE)
    if (c.spine < 0 || c.spine >= c.subcalculations.length)
      return `spine index ${c.spine} out of bounds (${c.subcalculations.length} subcalculations)`;
    // Check all non-spine subcalculations recursively too.
    for (let i = 0; i < c.subcalculations.length; i++) {
      if (i === c.spine) continue;
      const sub = c.subcalculations[i];
      if (sub.kind === "step") {
        const err = walk(sub, 0);
        if (err) return `in subcalc ${i}: ${err}`;
      }
    }
    return walk(c.subcalculations[c.spine], depth + 1);
  };
  return walk(calc, 0);
}

/**
 * Collects all expressionHtml Elements in a Calculation (recursively).
 */
export function collectCalcExpressions(calc: Calculation): Set<Element> {
  const exprs = new Set<Element>();
  const walk = (c: Calculation) => {
    exprs.add(c.expressionHtml);
    if (c.kind === "step") {
      for (const sub of c.subcalculations) walk(sub);
    }
  };
  walk(calc);
  return exprs;
}

/**
 * Self-check: every step in the proof tree has its expressionHtml appear in the
 * calculation or is inside a shared subtree (covered by mini-calcs) or is a
 * leaf folded into a depth-1 given (expression only in tooltip). Returns the
 * step numbers of steps whose expressions are missing.
 */
export function missingCalcExpressions(
  tree: ProofTree,
  stepOf: Map<ProofTree, number>,
  mainCalc: Calculation,
  shared: Set<ProofTree>,
): number[] {
  const exprs = collectCalcExpressions(mainCalc);
  // Collect refs that were small-step folded (their expressions are omitted).
  const foldedRefs = new Set<Element>();
  const collectFolded = (c: Calculation) => {
    if (c.kind === "step") {
      for (const ref of c.foldedRuleRefs ?? []) foldedRefs.add(ref);
      for (const sub of c.subcalculations) collectFolded(sub);
    }
  };
  collectFolded(mainCalc);

  const missing: number[] = [];
  const visited = new Set<ProofTree>();
  const walk = (node: ProofTree, parentIsDepth1: boolean) => {
    if (visited.has(node)) return;
    visited.add(node);
    if (shared.has(node)) return; // covered by mini-calc
    // Leaves of depth-1 parents are folded into leafRefHtmls (no expression).
    if (parentIsDepth1 && node.subproofs.length === 0) return;
    // Small-step folded nodes have their expression omitted intentionally.
    if (foldedRefs.has(node.refHtml)) return;
    if (!exprs.has(node.expressionHtml)) {
      const n = stepOf.get(node);
      if (n !== undefined) missing.push(n);
    }
    const isDepth1 =
      node.subproofs.length > 0 &&
      node.subproofs.every((s) => s.subproofs.length === 0);
    for (const sub of node.subproofs) walk(sub, isDepth1);
  };
  walk(tree, false);
  return missing;
}

/**
 * Self-check: for each shared (extracted) node, verifies that building a
 * mini-calc from it covers all its descendants' refs and expressions. Returns
 * step numbers of any nodes inside shared subtrees that would be missing.
 */
export function checkSharedSubtreeCoverage(
  shared: Set<ProofTree>,
  stepOf: Map<ProofTree, number>,
  spineFor: (node: ProofTree, anchor: string[] | null) => number | null,
  smallFor: (node: ProofTree) => boolean,
): number[] {
  const missing: number[] = [];
  for (const node of shared) {
    // Only check internal shared nodes (not leaves).
    if (node.subproofs.length === 0) continue;
    // Build the mini-calc the same way showCalculation would.
    const others = new Set(shared);
    others.delete(node);
    const miniCalc = proofTreeToCalculation(
      node,
      spineFor,
      smallFor,
      () => null,
      null,
      others,
      new Set(),
      false,
    );
    const refs = collectCalcRefs(miniCalc);
    const exprs = collectCalcExpressions(miniCalc);
    // Collect folded rule refs (their expressions are intentionally omitted).
    const foldedRefs = new Set<Element>();
    const collectFolded = (c: Calculation) => {
      if (c.kind === "step") {
        for (const ref of c.foldedRuleRefs ?? []) foldedRefs.add(ref);
        for (const sub of c.subcalculations) collectFolded(sub);
      }
    };
    collectFolded(miniCalc);
    // Walk the subtree; descendants in `others` (nested shared) are skipped.
    const visited = new Set<ProofTree>();
    const walk = (n: ProofTree, parentIsDepth1: boolean) => {
      if (visited.has(n)) return;
      visited.add(n);
      if (others.has(n)) return; // covered by its own mini-calc
      // Small-step folded nodes: ref is in foldedRuleRefs, expression omitted.
      if (foldedRefs.has(n.refHtml)) {
        // Still walk children (they're part of the rebuilt continuation).
        for (const sub of n.subproofs) walk(sub, false);
        return;
      }
      if (!refs.has(n.refHtml)) {
        const s = stepOf.get(n);
        if (s !== undefined) missing.push(s);
      } else if (
        !exprs.has(n.expressionHtml) &&
        !(parentIsDepth1 && n.subproofs.length === 0)
      ) {
        const s = stepOf.get(n);
        if (s !== undefined) missing.push(s);
      }
      const isDepth1 =
        n.subproofs.length > 0 &&
        n.subproofs.every((sub) => sub.subproofs.length === 0);
      for (const sub of n.subproofs) walk(sub, isDepth1);
    };
    walk(node, false);
  }
  return missing;
}

/**
 * Self-check: every Step's inferenceRuleRefHtml in the calculation corresponds
 * to the refHtml of the ProofTree node at that position. Detects accidental ref
 * swaps from the savedRefs patching logic. Returns step numbers where the rule
 * ref doesn't match any tree node's ref.
 */
export function checkRuleRefIntegrity(
  tree: ProofTree,
  stepOf: Map<ProofTree, number>,
  mainCalc: Calculation,
  shared: Set<ProofTree>,
): number[] {
  // Collect all refHtml elements from the tree (the set of valid refs).
  const allTreeRefs = new Set<Element>();
  const visited = new Set<ProofTree>();
  const collectTreeRefs = (node: ProofTree) => {
    if (visited.has(node)) return;
    visited.add(node);
    allTreeRefs.add(node.refHtml);
    for (const sub of node.subproofs) collectTreeRefs(sub);
  };
  collectTreeRefs(tree);

  // Walk the calculation; every inferenceRuleRefHtml and hypothesisRefHtml
  // should be a valid tree ref or a synthetic "(N)" link (which contains an
  // anchor with href starting with #mm-site-format-proof-).
  const isSynthetic = (el: Element) =>
    !!el.querySelector('a[href^="#mm-site-format-proof-"]');
  const bad: number[] = [];
  const walkCalc = (c: Calculation) => {
    if (c.kind === "given") {
      if (
        !allTreeRefs.has(c.hypothesisRefHtml) &&
        !isSynthetic(c.hypothesisRefHtml)
      ) {
        // Find which step this ref belongs to (by matching expressionHtml)
        for (const [node, n] of stepOf) {
          if (node.expressionHtml === c.expressionHtml) {
            bad.push(n);
            break;
          }
        }
      }
    } else {
      if (
        !allTreeRefs.has(c.inferenceRuleRefHtml) &&
        !isSynthetic(c.inferenceRuleRefHtml)
      ) {
        for (const [node, n] of stepOf) {
          if (node.expressionHtml === c.expressionHtml) {
            bad.push(n);
            break;
          }
        }
      }
      for (const sub of c.subcalculations) walkCalc(sub);
    }
  };
  walkCalc(mainCalc);
  return bad;
}

/**
 * Self-check: no step appears both as an inline given (in a hint) AND as an
 * expanded sub-derivation (a nested step subcalculation) within the same parent.
 * Returns step numbers of any duplicates found.
 */
export function checkNoDuplicateAppearance(
  mainCalc: Calculation,
  stepOf: Map<ProofTree, number>,
): number[] {
  const duplicates: number[] = [];
  const walkCalc = (c: Calculation) => {
    if (c.kind !== "step") return;
    // Collect refs that appear as givens in this step's hint.
    const givenRefs = new Set<Element>();
    // Collect refs that appear as step subcalculations.
    const stepRefs = new Set<Element>();
    for (let i = 0; i < c.subcalculations.length; i++) {
      if (i === c.spine) continue;
      const sub = c.subcalculations[i];
      if (sub.kind === "given") givenRefs.add(sub.hypothesisRefHtml);
      else stepRefs.add(sub.inferenceRuleRefHtml);
    }
    // Check for overlap.
    for (const ref of givenRefs) {
      if (stepRefs.has(ref)) {
        for (const [node, n] of stepOf) {
          if (node.refHtml === ref) {
            duplicates.push(n);
            break;
          }
        }
      }
    }
    // Recurse into subcalculations.
    for (const sub of c.subcalculations) walkCalc(sub);
  };
  walkCalc(mainCalc);
  return duplicates;
}

/**
 * Self-check: step count conservation. The total number of unique ProofTree
 * nodes should equal the number of nodes accounted for in the main calc plus
 * those inside shared subtrees. Returns step numbers of any orphans (nodes not
 * reached by either path) or a negative count if there are duplicates.
 */
export function checkStepCountConservation(
  tree: ProofTree,
  stepOf: Map<ProofTree, number>,
  mainCalc: Calculation,
  shared: Set<ProofTree>,
): number[] {
  // Count all unique nodes in the tree.
  const allNodes = new Set<ProofTree>();
  const collectAll = (node: ProofTree) => {
    if (allNodes.has(node)) return;
    allNodes.add(node);
    for (const sub of node.subproofs) collectAll(sub);
  };
  collectAll(tree);

  // Count nodes accounted for: main calc refs + expressions, and shared subtrees.
  const mainRefs = collectCalcRefs(mainCalc);
  const mainExprs = collectCalcExpressions(mainCalc);
  const accounted = new Set<ProofTree>();
  for (const node of allNodes) {
    if (shared.has(node)) {
      // Shared node and all its exclusive descendants are covered.
      const markShared = (n: ProofTree) => {
        if (accounted.has(n)) return;
        accounted.add(n);
        for (const sub of n.subproofs) markShared(sub);
      };
      markShared(node);
    } else if (
      mainRefs.has(node.refHtml) ||
      mainExprs.has(node.expressionHtml)
    ) {
      accounted.add(node);
    }
  }

  const orphans: number[] = [];
  for (const node of allNodes) {
    if (!accounted.has(node)) {
      const n = stepOf.get(node);
      if (n !== undefined) orphans.push(n);
    }
  }
  return orphans;
}
