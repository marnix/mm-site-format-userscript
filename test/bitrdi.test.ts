// @vitest-environment happy-dom
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it, vi } from "vitest";
import { extractLinkedPageUrls, loadLinkedPages } from "../src/loader";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readFixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

const PAGE_URL = "https://us.metamath.org/mpeuni/bitrdi.html";
const BASE = "https://us.metamath.org/mpeuni/";

const LINKED_URLS = [
  `${BASE}wi.html`,
  `${BASE}wb.html`,
  `${BASE}a1i.html`,
  `${BASE}bitrd.html`,
];

describe("bitrdi.html", () => {
  const doc = new DOMParser().parseFromString(
    readFixture("bitrdi.html"),
    "text/html",
  );

  it("extracts exactly the 4 linked page URLs", () => {
    const urls = extractLinkedPageUrls(doc, PAGE_URL);
    expect(new Set(urls)).toEqual(new Set(LINKED_URLS));
  });

  it("loads all 4 linked pages via the fetcher", async () => {
    const fetcher = vi.fn(async (url: string) => {
      const name = url.split("/").pop()!;
      return readFixture(name);
    });

    const pages = await loadLinkedPages(doc, PAGE_URL, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(4);
    for (const url of LINKED_URLS) {
      expect(fetcher).toHaveBeenCalledWith(url);
    }
    expect(pages.size).toBe(4);
    for (const url of LINKED_URLS) {
      const linkedDoc = pages.get(url)!;
      expect(linkedDoc.querySelector("title")).not.toBeNull();
    }
  });
});
