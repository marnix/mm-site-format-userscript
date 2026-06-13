// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { expressionParts } from "../src/indent";

const cell = (html: string): Element => {
  const td = document.createElement("td");
  td.innerHTML = html;
  return td;
};

describe("expressionParts", () => {
  it("finds the leader and the turnstile in a Unicode cell", () => {
    const td = cell(
      '<a name="1"></a><span class="i">. . 3</span>' +
        '<span class="math"><span class="hidden">⊢ </span> Rels = X</span>',
    );
    const parts = expressionParts(td);
    expect(parts).not.toBeNull();
    expect(parts!.leader).toBe(td.querySelector("span.i"));
    // the turnstile is the math span's first child (the gray ⊢)
    expect(parts!.turnstile).toBe(
      td.querySelector("span.math")!.firstElementChild,
    );
  });

  it("finds the leader and the turnstile (first img) in a GIF cell", () => {
    const td = cell(
      '<a name="1"></a><span class="i">. . 3</span>' +
        "<img src='_vdash.gif' alt=' |-'> Rels <img src='eq.gif' alt=' ='>",
    );
    const parts = expressionParts(td);
    expect(parts).not.toBeNull();
    expect(parts!.leader).toBe(td.querySelector("span.i"));
    expect(parts!.turnstile).toBe(td.querySelector("img")); // the first img = ⊢
  });

  it("is null when the cell has no expression (no leader/turnstile)", () => {
    expect(expressionParts(cell("<span>1</span>"))).toBeNull();
  });
});
