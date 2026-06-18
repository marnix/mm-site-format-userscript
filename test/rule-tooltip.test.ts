// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  attachRuleTooltipsToPage,
  buildRuleContent,
} from "../src/rule-tooltip";

function makeDoc(assertionMath: string, hypothesisMath: string[]): Document {
  const doc = document.implementation.createHTMLDocument();

  const assertionTable = doc.createElement("table");
  assertionTable.setAttribute("summary", "Assertion");
  const conclusionSpan = doc.createElement("span");
  conclusionSpan.className = "math";
  conclusionSpan.textContent = assertionMath;
  assertionTable.appendChild(conclusionSpan);
  doc.body.appendChild(assertionTable);

  if (hypothesisMath.length > 0) {
    const hypTable = doc.createElement("table");
    hypTable.setAttribute("summary", "Hypotheses");
    for (const math of hypothesisMath) {
      const s = doc.createElement("span");
      s.className = "math";
      s.textContent = math;
      hypTable.appendChild(s);
    }
    doc.body.appendChild(hypTable);
  }

  return doc;
}

describe("buildRuleContent", () => {
  it("returns null when there is no Assertion table", () => {
    const doc = document.implementation.createHTMLDocument();
    expect(buildRuleContent(doc)).toBeNull();
  });

  it("shows just the conclusion when there are no hypotheses", () => {
    const doc = makeDoc("⊢ ps", []);
    const node = buildRuleContent(doc) as HTMLElement;
    expect(node).not.toBeNull();
    expect(node.textContent).toContain("⊢ ps");
    expect(node.textContent).not.toContain("⇐");
  });

  it("shows conclusion ⇐ hypothesis for a single hypothesis", () => {
    const doc = makeDoc("⊢ ps", ["⊢ ( ph → ps )"]);
    const node = buildRuleContent(doc) as HTMLElement;
    const text = node.textContent!;
    expect(text).toContain("⊢ ps");
    expect(text).toContain("⇐");
    expect(text).toContain("⊢ ( ph → ps )");
    expect(text.indexOf("⊢ ps")).toBeLessThan(text.indexOf("⊢ ( ph → ps )"));
  });

  it("uses NBSP after ⇐ and & so the space does not collapse in HTML", () => {
    const doc = makeDoc("⊢ ps", ["⊢ ( ph → ps )", "⊢ ∃ x ph"]);
    const node = buildRuleContent(doc) as HTMLElement;
    expect(node.textContent).toMatch(new RegExp("⇐ "));
    expect(node.textContent).toMatch(new RegExp("& "));
  });

  it("shows conclusion ⇐ h1 & h2 for two hypotheses", () => {
    const doc = makeDoc("⊢ ps", ["⊢ ( ph → ps )", "⊢ ∃ x ph"]);
    const node = buildRuleContent(doc) as HTMLElement;
    const text = node.textContent!;
    expect(text).toContain("⊢ ps");
    expect(text).toContain("⇐");
    expect(text).toContain("&");
    expect(text).toContain("⊢ ( ph → ps )");
    expect(text).toContain("⊢ ∃ x ph");
    expect(text.indexOf("⊢ ( ph → ps )")).toBeLessThan(
      text.indexOf("⊢ ∃ x ph"),
    );
  });

  it("clones the span.math nodes so originals are unchanged", () => {
    const doc = makeDoc("⊢ ps", ["⊢ ( ph → ps )"]);
    buildRuleContent(doc);
    // The original span is still in the original doc, not moved
    expect(
      doc.querySelector('table[summary="Assertion"] span.math'),
    ).not.toBeNull();
  });
});

describe("attachRuleTooltipsToPage", () => {
  it("attaches a tooltip to every <a>&nbsp;<span class='r'> pattern in root", async () => {
    const ruleContent = document.createElement("span");
    ruleContent.textContent = "RULE_CONTENT";

    const div = document.createElement("div");
    div.innerHTML = '<a href="foo.html">foo</a>&nbsp;<span class="r">3</span>';
    document.body.appendChild(div);

    attachRuleTooltipsToPage(div, () =>
      Promise.resolve(ruleContent as Node | null),
    );

    const a = div.querySelector("a") as HTMLAnchorElement;
    a.dispatchEvent(new MouseEvent("mouseenter"));
    await Promise.resolve();

    const tooltip = document.querySelector(
      ".mm-site-format-ref-tooltip",
    ) as HTMLElement;
    expect(tooltip?.style.display).not.toBe("none");
    expect(tooltip?.textContent).toContain("RULE_CONTENT");
    tooltip?.remove();
    div.remove();
  });

  it("strips title from the <a> itself and shows it in the tooltip desc", async () => {
    const ruleContent = document.createElement("span");
    ruleContent.textContent = "RULE_CONTENT";

    const div = document.createElement("div");
    div.innerHTML =
      '<a href="foo.html" title="Foo theorem">foo</a>&nbsp;<span class="r">3</span>';
    document.body.appendChild(div);

    attachRuleTooltipsToPage(div, () =>
      Promise.resolve(ruleContent as Node | null),
    );

    const a = div.querySelector("a") as HTMLAnchorElement;
    expect(a.hasAttribute("title")).toBe(false); // stripped at attach time

    a.dispatchEvent(new MouseEvent("mouseenter"));
    await Promise.resolve();

    const tooltip = document.querySelector(
      ".mm-site-format-ref-tooltip",
    ) as HTMLElement;
    expect(tooltip?.textContent).toContain("RULE_CONTENT");
    expect(tooltip?.textContent).toContain("Foo theorem");
    tooltip?.remove();
    div.remove();
  });

  it("does not attach when the span after &nbsp; lacks class 'r'", () => {
    const div = document.createElement("div");
    div.innerHTML =
      '<a href="foo.html">foo</a>&nbsp;<span class="other">x</span>';
    document.body.appendChild(div);

    let called = false;
    attachRuleTooltipsToPage(div, () => {
      called = true;
      return Promise.resolve(null);
    });

    const a = div.querySelector("a") as HTMLAnchorElement;
    a.dispatchEvent(new MouseEvent("mouseenter"));
    expect(called).toBe(false);
    div.remove();
  });
});
