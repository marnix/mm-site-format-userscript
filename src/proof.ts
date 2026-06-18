// The proof kernel. A parse tree IS a proof, exactly as the metamath program
// builds one with `improve all`.

/** An MM expression: a sequence of tokens. */
export type Expression = string[];

/**
 * An inference rule: a set of assumptions and one conclusion. The assumptions
 * are unordered -- sub-proofs are matched to them by expression equality. As a
 * grammar rule, the conclusion's first token is the rule's *result type* and the
 * rest is the *pattern* matched against an expression (see parse.ts); a variable
 * is recognised via the page's kind registry, not by anything stored here.
 */
export interface InferenceRule {
  assumptions: Expression[];
  conclusion: Expression;
  /** For a grammar rule, the syntax-definition label it came from (e.g. `wcel`),
   *  so a parse tree records which constructors it used. Absent on the built-in
   *  `$TOP` rule and on variable-typing leaves. */
  label?: string;
}

/** A substitution: variable token -> expression to replace it with. */
export type Substitution = Map<string, Expression>;

/**
 * A proof, which doubles as a parse tree: substitution + application combined.
 * Take base `rule`, apply `subst` to get R2 = substitute(subst, rule), then
 * discharge R2's assumptions with `subproofs`. A leaf is the degenerate case --
 * a zero-assumption rule (a variable's kind-typing, `() ==> wff ph`) with no
 * sub-proofs.
 */
export interface Proof {
  rule: InferenceRule;
  subst: Substitution;
  subproofs: Proof[];
}

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
 * Evaluates a proof to the inference rule it establishes. With
 * `R2 = substitute(subst, rule)`, the set of the sub-proofs' conclusions must
 * equal `R2`'s (unordered) assumptions; the result is the union of the
 * sub-proofs' assumptions ==> `R2`'s conclusion. A leaf (no sub-proofs, a
 * zero-assumption rule) just yields that rule.
 *
 * This is a verification tool for tests -- it double-checks a generated parse
 * tree. The runtime uses the Proof tree directly and does not call it.
 */
export function evaluate(proof: Proof): InferenceRule {
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
