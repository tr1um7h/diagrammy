export type DiagramLanguage = "mermaid" | "plantuml";

export interface DiagramBlock {
  id: string; // `${fileId}#${blockIndex}`
  fileId: string; // file path as id
  blockIndex: number;
  language: DiagramLanguage;
  title: string;
  source: string;
  startOffset: number; // content offsets within the file, used for write-back
  endOffset: number;
}

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
