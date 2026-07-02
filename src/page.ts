// Wires the pieces together for a page: tokenise every expression, assemble the
// grammar from the syntax-hint pages, build the kind registry, and parse each
// expression into a proof (= parse tree). Pure logic, independent of the
// browser -- index.ts supplies the real fetch + canvas sampler.

import { createCache, PERF_LOG, type Cache } from "./cache";
import {
  assembleGifGrammar,
  assembleUniGrammar,
  collectConstants,
  GRAMMAR_CACHE_VERSION,
} from "./grammar";
import { findGifRuns, findMathSpans } from "./expression";
import { parseKindColors, type ImageSampler } from "./kind";
import type { Fetcher } from "./loader";
import { TOP_TYPE } from "./database-assumptions";
import { parseChunks, parseExpression, type KindOf } from "./parse";
import type { InferenceRule, Proof } from "./proof";
import { insertSpacers } from "./space";
import { gapUnits } from "./spans";
import {
  chunkifyMathSpan,
  locateGifRun,
  locateMathSpan,
  type Chunk,
  type LocatedToken,
  type Token,
  type TokenLocation,
} from "./token";

export interface ParsedExpression {
  tokens: Token[];
  locations: TokenLocation[]; // parallel to tokens; where each was rendered
  proof: Proof | null; // null when the expression does not parse
}

/**
 * Builds the kind registry from grammar rules and located tokens. The registry
 * maps variable tokens to their type (e.g. "ph" -> "wff"). Built once per
 * grammar, reused across multiple parseLocated calls.
 */
function buildKindRegistry(
  located: LocatedToken[][],
  rules: InferenceRule[],
): KindOf {
  const registry = new Map<string, string>();
  for (const lts of located) {
    for (const { token } of lts)
      if (token.kind) registry.set(token.text, token.kind);
  }
  for (const rule of rules) {
    for (const a of rule.assumptions) {
      if (a.length === 2) registry.set(a[1], a[0]);
    }
  }
  return (token) => registry.get(token);
}

/**
 * Builds the kind registry from chunks (for the chunk-based parser). Same logic
 * as buildKindRegistry but takes Chunk[][] instead of LocatedToken[][].
 */
function buildChunkKindRegistry(
  allChunks: Chunk[][],
  rules: InferenceRule[],
): KindOf {
  const registry = new Map<string, string>();
  for (const chunks of allChunks) {
    for (const chunk of chunks)
      if (chunk.kind) registry.set(chunk.text, chunk.kind);
  }
  for (const rule of rules) {
    for (const a of rule.assumptions) {
      if (a.length === 2) registry.set(a[1], a[0]);
    }
  }
  return (token) => registry.get(token);
}

/**
 * Parses each located expression. A statement beginning with the turnstile (the
 * $TOP rule's first pattern token) is parsed at the synthetic $TOP type; any
 * other expression starts with its own typecode.
 */
function parseLocated(
  located: LocatedToken[][],
  rules: InferenceRule[],
  kindOf?: KindOf,
): ParsedExpression[] {
  const resolve = kindOf ?? buildKindRegistry(located, rules);
  const turnstile = rules[0]?.conclusion[1];

  return located.map((lts) => {
    const tokens = lts.map((lt) => lt.token);
    const locations = lts.map((lt) => lt.location);
    const expr = tokens.map((t) => t.text);
    const proof =
      expr[0] === turnstile
        ? parseExpression(expr, TOP_TYPE, rules, resolve)
        : parseExpression(expr.slice(1), expr[0] ?? "", rules, resolve);
    return { tokens, locations, proof };
  });
}

/** Re-wraps a parsed expression with freshly re-located tokens (after spacing
 *  inserted spacers / split text nodes), keeping its proof. */
function withLocations(
  expr: ParsedExpression,
  relocated: LocatedToken[],
): ParsedExpression {
  return {
    tokens: relocated.map((lt) => lt.token),
    locations: relocated.map((lt) => lt.location),
    proof: expr.proof,
  };
}

/** Parses every GIF expression on the page (kinds via colour sampling). The
 *  grammar and colour legend come from `doc`; expressions are found under
 *  `root` (default `doc`), so the calculation's clones can be processed too. */
