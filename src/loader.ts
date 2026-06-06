export type Fetcher = (url: string) => Promise<string>

/**
 * Finds the URLs of all pages linked from the syntax hints row and the Ref
 * column of the proof table on a metamath proof page.
 */
export function extractLinkedPageUrls(doc: Document, pageUrl: string): string[] {
  const base = new URL(pageUrl)
  const urls = new Set<string>()

  const resolve = (href: string) => new URL(href, base).href

  // Syntax hints links: look for <B>Syntax hints:</B> and collect <A> within its cell.
  for (const b of doc.querySelectorAll("b")) {
    if (b.textContent?.trim() === "Syntax hints:") {
      const cell = b.closest("td") ?? b.closest("tr")
      if (cell) {
        for (const a of cell.querySelectorAll("a[href]")) {
          const href = a.getAttribute("href")
          if (href && !href.startsWith("#")) urls.add(resolve(href))
        }
      }
    }
  }

  // Ref column links: 3rd TD in each row of the proof table.
  const proofTable = doc.querySelector('table[summary="Proof of theorem"]')
  if (proofTable) {
    for (const tr of proofTable.querySelectorAll("tr")) {
      const tds = tr.querySelectorAll("td")
      if (tds.length >= 3) {
        for (const a of tds[2].querySelectorAll("a[href]")) {
          const href = a.getAttribute("href")
          if (href && !href.startsWith("#")) urls.add(resolve(href))
        }
      }
    }
  }

  return [...urls]
}

/**
 * Fetches every linked page and returns a map from URL to parsed Document.
 */
export async function loadLinkedPages(
  doc: Document,
  pageUrl: string,
  fetcher: Fetcher,
): Promise<Map<string, Document>> {
  const urls = extractLinkedPageUrls(doc, pageUrl)
  const parser = new DOMParser()
  const results = new Map<string, Document>()
  await Promise.all(
    urls.map(async (url) => {
      const html = await fetcher(url)
      results.set(url, parser.parseFromString(html, "text/html"))
    }),
  )
  return results
}
