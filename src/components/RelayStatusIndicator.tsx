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

    // Event listener subscription for live changes
    const unsubscribe = nostrService.onRelayStatusChange(() => {
      refreshStatus();
    });

    // Periodic polling to stay updated
    const interval = setInterval(() => {
      refreshStatus();
    }, 2000);

    return () => {
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

  return (
    <div className="relay-status-container" ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className={`relay-status-badge ${activeCount > 0 ? "connected" : ready ? "disconnected" : "connecting"}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Relay bağlantı durumunu gör"
      >
        <span className="status-dot">
          {!ready ? "🟡" : activeCount > 0 ? "🟢" : "🔴"}
        </span>
        <span className="status-text">
          {!ready
            ? "Relay'lere Bağlanılıyor..."
            : activeCount > 0
            ? `Nostr Ağına Bağlı (${activeCount}/${totalCount})`
            : `Relay Bağlantısı Yok (0/${totalCount})`}
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
            <div className="relay-section-title">
              BAĞLI RELAY LISTESİ ({nostrService.getConnectedRelays().length})
            </div>
            {relays.length === 0 ? (
              <div className="relay-empty">Tanımlı relay bulunamadı.</div>
            ) : (
              <ul className="relay-list">
                {relays.map((relay) => (
                  <li key={relay.url} className={`relay-item ${relay.connected ? "is-connected" : "is-disconnected"}`}>
                    <span className="relay-indicator-dot">
                      {relay.connected ? "🟢" : "🔴"}
                    </span>
                    <span className="relay-url" title={relay.url}>{relay.url}</span>
                    <span className="relay-status-tag">
                      {relay.connected ? "Bağlı" : "Bağlantı Yok"}
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
