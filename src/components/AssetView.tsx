import React, { useEffect, useState } from "react";
import { resolveAsset, AssetAccessDeniedError } from "../utils/assets";
import { nostrService } from "../nostr";

interface AssetViewProps {
  assetId: string;
  alt: string;
  kind: "image" | "file";
}

type LoadState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "error"; message: string }
  | { status: "ready"; url: string; mime: string; filename: string };

/**
 * `asset:<id>` referanslarını çözer. Notu/asset'i okuma izni olmayan bir kullanıcı
 * için (AssetAccessDeniedError) kilitli bir kutu gösterir — hiçbir veri sızdırmaz,
 * yalnızca erişimin reddedildiğini belirtir.
 */
export const AssetView: React.FC<AssetViewProps> = ({ assetId, alt, kind }) => {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    (async () => {
      try {
        const secretKey = nostrService.getSecretKey();
        const resolved = await resolveAsset(assetId, secretKey);
        if (cancelled) {
          URL.revokeObjectURL(resolved.url);
          return;
        }
        createdUrl = resolved.url;
        setState({ status: "ready", url: resolved.url, mime: resolved.mime, filename: resolved.filename });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AssetAccessDeniedError) {
          setState({ status: "denied" });
        } else {
          setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [assetId]);

  const boxStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 6,
    fontSize: 13,
    border: "1px solid var(--input-border, #e2e8f0)",
    background: "var(--bg-secondary, #f8fafc)",
    color: "var(--text-muted, #64748b)",
  };

  if (state.status === "loading") {
    return <span style={boxStyle}>⏳ {alt || "asset"} yükleniyor...</span>;
  }

  if (state.status === "denied") {
    return <span style={{ ...boxStyle, color: "#b91c1c", borderColor: "#fecaca" }}>🔒 Bu asset'e erişim yetkiniz yok</span>;
  }

  if (state.status === "error") {
    return <span style={{ ...boxStyle, color: "#b91c1c" }}>⚠️ Asset yüklenemedi: {state.message}</span>;
  }

  if (kind === "image" && state.mime.startsWith("image/")) {
    return (
      <img
        src={state.url}
        alt={alt || state.filename}
        style={{ maxWidth: "100%", borderRadius: 6, margin: "6px 0" }}
      />
    );
  }

  // PDF veya diğer dosya türleri: yeni sekmede aç
  return (
    <a href={state.url} target="_blank" rel="noopener noreferrer" style={{ ...boxStyle, textDecoration: "none" }}>
      📄 {state.filename}
    </a>
  );
};
