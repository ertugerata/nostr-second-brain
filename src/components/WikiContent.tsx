import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugify } from "../utils/wikilink";

interface WikiContentProps {
  content: string;
  onNavigate: (slug: string) => void;
}

export const WikiContent: React.FC<WikiContentProps> = ({ content, onNavigate }) => {
  // Replace [[target|label]] or [[target]] with [label](wikilink:slug)
  const preprocessWikilinks = (text: string): string => {
    return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
      const rawTarget = target.trim();
      const displayLabel = label ? label.trim() : rawTarget;
      const targetSlug = slugify(rawTarget);
      return `[${displayLabel}](wikilink:${targetSlug})`;
    });
  };

  const formattedContent = preprocessWikilinks(content);

  return (
    <div className="markdown-body" style={{ lineHeight: 1.6 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ...props }) {
            if (href && href.startsWith("wikilink:")) {
              const targetSlug = href.replace("wikilink:", "");
              return (
                <button
                  type="button"
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
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
};
