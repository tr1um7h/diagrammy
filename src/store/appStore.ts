import { create } from "zustand";
import { invoke } from "../lib/tauri";
import type { DiagramBlock, MarkdownFile, SourceFileInfo } from "../types";
import {
  applySourceToContent,
  parseMarkdownDiagrams,
  parseWholeFileDiagram,
} from "../modules/markdown-parser";

const LAST_DIR_KEY = "diagrammy.lastDirectory";

function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

async function loadFile(path: string, name: string): Promise<MarkdownFile> {
  const content = await invoke<string>("read_file", { filePath: path });
  const ext = fileExtension(name);
  const id = path;
  const diagrams =
    ext === "mmd"
      ? parseWholeFileDiagram(name, id, content, "mermaid")
      : ext === "puml"
        ? parseWholeFileDiagram(name, id, content, "plantuml")
        : parseMarkdownDiagrams(name, id, content);
  return {
    id,
    path,
    name,
    content,
    diagrams,
    lastModified: Date.now(),
  };
}

interface AppState {
  rootPath: string | null;
  files: MarkdownFile[];
  selectedId: string | null;
  editing: boolean;
  sidebarVisible: boolean;
  drafts: Record<string, string>; // diagramId -> edited source (not yet saved)
  loading: boolean;
  loadError: string | null;
  externalChangeHint: string | null;

  openFolder: (path: string) => Promise<void>;
  pickAndOpenFolder: () => Promise<void>;
  reloadFile: (path: string, name: string) => Promise<void>;
  select: (diagramId: string | null) => void;
  selectNeighbor: (delta: 1 | -1) => void;
  toggleSidebar: () => void;
  setEditing: (editing: boolean) => void;
  setDraft: (diagramId: string, source: string) => void;
  saveEditing: () => Promise<void>;
  clearExternalHint: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  rootPath: null,
  files: [],
  selectedId: null,
  editing: false,
  sidebarVisible: true,
  drafts: {},
  loading: false,
  loadError: null,
  externalChangeHint: null,

  openFolder: async (path: string) => {
    set({ loading: true, loadError: null, selectedId: null, editing: false, drafts: {} });
    try {
      const scanned = await invoke<SourceFileInfo[]>("scan_source_files", { directory: path });
      const files: MarkdownFile[] = [];
      for (const f of scanned) {
        try {
          files.push(await loadFile(f.path, f.name));
        } catch (e) {
          console.error(`failed to load ${f.path}:`, e);
        }
      }
      files.sort((a, b) => a.name.localeCompare(b.name));
      localStorage.setItem(LAST_DIR_KEY, path);
      const first = files.find((f) => f.diagrams.length > 0)?.diagrams[0]?.id ?? null;
      set({ rootPath: path, files, loading: false, selectedId: first });
      await invoke("watch_directory", { directory: path });
    } catch (e) {
      set({ loading: false, loadError: String(e) });
    }
  },

  pickAndOpenFolder: async () => {
    const path = await invoke<string | null>("select_directory");
    if (path) await get().openFolder(path);
  },

  reloadFile: async (path: string, name: string) => {
    try {
      const file = await loadFile(path, name);
      set((s) => ({
        files: s.files.some((f) => f.id === path)
          ? s.files.map((f) => (f.id === path ? file : f))
          : [...s.files, file].sort((a, b) => a.name.localeCompare(b.name)),
      }));
    } catch (e) {
      console.error(`failed to reload ${path}:`, e);
    }
  },

  select: (diagramId) => set({ selectedId: diagramId, externalChangeHint: null }),

  /** Move selection to the previous/next diagram across the whole library. */
  selectNeighbor: (delta) => {
    const { files, selectedId } = get();
    const flatIds = files.flatMap((f) => f.diagrams.map((d) => d.id));
    if (flatIds.length === 0) return;
    const idx = selectedId ? flatIds.indexOf(selectedId) : -1;
    const next = idx < 0 ? 0 : Math.min(Math.max(idx + delta, 0), flatIds.length - 1);
    set({ selectedId: flatIds[next], externalChangeHint: null });
  },

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),

  setEditing: (editing) => set({ editing }),

  setDraft: (diagramId, source) =>
    set((s) => ({ drafts: { ...s.drafts, [diagramId]: source } })),

  saveEditing: async () => {
    const { selectedId, drafts, files } = get();
    if (!selectedId) return;
    const source = drafts[selectedId];
    if (source === undefined) return;

    const file = files.find((f) => f.diagrams.some((d) => d.id === selectedId));
    const block = file?.diagrams.find((d) => d.id === selectedId);
    if (!file || !block) return;

    const newContent = applySourceToContent(
      file.content,
      block.startOffset,
      block.endOffset,
      source,
    );
    try {
      await invoke("write_file", { filePath: file.path, content: newContent });
      set((s) => {
        const drafts = { ...s.drafts };
        delete drafts[selectedId];
        return { drafts };
      });
      await get().reloadFile(file.path, file.name);
    } catch (e) {
      set({ loadError: `保存失败: ${String(e)}` });
    }
  },

  clearExternalHint: () => set({ externalChangeHint: null }),
}));

/** Find the currently selected diagram block (or null). */
export function findSelected(
  files: MarkdownFile[],
  selectedId: string | null,
): { file: MarkdownFile; block: DiagramBlock } | null {
  if (!selectedId) return null;
  for (const file of files) {
    const block = file.diagrams.find((d) => d.id === selectedId);
    if (block) return { file, block };
  }
  return null;
}

export function lastOpenedDirectory(): string | null {
  return localStorage.getItem(LAST_DIR_KEY);
}
