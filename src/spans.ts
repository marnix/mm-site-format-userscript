// Token spans of parse-tree nodes, used to decide what to highlight on hover.
// A span is a half-open [start, end) range of token indices within the parsed
// expression. Pure logic over a Proof -- no DOM, no data-type changes.

import type { Proof } from "./proof";
import { TOP_TYPE } from "./database-assumptions";

export type Span = [start: number, end: number];

/**
 * Returns the token span of every node in the proof. Offsets are relative to
 * the proof's own token sequence. A node's width is the number of tokens it
 * consumed: each literal in its rule's pattern is one token, each hole consumes
 * its sub-proof's span (in pattern order -- rules are linear).
 */
const nodeSpansCache = new WeakMap<Proof, Span[]>();

export function nodeSpans(proof: Proof): Span[] {
  const cached = nodeSpansCache.get(proof);
  if (cached) return cached;

  const spans: Span[] = [];

  function walk(p: Proof, start: number): number {
    let offset = start;
    let nextSub = 0;
    for (const patternToken of p.rule.conclusion.slice(1)) {
      if (p.subst.has(patternToken)) {
        offset = walk(p.subproofs[nextSub++], offset); // hole
      } else {
        offset += 1; // literal
      }
    }
    spans.push([start, offset]);
    return offset;
  }

  walk(proof, 0);
  nodeSpansCache.set(proof, spans);
  return spans;
}

/**
 * The proof's node spans shifted into location-index space, so they align with
 * a `ParsedExpression`'s `locations`/`tokens`. A "|-" statement parses the whole
 * token list (shift 0); a typecode statement drops its leading typecode
 * (shift 1). `locationCount` is the number of rendered tokens. Pure.
 */
export function nodeLocationSpans(proof: Proof, locationCount: number): Span[] {
  const spans = nodeSpans(proof);
  const rootEnd = Math.max(...spans.map((s) => s[1]));
  const base = locationCount - rootEnd;
  return spans.map(([s, e]) => [s + base, e + base]);
}

/**
 * The narrowest span that contains `index` (the deepest, i.e. smallest,
 * sub-expression node covering that token), or undefined if none does.
 */
export function smallestSpanContaining(
  spans: Span[],
  index: number,
): Span | undefined {
  let best: Span | undefined;
  for (const [start, end] of spans) {
    if (start <= index && index < end) {
      if (!best || end - start < best[1] - best[0]) best = [start, end];
    }
  }
  return best;
}

/**
 * The whitespace "size" of a node: -1 for a leaf, else the max of its children
 * plus 1 (i.e. the subtree height). A simple, local heuristic -- bigger
 * sub-expressions get more space around their operator. Easy to swap out.
 */
function spacingOf(proof: Proof, memo: Map<Proof, number>): number {
  const cached = memo.get(proof);
  if (cached !== undefined) return cached;
  const s =
    proof.subproofs.length === 0
      ? -1
      : Math.max(...proof.subproofs.map((p) => spacingOf(p, memo))) + 1;
  memo.set(proof, s);
  return s;
}

/** A word-like prefix literal: 2+ ASCII alphabetic characters (e.g. `suc`,
 *  `Fun`, `dom`), as opposed to a symbol like `-.`, `U_`, or a single letter. */
const WORD_PREFIX = /^[A-Za-z]{2,}$/;

interface PatternInfo {
  isHole: (j: number) => boolean;
  isSeparator: (k: number) => boolean;
  separatorCount: number;
  bracketStyle: boolean;
  isBinderSeparator: (k: number) => boolean;
}

/** Structural facts about a rule's pattern token sequence (kind stripped),
 *  shared by the gap logic and the operator-expression test. */
