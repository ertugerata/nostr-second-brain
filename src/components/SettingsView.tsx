import React, { useState, useEffect } from "react";
import { NDKEvent, NDKRelay } from "@nostr-dev-kit/ndk";
import { nostrService, normalizeRelayUrl } from "../nostr";
import { LocalFileSyncService } from "../utils/fileSync";
import {
  getAllowedNpubs,
  addAllowedNpub,
  removeAllowedNpub,
  validateNpub,
} from "../utils/recipientStore";
import { KeyStoreService, validateAndEvaluatePassphrase } from "../utils/keyStore";

interface RelayConfig {
  url: string;
  read: boolean;
  write: boolean;
}

interface SettingsViewProps {
  onKeyUpdated?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onKeyUpdated }) => {
  const [relays, setRelays] = useState<RelayConfig[]>([]);
  const [newRelayUrl, setNewRelayUrl] = useState("");
  const [status, setStatus] = useState("");
  const [selectedDirName, setSelectedDirName] = useState<string | null>(
    LocalFileSyncService.getSelectedDirectoryName()
  );
  const [syncPrivateNotes, setSyncPrivateNotes] = useState<boolean>(() =>
    LocalFileSyncService.isSyncPrivateNotesEnabled()
  );

  // Npub Alıcı Yönetimi State'leri
  const [allowedNpubs, setAllowedNpubs] = useState<string[]>([]);
  const [newNpub, setNewNpub] = useState("");
  const [npubStatus, setNpubStatus] = useState("");

  // NIP-49 Key Vault State'leri
  const [nsecInput, setNsecInput] = useState("");
  const [passphraseInput, setPassphraseInput] = useState("");
  const [keyVaultStatus, setKeyVaultStatus] = useState("");
  const [hasKeyStored, setHasKeyStored] = useState<boolean>(KeyStoreService.hasStoredKey());

  const passphraseStrength = validateAndEvaluatePassphrase(passphraseInput);

  // Mevcut NDK, Stored Relay Havuzunu ve Npub Alıcı Listesini Yükle
  useEffect(() => {
    const currentUrls = nostrService.getRelayUrls().map(normalizeRelayUrl);
    const activePool = Array.from(nostrService.ndk.pool.relays.values()).map((r: NDKRelay) => normalizeRelayUrl(r.url));
    const allUniqueUrls = Array.from(new Set([...currentUrls, ...activePool].filter(Boolean)));

    const initialRelays: RelayConfig[] = allUniqueUrls.map((url) => ({
      url,
      read: true,
      write: true,
    }));
    setRelays(initialRelays);
    setAllowedNpubs(getAllowedNpubs());
    setHasKeyStored(KeyStoreService.hasStoredKey());
  }, []);

  // Kalıcı Anahtar Kaydetme
  const handleSaveKeyVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphraseStrength.isValid) {
      setKeyVaultStatus(`❌ ${passphraseStrength.errorMessage || "Geçersiz parola."}`);
      return;
    }

    try {
      KeyStoreService.encryptAndSaveKey(nsecInput, passphraseInput);
      await nostrService.loginWithPassphrase(passphraseInput);
      setHasKeyStored(true);
      setNsecInput("");
      setPassphraseInput("");
      setKeyVaultStatus("✅ Secret Key kalıcı kasaya (NIP-49) başarıyla kaydedildi ve oturum açıldı!");
      if (onKeyUpdated) {
        onKeyUpdated();
      }
    } catch (err: any) {
      setKeyVaultStatus(`❌ Hata: ${err.message || "Anahtar kaydedilemedi."}`);
    }
  };

  // Kalıcı Kasayı Temizleme
  const handleClearKeyVault = () => {
    if (window.confirm("Kayıtlı gizli anahtarınızı silmek istediğinize emin misiniz?")) {
      KeyStoreService.clearStoredKey();
      setHasKeyStored(false);
      setKeyVaultStatus("Kasanız kilitlendi ve saklanan şifreli anahtar silindi.");
      if (onKeyUpdated) {
        onKeyUpdated();
      }
    }
  };

  // Npub Ekleme İşleyicisi
  const handleAddNpub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNpub.trim()) return;

    const res = addAllowedNpub(newNpub);
    if (res.success) {
      setAllowedNpubs(getAllowedNpubs());
      setNewNpub("");
      setNpubStatus(`✅ ${res.message} (Hex: ${res.hexPubkey?.slice(0, 12)}...)`);
    } else {
      setNpubStatus(`❌ ${res.message}`);
    }
  };

  // Npub Silme İşleyicisi
  const handleRemoveNpub = (npubToRemove: string) => {
    const success = removeAllowedNpub(npubToRemove);
    if (success) {
      setAllowedNpubs(getAllowedNpubs());
      setNpubStatus(`Adres kaldırıldı: ${npubToRemove.slice(0, 16)}...`);
    }
  };

  // Yerel Klasör Seçimi (Local Directory Sync)
  const handleSelectDirectory = async () => {
    const success = await LocalFileSyncService.selectLocalDirectory();
    if (success) {
      const dirName = LocalFileSyncService.getSelectedDirectoryName();
      setSelectedDirName(dirName);
      setStatus(`Yerel senkronizasyon klasörü seçildi: "${dirName}". Kaydedilen notlar bu klasöre .md olarak otomatik yazılacak.`);
    } else {
      setStatus("Yerel klasör seçimi yapılamadı veya iptal edildi.");
    }
  };

  // Tek Tıkla Yerel strfry (Docker / Private Relay) Ekleme
  const handleAddLocalRelay = async () => {
    const localUrl = normalizeRelayUrl("ws://localhost:7777");
    if (relays.some((r) => normalizeRelayUrl(r.url) === localUrl)) {
      setStatus("Yerel private relay (ws://localhost:7777) zaten listede mevcut.");
      return;
    }
    await nostrService.addRelay(localUrl);
    setRelays([...relays, { url: localUrl, read: true, write: true }]);
    setStatus("Yerel strfry (private) relay eklendi ve kaydedildi!");
  };

  // Yeni Relay Ekleme
  const handleAddRelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelayUrl.trim()) return;

    const formattedUrl = normalizeRelayUrl(newRelayUrl);
    if (!formattedUrl) {
      setStatus("Geçersiz relay adresi.");
      return;
    }

    if (relays.some((r) => normalizeRelayUrl(r.url) === formattedUrl)) {
      setStatus("Bu relay zaten listede ekli.");
      return;
    }

    await nostrService.addRelay(formattedUrl);
    setRelays([...relays, { url: formattedUrl, read: true, write: true }]);
    setNewRelayUrl("");
    setStatus(`Relay (${formattedUrl}) başarıyla eklendi.`);
  };

  // Relay Silme
  const handleRemoveRelay = async (urlToRemove: string) => {
    const targetNorm = normalizeRelayUrl(urlToRemove);
    await nostrService.removeRelay(urlToRemove);
    setRelays(relays.filter((r) => normalizeRelayUrl(r.url) !== targetNorm));
    setStatus(`Relay (${urlToRemove}) kaldırıldı.`);
  };

  // Read/Write Rol Değişimi
  const toggleRole = (url: string, role: "read" | "write") => {
    const targetNorm = normalizeRelayUrl(url);
    setRelays(
      relays.map((r) => {
        if (normalizeRelayUrl(r.url) === targetNorm) {
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

      // NDK Havuzuna ve Servise Yeni Relay'leri Anında Kaydet ve Bağla
      for (const r of relays) {
        await nostrService.addRelay(r.url);
      }

      if (onKeyUpdated) {
        onKeyUpdated();
      }

      setStatus("NIP-65 Relay listesi başarıyla kaydedildi ve yayınlandı!");
    } catch (err) {
      console.error("NIP-65 Yayınlama Hatası:", err);
      setStatus("Hata oluştu! İzinleri veya key durumunu kontrol edin.");
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: "20px auto", padding: 20, background: "var(--bg-primary, #fff)", borderRadius: 8, border: "1px solid var(--input-border, #e2e8f0)", color: "var(--text-primary, #0f172a)" }}>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>⚙️ Sistem & Relay Ayarları</h2>
      <p style={{ fontSize: 13, color: "var(--text-muted, #64748b)", marginBottom: 20 }}>
        Kendi Nostr gizli anahtarınızı tanımlayın, relay tercihlerinizi NIP-65 standardına göre yapılandırın, gizli not erişim alıcılarını tanımlayın ve yerel klasör otomatik senkronizasyonunu yönetin.
      </p>

      {status && (
        <div style={{ padding: 10, background: "var(--bg-secondary, #f1f5f9)", fontSize: 13, borderRadius: 4, marginBottom: 15, color: "var(--text-primary, #0f172a)" }}>
          {status}
        </div>
      )}

      {/* Kalıcı Kasa (NIP-49 Private Key Saklama) Bölümü */}
      <div style={{ marginBottom: 24, padding: 14, background: "var(--bg-secondary, #f8fafc)", border: "1px solid var(--input-border, #cbd5e1)", borderRadius: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>🔑 Kalıcı Kasa & Nostr Anahtar Yönetimi (NIP-49)</div>
        <p style={{ fontSize: 12, color: "var(--text-muted, #64748b)", marginBottom: 12 }}>
          Geçici (ephemeral) anahtar yerine kendi Nostr gizli anahtarınızı (<code>nsec1...</code> veya 64 karakterli hex) tanımlayıp belirleyeceğiniz bir kasa parolası ile şifreli (NIP-49 / ncryptsec) saklayabilirsiniz.
        </p>

        {/* Npub / nsec alma rehber bağlantıları */}
        <div style={{ padding: 10, background: "var(--bg-primary, #fff)", borderRadius: 4, border: "1px solid var(--input-border, #e2e8f0)", marginBottom: 14, fontSize: 12 }}>
          <span style={{ fontWeight: 600 }}>💡 Nostr Hesabınız Yok mu?</span>
          <div style={{ marginTop: 4, color: "var(--text-muted, #64748b)", lineHeight: 1.5 }}>
            Aşağıdaki web tabanlı Nostr istemcilerinden birini ziyaret ederek hemen ücretsiz bir <code>npub</code> / <code>nsec</code> anahtar çifti oluşturabilirsiniz:
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            <a href="https://nostrudel.ninja" target="_blank" rel="noreferrer" style={{ color: "var(--accent-blue, #2563eb)", fontWeight: 600, textDecoration: "none" }}>
              🔗 Nostrudel
            </a>
            <a href="https://iris.to" target="_blank" rel="noreferrer" style={{ color: "var(--accent-blue, #2563eb)", fontWeight: 600, textDecoration: "none" }}>
              🔗 Iris (iris.to)
            </a>
            <a href="https://snort.social" target="_blank" rel="noreferrer" style={{ color: "var(--accent-blue, #2563eb)", fontWeight: 600, textDecoration: "none" }}>
              🔗 Snort (snort.social)
            </a>
          </div>
        </div>

        {keyVaultStatus && (
          <div style={{ padding: "8px 10px", background: "var(--bg-primary, #fff)", fontSize: 12, borderRadius: 4, marginBottom: 10, border: "1px solid var(--input-border, #cbd5e1)" }}>
            {keyVaultStatus}
          </div>
        )}

        {hasKeyStored ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10, background: "var(--bg-primary, #fff)", borderRadius: 4, border: "1px solid var(--input-border, #e2e8f0)" }}>
            <div>
              <span style={{ color: "#16a34a", fontWeight: 600, fontSize: 13 }}>✅ Kalıcı Kasa Aktif (NIP-49)</span>
              <p style={{ fontSize: 11, color: "var(--text-muted, #64748b)", margin: "2px 0 0 0" }}>
                Private key'iniz NIP-49 ile şifrelenmiş olarak tarayıcınızda güvenle saklanmaktadır.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearKeyVault}
              style={{ padding: "6px 12px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
            >
              🔒 Kasayı Temizle
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveKeyVault} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Nostr Private Key (nsec1... veya Hex):
              </label>
              <input
                type="password"
                placeholder="nsec1..."
                value={nsecInput}
                onChange={(e) => setNsecInput(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid var(--input-border, #cbd5e1)", borderRadius: 4, background: "var(--bg-primary, #fff)", color: "var(--text-primary, #0f172a)", fontFamily: "monospace", fontSize: 13 }}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                Kasa Şifreleme Parolası (En az 8 karakter):
              </label>
              <input
                type="password"
                placeholder="Parola belirleyin..."
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                style={{ width: "100%", padding: 8, border: "1px solid var(--input-border, #cbd5e1)", borderRadius: 4, background: "var(--bg-primary, #fff)", color: "var(--text-primary, #0f172a)", fontSize: 13 }}
                required
              />
              {passphraseInput.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 11 }}>
                  <span>Parola Gücü: </span>
                  <span style={{ color: passphraseStrength.color, fontWeight: "bold" }}>
                    {passphraseStrength.label}
                  </span>
                  {!passphraseStrength.isValid && passphraseStrength.errorMessage && (
                    <span style={{ color: "#ef4444", marginLeft: 8 }}>
                      ({passphraseStrength.errorMessage})
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              style={{ padding: "8px 16px", background: "var(--accent-blue, #2563eb)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 13, alignSelf: "flex-start" }}
            >
              🔐 Anahtarı Şifrele & Kalıcı Kasaya Kaydet
            </button>
          </form>
        )}
      </div>

      {/* Gizli/Özel Not Alıcıları (Npub Adresleri) Bölümü */}
      <div style={{ marginBottom: 24, padding: 14, background: "var(--bg-secondary, #f8fafc)", border: "1px solid var(--input-border, #cbd5e1)", borderRadius: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>🔒 Gizli Not Okuyucu Alıcıları (Npub Yönetimi)</div>
        <p style={{ fontSize: 12, color: "var(--text-muted, #64748b)", marginBottom: 12 }}>
          Gizli / özel notlarınızı (NIP-59 Gift Wrap) okuyabilmesini istediğiniz kişilerin <code>npub1...</code> adreslerini buraya ekleyin.
          Gizli bir not kaydettiğinizde, bu listedeki her kişi için ayrı bir şifreli zarf oluşturulup yayınlanır.
        </p>

        {npubStatus && (
          <div style={{ padding: "8px 10px", background: "var(--bg-primary, #fff)", fontSize: 12, borderRadius: 4, marginBottom: 10, border: "1px solid var(--input-border, #cbd5e1)" }}>
            {npubStatus}
          </div>
        )}

        <form onSubmit={handleAddNpub} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            type="text"
            placeholder="npub1..."
            value={newNpub}
            onChange={(e) => setNewNpub(e.target.value)}
            style={{ flex: 1, padding: 8, border: "1px solid var(--input-border, #cbd5e1)", borderRadius: 4, background: "var(--bg-primary, #fff)", color: "var(--text-primary, #0f172a)", fontFamily: "monospace", fontSize: 13 }}
          />
          <button type="submit" style={{ padding: "8px 16px", background: "var(--accent-blue, #2563eb)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
            + Alıcı Ekle
          </button>
        </form>

        {allowedNpubs.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted, #64748b)" }}>
              İzin Verilen Alıcı Adresleri ({allowedNpubs.length}):
            </div>
            {allowedNpubs.map((npub) => {
              const val = validateNpub(npub);
              return (
                <div key={npub} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "var(--bg-primary, #fff)", border: "1px solid var(--input-border, #e2e8f0)", borderRadius: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>{npub}</span>
                    {val.hexPubkey && (
                      <span style={{ fontSize: 11, color: "var(--text-muted, #64748b)", fontFamily: "monospace" }}>
                        Hex: {val.hexPubkey.slice(0, 16)}...{val.hexPubkey.slice(-8)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveNpub(npub)}
                    style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}
                    title="Alıcıyı kaldır"
                  >
                    ❌
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-muted, #64748b)", fontStyle: "italic" }}>
            Henüz eklenmiş bir alıcı npub adresi yok. Gizli notlar sadece sizin tarafınızdan okunabilir.
          </div>
        )}
      </div>

      {/* Yerel Klasör Senkronizasyon (Local File Sync) Bölümü */}
      <div style={{ marginBottom: 24, padding: 14, background: "var(--bg-secondary, #f8fafc)", border: "1px solid var(--input-border, #cbd5e1)", borderRadius: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>📂 Yerel Klasör Otomatik Senkronizasyonu (Local .md Sync)</div>
        <p style={{ fontSize: 12, color: "var(--text-muted, #64748b)", marginBottom: 12 }}>
          Bilgisayarınızda belirleyeceğiniz bir klasöre, yazdığınız veya güncellediğiniz notlar anında Markdown (.md) ve YAML Frontmatter formatında otomatik kaydedilir.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button
            type="button"
            onClick={handleSelectDirectory}
            style={{ padding: "8px 14px", background: "var(--accent-blue, #2563eb)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            {selectedDirName ? "📁 Klasörü Değiştir" : "📁 Senkronizasyon Klasörü Seç"}
          </button>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {selectedDirName ? (
              <span style={{ color: "#16a34a" }}>✅ Bağlı Klasör: <strong>{selectedDirName}</strong></span>
            ) : (
              <span style={{ color: "var(--text-muted, #64748b)" }}>Henüz yerel klasör seçilmedi</span>
            )}
          </span>
        </div>

        <div style={{ borderTop: "1px solid var(--input-border, #e2e8f0)", paddingTop: 10, marginTop: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={syncPrivateNotes}
              onChange={(e) => {
                const val = e.target.checked;
                setSyncPrivateNotes(val);
                LocalFileSyncService.setSyncPrivateNotes(val);
                if (val) {
                  setStatus("⚠️ UYARI: Gizli notların yerel diske senkronizasyonu açıldı. Gizli notlar yerel diskte şifrelenmemiş düz metin (.md) olarak saklanacaktır.");
                } else {
                  setStatus("Gizli notların yerel diske senkronizasyonu kapatıldı. Gizli notlar diske yazılmayacaktır.");
                }
              }}
            />
            🔒 Gizli (Gift Wrap) Notları Yerel Diske Senkronize Et
          </label>
          <p style={{ fontSize: 11, color: "var(--text-muted, #64748b)", marginTop: 4, marginLeft: 22, lineHeight: 1.4 }}>
            ⚠️ <strong>Gizlilik Uyarısı:</strong> Yerel diske yazılan <code>.md</code> dosyaları şifrelenmez (düz metin). Gizli notlarınızın bilgisayarınızda açık metin olarak saklanmasını istemiyorsanız bu seçeneği kapalı tutun (varsayılan: kapalı).
          </p>
        </div>
      </div>

      {/* Hızlı Yerel Private Relay Ekleme Butonu */}
      <div style={{ marginBottom: 20, padding: 12, background: "var(--bg-secondary, #f8fafc)", border: "1px solid var(--input-border, #cbd5e1)", borderRadius: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>🚀 Hızlı Kurulum: Self-Hosted Private Docker Relay</div>
        <button
          onClick={handleAddLocalRelay}
          style={{ padding: "6px 12px", background: "#0f172a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
        >
          + ws://localhost:7777 (strfry private relay) Ekle
        </button>
      </div>

      {/* Manuel Relay Ekleme Formu */}
      <form onSubmit={handleAddRelay} style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="wss://my-custom-relay.com veya ws://localhost:8080"
          value={newRelayUrl}
          onChange={(e) => setNewRelayUrl(e.target.value)}
          style={{ flex: 1, padding: 8, border: "1px solid var(--input-border, #cbd5e1)", borderRadius: 4, background: "var(--bg-primary, #fff)", color: "var(--text-primary, #0f172a)" }}
        />
        <button type="submit" style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
          Ekle
        </button>
      </form>

      {/* Relay Listesi Tablosu */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {relays.map((r) => (
          <div key={r.url} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 10, border: "1px solid var(--input-border, #e2e8f0)", borderRadius: 6 }}>
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
