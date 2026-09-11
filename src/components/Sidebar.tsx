import { useEffect, useRef } from "react";
import { DiagramLanguage } from "../types";
import { useAppStore } from "../store/appStore";
import { useDiagramSvg } from "../hooks/useDiagramSvg";
import { useLazyRender } from "../hooks/useLazyRender";
import type { DiagramBlock, MarkdownFile } from "../types";

interface ThumbnailProps {
  file: MarkdownFile;
  block: DiagramBlock;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

function Thumbnail({ file, block, active, onSelect, onEdit }: ThumbnailProps) {
  const drafts = useAppStore((s) => s.drafts);
  const source = drafts[block.id] ?? block.source;
  const { svg, error } = useDiagramSvg(block.language, source);
  const rowRef = useRef<HTMLDivElement | null>(null);

  const { ref, visible } = useLazyRender(async () => {
    // Rendering happens inside useDiagramSvg; this hook only gates visibility.
  }, [block.id, source]);

  // Keyboard navigation may select an item outside the viewport; keep it visible.
  useEffect(() => {
    if (active) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div
      ref={(el) => {
        rowRef.current = el;
        ref.current = el;
      }}
      className={`flex items-center gap-2.5 px-4 py-1.5 cursor-pointer border-l-2 ${
        active
          ? "bg-indigo-50 border-l-indigo-500"
          : "border-l-transparent hover:bg-gray-100"
      }`}
      onClick={onSelect}
      onDoubleClick={onEdit}
    >
      {block.language === DiagramLanguage.HTML ? (
        <div className="w-16 h-11 shrink-0 relative overflow-hidden rounded-md border border-gray-200 bg-white">
          {visible && (
            <iframe
              srcDoc={source}
              sandbox="allow-scripts"
              className="absolute top-0 left-0 origin-top-left border-0 pointer-events-none"
              style={{ width: 1440, height: 900, transform: "scale(0.045)" }}
            />
          )}
        </div>
      ) : (
        <div className="w-16 h-11 shrink-0 flex items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-white">
          {visible && svg ? (
            <div
              className="w-[90%] h-[90%] pointer-events-none [&_svg]:max-w-full [&_svg]:max-h-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <span className="text-[10px] text-gray-300">
              {error ? "✕" : "…"}
            </span>
          )}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-gray-800 truncate">
          {block.title}
        </div>
        <div className="text-[11px] text-gray-500 truncate">{file.name}</div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const rootPath = useAppStore((s) => s.rootPath);
  const files = useAppStore((s) => s.files);
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);
  const setEditing = useAppStore((s) => s.setEditing);
  const pickAndOpenFolder = useAppStore((s) => s.pickAndOpenFolder);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <aside className="w-72 shrink-0 flex flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="text-[13px] font-semibold text-gray-800 truncate">
          📁 {rootPath ? rootPath.split("/").pop() : "未打开文件夹"}
        </span>
        <div className="flex items-center gap-1">
          <button
            className="text-[11px] px-2 py-1 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-100"
            onClick={() => void pickAndOpenFolder()}
          >
            打开…
          </button>
          <button
            className="text-[11px] px-2 py-1 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-100"
            title="隐藏侧栏 (⌘B)"
            onClick={toggleSidebar}
          >
            «
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {files.map((file) =>
          file.diagrams.length === 0 ? null : (
            <div key={file.id}>
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-[11px] font-semibold text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
                {file.name}
                <span className="font-normal">· {file.diagrams.length}</span>
              </div>
              {file.diagrams.map((block) => (
                <Thumbnail
                  key={block.id}
                  file={file}
                  block={block}
                  active={block.id === selectedId}
                  onSelect={() => select(block.id)}
                  onEdit={() => {
                    if (block.language === DiagramLanguage.HTML) return; // 源文件型图表不支持源码编辑
                    select(block.id);
                    setEditing(true);
                  }}
                />
              ))}
            </div>
          ),
        )}
      </div>
    </aside>
  );
}
