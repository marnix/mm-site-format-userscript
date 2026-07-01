// Recursive-descent proof search: turns a token sequence into a Proof (= parse
// tree) against a set of inference rules. See DESIGN.md "Parsing as proof
// search". Returns null when no proof exists -- the filter for non-expressions.
//
// The search is memoised (packrat): each (position, type) is parsed at most
// once, so deeply-nested or dense expressions parse in polynomial time instead
// of re-parsing shared sub-spans exponentially. A re-entrancy guard also stops a
// same-position/same-type recursion (left recursion) from looping.

import type { Expression, InferenceRule, Proof, Substitution } from "./proof";

/** Looks up a token's variable kind, or undefined if it is not a variable. */
export type KindOf = (token: string) => string | undefined;

interface ParseResult {
  proof: Proof;
  next: number; // index one past the last token consumed
}

interface Match {
  subst: Substitution;
  subproofs: Proof[];
  next: number;
}

/** A memoised parser over one fixed token sequence, rules, and kind lookup. */
function makeParser(
  tokens: Expression,
  rules: InferenceRule[],
  kindOf: KindOf,
): (pos: number, type: string) => ParseResult | null {
  const memo = new Map<string, ParseResult | null>();
  const active = new Set<string>();

  const parse = (pos: number, type: string): ParseResult | null => {
    const key = `${pos}\0${type}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    if (active.has(key)) return null; // re-entrant (left recursion): give up
    active.add(key);
    const result = compute(pos, type);
    active.delete(key);
    memo.set(key, result);
    return result;
  };

  const compute = (pos: number, type: string): ParseResult | null => {
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
      const matched = matchPattern(rule.conclusion.slice(1), pos);
      if (matched) {
        return {
          proof: { rule, subst: matched.subst, subproofs: matched.subproofs },
          next: matched.next,
        };
      }
    }
    return null;
  };

  const matchPattern = (pattern: Expression, pos: number): Match | null => {
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
      const sub = parse(p, holeKind);
      if (!sub) return null;
      const consumed = tokens.slice(p, sub.next);
      const existing = subst.get(patternToken);
      if (existing) {
        // Repeated variable: both occurrences must consume the same expression.
        if (
          existing.length !== consumed.length ||
          existing.some((t, j) => t !== consumed[j])
        )
          return null;
      } else {
        subst.set(patternToken, consumed);
        subproofs.push(sub.proof);
      }
      p = sub.next;
    }
    return { subst, subproofs, next: p };
  };

  return parse;
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
  return makeParser(tokens, rules, kindOf)(pos, type);
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
  const result = makeParser(tokens, rules, kindOf)(0, type);
  return result && result.next === tokens.length ? result.proof : null;
}
