// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { installParseWarning, isProofExpression } from "../src/parse-status";
import type { ParsedExpression } from "../src/page";

/** Minimal ParsedExpression pointing at a given DOM node. */
const exprAt = (node: Element): ParsedExpression => ({
  locations: [{ type: "element", node }],
  proof: null,
  tokens: [],
});

describe("isProofExpression", () => {
  it.fails("returns false for an expression in a description paragraph (outside proof columns)", () => {
    // Math that appears in the theorem's description text is not a proof-column
    // expression.  Parse failures there are irrelevant to the calculation view
    // and must not trigger the parse-warning indicator.
    const span = document.createElement("span");
    document.body.appendChild(span);
    expect(isProofExpression(exprAt(span))).toBe(false); // stub returns true → fails
    span.remove();
  });

  it("returns true for an expression in the Assertion table", () => {
    const table = document.createElement("table");
    table.setAttribute("summary", "Assertion");
    const span = table.appendChild(document.createElement("span"));
    document.body.appendChild(table);
    expect(isProofExpression(exprAt(span))).toBe(true);
    table.remove();
  });

  it("returns true for an expression in the Hypotheses table", () => {
    const table = document.createElement("table");
    table.setAttribute("summary", "Hypotheses");
    const span = table.appendChild(document.createElement("span"));
    document.body.appendChild(table);
    expect(isProofExpression(exprAt(span))).toBe(true);
    table.remove();
  });

  it("returns true for an expression in the Expression column (4th TD) of the proof table", () => {
    const table = document.createElement("table");
    table.setAttribute("summary", "Proof of theorem");
    const tr = table.appendChild(document.createElement("tr"));
    for (let i = 0; i < 3; i++) tr.appendChild(document.createElement("td"));
    const exprTd = tr.appendChild(document.createElement("td"));
    const span = exprTd.appendChild(document.createElement("span"));
    document.body.appendChild(table);
    expect(isProofExpression(exprAt(span))).toBe(true);
    table.remove();
  });
});

describe("installParseWarning", () => {
  it("does nothing when count is 0", () => {
    const banner = document.createElement("div");
    banner.textContent = "MM Site Format 1.0 active";
    installParseWarning(banner, 0);
    expect(banner.children).toHaveLength(0);
  });

  it("appends a parse-warn indicator when count > 0", () => {
    const banner = document.createElement("div");
    installParseWarning(banner, 3);
    const span = banner.querySelector(".mm-site-format-parse-warn");
    expect(span).not.toBeNull();
    expect(span!.textContent).toContain("⚠");
    expect(span!.getAttribute("title")).toContain("3");
  });

  it("uses 'expression' (singular) for count 1", () => {
    const banner = document.createElement("div");
    installParseWarning(banner, 1);
    const span = banner.querySelector(".mm-site-format-parse-warn");
    expect(span!.getAttribute("title")).toMatch(/\b1 expression\b/);
    expect(span!.getAttribute("title")).not.toMatch(/expressions/);
  });

  it("uses 'expressions' (plural) for count > 1", () => {
    const banner = document.createElement("div");
    installParseWarning(banner, 5);
    const span = banner.querySelector(".mm-site-format-parse-warn");
    expect(span!.getAttribute("title")).toMatch(/\b5 expressions\b/);
  });
});
