import { findGifRuns, findMathSpans } from "./expression";
import {
  canvasSampler,
  parseKindColors,
  parseKindNames,
  type VariableKind,
} from "./kind";
import { loadLinkedPages } from "./loader";
import { formatTokens, tokenizeGifRun, tokenizeMathSpan } from "./token";

declare const __USERSCRIPT_VERSION__: string;

if (document.querySelector('table[summary="Proof of theorem"]')) {
  const banner = document.createElement("div");
  banner.textContent = `MM Site Format ${__USERSCRIPT_VERSION__} active`;
  banner.style.cssText =
    "position:fixed;bottom:0;right:0;background:#333;color:#fff;padding:4px 8px;font-size:12px;opacity:0.8;z-index:9999";
  document.body.appendChild(banner);

  const mathKinds = parseKindNames(document);
  for (const span of findMathSpans(document)) {
    console.log(
      "[mm-site-format]",
      formatTokens(tokenizeMathSpan(span, mathKinds)),
    );
  }
  const gifColors = parseKindColors(document);
  const gifCache = new Map<string, VariableKind | null>();
  const gifRuns = findGifRuns(document);
  // Colour sampling needs the variable images decoded. Let the browser tell us
  // when each is ready via img.decode() rather than guessing a delay.
  const gifImages = gifRuns
    .flat()
    .filter((n): n is HTMLImageElement => n.nodeType === Node.ELEMENT_NODE);
  Promise.all(gifImages.map((img) => img.decode().catch(() => {}))).then(() => {
    for (const imgs of gifRuns) {
      console.log(
        "[mm-site-format]",
        formatTokens(tokenizeGifRun(imgs, gifColors, canvasSampler, gifCache)),
      );
    }
  });

  const pageUrl = window.location.href;
  const fetcher = (url: string) => fetch(url).then((r) => r.text());
  loadLinkedPages(document, pageUrl, fetcher).then((pages) => {
    console.group(`[mm-site-format] ${pages.size} linked pages`);
    for (const [url, linkedDoc] of pages) {
      const name = url.split("/").pop()!.replace(".html", "");
      const heading =
        linkedDoc.querySelector("font[size='+1']")?.textContent?.trim() ?? name;
      const descNode = [...linkedDoc.querySelectorAll("b")].find(
        (b) => b.textContent?.trim() === "Description:",
      );
      const desc = descNode?.parentElement?.textContent
        ?.replace("Description:", "")
        .trim()
        .split(".")[0];
      console.log(`${name}: ${heading}${desc ? " — " + desc : ""}`);
    }
    console.groupEnd();
  });
}
