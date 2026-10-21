import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React, { useState, useRef } from "react";
import { MarkdownToolbar } from "./MarkdownToolbar";

/**
 * Test harness: MarkdownToolbar + state-controlled textarea.
 * setContent callback'ı tool'dan gelen her insertion'da state'i günceller,
 * bu da <pre data-testid="content-display">'da yansır.
 */
function TestHarness({
  initialContent = "",
  isPrivate = false,
  userSecretKey = null as Uint8Array | null,
}: {
  initialContent?: string;
  isPrivate?: boolean;
  userSecretKey?: Uint8Array | null;
}) {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <MarkdownToolbar
        textareaRef={textareaRef}
        setContent={setContent}
        isPrivate={isPrivate}
        userSecretKey={userSecretKey}
      />
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        data-testid="test-textarea"
        style={{ display: "block", width: 300, height: 100 }}
      />
      <pre data-testid="content-display">{content}</pre>
    </div>
  );
}

describe("MarkdownToolbar", () => {
  it("renders all toolbar groups and buttons with correct accessible titles", () => {
    render(<TestHarness />);

    // Text formatting
    expect(screen.getByTitle(/Kalın \(Bold\) - \*\*metin\*\*/)).toBeInTheDocument();
    expect(screen.getByTitle(/Eğik \(Italic\) - \*metin\*/)).toBeInTheDocument();
    expect(screen.getByTitle(/Üstü Çizili \(Strikethrough\) - ~~metin~~/)).toBeInTheDocument();

    // Block / inline structure
    expect(screen.getByTitle(/Başlık \(Heading 3\) - ### Başlık/)).toBeInTheDocument();
    expect(screen.getByTitle(/Kod \(Inline Code\) - `kod`/)).toBeInTheDocument();
    expect(screen.getByTitle(/Alıntı \(Quote\) - > /)).toBeInTheDocument();

    // Links and wikilinks
    expect(screen.getByTitle(/Bağlantı \(Link\) - \[metin\]/)).toBeInTheDocument();
    expect(screen.getByTitle(/Wikilink - \[\[Not Başlığı\]\]/)).toBeInTheDocument();

    // Lists
    expect(screen.getByTitle(/Madde İşaretli Liste - - /)).toBeInTheDocument();
    expect(screen.getByTitle(/Numaralı Liste - 1\. /)).toBeInTheDocument();
    expect(screen.getByTitle(/Görev Listesi - - \[ \] /)).toBeInTheDocument();
    expect(screen.getByTitle(/Tablo Ekle/)).toBeInTheDocument();
  });

  it("wraps selected text in bold markers on button click", async () => {
    render(<TestHarness initialContent="seçili metin" />);
    const textarea = screen.getByTestId("test-textarea") as HTMLTextAreaElement;

    // Focus textarea and select first 7 characters ("seçili ")
    textarea.focus();
    textarea.setSelectionRange(0, 7);

    fireEvent.click(screen.getByTitle(/Kalın \(Bold\) - \*\*metin\*\*/));

    await waitFor(() => {
      const display = screen.getByTestId("content-display");
      expect(display.textContent).toBe("**seçili **metin");
    });
  });

  it("inserts wikilink placeholder at cursor when no selection", async () => {
    render(<TestHarness initialContent="başlangıç" />);
    const textarea = screen.getByTestId("test-textarea") as HTMLTextAreaElement;

    textarea.focus();
    textarea.setSelectionRange(0, 0); // cursor at start, no selection

    fireEvent.click(screen.getByTitle(/Wikilink - \[\[Not Başlığı\]\]/));

    await waitFor(() => {
      const display = screen.getByTestId("content-display");
      expect(display.textContent).toBe("[[Not Başlığı]]başlangıç");
    });
  });

  it("inserts wikilink placeholder after selected text when selection exists", async () => {
    render(<TestHarness initialContent="metin" />);
    const textarea = screen.getByTestId("test-textarea") as HTMLTextAreaElement;

    textarea.focus();
    textarea.setSelectionRange(0, 5); // select entire "metin"

    fireEvent.click(screen.getByTitle(/Wikilink - \[\[Not Başlığı\]\]/));

    await waitFor(() => {
      const display = screen.getByTestId("content-display");
      expect(display.textContent).toBe("[[Not Başlığı]]");
    });
  });

  it("shows upload error toast when asset button clicked for private note without secret key", () => {
    render(<TestHarness isPrivate={true} userSecretKey={null} />);

    fireEvent.click(screen.getByTitle(/Asset Ekle.*Gizli not.*asset de şifrelenecek/));

    const errorEl = screen.getByText(/Gizli notlara asset eklemek için Secret Key gereklidir/);
    expect(errorEl).toBeInTheDocument();
  });
});
