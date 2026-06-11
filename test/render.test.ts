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
  it("lays out operator/expression columns, indents step sub-calcs, omits given Refs", () => {
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

    // Root table (and one nested table for the a1i sub-derivation).
    expect(box.querySelectorAll("table")).toHaveLength(2);

    // The two-column rows of the root table.
    const rows = [...box.querySelector("tbody")!.children].map((tr) =>
      [...tr.children].map((td) => td.textContent),
    );
    expect(rows[0]).toEqual(["", "GOAL"]); // the step's expression
    expect(rows[1]).toEqual(["⇐", "{ bitrd }"]); // operator | hint (rule only)
    expect(rows[2][0]).toBe(""); // the indented a1i sub-calc
    expect(rows[2][1]).toContain("STEP3");
    expect(rows[2][1]).toContain("{ a1i }");
    expect(rows[2][1]).toContain("HYP2");
    expect(rows[3]).toEqual(["", "HYP1"]); // the spine given's expression

    // Given Refs are not rendered (only their expressions appear).
    expect(box.textContent).not.toContain("bitrdi");
    // Font is not changed.
    expect(box.style.fontFamily).toBe("");
  });
});
