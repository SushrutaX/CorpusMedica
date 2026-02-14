import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Link, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DOCS_CONTENT,
  DOCS_NAV,
  DOCS_ROOT_KEY,
  extractHeadingText,
  slugifyHeading,
  type DocsNavItem,
} from "../docs/docsContent";

const MIN_DOCS_CENTER_WIDTH = 720;
const MAX_DOCS_CENTER_WIDTH = 1100;

const DocsPage = () => {
  const location = useLocation();
  const docsPath = useMemo(() => {
    const raw = location.pathname.replace(/^\/docs\/?/, "").replace(/\/$/, "");
    return raw || "";
  }, [location.pathname]);
  const docsKey = docsPath || DOCS_ROOT_KEY;
  const docsContent =
    DOCS_CONTENT[docsKey] || DOCS_CONTENT[DOCS_ROOT_KEY] || "# Documentation";

  const docsPageRef = useRef<HTMLDivElement>(null);
  const docsResizeRef = useRef<{
    startX: number;
    startWidth: number;
    edge: "right";
    pointerId: number;
  } | null>(null);
  const [docsCenterWidth, setDocsCenterWidth] = useState(860);

  const clampDocsCenterWidth = useCallback((width: number) => {
    const containerWidth = docsPageRef.current?.clientWidth ?? 0;
    const maxByLayout =
      containerWidth > 0
        ? containerWidth - 200 - 160
        : MAX_DOCS_CENTER_WIDTH;
    const maxWidth = Math.max(
      MIN_DOCS_CENTER_WIDTH,
      Math.min(MAX_DOCS_CENTER_WIDTH, maxByLayout)
    );
    return Math.min(maxWidth, Math.max(MIN_DOCS_CENTER_WIDTH, width));
  }, []);

  const beginDocsResize = useCallback(
    (edge: "right") => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      docsResizeRef.current = {
        startX: event.clientX,
        startWidth: docsCenterWidth,
        edge,
        pointerId: event.pointerId,
      };
    },
    [docsCenterWidth]
  );

  const handleDocsResizeMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = docsResizeRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      const delta = event.clientX - state.startX;
      const nextWidth = state.startWidth + delta;
      setDocsCenterWidth(clampDocsCenterWidth(nextWidth));
    },
    [clampDocsCenterWidth]
  );

  const endDocsResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = docsResizeRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      docsResizeRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore release errors
      }
    },
    []
  );

  useEffect(() => {
    const handleResize = () => {
      setDocsCenterWidth((width) => clampDocsCenterWidth(width));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampDocsCenterWidth]);

  const docsHeadings = useMemo(() => {
    const lines = docsContent.split("\n");
    return lines
      .map((line) => {
        const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
        if (!match) return null;
        const level = match[1].length;
        const title = match[2].replace(/\s+#+$/, "").trim();
        return {
          level,
          title,
          id: slugifyHeading(title),
        };
      })
      .filter(Boolean) as Array<{ level: number; title: string; id: string }>;
  }, [docsContent]);

  const renderDocsNav = (items: DocsNavItem[]) => (
    <ul className="docs-nav-list">
      {items.map((item) => {
        const linkPath = item.path ?? "";
        const href = `/docs/${linkPath}`.replace(/\/$/, "");
        const isActive =
          (!docsPath && linkPath === "") || docsPath === linkPath;
        return (
          <li key={`${item.label}-${linkPath}`}>
            {item.path !== undefined ? (
              <Link
                className={`docs-nav-link ${isActive ? "active" : ""}`}
                to={href || "/docs"}
              >
                {item.label}
              </Link>
            ) : (
              <span className="docs-nav-heading">{item.label}</span>
            )}
            {item.children && renderDocsNav(item.children)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      className="docs-page docs-theme"
      ref={docsPageRef}
      style={
        {
          "--docs-center-width": `${docsCenterWidth}px`,
        } as CSSProperties
      }
    >
      <aside className="docs-nav">
        <div className="docs-nav-title">Documentation</div>
        {renderDocsNav(DOCS_NAV)}
      </aside>
      <main className="docs-main">
        <div
          className="docs-resize-handle docs-resize-handle-right"
          onPointerDown={beginDocsResize("right")}
          onPointerMove={handleDocsResizeMove}
          onPointerUp={endDocsResize}
          onPointerCancel={endDocsResize}
          aria-label="Resize docs panel"
          role="separator"
        />
        <div className="docs-breadcrumbs">
          <span>Learn Corpus Medica</span>
          <span className="docs-breadcrumb-sep">â€º</span>
          <strong>
            {docsKey.replace(/(^|\/)(\w)/g, (_m, sep, c) => `${sep}${c.toUpperCase()}`)}
          </strong>
        </div>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => {
              const text = extractHeadingText(children);
              const id = slugifyHeading(text);
              return <h2 id={id}>{children}</h2>;
            },
            h3: ({ children }) => {
              const text = extractHeadingText(children);
              const id = slugifyHeading(text);
              return <h3 id={id}>{children}</h3>;
            },
            h4: ({ children }) => {
              const text = extractHeadingText(children);
              const id = slugifyHeading(text);
              return <h4 id={id}>{children}</h4>;
            },
          }}
        >
          {docsContent}
        </ReactMarkdown>
      </main>
      <aside className="docs-toc">
        <div className="docs-toc-title">On this page</div>
        {docsHeadings.length > 0 ? (
          <ul className="docs-toc-list">
            {docsHeadings.map((heading) => (
              <li key={heading.id} className={`level-${heading.level}`}>
                <a href={`#${heading.id}`}>{heading.title}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="docs-toc-empty">No sections detected.</p>
        )}
      </aside>
    </div>
  );
};

export default DocsPage;
