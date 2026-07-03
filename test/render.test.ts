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
    expect(rows[1]).toEqual(["\u21d0", "{ using subproof and bitrd }"]);
    expect(rows[2][0]).toBe(""); // the indented a1i sub-calc
    expect(rows[2][1]).toContain("STEP3");
    expect(rows[3]).toEqual(["(bitrdi.1)", "HYP1"]); // leaf Ref | its expression

    // Font is not changed.
    expect(box.style.fontFamily).toBe("");
  });

  it("collapses sub-calculations by default; a marker (or the hint) toggles them", () => {
    const box = renderCalculation(sample());
    const nested = box.querySelectorAll("table")[1]; // the a1i sub-calc
    const tbody = nested.querySelector("tbody")!;
    let rows = [...tbody.children] as HTMLElement[];

    // In collapsed (lazy) state, only the conclusion row is present.
    expect(rows[0].style.display).not.toBe("none");
    expect(rows[0].textContent).toContain("STEP3");
    // Remaining rows are not yet rendered (lazy).
    expect(rows).toHaveLength(1);

    // A disclosure marker on the conclusion expands it on click (renders rest).
    const marker = nested.querySelector(".mm-site-format-fold") as HTMLElement;
    expect(marker).not.toBeNull();
    marker.click();
    rows = [...tbody.children] as HTMLElement[];
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[1].style.display).toBe(""); // hint row now visible
    expect(rows[2].style.display).toBe(""); // leaf row now visible

    // Clicking the hint collapses it again.
    rows[1].click();
    expect(rows[1].style.display).toBe("none");
  });

  it("ends the spine at `<==> TRUE` when there is no clear main line (spine null)", () => {
    // Two derived premises, no spine -- as for a `bitrd` with symmetric premises.
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
    expect(rows[1][0]).toBe("\u21d4"); // spine ends here, not \u21d0 (<==)
    expect(rows[1][1]).toBe("{ using subproofs and bitrd }");
    expect(rows[rows.length - 1]).toEqual(["", "TRUE"]); // ...down to TRUE
  });

  it("shows a tooltip with the leaf hypothesis expression when hovering over a leaf ref", () => {
    const box = renderCalculation(sample());
    // Last row: (bitrdi.1) | HYP1
    const rows = [...box.querySelector("tbody")!.children] as HTMLElement[];
    const lastRow = rows[rows.length - 1];
    // The left cell contains the ref span as its only child element.
    const refSpan = lastRow.children[0].firstElementChild as HTMLElement;
    refSpan.dispatchEvent(new MouseEvent("mouseenter"));
    const tooltip = document.querySelector(
      ".mm-site-format-ref-tooltip",
    ) as HTMLElement | null;
    expect(tooltip).not.toBeNull();
    expect(tooltip!.style.display).not.toBe("none");
    expect(tooltip!.textContent).toContain("HYP1");
    tooltip!.remove(); // cleanup singleton
  });

  it("shows a tooltip with the non-spine given expression when hovering over its hint ref", () => {
    // A step with two given premises -- spine is the first, the second is non-spine
    // and appears in the { using ... } hint text.
    const calc: Calculation = {
      kind: "step",
      inferenceRuleRefHtml: el('<a href="ax-mp.html">ax-mp</a>'),
      expressionHtml: el("CONCL"),
      subcalculations: [
        {
          kind: "given",
          hypothesisRefHtml: el("min"),
          expressionHtml: el("MINOR"),
        },
        {
          kind: "given",
          hypothesisRefHtml: el("maj"),
          expressionHtml: el("MAJOR"),
        },
      ],
      spine: 0, // min is spine; maj appears in the hint
    };
    const box = renderCalculation(calc);
    // Row 1: the hint `{ using maj and ax-mp }`.  Find the maj span inside it.
    const hintRow = [...box.querySelector("tbody")!.children][1] as HTMLElement;
    const hintCell = hintRow.children[1] as HTMLElement;
    // First child element in the hint cell's content span is the maj ref.
    const majRef = hintCell.querySelector("span > span") as HTMLElement;
    majRef.dispatchEvent(new MouseEvent("mouseenter"));
    const tooltip = document.querySelector(
      ".mm-site-format-ref-tooltip",
    ) as HTMLElement | null;
    expect(tooltip).not.toBeNull();
    expect(tooltip!.style.display).not.toBe("none");
    expect(tooltip!.textContent).toContain("MAJOR");
    tooltip!.remove(); // cleanup singleton
  });

  it("shows the ref title text in the tooltip and strips the title attr so the native tooltip does not also fire", () => {
    const calc: Calculation = {
      kind: "given",
      hypothesisRefHtml: el('<a href="ax-1.html" title="Axiom Simp">ax-1</a>'),
      expressionHtml: el("AX1EXPR"),
    };
    const box = renderCalculation(calc);
    // title attr must be stripped at render time (before any hover)
    const link = box.querySelector("a") as HTMLAnchorElement;
    expect(link.hasAttribute("title")).toBe(false);
    // Hovering shows the expression AND the original title text
    const rows = [...box.querySelector("tbody")!.children] as HTMLElement[];
    const refSpan = rows[0].children[0].firstElementChild as HTMLElement;
    refSpan.dispatchEvent(new MouseEvent("mouseenter"));
    const tooltip = document.querySelector(
      ".mm-site-format-ref-tooltip",
    ) as HTMLElement | null;
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toContain("AX1EXPR");
    expect(tooltip!.textContent).toContain("Axiom Simp");
    tooltip!.remove();
  });

  it("shows async rule page content when fetchRuleTooltip is provided", async () => {
    const ruleContent = document.createElement("span");
    ruleContent.textContent = "RULE_CONTENT";

    const box = renderCalculation(sample(), {
      fetchRuleTooltip: () => Promise.resolve(ruleContent as Node | null),
    });

    // The hint row's right cell contains the bitrd rule ref
    const rows = [...box.querySelector("tbody")!.children] as HTMLElement[];
    const hintCell = rows[1].children[1] as HTMLElement;
    const ruleRef = hintCell.querySelector("a[href='bitrd.html']")!
      .parentElement as HTMLElement;

    ruleRef.dispatchEvent(new MouseEvent("mouseenter"));
    await Promise.resolve(); // drain the microtask queue

    const tooltip = document.querySelector(
      ".mm-site-format-ref-tooltip",
    ) as HTMLElement;
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain("RULE_CONTENT");
    tooltip.remove();
  });

  it("fetches rule page content for a non-spine given hint ref when fetchRuleTooltip is provided and the ref has an href", async () => {
    // Reproduces the axsepg bug: an axiom/theorem used as a leaf (no subproofs)
    // becomes a "given"; its hint ref must show the unsubstituted page content,
    // not the proof-table expression (the substituted instantiation).
    const pageContent = document.createElement("span");
    pageContent.textContent = "AXSEPG_PAGE";

    const calc: Calculation = {
      kind: "step",
      inferenceRuleRefHtml: el('<a href="exlimiiv.html">exlimiiv</a>'),
      expressionHtml: el("CONCL"),
      subcalculations: [
        {
          kind: "given",
          hypothesisRefHtml: el('<a href="axsepg.html">axsepg</a>'),
          expressionHtml: el("SUBST_EXPR"), // substituted -- must NOT appear in tooltip
        },
        {
          kind: "given",
          hypothesisRefHtml: el("maj"),
          expressionHtml: el("MAJOR"),
        },
      ],
      spine: 1, // axsepg is non-spine; it appears in the { using ... } hint
    };
    const box = renderCalculation(calc, {
      fetchRuleTooltip: (href) =>
        Promise.resolve(href === "axsepg.html" ? (pageContent as Node) : null),
    });

    const hintRow = [...box.querySelector("tbody")!.children][1] as HTMLElement;
    const hintCell = hintRow.children[1] as HTMLElement;
    const axsepgRef = hintCell.querySelector("a[href='axsepg.html']")!
      .parentElement as HTMLElement;

    axsepgRef.dispatchEvent(new MouseEvent("mouseenter"));
    await Promise.resolve();

    const tooltip = document.querySelector(
      ".mm-site-format-ref-tooltip",
    ) as HTMLElement;
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain("AXSEPG_PAGE");
    expect(tooltip.textContent).not.toContain("SUBST_EXPR");
    tooltip.remove();
  });

  it("fetches rule page content for a leaf given ref when fetchRuleTooltip is provided and the ref has an href", async () => {
    // Same bug in the appendGiven path: a top-level given (leaf calc) must also
    // use the fetched page content, not the proof-table expression.
    const pageContent = document.createElement("span");
    pageContent.textContent = "LEAF_PAGE";

    const calc: Calculation = {
      kind: "given",
      hypothesisRefHtml: el('<a href="axsepg.html">axsepg</a>'),
      expressionHtml: el("SUBST_EXPR"),
    };
    const box = renderCalculation(calc, {
      fetchRuleTooltip: () => Promise.resolve(pageContent as Node | null),
    });

    const rows = [...box.querySelector("tbody")!.children] as HTMLElement[];
    const refSpan = rows[0].children[0].firstElementChild as HTMLElement;
    refSpan.dispatchEvent(new MouseEvent("mouseenter"));
    await Promise.resolve();

    const tooltip = document.querySelector(
      ".mm-site-format-ref-tooltip",
    ) as HTMLElement;
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain("LEAF_PAGE");
    expect(tooltip.textContent).not.toContain("SUBST_EXPR");
    tooltip.remove();
  });

  it("folds a small spine step: skips the intermediate expression and merges its rule into the parent hint", () => {
    // P (not-small) -> A (smallSpine) -> given.  A's expression must disappear;
    // A's rule ref is appended to P's hint as "; using <rule>".
    const calc: Calculation = {
      kind: "step",
      inferenceRuleRefHtml: el('<a href="syl.html">syl</a>'),
      expressionHtml: el("GOAL"),
      subcalculations: [
        {
          kind: "step",
          inferenceRuleRefHtml: el('<a href="eleq2i.html">eleq2i</a>'),
          expressionHtml: el("INTERMEDIATE"),
          subcalculations: [
            {
              kind: "given",
              hypothesisRefHtml: el("df-rels"),
              expressionHtml: el("RESULT"),
            },
          ],
          spine: 0,
          smallSpine: true,
        },
      ],
      spine: 0,
    };
    const box = renderCalculation(calc);
    // INTERMEDIATE must not appear anywhere in the output.
    expect(box.textContent).not.toContain("INTERMEDIATE");
    const rows = [...box.querySelector("tbody")!.children] as HTMLElement[];
    // 3 rows: GOAL expr, merged hint, (df-rels) RESULT -- not 5.
    expect(rows).toHaveLength(3);
    const right = (tr: HTMLElement) => tr.children[1] as HTMLElement;
    expect(right(rows[0]).textContent).toContain("GOAL");
    // Merged hint contains both rule refs, the folded one appended with "; using".
    expect(right(rows[1]).textContent).toContain("syl");
    expect(right(rows[1]).textContent).toContain("; using");
    expect(right(rows[1]).textContent).toContain("eleq2i");
    // Continuation (the given) at full strength -- no faded class.
    expect(right(rows[2]).textContent).toContain("RESULT");
    expect(right(rows[2]).classList.contains("mm-site-format-calc-faded")).toBe(
      false,
    );
  });

  it("folds a chain of small spine steps in one merged hint", () => {
    // P -> A (small) -> B (small) -> given.  Both A and B disappear; both rule
    // refs appear in P's hint.
    const calc: Calculation = {
      kind: "step",
      inferenceRuleRefHtml: el("outer"),
      expressionHtml: el("GOAL"),
      subcalculations: [
        {
          kind: "step",
          inferenceRuleRefHtml: el("step-a"),
          expressionHtml: el("MID1"),
          subcalculations: [
            {
              kind: "step",
              inferenceRuleRefHtml: el("step-b"),
              expressionHtml: el("MID2"),
              subcalculations: [
                {
                  kind: "given",
                  hypothesisRefHtml: el("h"),
                  expressionHtml: el("RESULT"),
                },
              ],
              spine: 0,
              smallSpine: true,
            },
          ],
          spine: 0,
          smallSpine: true,
        },
      ],
      spine: 0,
    };
    const box = renderCalculation(calc);
    expect(box.textContent).not.toContain("MID1");
    expect(box.textContent).not.toContain("MID2");
    const rows = [...box.querySelector("tbody")!.children] as HTMLElement[];
    expect(rows).toHaveLength(3); // GOAL, merged hint, (h) RESULT
    const right = (tr: HTMLElement) => tr.children[1] as HTMLElement;
    expect(right(rows[1]).textContent).toContain("outer");
    expect(right(rows[1]).textContent).toContain("step-a");
    expect(right(rows[1]).textContent).toContain("step-b");
  });

  it("a small spine step renders normally (no fading) when the spine is not a further small step", () => {
    // A step with smallSpine=true whose only spine child is a given: renders as
    // three rows (expr, hint, given) without any faded styling.
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
    const right = (tr: HTMLElement) => tr.children[1] as HTMLElement;
    expect(rows).toHaveLength(3);
    expect(right(rows[0]).textContent).toContain("TOP");
    expect(right(rows[1]).textContent).toContain("{ using r }");
    expect(right(rows[1]).classList.contains("mm-site-format-calc-faded")).toBe(
      false,
    );
    expect(right(rows[2]).textContent).toContain("RESULT");
    expect(right(rows[2]).classList.contains("mm-site-format-calc-faded")).toBe(
      false,
    );
  });

  it("calls onLazyRender when a lazy subcalc is expanded, with connected DOM", () => {
    const rendered: ParentNode[] = [];
    const box = renderCalculation(sample(), {
      onLazyRender: (root) => rendered.push(root),
    });
    const nested = box.querySelectorAll("table")[1]; // the lazy a1i sub-calc
    const marker = nested.querySelector(".mm-site-format-fold") as HTMLElement;

    // Before expansion, onLazyRender has not been called.
    expect(rendered).toHaveLength(0);

    // Expand the sub-calc.
    marker.click();

    // onLazyRender was called once.
    expect(rendered).toHaveLength(1);
    // The rendered root is connected to the box (not an orphan).
    expect(box.contains(rendered[0] as Node)).toBe(true);
    // The expanded content includes the hint row with the rule reference.
    const hintText = (rendered[0] as HTMLElement).textContent;
    expect(hintText).toContain("a1i");
    // The expression elements in the expanded content are in the DOM (not orphaned),
    // so hover/diff handlers that reference them will work.
    const exprs = (rendered[0] as HTMLElement).querySelectorAll(
      "tr:first-child td:last-child",
    );
    expect(exprs.length).toBeGreaterThan(0);
    for (const expr of exprs) {
      expect(box.contains(expr)).toBe(true);
    }
  });
});
