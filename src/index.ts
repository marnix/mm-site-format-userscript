import "./config";
import { proofTreeToCalculation, type ProofTree } from "./calculation";
import { findMathSpans } from "./expression";
import { installHoverByCaret, installHoverByElement } from "./highlight";
import { canvasSampler } from "./kind";
import {
  parseGifExpressions,
  parseUniExpressions,
  type ParsedExpression,
} from "./page";
import type { Proof } from "./proof";
import { renderCalculation } from "./render";
import { chooseSpine } from "./spine";
import { parseProofTable } from "./table";
import { formatTokens } from "./token";

declare const __USERSCRIPT_VERSION__: string;
declare const __USERSCRIPT_BUILD_TIME__: string;

const LOG = "[mm-site-format]";

if (!document.querySelector('table[summary="Proof of theorem"]')) {
  console.log(`${LOG} (not a metamath proof page; no processing)`);
} else {
  console.log(`${LOG} processing proof page…`);

  const banner = document.createElement("div");
  const built = __USERSCRIPT_BUILD_TIME__
    ? ` — built ${__USERSCRIPT_BUILD_TIME__}`
    : "";
  banner.textContent = `MM Site Format ${__USERSCRIPT_VERSION__} active${built}`;
  banner.style.cssText =
    "position:fixed;bottom:0;right:0;background:#333;color:#fff;padding:4px 8px;font-size:12px;opacity:0.8;z-index:9999";
  document.body.appendChild(banner);

  // Capture the proof tree now (its Expression-cell clones predate the
  // whitespace pass); render the calculation once expressions are parsed, so the
  // spine can be chosen from their parse trees.
  const proofTable = document.querySelector(
    'table[summary="Proof of theorem"]',
  );
  const proofTree = parseProofTable(document);

  // A spine chooser backed by the page's parsed expressions: each step's spine
  // is the sub-proof whose parse tree most overlaps the step's (matched to a
  // ParsedExpression by which original Expression cell contains it).
  const spineChooser = (results: ParsedExpression[]) => {
    const cache = new Map<ProofTree, Proof | null>();
    const parseOf = (node: ProofTree): Proof | null => {
      const cached = cache.get(node);
      if (cached !== undefined) return cached;
      let found: Proof | null = null;
      const cell = node.expressionCell;
      if (cell)
        for (const r of results) {
          const at = r.locations[0]?.node;
          if (r.proof && at && cell.contains(at)) {
            found = r.proof;
            break;
          }
        }
      cache.set(node, found);
      return found;
    };
    return (node: ProofTree): number | null => {
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
  };

  const showCalculation = (results: ParsedExpression[]): HTMLElement | null => {
    if (!proofTree || !proofTable) return null;
    const calc = proofTreeToCalculation(proofTree, spineChooser(results));
    const rendered = renderCalculation(calc);
    const caption = proofTable.querySelector("caption");
    if (caption) caption.appendChild(rendered);
    else proofTable.parentNode?.insertBefore(rendered, proofTable);
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
    // Many tokens are bare text, so hover is caret-based.
    parseUniExpressions(document, pageUrl, fetcher).then((results) => {
      finish(installHoverByCaret)(results);
      // The calculation clones expressions; give those clones the same parsing,
      // whitespace and hover by running the pass again, scoped to the calc.
      const calc = showCalculation(results);
      if (calc)
        parseUniExpressions(document, pageUrl, fetcher, calc).then(
          installHoverByCaret,
        );
    });
  } else {
    // GIF page: colour sampling needs the variable images decoded, so let the
    // browser signal readiness via img.decode() before parsing. Every token is
    // an element, so hover is element-based.
    const decoded = (imgs: HTMLImageElement[]) =>
      Promise.all(imgs.map((img) => img.decode().catch(() => {})));
    const gifImages = (root: ParentNode) =>
      [...root.querySelectorAll("img")] as HTMLImageElement[];
    decoded(gifImages(document))
      .then(() =>
        parseGifExpressions(document, pageUrl, fetcher, canvasSampler),
      )
      .then((results) => {
        finish(installHoverByElement)(results);
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
              ),
            )
            .then(installHoverByElement);
      });
  }
}
