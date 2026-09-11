import { useCallback, useEffect, useRef, useState } from "react";
import { findSelected, useAppStore } from "../store/appStore";
import { useDiagramSvg } from "../hooks/useDiagramSvg";
import { useSize } from "../hooks/useLazyRender";

const MIN_SCALE = 0.05;
const MAX_SCALE = 6;

export function PreviewViewer() {
  const files = useAppStore((s) => s.files);
  const selectedId = useAppStore((s) => s.selectedId);
  const drafts = useAppStore((s) => s.drafts);

  const found = findSelected(files, selectedId);
  const source = found ? (drafts[found.block.id] ?? found.block.source) : null;
  const language = found?.block.language ?? "mermaid";
  const { svg, error, pending } = useDiagramSvg(language, source ?? "");

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { size: viewportSize } = useSize<HTMLDivElement>();

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const [grabbing, setGrabbing] = useState(false);
  const dragRef = useRef<{ lastX: number; lastY: number } | null>(null);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    const svgEl = viewport?.querySelector("svg") as SVGSVGElement | null;
    if (!viewport || !svgEl) return;
    // mermaid v11 emits `<svg width="100%">`, which collapses inside an
    // absolutely-positioned shrink-to-fit wrapper; pin it to the viewBox size.
    const vb = svgEl.viewBox.baseVal;
    let w = 400;
    let h = 300;
    if (vb.width > 0 && vb.height > 0) {
      w = vb.width;
      h = vb.height;
      svgEl.setAttribute("width", String(w));
      svgEl.setAttribute("height", String(h));
      svgEl.style.maxWidth = "none";
    } else {
      try {
        const bbox = svgEl.getBBox();
        w = bbox.width || 400;
        h = bbox.height || 300;
      } catch {
        /* getBBox can throw if not rendered */
      }
    }
    const vw = Math.max(viewport.clientWidth - 80, 100);
    const vh = Math.max(viewport.clientHeight - 80, 100);
    const s = Math.min(vw / w, vh / h, 2);
    setScale(s);
    setPan({
      x: (viewport.clientWidth - w * s) / 2,
      y: Math.max((viewport.clientHeight - h * s) / 2, 20),
    });
  }, []);

  // Re-fit whenever the selected diagram (or its rendered size) changes.
  const svgReadyKey = `${selectedId}::${svg ? (svg.length) : "none"}`;
  useEffect(() => {
    if (svg) fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgReadyKey]);

  // Refit on window resize (keep the diagram centered).
  const firstResize = useRef(true);
  useEffect(() => {
    if (firstResize.current) {
      firstResize.current = false;
      return;
    }
    if (svg) fitToView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportSize.width, viewportSize.height]);

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setScale((scale) => {
      const next = Math.min(Math.max(scale * factor, MIN_SCALE), MAX_SCALE);
      setPan((pan) => ({
        x: cx - (cx - pan.x) * (next / scale),
        y: cy - (cy - pan.y) * (next / scale),
      }));
      return next;
    });
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { lastX: e.clientX, lastY: e.clientY };
    setGrabbing(true);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setPan((pan) => ({
        x: pan.x + e.clientX - drag.lastX,
        y: pan.y + e.clientY - drag.lastY,
      }));
      dragRef.current = { lastX: e.clientX, lastY: e.clientY };
    };
    const onUp = () => {
      dragRef.current = null;
      setGrabbing(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const zoomBy = (factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    zoomAt(factor, (rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div
        ref={viewportRef}
        className={`relative flex-1 overflow-hidden ${
          grabbing ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          background:
            "linear-gradient(90deg, #f8f8f8 1px, transparent 1px), linear-gradient(#f8f8f8 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
      >
        {found && svg ? (
          <div
            className="absolute top-0 left-0"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: "0 0" }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : null}
        {!found && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
            从左侧选择一个图表开始预览
          </div>
        )}
        {found && error && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 max-w-[80%] rounded-md bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2">
            渲染错误（保留上次成功结果）：{error}
          </div>
        )}
        {found && pending && !error && (
          <div className="absolute top-3 right-3 text-[11px] text-gray-400">渲染中…</div>
        )}
      </div>
      <div className="flex justify-center items-center py-2.5 border-t border-gray-200 gap-2">
        <div className="flex items-center bg-zinc-900 rounded-full p-1 gap-0.5">
          <button
            className="w-8 h-8 rounded-full text-white hover:bg-white/15 text-base"
            onClick={() => zoomBy(1 / 1.2)}
          >
            −
          </button>
          <span className="text-white text-xs w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            className="w-8 h-8 rounded-full text-white hover:bg-white/15 text-base"
            onClick={() => zoomBy(1.2)}
          >
            +
          </button>
        </div>
        <div className="flex items-center bg-zinc-900 rounded-full p-1 gap-0.5">
          <button
            className="px-3 h-8 rounded-full text-white text-xs hover:bg-white/15"
            onClick={() => {
              setScale(1);
              setPan({ x: 40, y: 30 });
            }}
          >
            1:1
          </button>
          <button
            className="px-3 h-8 rounded-full text-white text-xs hover:bg-white/15"
            onClick={fitToView}
          >
            Fit
          </button>
        </div>
      </div>
    </div>
  );
}
