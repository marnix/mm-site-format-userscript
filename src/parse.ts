// Recursive-descent proof search: turns a token sequence into a Proof (= parse
// tree) against a set of inference rules. See DESIGN.md "Parsing as proof
// search". Returns null when no proof exists — the filter for non-expressions.

import type { Expression, InferenceRule, Proof, Substitution } from "./proof";

/** Looks up a token's variable kind, or undefined if it is not a variable. */
export type KindOf = (token: string) => string | undefined;

interface ParseResult {
  proof: Proof;
  next: number; // index one past the last token consumed
}

/**
 * Parses a sub-expression of type `type` starting at `tokens[pos]`, returning
 * the proof and the next position, or null on failure.
 */
export function parse(
  tokens: Expression,
  pos: number,
  type: string,
  rules: InferenceRule[],
  kindOf: KindOf,
): ParseResult | null {
  // Leaf: a single variable whose kind is the target type.
  const token = tokens[pos];
  if (token !== undefined && kindOf(token) === type) {
    return {
      proof: {
        rule: { assumptions: [], conclusion: [type, token] },
        subst: new Map(),
        subproofs: [],
      },
      next: pos + 1,
    };
  }

  // Otherwise try each rule that produces this type, first match wins.
  for (const rule of rules) {
    if (rule.conclusion[0] !== type) continue;
    const matched = matchPattern(
      rule.conclusion.slice(1),
      tokens,
      pos,
      rules,
      kindOf,
    );
    if (matched) {
      return {
        proof: { rule, subst: matched.subst, subproofs: matched.subproofs },
        next: matched.next,
      };
    }
  }
  return null;
}

/**
 * Parses a complete expression of `type`; returns the proof only if it consumes
 * every token, else null.
 */
export function parseExpression(
  tokens: Expression,
  type: string,
  rules: InferenceRule[],
  kindOf: KindOf,
): Proof | null {
  const result = parse(tokens, 0, type, rules, kindOf);
  return result && result.next === tokens.length ? result.proof : null;
}

interface Match {
  subst: Substitution;
  subproofs: Proof[];
  next: number;
}

function matchPattern(
  pattern: Expression,
  tokens: Expression,
  pos: number,
  rules: InferenceRule[],
  kindOf: KindOf,
): Match | null {
  const subst: Substitution = new Map();
  const subproofs: Proof[] = [];
  let p = pos;
  for (const patternToken of pattern) {
    const holeKind = kindOf(patternToken);
    if (holeKind === undefined) {
      // Literal constant: must match exactly.
      if (tokens[p] !== patternToken) return null;
      p += 1;
      continue;
    }
    // Hole: parse a sub-expression of the hole's kind.
    const sub = parse(tokens, p, holeKind, rules, kindOf);
    if (!sub) return null;
    const consumed = tokens.slice(p, sub.next);
    const existing = subst.get(patternToken);
    if (existing) {
      // Repeated variable: the two occurrences must consume the same expression.
      if (existing.join(" ") !== consumed.join(" ")) return null;
    } else {
      subst.set(patternToken, consumed);
      subproofs.push(sub.proof);
    }
    p = sub.next;
  }
  return { subst, subproofs, next: p };
}
