import "./config";
import { findGifRuns, findMathSpans } from "./expression";
import { installHoverByCaret, installHoverByElement } from "./highlight";
import { canvasSampler } from "./kind";
import {
  parseGifExpressions,
  parseUniExpressions,
  type ParsedExpression,
} from "./page";
import { formatTokens } from "./token";

declare const __USERSCRIPT_VERSION__: string;

const LOG = "[mm-site-format]";

if (!document.querySelector('table[summary="Proof of theorem"]')) {
  console.log(`${LOG} (not a metamath proof page; no processing)`);
} else {
  console.log(`${LOG} processing proof page…`);

  const banner = document.createElement("div");
  banner.textContent = `MM Site Format ${__USERSCRIPT_VERSION__} active`;
  banner.style.cssText =
    "position:fixed;bottom:0;right:0;background:#333;color:#fff;padding:4px 8px;font-size:12px;opacity:0.8;z-index:9999";
  document.body.appendChild(banner);

  const pageUrl = window.location.href;
  const fetcher = (url: string) => fetch(url).then((r) => r.text());

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
    parseUniExpressions(document, pageUrl, fetcher).then(
      finish(installHoverByCaret),
    );
  } else {
    // GIF page: colour sampling needs the variable images decoded, so let the
    // browser signal readiness via img.decode() before parsing. Every token is
    // an element, so hover is element-based.
    const gifImages = findGifRuns(document)
      .flat()
      .filter((n): n is HTMLImageElement => n.nodeType === Node.ELEMENT_NODE);
    Promise.all(gifImages.map((img) => img.decode().catch(() => {})))
      .then(() =>
        parseGifExpressions(document, pageUrl, fetcher, canvasSampler),
      )
      .then(finish(installHoverByElement));
  }
}
