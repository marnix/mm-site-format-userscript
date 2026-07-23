// Renders a calculation as a two-column layout to place above the proof table.
// Left column: the `<==` operator (on the hint rows), and the parenthesised Ref
// in front of a leaf's expression. Right column: expressions, the
// `{ using premise..., subproofs, and rule }` hints (the non-spine given
// premises, a count word for any nested sub-derivations, and the rule last),
// and -- indented -- the step sub-calculations. Following the spine, a step
// sub-calculation continues the main line and a given (a leaf) ends it; with no
// clear main line the step holds outright instead -- `<==>` down to TRUE. All HTML
// is cloned, so the table is left intact.

import type { Calculation, Given, Step } from "./calculation";
import {
  cachedDiff,
  changedLocationSpans,
  commonSubtreeDiff,
  type DiffAlgorithm,
} from "./diff";
import type { Painter, PaintItem } from "./highlight";
import type { ParsedExpression } from "./page";
import { attachTooltip } from "./tooltip";

export interface RenderOptions {
  fetchRuleTooltip?: (href: string) => Promise<Node | null>;
  /** Maps a cloned expression span (as rendered in the calc table) to its
   *  parsed expression, for diff highlighting. Populated after the second
   *  parse pass; called only on hover so it is always ready in time. */
  exprFor?: (span: HTMLElement) => ParsedExpression | null;
  /** Diff algorithm to use; defaults to commonSubtreeDiff. */
  diffAlgorithm?: DiffAlgorithm;
  /** Painter for the diff highlight. No diff hover when absent. */
  diffPainter?: Painter;
  /** Called after a lazily-rendered section is materialised (e.g. subcalc
   *  expand), so the caller can label proof-ref links in the new content. */
  onLazyRender?: (root: ParentNode) => void;
}

const OPERATOR = "\u21d0"; // the `<==` of the calculation
const TERMINAL = "\u21d4"; // the `<==>` ending a spine with no clear main line, at TRUE

/** Clones an element's content into a fresh inline element. */
function clone(source: Element): HTMLElement {
  const span = document.createElement("span");
  for (const node of source.childNodes) span.appendChild(node.cloneNode(true));
  return span;
}

/** Appends items as an English series: "a", "a and b", "a, b, and c". */
function appendSeries(parent: HTMLElement, items: Node[]): void {
  items.forEach((item, i) => {
    if (i > 0)
      parent.append(
        i < items.length - 1 ? ", " : items.length > 2 ? ", and " : " and ",
      );
    parent.append(item);
  });
}

// Row kinds, laid out by the injected stylesheet (styles.ts): an expression
// line, a `{ using ... }` hint, or an indented nested sub-calculation. The kind
// fixes both the right cell's class and the row's vertical spacing.
type RowKind = "expr" | "hint" | "subcalc";
const CONTENT_CLASS: Record<RowKind, string> = {
  expr: "mm-site-format-calc-expr",
  hint: "mm-site-format-calc-hint",
  subcalc: "mm-site-format-calc-subcalc",
};
const ROW_CLASS: Record<RowKind, string> = {
  expr: "",
  hint: "mm-site-format-calc-row--hint",
  subcalc: "mm-site-format-calc-row--subcalc",
};

/** A two-column row: the operator on the left, `content` on the right, styled by `kind`. */
function row(
  operator: string | Node,
  content: Node,
  kind: RowKind,
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.className = ROW_CLASS[kind];
  const op = document.createElement("td");
  op.className = "mm-site-format-calc-op";
  if (typeof operator === "string") op.textContent = operator;
  else op.appendChild(operator);
  const main = document.createElement("td");
  main.className = CONTENT_CLASS[kind];
  main.appendChild(content);
  tr.append(op, main);
  return tr;
}

// Installs diff hover on the `<==` operator cell: highlights the changed
// token spans in both adjacent expression clones when the operator is hovered.
function installDiffHover(
  opCell: HTMLElement,
  aboveExpr: HTMLElement,
  belowExpr: HTMLElement,
  options: RenderOptions,
): void {
  const painter = options.diffPainter!;
  const algo = options.diffAlgorithm ?? commonSubtreeDiff;
  const exprFor = options.exprFor;

  opCell.style.cursor = "crosshair";
  opCell.addEventListener("mouseenter", () => {
    if (!exprFor) return;
    const above = exprFor(aboveExpr);
    const below = exprFor(belowExpr);
    if (!above?.proof || !below?.proof) return;
    const { unchangedInA, unchangedInB } = cachedDiff(
      algo,
      above.proof,
      below.proof,
    );
    const items: PaintItem[] = [
      ...changedLocationSpans(
        above.proof,
        above.locations.length,
        unchangedInA,
      ).map((span) => ({ locations: above.locations, span })),
      ...changedLocationSpans(
        below.proof,
        below.locations.length,
        unchangedInB,
      ).map((span) => ({ locations: below.locations, span })),
    ];
    painter.paint(items);
  });
  opCell.addEventListener("mouseleave", () => painter.clear());
}

