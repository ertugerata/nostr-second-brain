import React, { useRef, useState } from "react";
import { uploadAsset, ALLOWED_ASSET_MIME_TYPES } from "../utils/assets";

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  // YENİ: asset yükleme için gerekli bağlam
  isPrivate: boolean;
  userSecretKey: Uint8Array | null;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ textareaRef, setContent, isPrivate, userSecretKey }) => {
  const assetInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const insertFormatting = (prefix: string, suffix: string = "", placeholder: string = "metin") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const originalText = textarea.value;
    const selectedText = originalText.substring(start, end);

    const textToInsert = selectedText || placeholder;
    const replacement = `${prefix}${textToInsert}${suffix}`;

    const newText = originalText.substring(0, start) + replacement + originalText.substring(end);
    setContent(newText);

    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
      } else {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length + placeholder.length);
      }
    }, 0);
  };

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const originalText = textarea.value;
    const newText = originalText.substring(0, start) + text + originalText.substring(end);
    setContent(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const originalText = textarea.value;

    const lineStart = originalText.lastIndexOf("\n", start - 1) + 1;
    const newText = originalText.substring(0, lineStart) + prefix + originalText.substring(lineStart);

    setContent(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 0);
  };

  const insertTable = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const tableTemplate = `\n| Başlık 1 | Başlık 2 |\n| --- | --- |\n| Hücre 1 | Hücre 2 |\n`;
    insertFormatting("", tableTemplate, "");
  };

  const handleAssetButtonClick = () => {
    if (isPrivate && !userSecretKey) {
      setUploadError("Gizli notlara asset eklemek için Secret Key gereklidir.");
      return;
    }
    setUploadError(null);
    assetInputRef.current?.click();
  };

  const handleAssetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // aynı dosyayı tekrar seçebilmek için input'u sıfırla
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      // isPrivate=true iken userSecretKey null olamaz (buton zaten yukarıda engelliyor),
      // ama TypeScript için yine de kontrol edilir.
      if (isPrivate && !userSecretKey) {
        throw new Error("Secret Key bulunamadı.");
      }
      const result = await uploadAsset({
        file,
        userSecretKey: userSecretKey as Uint8Array,
        isPrivate,
      });
      insertAtCursor(`\n${result.markdownRef}\n`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Asset yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="md-toolbar" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <div className="md-toolbar-group">
          <button
            type="button"
            onClick={() => insertFormatting("**", "**", "kalın metin")}
            className="md-toolbar-btn"
            title="Kalın (Bold) - **metin**"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("*", "*", "eğik metin")}
            className="md-toolbar-btn"
            title="Eğik (Italic) - *metin*"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("~~", "~~", "üstü çizili")}
            className="md-toolbar-btn"
            title="Üstü Çizili (Strikethrough) - ~~metin~~"
          >
            <span style={{ textDecoration: "line-through" }}>S</span>
          </button>
        </div>

        <div className="md-toolbar-divider" />

        <div className="md-toolbar-group">
          <button
            type="button"
            onClick={() => insertLinePrefix("### ")}
            className="md-toolbar-btn"
            title="Başlık (Heading 3) - ### Başlık"
          >
            H
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("`", "`", "kod")}
            className="md-toolbar-btn"
            title="Kod (Inline Code) - `kod`"
          >
            {"</>"}
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix("> ")}
            className="md-toolbar-btn"
            title="Alıntı (Quote) - > "
          >
            ”
          </button>
        </div>

        <div className="md-toolbar-divider" />

        <div className="md-toolbar-group">
          <button
            type="button"
            onClick={() => insertFormatting("[", "](https://)", "bağlantı metni")}
            className="md-toolbar-btn"
            title="Bağlantı (Link) - [metin](url)"
          >
            🔗
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("[[", "]]", "Not Başlığı")}
            className="md-toolbar-btn md-toolbar-wikilink-btn"
            title="Wikilink - [[Not Başlığı]]"
          >
            🧠 [[ Wiki ]]
          </button>
        </div>

        <div className="md-toolbar-divider" />

        <div className="md-toolbar-group">
          <button
            type="button"
            onClick={() => insertLinePrefix("- ")}
            className="md-toolbar-btn"
            title="Madde İşaretli Liste - - "
          >
            •
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix("1. ")}
            className="md-toolbar-btn"
            title="Numaralı Liste - 1. "
          >
            1.
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix("- [ ] ")}
            className="md-toolbar-btn"
            title="Görev Listesi - - [ ] "
          >
            ☑
          </button>
          <button type="button" onClick={insertTable} className="md-toolbar-btn" title="Tablo Ekle">
            📊
          </button>
        </div>

        <div className="md-toolbar-divider" />

        <div className="md-toolbar-group">
          <input
            ref={assetInputRef}
            type="file"
            accept={ALLOWED_ASSET_MIME_TYPES.join(",")}
            style={{ display: "none" }}
            onChange={handleAssetFileChange}
          />
          <button
            type="button"
            onClick={handleAssetButtonClick}
            className="md-toolbar-btn"
            title={`Asset Ekle (${ALLOWED_ASSET_MIME_TYPES.join(", ")})${isPrivate ? " — Gizli not: asset de şifrelenecek" : ""}`}
            disabled={uploading}
          >
            {uploading ? "⏳" : isPrivate ? "📎🔒" : "📎"}
          </button>
        </div>
      </div>

      {uploadError && (
        <span style={{ fontSize: 11, color: "#b91c1c" }}>⚠️ {uploadError}</span>
      )}
    </div>
  );
};
