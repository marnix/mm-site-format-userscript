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
    // Shared nodes are accounted for via their mini-calcs.
    if (!shared.has(node) && !mainRefs.has(node.refHtml)) {
      const n = stepOf.get(node);
      if (n !== undefined) missing.push(n);
    }
    for (const sub of node.subproofs) walk(sub);
  };
  walk(tree);
  return missing;
}
