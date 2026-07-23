// A switch between the calculation and the proof table, showing one and hiding
// the other while the "Proof of Theorem" caption (heading) stays in place. The
// options are prepended to the page's existing top-right "... version" line (or a
// fixed box if that line is absent). The calculation is the default; a
// `view=table` query parameter selects the table, so a plain URL stays
// calculational. Toggling updates the URL via history.pushState (without
// reloading), so Back/Forward move between views (a popstate handler re-applies
// the view from the URL).

const PARAM = "view";
const TABLE = "table";

/** Whether the table view is selected by a URL search string (e.g. `?view=table`). */
export function tableSelected(search: string): boolean {
  return new URLSearchParams(search).get(PARAM) === TABLE;
}

/** The search string ("?..." or "") with the view parameter set or cleared. */
export function searchWithView(search: string, table: boolean): string {
  const params = new URLSearchParams(search);
  if (table) params.set(PARAM, TABLE);
  else params.delete(PARAM);
  const s = params.toString();
  return s ? `?${s}` : "";
}

const TOGGLE_CLASS = "mm-site-format-view"; // the view switch's own link/box

/**
 * The same link with the `view` parameter set (table) or cleared (calculation)
 * to match `table`, if it points to a metamath.org page and needs the change;
 * otherwise null. `href` is resolved against `base`.
 */
export function linkWithView(
  href: string,
  base: string,
  table: boolean,
): string | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname;
  if (host !== "metamath.org" && !host.endsWith(".metamath.org")) return null;
  if ((url.searchParams.get(PARAM) === TABLE) === table) return null; // unchanged
  if (table) url.searchParams.set(PARAM, TABLE);
  else url.searchParams.delete(PARAM);
  return url.href;
}

/**
 * Make every link to a metamath.org page agree with the current view: add
 * `view=table` for the table view, clear it for the calculation view, so the
 * choice persists as the user navigates. Runs both on load and whenever the view
 * switch is toggled. Same-page fragment links and the switch's own link are left
 * alone.
 */
export function applyViewToLinks(table: boolean): void {
  for (const anchor of document.querySelectorAll("a[href]")) {
    const a = anchor as HTMLAnchorElement;
    if (a.classList.contains(TOGGLE_CLASS)) continue;
    if (a.getAttribute("href")?.startsWith("#")) continue;
    const next = linkWithView(a.href, location.href, table);
    if (next) a.href = next;
  }
}

/** The page's existing "... version" links line, found by one of its anchors. */
function versionLine(): Element | null {
  for (const a of document.querySelectorAll("a"))
    if (/\bversion\b/i.test(a.textContent ?? "") && a.parentElement)
      return a.parentElement;
  return null;
}

/**
 * Installs the Calculation/Table switch over the rendered calculation and the
 * proof table, applying the URL-selected view and remembering changes in the
 * URL. Toggling shows one and hides the other; only the table's body is hidden,
 * so the caption heading stays put.
 */
export function installViewToggle(
  calc: HTMLElement,
  proofTable: HTMLTableElement,
): void {
  const grids = [...proofTable.tBodies] as HTMLElement[];
  let table = tableSelected(location.search);

  const apply = () => {
    calc.style.display = table ? "none" : "inline-block";
    // With the grid hidden, the table's own BORDER would still draw a stray line
    // around the bare caption; suppress it in the calculation view.
    proofTable.style.border = table ? "" : "none";
    for (const grid of grids) {
      grid.style.display = table ? "" : "none";
      grid.style.visibility = ""; // clear any early hide-with-space
    }
  };

  const here = (forTable: boolean) =>
    location.pathname +
    searchWithView(location.search, forTable) +
    location.hash;
  // A single link offering the *other* view; clicking it switches.
  const link = document.createElement("a");
  link.className = TOGGLE_CLASS; // so applyViewToLinks leaves it alone
  const refresh = () => {
    link.textContent = table ? "Calculation version" : "Table version";
    link.href = here(!table);
  };
  const setView = (next: boolean, pushHistory: boolean) => {
    table = next;
    apply();
    refresh();
    if (pushHistory) history.pushState(null, "", here(table));
    applyViewToLinks(table); // keep the page's links in sync with the view
  };
  link.addEventListener("click", (event: Event) => {
    event.preventDefault();
    // Push a history entry, so Back restores the previous view.
    setView(!table, true);
  });
  // Follow Back/Forward between those entries (the URL has already changed).
  window.addEventListener("popstate", () =>
    setView(tableSelected(location.search), false),
  );

  const line = versionLine();
  if (line) {
    line.prepend(link, "\u00a0\u00a0"); // non-breaking spaces
  } else {
    const box = document.createElement("div");
    // TOGGLE_CLASS so applyViewToLinks skips it; the -view-box class styles it.
    box.className = `${TOGGLE_CLASS} mm-site-format-view-box`;
    box.append(link);
    document.body.appendChild(box);
  }

  apply();
  refresh();
}