function appendStep(
  step: Step,
  tbody: HTMLElement,
  options?: RenderOptions,
): HTMLElement {
  const expr = clone(step.expressionHtml);
  tbody.appendChild(row("", expr, "expr"));

  // The effective spine continuation (small steps have been folded into
  // foldedRuleRefs by proofTreeToCalculation).
  const effectiveSpine: Calculation | null =
    step.spine !== null ? step.subcalculations[step.spine] : null;

  // Hint: non-spine given premises, subproof count, rule ref, folded rule refs.
  const items: Node[] = [];
  let nested = 0;
  step.subcalculations.forEach((sub, i) => {
    if (i === step.spine) return;
    if (sub.kind === "given") {
      const refEl = clone(sub.hypothesisRefHtml);
      const href =
        sub.hypothesisRefHtml.querySelector("a")?.getAttribute("href") ?? null;
      const fetchRule = options?.fetchRuleTooltip;
      attachTooltip(
        refEl,
        href && fetchRule && !href.startsWith("#")
          ? () => fetchRule(href)
          : () => clone(sub.expressionHtml),
      );
      items.push(refEl);
      // Depth-1 folded given: also include its leaf hypothesis refs.
      for (let li = 0; li < (sub.leafRefHtmls ?? []).length; li++) {
        const leafRef = sub.leafRefHtmls![li];
        const leafEl = clone(leafRef);
        const leafHref =
          leafRef.querySelector("a")?.getAttribute("href") ?? null;
        const leafExpr = sub.leafExpressionHtmls?.[li];
        attachTooltip(
          leafEl,
          leafHref && fetchRule && !leafHref.startsWith("#")
            ? () => fetchRule(leafHref)
            : leafExpr
              ? () => clone(leafExpr)
              : () => clone(sub.expressionHtml),
        );
        items.push(leafEl);
      }
    } else nested++;
  });
  if (nested > 0)
    items.push(
      document.createTextNode(nested === 1 ? "subproof" : "subproofs"),
    );
  const ruleRef = clone(step.inferenceRuleRefHtml);
  const ruleHref =
    step.inferenceRuleRefHtml.querySelector("a")?.getAttribute("href") ?? null;
  const fetchRule = options?.fetchRuleTooltip;
  attachTooltip(
    ruleRef,
    ruleHref && fetchRule
      ? () => fetchRule(ruleHref)
      : () => expr.cloneNode(true) as Node,
  );
  items.push(ruleRef);
  const hint = document.createElement("span");
  hint.append("{ using ");
  appendSeries(hint, items);
  for (const foldedRefEl of step.foldedRuleRefs ?? []) {
    const ref = clone(foldedRefEl);
    const href = foldedRefEl.querySelector("a")?.getAttribute("href") ?? null;
    attachTooltip(
      ref,
      href && fetchRule
        ? () => fetchRule(href)
        : () => expr.cloneNode(true) as Node,
    );
    hint.append("; using ");
    hint.append(ref);
  }
  hint.append(" }");

  const ended = effectiveSpine === null;
  const hintRow = row(ended ? TERMINAL : OPERATOR, hint, "hint");
  tbody.appendChild(hintRow);

  // Non-spine step sub-calculations: indented sub-derivations, in order.
  // Lazy: only build the full DOM when expanded (saves cloning hundreds of
  // expression elements upfront on large pages like GIF fouriersw).
  step.subcalculations.forEach((sub, i) => {
    if (sub.kind === "step" && i !== step.spine) {
      const placeholder = document.createElement("table");
      const pTbody = document.createElement("tbody");
      placeholder.appendChild(pTbody);
      // Show just the conclusion row (the expression of the sub-derivation's
      // root) and a collapse marker; render the rest on first expand.
      const conclusionExpr = clone(sub.expressionHtml);
      pTbody.appendChild(row("", conclusionExpr, "expr"));
      makeLazyCollapsible(placeholder, sub, options);
      tbody.appendChild(row("", placeholder, "subcalc"));
    }
  });

  if (ended) {
    tbody.appendChild(row("", document.createTextNode("TRUE"), "expr"));
    return expr;
  }

  let spineExpr: HTMLElement | null = null;
  if (effectiveSpine?.kind === "given")
    spineExpr = appendGiven(effectiveSpine, tbody, options);
  else if (effectiveSpine?.kind === "step")
    spineExpr = appendStep(effectiveSpine, tbody, options);

  if (options?.diffPainter && spineExpr) {
    const opCell = hintRow.firstElementChild as HTMLElement;
    installDiffHover(opCell, expr, spineExpr, options);
  }

  return expr;
}

/**
 * A given is a leaf (a hypothesis or a 0-assumption axiom/theorem) and ends a
 * spine: its expression is the calculation's last line, with its Ref in the
 * left column, parenthesised, in front of it.
 */
