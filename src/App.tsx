import React, { useEffect, useState } from "react";
import { NDKEvent, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk";
import { nostrService } from "./nostr";
import { WikiContent } from "./components/WikiContent";
import { SimpleGraphView } from "./components/SimpleGraphView";
import { KeyLoginForm } from "./components/KeyLoginForm";
import { extractWikilinks, slugify } from "./utils/wikilink";
import { buildNoteGraph, GraphData } from "./utils/graphBuilder";
import { KeyStoreService } from "./utils/keyStore";
import "./App.css"; // CSS Dosyası Entegre Edildi

interface Note {
  id: string;
  slug: string;
  content: string;
  createdAt: number;
  pubkey: string;
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "graph">("editor");

  const [notes, setNotes] = useState<Map<string, Note>>(new Map());
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [statusText, setStatusText] = useState("Sistem hazır.");

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

        setNotes((prevNotes) => {
          const existing = prevNotes.get(noteSlug);
          if (!existing || event.created_at! > existing.createdAt) {
            const updated = new Map(prevNotes);
            updated.set(noteSlug, {
              id: event.id,
              slug: noteSlug,
              content: event.content,
              createdAt: event.created_at!,
              pubkey: event.pubkey,
            });
            return updated;
          }
          return prevNotes;
        });
      });
    }

    if (isAuthenticated) {
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
        await nostrService.ndk.cacheAdapter.saveEvent(event);
      }

      setNotes((prev) => {
        const updated = new Map(prev);
        updated.set(noteSlug, {
          id: event.id,
          slug: noteSlug,
          content: event.content,
          createdAt: event.created_at || Math.floor(Date.now() / 1000),
          pubkey: event.pubkey,
        });
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

  return (
    <div className="app-layout">
      {/* Sol Menü / Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>🧠 Nostr Brain</h2>
          <button onClick={handleNewNote} className="new-btn">+ Yeni Not</button>
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
            🕸️ Graph View
          </button>
        </div>

        <div className="note-list">
          <div className="section-title">NOTLARIM ({notes.size})</div>
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
      </aside>

      {/* Ana Çalışma Alanı */}
      <main className="main-content">
        <header className="top-bar">
          <span className="status-badge">🟢 {statusText}</span>
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
        </header>

        {activeTab === "editor" && (
          <div className="editor-container">
            <form onSubmit={handleSaveNote} className="editor-form">
              <input
                type="text"
                placeholder="Not Başlığı (Slug)..."
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="title-input"
                required
              />

              <textarea
                placeholder="Not içeriğinizi yazın... [[Diğer Not]] referansı verebilirsiniz."
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

                <button type="submit" className="save-btn">
                  Kaydet & Imzala
                </button>
              </div>
            </form>

            {notes.has(slug) && (
              <div className="preview-box">
                <div className="preview-title">ÖNİZLEME (NIP-54 Rendered)</div>
                <WikiContent content={notes.get(slug)!.content} onNavigate={handleSelectNote} />
              </div>
            )}
          </div>
        )}

        {activeTab === "graph" && (
          <div className="graph-container">
            <SimpleGraphView graphData={graphData} onSelectNode={handleSelectNote} />
          </div>
        )}
      </main>
    </div>
  );
}
