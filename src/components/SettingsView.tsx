import React, { useState, useEffect } from "react";
import { NDKEvent, NDKRelay } from "@nostr-dev-kit/ndk";
import { nostrService } from "../nostr";

interface RelayConfig {
  url: string;
  read: boolean;
  write: boolean;
}

export const SettingsView: React.FC = () => {
  const [relays, setRelays] = useState<RelayConfig[]>([]);
  const [newRelayUrl, setNewRelayUrl] = useState("");
  const [status, setStatus] = useState("");

  // Mevcut NDK Relay Havuzunu Yükle
  useEffect(() => {
    const currentRelays: RelayConfig[] = [];
    nostrService.ndk.pool.relays.forEach((relay: NDKRelay) => {
      currentRelays.push({
        url: relay.url,
        read: true,
        write: true,
      });
    });
    setRelays(currentRelays);
  }, []);

  // Tek Tıkla Yerel strfry (Docker) Relay'i Ekleme
  const handleAddLocalRelay = () => {
    const localUrl = "ws://localhost:7777";
    if (relays.some((r) => r.url === localUrl)) {
      setStatus("Yerel relay zaten listede mevcut.");
      return;
    }
    setRelays([...relays, { url: localUrl, read: true, write: true }]);
    setStatus("Yerel strfry relay listeye eklendi!");
  };

  // Yeni Relay Ekleme
  const handleAddRelay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelayUrl.trim()) return;

    let formattedUrl = newRelayUrl.trim();
    if (!formattedUrl.startsWith("ws://") && !formattedUrl.startsWith("wss://")) {
      formattedUrl = `wss://${formattedUrl}`;
    }

    setRelays([...relays, { url: formattedUrl, read: true, write: true }]);
    setNewRelayUrl("");
  };

  // Relay Silme
  const handleRemoveRelay = (urlToRemove: string) => {
    setRelays(relays.filter((r) => r.url !== urlToRemove));
  };

  // Read/Write Rol Değişimi
  const toggleRole = (url: string, role: "read" | "write") => {
    setRelays(
      relays.map((r) => {
        if (r.url === url) {
          return { ...r, [role]: !r[role] };
        }
        return r;
      })
    );
  };

  // NIP-65 (kind: 10002) Event'i Oluşturma ve Yayınlama
  const handleSaveNip65 = async () => {
    setStatus("NIP-65 Relay listesi imzalanıyor...");

    try {
      const event = new NDKEvent(nostrService.ndk);
      event.kind = 10002; // NIP-65 Relay List Metadata

      // NIP-65 etiket formatı: ["r", "wss://relay.example.com", "read" | "write"]
      const tags: string[][] = [];
      relays.forEach((r) => {
        if (r.read && r.write) {
          tags.push(["r", r.url]); // İkisi de aktifse rol belirtilmez
        } else if (r.read) {
          tags.push(["r", r.url, "read"]);
        } else if (r.write) {
          tags.push(["r", r.url, "write"]);
        }
      });

      event.tags = tags;
      await event.publish();

      // NDK Havuzuna Yeni Relay'leri Anında Bağla
      relays.forEach((r) => {
        nostrService.ndk.addExplicitRelay(r.url);
      });

      setStatus("NIP-65 Relay listesi başarıyla kaydedildi ve yayınlandı!");
    } catch (err) {
      console.error("NIP-65 Yayınlama Hatası:", err);
      setStatus("Hata oluştu! İzinleri veya key durumunu kontrol edin.");
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "20px auto", padding: 20, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>⚙️ Relay Ayarları (NIP-65)</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
        Relay tercihlerinizi NIP-65 standardına göre yapılandırın. Seçtiğiniz `WRITE` relay'leri özel notlarınızın öncelikli hedefleri olur.
      </p>

      {status && (
        <div style={{ padding: 10, background: "#f1f5f9", fontSize: 13, borderRadius: 4, marginBottom: 15, color: "#0f172a" }}>
          {status}
        </div>
      )}

      {/* Hızlı Yerel Relay Ekleme Butonu */}
      <div style={{ marginBottom: 20, padding: 12, background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>🚀 Hızlı Kurulum: Self-Hosted Docker Relay</div>
        <button
          onClick={handleAddLocalRelay}
          style={{ padding: "6px 12px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
        >
          + ws://localhost:7777 (strfry) Ekle
        </button>
      </div>

      {/* Manuel Relay Ekleme Formu */}
      <form onSubmit={handleAddRelay} style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="wss://my-custom-relay.com"
          value={newRelayUrl}
          onChange={(e) => setNewRelayUrl(e.target.value)}
          style={{ flex: 1, padding: 8, border: "1px solid #cbd5e1", borderRadius: 4 }}
        />
        <button type="submit" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
          Ekle
        </button>
      </form>

      {/* Relay Listesi Tablosu */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {relays.map((r) => (
          <div key={r.url} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10, border: "1px solid #e2e8f0", borderRadius: 6 }}>
            <span style={{ fontFamily: "monospace", fontSize: 13 }}>{r.url}</span>
            <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
              <label style={{ fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={r.read} onChange={() => toggleRole(r.url, "read")} /> OKU
              </label>
              <label style={{ fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={r.write} onChange={() => toggleRole(r.url, "write")} /> YAZ
              </label>
              <button onClick={() => handleRemoveRelay(r.url)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>
                ❌
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSaveNip65}
        style={{ width: "100%", padding: 12, background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}
      >
        NIP-65 Relay Tercihlerini Kaydet & Yayınla
      </button>
    </div>
  );
};
