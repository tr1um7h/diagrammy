/**
 * In-memory render cache keyed by content hash (FNV-1a, lightweight per design
 * doc 3.4): identical source+language renders hit the cache instead of
 * re-running mermaid.
 */
const svgCache = new Map<string, string>();

export function contentHash(language: string, source: string): string {
  let h = 0x811c9dc5;
  const key = `${language}::${source}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export function getCachedSvg(key: string): string | undefined {
  return svgCache.get(key);
}

export function setCachedSvg(key: string, svg: string): void {
  svgCache.set(key, svg);
}

export function clearCache(): void {
  svgCache.clear();
}
