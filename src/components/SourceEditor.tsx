import { useEffect, useRef, useState } from "react";
import { DiagramLanguage } from "../types";
import { findSelected, useAppStore } from "../store/appStore";

// Line metric contract between the gutter and the textarea — both must use
// the exact same font-size/line-height or the numbers drift out of alignment.
const FONT_SIZE = "12.5px";
const LINE_HEIGHT = "20px";
const TOP_PADDING = 14; // px, matches the textarea's top padding

export function SourceEditor() {
  const files = useAppStore((s) => s.files);
  const selectedId = useAppStore((s) => s.selectedId);
  const drafts = useAppStore((s) => s.drafts);
  const renderErrors = useAppStore((s) => s.renderErrors);
  const setDraft = useAppStore((s) => s.setDraft);
  const saveEditing = useAppStore((s) => s.saveEditing);
  const setEditing = useAppStore((s) => s.setEditing);

  const [scrollTop, setScrollTop] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastErrorKey = useRef<string>("");

  const found = findSelected(files, selectedId);
  if (!found || found.block.language === DiagramLanguage.HTML) return null;

  const { block, file } = found;
  const value = drafts[block.id] ?? block.source;
  const dirty = drafts[block.id] !== undefined && drafts[block.id] !== block.source;
  const renderError = renderErrors[block.id];
  const lines = value.split("\n");

  // Scroll the first syntax error into view once per new error.
  const errorKey = renderError ? `${block.id}::${renderError.message}` : "";
  useEffect(() => {
    if (!errorKey || errorKey === lastErrorKey.current) return;
    lastErrorKey.current = errorKey;
    if (renderError?.line && textareaRef.current) {
      textareaRef.current.scrollTop = Math.max((renderError.line - 3) * 20, 0);
      setScrollTop(textareaRef.current.scrollTop);
    }
  }, [errorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    void saveEditing();
  };

  return (
    <div className="w-[420px] shrink-0 flex flex-col border-r border-gray-200 bg-gray-50">
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
      <div className="flex flex-1 min-h-0">
        <div
          className="w-12 shrink-0 overflow-hidden bg-gray-100 border-r border-gray-200 text-right select-none"
          aria-hidden
        >
          <div style={{ transform: `translateY(${TOP_PADDING - scrollTop}px)` }}>
            {lines.map((_, i) => {
              const isError = renderError?.line === i + 1;
              return (
                <div
                  key={i}
                  className={`pr-2 tabular-nums ${
                    isError ? "bg-red-100 text-red-600 font-semibold" : "text-gray-400"
                  }`}
                  style={{ fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT, height: LINE_HEIGHT }}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          className="flex-1 resize-none bg-transparent py-0 px-3 font-mono text-gray-800 outline-none whitespace-pre overflow-auto"
          spellCheck={false}
          value={value}
          style={{ fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT, paddingTop: TOP_PADDING }}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
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
      </div>
      <div className="px-4 py-1.5 border-t border-gray-200 text-[10.5px] min-h-[28px]">
        {renderError ? (
          <span className="text-red-600 truncate block">
            ⚠ {renderError.line ? `第 ${renderError.line} 行：` : ""}
            {renderError.message}
          </span>
        ) : (
          <span className="text-gray-400">
            ⌘S 保存回写源文件 · 偏移量 {block.startOffset}–{block.endOffset}
          </span>
        )}
      </div>
    </div>
  );
}
