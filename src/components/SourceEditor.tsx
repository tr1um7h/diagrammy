import { findSelected, useAppStore } from "../store/appStore";

const SAVE_DEBOUNCE_MS = 300;

export function SourceEditor() {
  const files = useAppStore((s) => s.files);
  const selectedId = useAppStore((s) => s.selectedId);
  const drafts = useAppStore((s) => s.drafts);
  const setDraft = useAppStore((s) => s.setDraft);
  const saveEditing = useAppStore((s) => s.saveEditing);
  const setEditing = useAppStore((s) => s.setEditing);

  const found = findSelected(files, selectedId);
  if (!found) return null;

  const { block, file } = found;
  const value = drafts[block.id] ?? block.source;
  const dirty = drafts[block.id] !== undefined && drafts[block.id] !== block.source;

  const save = () => {
    void saveEditing();
  };

  return (
    <div className="w-[380px] shrink-0 flex flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
        <span className="text-[11px] text-gray-500 truncate">
          {file.name}
        </span>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-[11px] text-amber-500">● 未保存</span>}
          <button
            className={`text-[11px] px-2.5 py-1 rounded-md border ${
              dirty
                ? "border-indigo-500 bg-indigo-500 text-white hover:bg-indigo-600"
                : "border-gray-300 bg-white text-gray-400"
            }`}
            onClick={save}
            disabled={!dirty}
          >
            保存回写
          </button>
          <button
            className="text-[11px] px-2.5 py-1 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
            onClick={() => setEditing(false)}
          >
            关闭
          </button>
        </div>
      </div>
      <textarea
        className="flex-1 resize-none bg-transparent p-3.5 font-mono text-[12.5px] leading-relaxed outline-none"
        spellCheck={false}
        value={value}
        onChange={(e) => {
          setDraft(block.id, e.target.value);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            save();
          }
        }}
      />
      <div className="px-4 py-1.5 border-t border-gray-200 text-[10.5px] text-gray-400">
        ⌘S 保存回写源文件 · 偏移量 {block.startOffset}–{block.endOffset}
      </div>
    </div>
  );
}

export { SAVE_DEBOUNCE_MS };
