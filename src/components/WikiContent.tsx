import React, { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugify } from "../utils/wikilink";
import { AssetView } from "./AssetView";
import { NoteItem } from "../utils/exportUtils";

interface WikiContentProps {
  content: string;
  onNavigate: (slug: string) => void;
  notes: Map<string, NoteItem>;
}

export const WikiContent: React.FC<WikiContentProps> = ({ content, onNavigate, notes }) => {
  const highlightCode = (code: string, _language?: string) => {
    return {
      __html: code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;"),
    };
  };

  const preprocessWikilinks = (text: string): string => {
    return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
      const rawTarget = target.trim();
      const displayLabel = label ? label.trim() : rawTarget;
      const targetSlug = slugify(rawTarget);
      return `[${displayLabel}](wikilink:${targetSlug})`;
    });
  };

  const formattedContent = preprocessWikilinks(content);

  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWikilinkHover = (slug: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setHoveredSlug(slug), 200);
  };

  const handleWikilinkLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredSlug(null);
  };

  const getNotePreview = (slug: string): string | null => {
    const note = notes.get(slug);
    if (!note) return null;
    return note.content.slice(0, 150).replace(/\n/g, " ");
  };

  return (
    <div className="markdown-body" style={{ lineHeight: 1.6, position: "relative" }}>
      {hoveredSlug && (
        <div
          className="wikilink-hover-preview"
          style={{
            position: "absolute",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--input-border)",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "13px",
            maxWidth: "300px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "4px", color: "var(--accent-blue)" }}>
            {hoveredSlug}
          </div>
          <div style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
            {getNotePreview(hoveredSlug) || "Bu not henüz oluşturulmamış."}
          </div>
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...props }) {
            if (href && href.startsWith("wikilink:")) {
              const targetSlug = href.replace("wikilink:", "");
              return (
                <button
                  type="button"
                  onMouseEnter={() => handleWikilinkHover(targetSlug)}
                  onMouseLeave={handleWikilinkLeave}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(targetSlug);
                  }}
                  className="wikilink-btn"
                  style={{
                    background: "#e8f0fe",
                    color: "#1a73e8",
                    border: "none",
                    borderRadius: 4,
                    padding: "2px 6px",
                    margin: "0 2px",
                    cursor: "pointer",
                    fontWeight: 600,
                    textDecoration: "underline",
                    fontSize: "inherit",
                  }}
                >
                  {children}
                </button>
              );
            }
            if (href && href.startsWith("asset:")) {
              const assetId = href.replace("asset:", "");
              return <AssetView assetId={assetId} alt={typeof children === "string" ? children : ""} kind="file" />;
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
          img({ src, alt }) {
            if (src && src.startsWith("asset:")) {
              const assetId = src.replace("asset:", "");
              return <AssetView assetId={assetId} alt={alt || ""} kind="image" />;
            }
            return <img src={src} alt={alt} style={{ maxWidth: "100%" }} />;
          },
          code({ className, children, ...props }) {
            const language = className?.replace("language-", "") || "plaintext";
            const codeString = String(children).replace(/\n$/, "");
            const highlighted = highlightCode(codeString, language);
            return (
              <pre
                className={className}
                style={{
                  background: "var(--bg-secondary)",
                  padding: "12px",
                  borderRadius: "6px",
                  overflow: "auto",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                <code className={className} dangerouslySetInnerHTML={highlighted} {...props} />
              </pre>
            );
          },
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
};
