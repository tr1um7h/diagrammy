/** 渲染引擎种类（决定一个 diagram 块用什么方式渲染） */
export enum DiagramLanguage {
  Mermaid = "mermaid",
  PlantUML = "plantuml",
  HTML = "html", // 自包含 HTML 图表页（如 archify 导出），iframe 渲染
}

/** 源文件种类（决定解析方式），由扩展名判定 */
export enum SourceKind {
  MD = "md",
  MMD = "mmd",
  PUML = "puml",
  HTML = "html",
}

export function sourceKindFromExtension(ext: string): SourceKind | null {
  const e = ext.toLowerCase();
  if (e === SourceKind.MD) return SourceKind.MD;
  if (e === SourceKind.MMD) return SourceKind.MMD;
  if (e === SourceKind.PUML) return SourceKind.PUML;
  if (e === SourceKind.HTML) return SourceKind.HTML;
  return null;
}

export type DiagramBlock = {
  id: string; // `${fileId}#${blockIndex}`
  fileId: string; // file path as id
  blockIndex: number;
  language: DiagramLanguage;
  title: string;
  source: string;
  startOffset: number; // content offsets within the file, used for write-back
  endOffset: number;
};

export interface MarkdownFile {
  id: string; // relative-ish path
  path: string; // absolute path
  name: string;
  content: string;
  diagrams: DiagramBlock[];
  lastModified: number;
}

export interface RenderResult {
  svg: string | null;
  error: string | null;
}

export interface SourceFileInfo {
  name: string;
  path: string;
}