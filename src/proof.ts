// The proof kernel. A parse tree IS a proof, exactly as the metamath program
// builds one with `improve all`. See DESIGN.md "Parsing as proof search".

/** An MM expression: a sequence of tokens. */
export type Expression = string[];

/**
 * An inference rule: a set of assumptions and one conclusion. The assumptions
 * are unordered — sub-proofs are matched to them by expression equality.
 */
export interface InferenceRule {
  assumptions: Expression[];
  conclusion: Expression;
}

/** A substitution: variable token → expression to replace it with. */
export type Substitution = Map<string, Expression>;

/**
 * A proof, which doubles as a parse tree:
 * - `hyp` — a leaf, establishing `expr ==> expr`.
 * - `apply` — substitution + application combined: take base rule `rule`, apply
 *   `subst` to get R2, then discharge R2's assumptions with `subproofs`.
 */
export type Proof =
  | { tag: "hyp"; expr: Expression }
  | {
      tag: "apply";
      rule: InferenceRule;
      subst: Substitution;
      subproofs: Proof[];
    };

const key = (expr: Expression): string => expr.join(" ");

function substituteExpr(sub: Substitution, expr: Expression): Expression {
  const out: Expression = [];
  for (const token of expr) {
    const replacement = sub.get(token);
    if (replacement) out.push(...replacement);
    else out.push(token);
  }
  return out;
}

/**
 * Returns a variant of `rule` with every variable replaced per `sub`, all
 * simultaneously. Only tokens that are keys of `sub` are replaced, so no
 * variable-vs-constant predicate is needed here.
 */
export function substitute(
  sub: Substitution,
  rule: InferenceRule,
): InferenceRule {
  return {
    assumptions: rule.assumptions.map((a) => substituteExpr(sub, a)),
    conclusion: substituteExpr(sub, rule.conclusion),
  };
}

/**
 * Evaluates a proof to the inference rule it establishes.
 *
 * - `hyp H` establishes `H ==> H`.
 * - `apply R σ [p1…pn]`: with `R2 = substitute(σ, R)`, the set of the
 *   sub-proofs' conclusions must equal `R2`'s (unordered) assumptions; the
 *   result is the union of the sub-proofs' assumptions ==> `R2`'s conclusion.
 *
 * This is a verification tool for tests — it double-checks a generated parse
 * tree. The runtime uses the Proof tree directly and does not call it.
 */
export function evaluate(proof: Proof): InferenceRule {
  if (proof.tag === "hyp") {
    return { assumptions: [proof.expr], conclusion: proof.expr };
  }
  const rule = substitute(proof.subst, proof.rule);
  const needed = new Set(rule.assumptions.map(key));
  const discharged = new Set<string>();
  const assumptions = new Map<string, Expression>(); // deduped, unordered
  for (const subproof of proof.subproofs) {
    const established = evaluate(subproof);
    const conclusionKey = key(established.conclusion);
    if (!needed.has(conclusionKey)) {
      throw new Error(
        `apply: sub-proof concludes "${conclusionKey}", not an assumption of the rule`,
      );
    }
    discharged.add(conclusionKey);
    for (const a of established.assumptions) assumptions.set(key(a), a);
  }
  if (discharged.size !== needed.size) {
    const missing = [...needed].filter((k) => !discharged.has(k));
    throw new Error(`apply: assumptions not discharged: ${missing.join("; ")}`);
  }
  return {
    assumptions: [...assumptions.values()],
    conclusion: rule.conclusion,
  };
}
