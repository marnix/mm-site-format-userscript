import "./config";
import { createCache, type KeyValueStore } from "./cache";
import { proofTreeToCalculation, type ProofTree } from "./calculation";
import { findMathSpans } from "./expression";
import { GRAMMAR_CACHE_VERSION } from "./grammar";
import { indentProofExpressions } from "./indent";
import { installHover } from "./highlight";
import { canvasSampler } from "./kind";
import {
  parseGifExpressions,
  parseUniExpressions,
  type ParsedExpression,
} from "./page";
import type { Proof } from "./proof";
import { renderCalculation, setCalcCollapsed } from "./render";
import { chooseSpine, isSmallStep } from "./spine";
import { injectStyles } from "./styles";
import { parseProofTable } from "./table";
import { formatTokens } from "./token";
import { applyViewToLinks, installViewToggle, tableSelected } from "./view";

declare const __USERSCRIPT_VERSION__: string;
declare const __USERSCRIPT_BUILD_TIME__: string;

const LOG = "[mm-site-format]";

// On any matching page, before deciding whether this is a proof page: make every
// metamath.org link agree with the current view (carry the table choice, or
// leave plain URLs alone for the calculational default).
applyViewToLinks(tableSelected(window.location.search));

if (!document.querySelector('table[summary="Proof of theorem"]')) {
  console.log(`${LOG} (not a metamath proof page; no processing)`);
} else {
  console.log(`${LOG} processing proof page…`);
  injectStyles();

  const banner = document.createElement("div");
  const built = __USERSCRIPT_BUILD_TIME__
    ? ` — built ${__USERSCRIPT_BUILD_TIME__}`
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
  const proofTree = parseProofTable(document);

  // Hang-indent the proof table's wrapped Expression lines. Do it now, while the
  // table is still laid out and visible (before the early grid hide below).
  if (proofTable) indentProofExpressions(proofTable);

  // When the calculation will replace the grid, hide the grid body at once —
  // keeping its space so the page below does not jump — and reveal the
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

    const spineFor = (node: ProofTree): number | null => {
      const conclusion = parseOf(node);
      const subs = node.subproofs.map((s) => ({
        parse: parseOf(s),
        trivial: s.subproofs.length === 0,
      }));
      // Without parse trees, fall back to the first sub-proof; otherwise a null
      // from chooseSpine means "no clear main line" — end the spine.
      if (!conclusion || subs.some((s) => !s.parse)) return 0;
      return chooseSpine(
        conclusion,
        subs as { parse: Proof; trivial: boolean }[],
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
    return { spineFor, smallFor };
  };

  // Fix the calculation box to its fully-expanded width, so expanding a
  // sub-calculation never reflows the box — but as a responsive `max-width`, so
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
    // The measured max-content is slightly too small (some lines still wrap), so
    // add 10%. TODO: find the real cause, drop the fudge.
    box.style.width = `${Math.round(rect.width * 1.1)}px`;
    // Clamp to the page's content width in CSS, so the box shrinks (and wraps)
    // when the window is narrower than its natural width and grows back on
    // widening, with no re-measure on resize. The box is centered (it sits in a
    // `<center>`), so the centering offset is NOT a reduction of available width
    // — only the body margins + scrollbar are, and those are ~stable, so we bake
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

  const showCalculation = (results: ParsedExpression[]): HTMLElement | null => {
    if (!proofTree || !proofTable) return null;
    const { spineFor, smallFor } = choosers(results);
    const calc = proofTreeToCalculation(proofTree, spineFor, smallFor);
    const rendered = renderCalculation(calc);
    // Into the caption, below the "Proof of Theorem" heading — so the heading
    // stays in place whichever view is shown.
    const caption = proofTable.querySelector("caption");
    if (caption) caption.appendChild(rendered);
    else proofTable.parentNode?.insertBefore(rendered, proofTable);
    installViewToggle(rendered, proofTable);
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

  const finish =
    (install: (results: ParsedExpression[]) => void) =>
    (results: ParsedExpression[]) => {
      for (const { tokens, proof } of results) {
        if (!proof)
          console.log(`${LOG} could not parse:`, formatTokens(tokens));
      }
      install(results);
      console.log(`${LOG} finished`);
    };

  if (findMathSpans(document).length > 0) {
    // Unicode page: kinds come from span classes, no image sampling needed.
    parseUniExpressions(document, pageUrl, fetcher, document, cache)
      .then((results) => {
        finish(installHover)(results);
        // The calculation clones expressions; give those clones the same
        // parsing, whitespace and hover by running the pass again, scoped to it.
        const calc = showCalculation(results);
        if (calc)
          parseUniExpressions(document, pageUrl, fetcher, calc, cache).then(
            (calcResults) => {
              installHover(calcResults);
              sizeToExpandedWidth(calc); // after spacers are inserted
            },
          );
      })
      .catch(restoreGrid);
  } else {
    // GIF page: colour sampling needs the variable images decoded, so let the
    // browser signal readiness via img.decode() before parsing.
    const decoded = (imgs: HTMLImageElement[]) =>
      Promise.all(imgs.map((img) => img.decode().catch(() => {})));
    const gifImages = (root: ParentNode) =>
      [...root.querySelectorAll("img")] as HTMLImageElement[];
    decoded(gifImages(document))
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
        finish(installHover)(results);
        const calc = showCalculation(results);
        if (calc)
          decoded(gifImages(calc))
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
              installHover(calcResults);
              sizeToExpandedWidth(calc); // after spacers are inserted
            });
      })
      .catch(restoreGrid);
  }
}
