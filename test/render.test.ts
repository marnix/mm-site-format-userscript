// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { Calculation } from "../src/calculation";
import { renderCalculation } from "../src/render";

const el = (html: string): Element => {
  const td = document.createElement("td");
  td.innerHTML = html;
  return td;
};

// goal <= { bitrd } over the given bitrdi.1 (spine) and the a1i sub-calculation.
const sample = (): Calculation => ({
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
});

describe("renderCalculation", () => {
  it("lays out operator/expression columns, indents step sub-calcs, puts a leaf's Ref in the left column", () => {
    const box = renderCalculation(sample());

    // Root table (and one nested table for the a1i sub-derivation).
    expect(box.querySelectorAll("table")).toHaveLength(2);

    // The two-column rows of the root table.
    const rows = [...box.querySelector("tbody")!.children].map((tr) =>
      [...tr.children].map((td) => td.textContent),
    );
    expect(rows[0]).toEqual(["", "GOAL"]); // the step's expression
    // operator | hint: a "subproof" for the non-spine sub-derivation (the a1i
    // sub-calc shown below), then the rule last.
    expect(rows[1]).toEqual(["⇐", "{ using subproof and bitrd }"]);
    expect(rows[2][0]).toBe(""); // the indented a1i sub-calc
    expect(rows[2][1]).toContain("STEP3");
    expect(rows[3]).toEqual(["(bitrdi.1)", "HYP1"]); // leaf Ref | its expression

    // Font is not changed.
    expect(box.style.fontFamily).toBe("");
  });

  it("collapses sub-calculations by default; a marker (or the hint) toggles them", () => {
    const box = renderCalculation(sample());
    const nested = box.querySelectorAll("table")[1]; // the a1i sub-calc
    const rows = [...nested.querySelector("tbody")!.children] as HTMLElement[];

    // Conclusion (STEP3) stays; the hint and the rest are hidden.
    expect(rows[0].style.display).not.toBe("none");
    expect(rows[0].textContent).toContain("STEP3");
    expect(rows[1].style.display).toBe("none"); // ⇐ { a1i }
    expect(rows[2].style.display).toBe("none"); // HYP2

    // A disclosure marker on the conclusion expands it on click.
    const marker = nested.querySelector(".mm-site-format-fold") as HTMLElement;
    expect(marker).not.toBeNull();
    marker.click();
    expect(rows[1].style.display).toBe("");
    expect(rows[2].style.display).toBe("");

    // Clicking the hint collapses it again.
    rows[1].click();
    expect(rows[1].style.display).toBe("none");
  });

  it("ends the spine at `⇔ TRUE` when there is no clear main line (spine null)", () => {
    // Two derived premises, no spine — as for a `bitrd` with symmetric premises.
    const calc: Calculation = {
      kind: "step",
      inferenceRuleRefHtml: el('<a href="bitrd.html">bitrd</a>'),
      expressionHtml: el("GOAL"),
      subcalculations: [
        {
          kind: "step",
          inferenceRuleRefHtml: el("r1"),
          expressionHtml: el("P1"),
          subcalculations: [
            {
              kind: "given",
              hypothesisRefHtml: el("h1"),
              expressionHtml: el("HA"),
            },
          ],
          spine: 0,
        },
        {
          kind: "step",
          inferenceRuleRefHtml: el("r2"),
          expressionHtml: el("P2"),
          subcalculations: [
            {
              kind: "given",
              hypothesisRefHtml: el("h2"),
              expressionHtml: el("HB"),
            },
          ],
          spine: 0,
        },
      ],
      spine: null,
    };
    const box = renderCalculation(calc);
    expect(box.querySelectorAll("table")).toHaveLength(3); // root + 2 sub-calcs

    const rows = [...box.querySelector("tbody")!.children].map((tr) =>
      [...tr.children].map((td) => td.textContent),
    );
    expect(rows[0]).toEqual(["", "GOAL"]);
    expect(rows[1][0]).toBe("⇔"); // spine ends here, not ⇐
    expect(rows[1][1]).toBe("{ using subproofs and bitrd }");
    expect(rows[rows.length - 1]).toEqual(["", "TRUE"]); // …down to TRUE
  });

  it("fades a small step's hint and its continuation expression, not the step's own expression", () => {
    // A single-premise, near-identity step (smallSpine) over a given.
    const calc: Calculation = {
      kind: "step",
      inferenceRuleRefHtml: el('<a href="r.html">r</a>'),
      expressionHtml: el("TOP"),
      subcalculations: [
        {
          kind: "given",
          hypothesisRefHtml: el("h"),
          expressionHtml: el("RESULT"),
        },
      ],
      spine: 0,
      smallSpine: true,
    };
    const box = renderCalculation(calc);
    const rows = [...box.querySelector("tbody")!.children] as HTMLElement[];
    const right = (tr: HTMLElement) => tr.children[1] as HTMLElement; // content
    const left = (tr: HTMLElement) => tr.children[0] as HTMLElement; // label

    expect(rows[0].textContent).toContain("TOP"); // the step's own expression…
    expect(right(rows[0]).style.opacity).toBe(""); // …stays at full strength
    expect(rows[1].textContent).toContain("{ using r }"); // hint…
    expect(right(rows[1]).style.opacity).not.toBe(""); // …is faded
    expect(rows[2].textContent).toContain("RESULT"); // continuation expression…
    expect(right(rows[2]).style.opacity).toBe(right(rows[1]).style.opacity);
    // …but its left-column Ref label stays sharp, so you can still see where
    // the conclusion came from.
    expect(rows[2].textContent).toContain("(h)");
    expect(left(rows[2]).style.opacity).toBe("");
  });
});
