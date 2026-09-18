import NDK, { NDKEvent, NDKNip07Signer, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";
import { KeyStoreService } from "./utils/keyStore";

export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band"
];

const RELAY_STORAGE_KEY = "nostr_user_relays";

export function getStoredRelays(): string[] {
  const stored = localStorage.getItem(RELAY_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      console.warn("Relay listesi okunamadı, varsayılana dönülüyor", e);
    }
  }
  return DEFAULT_RELAYS;
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
    const trimmed = url.trim();
    if (!trimmed.startsWith("wss://") && !trimmed.startsWith("ws://")) {
      throw new Error("Relay adresi wss:// veya ws:// ile başlamalıdır.");
    }
    if (this.currentRelays.includes(trimmed)) {
      return false;
    }
    this.currentRelays.push(trimmed);
    localStorage.setItem(RELAY_STORAGE_KEY, JSON.stringify(this.currentRelays));
    this.ndk.addExplicitRelay(trimmed);
    return true;
  }

  public async removeRelay(url: string): Promise<boolean> {
    const index = this.currentRelays.indexOf(url);
    if (index === -1) return false;
    this.currentRelays.splice(index, 1);
    localStorage.setItem(RELAY_STORAGE_KEY, JSON.stringify(this.currentRelays));
    const relay = this.ndk.pool.relays.get(url);
    if (relay) {
      this.ndk.pool.removeRelay(url);
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
    return Array.from(this.ndk.pool.relays.values()).filter((relay) => relay.connected).length;
  }

  /**
   * Bağlı olan relay adreslerinin listesini döner.
   */
  public getConnectedRelays(): string[] {
    if (!this.ndk || !this.ndk.pool) return [];
    return Array.from(this.ndk.pool.relays.values())
      .filter((relay) => relay.connected)
      .map((relay) => relay.url);
  }

  /**
   * Tüm relay'lerin URL ve bağlantı durumlarını liste olarak döner.
   */
  public getRelayStatuses(): { url: string; connected: boolean }[] {
    if (!this.ndk || !this.ndk.pool) return [];
    return Array.from(this.ndk.pool.relays.values()).map((relay) => ({
      url: relay.url,
      connected: relay.connected,
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