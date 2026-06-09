// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { extractLinkedPageUrls, loadLinkedPages } from "../src/loader";
import { readFixture } from "./helpers";

const LINKED_NAMES = ["wi.html", "wb.html", "a1i.html", "bitrd.html"];

function describeVariant(variant: "mpeuni" | "mpegif") {
  const base = `https://us.metamath.org/${variant}/`;
  const pageUrl = `${base}bitrdi.html`;
  const linkedUrls = LINKED_NAMES.map((n) => `${base}${n}`);

  describe(`${variant}/bitrdi.html`, () => {
    const doc = new DOMParser().parseFromString(
      readFixture(variant, "bitrdi.html"),
      "text/html",
    );

    it("extracts exactly the 4 linked page URLs", () => {
      const urls = extractLinkedPageUrls(doc, pageUrl);
      expect(new Set(urls)).toEqual(new Set(linkedUrls));
    });

    it("loads all 4 linked pages via the fetcher", async () => {
      const fetcher = vi.fn(async (url: string) => {
        const name = url.split("/").pop()!;
        return readFixture(variant, name);
      });

      const pages = await loadLinkedPages(doc, pageUrl, fetcher);

      expect(fetcher).toHaveBeenCalledTimes(4);
      for (const url of linkedUrls) {
        expect(fetcher).toHaveBeenCalledWith(url);
      }
      expect(pages.size).toBe(4);
      for (const url of linkedUrls) {
        expect(pages.get(url)!.querySelector("title")).not.toBeNull();
      }
    });
  });
}

describeVariant("mpeuni");
describeVariant("mpegif");
