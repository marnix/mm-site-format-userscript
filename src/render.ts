// Renders a calculation as a DOM element to place above the proof table.
// Following the spine: a step shows its expression, then a hint with its
// inference-rule Ref and any given sub-calculations (Ref + expression) embedded;
// step sub-calculations are rendered indented under the hint, in order. All HTML
// is cloned, so the table is left intact.

import type { Calculation, Step } from "./calculation";

/** Clones an element's content into a fresh inline element. */
function clone(source: Element): HTMLElement {
  const span = document.createElement("span");
  for (const node of source.childNodes) span.appendChild(node.cloneNode(true));
  return span;
}

function renderStep(step: Step, container: HTMLElement): void {
  const expr = document.createElement("div");
  expr.appendChild(clone(step.expressionHtml));
  container.appendChild(expr);

  const hint = document.createElement("div");
  hint.append("⇐ { ", clone(step.inferenceRuleRefHtml));
  for (const sub of step.subcalculations) {
    if (sub.kind === "given") {
      hint.append(
        " ",
        clone(sub.hypothesisRefHtml),
        " ",
        clone(sub.expressionHtml),
      );
    }
  }
  hint.append(" }");
  container.appendChild(hint);

  for (const sub of step.subcalculations) {
    if (sub.kind === "step") {
      const indented = document.createElement("div");
      indented.style.marginLeft = "2em";
      renderStep(sub, indented);
      container.appendChild(indented);
    }
  }
}

/** Renders a calculation as a DOM element (expressions joined by `<==` hints). */
export function renderCalculation(calc: Calculation): HTMLElement {
  const box = document.createElement("div");
  box.className = "mm-site-format-calc";
  // No font change; just lay it out left-aligned at normal weight.
  box.style.cssText =
    "border:1px solid #ccc;padding:6px 10px;margin:8px 0;text-align:left;font-weight:normal";
  if (calc.kind === "given") box.appendChild(clone(calc.expressionHtml));
  else renderStep(calc, box);
  return box;
}
