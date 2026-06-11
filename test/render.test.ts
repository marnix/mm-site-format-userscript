// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { Calculation } from "../src/calculation";
import { renderCalculation } from "../src/render";

const ref = (html: string): Element => {
  const td = document.createElement("td");
  td.innerHTML = html;
  return td;
};

describe("renderCalculation", () => {
  it("renders hints with givens embedded and step sub-derivations indented", () => {
    const bitrd = ref('<a href="bitrd.html">bitrd</a>');
    const a1i = ref('<a href="a1i.html">a1i</a>');
    const bitrdi1 = ref("bitrdi.1");
    const bitrdi2 = ref("bitrdi.2");

    const calc: Calculation = {
      kind: "step",
      inferenceRuleRefHtml: bitrd,
      subcalculations: [
        { kind: "given", hypothesisRefHtml: bitrdi1 },
        {
          kind: "step",
          inferenceRuleRefHtml: a1i,
          subcalculations: [{ kind: "given", hypothesisRefHtml: bitrdi2 }],
          spine: 0,
        },
      ],
      spine: 0,
    };

    const box = renderCalculation(calc);

    // Top hint: the bitrd rule with the bitrdi.1 given embedded.
    const top = box.firstElementChild!;
    expect(top.textContent).toBe("⇐ { bitrd bitrdi.1 }");

    // The a1i step is rendered indented, with the bitrdi.2 given embedded.
    const indented = box.querySelector('div[style*="margin-left"]')!;
    expect(indented.textContent).toBe("⇐ { a1i bitrdi.2 }");

    // The source Ref cells are cloned, not moved — the table stays intact.
    expect(bitrd.querySelector("a")).not.toBeNull();
    expect(a1i.querySelector("a")).not.toBeNull();
  });
});