export async function parseGifExpressions(
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
  sample: ImageSampler,
  root: Node = doc,
  cache: Cache = createCache(null, GRAMMAR_CACHE_VERSION),
): Promise<ParsedExpression[]> {
  const colors = parseKindColors(doc);
  const kindCache = new Map<string, string | null>();
  const runs = findGifRuns(root);
  const located = runs.map((run) =>
    locateGifRun(run, colors, sample, kindCache),
  );
  const rules = await assembleGifGrammar(doc, pageUrl, fetcher, cache);
  const parsed = parseLocated(located, rules);

  return parsed.map((expr, i) => {
    if (!expr.proof) return expr;
    const nodes = [...runs[i]]; // kept in sync as spacing splits text nodes
    insertSpacers(located[i], gapUnits(expr.proof), (oldNode, freshNode) => {
      const k = nodes.indexOf(oldNode);
      if (k >= 0) nodes.splice(k + 1, 0, freshNode);
    });
    return withLocations(expr, locateGifRun(nodes, colors, sample, kindCache));
  });
}

/** Parses every Unicode expression on the page (kinds via span class). The
 *  grammar and kind classes come from `doc`; expressions are found under `root`
 *  (default `doc`), so the calculation's clones can be processed too. */
export async function parseUniExpressions(
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
  root: ParentNode = doc,
  cache: Cache = createCache(null, GRAMMAR_CACHE_VERSION),
): Promise<ParsedExpression[]> {
  const t0 = PERF_LOG ? performance.now() : 0;
  const colors = parseKindColors(doc);
  const kinds = new Set(colors.values());
  const rules = await assembleUniGrammar(doc, pageUrl, fetcher, cache);
  const t1 = PERF_LOG ? performance.now() : 0;
  const constants = collectConstants(rules);
  const spans = findMathSpans(root);

  // Build kindOf from chunks (variables from spans + rule assumptions).
  const chunked = spans.map((span) => chunkifyMathSpan(span, kinds, colors));
  const chunkKindOf = buildChunkKindRegistry(
    chunked.map((c) => c.chunks),
    rules,
  );
  const t2 = PERF_LOG ? performance.now() : 0;

  // Parse using chunk-based parser (handles concatenated constants like (,)).
  const turnstile = rules[0]?.conclusion[1];
  const proofs = chunked.map(({ chunks }) => {
    // Determine type and select the chunk sub-array to parse.
    let parseChunksArr = chunks;
    let type = TOP_TYPE;
    if (
      chunks.length > 0 &&
      chunks[0].kind === null &&
      chunks[0].text.trimStart().startsWith(turnstile ?? "\0")
    ) {
      // Starts with turnstile: parse the full expression as $TOP (the turnstile
      // is a literal in the $TOP rule's pattern, so the parser matches it).
      type = TOP_TYPE;
      parseChunksArr = chunks;
    } else if (chunks.length > 0 && chunks[0].kind === null) {
      // First word is a typecode (e.g. "wff" on a syntax-definition page).
      // Extract it and produce a chunk array starting after the typecode.
      const text = chunks[0].text;
      const stripped = text.trimStart();
      const wordEnd = stripped.search(/\s|$/);
      type = stripped.slice(0, wordEnd || stripped.length);
      const afterWord = stripped.slice(wordEnd || stripped.length);
      if (afterWord.trimStart()) {
        // Remainder in this chunk after the typecode -- keep it.
        parseChunksArr = [{ kind: null, text: afterWord }, ...chunks.slice(1)];
      } else {
        parseChunksArr = chunks.slice(1);
      }
    }
    return parseChunks(parseChunksArr, type, rules, chunkKindOf);
  });
  const t3 = PERF_LOG ? performance.now() : 0;

  // Re-tokenize with vocab-based splitting for spacing and hover highlighting.
  const result = proofs.map((proof, i) => {
    const located = locateMathSpan(spans[i], kinds, constants, colors);
    const tokens = located.map((lt) => lt.token);
    const locations = located.map((lt) => lt.location);
    if (!proof) return { tokens, locations, proof: null };
    insertSpacers(located, gapUnits(proof));
    const relocated = locateMathSpan(spans[i], kinds, constants, colors);
    return {
      tokens: relocated.map((lt) => lt.token),
      locations: relocated.map((lt) => lt.location),
      proof,
    };
  });

  if (PERF_LOG) {
    const t4 = performance.now();
    const parsed = proofs.filter((p) => p !== null).length;
    console.log(
      `[mm-site-format] PERF parseUniExpressions: ` +
        `${spans.length} spans, ${parsed} parsed, ${rules.length} rules | ` +
        `grammar=${(t1 - t0).toFixed(0)}ms ` +
        `chunkify=${(t2 - t1).toFixed(0)}ms ` +
        `parse=${(t3 - t2).toFixed(0)}ms ` +
        `retokenize+space=${(t4 - t3).toFixed(0)}ms ` +
        `total=${(t4 - t0).toFixed(0)}ms`,
    );
  }
  return result;
}
