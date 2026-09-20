import NDK, { NDKEvent, NDKNip07Signer, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";
import { KeyStoreService } from "./utils/keyStore";

/**
 * Relay URL'sini standart formata dönüştürür ve normalize eder.
 * (wss:// veya ws:// ön eki yoksa ekler, boşlukları temizler, trailing slash ve protokol harflerini düzenler).
 */
export function normalizeRelayUrl(url: string): string {
  let trimmed = url.trim();
  if (!trimmed) return "";

  if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
    if (
      trimmed.startsWith("localhost") ||
      trimmed.startsWith("127.0.0.1") ||
      trimmed.startsWith("0.0.0.0")
    ) {
      trimmed = "ws://" + trimmed;
    } else {
      trimmed = "wss://" + trimmed;
    }
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.href;
  } catch (e) {
    return trimmed;
  }
}

export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band"
].map(normalizeRelayUrl);

const RELAY_STORAGE_KEY = "nostr_user_relays";

export function getStoredRelays(): string[] {
  if (typeof localStorage === "undefined") {
    return [...DEFAULT_RELAYS];
  }
  const stored = localStorage.getItem(RELAY_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = Array.from(
          new Set(
            parsed
              .filter((r): r is string => typeof r === "string")
              .map(normalizeRelayUrl)
              .filter((r) => r.length > 0)
          )
        );
        if (normalized.length > 0) {
          localStorage.setItem(RELAY_STORAGE_KEY, JSON.stringify(normalized));
          return normalized;
        }
      }
    } catch (e) {
      console.warn("Relay listesi okunamadı, varsayılana dönülüyor", e);
    }
  }
  return [...DEFAULT_RELAYS];
}

export class NostrService {
  private static instance: NostrService;
  public ndk: NDK;
  public isConnected: boolean = false;
  private cacheAdapter: NDKCacheAdapterDexie;
  private currentRelays: string[];

  private constructor() {
    this.cacheAdapter = new NDKCacheAdapterDexie({ dbName: "nostr-second-brain-db" });
    this.currentRelays = getStoredRelays();

    this.ndk = new NDK({
      explicitRelayUrls: this.currentRelays,
      cacheAdapter: this.cacheAdapter,
    });
  }

  public getRelayUrls(): string[] {
    return [...this.currentRelays];
  }

