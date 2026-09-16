import React, { useEffect, useState, useRef } from "react";
import { nostrService } from "../nostr";

interface RelayStatus {
  url: string;
  connected: boolean;
}

interface RelayStatusIndicatorProps {
  ready: boolean;
}

export const RelayStatusIndicator: React.FC<RelayStatusIndicatorProps> = ({ ready }) => {
  const [relays, setRelays] = useState<RelayStatus[]>([]);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshStatus = () => {
    const currentStatuses = nostrService.getRelayStatuses();
    const currentActiveCount = nostrService.getActiveConnectionCount();
    setRelays(currentStatuses);
    setActiveCount(currentActiveCount);
  };

  useEffect(() => {
    refreshStatus();

    // Listen to network status changes
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Event listener subscription for live relay changes
    const unsubscribe = nostrService.onRelayStatusChange(() => {
      refreshStatus();
    });

    // Periodic polling to stay updated
    const interval = setInterval(() => {
      refreshStatus();
    }, 2000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const totalCount = relays.length;
  const isConnected = isOnline && activeCount > 0;
  const isOfflineMode = !isOnline || (ready && activeCount === 0);

  return (
    <div className="relay-status-container" ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className={`relay-status-badge ${isConnected ? "connected" : isOfflineMode ? "disconnected" : "connecting"}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Relay ve Bağlantı Durumunu Gör"
      >
        <span className="status-dot">
          {!ready ? "🟡" : isConnected ? "🟢" : "🔴"}
        </span>
        <span className="status-text">
          {!ready
            ? "Relay'lere Bağlanılıyor..."
            : isConnected
            ? `Nostr Ağına Bağlı (${activeCount}/${totalCount})`
            : "Çevrimdışı (Önbellek Modu)"}
        </span>
        <span className="dropdown-arrow">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="relay-popover">
          <div className="relay-popover-header">
            <h4>Relay Bağlantı Durumu</h4>
            <span className="relay-count-summary">
              Aktif Bağlantı: <strong>{activeCount} / {totalCount}</strong>
            </span>
          </div>

          <div className="relay-popover-body">
            {isOfflineMode && (
              <div className="offline-mode-banner">
                <span className="offline-icon">💾</span>
                <div className="offline-info">
                  <strong>Çevrimdışı (Önbellek Modu)</strong>
                  <p>
                    İnternet veya relay kesintisinde Offline-First mimarimiz sayesinde not okumaya ve yerel veritabanına not yazmaya kesintisiz devam edebilirsiniz.
                  </p>
                </div>
              </div>
            )}

            <div className="relay-section-title">
              BAĞLI RELAY LISTESİ ({nostrService.getConnectedRelays().length})
            </div>
            {relays.length === 0 ? (
              <div className="relay-empty">Tanımlı relay bulunamadı.</div>
            ) : (
              <ul className="relay-list">
                {relays.map((relay) => (
                  <li key={relay.url} className={`relay-item ${isOnline && relay.connected ? "is-connected" : "is-disconnected"}`}>
                    <span className="relay-indicator-dot">
                      {isOnline && relay.connected ? "🟢" : "🔴"}
                    </span>
                    <span className="relay-url" title={relay.url}>{relay.url}</span>
                    <span className="relay-status-tag">
                      {isOnline && relay.connected ? "Bağlı" : "Bağlantı Yok"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
