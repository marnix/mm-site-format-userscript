// Floating HTML tooltip for ref elements in the calculation view. Absorbs the
// native browser `title` tooltip by stripping it from links at attach time and
// showing its text as a second section below the expression.

let tooltipEl: HTMLElement | null = null;

function getTooltip(): HTMLElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.className = "mm-site-format-ref-tooltip";
    tooltipEl.style.display = "none";
  }
  if (!tooltipEl.isConnected) document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function positionTooltip(tt: HTMLElement, e: MouseEvent): void {
  const GAP = 12;
  const ttRect = tt.getBoundingClientRect();
  let left = e.clientX + GAP;
  let top = e.clientY + GAP;
  if (window.innerWidth > 0 && left + ttRect.width > window.innerWidth)
    left = e.clientX - ttRect.width - GAP;
  if (window.innerHeight > 0 && top + ttRect.height > window.innerHeight)
    top = e.clientY - ttRect.height - GAP;
  tt.style.left = `${Math.round(Math.max(0, left))}px`;
  tt.style.top = `${Math.round(Math.max(0, top))}px`;
}

/**
 * Attaches a tooltip to `ref` that shows the expression and (if any `<a>`
 * inside `ref` had a `title` attribute) the original tooltip text below it.
 * `title` attrs are stripped eagerly so the browser's native tooltip never
 * fires. `getContent` is called lazily at hover time; it may return a Node
 * directly or a Promise<Node> — in the latter case a `…` placeholder is shown
 * until the promise resolves, and the result is discarded if the mouse left.
 */
export function attachTooltip(
  ref: HTMLElement,
  getContent: () => Node | null | Promise<Node | null>,
): void {
  // Collect and strip native title attrs now (before first hover): check ref
  // itself first (handles the case where ref IS the <a>), then descendants.
  const titles: string[] = [];
  if (ref.hasAttribute("title")) {
    titles.push(ref.getAttribute("title")!);
    ref.removeAttribute("title");
  }
  for (const a of ref.querySelectorAll<Element>("a[title]")) {
    titles.push(a.getAttribute("title")!);
    a.removeAttribute("title");
  }

  const populate = (tt: HTMLElement, node: Node) => {
    tt.replaceChildren(node);
    if (titles.length > 0) {
      const desc = document.createElement("div");
      desc.className = "mm-site-format-ref-tooltip-desc";
      desc.textContent = titles.join("\n");
      tt.appendChild(desc);
    }
  };

  let lastEvent: MouseEvent | null = null;

  ref.addEventListener("mouseenter", (e: MouseEvent) => {
    lastEvent = e;
    const tt = getTooltip();
    const result = getContent();
    if (result instanceof Promise) {
      tt.replaceChildren(document.createTextNode("…"));
      tt.style.display = "";
      positionTooltip(tt, e);
      result
        .then((node) => {
          if (!lastEvent) return; // mouse left while loading
          if (node === null) {
            tt.style.display = "none";
            return;
          }
          populate(tt, node);
          positionTooltip(tt, lastEvent);
        })
        .catch(() => {});
    } else if (result !== null) {
      populate(tt, result);
      tt.style.display = "";
      positionTooltip(tt, e);
    }
  });

  ref.addEventListener("mouseleave", () => {
    lastEvent = null;
    getTooltip().style.display = "none";
  });
}
