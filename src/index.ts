import "./config";
import "./database-assumptions"; // hoist the MM database assumptions below config
import { createCache, PERF_LOG, type KeyValueStore } from "./cache";
import {
  findSharedNodes,
  proofTreeToCalculation,
  type ProofTree,
} from "./calculation";
import { findMathSpans } from "./expression";
import { GRAMMAR_CACHE_VERSION, missingSyntaxHints } from "./grammar";
import { indentProofExpressions } from "./indent";
import {
  buildOccurrenceIndex,
  createHighlighter,
  createPainter,
  installHover,
  type OccurrenceIndex,
} from "./highlight";
import { DIFF_COLOR } from "./config";
import { extractSyntaxHintUrls } from "./loader";
import { canvasSampler } from "./kind";
import {
  parseGifExpressions,
  parseUniExpressions,
  type ParsedExpression,
} from "./page";
import type { Proof } from "./proof";
import { renderCalcTable, renderCalculation, setCalcCollapsed } from "./render";
import { attachTooltip } from "./tooltip";
import {
  attachRuleTooltipsToPage,
  makeRuleTooltipFetcher,
} from "./rule-tooltip";
import { anchorSpine, chooseSpine, isSmallStep } from "./spine";
import { injectStyles } from "./styles";
import { materializeExpressions, parseProofTableLazy } from "./table";
import { formatTokens } from "./token";
import { installParseWarning, isProofExpression } from "./parse-status";
import { applyViewToLinks, installViewToggle, tableSelected } from "./view";

declare const __USERSCRIPT_VERSION__: string;
declare const __USERSCRIPT_BUILD_TIME__: string;

const LOG = "[mm-site-format]";

/** Creates a synthetic ref element: a span containing an <a> link to #mm-site-format-proof-N. */
function makeProofRef(n: number): HTMLElement {
  const synth = document.createElement("span");
  const link = document.createElement("a");
  link.href = `#mm-site-format-proof-${n}`;
  link.textContent = `(${n})`;
  link.className = "mm-site-format-proof-ref";
  synth.appendChild(link);
  return synth;
}

// On any matching page, before deciding whether this is a proof page: make every
// metamath.org link agree with the current view (carry the table choice, or
// leave plain URLs alone for the calculational default).
applyViewToLinks(tableSelected(window.location.search));

