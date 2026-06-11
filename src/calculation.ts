// Calculational proof rendering (phase 2) — see DESIGN.md. For now this is kept
// independent of the parse kernel (InferenceRule/Proof): a proof tree and a
// calculation are purely structural and carry the page's own Ref-column HTML, so
// rendering can later copy it into the new place on the page.

/**
 * A proof tree built from the "Proof of Theorem" table. Each node carries the
 * Ref column's HTML exactly, and one subproof per Hyp entry, in order;
 * hypotheses (no Hyp entries) have no subproofs.
 */
export interface ProofTree {
  refHtml: Element;
  subproofs: ProofTree[];
}

/**
 * Initially only `<==` calculations, without any context — every expression is
 * a full, top-level MM statement. A calculation is either a given (always a
 * hypothesis) or a `<==` step. Both carry Ref-column HTML rather than an
 * inference rule.
 */
export type Calculation = Given | Step;

export interface Given {
  kind: "given";
  hypothesisRefHtml: Element;
}

export interface Step {
  kind: "step";
  inferenceRuleRefHtml: Element;
  subcalculations: Calculation[]; // one per assumption of the inference rule
  spine: number; // index of the spine subcalculation (the second expression); render-only
}

/** Composes a calculation into the proof tree it represents. */
export function evaluateCalculation(calc: Calculation): ProofTree {
  if (calc.kind === "given")
    return { refHtml: calc.hypothesisRefHtml, subproofs: [] };
  return {
    refHtml: calc.inferenceRuleRefHtml,
    subproofs: calc.subcalculations.map(evaluateCalculation),
  };
}

/**
 * The simplest proof-tree → calculation conversion: replicate the tree, with
 * `spine = 0` everywhere. A leaf (no subproofs) becomes a given; any other node
 * becomes a `<==` step over its subproofs, in order.
 */
export function proofTreeToCalculation(tree: ProofTree): Calculation {
  if (tree.subproofs.length === 0)
    return { kind: "given", hypothesisRefHtml: tree.refHtml };
  return {
    kind: "step",
    inferenceRuleRefHtml: tree.refHtml,
    subcalculations: tree.subproofs.map(proofTreeToCalculation),
    spine: 0,
  };
}
