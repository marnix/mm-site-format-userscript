// Recursive-descent proof search: turns a token sequence into a Proof (= parse
// tree) against a set of inference rules. See DESIGN.md "Parsing as proof
// search". Returns null when no proof exists -- the filter for non-expressions.
//
// The search is memoised (packrat): each (position, type) is parsed at most
// once, so deeply-nested or dense expressions parse in polynomial time instead
// of re-parsing shared sub-spans exponentially. A re-entrancy guard also stops a
// same-position/same-type recursion (left recursion) from looping.

import type { Expression, InferenceRule, Proof, Substitution } from "./proof";
import type { Chunk } from "./token";

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

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Computes the conclusion of a proof node by substituting into the rule's
 * conclusion. Does NOT recurse into sub-proofs (unlike evaluate in proof.ts).
 * Used by the chunk parser to derive the correct token array for a sub-
 * expression's substitution value, ensuring consistency with evaluate().
 */
function proofConclusion(proof: Proof): Expression {
  const out: Expression = [];
  for (const token of proof.rule.conclusion) {
    const replacement = proof.subst.get(token);
    if (replacement) out.push(...replacement);
    else out.push(token);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chunk-based parser: operates on a stream of typed variable chunks and raw
// text chunks (which may contain multiple concatenated MM constants). Matches
// literal constants directly against the text at the current offset -- no
// pre-splitting of paren/brace boundaries needed. The packrat memoisation key
// is (chunkIndex, charOffset, type).
// ---------------------------------------------------------------------------

/** Position in the chunk stream. */
interface Pos {
  chunk: number;
  offset: number;
}

interface ChunkParseResult {
  proof: Proof;
  next: Pos;
}

interface ChunkMatch {
  subst: Substitution;
  subproofs: Proof[];
  next: Pos;
}

function posKey(pos: Pos): string {
  return `${pos.chunk}:${pos.offset}`;
}

/** Advances past whitespace in text chunks. */
function skipWs(chunks: Chunk[], pos: Pos): Pos {
  let { chunk, offset } = pos;
  while (chunk < chunks.length) {
    const c = chunks[chunk];
    if (c.kind !== null) break;
    while (offset < c.text.length && /\s/.test(c.text[offset])) offset++;
    if (offset < c.text.length) break;
    chunk++;
    offset = 0;
  }
  return { chunk, offset };
}

function atEnd(chunks: Chunk[], pos: Pos): boolean {
  return pos.chunk >= chunks.length;
}

function makeChunkParser(
  chunks: Chunk[],
  rules: InferenceRule[],
  kindOf: KindOf,
): (pos: Pos, type: string) => ChunkParseResult | null {
  const memo = new Map<string, ChunkParseResult | null>();
  const active = new Set<string>();

  const parse = (pos: Pos, type: string): ChunkParseResult | null => {
    pos = skipWs(chunks, pos);
    const key = `${posKey(pos)}\0${type}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    if (active.has(key)) return null;
    active.add(key);
    const result = compute(pos, type);
    active.delete(key);
    memo.set(key, result);
    return result;
  };

  const compute = (pos: Pos, type: string): ChunkParseResult | null => {
    if (atEnd(chunks, pos)) return null;
    const c = chunks[pos.chunk];

    // Leaf: a variable chunk whose kind matches the target type.
    if (c.kind !== null && pos.offset === 0 && c.kind === type) {
      return {
        proof: {
          rule: { assumptions: [], conclusion: [type, c.text] },
          subst: new Map(),
          subproofs: [],
        },
        next: { chunk: pos.chunk + 1, offset: 0 },
      };
    }

    // Leaf: a text-chunk variable (for syntax-definition pages where variables
    // appear as plain text with kind from the registry, not in their own span).
    if (c.kind === null) {
      const rest = c.text.slice(pos.offset);
      // Try longest prefix that is a known variable of the right kind.
      // Variables on syntax pages are single whitespace-delimited words.
      const wordEnd = rest.search(/\s|$/);
      const word = rest.slice(0, wordEnd || rest.length);
      if (word && kindOf(word) === type) {
        const nextOffset = pos.offset + word.length;
        const next =
          nextOffset >= c.text.length
            ? { chunk: pos.chunk + 1, offset: 0 }
            : { chunk: pos.chunk, offset: nextOffset };
        return {
          proof: {
            rule: { assumptions: [], conclusion: [type, word] },
            subst: new Map(),
            subproofs: [],
          },
          next,
        };
      }
    }

    // Try each rule that produces this type.
    for (const rule of rules) {
      if (rule.conclusion[0] !== type) continue;
      const matched = matchPattern(rule, pos);
      if (matched) {
        return {
          proof: { rule, subst: matched.subst, subproofs: matched.subproofs },
          next: matched.next,
        };
      }
    }
    return null;
  };

  const matchPattern = (rule: InferenceRule, pos: Pos): ChunkMatch | null => {
    // Build a local variable map for THIS rule: a pattern token is a hole only
    // if it appears as the second element of a 2-element assumption of this rule.
    const ruleVars = new Map<string, string>();
    for (const a of rule.assumptions) {
      if (a.length === 2) ruleVars.set(a[1], a[0]);
    }
    const pattern = rule.conclusion.slice(1);
    const subst: Substitution = new Map();
    const subproofs: Proof[] = [];
    let p = skipWs(chunks, pos);

    for (const patternToken of pattern) {
      p = skipWs(chunks, p);
      if (atEnd(chunks, p)) return null;

      const holeKind = ruleVars.get(patternToken);
      if (holeKind === undefined) {
        // Literal constant: must match at current position in a text chunk.
        const c = chunks[p.chunk];
        if (c.kind !== null) return null;
        if (!c.text.startsWith(patternToken, p.offset)) return null;
        const nextOffset = p.offset + patternToken.length;
        p =
          nextOffset >= c.text.length
            ? { chunk: p.chunk + 1, offset: 0 }
            : { chunk: p.chunk, offset: nextOffset };
        continue;
      }

      // Hole: parse a sub-expression of the hole's kind.
      const sub = parse(p, holeKind);
      if (!sub) return null;

      // Derive the consumed tokens from the sub-proof's conclusion. This is
      // always consistent with what evaluate() would produce, avoiding issues
      // with reconstructing token boundaries in dense text (e.g. "))").
      const consumed = proofConclusion(sub.proof).slice(1); // drop type prefix
      const existing = subst.get(patternToken);
      if (existing) {
        if (
          existing.length !== consumed.length ||
          existing.some((t, i) => t !== consumed[i])
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
 * Parses a complete expression from a chunk stream. Returns the proof only
 * if it consumes the entire stream.
 */
export function parseChunks(
  chunks: Chunk[],
  type: string,
  rules: InferenceRule[],
  kindOf: KindOf,
): Proof | null {
  const parser = makeChunkParser(chunks, rules, kindOf);
  const result = parser({ chunk: 0, offset: 0 }, type);
  if (!result) return null;
  const end = skipWs(chunks, result.next);
  return atEnd(chunks, end) ? result.proof : null;
}