function patternInfo(proof: Proof): PatternInfo {
  const pattern = proof.rule.conclusion.slice(1);
  const isHole = (j: number) =>
    j >= 0 && j < pattern.length && proof.subst.has(pattern[j]);
  const literals: number[] = [];
  pattern.forEach((t, j) => {
    if (!proof.subst.has(t)) literals.push(j);
  });
  const firstLit = literals[0];
  const lastLit = literals[literals.length - 1];
  const closeBracketThenOperand =
    pattern.length >= 2 &&
    !isHole(pattern.length - 2) &&
    isHole(pattern.length - 1);
  const isSeparator = (k: number) =>
    firstLit < k && k < lastLit && isHole(k - 1) && isHole(k + 1);
  const separatorCount = literals.reduce(
    (n, k) => n + (isSeparator(k) ? 1 : 0),
    0,
  );
  // A constructor must also mix variable kinds in its assumptions -- a binder
  // binds a variable of one kind and builds operands of another (cmpo's setvar
  // x/y with class A/B/C), while an n-ary operator chain is homogeneous (w3a's
  // all-wff `( ph /\ ps /\ ch )`, whad's all-wff `hadd( ph , ps , ch )`, ctp's
  // all-class `{ A , B , C }`). The kind is the first token of each assumption,
  // so no database's kind names are hard-coded.
  const kindCount = new Set(proof.rule.assumptions.map((a) => a[0])).size;
  const bracketStyle =
    ((closeBracketThenOperand && separatorCount >= 1) || separatorCount >= 2) &&
    kindCount >= 2;
  // A binder's "e."/"|" separator: an infix literal (hole on both sides) that
  // is not the pattern's first literal, in a rule mixing at least two variable
  // kinds (wral's `e.` in `A. x e. A ph`, `wrex`'s, `csu`'s, `ciun`'s `e.`,
  // `cab`'s `|` in `{ x | ph }`). Like a constructor separator it is a fixed
  // 1-unit word space: the separator belongs to the binder, whose operands on
  // both sides are leaves, so it must not grow with the deep trailing body.
  // A homogeneous single infix (`cxp`'s `X.` in `( A X. B )`, `cop`'s `,` in
  // `< A , B >`) is a true operator and keeps height scaling. `wcel`'s `e.`
  // in `x e. A` is the pattern's first literal, so it is never a binder
  // separator.
  const isBinderSeparator = (k: number) =>
    k > firstLit &&
    !proof.subst.has(pattern[k]) &&
    isHole(k - 1) &&
    isHole(k + 1) &&
    kindCount >= 2;
  return {
    isHole,
    isSeparator,
    separatorCount,
    bracketStyle,
    isBinderSeparator,
  };
}

/** A node is an *operator expression* when its root has an infix token whose
 *  gaps would be height-scaled -- a fixed-separator constructor (`crab`'s
 *  `{ x | ... }`), a binder separator (`wral`'s `e.`), and a leaf are not.
 *  Used by the prefix-space rule: `-.` over `z = 1` gets a space, over a class
 *  abstraction it stays tight. */
