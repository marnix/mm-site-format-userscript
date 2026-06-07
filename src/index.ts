import { extractTheoremName } from "./utils";
import { loadLinkedPages } from "./loader";

const pageUrl = window.location.href;
const theoremName = extractTheoremName(pageUrl);

if (theoremName) {
  const banner = document.createElement("div");
  banner.textContent = `mm-site-format has been loaded: ${theoremName}`;
  banner.style.cssText =
    "position:fixed;bottom:0;right:0;background:#333;color:#fff;padding:4px 8px;font-size:12px;opacity:0.8;z-index:9999";
  document.body.appendChild(banner);

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
