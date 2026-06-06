import { extractTheoremName } from "./utils";

const theoremName = extractTheoremName(window.location.href);
if (theoremName) {
  console.log(`[mm-site-format] proof page: ${theoremName}`);
}
