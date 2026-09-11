import { useEffect, useRef } from "react";
import { listen } from "./lib/tauri";
import { Sidebar } from "./components/Sidebar";
import { PreviewViewer } from "./components/PreviewViewer";
import { SourceEditor } from "./components/SourceEditor";
import { findSelected, lastOpenedDirectory, useAppStore } from "./store/appStore";

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

export default function App() {
  const rootPath = useAppStore((s) => s.rootPath);
  const files = useAppStore((s) => s.files);
  const selectedId = useAppStore((s) => s.selectedId);
  const editing = useAppStore((s) => s.editing);
  const drafts = useAppStore((s) => s.drafts);
  const loading = useAppStore((s) => s.loading);
  const loadError = useAppStore((s) => s.loadError);
  const externalChangeHint = useAppStore((s) => s.externalChangeHint);
  const openFolder = useAppStore((s) => s.openFolder);
  const pickAndOpenFolder = useAppStore((s) => s.pickAndOpenFolder);
  const reloadFile = useAppStore((s) => s.reloadFile);
  const setEditing = useAppStore((s) => s.setEditing);
  const clearExternalHint = useAppStore((s) => s.clearExternalHint);
  const sidebarVisible = useAppStore((s) => s.sidebarVisible);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const selectNeighbor = useAppStore((s) => s.selectNeighbor);

  const bootstrapped = useRef(false);

  // Auto-open the last opened folder on startup.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const last = lastOpenedDirectory();
    if (last) void openFolder(last);
  }, [openFolder]);

  // File watching: debounce fs events 300ms, then reload changed files unless
  // the user is editing that very file (show a conflict hint instead).
  const pendingChanges = useRef<Set<string>>(new Set());
  const debounceTimer = useRef<number | null>(null);

  useEffect(() => {
    const unlisten = listen<string[]>("fs-change", (payload) => {
      for (const p of payload) pendingChanges.current.add(p);
      if (debounceTimer.current !== null) return;
      debounceTimer.current = window.setTimeout(() => {
        debounceTimer.current = null;
        const paths = [...pendingChanges.current];
        pendingChanges.current.clear();

        const state = useAppStore.getState();
        const selected = findSelected(state.files, state.selectedId);
        const editingPath =
          state.editing && selected ? selected.file.path : null;

        for (const path of paths) {
          if (path === editingPath && Object.keys(state.drafts).length > 0) {
            useAppStore.setState({ externalChangeHint: basename(path) });
            continue;
          }
          const known = state.files.find((f) => f.path === path);
          void reloadFile(path, known?.name ?? basename(path));
        }
      }, 300);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [reloadFile]);

  // Global shortcuts: ⌘B toggles the sidebar; arrow keys move selection
  // to the previous/next diagram. Skipped while typing in the editor.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        selectNeighbor(1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        selectNeighbor(-1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar, selectNeighbor]);

  const found = findSelected(files, selectedId);
  const hasUnsaved =
    found !== null &&
    drafts[found.block.id] !== undefined &&
    drafts[found.block.id] !== found.block.source;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white text-gray-900">
      {rootPath === null && !loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-5xl">📊</div>
          <div className="text-xl font-semibold">Diagrammy</div>
          <div className="text-sm text-gray-500">
            打开一个文件夹，浏览其中 Markdown / Mermaid 图表
          </div>
          <button
            className="px-5 py-2.5 rounded-lg bg-indigo-500 text-white text-sm hover:bg-indigo-600"
            onClick={() => void pickAndOpenFolder()}
          >
            打开文件夹…
          </button>
          {loadError && <div className="text-xs text-red-500">{loadError}</div>}
        </div>
      ) : (
        <>
          <header className="flex items-center justify-between px-5 py-2.5 border-b border-gray-200">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="text-xs px-2 py-1.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                title={sidebarVisible ? "隐藏侧栏 (⌘B)" : "显示侧栏 (⌘B)"}
                onClick={toggleSidebar}
              >
                {sidebarVisible ? "«" : "☰"}
              </button>
              <div className="min-w-0">
                <span className="text-sm font-semibold">
                  {found?.block.title ?? "Diagrammy"}
                </span>
                {found && (
                  <span className="text-xs text-gray-500 ml-2">
                    · {found.file.name}
                  </span>
                )}
                {hasUnsaved && (
                  <span className="text-xs text-amber-500 ml-3">● 有未保存修改</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 mr-2">
                方向键切换图表 · 单击缩略图预览 · 双击编辑 · 滚轮缩放 / 拖拽平移
              </span>
              <button
                className={`text-xs px-3 py-1.5 rounded-full border ${
                  editing
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => setEditing(!editing)}
                disabled={!found}
              >
                {editing ? "✓ 完成编辑" : "✎ 编辑"}
              </button>
            </div>
          </header>
          {externalChangeHint && (
            <div className="flex items-center justify-between px-5 py-1.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
              <span>
                ⚠ {externalChangeHint} 已被外部修改，你的未保存编辑可能与之冲突
              </span>
              <button
                className="underline hover:text-amber-900"
                onClick={clearExternalHint}
              >
                知道了
              </button>
            </div>
          )}
          <div className="flex-1 flex min-h-0">
            {sidebarVisible && <Sidebar />}
            {editing && <SourceEditor />}
            <PreviewViewer />
          </div>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-gray-500">
              正在扫描并解析…
            </div>
          )}
          {loadError && (
            <div className="px-5 py-1.5 bg-red-50 border-t border-red-200 text-xs text-red-600">
              {loadError}
            </div>
          )}
        </>
      )}
    </div>
  );
}
