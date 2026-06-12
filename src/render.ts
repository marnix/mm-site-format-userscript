// Renders a calculation as a two-column layout to place above the proof table.
// Left column: the `⇐` operator (on the hint rows), and the parenthesised Ref
// in front of a leaf's expression. Right column: expressions, the
// `{ using premise…, subproofs, and rule }` hints (the non-spine given
// premises, a count word for any nested sub-derivations, and the rule last),
// and — indented — the step sub-calculations. Following the spine, a step
// sub-calculation continues the main line and a given (a leaf) ends it; with no
// clear main line the step holds outright instead — `⇔` down to TRUE. All HTML
// is cloned, so the table is left intact.

import type { Calculation, Given, Step } from "./calculation";

const OPERATOR = "⇐"; // the `<==` of the calculation
const TERMINAL = "⇔"; // the `<==>` ending a spine with no clear main line, at TRUE

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

// EWD1300 layout: expressions stay at the base; the hint is indented after the
// operator; sub-calculations are indented further. Vertical space is symmetric
// around each hint (HINT_VSPACE above and below); sub-calculations get more
// (SUBCALC_VSPACE, ~1.5–2×) so they stand apart. Long expressions wrap with a
// hanging indent.
const HINT_VSPACE = "0.3em";
const SUBCALC_VSPACE = "0.5em";
// The hint is indented 1.5em; when it wraps, the continuation hangs by the
// width of the leading "{ " (≈1.3ch) so it lines up under the list.
const HINT_INDENT = "padding-left:calc(1.5em + 1.3ch);text-indent:-1.3ch";
const SUBCALC_INDENT = "padding-left:2em";
const EXPR_STYLE = "padding-left:1.6em;text-indent:-1.6em"; // hanging indent

/** A two-column row: the operator on the left, `content` on the right.
 *  `vspace` is the symmetric top/bottom padding; `contentStyle` styles the
 *  right cell. */
function row(
  operator: string | Node,
  content: Node,
  vspace = "0",
  contentStyle = "",
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const op = document.createElement("td");
  op.style.cssText = `border:none;padding:${vspace} 0.6em ${vspace} 0;vertical-align:top;white-space:nowrap;text-align:right`;
  if (typeof operator === "string") op.textContent = operator;
  else op.appendChild(operator);
  const main = document.createElement("td");
  main.style.cssText = `border:none;padding:${vspace} 0;vertical-align:top;${contentStyle}`;
  main.appendChild(content);
  tr.append(op, main);
  return tr;
}

function appendStep(step: Step, tbody: HTMLElement): void {
  tbody.appendChild(row("", clone(step.expressionHtml), "0", EXPR_STYLE));

  // Hint: the non-spine given premises (each by its Ref), then
  // "subproof"/"subproofs" if any non-spine premise is itself a derivation
  // (those are shown below), and the inference rule last. The spine premise
  // continues the main line below.
  const items: Node[] = [];
  let nested = 0;
  step.subcalculations.forEach((sub, i) => {
    if (i === step.spine) return;
    if (sub.kind === "given") items.push(clone(sub.hypothesisRefHtml));
    else nested++;
  });
  if (nested > 0)
    items.push(
      document.createTextNode(nested === 1 ? "subproof" : "subproofs"),
    );
  items.push(clone(step.inferenceRuleRefHtml));
  const hint = document.createElement("span");
  hint.append("{ using ");
  appendSeries(hint, items);
  hint.append(" }");
  // With no clear main line (spine === null) the step holds outright: `⇔` down
  // to TRUE, justified by all its sub-proofs; otherwise the spine continues.
  const ended = step.spine === null;
  tbody.appendChild(
    row(ended ? TERMINAL : OPERATOR, hint, HINT_VSPACE, HINT_INDENT),
  );

  // Non-spine step sub-calculations: indented sub-derivations, in order, each
  // set apart with extra vertical space and collapsed by default.
  step.subcalculations.forEach((sub, i) => {
    if (sub.kind === "step" && i !== step.spine) {
      const table = renderCalcTable(sub);
      makeCollapsible(table);
      tbody.appendChild(row("", table, SUBCALC_VSPACE, SUBCALC_INDENT));
    }
  });

  if (ended) {
    tbody.appendChild(
      row("", document.createTextNode("TRUE"), "0", EXPR_STYLE),
    );
    return;
  }

  // The spine continues the main line: a step extends it; a given ends it (its
  // expression is the last line, with its Ref in the left column).
  const spine = step.subcalculations[step.spine as number];
  if (spine?.kind === "given") appendGiven(spine, tbody);
  else if (spine?.kind === "step") appendStep(spine, tbody);
}

/**
 * A given is a leaf (a hypothesis or a 0-assumption axiom/theorem) and ends a
 * spine: its expression is the calculation's last line, with its Ref in the
 * left column, parenthesised, in front of it.
 */
function appendGiven(given: Given, tbody: HTMLElement): void {
  const ref = document.createElement("span");
  ref.append("(", clone(given.hypothesisRefHtml), ")");
  tbody.appendChild(row(ref, clone(given.expressionHtml), "0", EXPR_STYLE));
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
  if (rows.length < 2) return; // just a conclusion — nothing to fold away

  const [conclusion, ...rest] = rows;
  const marker = document.createElement("span");
  marker.className = "mm-site-format-fold";
  marker.style.cssText = "cursor:pointer;user-select:none;opacity:0.6";
  // In the left (operator) column, so it stays put regardless of the
  // expression's width; ▶/▼ are larger glyphs than the small ▸/▾. The column is
  // right-aligned (to keep operators by the expressions), but the marker stays
  // left-aligned at the column's edge.
  const markerCell = (conclusion.firstElementChild ??
    conclusion) as HTMLElement;
  markerCell.style.textAlign = "left";
  markerCell.appendChild(marker);

  let collapsed = true;
  const refresh = () => {
    for (const r of rest) r.style.display = collapsed ? "none" : "";
    marker.textContent = collapsed ? "▶" : "▼";
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

function renderCalcTable(calc: Calculation): HTMLTableElement {
  const table = document.createElement("table");
  table.style.cssText = "border:none;border-collapse:collapse;margin:0";
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  if (calc.kind === "given") appendGiven(calc, tbody);
  else appendStep(calc, tbody);
  return table;
}

/** Renders a calculation as a DOM element (expressions joined by `⇐` hints). */
export function renderCalculation(calc: Calculation): HTMLElement {
  const box = document.createElement("div");
  box.className = "mm-site-format-calc";
  // No font change; just lay it out left-aligned at normal weight.
  box.style.cssText =
    "border:1px solid #ccc;padding:6px 10px;margin:8px 0;text-align:left;font-weight:normal";
  box.appendChild(renderCalcTable(calc));
  return box;
}
