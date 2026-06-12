// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { installViewToggle } from "../src/view";

describe("installViewToggle history", () => {
  beforeEach(() => {
    history.replaceState(null, "", "/mpeuni/eqid.html"); // a plain URL, no param
    document.body.innerHTML =
      '<a href="g">GIF version</a>' +
      '<table summary="Proof of theorem"><caption>cap</caption>' +
      "<tbody><tr><td>1</td></tr></tbody></table>";
  });

  it("pushes history so Back restores the previous view", () => {
    const table = document.querySelector("table") as HTMLTableElement;
    const calc = document.createElement("div");
    table.querySelector("caption")!.appendChild(calc);
    installViewToggle(calc, table);

    const toggle = [...document.querySelectorAll("a")].find(
      (a) => a.textContent === "Table version",
    ) as HTMLAnchorElement;
    expect(location.search).toBe(""); // calculation by default

    toggle.click();
    expect(location.search).toBe("?view=table");
    expect(toggle.textContent).toBe("Calculation version"); // now offers calc

    history.back();
    expect(location.search).toBe(""); // Back returns to the calculation URL
    expect(toggle.textContent).toBe("Table version"); // …and the view follows
  });
});
