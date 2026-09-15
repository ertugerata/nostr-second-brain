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
      this.ndk.signer = NDKPrivateKeySigner.generate();
    }

    await this.ndk.connect();
    this.isConnected = true;
  }
}

export const nostrService = NostrService.getInstance();