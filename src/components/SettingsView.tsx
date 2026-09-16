import React, { useState, useEffect } from "react";
import { nip19 } from "nostr-tools";
import { KeyStoreService } from "../utils/keyStore";
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

  const hasStoredKey = KeyStoreService.hasStoredKey();

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

        const secretKey = nostrService.getSecretKey();
        if (secretKey) {
          setCurrentNsec(nip19.nsecEncode(secretKey));
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

    if (passphrase.length < 4) {
      setStatusMsg({ text: "Parola en az 4 karakter olmalıdır.", isError: true });
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setStatusMsg({ text: "Parolalar birbiriyle eşleşmiyor!", isError: true });
      return;
    }

    try {
      // Hex formatında verilmişse nsec'e dönüştür
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

      // Update public key / nsec in UI
      const user = await nostrService.ndk.signer!.user();
      setCurrentPubkey(user.pubkey);
      setCurrentNpub(nip19.npubEncode(user.pubkey));
      const secretKey = nostrService.getSecretKey();
      setCurrentNsec(nip19.nsecEncode(secretKey));

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
      <p style={{ color: "#64748b", marginBottom: "20px", fontSize: "14px" }}>
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
            backgroundColor: statusMsg.isError ? "#fef2f2" : "#f0fdf4",
            color: statusMsg.isError ? "#991b1b" : "#166534",
            border: `1px solid ${statusMsg.isError ? "#fecaca" : "#bbf7d0"}`,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Aktif Hesap Bilgileri */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ fontSize: "15px", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
          👤 Aktif Nostr Kimliği
        </h3>

        {currentNpub && (
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Public Key (npub):</label>
            <code style={{ fontSize: "13px", wordBreak: "break-all", background: "#f8fafc", padding: "4px 8px", borderRadius: "4px", display: "block" }}>
              {currentNpub}
            </code>
          </div>
        )}

        {currentPubkey && (
          <div style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Public Key (Hex):</label>
            <code style={{ fontSize: "13px", wordBreak: "break-all", background: "#f8fafc", padding: "4px 8px", borderRadius: "4px", display: "block" }}>
              {currentPubkey}
            </code>
          </div>
        )}

        {currentNsec && (
          <div>
            <label style={{ fontSize: "12px", color: "#64748b", display: "block" }}>Mevcut Secret Key (nsec):</label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
              <code style={{ fontSize: "13px", wordBreak: "break-all", background: "#f8fafc", padding: "4px 8px", borderRadius: "4px", flex: 1 }}>
                {showSecretKey ? currentNsec : "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"}
              </code>
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                style={{ padding: "4px 10px", fontSize: "12px", cursor: "pointer", border: "1px solid #cbd5e1", borderRadius: "4px", background: "#f1f5f9" }}
              >
                {showSecretKey ? "Gizle" : "Göster"}
              </button>
            </div>
          </div>
        )}

        {hasStoredKey && (
          <div style={{ marginTop: "16px", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
            <span style={{ fontSize: "12px", color: "#166534", background: "#dcfce7", padding: "4px 8px", borderRadius: "4px" }}>
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

      {/* Secret Key Tanımlama / Güncelleme Formu */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: "16px",
        }}
      >
        <h3 style={{ fontSize: "15px", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
          🔑 Secret Key (Gizli Anahtar) Tanımla / Güncelle
        </h3>

        <form onSubmit={handleSaveKey} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
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
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                boxSizing: "border-box",
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
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
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                boxSizing: "border-box",
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
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
                border: "1px solid #cbd5e1",
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
              background: "#0f172a",
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
