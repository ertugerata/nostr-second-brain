import React, { useState } from "react";
import { KeyStoreService, validateAndEvaluatePassphrase } from "../utils/keyStore";
import { nostrService } from "../nostr";

interface KeyLoginFormProps {
  onSuccess: () => void;
}

export const KeyLoginForm: React.FC<KeyLoginFormProps> = ({ onSuccess }) => {
  const hasKey = KeyStoreService.hasStoredKey();
  const [nsec, setNsec] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");

  const strength = validateAndEvaluatePassphrase(passphrase);

  // İlk Kurulum: nsec + Parola girerek kaydetme
  const handleSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!strength.isValid) {
      setError(strength.errorMessage || "Geçersiz parola.");
      return;
    }
    try {
      KeyStoreService.encryptAndSaveKey(nsec, passphrase);
      handleUnlock(e);
    } catch (err: any) {
      setError(err.message || "Anahtar şifrelenemedi.");
    }
  };

  // Sonraki Girişler: Sadece Parola ile kilit açma
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await nostrService.loginWithPassphrase(passphrase);
      onSuccess();
    } catch (err: any) {
      setError("Hatalı parola!");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "40px auto", padding: 20, border: "1px solid #ccc", borderRadius: 8 }}>
      <h3>{hasKey ? "Kilitli Kasayı Aç (NIP-49)" : "Yeni Anahtar Tanımla (NIP-49)"}</h3>
      {error && <p style={{ color: "red", fontSize: 13 }}>{error}</p>}

      <form onSubmit={hasKey ? handleUnlock : handleSetup} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!hasKey && (
          <div>
            <label style={{ display: "block", fontSize: 13 }}>Nostr Private Key (nsec...):</label>
            <input
              type="password"
              value={nsec}
              onChange={(e) => setNsec(e.target.value)}
              style={{ width: "100%", padding: 8 }}
              required
            />
          </div>
        )}

        <div>
          <label style={{ display: "block", fontSize: 13 }}>Kasa Parolası:</label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            style={{ width: "100%", padding: 8 }}
            required
          />
          {!hasKey && passphrase.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              <span>Parola Gücü: </span>
              <span style={{ color: strength.color, fontWeight: "bold" }}>
                {strength.label}
              </span>
              {!strength.isValid && strength.errorMessage && (
                <div style={{ color: "#ef4444", fontSize: 11, marginTop: 2 }}>
                  {strength.errorMessage}
                </div>
              )}
            </div>
          )}
        </div>

        <button type="submit" style={{ padding: 10, background: "#0f172a", color: "#fff", border: "none", borderRadius: 4 }}>
          {hasKey ? "Kilidi Aç" : "Şifrele ve Sakla"}
        </button>
      </form>
    </div>
  );
};
