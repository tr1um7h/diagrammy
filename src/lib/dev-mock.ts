/**
 * Browser-only mock backend for `npm run dev` outside Tauri. Reads the real
 * markdown files through Vite's /@fs/ endpoint so the oceanbase docs can be
 * exercised in a plain browser.
 */
const writeOverrides = new Map<string, string>();

const OCEANBASE_FILES = [
  "/Users/steve/build/oceanbase/oceanbase_data_organization.md",
  "/Users/steve/build/oceanbase/oceanbase_paxos_deep_dive.md",
  "/Users/steve/build/oceanbase/oceanbase_sql_execution_engine.md",
  "/Users/steve/build/oceanbase/oceanbase_storage_engine.md",
  "/Users/steve/build/oceanbase/oceanbase_tenant_unit_resource_model.md",
];

const DEMO_MD = `# Demo

## 流程图

\`\`\`mermaid
flowchart TB
    A[客户端] --> B[网关]
    B --> C[服务]
\`\`\`

## 时序图

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: 你好
    Bob-->>Alice: 你好
\`\`\`
`;

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

export async function mockInvoke<T>(
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  switch (cmd) {
    case "select_directory": {
      const input = window.prompt(
        "输入文件夹路径",
        "/Users/steve/build/oceanbase",
      );
      return (input === null ? null : (input as T)) as T;
    }
    case "scan_source_files": {
      const dir = String(args.directory ?? "");
      if (dir.includes("oceanbase")) {
        return OCEANBASE_FILES.map((p) => ({ name: basename(p), path: p })) as T;
      }
      // Generic fallback: an in-memory demo markdown
      return [{ name: "demo.md", path: "demo://demo.md" }] as T;
    }
    case "read_file": {
      const path = String(args.filePath);
      const overridden = writeOverrides.get(path);
      if (overridden !== undefined) return overridden as T;
      if (path.startsWith("demo://")) return DEMO_MD as T;
      const res = await fetch(`/@fs${path}`);
      if (!res.ok) throw new Error(`read_file ${path}: ${res.status}`);
      return (await res.text()) as T;
    }
    case "write_file": {
      writeOverrides.set(String(args.filePath), String(args.content));
      console.info("[mock] write_file", args.filePath);
      return undefined as T;
    }
    case "watch_directory":
      return undefined as T;
    default:
      throw new Error(`mock backend: unknown command "${cmd}"`);
  }
}
