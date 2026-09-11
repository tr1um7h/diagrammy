import { useEffect, useState } from "react";
import { contentHash, getCachedSvg, setCachedSvg } from "../modules/cache";
import { renderDiagram } from "../modules/render-engine";
import type { DiagramLanguage } from "../types";

/**
 * Render a diagram source to SVG with content-hash caching. On render error,
 * the previous successful SVG is kept so editing is never interrupted by a
 * blank preview (design doc 3.7).
 */
export function useDiagramSvg(language: DiagramLanguage, source: string) {
  const key = contentHash(language, source);
  const [svg, setSvg] = useState<string | null>(() => getCachedSvg(key) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedSvg(key);
    if (cached) {
      setSvg(cached);
      setError(null);
      setPending(false);
      return;
    }
    setPending(true);
    void renderDiagram(language, source).then(({ svg, error }) => {
      if (cancelled) return;
      setPending(false);
      if (svg) {
        setCachedSvg(key, svg);
        setSvg(svg);
        setError(null);
      } else {
        setError(error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { svg, error, pending };
}
