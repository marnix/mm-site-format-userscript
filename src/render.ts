// Renders a calculation as a DOM element to place above the proof table.
// Following the spine: a step shows a hint with its inference-rule Ref and any
// given sub-calculations embedded; step sub-calculations are rendered indented
// under the hint, in order. Ref HTML is cloned so the table is left intact.

import type { Calculation, Step } from "./calculation";

/** Clones a Ref cell's content into a fresh inline element. */
function cloneRef(ref: Element): HTMLElement {
  const span = document.createElement("span");
  for (const node of ref.childNodes) span.appendChild(node.cloneNode(true));
  return span;
}

function renderStep(step: Step, container: HTMLElement): void {
  const hint = document.createElement("div");
  hint.append("⇐ { ", cloneRef(step.inferenceRuleRefHtml));
  for (const sub of step.subcalculations) {
    if (sub.kind === "given") hint.append(" ", cloneRef(sub.hypothesisRefHtml));
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

/** Renders a calculation as a DOM element (a box of nested hints). */
export function renderCalculation(calc: Calculation): HTMLElement {
  const box = document.createElement("div");
  box.className = "mm-site-format-calc";
  box.style.cssText =
    "border:1px solid #ccc;padding:6px 10px;margin:8px 0;font-family:sans-serif";
  if (calc.kind === "given") box.appendChild(cloneRef(calc.hypothesisRefHtml));
  else renderStep(calc, box);
  return box;
}
