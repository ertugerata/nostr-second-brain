import NDK, { NDKNip07Signer, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";
import { KeyStoreService } from "./utils/keyStore";

const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band"
];

export class NostrService {
  private static instance: NostrService;
  public ndk: NDK;
  public isConnected: boolean = false;
  private cacheAdapter: NDKCacheAdapterDexie;

  private constructor() {
    this.cacheAdapter = new NDKCacheAdapterDexie({ dbName: "nostr-second-brain-db" });

    this.ndk = new NDK({
      explicitRelayUrls: DEFAULT_RELAYS,
      cacheAdapter: this.cacheAdapter,
    });
  }

  public static getInstance(): NostrService {
    if (!NostrService.instance) {
      NostrService.instance = new NostrService();
    }
    return NostrService.instance;
  }

  private userSecretKey?: Uint8Array;

  public async connect(): Promise<void> {
    if (this.isConnected) return;

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
      return true;
    } catch (error) {
      console.error("NIP-49 Parola doğrulama hatası:", error);
      throw new Error("Hatalı parola veya bozuk anahtar verisi!");
    }
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

  public getSecretKey(): Uint8Array {
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
    // Fallback if no private key is directly accessible (e.g., NIP-07)
    let stored = localStorage.getItem("nostr_local_secret_key");
    if (!stored) {
      const newKey = crypto.getRandomValues(new Uint8Array(32));
      stored = Array.from(newKey).map(b => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem("nostr_local_secret_key", stored);
    }
    const match = stored.match(/.{1,2}/g)!;
    this.userSecretKey = new Uint8Array(match.map((byte) => parseInt(byte, 16)));
    return this.userSecretKey;
  }
}

export const nostrService = NostrService.getInstance();