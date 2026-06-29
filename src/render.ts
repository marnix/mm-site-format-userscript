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
import { attachTooltip } from "./tooltip";

export interface RenderOptions {
  fetchRuleTooltip?: (href: string) => Promise<Node | null>;
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

function appendStep(
  step: Step,
  tbody: HTMLElement,
  options?: RenderOptions,
): void {
  const expr = clone(step.expressionHtml);
  tbody.appendChild(row("", expr, "expr"));

  // Fold small-step spines: walk the spine chain while each step has smallSpine,
  // collecting their rule refs to merge into this step's hint.  The intermediate
  // expressions are omitted entirely.
  const foldedSteps: Step[] = [];
  let effectiveSpine: Calculation | null =
    step.spine !== null ? step.subcalculations[step.spine] : null;
  while (effectiveSpine?.kind === "step" && effectiveSpine.smallSpine) {
    foldedSteps.push(effectiveSpine);
    effectiveSpine =
      effectiveSpine.spine !== null
        ? effectiveSpine.subcalculations[effectiveSpine.spine]
        : null;
  }

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
  for (const folded of foldedSteps) {
    const foldedRef = clone(folded.inferenceRuleRefHtml);
    const foldedHref =
      folded.inferenceRuleRefHtml.querySelector("a")?.getAttribute("href") ??
      null;
    attachTooltip(
      foldedRef,
      foldedHref && fetchRule
        ? () => fetchRule(foldedHref)
        : () => clone(folded.expressionHtml),
    );
    hint.append("; using ");
    hint.append(foldedRef);
  }
  hint.append(" }");

  const ended = effectiveSpine === null;
  tbody.appendChild(row(ended ? TERMINAL : OPERATOR, hint, "hint"));

  // Non-spine step sub-calculations: indented sub-derivations, in order.
  step.subcalculations.forEach((sub, i) => {
    if (sub.kind === "step" && i !== step.spine) {
      const table = renderCalcTable(sub, options);
      makeCollapsible(table);
      tbody.appendChild(row("", table, "subcalc"));
    }
  });

  if (ended) {
    tbody.appendChild(row("", document.createTextNode("TRUE"), "expr"));
    return;
  }

  if (effectiveSpine?.kind === "given")
    appendGiven(effectiveSpine, tbody, options);
  else if (effectiveSpine?.kind === "step")
    appendStep(effectiveSpine, tbody, options);
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
): void {
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
}

// While a calculation is being built, each collapsible sub-calculation registers
// a setter here; renderCalculation hands them to setCalcCollapsed via a WeakMap,
// so a caller can expand everything (e.g. to measure the full width) and then
// collapse it again.
const collapseSetters = new WeakMap<
  HTMLElement,
  ((collapsed: boolean) => void)[]
>();
let pendingSetters: ((collapsed: boolean) => void)[] | null = null;

/** Expand (`false`) or collapse (`true`) every sub-calculation of a rendered box. */
export function setCalcCollapsed(box: HTMLElement, collapsed: boolean): void {
  for (const set of collapseSetters.get(box) ?? []) set(collapsed);
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
    marker.textContent = collapsed ? "\u25b6" : "\u25bc";
  };
  const toggle = () => {
    collapsed = !collapsed;
    refresh();
  };
  marker.addEventListener("click", toggle);
  rest[0].style.cursor = "pointer"; // the hint row
  rest[0].addEventListener("click", toggle);
  refresh();
  pendingSetters?.push((c) => {
    collapsed = c;
    refresh();
  });
}

function renderCalcTable(
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
  // Styled by styles.ts (.mm-site-format-calc); `border-box` there lets the
  // explicit width index.ts sets (the fully-expanded width) include the padding
  // and border rather than overflowing the page.
  box.className = "mm-site-format-calc";
  pendingSetters = [];
  box.appendChild(renderCalcTable(calc, options));
  collapseSetters.set(box, pendingSetters);
  pendingSetters = null;
  return box;
}
