# Glossary

Terms used across this codebase and documentation. When a skill or document uses a domain concept, check here first for the agreed meaning.

## Notes & Content

| Term | Meaning |
|------|---------|
| **Note** | A Nostr event (typically kind 30818 for wiki articles, or kind 1 for text notes) representing a unit of user content. |
| **Public Note** | A note published openly to relays; readable by anyone with relay access. |
| **Private Note** | A note encrypted with NIP-44 and wrapped in a NIP-59 Gift Wrap (kind 1059); only intended recipients can decrypt. |
| **Wiki Article** | A note using NIP-54 semantics (kind 30818, addressable event with `d` tag); the primary content type for this app. |
| **Wikilink** | A `[[Note Title]]` or `[[slug\|Display Name]]` reference to another note, parsed per NIP-54 conventions. |
| **Ghost Node** | A wikilink target that has not yet been created as a note; shown as a dashed, warning-marked node in the graph view. |

## Identity & Keys

| Term | Meaning |
|------|---------|
| **nsec** | Nostr secret key in Bech32 format (`nsec1...`). |
| **npub** | Nostr public key in Bech32 format (`npub1...`); used as a recipient identifier. |
| **Hex Key** | Raw 64-character hexadecimal private key representation. |
| **NIP-07** | Browser extension signer interface (`window.nostr`); allows signing without exposing the key to the page. |
| **NIP-49** | Private key encryption standard; produces `ncryptsec` from an `nsec`/hex key + password using scrypt + XChaCha20-Poly1305. |
| **ncryptsec** | The NIP-49 encrypted form of a private key; stored in localStorage / IndexedDB / Tauri vault. |
| **Ephemeral Key** | A temporary in-memory key used in guest mode; not persisted; upgradeable to a persistent NIP-49 vault. |
| **Vault / Kasa** | The persisted NIP-49 encrypted key store for a user session. |

## Encryption & Gift Wrap

| Term | Meaning |
|------|---------|
| **NIP-44** | Modern encrypted payload standard used for private note content and seals. |
| **NIP-59** | Gift Wrap protocol for secure private note distribution; wraps a Rumor → Seal → event chain. |
| **Rumor** | The inner encrypted note event (kind 30818 or similar) before wrapping. |
| **Seal** | The NIP-44-encrypted payload containing the rumor, wrapped in a kind 13 event. |
| **Gift Wrap** | The outermost event (kind 1059) that contains the seal; addressed to specific recipients via their npub. |
| **Recipient** | A user (identified by npub) authorized to decrypt private notes or asset keys. |
| **AES-256-GCM** | Symmetric encryption used for asset blobs; key distributed via NIP-59 Gift Wrap. |
| **Asset Blob** | A kind 31736 event containing an encrypted file (JPG, PNG, PDF up to 8MB). |
| **Asset Key Rumor** | A kind 31737 event carrying the symmetric AES key, itself wrapped in a Gift Wrap for authorized recipients. |

## Storage & Sync

| Term | Meaning |
|------|---------|
| **IndexedDB** | Browser-side persistent storage backing the offline-first cache (via Dexie / `@nostr-dev-kit/ndk-cache-dexie`). |
| **Offline-First** | The architectural principle that the app reads from local cache first, falling back to relay queries only when needed; works without network. |
| **Local File Sync** | Bidirectional synchronization of notes (`.md` with YAML frontmatter) and assets (`assets/` folder) to a user-selected local directory via the File System Access API or Tauri. |
| **YAML Frontmatter** | The `---`-delimited metadata block at the top of a synced `.md` file (title, pubkey, created_at). |
| **Logseq-style Assets** | The convention of storing attached files in an `assets/` subdirectory parallel to the notes folder. |

## Relay & Network

| Term | Meaning |
|------|---------|
| **Relay** | A Nostr server that stores and relays events; addressed by a URL (typically `wss://...`). |
| **Relay URL Normalization** | The `normalizeRelayUrl` process: ensure `wss://` protocol, lowercase, strip trailing slashes, deduplicate. |
| **Auto-Reconnect** | The `setupAutoReconnect` mechanism that re-establishes relay connections on `visibilitychange` or `online` events. |
| **strfry** | A high-performance C++ Nostr relay server; the project includes a `strfry.conf` for local development and deployment reference. |

## Graph & Visualization

| Term | Meaning |
|------|---------|
| **Graph View** | The interactive 2D/3D visualization of notes and their wikilink connections, powered by `react-force-graph`. |
| **Node** | A note represented as a vertex in the graph; colored/filtered by ownership and connection type. |
| **Edge** | A connection between two notes representing a wikilink relationship. |
| **My Notes & Connections** | The default graph filter: only the user's signed notes and their direct connections are shown. |

## Architecture

| Term | Meaning |
|------|---------|
| **Tauri v2** | The native app framework used for desktop (Linux, Windows) and mobile (Android) builds. |
| **NDK** | Nostr Dev Kit; the TypeScript library for Nostr protocol interactions. |
| **NDK Cache / Dexie** | The IndexedDB-backed caching layer provided by `@nostr-dev-kit/ndk-cache-dexie`. |
