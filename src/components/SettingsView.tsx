import React, { useState, useEffect } from "react";
import { nip19 } from "nostr-tools";
import { KeyStoreService, validateAndEvaluatePassphrase } from "../utils/keyStore";
import { nostrService } from "../nostr";

interface SettingsViewProps {
  onKeyUpdated: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onKeyUpdated }) => {
  const [nsec, setNsec] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [currentPubkey, setCurrentPubkey] = useState<string>("");
  const [currentNpub, setCurrentNpub] = useState<string>("");
  const [currentNsec, setCurrentNsec] = useState<string>("");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [relays, setRelays] = useState<string[]>([]);
  const [newRelayUrl, setNewRelayUrl] = useState("");
  const [relayMsg, setRelayMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const hasStoredKey = KeyStoreService.hasStoredKey();

  const refreshRelays = () => {
    setRelays(nostrService.getRelayUrls());
  };

  useEffect(() => {
    refreshRelays();
    const cleanup = nostrService.onRelayStatusChange(() => {
      refreshRelays();
    });
    return cleanup;
  }, []);

  const handleAddRelay = async (e: React.FormEvent) => {
    e.preventDefault();
    setRelayMsg(null);
    try {
      const added = await nostrService.addRelay(newRelayUrl);
      if (added) {
        setRelayMsg({ text: `Relay eklendi: ${newRelayUrl}`, isError: false });
        setNewRelayUrl("");
        refreshRelays();
      } else {
        setRelayMsg({ text: "Bu relay zaten ekli.", isError: true });
      }
    } catch (err: any) {
      setRelayMsg({ text: err.message || "Relay eklenemedi.", isError: true });
    }
  };

  const handleRemoveRelay = async (url: string) => {
    try {
      await nostrService.removeRelay(url);
      setRelayMsg({ text: `Relay çıkarıldı: ${url}`, isError: false });
      refreshRelays();
    } catch (err: any) {
      setRelayMsg({ text: "Relay çıkarılamadı.", isError: true });
    }
  };

  const handleResetRelays = async () => {
    await nostrService.resetRelays();
    setRelayMsg({ text: "Relay listesi varsayılana sıfırlandı.", isError: false });
    refreshRelays();
  };

  useEffect(() => {
    async function loadKeyInfo() {
      try {
        if (nostrService.ndk.signer) {
          const user = await nostrService.ndk.signer.user();
          setCurrentPubkey(user.pubkey);
          try {
            setCurrentNpub(nip19.npubEncode(user.pubkey));
          } catch (e) {
            console.error("npub encoding error", e);
          }
        }

        if (nostrService.isNip07Signer()) {
          setCurrentNsec("");
        } else {
          const secretKey = nostrService.getSecretKey();
          if (secretKey) {
            setCurrentNsec(nip19.nsecEncode(secretKey));
          } else {
            setCurrentNsec("");
          }
        }
      } catch (err) {
        console.error("Anahtar bilgileri yüklenemedi", err);
      }
    }
    loadKeyInfo();
  }, []);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    let formattedNsec = nsec.trim();
    if (!formattedNsec) {
      setStatusMsg({ text: "Lütfen bir Secret Key (nsec veya hex) girin.", isError: true });
      return;
    }

    const strength = validateAndEvaluatePassphrase(passphrase);
    if (!strength.isValid) {
      setStatusMsg({ text: strength.errorMessage || "Parola en az 8 karakter olmalıdır.", isError: true });
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setStatusMsg({ text: "Parolalar birbiriyle eşleşmiyor!", isError: true });
      return;
    }

    try {
      if (/^[0-9a-fA-F]{64}$/.test(formattedNsec)) {
        const bytes = new Uint8Array(
          formattedNsec.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
        );
        formattedNsec = nip19.nsecEncode(bytes);
      }

      if (!formattedNsec.startsWith("nsec1")) {
        setStatusMsg({ text: "Geçersiz Secret Key formatı! (nsec1... veya 64 karakter hex olmalıdır)", isError: true });
        return;
      }

      KeyStoreService.encryptAndSaveKey(formattedNsec, passphrase);
      await nostrService.loginWithPassphrase(passphrase);

      setStatusMsg({ text: "Secret key başarıyla şifrelendi ve kaydedildi!", isError: false });
      setNsec("");
      setPassphrase("");
      setConfirmPassphrase("");

      const user = await nostrService.ndk.signer!.user();
      setCurrentPubkey(user.pubkey);
      setCurrentNpub(nip19.npubEncode(user.pubkey));
      const secretKey = nostrService.getSecretKey();
      if (secretKey) {
        setCurrentNsec(nip19.nsecEncode(secretKey));
      }

      onKeyUpdated();
    } catch (err: any) {
      setStatusMsg({ text: err.message || "Secret Key kaydedilemedi.", isError: true });
    }
  };

  const handleClearKey = () => {
    if (window.confirm("Kayıtlı gizli anahtarı silmek istediğinize emin misiniz?")) {
      KeyStoreService.clearStoredKey();
      setStatusMsg({ text: "Kayıtlı gizli anahtar temizlendi.", isError: false });
      onKeyUpdated();
    }
  };

  return (
    <div className="settings-container" style={{ padding: "20px", maxWidth: "700px" }}>
      <h2>⚙️ Ayarlar & Anahtar Yönetimi</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: "20px", fontSize: "14px" }}>
        Nostr gizli anahtarınızı (Secret Key / nsec) güvenli bir şekilde tanımlayın veya güncelleyin.
        Anahtarınız NIP-49 standartlarına uygun şekilde kasa parolanız ile şifrelenerek saklanır.
      </p>

      {statusMsg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "6px",
            marginBottom: "20px",
            fontSize: "14px",
            backgroundColor: statusMsg.isError ? "var(--bg-secondary)" : "var(--bg-secondary)",
            color: statusMsg.isError ? "#dc2626" : "#16a34a",
            border: `1px solid ${statusMsg.isError ? "#fca5a5" : "#86efac"}`,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Aktif Hesap Bilgileri */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ fontSize: "15px", marginBottom: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", color: "var(--text-primary)" }}>
          👤 Aktif Nostr Kimliği
        </h3>

        {currentNpub && (
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Public Key (npub):</label>
            <code style={{ fontSize: "13px", wordBreak: "break-all", background: "var(--code-bg)", color: "var(--text-primary)", padding: "4px 8px", borderRadius: "4px", display: "block" }}>
              {currentNpub}
            </code>
          </div>
        )}

        {currentPubkey && (
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Public Key (Hex):</label>
            <code style={{ fontSize: "13px", wordBreak: "break-all", background: "var(--code-bg)", color: "var(--text-primary)", padding: "4px 8px", borderRadius: "4px", display: "block" }}>
              {currentPubkey}
            </code>
          </div>
        )}

        {nostrService.isNip07Signer() ? (
          <div>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Secret Key:</label>
            <span style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
              Secret key NIP-07 eklentisinde saklanıyor, buradan görüntülenemez.
            </span>
          </div>
        ) : currentNsec ? (
          <div>
            <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Mevcut Secret Key (nsec):</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
              <code style={{ fontSize: "13px", wordBreak: "break-all", background: "var(--code-bg)", color: "var(--text-primary)", padding: "4px 8px", borderRadius: "4px", flex: 1 }}>
                {showSecretKey ? currentNsec : "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"}
              </code>
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                style={{ padding: "4px 10px", fontSize: "12px", cursor: "pointer", border: "1px solid var(--input-border)", borderRadius: "4px", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
              >
                {showSecretKey ? "Gizle" : "Göster"}
              </button>
            </div>
          </div>
        ) : null}

        {hasStoredKey && (
          <div style={{ marginTop: "16px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
            <span style={{ fontSize: "12px", color: "#16a34a", background: "var(--bg-secondary)", padding: "4px 8px", borderRadius: "4px" }}>
              🔒 NIP-49 Şifrelenmiş Anahtar Cihazda Saklanıyor
            </span>
            <button
              type="button"
              onClick={handleClearKey}
              style={{
                marginLeft: "12px",
                padding: "4px 10px",
                fontSize: "12px",
                color: "#dc2626",
                background: "none",
                border: "1px solid #fca5a5",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Kayıtlı Key'i Sil
            </button>
          </div>
        )}
      </div>

      {/* Relay Yönetimi Bölümü */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
          <h3 style={{ fontSize: "15px", margin: 0, color: "var(--text-primary)" }}>
            🌐 Relay Yönetimi
          </h3>
          <button
            type="button"
            onClick={handleResetRelays}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              cursor: "pointer",
              border: "1px solid var(--input-border)",
              borderRadius: "4px",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
            }}
          >
            Varsayılana Sıfırla
          </button>
        </div>

        {relayMsg && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              marginBottom: "12px",
              fontSize: "13px",
              color: relayMsg.isError ? "#dc2626" : "#16a34a",
              backgroundColor: "var(--bg-secondary)",
              border: `1px solid ${relayMsg.isError ? "#fca5a5" : "#86efac"}`,
            }}
          >
            {relayMsg.text}
          </div>
        )}

        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0" }}>
          {relays.map((url) => {
            const status = nostrService.getRelayStatuses().find((s) => s.url === url);
            const isConnected = status?.connected ?? false;
            return (
              <li
                key={url}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderBottom: "1px solid var(--border-color)",
                  fontSize: "13px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: isConnected ? "#22c55e" : "#ef4444",
                      display: "inline-block",
                    }}
                    title={isConnected ? "Bağlı" : "Bağlantı yok"}
                  />
                  <code style={{ color: "var(--text-primary)" }}>{url}</code>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRelay(url)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  title="Relay'i kaldır"
                >
                  🗑️
                </button>
              </li>
            );
          })}
        </ul>

        <form onSubmit={handleAddRelay} style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            placeholder="wss://relay.example.com"
            value={newRelayUrl}
            onChange={(e) => setNewRelayUrl(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: "13px",
              border: "1px solid var(--input-border)",
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-primary)",
              borderRadius: "6px",
            }}
            required
          />
          <button
            type="submit"
            style={{
              padding: "8px 14px",
              background: "var(--accent-blue)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Relay Ekle
          </button>
        </form>
      </div>

      {/* Secret Key Form */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "16px",
        }}
      >
        <h3 style={{ fontSize: "15px", marginBottom: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", color: "var(--text-primary)" }}>
          🔑 Secret Key (Gizli Anahtar) Tanımla / Güncelle
        </h3>

        <form onSubmit={handleSaveKey} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px", color: "var(--text-primary)" }}>
              Nostr Secret Key (nsec1... veya 64 karakter Hex):
            </label>
            <input
              type="password"
              placeholder="nsec1..."
              value={nsec}
              onChange={(e) => setNsec(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "14px",
                border: "1px solid var(--input-border)",
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)",
                borderRadius: "6px",
                boxSizing: "border-box",
              }}
              required
            />
            {passphrase.length > 0 && (
              <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                <span>Parola Gücü: </span>
                <span style={{ color: validateAndEvaluatePassphrase(passphrase).color, fontWeight: "bold" }}>
                  {validateAndEvaluatePassphrase(passphrase).label}
                </span>
                {!validateAndEvaluatePassphrase(passphrase).isValid && validateAndEvaluatePassphrase(passphrase).errorMessage && (
                  <div style={{ color: "#ef4444", fontSize: "11px", marginTop: "2px" }}>
                    {validateAndEvaluatePassphrase(passphrase).errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px", color: "var(--text-primary)" }}>
              Kasa Parolası (NIP-49 Şifreleme için):
            </label>
            <input
              type="password"
              placeholder="Parolanız..."
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "14px",
                border: "1px solid var(--input-border)",
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)",
                borderRadius: "6px",
                boxSizing: "border-box",
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px", color: "var(--text-primary)" }}>
              Kasa Parolası Tekrarı:
            </label>
            <input
              type="password"
              placeholder="Parolanızı tekrar girin..."
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                fontSize: "14px",
                border: "1px solid var(--input-border)",
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)",
                borderRadius: "6px",
                boxSizing: "border-box",
              }}
              required
            />
          </div>

          <button
            type="submit"
            style={{
              padding: "10px 16px",
              background: "var(--accent-blue)",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              marginTop: "8px",
            }}
          >
            Secret Key'i Şifrele ve Kaydet
          </button>
        </form>
      </div>
    </div>
  );
};
