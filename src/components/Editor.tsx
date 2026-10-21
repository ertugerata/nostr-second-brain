import React, { useRef, useCallback, useState } from "react";
import { WikiContent } from "./WikiContent";
import { MarkdownToolbar } from "./MarkdownToolbar";
import { NoteItem } from "../utils/exportUtils";

interface EditorProps {
  notes: Map<string, NoteItem>;
  currentContent: string;
  currentSlug: string;
  onContentChange: (c: string) => void;
  onSlugChange: (s: string) => void;
  previewMode: "edit" | "preview" | "split";
  isPrivate: boolean;
  onIsPrivateChange: (v: boolean) => void;
  onShowVersionModalChange: (v: boolean) => void;
  currentSlugVersions: NoteItem[];
  userSecretKey: Uint8Array | null;
  onExportNote: () => void;
  onDeleteNote: (slug: string) => void;
  onSave: (e: React.FormEvent) => void;
  onNavigatePreview: (slug: string) => void;
  canDelete: boolean;
}

/**
 * Wikilink入れ札daki `[[slug]]` 삽입 işlemlerini (keyboard Enter/Tab + autocomplete click)
 * tek bir pure helper'a çıkardık. cursor reposition mantığı da burada konsolid.
 */
function applyWikilinkReplacement(
  content: string,
  cursorPos: number,
  selectedSlug: string,
): { newContent: string; insertPos: number } | null {
  const textBeforeCursor = content.slice(0, cursorPos);
  const textAfterCursor = content.slice(cursorPos);
  const lastOpeningBracket = textBeforeCursor.lastIndexOf("[[");
/**
 * Wikilink挿入處理中的 `[[slug]]` 插入邏輯（鍵盤 Enter/Tab + 自動完成點擊）
 * 提取為單一 pure helper。光標重置邏輯也在此統一。
 */
export function applyWikilinkReplacement(

  const replacement = "[[" + selectedSlug + "]]";
  const newContent = textBeforeCursor.slice(0, lastOpeningBracket) + replacement + textAfterCursor;
  return { newContent, insertPos: lastOpeningBracket + replacement.length };
}

export function Editor({
  notes,
  currentContent,
  currentSlug,
  onContentChange,
  onSlugChange,
  previewMode,
  isPrivate,
  onIsPrivateChange,
  onShowVersionModalChange,
  currentSlugVersions,
  userSecretKey,
  onExportNote,
  onDeleteNote,
  onSave,
  onNavigatePreview,
  canDelete,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<{ slug: string; title: string }[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);

  // Synced scroll: textarea → preview (percentage-based, bidirectional)
  const handleTextareaScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview || previewMode !== "split") return;
    const denominator = textarea.scrollHeight - textarea.clientHeight;
    if (denominator <= 0) return;
    const percentage = textarea.scrollTop / denominator;
    preview.scrollTop = preview.scrollHeight * percentage;
  }, [previewMode]);

  const handlePreviewScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview || previewMode !== "split") return;
    const denominator = preview.scrollHeight - preview.clientHeight;
    if (denominator <= 0) return;
    const percentage = preview.scrollTop / denominator;
    textarea.scrollTop = textarea.scrollHeight * percentage;
  }, [previewMode]);

  // Wikilink autocomplete: detect [[  and show matching notes
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    onContentChange(newContent);

    const cursorPos = e.target.selectionStart ?? 0;
    const textBeforeCursor = newContent.slice(0, cursorPos);
    const lastOpeningBracket = textBeforeCursor.lastIndexOf("[");
    const potentialWikilink = textBeforeCursor.slice(lastOpeningBracket);

    if (potentialWikilink.startsWith("[[") && !potentialWikilink.includes("]]")) {
      const query = potentialWikilink.slice(2).toLowerCase();
      const items = Array.from(notes.values())
        .filter((n) => n.slug.toLowerCase().includes(query))
        .slice(0, 10)
        .map((n) => ({ slug: n.slug, title: n.slug }));

      setAutocompleteItems(items);
      setAutocompleteIndex(0);
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showAutocomplete || autocompleteItems.length === 0) {
      if (e.key === "Escape") {
        setShowAutocomplete(false);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAutocompleteIndex((prev) => Math.min(prev + 1, autocompleteItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAutocompleteIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const selected = autocompleteItems[autocompleteIndex];
      const cursorPos = textareaRef.current?.selectionStart ?? 0;
      const result = applyWikilinkReplacement(currentContent, cursorPos, selected.slug);
      if (result) {
        onContentChange(result.newContent);
        setShowAutocomplete(false);
        setTimeout(() => {
          const textarea = textareaRef.current;
          if (textarea) {
            textarea.setSelectionRange(result.insertPos, result.insertPos);
          }
        }, 0);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowAutocomplete(false);
    }
  };

  /**
   * Autocomplete dropdown pozisyonu — hardcoded approxCharWidth/approxLineHeight
   * yerine textarea'dan gerçek yüksekliği, computed font-size'dan karakter genişliğini al.
   */
  const getAutocompletePosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return { top: 0, left: 0 };

    const cursorPos = textarea.selectionStart ?? 0;
    const textBeforeCursor = currentContent.slice(0, cursorPos);
    const lines = textBeforeCursor.split("\n");
    const lineIndex = lines.length - 1;
    const charsInLine = lines[lineIndex].length;

    const linesCount = textarea.value.split("\n").length || 1;
    const lineHeight = textarea.clientHeight / linesCount;

    const style = window.getComputedStyle(textarea);
    const fontSize = parseFloat(style.fontSize) || 16;
    const charWidth = fontSize * 0.6; // yaklaşık karakter genişliği

    return {
      top: (lineIndex + 1) * lineHeight + 4,
      left: Math.min(charsInLine * charWidth, textarea.clientWidth - 220),
    };
  }, [currentContent]);

  const insertSelectedWikilink = (selected: { slug: string }) => {
    const cursorPos = textareaRef.current?.selectionStart ?? 0;
    const result = applyWikilinkReplacement(currentContent, cursorPos, selected.slug);
    if (result) {
      onContentChange(result.newContent);
      setShowAutocomplete(false);
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.setSelectionRange(result.insertPos, result.insertPos);
        }
      }, 0);
    }
  };

  return (
    <form onSubmit={onSave} className="editor-form">
      {/* Slug + Version History */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Not Başlığı (Slug)..."
          value={currentSlug}
          onChange={(e) => onSlugChange(e.target.value)}
          className="title-input"
          style={{ flex: 1 }}
          required
        />
        {currentSlugVersions.length > 0 && (
          <button
            type="button"
            onClick={() => onShowVersionModalChange(true)}
            className="history-btn"
            title="Bu notun versiyon geçmişini gör"
            style={{
              padding: "12px 14px",
              fontSize: "13px",
              fontWeight: 600,
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--input-border)",
              borderRadius: "6px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            📜 Versiyonlar ({currentSlugVersions.length})
          </button>
        )}
      </div>

      {/* Editor body: edit + preview */}
      <div className={`editor-body-area ${previewMode === "split" ? "is-split" : ""}`}>
        {(previewMode === "edit" || previewMode === "split") && (
          <div className="editor-input-wrapper">
            <MarkdownToolbar
              textareaRef={textareaRef}
              setContent={onContentChange}
              isPrivate={isPrivate}
              userSecretKey={userSecretKey}
            />
            <textarea
              ref={textareaRef}
              placeholder="Not içeriğinizi Markdown formatında yazın... [[Diğer Not]] referansı verebilirsiniz."
              value={currentContent}
              onChange={handleTextareaChange}
              onKeyDown={handleTextareaKeyDown}
              onScroll={handleTextareaScroll}
              className="content-input"
              required
            />

            {/* Wikilink autocomplete dropdown */}
            {showAutocomplete && autocompleteItems.length > 0 && (
              <div
                ref={autocompleteRef}
                className="wiki-autocomplete"
                style={{
                  position: "absolute",
                  top: getAutocompletePosition().top,
                  left: getAutocompletePosition().left,
                  zIndex: 1000,
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--input-border)",
                  borderRadius: "6px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {autocompleteItems.map((item, idx) => (
                  <div
                    key={item.slug}
                    className={`wiki-autocomplete-item ${idx === autocompleteIndex ? "selected" : ""}`}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      backgroundColor: idx === autocompleteIndex ? "var(--bg-secondary)" : "transparent",
                    }}
                    onClick={() => insertSelectedWikilink(item)}
                  >
                    <div style={{ fontWeight: 500 }}>{item.slug}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(previewMode === "preview" || previewMode === "split") && (
          <div className="preview-box" ref={previewRef} onScroll={handlePreviewScroll}>
            <div className="preview-title">ÖNİZLEME (Markdown / NIP-54 Rendered)</div>
            {currentContent.trim() ? (
              <WikiContent content={currentContent} onNavigate={onNavigatePreview} notes={notes} />
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "14px", fontStyle: "italic" }}>
                Önizleme için içeriği girin veya bir .md dosyası yükleyin...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Form actions */}
      <div className="form-actions">
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => onIsPrivateChange(e.target.checked)}
            />
            🔒 NIP-44/59 Gizli Not (Gift Wrap)
          </label>
          {isPrivate && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "22px", maxWidth: "450px", lineHeight: "1.3" }}>
              ℹ️ Gizli notlar NIP-59 Gift Wrap (ephemeral key) ile şifrelenir. Ephemeral imzalar nedeniyle relay'lerdeki kopyalar NIP-09 ile silinemez; silme işlemi yalnızca yerel görünümünüzü temizler.
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDeleteNote(currentSlug)}
              className="delete-btn"
              style={{
                backgroundColor: "#dc2626",
                color: "#ffffff",
                border: "none",
                padding: "8px 14px",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🗑️ Notu Sil
            </button>
          )}

          {currentContent.trim().length > 0 && (
            <button
              type="button"
              onClick={onExportNote}
              className="export-btn"
            >
              📥 Dışarı Aktar (.md)
            </button>
          )}

          <button type="submit" className="save-btn">
            Kaydet & İmzala
          </button>
        </div>
      </div>
    </form>
  );
}