  public async addRelay(url: string): Promise<boolean> {
    const normalized = normalizeRelayUrl(url);
    if (!normalized) {
      throw new Error("Relay adresi geçersiz.");
    }
    if (this.currentRelays.some((r) => normalizeRelayUrl(r) === normalized)) {
      return false;
    }
    this.currentRelays.push(normalized);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(RELAY_STORAGE_KEY, JSON.stringify(this.currentRelays));
    }
    this.ndk.addExplicitRelay(normalized);
    return true;
  }

  public async removeRelay(url: string): Promise<boolean> {
    const normalized = normalizeRelayUrl(url);
    const initialLength = this.currentRelays.length;
    this.currentRelays = this.currentRelays.filter(
      (r) => normalizeRelayUrl(r) !== normalized && r !== url
    );
    if (this.currentRelays.length === initialLength) return false;

    if (typeof localStorage !== "undefined") {
      localStorage.setItem(RELAY_STORAGE_KEY, JSON.stringify(this.currentRelays));
    }
    const relay = this.ndk.pool.relays.get(normalized) || this.ndk.pool.relays.get(url);
    if (relay) {
      this.ndk.pool.removeRelay(relay.url);
    }
    return true;
  }

  public async resetRelays(): Promise<void> {
    this.currentRelays = [...DEFAULT_RELAYS];
    localStorage.setItem(RELAY_STORAGE_KEY, JSON.stringify(this.currentRelays));
    DEFAULT_RELAYS.forEach((r) => this.ndk.addExplicitRelay(r));
  }

  public static getInstance(): NostrService {
    if (!NostrService.instance) {
      NostrService.instance = new NostrService();
    }
    return NostrService.instance;
  }

  private userSecretKey?: Uint8Array;

  private autoReconnectTimer?: any;
  private autoReconnectSetup: boolean = false;

  /**
   * Sekme arka plandan öne geldiğinde, cihaz tekrar internete bağlandığında
   * veya periyodik aralıklarla kopmuş relay bağlantılarını otomatik olarak yeniden kurar.
   */
  public setupAutoReconnect(intervalMs: number = 10000): void {
    if (this.autoReconnectTimer) {
      clearInterval(this.autoReconnectTimer);
    }

    this.autoReconnectTimer = setInterval(() => {
      this.reconnectDeadRelays();
    }, intervalMs);

    if (!this.autoReconnectSetup) {
      this.autoReconnectSetup = true;

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          this.reconnectDeadRelays();
        }
      });

      window.addEventListener("online", () => {
        this.reconnectDeadRelays();
      });
    }
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;

    localStorage.removeItem("nostr_local_secret_key");

    if (window.nostr) {
      try {
        this.ndk.signer = new NDKNip07Signer();
      } catch (e) {
        console.warn("NIP-07 başlatılamadı, fallback kullanılıyor:", e);
      }
    }

    if (!this.ndk.signer) {
      const privateKeySigner = NDKPrivateKeySigner.generate();
      this.ndk.signer = privateKeySigner;
      if (privateKeySigner.privateKey) {
        const hex = privateKeySigner.privateKey;
        const match = hex.match(/.{1,2}/g);
        if (match) {
          this.userSecretKey = new Uint8Array(match.map((byte) => parseInt(byte, 16)));
        }
      }
    }

    try {
      await this.ndk.connect(2000);
    } catch (e) {
      console.warn("Relay bağlantı zaman aşımı:", e);
    }
    this.isConnected = true;
    this.setupAutoReconnect();
  }

  /**
   * NIP-49 Parolası ile Oturum Açma
   */
  public async loginWithPassphrase(passphrase: string): Promise<boolean> {
    try {
      // 1. NIP-49 ile saklanan anahtarı çöz
      const secretKey = KeyStoreService.unlockKey(passphrase);
      this.userSecretKey = secretKey;

      // 2. NDK için Signer oluştur (Uint8Array cinsinden hex string'e çevirerek)
      const hexKey = Array.from(secretKey)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      this.ndk.signer = new NDKPrivateKeySigner(hexKey);
      await this.ndk.connect();
      this.isConnected = true;
      this.setupAutoReconnect();
      return true;
    } catch (error) {
      console.error("NIP-49 Parola doğrulama hatası:", error);
      throw new Error("Hatalı parola veya bozuk anahtar verisi!");
    }
  }

  /**
   * Bağlantısı kopmuş (connected === false) relay'leri tespit edip
   * yeniden bağlanmayı dener. Her relay için ayrı ayrı hata yakalar,
   * böylece bir relay başarısız olsa da diğerlerini etkilemez.
   */
  private reconnectDeadRelays(): void {
    if (!this.ndk || !this.ndk.pool) return;

    const deadRelays = Array.from(this.ndk.pool.relays.values()).filter(
      (relay) => !relay.connected
    );

    if (deadRelays.length === 0) {
      console.debug("[NostrService] Tüm relay'ler zaten bağlı, yeniden bağlanma gerekmiyor.");
      return;
    }

    console.debug(
      `[NostrService] ${deadRelays.length} kopuk relay tespit edildi, yeniden bağlanılıyor:`,
      deadRelays.map((r) => r.url)
    );

    let revivedCount = 0;
    let failedCount = 0;

    deadRelays.forEach((relay) => {
      relay
        .connect()
        .then(() => {
          revivedCount++;
          console.debug(
            `[NostrService] Bağlantı canlandı (${revivedCount}/${deadRelays.length}): ${relay.url}`
          );
        })
        .catch((e) => {
          failedCount++;
          console.warn(
            `[NostrService] Yeniden bağlanma başarısız (${failedCount} hata): ${relay.url}`,
            e
          );
        });
    });
  }

  /**
   * Aktif olarak bağlı olan relay sayısını döner.
   */
  public getActiveConnectionCount(): number {
    if (!this.ndk || !this.ndk.pool) return 0;
    const connectedMap = new Map<string, boolean>();
    Array.from(this.ndk.pool.relays.values()).forEach((relay) => {
      const norm = normalizeRelayUrl(relay.url);
      if (relay.connected) {
        connectedMap.set(norm, true);
      }
    });
    return connectedMap.size;
  }

  /**
   * Bağlı olan relay adreslerinin listesini döner.
   */
  public getConnectedRelays(): string[] {
    if (!this.ndk || !this.ndk.pool) return [];
    const connectedSet = new Set<string>();
    Array.from(this.ndk.pool.relays.values()).forEach((relay) => {
      if (relay.connected) {
        connectedSet.add(normalizeRelayUrl(relay.url));
      }
    });
    return Array.from(connectedSet);
  }

  /**
   * Tüm relay'lerin URL ve bağlantı durumlarını liste olarak döner.
   */
  public getRelayStatuses(): { url: string; connected: boolean }[] {
    if (!this.ndk || !this.ndk.pool) return [];
    const statusMap = new Map<string, boolean>();
    this.currentRelays.forEach((url) => {
      statusMap.set(normalizeRelayUrl(url), false);
    });

    Array.from(this.ndk.pool.relays.values()).forEach((relay) => {
      const norm = normalizeRelayUrl(relay.url);
      const existing = statusMap.get(norm);
      statusMap.set(norm, existing || relay.connected);
    });

    return Array.from(statusMap.entries()).map(([url, connected]) => ({
      url,
      connected,
    }));
  }

  /**
   * Relay bağlantı durumlarında değişiklik olduğunda tetiklenecek dinleyici ekler.
   */
  public onRelayStatusChange(callback: () => void): () => void {
    if (!this.ndk || !this.ndk.pool) return () => {};

    const events = [
      "relay:connect",
      "relay:disconnect",
      "relay:ready",
      "relay:connecting",
      "connect",
      "flapping"
    ];

    const handler = () => {
      callback();
    };

    events.forEach((evt) => {
      this.ndk.pool.on(evt as any, handler);
    });

    return () => {
      events.forEach((evt) => {
        this.ndk.pool.removeListener(evt as any, handler);
      });
    };
  }

  /**
   * NIP-09 Deletion Event (kind: 5)
   * Belirtilen event veya parametrik adreslenebilir (addressable) not için silme talebi yayınlar.
   */
  public async deleteEvent(eventId: string, noteSlug?: string, reason: string = "Kullanıcı isteği ile silindi"): Promise<NDKEvent> {
    const deleteEvent = new NDKEvent(this.ndk);
    deleteEvent.kind = 5;
    deleteEvent.content = reason;

    const tags: string[][] = [["e", eventId]];

    if (this.ndk.signer) {
      try {
        const user = await this.ndk.signer.user();
        if (user && user.pubkey && noteSlug) {
          tags.push(["a", `30818:${user.pubkey}:${noteSlug}`]);
        }
      } catch (e) {
        console.warn("Kullanıcı pubkey alınamadı, 'a' tagi eklenemedi:", e);
      }
    }

    tags.push(["k", "30818"]);
    deleteEvent.tags = tags;

    await deleteEvent.sign();

    if (this.cacheAdapter) {
      try {
        await this.cacheAdapter.setEvent(deleteEvent, []);
      } catch (e) {
        console.warn("Cache adapter'a deletion event kaydedilemedi:", e);
      }
    }

    await deleteEvent.publish();
    return deleteEvent;
  }

  public isNip07Signer(): boolean {
    return !!(this.ndk.signer && this.ndk.signer instanceof NDKNip07Signer);
  }

  public getSecretKey(): Uint8Array | null {
    if (this.isNip07Signer()) {
      return null;
    }
    if (this.userSecretKey) {
      return this.userSecretKey;
    }
    if (this.ndk.signer && (this.ndk.signer as NDKPrivateKeySigner).privateKey) {
      const hex = (this.ndk.signer as NDKPrivateKeySigner).privateKey!;
      const match = hex.match(/.{1,2}/g);
      if (match) {
        this.userSecretKey = new Uint8Array(match.map((byte) => parseInt(byte, 16)));
        return this.userSecretKey;
      }
    }
    return null;
  }
}

export const nostrService = NostrService.getInstance();