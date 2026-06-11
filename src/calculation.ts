// Calculational proof rendering (phase 2) — see DESIGN.md. Initially we model
// only `<==` calculations without any context, so every expression is a full,
// top-level MM statement. evaluateCalculation folds a calculation into the
// kernel Proof it represents, so a test can confirm it reconstructs the proof
// tree the "Proof of Theorem" table shows.

import type { Expression, InferenceRule, Proof } from "./proof";

export type Calculation = Given | Step;

/** A leaf: always a hypothesis (a full MM statement, proved by itself). */
export interface Given {
  kind: "given";
  hypothesis: Expression;
}

/**
 * A `<==` step: the `first` expression follows, via `rule`, from the
 * subcalculations — one for each of the rule's assumptions. The `spine`
 * subcalculation (by index) is the one that starts with the calculation's second
 * expression; the others justify the rule's remaining assumptions.
 */
export interface Step {
  kind: "step";
  first: Expression;
  rule: InferenceRule;
  subcalculations: Calculation[];
  spine: number;
}

/** Composes a calculation into the kernel `Proof` it represents. */
export function evaluateCalculation(calc: Calculation): Proof {
  if (calc.kind === "given") {
    return {
      rule: { assumptions: [], conclusion: calc.hypothesis },
      subst: new Map(),
      subproofs: [],
    };
  }
  return {
    rule: calc.rule,
    subst: new Map(),
    subproofs: calc.subcalculations.map(evaluateCalculation),
  };
}
