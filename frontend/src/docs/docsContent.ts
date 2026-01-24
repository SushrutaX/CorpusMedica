type DocsNavItem = {
  label: string;
  path?: string;
  children?: DocsNavItem[];
};

const DOCS_SOURCES = import.meta.glob("../../../docs/**/*.md", {
  as: "raw",
  eager: true,
}) as Record<string, string>;

const DOCS_NAV: DocsNavItem[] = [
  { label: "Home", path: "" },
  { label: "Getting Started", path: "getting-started" },
  { label: "Architecture", path: "architecture" },
  {
    label: "Backend",
    children: [
      { label: "API", path: "backend/api" },
      { label: "Segmentation", path: "backend/segmentation" },
      { label: "Volume IO", path: "backend/volume-io" },
      { label: "Report Analysis", path: "backend/report-analysis" },
      { label: "Chatbot", path: "backend/chatbot" },
    ],
  },
  {
    label: "Frontend",
    children: [
      { label: "Overview", path: "frontend/overview" },
      { label: "Viewers", path: "frontend/viewers" },
      { label: "Workspace", path: "frontend/workspace" },
    ],
  },
  { label: "Auth", path: "auth" },
  { label: "Deployment", path: "deployment" },
  { label: "Glossary", path: "glossary" },
];

const normalizeDocKey = (sourcePath: string): string => {
  const normalized = sourcePath.replace(/\\/g, "/");
  const marker = normalized.lastIndexOf("/docs/");
  const relative = marker >= 0 ? normalized.slice(marker + 6) : normalized;
  return relative.replace(/\.md$/i, "");
};

const DOCS_CONTENT = Object.entries(DOCS_SOURCES).reduce<Record<string, string>>(
  (acc, [path, content]) => {
    acc[normalizeDocKey(path)] = content;
    return acc;
  },
  {}
);

const DOCS_ROOT_KEY = DOCS_CONTENT.README
  ? "README"
  : DOCS_CONTENT.index
    ? "index"
    : Object.keys(DOCS_CONTENT)[0];

const slugifyHeading = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const extractHeadingText = (node: unknown): string => {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractHeadingText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    if (props?.children) return extractHeadingText(props.children);
  }
  return "";
};

export {
  DOCS_CONTENT,
  DOCS_NAV,
  DOCS_ROOT_KEY,
  extractHeadingText,
  slugifyHeading,
};
export type { DocsNavItem };
