# Diagrammy

本项目主要解决的问题是，在vs code 预览mardkown文档图表时，尺寸受限不方便放大来看。而excaliapp 是创作工具，在不需要修改时，缺一个浏览本地文件夹文档的工具。

本地优先（local-first）的桌面图表浏览器：打开一个文件夹，自动扫描 Markdown / Mermaid 源文件中的图表，左侧缩略图库（PPT 式浏览），右侧大图预览（缩放 / 拖拽 / Fit），双击进入编辑并回写源文件。

架构与技术栈参考 [excaliapp](https://github.com/tyrchen/excaliapp)：**Tauri 2 + React 19 + TypeScript + Tailwind 4 + Zustand**，Rust 后端负责文件扫描 / 读写 / `notify` 监听，渲染完全本地（mermaid.js 打包进应用），无任何云端依赖。

## 运行

```bash
npm install
npm run tauri dev    # 桌面应用（开发模式）
npm run dev          # 纯浏览器模式（mock 后端，可通过 /@fs/ 读取真实 md 文件）
npm run tauri build  # 打包
```

## 功能（Phase 1 + 2）

- 打开文件夹，递归扫描 `.md` / `.mmd` / `.puml`（跳过 `node_modules` / `target` / `.git` / 隐藏目录）
- remark 解析 Markdown，提取所有 ` ```mermaid ` / ` ```plantuml ` 代码块，记录字节偏移量（用于回写）
- 标题取代码块上方最近的 heading，兜底 `文件名 #序号`
- 左侧按文件分组的缩略图列表，`IntersectionObserver` 懒渲染 + 内容哈希（FNV-1a）内存缓存
- 右侧预览：滚轮缩放（以光标为中心）、拖拽平移、Fit / 1:1 / ± 按钮
- 编辑模式：分栏源码编辑，实时渲染；语法错误保留上次成功结果，不打断编辑
- 保存回写：按偏移量对源文件做字符串级替换，写回后整文件重新解析（offset 失效问题见设计文档 5.2）
- `notify` 监听文件夹（300ms debounce）；外部修改正在编辑的文件时给出冲突提示而不是覆盖

## 目录结构

```
src/
  modules/       # markdown-parser / render-engine / cache
  components/    # Sidebar / PreviewViewer / SourceEditor
  store/         # zustand
  lib/           # Tauri API 封装 + 浏览器 mock 后端
  hooks/         # 懒渲染 / SVG 渲染 hook
src-tauri/
  src/lib.rs     # scan_source_files / read_file / write_file / watch_directory / select_directory
```

## 后续（设计文档 Phase 3+）

- PlantUML：本地 picoweb sidecar（便携 JRE + plantuml.jar）
- SVG / PNG 导出（resvg）、主题切换、批量导出
- CodeMirror 6 编辑器替换 textarea、react-window 虚拟滚动
