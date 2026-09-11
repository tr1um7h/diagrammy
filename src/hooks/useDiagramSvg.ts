import { useEffect, useState } from "react";
import { DiagramLanguage } from "../types";
import { contentHash, getCachedSvg, setCachedSvg } from "../modules/cache";
import { renderDiagram } from "../modules/render-engine";
import { parseErrorLine, useAppStore } from "../store/appStore";

/**
 * Render a diagram source to SVG with content-hash caching. On render error,
 * the previous successful SVG is kept so editing is never interrupted by a
 * blank preview (design doc 3.7).
 *
 * When `diagramId` is given, render errors are reported to the app store so
 * the source editor can highlight the offending line (only the main preview
 * passes it — thumbnails must not race each other writing this state).
 */
export function useDiagramSvg(
  language: DiagramLanguage,
  source: string,
  diagramId?: string,
) {
  const key = contentHash(language, source);
  const isHtml = language === DiagramLanguage.HTML;
  const [svg, setSvg] = useState<string | null>(() =>
    isHtml ? null : getCachedSvg(key) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isHtml) return; // html blocks render in an iframe, not via mermaid
    let cancelled = false;
    const cached = getCachedSvg(key);
    if (cached) {
      setSvg(cached);
      setError(null);
      setPending(false);
      if (diagramId) useAppStore.getState().setRenderError(diagramId, null);
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
        if (diagramId) useAppStore.getState().setRenderError(diagramId, null);
      } else {
        setError(error);
        if (diagramId && error) {
          useAppStore
            .getState()
            .setRenderError(diagramId, { message: error, line: parseErrorLine(error) });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { svg, error, pending };
}
