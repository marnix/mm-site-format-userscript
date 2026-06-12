// A switch between the calculation and the proof table, showing one and hiding
// the other while the "Proof of Theorem" caption (heading) stays in place. The
// options are prepended to the page's existing top-right "… version" line (or a
// fixed box if that line is absent). The calculation is the default; a
// `view=table` query parameter selects the table, so a plain URL stays
// calculational. The choice is remembered in the URL via history.replaceState,
// without reloading.

const PARAM = "view";
const TABLE = "table";

/** Whether the table view is selected by a URL search string (e.g. `?view=table`). */
export function tableSelected(search: string): boolean {
  return new URLSearchParams(search).get(PARAM) === TABLE;
}

/** The search string ("?…" or "") with the view parameter set or cleared. */
export function searchWithView(search: string, table: boolean): string {
  const params = new URLSearchParams(search);
  if (table) params.set(PARAM, TABLE);
  else params.delete(PARAM);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** The page's existing "… version" links line, found by one of its anchors. */
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
  tableWidth: number,
): void {
  const grids = [...proofTable.tBodies] as HTMLElement[];
  let table = tableSelected(location.search);

  // The calculation sits in the table's caption. As a full-width block it would
  // stretch to the page once the grid is hidden, so lay it out as an
  // inline-block (shrinking to its content); but hold it to at least the width
  // the table had before the calculation was inserted, so it is as wide as the
  // table would have been (and no wider than its own content needs).
  if (tableWidth) calc.style.minWidth = `${Math.round(tableWidth)}px`;

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
  const refresh = () => {
    link.textContent = table ? "Calculation version" : "Table version";
    link.href = here(!table);
  };
  link.addEventListener("click", (event: Event) => {
    event.preventDefault();
    table = !table;
    apply();
    refresh();
    history.replaceState(null, "", here(table));
  });

  const line = versionLine();
  if (line) {
    line.prepend(link, "  ");
  } else {
    const box = document.createElement("div");
    box.className = "mm-site-format-view";
    box.style.cssText =
      "position:fixed;top:0;right:0;background:#f4f4f4;border:1px solid #ccc;" +
      "border-top:none;border-right:none;padding:4px 8px;font-size:13px;z-index:9999";
    box.append(link);
    document.body.appendChild(box);
  }

  apply();
  refresh();
}
