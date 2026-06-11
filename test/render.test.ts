// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { Calculation } from "../src/calculation";
import { renderCalculation } from "../src/render";

const el = (html: string): Element => {
  const td = document.createElement("td");
  td.innerHTML = html;
  return td;
};

describe("renderCalculation", () => {
  it("shows expressions, embeds givens in the hint, indents step sub-derivations", () => {
    const calc: Calculation = {
      kind: "step",
      inferenceRuleRefHtml: el('<a href="bitrd.html">bitrd</a>'),
      expressionHtml: el("GOAL"),
      subcalculations: [
        {
          kind: "given",
          hypothesisRefHtml: el("bitrdi.1"),
          expressionHtml: el("HYP1"),
        },
        {
          kind: "step",
          inferenceRuleRefHtml: el('<a href="a1i.html">a1i</a>'),
          expressionHtml: el("STEP3"),
          subcalculations: [
            {
              kind: "given",
              hypothesisRefHtml: el("bitrdi.2"),
              expressionHtml: el("HYP2"),
            },
          ],
          spine: 0,
        },
      ],
      spine: 0,
    };

    const box = renderCalculation(calc);

    // The root expression, then a hint with bitrd and the bitrdi.1 given (Ref +
    // expression) embedded.
    expect(box.children[0].textContent).toBe("GOAL");
    expect(box.children[1].textContent).toBe("⇐ { bitrd bitrdi.1 HYP1 }");

    // The a1i step is indented, with its own expression and hint.
    const indented = box.querySelector('div[style*="margin-left"]')!;
    expect(indented.children[0].textContent).toBe("STEP3");
    expect(indented.children[1].textContent).toBe("⇐ { a1i bitrdi.2 HYP2 }");

    // No font-family is set (font unchanged).
    expect(box.style.fontFamily).toBe("");
  });
});
