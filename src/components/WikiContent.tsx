import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugify } from "../utils/wikilink";
import { AssetView } from "./AssetView";

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
            // [📄 dosya.pdf](asset:<id>) gibi dosya referansları — yeni sekmede aç
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
            // ![resim.jpg](asset:<id>) — görsel asset referansı
            if (src && src.startsWith("asset:")) {
              const assetId = src.replace("asset:", "");
              return <AssetView assetId={assetId} alt={alt || ""} kind="image" />;
            }
            return <img src={src} alt={alt} style={{ maxWidth: "100%" }} />;
          },
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
};
