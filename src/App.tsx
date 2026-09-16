import React, { useEffect, useState, useRef } from "react";
import { NDKEvent, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk";
import { nostrService } from "./nostr";
import { WikiContent } from "./components/WikiContent";
import { SimpleGraphView } from "./components/SimpleGraphView";
import { KeyLoginForm } from "./components/KeyLoginForm";
import { SettingsView } from "./components/SettingsView";
import { VersionHistoryModal } from "./components/VersionHistoryModal";
import { RelayStatusIndicator } from "./components/RelayStatusIndicator";
import { extractWikilinks, slugify } from "./utils/wikilink";
import { buildNoteGraph, GraphData } from "./utils/graphBuilder";
import { KeyStoreService } from "./utils/keyStore";
import { exportNoteAsMarkdown, exportAllNotesAsJson, NoteItem } from "./utils/exportUtils";
import { getDefaultSampleNote } from "./utils/sampleNote";
import "./App.css";

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "graph" | "settings">("editor");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("theme") as "light" | "dark") || "light";
  });

  // Main active notes map (slug -> latest NoteItem)
  const [notes, setNotes] = useState<Map<string, NoteItem>>(() => {
    const sample = getDefaultSampleNote();
    const map = new Map<string, NoteItem>();
    map.set(sample.slug, sample);
    return map;
  });

  // History map storing all versions for each slug (slug -> NoteItem[])
  const [noteHistory, setNoteHistory] = useState<Map<string, NoteItem[]>>(() => {
    const sample = getDefaultSampleNote();
    const map = new Map<string, NoteItem[]>();
    map.set(sample.slug, [sample]);
    return map;
  });

  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [statusText, setStatusText] = useState("Sistem hazır.");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sample note into editor on first mount
  useEffect(() => {
    const sample = getDefaultSampleNote();
    setSlug(sample.slug);
    setContent(sample.content);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    async function init() {
      await nostrService.connect();
      setReady(true);

      const sub = nostrService.ndk.subscribe(
        { kinds: [30818 as number], limit: 100 },
        { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST, closeOnEose: false }
      );

      sub.on("event", (event: NDKEvent) => {
        const noteSlug = event.tagValue("d") || "untitled";
        const newNoteItem: NoteItem = {
          id: event.id,
          slug: noteSlug,
          content: event.content,
          createdAt: event.created_at!,
          pubkey: event.pubkey,
        };

        // Update Note History map
        setNoteHistory((prevHistory) => {
          const updated = new Map(prevHistory);
          const existingList = updated.get(noteSlug) || [];
          if (!existingList.some((item) => item.id === newNoteItem.id)) {
            updated.set(noteSlug, [...existingList, newNoteItem]);
          }
          return updated;
        });

        // Update Latest Notes map
        setNotes((prevNotes) => {
          const existing = prevNotes.get(noteSlug);
          if (!existing || event.created_at! > existing.createdAt) {
            const updated = new Map(prevNotes);
            updated.set(noteSlug, newNoteItem);
            return updated;
          }
          return prevNotes;
        });
      });
    }

    if (isAuthenticated || !KeyStoreService.hasStoredKey()) {
      init();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setGraphData(buildNoteGraph(notes));
  }, [notes]);

  if (!isAuthenticated && KeyStoreService.hasStoredKey()) {
    return (
      <div className="login-container">
        <KeyLoginForm onSuccess={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !slug.trim()) return;

    setStatusText("Not imzalanıyor ve kaydediliyor...");
    const noteSlug = slugify(slug);

    try {
      const event = new NDKEvent(nostrService.ndk);
      event.kind = 30818;
      event.content = content;

      const links = extractWikilinks(content);
      const userPubkey = nostrService.ndk.signer ? (await nostrService.ndk.signer.user()).pubkey : "";

      const tags: string[][] = [
        ["d", noteSlug],
        ["title", slug],
      ];

      if (isPrivate) {
        tags.push(["private", "true"]);
      }

      links.forEach((link) => {
        tags.push(["a", `30818:${userPubkey}:${link.target}`, "", "mention"]);
      });

      event.tags = tags;
      await event.sign();

      if (nostrService.ndk.cacheAdapter) {
        await nostrService.ndk.cacheAdapter.setEvent(event, []);
      }

      const savedItem: NoteItem = {
        id: event.id,
        slug: noteSlug,
        content: event.content,
        createdAt: event.created_at || Math.floor(Date.now() / 1000),
        pubkey: event.pubkey,
      };

      setNotes((prev) => {
        const updated = new Map(prev);
        updated.set(noteSlug, savedItem);
        return updated;
      });

      setNoteHistory((prevHistory) => {
        const updated = new Map(prevHistory);
        const existingList = updated.get(noteSlug) || [];
        updated.set(noteSlug, [...existingList, savedItem]);
        return updated;
      });

      event.publish().catch((err) => console.warn("Relay yayın hatası:", err));
      setStatusText("Not başarıyla kaydedildi!");
    } catch (error) {
      console.error("Kaydetme hatası:", error);
      setStatusText("Hata oluştu!");
    }
  };

  const handleSelectNote = (selectedSlug: string) => {
    const note = notes.get(selectedSlug);
    setSlug(selectedSlug);
    setContent(note ? note.content : "");
    setActiveTab("editor");
  };

  const handleNewNote = () => {
    setSlug("yeni-not");
    setContent("");
    setActiveTab("editor");
  };

  const handleExportCurrentNote = () => {
    if (!content.trim()) return;
    exportNoteAsMarkdown({
      id: notes.get(slug)?.id || "",
      slug: slugify(slug),
      content,
      createdAt: notes.get(slug)?.createdAt || Math.floor(Date.now() / 1000),
      pubkey: notes.get(slug)?.pubkey || "",
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text !== undefined) {
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setSlug(fileNameWithoutExt);
        setContent(text);
        setActiveTab("editor");
        setStatusText(`"${file.name}" dosyası aktarıldı. Düzenleyip yayınlayabilirsiniz.`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const currentSlugVersions = noteHistory.get(slugify(slug)) || (notes.get(slugify(slug)) ? [notes.get(slugify(slug))!] : []);

  return (
    <div className={`app-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* Sol Menü / Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <h2>🧠 Nostr Brain</h2>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              type="file"
              accept=".md,.markdown,.txt"
              ref={fileInputRef}
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="import-btn"
              title="Bilgisayardan .md dosyası seç"
            >
              📂 MD Yükle
            </button>
            <button onClick={handleNewNote} className="new-btn">+ Yeni Not</button>
          </div>
        </div>

        <div className="nav-tabs">
          <button
            className={`tab-btn ${activeTab === "editor" ? "active" : ""}`}
            onClick={() => setActiveTab("editor")}
          >
            📝 Editör
          </button>
          <button
            className={`tab-btn ${activeTab === "graph" ? "active" : ""}`}
            onClick={() => setActiveTab("graph")}
          >
            🕸️ Graph
          </button>
        </div>

        <div className="note-list">
          <div className="section-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: "8px" }}>
            <span className="section-title">NOTLARIM ({notes.size})</span>
            {notes.size > 0 && (
              <button
                onClick={() => exportAllNotesAsJson(notes)}
                title="Tüm notları dışarı aktar (JSON)"
                className="export-all-btn"
              >
                📥 Tümünü Aktar
              </button>
            )}
          </div>
          {Array.from(notes.values()).map((note) => (
            <div
              key={note.id}
              onClick={() => handleSelectNote(note.slug)}
              className={`note-item ${slug === note.slug ? "active" : ""}`}
            >
              <div className="note-title">{note.slug}</div>
              <div className="note-snippet">{note.content.slice(0, 45)}...</div>
            </div>
          ))}
        </div>

        {/* Sidebar Alt Bölüm / Settings Button */}
        <div className="sidebar-footer">
          <button
            className={`sidebar-settings-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            ⚙️ Ayarlar
          </button>
        </div>
      </aside>

      {/* Ana Çalışma Alanı */}
      <main className="main-content">
        <header className="top-bar">
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="sidebar-toggle-btn"
              title={sidebarCollapsed ? "Menüyü Göster" : "Menüyü Gizle"}
            >
              {sidebarCollapsed ? "▶ Sidebar" : "◀ Sidebar"}
            </button>
            <RelayStatusIndicator ready={ready} />
            <span className="status-badge">{statusText}</span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={toggleTheme}
              className="theme-toggle-btn"
              title="Koyu / Açık Tema Değiştir"
            >
              {theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
            {KeyStoreService.hasStoredKey() && (
              <button
                onClick={() => {
                  KeyStoreService.clearStoredKey();
                  setIsAuthenticated(false);
                }}
                className="logout-btn"
              >
                🔒 Kasayı Kilitle
              </button>
            )}
          </div>
        </header>

        {activeTab === "editor" && (
          <div className="editor-container">
            <form onSubmit={handleSaveNote} className="editor-form">
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Not Başlığı (Slug)..."
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="title-input"
                  style={{ flex: 1 }}
                  required
                />
                {currentSlugVersions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowVersionModal(true)}
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

              <textarea
                placeholder="Not içeriğinizi Markdown formatında yazın... [[Diğer Not]] referansı verebilirsiniz."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="content-input"
                required
              />

              <div className="form-actions">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                  🔒 NIP-44/59 Gizli Not (Gift Wrap)
                </label>

                <div style={{ display: "flex", gap: "8px" }}>
                  {content.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportCurrentNote}
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

            <div className="preview-box">
              <div className="preview-title">ÖNİZLEME (Markdown / NIP-54 Rendered)</div>
              {content.trim() ? (
                <WikiContent content={content} onNavigate={handleSelectNote} />
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: "14px", fontStyle: "italic" }}>
                  Önizleme için içeriği girin veya bir .md dosyası yükleyin...
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "graph" && (
          <div className="graph-container">
            <SimpleGraphView graphData={graphData} onSelectNode={handleSelectNote} />
          </div>
        )}

        {activeTab === "settings" && (
          <SettingsView
            onKeyUpdated={() => {
              setIsAuthenticated(true);
            }}
          />
        )}
      </main>

      {/* Version History Modal */}
      {showVersionModal && (
        <VersionHistoryModal
          slug={slug}
          versions={currentSlugVersions}
          onSelectVersion={(selectedVersion) => {
            setContent(selectedVersion.content);
            setShowVersionModal(false);
            setStatusText(`Versiyon ${new Date(selectedVersion.createdAt * 1000).toLocaleTimeString("tr-TR")} editöre yüklendi.`);
          }}
          onClose={() => setShowVersionModal(false)}
        />
      )}
    </div>
  );
}
