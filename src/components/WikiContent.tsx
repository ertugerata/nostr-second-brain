import React from "react";
import { extractWikilinks, slugify } from "../utils/wikilink";

interface WikiContentProps {
  content: string;
  onNavigate: (slug: string) => void;
}

export const WikiContent: React.FC<WikiContentProps> = ({ content, onNavigate }) => {
  const links = extractWikilinks(content);

  if (links.length === 0) {
    return <div style={{ whiteSpace: "pre-wrap" }}>{content}</div>;
  }

  const regex = /\[\[([^\]\|]+)(?:\|([^\]]+))?\]\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const matchIndex = match.index;
    
    if (matchIndex > lastIndex) {
      parts.push(content.substring(lastIndex, matchIndex));
    }

    const rawTarget = match[1].trim();
    const label = match[2] ? match[2].trim() : rawTarget;
    const targetSlug = slugify(rawTarget);

    parts.push(
      <button
        key={`${targetSlug}-${matchIndex}`}
        onClick={() => onNavigate(targetSlug)}
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
        }}
      >
        {label}
      </button>
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{parts}</div>;
};