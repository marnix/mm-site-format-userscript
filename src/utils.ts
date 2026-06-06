/** Extracts the theorem name from a metamath proof page URL, e.g. "ru" from ".../mpeuni/ru.html". */
export function extractTheoremName(url: string): string | null {
  const match = url.match(/\/([^/]+)\.html$/);
  return match ? match[1] : null;
}
