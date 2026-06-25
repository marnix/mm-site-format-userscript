// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  attachRuleTooltipsToPage,
  buildRuleContent,
} from "../src/rule-tooltip";
import { readFixture } from "./helpers";

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
    const doc = makeDoc("\u22a2 ps", []);
    const node = buildRuleContent(doc) as HTMLElement;
    expect(node).not.toBeNull();
    expect(node.textContent).toContain("\u22a2 ps");
    expect(node.textContent).not.toContain("\u21d0");
  });

  it("shows conclusion <== hypothesis for a single hypothesis", () => {
    const doc = makeDoc("\u22a2 ps", ["\u22a2 ( ph \u2192 ps )"]);
    const node = buildRuleContent(doc) as HTMLElement;
    const text = node.textContent!;
    expect(text).toContain("\u22a2 ps");
    expect(text).toContain("\u21d0");
    expect(text).toContain("\u22a2 ( ph \u2192 ps )");
    expect(text.indexOf("\u22a2 ps")).toBeLessThan(
      text.indexOf("\u22a2 ( ph \u2192 ps )"),
    );
  });

  it("uses NBSP after <== and & so the space does not collapse in HTML", () => {
    const doc = makeDoc("\u22a2 ps", [
      "\u22a2 ( ph \u2192 ps )",
      "\u22a2 \u2203 x ph",
    ]);
    const node = buildRuleContent(doc) as HTMLElement;
    expect(node.textContent).toMatch(new RegExp("\u21d0\u00a0"));
    expect(node.textContent).toMatch(new RegExp("&\u00a0"));
  });

  it("shows conclusion <== h1 & h2 for two hypotheses", () => {
    const doc = makeDoc("\u22a2 ps", [
      "\u22a2 ( ph \u2192 ps )",
      "\u22a2 \u2203 x ph",
    ]);
    const node = buildRuleContent(doc) as HTMLElement;
    const text = node.textContent!;
    expect(text).toContain("\u22a2 ps");
    expect(text).toContain("\u21d0");
    expect(text).toContain("&");
    expect(text).toContain("\u22a2 ( ph \u2192 ps )");
    expect(text).toContain("\u22a2 \u2203 x ph");
    expect(text.indexOf("\u22a2 ( ph \u2192 ps )")).toBeLessThan(
      text.indexOf("\u22a2 \u2203 x ph"),
    );
  });

  it("clones the span.math nodes so originals are unchanged", () => {
    const doc = makeDoc("\u22a2 ps", ["\u22a2 ( ph \u2192 ps )"]);
    buildRuleContent(doc);
    // The original span is still in the original doc, not moved
    expect(
      doc.querySelector('table[summary="Assertion"] span.math'),
    ).not.toBeNull();
  });

  it("returns non-null and includes img elements for a GIF-format page", () => {
    const doc = new DOMParser().parseFromString(
      readFixture("mpegif", "bitrd.html"),
      "text/html",
    );
    const node = buildRuleContent(doc) as HTMLElement;
    expect(node).not.toBeNull();
    expect(node.querySelectorAll("img").length).toBeGreaterThan(0);
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

  it("attaches to links where a newline precedes the &nbsp; (Referenced-by pattern)", () => {
    // In metamath.org's 'This theorem is referenced by:' section, the HTML is:
    //   <a href="bitr2d.html">bitr2d</a>\n&nbsp;<span class="r">282</span>
    // The \n means the text node between <a> and <span class="r"> is "\n\u00a0" (NBSP),
    // not just "\u00a0", so a strict === "\u00a0" check misses these links.
    const div = document.createElement("div");
    div.innerHTML =
      '<a href="foo.html">foo</a>\n&nbsp;<span class="r">3</span>';
    document.body.appendChild(div);

    let called = false;
    attachRuleTooltipsToPage(div, () => {
      called = true;
      return Promise.resolve(null);
    });

    const a = div.querySelector("a") as HTMLAnchorElement;
    a.dispatchEvent(new MouseEvent("mouseenter"));
    expect(called).toBe(true);
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
