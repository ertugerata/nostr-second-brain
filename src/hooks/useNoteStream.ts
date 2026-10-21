import { useEffect } from "react";
import { NDKEvent, NDKSubscriptionCacheUsage } from "@nostr-dev-kit/ndk";
import { nostrService } from "../nostr";

/**
 * useNoteStream: nostr relay subscription lifecycle (bağlantı, signer user
 * fetch, ilk subscribe). Event dogrusu container'dan gelir.
 *
 * loadMoreNotes function'ı ayrı exported — container'da isLoadingMore state'i
 * ile kullanılabilir.
 */
export function useNoteStream(
  isAuthenticated: boolean,
  setReady: (v: boolean) => void,
  setCurrentUserPubkey: (v: string) => void,
  onEvent: (event: NDKEvent) => void,
) {
  useEffect(() => {
    const init = async () => {
      await nostrService.connect();
      setReady(true);

      if (nostrService.ndk.signer) {
        try {
          const user = await nostrService.ndk.signer.user();
          if (user && user.pubkey) {
            setCurrentUserPubkey(user.pubkey);
          }
        } catch (e) {
          console.warn("Kullanıcı pubkey alınamadı:", e);
        }
      }

      const sub = nostrService.ndk.subscribe(
        { kinds: [30818 as number, 5 as number, 1059 as number], limit: 200 },
        { cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST, closeOnEose: false },
      );

      sub.on("event", (event: NDKEvent) => {
        onEvent(event);
      });
    };

    // isAuthenticated veya stored key yoksa backdrop'ten init
    if (isAuthenticated || !nostrService.hasStoredKey()) {
      init();
    }
  }, [isAuthenticated, onEvent, setReady, setCurrentUserPubkey]);
}

interface LoadMoreNotesParams {
  notes: Map<string, { createdAt: number }>;
  setStatusText: (v: string) => void;
  setIsLoadingMore: (v: boolean) => void;
  onEvent: (event: NDKEvent) => void;
}

/**
 * Load-more pagination: en eski not timestamp'inden bir önceki kayıtları çeker.
 */
export function loadMoreNotes({
  notes,
  setStatusText,
  setIsLoadingMore,
  onEvent,
}: LoadMoreNotesParams) {
  const state = nostrService.getState?.();
  if (state?.loadingMore) return;

  const allNotes = Array.from(notes.values());
  const oldestTimestamp =
    allNotes.length > 0
      ? Math.min(...allNotes.map((n) => n.createdAt))
      : Math.floor(Date.now() / 1000);

  setIsLoadingMore(true);
  setStatusText("Eski notlar relay'lerden çekiliyor...");

  const sub = nostrService.ndk.subscribe(
    {
      kinds: [30818 as number, 5 as number, 1059 as number],
      limit: 200,
      until: oldestTimestamp - 1,
    },
    { cacheUsage: NDKSubscriptionCacheUsage.PARALLEL, closeOnEose: true },
  );

  let count = 0;
  sub.on("event", (event: NDKEvent) => {
    onEvent(event);
    count++;
  });

  sub.on("eose", () => {
    setIsLoadingMore(false);
    setStatusText(`Eski notlar yüklendi (${count} yeni kayıt alındı).`);
  });

  // timeout fallback (zaten EOSE'de kapandı, ama kontrollback)
  setTimeout(() => {
    setIsLoadingMore(false);
  }, 6000);
}
