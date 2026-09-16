import React, { useEffect, useState } from "react";
import { NDKEvent, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk";
import { nostrService } from "./nostr";
import { WikiContent } from "./components/WikiContent";
import { SimpleGraphView } from "./components/SimpleGraphView";
import { extractWikilinks, slugify } from "./utils/wikilink";
import { buildNoteGraph, GraphData } from "./utils/graphBuilder";
import { createGiftWrap } from "./utils/crypto";
import { unwrapGift } from "./utils/unwrap";

interface Note {
  id: string;
  slug: string;
  content: string;
  createdAt: number;
  pubkey: string;
}

export function App() {
  const [ready, setReady] = useState(false);
  const [slug, setSlug] = useState("ikinci-beyin-notu");
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [notes, setNotes] = useState<Map<string, Note>>(new Map());
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [statusText, setStatusText] = useState("Başlatılıyor...");

  useEffect(() => {
    async function init() {
      await nostrService.connect();
      setReady(true);
      setStatusText("Önbellek ve Relay bağlantısı aktif.");

      const sub = nostrService.ndk.subscribe(
        { kinds: [30818 as number, 1059 as number], limit: 50 },
        { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST, closeOnEose: false }
      );

      sub.on("event", (event: NDKEvent) => {
        if (event.kind === 1059) {
          try {
            const userSecretKey = nostrService.getSecretKey();
            const rumor = unwrapGift(event, userSecretKey);
            if (rumor) {
              const noteSlug = rumor.tags?.find((t: string[]) => t[0] === "d")?.[1] || "gizli-not";
              setNotes((prevNotes) => {
                const updated = new Map(prevNotes);
                updated.set(noteSlug, {
                  id: event.id,
                  slug: noteSlug,
                  content: rumor.content,
                  createdAt: rumor.created_at || event.created_at!,
                  pubkey: rumor.pubkey || event.pubkey,
                });
                return updated;
              });
            }
          } catch (e) {
            console.warn("Zarf açılamadı:", e);
          }
          return;
        }

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

    init();
  }, []);

  useEffect(() => {
    setGraphData(buildNoteGraph(notes));
  }, [notes]);

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !slug.trim()) return;

    if (isPrivate) {
      // Gizli Not Akışı (NIP-59 Gift Wrap)
      setStatusText("Gizli not NIP-44 + NIP-59 ile zarflanıyor...");

      // NOT: Gerçek senaryoda NIP-49 ile yerel depolanan secretKey kullanılır.
      const userSecretKey = nostrService.getSecretKey();

      const giftWrapEvent = createGiftWrap(content, userSecretKey);

      // Relay'lere Gift Wrap (kind: 1059) olarak yayınla
      const ndkEvent = new NDKEvent(nostrService.ndk, giftWrapEvent);
      await ndkEvent.publish();

      const noteSlug = slugify(slug);
      setNotes((prev) => {
        const updated = new Map(prev);
        updated.set(noteSlug, {
          id: giftWrapEvent.id || "gw-" + Date.now(),
          slug: noteSlug,
          content: content,
          createdAt: giftWrapEvent.created_at || Math.floor(Date.now() / 1000),
          pubkey: giftWrapEvent.pubkey,
        });
        return updated;
      });

      setStatusText("Gizli not zarflanıp relay'e gönderildi!");
      setContent("");
    } else {
      // Standart NIP-54 Public Not Akışı...
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

        links.forEach((link) => {
          tags.push(["a", `30818:${userPubkey}:${link.target}`, "", "mention"]);
        });

        event.tags = tags;

        await event.sign();

        if (nostrService.ndk.cacheAdapter) {
          await nostrService.ndk.cacheAdapter.setEvent(event, []);
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

        event.publish().catch((err) => {
          console.warn("Relay'e yayınlanamadı, yerelde saklandı:", err);
        });

        setStatusText("Not başarıyla kaydedildi!");
        setContent("");
      } catch (error) {
        console.error("Kaydetme hatası:", error);
        setStatusText("Hata oluştu!");
      }
    }
  };

  const handleNavigate = (targetSlug: string) => {
    const existing = notes.get(targetSlug);
    setSlug(targetSlug);
    setContent(existing ? existing.content : "");
  };

  if (!ready) return <div style={{ padding: 20 }}>Sistem yükleniyor...</div>;

  return (
    <div style={{ maxWidth: 850, margin: "0 auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1>Nostr Second Brain (NIP-54 & Offline-First)</h1>
      <p style={{ fontSize: 13, color: "#555", background: "#f1f5f9", padding: 8, borderRadius: 4 }}>
        Durum: <strong>{statusText}</strong>
      </p>

      <SimpleGraphView graphData={graphData} onSelectNode={handleNavigate} />

      <form onSubmit={handleSaveNote} style={{ marginBottom: 30, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label style={{ display: "block", marginBottom: 5 }}>Not Başlığı (d tag / Slug):</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            style={{ width: "100%", padding: 8 }}
            required
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 5 }}>İçerik (Wikilink için örn: [[İkinci Not]]):</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            style={{ width: "100%", padding: 8 }}
            placeholder="Notunuzu yazın..."
            required
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            id="isPrivate"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          <label htmlFor="isPrivate" style={{ cursor: "pointer", userSelect: "none" }}>
            Gizli Not Mu? (NIP-44 + NIP-59 Gift Wrap)
          </label>
        </div>

        <button type="submit" style={{ padding: "10px 20px", cursor: "pointer", background: "#0f172a", color: "#fff", border: "none", borderRadius: 4 }}>
          Notu Kaydet ve İmzala
        </button>
      </form>

      <hr />

      <h2>Notlarım ({notes.size})</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        {Array.from(notes.values()).map((note) => (
          <div key={note.id} style={{ border: "1px solid #e2e8f0", padding: 15, borderRadius: 6 }}>
            <h3 style={{ margin: "0 0 10px 0" }}>{note.slug}</h3>
            <WikiContent content={note.content} onNavigate={handleNavigate} />
            <small style={{ color: "#64748b", display: "block", marginTop: 10 }}>
              Tarih: {new Date(note.createdAt * 1000).toLocaleString()} | ID: {note.id.slice(0, 10)}...
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}