function hasHeightScaledOperator(proof: Proof): boolean {
  const { isHole, isBinderSeparator, bracketStyle } = patternInfo(proof);
  if (bracketStyle) return false;
  const pattern = proof.rule.conclusion.slice(1);
  for (let j = 1; j < pattern.length; j++) {
    const beforeIsInfix = isHole(j - 2) && !isHole(j - 1) && isHole(j);
    const jIsInfix = isHole(j - 1) && !isHole(j) && isHole(j + 1);
    const beforeIsOp = isHole(j - 2) && isHole(j - 1) && isHole(j);
    const jIsOp = isHole(j - 1) && isHole(j) && isHole(j + 1);
    if (
      (beforeIsInfix || jIsInfix || beforeIsOp || jIsOp) &&
      !isBinderSeparator(j) &&
      !isBinderSeparator(j - 1)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Units of extra whitespace to put *before* each token of the proof's token
 * sequence (`units[0]` is 0). A gap gets spacing only when it is adjacent to an
 * *operator*: a pattern token with a hole immediately before and after it. The
 * operator can be a literal (e.g. `->` or `e.`) or a hole -- `co` is
 * `class ( A F B )`, so an operator like `+no` fills the hole `F` and is itself
 * a sub-expression. Both sides of an operator get the same value: the operator's
 * own subtree height (`spacingOf`), but at least 1 unit even when both operands
 * are leaves (height 0) -- an infix operator between two simple classes like
 * `( F o. G )` or `( A +no B )` must still show some spacing. A parent
 * operator's height strictly exceeds its children's, so the whitespace grows
 * with operator level -- a high-level `->` gets more room than a `<->` nested
 * inside it, which gets more than an inner `=`. Everything follows from the
 * parse-tree heights and each rule's own pattern structure -- nothing is keyed
 * on a rule name or paren token.
 *
 * The one non-operator gap that gets spacing is a *prefix*: a rule whose whole
 * pattern is a literal immediately followed by its single hole (`csuc` is
 * `class suc A`). The operand's gap gets a fixed 1 unit -- the page otherwise
 * removes the whitespace and the word glues to its operand (`sucA`). A
 * *word-like* prefix (2+ alphabetic characters) always gets it; a symbol prefix
 * (`wn`'s `-.`, `cint`'s `|^|`) stays tight over a leaf operand, matching the
 * site's `-.A`, but also gets the fixed 1 when its operand is itself an
 * operator expression -- `-. z = 1` reads as `-.` applying to the whole `z = 1`,
 * encoding that `=` binds tighter than `-.`. Either way the space is a fixed
 * word boundary, independent of the operand's height.
 *
 * The other non-operator gap with spacing is an *adjacent-variable* gap: two
 * holes next to each other in a pattern (`wral`'s `A ph` in `A. x e. A ph`,
 * `wal`'s `x ph` in `A. x ph`). Like a word-prefix boundary, it gets a fixed
 * 1 unit and stays there regardless of the operand's height. Operator gaps take
 * precedence: a hole-pair inside an operator, like `co`'s `F B` in `( A F B )`,
 * keeps the operator's height-based spacing so the operator stays symmetric.
 *
 * The *constructor* rules -- subscript-bracket constructors (`csb`'s
 * `[_ A / x ]_ B`, `wsbc`'s `[. A / x ]. ph`, `wsb`'s `[ y / x ] ph`) and
 * binder constructors (`cmpo`'s `( x e. A , y e. B |-> C )`, `cmpt`'s
 * `( x e. A |-> C )`, `crab`'s `{ x e. A | ph }`) -- behave like word-prefix
 * rules, not operator rules, even though a separator literal (the `/`, `e.`,
 * `,`, `|->`, `|`) has a hole on each side. A pattern is a constructor when it
 * ends with a literal close-bracket immediately followed by its single operand
 * (`[_ A / x ]_ B`) and contains an interior separator literal, or when it
 * contains two or more separator literals -- and its assumptions mix variable
 * kinds (a binder binds a variable of one kind and builds operands of another;
 * the kind is each assumption's first token, so no kind names are hard-coded).
 * An n-ary operator chain like `w3a`'s `( ph /\ ps /\ ch )`, `whad`'s
 * `hadd( ph , ps , ch )`, or `ctp`'s `{ A , B , C }` is homogeneous and keeps
 * operator scaling, so its operators still read at the chain's level. The site
 * renders the constructors with the
 * brackets tight and the separator phrase a fixed word space --
 * `\u298bA / x\u298cB`, `( x e. A , y e. B |-> C )` -- never with
 * height-scaled operators. The close bracket is tight on both sides, an
 * operand gap right after it is tight, and the separator gaps (including the
 *  fixed gap before a binder's body) are fixed 1-unit word spaces. Purely
 *  structural: nothing is keyed on a rule name or constant text, so a single
 *  infix like `( ph -> ps )`, `cec`'s `[ A ] R`, and `citg`'s `S. A B _d x`
 *  (no separator between the first and last constant) stay operator-based.
 *
 *  A *binder separator* is the same idea without the close bracket: an infix
 *  literal that is not the pattern's first literal, in a rule mixing variable
 *  kinds (`wral`'s `e.` in `A. x e. A ph`, `cab`'s `|` in `{ x | ph }`), gets a
 *  fixed 1-unit gap on both sides instead of `spacingOf(p)`. The separator
 *  belongs to the binder, whose leaf operands carry no depth, so it stays small
 *  while the deep trailing body carries the room. Homogeneous single infixes
 *  (`cxp`'s `X.`, `cop`'s `,`) are true operators and keep height scaling, and
 *  `wcel`'s `e.` is the pattern's first literal, never a binder separator.
 */
export function gapUnits(proof: Proof): number[] {
  const memo = new Map<Proof, number>();
  const units: number[] = [];

  function walk(p: Proof, start: number): number {
    const pattern = p.rule.conclusion.slice(1);
    const { isHole, isSeparator, bracketStyle, isBinderSeparator } =
      patternInfo(p);
    // The pattern's last hole is the operand / body. When it is the last token
    // (csb's B), the close bracket before it is tight on both sides. When the
    // body is followed by a close bracket (cmpo's C), only that final bracket
    // is tight and the body gap is the fixed 1 after the last separator.
    const trailingOperand = isHole(pattern.length - 1);

    let offset = start;
    let nextSub = 0;
    pattern.forEach((tok, j) => {
      if (j > 0) {
        if (bracketStyle) {
          // Close bracket and operand are tight; interior separators are fixed
          // 1-unit word spaces; adjacent variables get a word space.
          units[offset] =
            j === pattern.length - 1 ||
            (trailingOperand && j === pattern.length - 2)
              ? 0
              : isSeparator(j) || isSeparator(j - 1)
                ? 1
                : isHole(j - 1) && isHole(j)
                  ? 1
                  : 0;
        } else {
          // The gap before pattern token j is adjacent to an operator when the
          // token right before it has sub-expressions on both sides (tok is the
          // right operand), or when j itself is an operator. An operator is a
          // token with a hole immediately before and after it -- either a literal
          // (e.g. `->` in ( ph -> ps )) or a hole (e.g. `co`'s operator F in
          // ( A F B ), filled by a class constant like +no in ( A +no B )).
          const beforeIsInfix =
            isHole(j - 2) && !p.subst.has(pattern[j - 1]) && isHole(j);
          const jIsInfix = isHole(j - 1) && !p.subst.has(tok) && isHole(j + 1);
          const beforeIsOp = isHole(j - 2) && isHole(j - 1) && isHole(j);
          const jIsOp = isHole(j - 1) && isHole(j) && isHole(j + 1);
          // Word-like prefix: the whole pattern is a word literal followed by its
          // single hole, so tok (j = 1) is the operand and its gap is a fixed
          // word boundary (1 unit), not an operator level.
          const prefixOperand =
            pattern.length === 2 &&
            !p.subst.has(pattern[0]) &&
            p.subst.has(pattern[1]);
          // A word-like prefix always gets a fixed 1 unit; a symbol or one-letter
          // prefix stays tight over a leaf operand (the site's `-.A`) but gets
          // the same fixed 1 when its operand is itself an operator expression --
          // `-. z = 1` then reads as `-.` applying to the whole `z = 1`, encoding
          // that `=` binds tighter than `-.`. Not over the assertion turnstile
          // (the `$TOP` root, tight to the statement) and not over a constructor
          // operand like `|^| { x | ... }`, whose abstraction is a fixed-
          // separator constructor, not an operator.
          const operand = p.subproofs[0];
          const prefixGap =
            prefixOperand &&
            operand !== undefined &&
            p.rule.conclusion[0] !== TOP_TYPE &&
            (WORD_PREFIX.test(pattern[0]) || hasHeightScaledOperator(operand));
          // Adjacent variables: two holes next to each other in the pattern
          // (wral's A ph, wal's x ph). A fixed word space, not an operator level.
          const adjacentVar = isHole(j - 1) && isHole(j);
          // Binder separator: fixed 1-unit word space (see isBinderSeparator).
          const binderSeparatorGap =
            isBinderSeparator(j) || isBinderSeparator(j - 1);
          units[offset] = binderSeparatorGap
            ? 1
            : beforeIsInfix || jIsInfix || beforeIsOp || jIsOp
              ? Math.max(spacingOf(p, memo), 1)
              : prefixGap || adjacentVar
                ? 1
                : 0;
        }
      }
      if (p.subst.has(tok)) offset = walk(p.subproofs[nextSub++], offset);
      else offset += 1;
    });
    return offset;
  }

  walk(proof, 0);
  units[0] = 0;
  return units;
}