if (!document.querySelector('table[summary="Proof of theorem"]')) {
  console.log(`${LOG} (not a metamath proof page; no processing)`);
} else {
  console.log(`${LOG} processing proof page...`);
  const _perfStart = PERF_LOG ? performance.now() : 0;
  injectStyles();

  const banner = document.createElement("div");
  const built = __USERSCRIPT_BUILD_TIME__
    ? ` -- built ${__USERSCRIPT_BUILD_TIME__}`
    : "";
  banner.textContent = `MM Site Format ${__USERSCRIPT_VERSION__} active${built}`;
  banner.className = "mm-site-format-banner";
  document.body.appendChild(banner);

  // Capture the proof tree now (its Expression-cell clones predate the
  // whitespace pass); render the calculation once expressions are parsed, so the
  // spine can be chosen from their parse trees.
  const proofTable = document.querySelector<HTMLTableElement>(
    'table[summary="Proof of theorem"]',
  );
  const proofResult = parseProofTableLazy(document);
  const proofTree = proofResult?.tree ?? null;
  const stepOf = proofResult?.stepOf ?? new Map<ProofTree, number>();
  const _tParseTree = PERF_LOG ? performance.now() : 0;

  // Hang-indent the proof table's wrapped Expression lines. Do it now, while the
  // table is still laid out and visible (before the early grid hide below).
  if (proofTable) indentProofExpressions(proofTable);
  const _tIndent = PERF_LOG ? performance.now() : 0;

  // Deep-clone expression cells now, after indent has read the layout but before
  // the spacer pass modifies them in-place.
  if (proofTree) materializeExpressions(proofTree);
  if (PERF_LOG) {
    const t = performance.now();
    console.log(
      `[mm-site-format] PERF setup: ${(t - _perfStart).toFixed(0)}ms` +
        ` (parseTable=${(_tParseTree - _perfStart).toFixed(0)}ms` +
        ` indent=${(_tIndent - _tParseTree).toFixed(0)}ms` +
        ` cloneExprs=${(t - _tIndent).toFixed(0)}ms)`,
    );
  }

  // When the calculation will replace the grid, hide the grid body at once --
  // keeping its space so the page below does not jump -- and reveal the
  // calculation once it is ready. The caption (heading) stays visible. Restore
  // the grid if the calculation never appears.
  const grids = proofTable ? ([...proofTable.tBodies] as HTMLElement[]) : [];
  if (proofTree && !tableSelected(window.location.search))
    for (const grid of grids) grid.style.visibility = "hidden";
  const restoreGrid = () => {
    for (const grid of grids) grid.style.visibility = "";
  };

  // Spine + small-step choosers backed by the page's parsed expressions: the
  // spine is the sub-proof whose parse tree most overlaps the step's, and a step
  // is "small" when it has a single premise whose token sequence barely differs
  // from the step's. Each ProofTree node is matched to a ParsedExpression by
  // which original Expression cell contains it.
  const choosers = (results: ParsedExpression[]) => {
    const cache = new Map<ProofTree, ParsedExpression | null>();
    const exprOf = (node: ProofTree): ParsedExpression | null => {
      if (cache.has(node)) return cache.get(node)!;
      let found: ParsedExpression | null = null;
      const cell = node.expressionCell;
      if (cell)
        for (const r of results) {
          const at = r.locations[0]?.node;
          if (r.proof && at && cell.contains(at)) {
            found = r;
            break;
          }
        }
      cache.set(node, found);
      return found;
    };
    const parseOf = (node: ProofTree): Proof | null =>
      exprOf(node)?.proof ?? null;
    const tokensOf = (node: ProofTree): string[] | null =>
      exprOf(node)?.tokens.map((t) => t.text) ?? null;

    const spineFor = (
      node: ProofTree,
      anchor: string[] | null,
    ): number | null => {
      const conclusion = parseOf(node);
      const subs = node.subproofs.map((s) => ({
        parse: parseOf(s),
        trivial: s.subproofs.length === 0,
      }));
      // Without parse trees, fall back to the first sub-proof; otherwise a null
      // from chooseSpine means "no clear main line". Try the anchor tiebreaker
      // before giving up.
      if (!conclusion || subs.some((s) => !s.parse)) return 0;
      const result = chooseSpine(
        conclusion,
        subs as { parse: Proof; trivial: boolean }[],
      );
      if (result !== null || anchor === null) return result;
      return anchorSpine(
        anchor,
        node.subproofs.map((s) => tokensOf(s)),
      );
    };
    // Single-premise only (matching the earlier userscript's stepIsSmall): a
    // multi-premise step combines information, so it is never "small".
    const smallFor = (node: ProofTree): boolean => {
      if (node.subproofs.length !== 1) return false;
      const step = tokensOf(node);
      const premise = tokensOf(node.subproofs[0]);
      return !!step && !!premise && isSmallStep(step, premise);
    };
    return { spineFor, smallFor, tokensOf };
  };

  // Fix the calculation box to its fully-expanded width, so expanding a
  // sub-calculation never reflows the box -- but as a responsive `max-width`, so
  // the box still shrinks (and its lines wrap) when the window is narrower than
  // that, and grows back on widening, all in CSS with no re-measure on resize.
  // The natural width is measured with `width:max-content` (which does not wrap,
  // i.e. an effectively infinite canvas). Run this *after* the calc's clones
  // have been spaced (the second parse pass), or the measured width misses the
  // spacers. All synchronous, so neither the expanded state nor the temporary
  // display is ever painted.
  const sizeToExpandedWidth = (box: HTMLElement) => {
    const display = box.style.display; // none in table view; restore it after
    setCalcCollapsed(box, false); // expand everything
    box.style.display = "inline-block";
    box.style.maxWidth = "none"; // measure unclamped
    box.style.width = "max-content"; // the no-wrap width of the widest line
    const rect = box.getBoundingClientRect();
    // Round up to the next pixel (max-content is often fractional) -- no fudge.
    box.style.width = `${Math.ceil(rect.width)}px`;
    // Clamp to the page's content width in CSS, so the box shrinks (and wraps)
    // when the window is narrower than its natural width and grows back on
    // widening, with no re-measure on resize. The box is centered (it sits in a
    // `<center>`), so the centering offset is NOT a reduction of available width
    // -- only the body margins + scrollbar are, and those are ~stable, so we bake
    // them as a constant subtracted from the responsive `100vw`.
    const margin = Math.max(
      0,
      Math.round(
        window.innerWidth - document.body.getBoundingClientRect().width,
      ),
    );
    box.style.maxWidth = `calc(100vw - ${margin}px)`;
    setCalcCollapsed(box, true); // back to collapsed (the default)
    box.style.display = display;
  };

  // Diff painter and lazy exprFor lookup. calcExprs is populated by the second
  // parse pass (async) but always ready before the user can hover.
  const calcExprs: ParsedExpression[] = [];
  const diffPainter = createPainter(
    "mm-site-format-diff",
    "mm-site-format-diff-hl",
    DIFF_COLOR,
  );
  const exprFor = diffPainter
    ? (span: HTMLElement): ParsedExpression | null => {
        for (const r of calcExprs) {
          const at = r.locations[0]?.node;
          if (at && span.contains(at)) return r;
        }
        return null;
      }
    : undefined;

  const showCalculation = (results: ParsedExpression[]): HTMLElement | null => {
    if (!proofTree || !proofTable) return null;
    const _t0 = PERF_LOG ? performance.now() : 0;
    const { spineFor, smallFor, tokensOf: tokensOf_ } = choosers(results);
    const _t1 = PERF_LOG ? performance.now() : 0;

    // Detect shared sub-derivations and extract them as separate blocks.
    const shared = findSharedNodes(proofTree);
    // Only extract internal nodes (leaves are just hypotheses cited twice).
    const extracted = [...shared].filter((n) => n.subproofs.length > 0);

    // Give shared nodes a synthetic refHtml with a hyperlink "(N)" so that
    // when they appear as givens, the hint shows "(N) below/above". On-spine
    // nodes also get this (for their off-spine given appearances), but their
    // step's inferenceRuleRefHtml is patched back to the original after building.
    const savedRefs = new Map<ProofTree, Element>();
    for (const node of extracted) {
      const n = stepOf.get(node);
      if (n !== undefined) {
        savedRefs.set(node, node.refHtml);
        node.refHtml = makeProofRef(n);
      }
    }

    // Internal shared nodes go into spineShared (expand on spine, given
    // off-spine). Leaf shared nodes stay in shared (always given).
    const leafShared = new Set(
      [...shared].filter((n) => n.subproofs.length === 0),
    );
    // Mark expressionHtml elements with a child marker so we can find their
    // clones after rendering (clone() copies children, not the element itself).
    for (const node of extracted) {
      const n = stepOf.get(node);
      if (n !== undefined) {
        const marker = document.createElement("span");
        marker.dataset.proofAnchor = String(n);
        marker.style.display = "none";
        node.expressionHtml.prepend(marker);
      }
    }
    const calc = proofTreeToCalculation(
      proofTree,
      spineFor,
      smallFor,
      tokensOf_,
      null,
      leafShared,
      new Set(extracted),
    );
    const _t2 = PERF_LOG ? performance.now() : 0;

    // Determine which extracted nodes ended up on the spine (expanded inline)
    // so we don't render a redundant mini-calc for them.
    const onSpine = new Set<ProofTree>();
    {
      let c = calc;
      let t = proofTree;
      while (c.kind === "step") {
        if (c.spine === null) break;
        t = t.subproofs[c.spine];
        onSpine.add(t);
        c = c.subcalculations[c.spine];
      }
    }
    const offSpineExtracted = extracted.filter((n) => !onSpine.has(n));

    // Patch on-spine steps: their inferenceRuleRefHtml captured the synthetic
    // "(N)" ref, but they need their original rule name in their own hint.
    {
      let c = calc;
      let t = proofTree;
      while (c.kind === "step") {
        const origRef = savedRefs.get(t);
        if (origRef) c.inferenceRuleRefHtml = origRef;
        if (c.spine === null) break;
        t = t.subproofs[c.spine];
        c = c.subcalculations[c.spine];
      }
    }

    // Restore original refHtml for the extracted mini-calculations.
    for (const [node, ref] of savedRefs) node.refHtml = ref;

    // Mutable slot: filled after the mini-calc labeling infrastructure is ready,
    // so lazy renders (subcalcs and mini-calcs) can label their proof-ref links.
    let labelNewContent: ((root: ParentNode) => void) | null = null;

    const renderOpts = {
      fetchRuleTooltip,
      diffPainter: diffPainter ?? undefined,
      exprFor,
      onLazyRender: (root: ParentNode) => labelNewContent?.(root),
    };
    const rendered = renderCalculation(calc, renderOpts);
    const _t3 = PERF_LOG ? performance.now() : 0;
    let _t4 = 0;

    // Give on-spine shared expressions an anchor id so "(N)" links can target
    // them. Find them by matching expressionHtml via data attributes set before
    // the calc was built.
    for (const node of extracted) {
      if (!onSpine.has(node)) continue;
      const n = stepOf.get(node);
      if (n === undefined) continue;
      // Find the rendered clone by the child marker we inserted
      const marker = rendered.querySelector(`[data-proof-anchor="${n}"]`);
      const exprSpan = marker?.parentElement;
      const row = exprSpan?.closest("tr");
      if (row) {
        row.id = `mm-site-format-proof-${n}`;
        // Put "(N)" in the left (operator) column, like a given's ref label,
        // with a tooltip showing the expression.
        const opCell = row.firstElementChild as HTMLElement | null;
        if (opCell && exprSpan) {
          opCell.textContent = "";
          const ref = makeProofRef(n);
          opCell.appendChild(ref);
          opCell.style.textAlign = "left";
          attachTooltip(ref, () => exprSpan.cloneNode(true) as Node);
        }
      }
    }

    // Append mini-calculations for extracted shared steps below the main one,
    // ordered highest step number first, hidden until their link is clicked.
    if (offSpineExtracted.length > 0) {
      const box = rendered; // the .mm-site-format-calc div
      const ordered = [...offSpineExtracted].sort(
        (a, b) => (stepOf.get(b) ?? 0) - (stepOf.get(a) ?? 0),
      );
      for (const node of ordered) {
        const n = stepOf.get(node);
        const wrapper = document.createElement("div");
        wrapper.id = n !== undefined ? `mm-site-format-proof-${n}` : "";
        const label = document.createElement("div");
        label.className = "mm-site-format-calc-label";
        label.textContent = n !== undefined ? `Proof of (${n}):` : "Proof:";
        wrapper.appendChild(label);
        // Defer the expensive proofTreeToCalculation + renderCalcTable until
        // the mini-calc is first made visible.
        let rendered_ = false;
        const renderMiniCalc = () => {
          if (rendered_) return;
          rendered_ = true;
          const others = new Set(shared);
          others.delete(node);
          const nestedSaved = new Map<ProofTree, Element>();
          for (const other of extracted) {
            if (other === node) continue;
            const m = stepOf.get(other);
            if (m !== undefined) {
              nestedSaved.set(other, other.refHtml);
              other.refHtml = makeProofRef(m);
            }
          }
          const miniCalc = proofTreeToCalculation(
            node,
            spineFor,
            smallFor,
            tokensOf_,
            null,
            others,
          );
          for (const [other, ref] of nestedSaved) other.refHtml = ref;
          wrapper.appendChild(renderCalcTable(miniCalc, renderOpts));
          labelNewContent?.(wrapper);
        };
        (
          wrapper as HTMLElement & { __renderMiniCalc?: () => void }
        ).__renderMiniCalc = renderMiniCalc;
        wrapper.style.display = "none"; // start hidden; updateMiniCalcVisibility will show
        box.appendChild(wrapper);
      }
      _t4 = PERF_LOG ? performance.now() : 0;
      // Delegated click handler: ensure the target mini-calc is visible before
      // the browser navigates to the fragment (which pushes a history entry and
      // scrolls). Browser Back then returns to the previous position.
      box.addEventListener("click", (e) => {
        const link = (e.target as HTMLElement).closest?.(
          'a[href^="#mm-site-format-proof-"]',
        );
        if (!link) return;
        const id = link.getAttribute("href")!.slice(1);
        const target = document.getElementById(id);
        if (target && target.style.display === "none") {
          const lazy = target as HTMLElement & {
            __renderMiniCalc?: () => void;
          };
          lazy.__renderMiniCalc?.();
          target.style.display = "";
        }
      });

      // Mini-calc visibility: show a mini-calc only if at least one reference
      // to it is visible (not inside a collapsed sub-calculation).
      const miniCalcIds = ordered
        .map((node) => stepOf.get(node))
        .filter((n): n is number => n !== undefined)
        .map((n) => `mm-site-format-proof-${n}`);

      const updateMiniCalcVisibility = () => {
        for (const id of miniCalcIds) {
          const wrapper = document.getElementById(id);
          if (!wrapper) continue;
          // Query live DOM (handles lazily-rendered content).
          const links = box.querySelectorAll(`a[href="#${id}"]`);
          let anyVisible = false;
          for (const link of links) {
            let el: HTMLElement | null = link as HTMLElement;
            let hidden = false;
            while (el && el !== box) {
              if (el.style.display === "none") {
                hidden = true;
                break;
              }
              el = el.parentElement;
            }
            if (!hidden) {
              anyVisible = true;
              break;
            }
          }
          const desired = anyVisible ? "" : "none";
          if (wrapper.style.display !== desired) {
            if (desired === "") {
              // Trigger lazy rendering on first show.
              const lazy = wrapper as HTMLElement & {
                __renderMiniCalc?: () => void;
              };
              lazy.__renderMiniCalc?.();
            }
            wrapper.style.display = desired;
          }
        }
      };
      updateMiniCalcVisibility();

      // Re-check visibility whenever a sub-calc is expanded/collapsed (style
      // attribute changes on rows).
      const observer = new MutationObserver(updateMiniCalcVisibility);
      observer.observe(box, {
        attributes: true,
        attributeFilter: ["style"],
        subtree: true,
      });

      // Label each "(N)" link with "below" or "above" based on DOM order
      // relative to its target mini-calc or spine row.
      // Pre-build a map of anchor id -> element for O(1) lookups.
      const anchorById = new Map<string, Element>();
      for (const el of box.querySelectorAll("[id^='mm-site-format-proof-']"))
        anchorById.set(el.id, el);

      const labelProofRefs = (root: ParentNode) => {
        for (const link of root.querySelectorAll(
          "a.mm-site-format-proof-ref",
        )) {
          const id = link.getAttribute("href")?.slice(1);
          if (!id) continue;
          const target = anchorById.get(id) ?? document.getElementById(id);
          if (!target) continue;
          // Skip labels that are inside their own target (the on-spine label IS
          // the anchor, not a reference to it).
          if (target.contains(link)) continue;
          // Node.DOCUMENT_POSITION_FOLLOWING = 4: target is after link
          const pos = link.compareDocumentPosition(target);
          const dir =
            pos & Node.DOCUMENT_POSITION_FOLLOWING ? "below" : "above";
          const n = id.replace("mm-site-format-proof-", "");
          link.textContent = `(${n}) ${dir}`;
        }
      };
      labelProofRefs(box);
      labelNewContent = labelProofRefs;
    }

    // Into the caption, below the "Proof of Theorem" heading -- so the heading
    // stays in place whichever view is shown.
    const caption = proofTable.querySelector("caption");
    if (caption) caption.appendChild(rendered);
    else proofTable.parentNode?.insertBefore(rendered, proofTable);
    installViewToggle(rendered, proofTable);
    if (PERF_LOG)
      console.log(
        `[mm-site-format] PERF showCalculation: ` +
          `choosers=${(_t1 - _t0).toFixed(0)}ms ` +
          `proofTreeToCalc=${(_t2 - _t1).toFixed(0)}ms ` +
          `renderMain=${(_t3 - _t2).toFixed(0)}ms ` +
          `miniCalcs=${((_t4 || _t3) - _t3).toFixed(0)}ms ` +
          `postProcess=${(performance.now() - (_t4 || _t3)).toFixed(0)}ms ` +
          `total=${(performance.now() - _t0).toFixed(0)}ms`,
      );
    return rendered;
  };

  const pageUrl = window.location.href;
  // Memoised so the calculation's second (scoped) parse reuses fetched pages.
  const fetchCache = new Map<string, Promise<string>>();
  const fetcher = (url: string) => {
    let body = fetchCache.get(url);
    if (!body) {
      body = fetch(url).then((r) => r.text());
      fetchCache.set(url, body);
    }
    return body;
  };
  const fetchRuleTooltip = makeRuleTooltipFetcher(pageUrl, fetcher);
  attachRuleTooltipsToPage(document, fetchRuleTooltip);

  // Caches the *result* of processing each linked page (grammar rules, syntax-
  // hint URLs), shared by both parse passes (in memory) and across page loads
  // (sessionStorage, when available). The browser already caches the fetches.
  let store: KeyValueStore | null = null;
  try {
    store = window.sessionStorage;
  } catch {
    store = null; // storage blocked (e.g. privacy settings)
  }
  const cache = createCache(store, GRAMMAR_CACHE_VERSION);

  // The page's own "Syntax hints" labels (e.g. wcel from wcel.html).
  const declaredHints = new Set(
    extractSyntaxHintUrls(document, pageUrl).map((u) =>
      (u.split("/").pop() ?? "").replace(/\.html$/, ""),
    ),
  );

  const finish =
    (install: (results: ParsedExpression[]) => void) =>
    (results: ParsedExpression[]) => {
      const failures = results.filter((r) => !r.proof && isProofExpression(r));
      for (const { tokens } of failures)
        console.warn(`${LOG} could not parse:`, formatTokens(tokens));
      // Info if the page declares incomplete Syntax hints -- the script found
      // them via workarounds so expressions still parse, but it signals an
      // upstream site-generation bug (see grammar.ts / TODO).
      const proofs = results
        .map((r) => r.proof)
        .filter((p): p is Proof => p !== null);
      const missing = missingSyntaxHints(proofs, declaredHints);
      if (missing.length)
        console.info(
          `${LOG} incomplete Syntax hints -- shown but not listed: ${missing.join(", ")}`,
        );
      installParseWarning(banner, failures.length);
      install(results);
    };

  // A single Highlighter and a single growing expression list shared by both the
  // proof table and the calculation view -- so hovering in either view finds
  // matching occurrences in the other.
  if (findMathSpans(document).length > 0) {
    // Unicode page: kinds come from span classes, no image sampling needed.
    const occIndex: OccurrenceIndex = new Map();
    const addToIndex = (exprs: ParsedExpression[]) => {
      const partial = buildOccurrenceIndex(exprs);
      for (const [key, occs] of partial) {
        const existing = occIndex.get(key);
        if (existing) existing.push(...occs);
        else occIndex.set(key, [...occs]);
      }
    };
    const highlighter = createHighlighter();
    parseUniExpressions(document, pageUrl, fetcher, document, cache)
      .then((results) => {
        const _tParsed = PERF_LOG ? performance.now() : 0;
        addToIndex(results);
        if (PERF_LOG) console.log(`[mm-site-format] PERF addToIndex done`);
        finish((r) => installHover(r, occIndex, highlighter))(results);
        if (PERF_LOG)
          console.log(`[mm-site-format] PERF finish+installHover done`);
        const _tHover = PERF_LOG ? performance.now() : 0;
        // The calculation clones expressions; give those clones the same
        // parsing, whitespace and hover by running the pass again, scoped to it.
        if (PERF_LOG)
          console.log(`[mm-site-format] PERF calling showCalculation...`);
        const calc = showCalculation(results);
        if (PERF_LOG) {
          const t = performance.now();
          console.log(
            `[mm-site-format] PERF post-parse: ` +
              `index+hover=${(_tHover - _tParsed).toFixed(0)}ms ` +
              `showCalculation=${(t - _tHover).toFixed(0)}ms`,
          );
        }
        if (calc)
          parseUniExpressions(document, pageUrl, fetcher, calc, cache).then(
            (calcResults) => {
              const _tCalc = PERF_LOG ? performance.now() : 0;
              addToIndex(calcResults);
              calcExprs.push(...calcResults);
              installHover(calcResults, occIndex, highlighter);
              sizeToExpandedWidth(calc); // after spacers are inserted
              if (PERF_LOG)
                console.log(
                  `[mm-site-format] PERF calc pass: ${(performance.now() - _tCalc).toFixed(0)}ms (total since parse: ${(performance.now() - _tParsed).toFixed(0)}ms)`,
                );
              console.log(`${LOG} finished`);
            },
          );
        else console.log(`${LOG} finished`);
      })
      .catch(restoreGrid);
  } else {
    // GIF page: colour sampling needs the variable images loaded, so let the
    // browser signal readiness via load events before parsing.
    const occIndex: OccurrenceIndex = new Map();
    const addToIndex = (exprs: ParsedExpression[]) => {
      const partial = buildOccurrenceIndex(exprs);
      for (const [key, occs] of partial) {
        const existing = occIndex.get(key);
        if (existing) existing.push(...occs);
        else occIndex.set(key, [...occs]);
      }
    };
    const highlighter = createHighlighter();
    const imagesReady = (imgs: HTMLImageElement[]) =>
      Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve() // already loaded (e.g. from cache)
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
        ),
      );
    const gifImages = (root: ParentNode) =>
      [...root.querySelectorAll("img")] as HTMLImageElement[];
    imagesReady(gifImages(document))
      .then(() =>
        parseGifExpressions(
          document,
          pageUrl,
          fetcher,
          canvasSampler,
          document,
          cache,
        ),
      )
      .then((results) => {
        const _tParsed = PERF_LOG ? performance.now() : 0;
        addToIndex(results);
        finish((r) => installHover(r, occIndex, highlighter))(results);
        const _tHover = PERF_LOG ? performance.now() : 0;
        const calc = showCalculation(results);
        if (PERF_LOG) {
          const t = performance.now();
          console.log(
            `[mm-site-format] PERF post-parse (GIF): ` +
              `index+hover=${(_tHover - _tParsed).toFixed(0)}ms ` +
              `showCalculation=${(t - _tHover).toFixed(0)}ms`,
          );
        }
        if (calc)
          imagesReady(gifImages(calc))
            .then(() =>
              parseGifExpressions(
                document,
                pageUrl,
                fetcher,
                canvasSampler,
                calc,
                cache,
              ),
            )
            .then((calcResults) => {
              const _tCalc = PERF_LOG ? performance.now() : 0;
              addToIndex(calcResults);
              calcExprs.push(...calcResults);
              installHover(calcResults, occIndex, highlighter);
              sizeToExpandedWidth(calc); // after spacers are inserted
              if (PERF_LOG)
                console.log(
                  `[mm-site-format] PERF calc pass (GIF): ${(performance.now() - _tCalc).toFixed(0)}ms (total since parse: ${(performance.now() - _tParsed).toFixed(0)}ms)`,
                );
              console.log(`${LOG} finished`);
            });
        else console.log(`${LOG} finished`);
      })
      .catch(restoreGrid);
  }
}
