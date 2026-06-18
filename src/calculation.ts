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
}

export interface Step {
  kind: "step";
  inferenceRuleRefHtml: Element;
  expressionHtml: Element;
  subcalculations: Calculation[]; // one per assumption of the inference rule
  // index of the spine subcalculation (the next expression), or null to end the
  // spine (no clear main line) at a `<==> TRUE` terminal; render-only
  spine: number | null;
  // true when this step's transition to its spine child "adds little" (a
  // single-premise, near-identity step): its hint and the continuation
  // expression are deemphasized. Absent (approx. false) otherwise. Render-only.
  smallSpine?: boolean;
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
 * Converts a proof tree to a calculation: a leaf (no subproofs) becomes a given;
 * any other node becomes a `<==` step over its subproofs, in order. `spineFor`
 * picks each step's spine sub-proof (defaulting to the first, `0`); `null` ends
 * the spine. `smallFor` marks a step whose transition adds little (deemphasized);
 * the flag is only attached when true.
 */
export function proofTreeToCalculation(
  tree: ProofTree,
  spineFor: (node: ProofTree) => number | null = () => 0,
  smallFor: (node: ProofTree) => boolean = () => false,
): Calculation {
  if (tree.subproofs.length === 0)
    return {
      kind: "given",
      hypothesisRefHtml: tree.refHtml,
      expressionHtml: tree.expressionHtml,
    };
  const step: Step = {
    kind: "step",
    inferenceRuleRefHtml: tree.refHtml,
    expressionHtml: tree.expressionHtml,
    subcalculations: tree.subproofs.map((s) =>
      proofTreeToCalculation(s, spineFor, smallFor),
    ),
    spine: spineFor(tree),
  };
  if (smallFor(tree)) step.smallSpine = true;
  return step;
}
