// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { installParseWarning } from "../src/parse-status";

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
