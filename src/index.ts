import { findGifRuns, findMathSpans } from "./expression";
import { canvasSampler, parseKindNames } from "./kind";
import { parseGifExpressions } from "./page";
import { formatTokens, tokenizeMathSpan } from "./token";

declare const __USERSCRIPT_VERSION__: string;

if (document.querySelector('table[summary="Proof of theorem"]')) {
  const banner = document.createElement("div");
  banner.textContent = `MM Site Format ${__USERSCRIPT_VERSION__} active`;
  banner.style.cssText =
    "position:fixed;bottom:0;right:0;background:#333;color:#fff;padding:4px 8px;font-size:12px;opacity:0.8;z-index:9999";
  document.body.appendChild(banner);

  // Unicode pages: tokens with kinds (parsing is GIF-first for now).
  const mathKinds = parseKindNames(document);
  for (const span of findMathSpans(document)) {
    console.log(
      "[mm-site-format]",
      formatTokens(tokenizeMathSpan(span, mathKinds)),
    );
  }

  // GIF pages: parse each expression and log "✓/✗ <expression with kinds>".
  // Colour sampling needs the variable images decoded — let the browser signal
  // readiness via img.decode() rather than guessing a delay.
  const gifImages = findGifRuns(document)
    .flat()
    .filter((n): n is HTMLImageElement => n.nodeType === Node.ELEMENT_NODE);
  const fetcher = (url: string) => fetch(url).then((r) => r.text());
  Promise.all(gifImages.map((img) => img.decode().catch(() => {})))
    .then(() =>
      parseGifExpressions(
        document,
        window.location.href,
        fetcher,
        canvasSampler,
      ),
    )
    .then((results) => {
      for (const { tokens, proof } of results) {
        console.log(
          "[mm-site-format]",
          proof ? "✓" : "✗",
          formatTokens(tokens),
        );
      }
    });
}