function appendGiven(
  given: Given,
  tbody: HTMLElement,
  options?: RenderOptions,
): HTMLElement {
  const ref = document.createElement("span");
  ref.append("(", clone(given.hypothesisRefHtml), ")");
  const expr = clone(given.expressionHtml);
  const href =
    given.hypothesisRefHtml.querySelector("a")?.getAttribute("href") ?? null;
  const fetchRule = options?.fetchRuleTooltip;
  attachTooltip(
    ref,
    href && fetchRule && !href.startsWith("#")
      ? () => fetchRule(href)
      : () => expr.cloneNode(true) as Node,
  );
  tbody.appendChild(row(ref, expr, "expr"));
  return expr;
}

/**
 * Collapses a sub-calculation by default: only its conclusion (the first row)
 * stays visible, with a disclosure marker that hints at the hidden derivation.
 * Clicking the marker toggles; clicking the hint (visible only when expanded)
 * collapses it again.
 */
function makeCollapsible(table: HTMLTableElement): void {
  const tbody = table.querySelector("tbody");
  const rows = [...(tbody?.children ?? [])] as HTMLElement[];
  if (rows.length < 2) return; // just a conclusion -- nothing to fold away

  const [conclusion, ...rest] = rows;
  const marker = document.createElement("span");
  marker.className = "mm-site-format-fold";
  // In the left (operator) column, so it stays put regardless of the
  // expression's width. The column is right-aligned (to keep operators by the
  // expressions), but the marker stays left-aligned at the column's edge.
  const markerCell = (conclusion.firstElementChild ??
    conclusion) as HTMLElement;
  markerCell.style.textAlign = "left";
  markerCell.appendChild(marker);

  let collapsed = true;
  const refresh = () => {
    for (const r of rest) r.style.display = collapsed ? "none" : "";
    marker.textContent = collapsed ? "\u25b6" : "\u25bc"; // tri-right / tri-down
  };
  const toggle = () => {
    collapsed = !collapsed;
    refresh();
  };
  marker.addEventListener("click", toggle);
  rest[0].style.cursor = "pointer"; // the hint row
  rest[0].addEventListener("click", toggle);
  refresh();
}

/**
 * Like makeCollapsible, but defers rendering the sub-calculation's body until
 * the user first expands it. The table initially shows just a conclusion row
 * with a collapse marker; on first expand, the full calc is rendered in place.
 */
function makeLazyCollapsible(
  table: HTMLTableElement,
  calc: Step,
  options?: RenderOptions,
): void {
  const tbody = table.querySelector("tbody")!;
  const conclusion = tbody.firstElementChild as HTMLElement;

  const marker = document.createElement("span");
  marker.className = "mm-site-format-fold";
  const markerCell = (conclusion.firstElementChild ??
    conclusion) as HTMLElement;
  markerCell.style.textAlign = "left";
  markerCell.appendChild(marker);

  let collapsed = true;
  let rendered = false;
  let restRows: HTMLElement[] = [];

  const expand = () => {
    if (!rendered) {
      // Render the full table and steal ALL its rows, replacing our placeholder
      // conclusion with the real one (so installDiffHover's closure captures the
      // correct expression element).
      const full = renderCalcTable(calc, options);
      const fullTbody = full.querySelector("tbody")!;
      const fullRows = [...fullTbody.children] as HTMLElement[];
      // Replace our placeholder conclusion row with the real one.
      const realConclusion = fullRows[0] as HTMLElement;
      conclusion.replaceWith(realConclusion);
      // Move the marker to the real conclusion row.
      const markerCell = (realConclusion.firstElementChild ??
        realConclusion) as HTMLElement;
      markerCell.style.textAlign = "left";
      markerCell.appendChild(marker);
      // The rest are the hint + spine continuation + subcalcs.
      restRows = fullRows.slice(1);
      for (const r of restRows) tbody.appendChild(r);
      // The first non-conclusion row (the hint) is clickable for collapsing.
      if (restRows.length > 0) {
        restRows[0].style.cursor = "pointer";
        restRows[0].addEventListener("click", toggle);
      }
      rendered = true;
      options?.onLazyRender?.(tbody);
    }
    for (const r of restRows) r.style.display = "";
    marker.textContent = "\u25bc"; // tri-down (expanded)
  };

  const refresh = () => {
    if (collapsed) {
      for (const r of restRows) r.style.display = "none";
      marker.textContent = "\u25b6"; // tri-right (collapsed)
    } else {
      expand();
    }
  };
  const toggle = () => {
    collapsed = !collapsed;
    refresh();
  };
  marker.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });
  // The conclusion row itself is clickable (no separate hint row yet).
  conclusion.style.cursor = "pointer";
  conclusion.addEventListener("click", toggle);
  refresh();
}

export function renderCalcTable(
  calc: Calculation,
  options?: RenderOptions,
): HTMLTableElement {
  const table = document.createElement("table");
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  if (calc.kind === "given") appendGiven(calc, tbody, options);
  else appendStep(calc, tbody, options);
  return table;
}

/** Renders a calculation as a DOM element (expressions joined by `<==` hints). */
export function renderCalculation(
  calc: Calculation,
  options?: RenderOptions,
): HTMLElement {
  const box = document.createElement("div");
  box.className = "mm-site-format-calc";
  box.appendChild(renderCalcTable(calc, options));
  return box;
}
