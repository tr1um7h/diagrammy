import mermaid from "mermaid";
import { DiagramLanguage } from "../types";
import type { RenderResult } from "../types";

let initialized = false;

function ensureInit() {
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
    });
    initialized = true;
  }
}

let renderSeq = 0;

/**
 * Unified render entry: renders a diagram source to an SVG string, fully local.
 * PlantUML is planned for Phase 3 (local picoweb sidecar).
 */
export async function renderDiagram(
  language: DiagramLanguage,
  source: string,
): Promise<RenderResult> {
  if (language !== DiagramLanguage.Mermaid) {
    return { svg: null, error: "PlantUML 渲染将在 Phase 3 支持" };
  }
  ensureInit();

  const id = `dgmmy-${++renderSeq}`;
  try {
    const { svg } = await mermaid.render(id, source);
    return { svg, error: null };
  } catch (e) {
    // mermaid leaves a temp error element in the DOM on failure
    document.getElementById(id)?.remove();
    document.getElementById(`${id}-temp`)?.remove();
    const message = e instanceof Error ? e.message : String(e);
    return { svg: null, error: message };
  }
}
