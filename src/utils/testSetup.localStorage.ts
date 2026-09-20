// nostr.ts modülü, singleton NostrService oluşturulurken (modül yüklenir yüklenmez)
// localStorage'a erişiyor. ESM'de import bildirimleri dosyanın başına taşındığı
// (hoisted) için, mock'u aynı dosyada import'lardan SONRA tanımlamak işe yaramaz —
// bu yüzden mock, diğer tüm import'lardan ÖNCE import edilen ayrı bir dosyada kurulur.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    writable: true,
  });
}

export {};
