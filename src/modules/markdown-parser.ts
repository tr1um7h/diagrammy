import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import { DiagramLanguage } from "../types";
import type { DiagramBlock } from "../types";

const parser = unified().use(remarkParse);

interface CodeNode {
  type: string;
  lang?: string | null;
  value?: string;
  position?: {
    start: { offset: number | null };
    end: { offset: number | null };
  };
}

interface HeadingNode {
  type: string;
  depth?: number;
  children?: Array<{ type: string; value?: string }>;
}

function normalizeLanguage(lang: string | null | undefined): DiagramLanguage | null {
  const l = (lang ?? "").trim().toLowerCase();
  if (l === DiagramLanguage.Mermaid) return DiagramLanguage.Mermaid;
  if (l === "plantuml" || l === "puml") return DiagramLanguage.PlantUML;
  return null;
}

/**
 * Parse a markdown string and extract all mermaid/plantuml fenced code blocks
 * with byte offsets (remark nodes carry position.start/end.offset directly).
 * Title comes from the nearest heading above the block, falling back to
 * `filename #n`.
 */
export function parseMarkdownDiagrams(
  fileName: string,
  fileId: string,
  content: string,
): DiagramBlock[] {
  const tree = parser.parse(content);
  const blocks: DiagramBlock[] = [];
  let lastHeading: string | null = null;

  visit(tree, (node) => {
    const n = node as unknown as CodeNode & HeadingNode;
    if (n.type === "heading" && n.children) {
      const text = n.children
        .filter((c) => c.type === "text" || c.type === "inlineCode")
        .map((c) => c.value ?? "")
        .join("")
        .trim();
      if (text) lastHeading = text;
      return;
    }
    if (n.type !== "code") return;

    const language = normalizeLanguage(n.lang);
    if (!language) return;

    const startOffset = n.position?.start.offset ?? null;
    const endOffset = n.position?.end.offset ?? null;
    if (startOffset === null || endOffset === null) return;

    const blockIndex = blocks.length;
    blocks.push({
      id: `${fileId}#${blockIndex}`,
      fileId,
      blockIndex,
      language,
      title: lastHeading ?? `${fileName} #${blockIndex + 1}`,
      source: n.value ?? "",
      startOffset,
      endOffset,
    });
  });

  return blocks;
}

/** For .mmd / .puml files the whole content is a single diagram block. */
export function parseWholeFileDiagram(
  fileName: string,
  fileId: string,
  content: string,
  language: DiagramLanguage,
): DiagramBlock[] {
  return [
    {
      id: `${fileId}#0`,
      fileId,
      blockIndex: 0,
      language,
      title: fileName,
      source: content,
      startOffset: 0,
      endOffset: content.length,
    },
  ];
}

/** Replace a code block region in the original content (string-level splice). */
export function applySourceToContent(
  content: string,
  startOffset: number,
  endOffset: number,
  newSource: string,
): string {
  return content.slice(0, startOffset) + newSource + content.slice(endOffset);
}
