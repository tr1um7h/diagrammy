import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Thumbnail with lazy rendering: mermaid render is triggered only when the
 * item enters the viewport (IntersectionObserver), per design doc 5.4.
 */
export function useLazyRender(render: () => Promise<void>, deps: unknown[]) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const renderRef = useRef(render);
  renderRef.current = render;

  useEffect(() => {
    if (visible) void renderRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ...deps]);

  return { ref, visible };
}

/** Resize observer returning element size. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const el = ref.current;
    if (el) setSize({ width: el.clientWidth, height: el.clientHeight });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [measure]);

  return { ref, size, measure };
}
