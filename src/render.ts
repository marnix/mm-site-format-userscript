// Renders a calculation as a two-column layout to place above the proof table.
// Left column: the `⇐` operator (on the hint rows). Right column: expressions,
// the `{ rule }` hints, and — indented — the step sub-calculations. Following
// the spine, the spine sub-calculation continues the main line (a given just
// contributes its expression; given Refs are not rendered for now). All HTML is
// cloned, so the table is left intact.

import type { Calculation, Step } from "./calculation";

const OPERATOR = "⇐"; // the `<==` of the calculation

/** Clones an element's content into a fresh inline element. */
function clone(source: Element): HTMLElement {
  const span = document.createElement("span");
  for (const node of source.childNodes) span.appendChild(node.cloneNode(true));
  return span;
}

// EWD1300 layout: expressions stay at the base; the hint is indented after the
// operator. Sub-calculations are indented further, with vertical space so
// consecutive ones do not run together.
const HINT_INDENT = "padding-left:1.5em";
const SUBCALC_STYLE = "padding-left:2em;padding-top:0.6em;padding-bottom:0.6em";

/** A two-column row: the operator on the left, `content` on the right. */
function row(
  operator: string,
  content: Node,
  contentStyle = "",
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const op = document.createElement("td");
  op.style.cssText =
    "border:none;padding:0 0.6em 0 0;vertical-align:top;white-space:nowrap";
  op.textContent = operator;
  const main = document.createElement("td");
  main.style.cssText = `border:none;padding:0;vertical-align:top;${contentStyle}`;
  main.appendChild(content);
  tr.append(op, main);
  return tr;
}

function appendStep(step: Step, tbody: HTMLElement): void {
  tbody.appendChild(row("", clone(step.expressionHtml)));

  const hint = document.createElement("span");
  hint.append("{ ", clone(step.inferenceRuleRefHtml), " }");
  tbody.appendChild(row(OPERATOR, hint, HINT_INDENT));

  // Non-spine step sub-calculations: indented sub-derivations, in order, each
  // set apart vertically.
  step.subcalculations.forEach((sub, i) => {
    if (sub.kind === "step" && i !== step.spine)
      tbody.appendChild(row("", renderCalcTable(sub), SUBCALC_STYLE));
  });

  // The spine continues the main line: a step extends it; a given contributes
  // its expression (its Ref is not rendered for now).
  const spine = step.subcalculations[step.spine];
  if (spine?.kind === "given")
    tbody.appendChild(row("", clone(spine.expressionHtml)));
  else if (spine?.kind === "step") appendStep(spine, tbody);
}

function renderCalcTable(calc: Calculation): HTMLTableElement {
  const table = document.createElement("table");
  table.style.cssText = "border:none;border-collapse:collapse;margin:0";
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  if (calc.kind === "given")
    tbody.appendChild(row("", clone(calc.expressionHtml)));
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
