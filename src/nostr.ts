import NDK, { NDKNip07Signer, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";

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